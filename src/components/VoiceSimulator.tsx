'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  time: string;
}

interface ExecutedAction {
  id: string;
  icon: string;
  label: string;
  detail: string;
  time: string;
}

interface SectorConfig {
  id: string;
  name: string;
  business: string;
  sector: string;
  icon: string;
  badge: string;
  quickPrompts: string[];
  initialGreeting: string;
}

const SECTORS: SectorConfig[] = [
  {
    id: 'sante',
    name: 'Cabinet Médical & Soins Infirmiers',
    business: 'Cabinet Médical',
    sector: 'Santé & Paramédical',
    icon: '🏥',
    badge: 'Triage & RDV Soins 24/7',
    quickPrompts: [
      'Bonjour, j’ai une ordonnance pour des pansements quotidiens dès demain matin à domicile.',
      'Est-il possible de faire passer une infirmière vers 8h30 à mon domicile ?',
      'J’ai une forte fièvre et une vive douleur après mon opération, que dois-je faire ?',
    ],
    initialGreeting:
      'Cabinet Médical et Soins à Domicile, bonjour ! Je suis votre assistante téléphonique. Comment puis-je vous aider aujourd’hui ?',
  },
  {
    id: 'btp',
    name: 'Entreprise BTP & Artisans',
    business: 'Rénovation & Travaux',
    sector: 'Artisans & Bâtiment',
    icon: '🏗️',
    badge: 'Devis Express par SMS',
    quickPrompts: [
      'Bonjour, j’ai une rénovation complète de salle de bain d’environ 15m² et j’aimerais un devis.',
      'C’est urgent, j’ai une fuite sous ma baignoire qui coule chez le voisin !',
      'J’ai reçu votre SMS, où puis-je déposer les photos de mon chantier ?',
    ],
    initialGreeting:
      'Entreprise générale de bâtiment et rénovation, bonjour ! Vous êtes en relation avec l’accueil téléphonique. Quel est votre projet de travaux ?',
  },
  {
    id: 'voxflow',
    name: 'Standard Général VoxFlow AI',
    business: 'Standard Intelligent',
    sector: 'Accueil Téléphonique 24/7',
    icon: '⚡',
    badge: 'Démonstrateur Officiel',
    quickPrompts: [
      'Comment VoxFlow s’installe-t-il sur la ligne de mon entreprise ?',
      'Est-ce que l’IA peut synchroniser directement les rendez-vous dans mon Google Calendar ?',
      'Combien coûte le service et comment tester gratuitement ?',
    ],
    initialGreeting:
      'Bonjour et bienvenue sur le standard VoxFlow AI ! Je suis votre assistant en direct. Vous pouvez me poser vos questions ou tester un scénario d’accueil réel.',
  },
];

export default function VoiceSimulator() {
  const [selectedSectorIndex, setSelectedSectorIndex] = useState(0);
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executedActions, setExecutedActions] = useState<ExecutedAction[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [audioWaves, setAudioWaves] = useState<number[]>([25, 40, 30, 60, 45, 55, 30, 50, 40, 65, 35, 45]);
  const [liveMode, setLiveMode] = useState<'webrtc' | 'simulation'>('webrtc');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const sector = SECTORS[selectedSectorIndex];

  // WebRTC References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptBufferRef = useRef<string>('');

  // Audio wave visualizer animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const isVoiceActive = callState === 'connected' || callState === 'speaking' || callState === 'listening';

    if (isVoiceActive) {
      interval = setInterval(() => {
        setAudioWaves((prev) =>
          prev.map(() => {
            if (callState === 'speaking') {
              return Math.floor(Math.random() * 70) + 25;
            } else if (callState === 'listening') {
              return Math.floor(Math.random() * 50) + 20;
            } else {
              return Math.floor(Math.random() * 25) + 15;
            }
          })
        );
      }, 100);
    } else {
      setAudioWaves([15, 25, 18, 30, 20, 25, 18, 22, 28, 20, 15, 22]);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Clean up WebRTC connection on unmount
  useEffect(() => {
    return () => {
      terminateWebRTC();
    };
  }, []);

  const terminateWebRTC = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const getNowFormatted = () => {
    const d = new Date();
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const addAction = (icon: string, label: string, detail: string) => {
    setExecutedActions((prev) => [
      {
        id: Math.random().toString(),
        icon,
        label,
        detail,
        time: getNowFormatted(),
      },
      ...prev,
    ]);
  };

  const addMessage = (speaker: 'user' | 'ai', text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        speaker,
        text,
        time: getNowFormatted(),
      },
    ]);
  };

  // Start Call Handler (GPT Live WebRTC with automatic fallback)
  const handleStartCall = async () => {
    terminateWebRTC();
    setCallState('connecting');
    setMessages([]);
    setExecutedActions([]);
    setStatusNotice(null);

    try {
      // 1. Request microphone access
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
      } catch (micErr) {
        console.warn('Microphone permission denied or not available:', micErr);
        setStatusNotice('Microphone non détecté ou refusé. Mode texte et simulation activé.');
      }

      // 2. Fetch ephemeral Realtime session token from our server
      const sessionRes = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector: sector.id, voice: 'marin', model: 'gpt-realtime-2.1-mini' }),
      });

      const sessionData = await sessionRes.json();

      // If OpenAI Realtime API session is unavailable (e.g. quota exhausted on server key)
      if (!sessionRes.ok || !sessionData.clientSecret) {
        console.warn('OpenAI Realtime session error:', sessionData);
        setLiveMode('simulation');
        setStatusNotice('⚡ Ligne directe momentanément occupée — Démonstrateur interactif actif.');
        startSimulationCall();
        return;
      }

      // 3. Setup WebRTC PeerConnection with ephemeral client secret
      setLiveMode('webrtc');
      const ephemeralKey = sessionData.clientSecret;
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Handle remote incoming audio from OpenAI GPT
      const audioEl = remoteAudioRef.current || new Audio();
      audioEl.autoplay = true;
      remoteAudioRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // Add local mic track if available
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
      }

      // Setup DataChannel for bidirectional events (transcripts, status, function calls)
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.addEventListener('open', () => {
        setCallState('connected');
        // Initial greeting triggered through GPT
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              instructions: `Salue chaleureusement l'appelant en direct pour ${sector.name} et demande-lui comment tu peux l'aider.`,
            },
          })
        );
      });

      dc.addEventListener('message', (event) => {
        handleDataChannelEvent(event.data);
      });

      // 4. Create local SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Submit SDP Offer to OpenAI General Availability WebRTC endpoint (/v1/realtime/calls)
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`Échec SDP OpenAI: ${sdpResponse.statusText} (${errorText})`);
      }

      // 6. Set remote description with the answer SDP
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (err: any) {
      console.error('Erreur connexion GPT Live:', err);
      // Seamlessly fallback to simulation mode so user is never blocked
      setLiveMode('simulation');
      setStatusNotice('Ligne directe momentanément occupée. Assistant vocal interactif connecté.');
      startSimulationCall();
    }
  };

  // Handle Realtime DataChannel Events from OpenAI
  const handleDataChannelEvent = (rawEventData: string) => {
    try {
      const event = JSON.parse(rawEventData);

      switch (event.type) {
        case 'input_audio_buffer.speech_started':
          setCallState('listening');
          break;

        case 'input_audio_buffer.speech_stopped':
          setCallState('connected');
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (event.transcript && event.transcript.trim()) {
            addMessage('user', event.transcript.trim());
          }
          break;

        case 'response.audio.started':
        case 'response.output_item.added':
          setCallState('speaking');
          break;

        case 'response.audio.done':
          setCallState('connected');
          break;

        case 'response.audio_transcript.delta':
          transcriptBufferRef.current += event.delta || '';
          break;

        case 'response.audio_transcript.done':
          if (transcriptBufferRef.current.trim()) {
            addMessage('ai', transcriptBufferRef.current.trim());
            transcriptBufferRef.current = '';
          }
          setCallState('connected');
          break;

        // Tool / Function Call Execution by GPT Realtime
        case 'response.function_call_arguments.done':
          handleRealtimeToolCall(event);
          break;

        default:
          break;
      }
    } catch (e) {
      console.warn('Error parsing DataChannel event:', e);
    }
  };

  // Handle automated actions executed by GPT
  const handleRealtimeToolCall = (event: any) => {
    try {
      const toolName = event.name;
      const args = JSON.parse(event.arguments || '{}');
      const dc = dataChannelRef.current;

      if (toolName === 'book_appointment') {
        addAction(
          '📅',
          'Rendez-vous réservé dans l’agenda',
          `${args.dateTime || 'Créneau validé'} • ${args.clientOrPatientName || 'Patient'} (${args.serviceType || 'Soins'})`
        );
      } else if (toolName === 'send_quote_sms') {
        addAction(
          '⚡',
          'SMS de devis transmis en direct',
          `Lien sécurisé envoyé à ${args.clientName || 'Client'} • Projet : ${args.projectType || 'Rénovation'}`
        );
      } else if (toolName === 'trigger_urgent_alert') {
        addAction(
          '🚨',
          'Alerte d’urgence envoyée à l’équipe',
          `Notification prioritaire mobile transmise • Motif : ${args.reason || 'Urgence signalée'}`
        );
      } else if (toolName === 'request_human_callback') {
        addAction(
          '📞',
          'Demande d’audit téléphonique enregistrée',
          `Rappel programmé pour ${args.callerName || 'Professionnel'} • Activité : ${args.businessType || 'Entreprise'}`
        );
      }

      // Return tool output to GPT so it continues the vocal dialogue
      if (dc && dc.readyState === 'open') {
        dc.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.call_id,
              output: JSON.stringify({
                status: 'success',
                message: 'Action validée et enregistrée avec succès dans le système VoxFlow',
              }),
            },
          })
        );
        dc.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (err) {
      console.error('Error executing tool call:', err);
    }
  };

  // Fallback Simulation Call Runner
  const startSimulationCall = () => {
    setCallState('speaking');
    addMessage('ai', sector.initialGreeting);
    speakSynthesis(sector.initialGreeting);

    setTimeout(() => {
      setCallState('connected');
    }, 2500);
  };

  // Browser Speech Synthesis for fallback
  const speakSynthesis = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onend = () => {
        if (callState === 'speaking') setCallState('connected');
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice synthesis unsupported
    }
  };

  // Send message from user (via text or quick prompt)
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || textInput).trim();
    if (!text) return;
    if (!textToSend) setTextInput('');

    addMessage('user', text);

    // If WebRTC GPT Live is connected: send message directly over DataChannel
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
        })
      );
      dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      setCallState('speaking');
      return;
    }

    // In simulation mode: generate contextual AI response and action
    setCallState('speaking');
    setTimeout(() => {
      let aiReply = '';
      const lower = text.toLowerCase();

      if (sector.id === 'sante') {
        if (lower.includes('ordonnance') || lower.includes('pansement') || lower.includes('soin')) {
          aiReply = "C'est bien noté pour vos soins. Avez-vous la prescription avec vous et quelle est votre adresse pour la tournée de l'infirmière ?";
          addAction('👤', 'Identification de la demande', 'Prise en charge de soins infirmiers • Nouveau dossier');
        } else if (lower.includes('8h30') || lower.includes('demain') || lower.includes('heure') || lower.includes('domicile')) {
          aiReply = "C'est validé pour demain matin entre 8h30 et 9h00. Je vous transmets à l'instant un SMS de confirmation avec les coordonnées du soignant de garde.";
          addAction('📅', 'Consultation agenda soignant', 'Créneau 08h30 validé • Rendez-vous enregistré');
          addAction('📱', 'SMS de confirmation transmis', 'SMS délivré au patient • Notification soignant envoyée');
        } else if (lower.includes('urgence') || lower.includes('fièvre') || lower.includes('douleur') || lower.includes('saigne')) {
          aiReply = "Si vous ressentez une détresse aiguë ou une douleur intense, contactez immédiatement le 15 (SAMU). J'alerte également le soignant de garde sur son mobile.";
          addAction('🚨', 'Alerte soignant de garde', 'Alerte prioritaire SMS émise sur le mobile d’astreinte');
        } else {
          aiReply = "Parfait, je prends note de votre demande et la rattache directement à votre dossier patient.";
        }
      } else if (sector.id === 'btp') {
        if (lower.includes('devis') || lower.includes('salle de bain') || lower.includes('travaux') || lower.includes('rénovation')) {
          aiReply = "Nous réalisons fréquemment ce type de rénovation. Pour vous faire gagner du temps, je viens de vous envoyer un SMS avec un lien sécurisé pour déposer vos photos et plans en 1 minute.";
          addAction('📋', 'Qualification du chantier', 'Demande de devis travaux • Rénovation sanitaire');
          addAction('⚡', 'SMS de devis transmis en direct', 'Lien reçu sur le smartphone du prospect pendant l’appel');
        } else if (lower.includes('fuite') || lower.includes('urgent') || lower.includes('voisin')) {
          aiReply = "J'ai bien noté l'urgence de cette fuite. Je viens de notifier en priorité le chef d'équipe le plus proche pour une intervention rapide.";
          addAction('🚨', 'Intervention d’urgence signalée', 'Alerte transmise au technicien d’astreinte le plus proche');
        } else {
          aiReply = "Votre demande est bien enregistrée et transmise directement au conducteur de travaux de notre entreprise.";
        }
      } else {
        if (lower.includes('installe') || lower.includes('ligne') || lower.includes('numéro')) {
          aiReply = "VoxFlow s'installe en moins de 24 heures par simple transfert d'appel depuis votre ligne actuelle, sans changer de matériel ni de numéro.";
          addAction('⚙️', 'Information d’intégration', 'Transfert d’appel transparent • Zéro installation requise');
        } else if (lower.includes('calendar') || lower.includes('agenda') || lower.includes('doctolib')) {
          aiReply = "Oui, VoxFlow est directement connecté à Google Calendar, Outlook et Doctolib pour réserver les créneaux en temps réel sans doublon.";
          addAction('📅', 'Synchronisation agenda testée', 'Vérification en temps réel des disponibilités');
        } else {
          aiReply = "Absolument. Vous pouvez démarrer un essai de VoxFlow et recevoir un scénario configuré spécialement pour votre métier.";
          addAction('🎯', 'Qualification prospect', 'Fiche contact générée pour un audit téléphonique');
        }
      }

      addMessage('ai', aiReply);
      speakSynthesis(aiReply);
    }, 1000);
  };

  // Toggle Mute Microphone
  const toggleMicMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicMuted;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // Hang up / Reset Call
  const handleHangUp = () => {
    terminateWebRTC();
    setCallState('idle');
  };

  // Switch Sector
  const handleSwitchSector = (index: number) => {
    handleHangUp();
    setSelectedSectorIndex(index);
    setMessages([]);
    setExecutedActions([]);
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-900 relative overflow-hidden">
      {/* Top Header & Realtime Badge */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-1.5">
              <span>🎙️</span> DÉCROCHAGE IMMÉDIAT
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              Voix Naturelle • Prise de Rendez-Vous 24/7
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Standard Disponible
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
            Parlez en direct avec l&apos;assistant vocal de votre standard téléphonique
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Décrochez l&apos;appel, parlez librement à la voix ou écrivez : l&apos;IA vous répond instantanément et exécute les actions du standard.
          </p>
        </div>

      </div>

      {/* Notice Banner (if any) */}
      {statusNotice && (
        <div className="relative z-10 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>{statusNotice}</span>
          </div>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sector Tabs Selector */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 py-5">
        {SECTORS.map((sec, idx) => {
          const isSelected = selectedSectorIndex === idx;
          return (
            <button
              key={sec.id}
              onClick={() => handleSwitchSector(idx)}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{sec.icon}</span>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">{sec.name}</div>
                  <div className="text-[11px] text-amber-700 font-semibold">{sec.badge}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Call Simulation Workspace */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
        {/* Left: Phone Call Interface & Transcript Stream (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs">
          {/* Top Bar: Connection state & Visualizer */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg shadow-2xs">
                {sector.icon}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Assistant Dédié : {sector.business}</span>
                  {callState !== 'idle' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                      EN LIGNE
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-700 font-semibold text-[11px]">
                    {callState === 'idle' && 'En attente de décrochage'}
                    {callState === 'connecting' && 'Connexion au standard en cours...'}
                    {callState === 'connected' && '🎙️ En ligne — Vous pouvez parler'}
                    {callState === 'speaking' && '🔊 Votre assistante vous répond...'}
                    {callState === 'listening' && '👂 Écoute de votre voix...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Audio Visualizer Waves */}
            <div className="flex items-center gap-1 h-8 px-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              {audioWaves.map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-100 ${
                    callState === 'speaking'
                      ? 'bg-amber-500'
                      : callState === 'listening'
                      ? 'bg-emerald-500'
                      : callState === 'connected'
                      ? 'bg-amber-400'
                      : 'bg-slate-300'
                  }`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          {/* Transcript / Conversation Bubbles Stream */}
          <div className="py-5 space-y-3.5 min-h-[260px] max-h-[340px] overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400">
                <span className="text-4xl mb-3">📞</span>
                <p className="text-sm font-bold text-slate-800">
                  Prêt à tester le standard téléphonique
                </p>
                <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                  Cliquez sur <strong>&laquo; Décrocher &amp; Parler en Direct &raquo;</strong> pour converser avec l&apos;assistant à la voix ou tester un scénario métier.
                </p>
                {/* Suggested Starters */}
                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md">
                  {sector.quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleStartCall().then(() => {
                          setTimeout(() => handleSendMessage(prompt), 1800);
                        });
                      }}
                      className="text-[11px] bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-slate-700 px-3 py-1.5 rounded-full text-left transition-colors cursor-pointer shadow-2xs"
                    >
                      💬 &laquo; {prompt.substring(0, 48)}... &raquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isAi = msg.speaker === 'ai';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 animate-fadeIn ${
                      isAi ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isAi && (
                      <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0 mt-1">
                        IA
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        isAi
                          ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                          : 'bg-amber-500 text-white font-medium rounded-tr-xs'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80 flex items-center justify-between gap-4">
                        <span>{isAi ? `Assistant Vocal (${sector.business})` : 'Vous (Appelant)'}</span>
                        <span className="text-[9px] opacity-70">{msg.time}</span>
                      </div>
                      <p>{msg.text}</p>
                    </div>
                    {!isAi && (
                      <div className="w-7 h-7 rounded-lg bg-white text-slate-600 font-bold flex items-center justify-center text-xs border border-slate-200 shrink-0 mt-1 shadow-2xs">
                        👤
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Scenario Chips (During Call) */}
          {callState !== 'idle' && (
            <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Idées :
              </span>
              {sector.quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="text-[10px] bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  {prompt.substring(0, 36)}...
                </button>
              ))}
            </div>
          )}

          {/* Text Input Fallback / Complement Bar */}
          {callState !== 'idle' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="pt-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Parlez au micro ou écrivez votre réponse ici..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 outline-hidden focus:border-amber-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Envoyer
              </button>
            </form>
          )}

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {callState === 'idle' ? (
              <button
                onClick={handleStartCall}
                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2.5 cursor-pointer hover:-translate-y-0.5"
              >
                <span className="text-base">🎙️</span> Décrocher &amp; Parler en Direct
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleHangUp}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔴</span> Raccrocher
                </button>

                {localStreamRef.current && (
                  <button
                    onClick={toggleMicMute}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isMicMuted
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isMicMuted ? '🔇 Micro Coupé' : '🎤 Micro Actif'}</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  callState !== 'idle' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                }`}
              ></span>
              {callState === 'idle' && 'Standard disponible 24/7'}
              {callState === 'connecting' && 'Connexion...'}
              {callState === 'connected' && 'Échange en direct'}
              {callState === 'speaking' && 'IA en train de parler'}
              {callState === 'listening' && 'Écoute de votre voix'}
            </div>
          </div>
        </div>

        {/* Right: Actions Executed by the Assistant (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span> Actions Menées par l&apos;Assistant
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Automatisé en direct
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Chaque information qualifiée par la voix déclenche automatiquement les démarches adaptées sans intervention humaine :
            </p>

            {/* List of executed actions */}
            <div className="mt-4 space-y-2.5 max-h-[330px] overflow-y-auto pr-1">
              {executedActions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-white/70 text-center text-xs text-slate-400 space-y-1">
                  <div>📞 Lancez un appel et dialoguez avec l&apos;assistant.</div>
                  <div className="text-[11px] text-slate-500">
                    Les rendez-vous, devis SMS et alertes d&apos;urgences s&apos;afficheront ici en direct dès qu&apos;ils seront validés.
                  </div>
                </div>
              ) : (
                executedActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 animate-slideIn space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{action.icon}</span> {action.label}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        {action.time} • Validé
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {action.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Value highlight */}
          <div className="mt-6 pt-4 border-t border-slate-200 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>🎯</span> Le Bénéfice VoxFlow AI :
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Vos clients sont accueillis instantanément dès la 1ère sonnerie, vos rendez-vous s&apos;inscrivent dans votre agenda (Google / Doctolib), et vos devis sont envoyés par SMS sans perte de temps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
