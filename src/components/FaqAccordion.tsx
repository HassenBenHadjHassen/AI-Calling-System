'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Puis-je conserver mon numéro de téléphone professionnel actuel ?",
    answer: "Oui, parfaitement ! Vous conservez votre numéro existant sans aucun changement pour vos clients. Vous activez simplement un renvoi d’appel (soit 24h/24, soit uniquement lorsque vous êtes occupé ou en dehors de vos heures d'ouverture) depuis votre opérateur téléphonique actuel vers votre ligne VoxFlow. Tout est transparent pour vos appelants.",
  },
  {
    question: "L’IA comprend-elle les accents, les hésitations et le vocabulaire de mon métier ?",
    answer: "Oui. Nos agents vocaux sont configurés pour converser avec un français naturel et fluide. Ils comprennent sans difficulté les hésitations, les bruits d'ambiance, les accents régionaux, ainsi que les termes techniques spécifiques à votre activité (soins et ordonnances pour les soignants, métrage et matériaux pour le bâtiment, honoraires et procédures pour le conseil).",
  },
  {
    question: "Que se passe-t-il en cas d’urgence ou si un client demande un humain ?",
    answer: "Nous définissons ensemble vos règles de transfert d'urgence. Dès qu’une urgence est détectée (urgence médicale, fuite d'eau critique, demande insistante de parler à votre équipe), l’assistant transfère immédiatement l’appel vers votre téléphone portable ou d'astreinte, et vous envoie un résumé par SMS avant même que vous ne décrochiez.",
  },
  {
    question: "Comment fonctionne la prise de rendez-vous avec mes agendas existants ?",
    answer: "L’assistant consulte en direct vos disponibilités réelles dans vos calendriers habituels (Google Calendar, Outlook, Doctolib, etc.). Dès que l'appelant choisit un créneau disponible, celui-ci est automatiquement réservé et bloqué dans votre agenda, sans aucun risque de doublon.",
  },
  {
    question: "Comment mes clients reçoivent-ils leur confirmation ou leur lien de devis ?",
    answer: "Pendant la conversation téléphonique, l’assistant transmet instantanément un SMS au client. Pour un devis, le client reçoit un lien sécurisé lui permettant d’ajouter des photos et son adresse en quelques secondes. Pour un rendez-vous, il reçoit un récapitulatif complet avec la date et l'heure convenues.",
  },
  {
    question: "Quel est le délai de mise en service pour mon entreprise ?",
    answer: "Votre agent téléphonique est généralement opérationnel en moins de 48 heures. Notre équipe configure vos consignes, vos horaires, vos tarifs et les réponses aux questions courantes de vos clients. Vous validez l'accueil vocal lors d'un appel test, et votre standard est prêt.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;

        return (
          <div
            key={idx}
            className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
              isOpen
                ? 'bg-white border-amber-400 shadow-md shadow-amber-500/5'
                : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <button
              onClick={() => toggleItem(idx)}
              className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              aria-expanded={isOpen}
            >
              <span className="font-bold text-sm sm:text-base text-slate-900">
                {item.question}
              </span>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-transform duration-150 flex-shrink-0 ${
                  isOpen
                    ? 'bg-amber-500 text-white rotate-180'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                ▼
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
