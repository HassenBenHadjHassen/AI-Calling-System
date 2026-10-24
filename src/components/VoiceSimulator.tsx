'use client';

import { useState, useEffect, useRef } from 'react';

interface DialogStep {
  speaker: 'user' | 'ai';
  text: string;
  delayMs: number;
  action?: {
    icon: string;
    label: string;
    detail: string;
  };
}

interface Scenario {
  id: string;
  name: string;
  business: string;
  sector: string;
  icon: string;
  callerName: string;
  steps: DialogStep[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'sante',
    name: 'Cabinet Médical & Soins à Domicile',
    business: 'Cabinet Médical',
    sector: 'Santé & Paramédical',
    icon: '🏥',
    callerName: 'Claire D.',
    steps: [
      {
        speaker: 'user',
        text: "Bonjour, je sors d'une intervention et j'ai une ordonnance pour des pansements quotidiens dès demain matin à domicile.",
        delayMs: 2200,
        action: {
          icon: '👤',
          label: 'Identification de la demande',
          detail: 'Prise en charge de soins infirmiers • Nouveau dossier',
        },
      },
      {
        speaker: 'ai',
        text: "Bonjour Madame. C'est parfaitement noté. Avez-vous la prescription avec vous et quelle est votre adresse d'intervention ?",
        delayMs: 2400,
      },
      {
        speaker: 'user',
        text: "Oui, tout à fait. J'habite au 14 rue de la Paix. Est-il possible de passer vers 8h30 avant mon télétravail ?",
        delayMs: 2200,
        action: {
          icon: '📅',
          label: 'Consultation de votre agenda',
          detail: 'Créneau 08h30 disponible • Réservation enregistrée',
        },
      },
      {
        speaker: 'ai',
        text: "C'est validé pour demain matin entre 8h30 et 9h00. Je vous transmets à l'instant un SMS récapitulatif avec les coordonnées de votre soignant.",
        delayMs: 2700,
        action: {
          icon: '📱',
          label: 'SMS envoyé au patient & notification praticien',
          detail: 'SMS de confirmation délivré • Alerte transmise au soignant',
        },
      },
      {
        speaker: 'user',
        text: 'C’est parfait et rassurant, merci beaucoup pour votre rapidité !',
        delayMs: 1400,
        action: {
          icon: '✅',
          label: 'Rendez-vous finalisé',
          detail: 'Créneau verrouillé dans votre planning • Zéro ressaisie',
        },
      },
    ],
  },
  {
    id: 'btp',
    name: 'Entreprise BTP & Rénovation',
    business: 'Rénovation & Travaux',
    sector: 'Artisans & Bâtiment',
    icon: '🏗️',
    callerName: 'Thomas V.',
    steps: [
      {
        speaker: 'user',
        text: "Bonjour, j'ai une rénovation complète de salle de bain d'environ 15m² avec remplacement de douche, j'aimerais un devis.",
        delayMs: 2400,
        action: {
          icon: '📋',
          label: 'Qualification du projet',
          detail: 'Demande de devis travaux • Rénovation sanitaire',
        },
      },
      {
        speaker: 'ai',
        text: "Bonjour Monsieur ! Nous réalisons régulièrement ce type de travaux. S'agit-il d'un projet urgent suite à un dégât des eaux ou d'une rénovation planifiée ?",
        delayMs: 2600,
      },
      {
        speaker: 'user',
        text: "C'est un projet planifié, nous aimerions démarrer le mois prochain.",
        delayMs: 1800,
        action: {
          icon: '🔗',
          label: 'Préparation du dossier devis',
          detail: 'Génération de l’espace devis sécurisé pour le client',
        },
      },
      {
        speaker: 'ai',
        text: "Parfait ! Pour vous faire gagner du temps, je viens de vous envoyer un SMS avec un lien sécurisé. Vous pouvez y déposer l'adresse et des photos de la pièce en 1 minute.",
        delayMs: 2900,
        action: {
          icon: '⚡',
          label: 'SMS de devis transmis en direct',
          detail: 'Lien reçu sur le smartphone du prospect pendant l’appel',
        },
      },
      {
        speaker: 'user',
        text: 'Super, je viens justement de recevoir le SMS, je vous ajoute les photos de suite.',
        delayMs: 1900,
        action: {
          icon: '📈',
          label: 'Opportunité qualifiée',
          detail: 'Dossier complet transmis à votre conducteur de travaux',
        },
      },
    ],
  },
  {
    id: 'corporate',
    name: 'Cabinet d’Avocats & Conseil',
    business: 'Cabinet Conseil',
    sector: 'Professions Juridiques & Libérales',
    icon: '⚖️',
    callerName: 'Alexandre M.',
    steps: [
      {
        speaker: 'user',
        text: "Bonjour, je suis Alexandre Mercier du fonds Capitalia, je souhaite caler un point avec Maître Lambert ce vendredi.",
        delayMs: 2200,
        action: {
          icon: '⭐',
          label: 'Accueil prioritaire',
          detail: 'Client identifié • Priorité élevée',
        },
      },
      {
        speaker: 'ai',
        text: "Bonjour Monsieur Mercier. Maître Lambert a réservé deux créneaux pour vos dossiers ce vendredi : 14h30 ou 16h00. Quelle heure vous convient ?",
        delayMs: 2500,
      },
      {
        speaker: 'user',
        text: "14h30 en visioconférence sera parfait.",
        delayMs: 1600,
        action: {
          icon: '🔒',
          label: 'Blocage du créneau',
          detail: 'Rendez-vous bloqué dans l’agenda • Lien visio généré',
        },
      },
      {
        speaker: 'ai',
        text: "C'est réservé pour vendredi à 14h30. L'invitation avec le lien sécurisé vient d'être envoyée à votre secrétariat par email et SMS.",
        delayMs: 2400,
        action: {
          icon: '📩',
          label: 'Confirmation automatique',
          detail: 'Email + SMS transmis • Dossier prêt pour vendredi',
        },
      },
    ],
  },
];

export default function VoiceSimulator() {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [executedActions, setExecutedActions] = useState<Array<{ icon: string; label: string; detail: string; time: string }>>([]);
  const [audioWaves, setAudioWaves] = useState<number[]>([25, 45, 35, 70, 40, 60, 30, 65, 50, 75, 30, 55]);
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(false);

  const scenario = SCENARIOS[selectedScenarioIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setAudioWaves((prev) =>
          prev.map(() => Math.floor(Math.random() * 65) + 20)
        );
      }, 120);
    } else {
      setAudioWaves([20, 30, 25, 35, 20, 25, 30, 20, 35, 25, 20, 30]);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const speakText = (text: string, isAi: boolean) => {
    if (!audioVoiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = isAi ? 1.05 : 0.98;
      utterance.pitch = isAi ? 1.02 : 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice synthesis unsupported or user disabled
    }
  };

  const handleStartCall = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(true);
    setCurrentStepIndex(0);
    setExecutedActions([]);

    const firstStep = scenario.steps[0];
    speakText(firstStep.text, firstStep.speaker === 'ai');

    if (firstStep.action) {
      setExecutedActions([
        {
          ...firstStep.action,
          time: '00:02',
        },
      ]);
    }

    advanceStep(0);
  };

  const advanceStep = (stepIdx: number) => {
    if (stepIdx >= scenario.steps.length - 1) {
      timerRef.current = setTimeout(() => {
        setIsPlaying(false);
      }, 2500);
      return;
    }

    const currentStep = scenario.steps[stepIdx];
    timerRef.current = setTimeout(() => {
      const nextIdx = stepIdx + 1;
      setCurrentStepIndex(nextIdx);

      const nextStep = scenario.steps[nextIdx];
      speakText(nextStep.text, nextStep.speaker === 'ai');

      if (nextStep.action) {
        const seconds = (nextIdx * 3 + 2).toString().padStart(2, '0');
        setExecutedActions((prev) => [
          ...prev,
          {
            ...nextStep.action!,
            time: `00:${seconds}`,
          },
        ]);
      }

      advanceStep(nextIdx);
    }, currentStep.delayMs + 500);
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setExecutedActions([]);
  };

  const switchScenario = (index: number) => {
    handleReset();
    setSelectedScenarioIndex(index);
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-900 relative overflow-hidden">
      {/* Header & Scenario Selector */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              Démonstration Interactive
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Standard Disponible
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Écoutez l&apos;IA traiter un appel réel en moins d&apos;une seconde
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Sélectionnez un exemple d&apos;activité pour observer la conversation et les actions menées en temps réel.
          </p>
        </div>

        {/* Audio Speech toggle */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setAudioVoiceEnabled(!audioVoiceEnabled)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              audioVoiceEnabled
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Activer la voix de synthèse"
          >
            <span>{audioVoiceEnabled ? '🔊 Voix Activée' : '🔇 Mode Silencieux'}</span>
          </button>
        </div>
      </div>

      {/* Scenario Tabs */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 py-5">
        {SCENARIOS.map((sc, idx) => {
          const isSelected = selectedScenarioIndex === idx;
          return (
            <button
              key={sc.id}
              onClick={() => switchScenario(idx)}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-50/60 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{sc.icon}</span>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">{sc.name}</div>
                  <div className="text-[11px] text-slate-500">{sc.sector}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Call Simulation Workspace */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
        {/* Left: Simulated Phone Interface (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs">
          {/* Caller Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-base shadow-2xs">
                👤
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Appelant : {scenario.callerName}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Assistant Dédié : {scenario.business}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-700 font-semibold text-[11px]">Décrochage immédiat</span>
                </div>
              </div>
            </div>

            {/* Live Audio Visualizer */}
            <div className="flex items-center gap-1 h-8 px-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              {audioWaves.map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-100 ${
                    isPlaying ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          {/* Conversation Transcript Stream */}
          <div className="py-5 space-y-3.5 min-h-[250px] max-h-[320px] overflow-y-auto pr-1">
            {currentStepIndex === -1 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
                <span className="text-3xl mb-2">📞</span>
                <p className="text-sm font-semibold text-slate-700">
                  Prêt pour la simulation
                </p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Cliquez sur &laquo; Décrocher &amp; Lancer l&apos;Appel &raquo; pour voir l&apos;IA converser et agir en direct.
                </p>
              </div>
            ) : (
              scenario.steps.slice(0, currentStepIndex + 1).map((step, idx) => {
                const isAi = step.speaker === 'ai';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 animate-fadeIn ${
                      isAi ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isAi && (
                      <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-black flex items-center justify-center text-xs shadow-xs flex-shrink-0 mt-1">
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
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">
                        {isAi ? `Assistant Vocal (${scenario.business})` : scenario.callerName}
                      </div>
                      <p>{step.text}</p>
                    </div>
                    {!isAi && (
                      <div className="w-7 h-7 rounded-lg bg-white text-slate-600 font-bold flex items-center justify-center text-xs border border-slate-200 flex-shrink-0 mt-1 shadow-2xs">
                        👤
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            {!isPlaying ? (
              <button
                onClick={handleStartCall}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📞</span> Décrocher &amp; Lancer l&apos;Appel
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔴</span> Raccrocher / Réinitialiser
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
              {isPlaying ? 'Appel en cours...' : 'Prêt à tester'}
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
                Automatisé
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Chaque information clé échangée déclenche les démarches adaptées sans intervention humaine :
            </p>

            {/* List of executed actions */}
            <div className="mt-4 space-y-2.5">
              {executedActions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-white/70 text-center text-xs text-slate-400">
                  Lancez un appel pour observer les actions automatiques (réservation d&apos;agenda, envoi de SMS, alertes)...
                </div>
              ) : (
                executedActions.map((action, i) => (
                  <div
                    key={i}
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
              <span>🎯</span> Le Résultat pour Votre Entreprise :
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Vos clients sont accueillis instantanément, vos rendez-vous s&apos;inscrivent dans votre agenda habituel, et vos devis sont envoyés sans perte de temps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
