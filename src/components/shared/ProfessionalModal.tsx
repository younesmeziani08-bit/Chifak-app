import { useState, type ReactElement } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import ProfessionalForm from './ProfessionalForm';
import type { ApplicationKind } from '../../services/api';

interface ProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fenêtre d'entrée des praticiens.
 *
 * ── Trois partis pris ──
 *
 * 1. Les boutons d'inscription sont EN HAUT. Ils étaient au terme d'un long
 *    défilement, après quatre encarts et un bandeau de chiffres : un praticien
 *    déjà convaincu devait parcourir toute la page pour trouver la porte.
 *    Ce qui suit les boutons argumente pour ceux qui hésitent ; ceux qui sont
 *    décidés n'ont plus rien à parcourir.
 *
 * 2. Les statistiques inventées ont été retirées. La fenêtre annonçait
 *    « 300 K+ professionnels », « 95 % de satisfaction », « −60 % d'absences »
 *    et « rejoignez des milliers de praticiens ». Aucun de ces nombres ne
 *    repose sur quoi que ce soit. Un praticien qui s'inscrit sur cette foi et
 *    découvre qu'il est le douzième ne revient pas — et il en parle autour de
 *    lui. À la place : ce que le service fait réellement, et sa gratuité, qui
 *    est vraie et se vérifie.
 *
 * 3. L'habillage rejoint celui du site : mêmes variables de couleur, mêmes
 *    icônes tracées, même typographie. Les émojis, le dégradé et la mention
 *    « Solution Business » venaient d'un autre univers visuel.
 */

/* Jeu d'icônes local, au même trait que celles de la page d'accueil. */
const TRACES: Record<string, ReactElement> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><path d="M17 4.5a4 4 0 0 1 0 7.5" /><path d="M21 20v-1a6 6 0 0 0-3-5" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  close: <path d="M6 18 18 6M6 6l12 12" />,
};

function Icone({ nom, className = 'w-5 h-5', strokeWidth = 1.75 }: { nom: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACES[nom]}
    </svg>
  );
}

export default function ProfessionalModal({ isOpen, onClose }: ProfessionalModalProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  /* Formulaire ouvert, et pour quel motif. */
  const [demande, setDemande] = useState<ApplicationKind | null>(null);

  const fermer = () => { setDemande(null); onClose(); };

  if (!isOpen) return null;

  const atouts = [
    {
      icone: 'calendar',
      titre: isArabic ? 'أجندتك، بشروطك' : 'Votre agenda, à vos conditions',
      texte: isArabic
        ? 'أنت تحدّد أيامك وساعاتك ومدة الاستشارة. تصلك أجندة اليوم بالبريد كل صباح على الساعة 5:00.'
        : 'Vous fixez vos jours, vos horaires et la durée de vos consultations. L’agenda du jour vous arrive par e-mail à 5h.',
    },
    {
      icone: 'users',
      titre: isArabic ? 'مرضى يجدونك' : 'Des patients qui vous trouvent',
      texte: isArabic
        ? 'يظهر ملفك في البحث حسب التخصص والولاية، بعد التحقق منه.'
        : 'Votre fiche apparaît dans la recherche par spécialité et par wilaya, une fois votre dossier vérifié.',
    },
    {
      icone: 'bell',
      titre: isArabic ? 'مواعيد محجوزة لمرضاك' : 'Des créneaux réservés',
      texte: isArabic
        ? 'احجز مواعيد لمرضاك المعتادين مباشرة من فضائك، دون أن يمرّوا بالموقع.'
        : 'Bloquez des créneaux pour vos patients habitués depuis votre espace, sans qu’ils passent par le site.',
    },
    {
      icone: 'video',
      titre: isArabic ? 'استشارة بالفيديو' : 'Téléconsultation intégrée',
      texte: isArabic
        ? 'افتح ساعات محدّدة للفيديو. الرابط يظهر لك وللمريض فقط، يوم الموعد.'
        : 'Ouvrez certaines heures à la vidéo. Le lien n’apparaît que pour vous et le patient, le jour venu.',
    },
  ];

  const sansEngagement = isArabic
    ? ['بدون اشتراك', 'بدون عمولة', 'بدون بطاقة بنكية']
    : ['Sans abonnement', 'Sans commission', 'Sans carte bancaire'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div
        className="relative w-full max-w-3xl rounded-3xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500"
        style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {demande ? (
          <div className="p-6 sm:p-10">
            <div className="flex justify-between items-start mb-8 gap-4">
              <h2 className="text-2xl tracking-tight" style={{ color: 'var(--ink)' }}>
                {demande === 'registration'
                  ? (isArabic ? 'طلب تسجيل' : 'Demande d’inscription')
                  : (isArabic ? 'طلب عرض توضيحي' : 'Demande de démonstration')}
              </h2>
              <button
                type="button"
                onClick={fermer}
                aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: 'var(--bg-2)', color: 'var(--ink-2)' }}
              >
                <Icone nom="close" className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <ProfessionalForm kind={demande} isArabic={isArabic} onDone={fermer} />
          </div>
        ) : (
          <div className="p-6 sm:p-10">

            {/* ── En-tête ── */}
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <span
                  className="inline-flex items-center gap-2 rounded-full ps-2 pe-3.5 py-1.5 mb-4"
                  style={{ background: '#DCF2E6', border: '1px solid rgba(31,122,77,0.28)' }}
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--success)', color: '#FFFFFF' }}
                  >
                    <Icone nom="check" className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm font-bold tracking-wide" style={{ color: '#146239' }}>
                    {isArabic ? 'مجاني بالكامل' : '100 % gratuit'}
                  </span>
                </span>

                <h2
                  className="tracking-tight leading-tight mb-3"
                  style={{ fontSize: 'clamp(1.65rem, 4vw, 2.25rem)', color: 'var(--ink)' }}
                >
                  {isArabic ? 'افتح أجندتك على شفاك' : 'Ouvrez votre agenda sur chifak'}
                </h2>

                {/* Ce que le service fait, et non un nombre d'inscrits inventé. */}
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-2)', maxWidth: '38rem' }}>
                  {isArabic
                    ? 'دون اشتراك، ودون أي عمولة على مواعيدك. تحتفظ بمرضاك وبطريقة عملك — نحن نتكفّل بالأجندة فقط.'
                    : 'Sans abonnement, et sans aucune commission sur vos rendez-vous. Vous gardez vos patients et votre façon de travailler — nous ne prenons en charge que l’agenda.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: 'var(--bg-2)', color: 'var(--ink-2)' }}
              >
                <Icone nom="close" className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* ── Les boutons, tout de suite ──
                Un praticien déjà décidé n'a plus rien à parcourir. Ce qui
                suit s'adresse à ceux qui hésitent encore. */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDemande('registration')}
                className="btn-primary"
                style={{ height: '52px', padding: '0 1.75rem', fontSize: '16px' }}
              >
                {isArabic ? 'أنشئ حسابي مجانًا' : 'Créer mon compte gratuitement'}
                <Icone nom="arrow" className="w-4 h-4 rtl:rotate-180" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setDemande('demo')}
                className="btn-secondary"
                style={{ height: '52px', padding: '0 1.5rem', fontSize: '15px' }}
              >
                {isArabic ? 'اطلب عرضًا توضيحيًا' : 'Demander une démonstration'}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              {sansEngagement.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <span aria-hidden style={{ color: 'var(--success)' }}>
                    <Icone nom="check" className="w-4 h-4" strokeWidth={3} />
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#1F7A4D' }}>{item}</span>
                </span>
              ))}
            </div>

            <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
              {isArabic
                ? 'دقيقتان للتسجيل. يراجع فريقنا ملفك قبل نشره.'
                : 'Deux minutes pour s’inscrire. Notre équipe examine votre dossier avant publication.'}
            </p>

            <hr className="my-8" style={{ border: 0, borderTop: '1px solid var(--tint-10)' }} />

            {/* ── Ce que le praticien obtient ──
                Formulations concrètes plutôt que des promesses — chaque ligne
                décrit une fonctionnalité qui existe et qu'il peut vérifier. */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
              {atouts.map((a) => (
                <div key={a.icone}>
                  <span
                    className="inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                  >
                    <Icone nom={a.icone} className="w-5 h-5" />
                  </span>
                  <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
                    {a.titre}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {a.texte}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Pourquoi un examen préalable ──
                Le praticien se demande pourquoi il ne paraît pas aussitôt.
                La réponse le sert : elle protège la valeur de sa présence. */}
            <div
              className="mt-8 rounded-xl p-4 flex gap-3"
              style={{ background: 'var(--bg-2)' }}
            >
              <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>
                <Icone nom="check" className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {isArabic
                  ? 'يُفحص كل ملف قبل النشر. هذه المرحلة تحمي المرضى، وتحميك أنت أيضًا: لا يظهر أي طبيب على شفاك دون التحقق منه.'
                  : 'Chaque dossier est examiné avant publication. Cette étape protège les patients — et vous protège aussi : aucun praticien n’apparaît sur chifak sans vérification.'}
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
