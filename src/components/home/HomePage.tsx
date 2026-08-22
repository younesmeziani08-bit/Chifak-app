import { useState } from 'react';
import type { ReactNode } from 'react';
import Header from '../shared/Header';
import LocationSelector from './LocationSelector';
import LogoMark from '../shared/LogoMark';
import HealthArticles from './HealthArticles';
import TraceDuTerritoire from './TraceDuTerritoire';
import AssistantConsult from '../booking/AssistantConsult';
import { useLanguage } from '../../contexts/LanguageContext';
import { PHOTOS, SPECIALTY_PHOTOS, photoUrl, photoSrcSet, type PhotoKey } from '../../data/photos';

/**
 * Les trois entrées du hero. Chacune a sa photo, son discours et son action :
 * un patient qui vient réserver, un patient qui vient consulter à distance,
 * et un praticien qui vient inscrire son cabinet n'ont pas la même intention.
 */
type HeroTabId = 'rdv' | 'visio' | 'pro';

interface HeroTab {
  id: HeroTabId;
  photo: PhotoKey;
  label: string;
  labelAr: string;
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  cta: string;
  ctaAr: string;
}

const HERO_TABS: HeroTab[] = [
  {
    id: 'rdv',
    photo: 'consultation',
    label: 'Prendre rendez-vous',
    labelAr: 'حجز موعد',
    title: 'Prenez rendez-vous\navec votre médecin.',
    titleAr: 'احجز موعدك\nمع طبيبك.',
    subtitle: 'Par spécialité et par wilaya, avec les horaires réellement ouverts par le praticien.',
    subtitleAr: 'حسب التخصص والولاية، مع الأوقات التي فتحها الطبيب فعلاً.',
    cta: 'Rechercher',
    ctaAr: 'بحث',
  },
  {
    id: 'visio',
    photo: 'teleconsultation',
    label: 'Téléconsultation',
    labelAr: 'استشارة عن بُعد',
    title: 'Votre médecin,\nà l’écran.',
    titleAr: 'طبيبك\nعلى الشاشة.',
    subtitle: 'Résultats d’analyses, renouvellement d’ordonnance, avis rapide — sans vous déplacer.',
    subtitleAr: 'نتائج التحاليل، تجديد وصفة، رأي سريع — دون تنقّل.',
    /* « Commencer » ne disait ni où l'on va, ni ce qui se passe. Le libellé
       nomme désormais la destination : on part chercher un praticien qui
       propose la visio. */
    cta: 'Voir les médecins en téléconsultation',
    ctaAr: 'عرض الأطباء المتاحين عن بُعد',
  },
  {
    id: 'pro',
    photo: 'praticien',
    label: 'Je suis praticien',
    labelAr: 'أنا طبيب',
    /* La gratuité figure dès le titre du panneau d'accueil.
       Elle n'apparaissait qu'en bas de page, dans le libellé d'un bouton :
       le praticien qui ne descendait pas jusque-là repartait en supposant un
       tarif — l'hypothèse par défaut devant tout logiciel de cabinet. */
    title: 'Ouvrez votre agenda\ngratuitement.',
    titleAr: 'افتح أجندتك\nمجانًا.',
    subtitle: 'Sans abonnement et sans commission sur vos rendez-vous. Vous fixez vos jours et vos horaires ; l’agenda du jour vous arrive à 5h.',
    subtitleAr: 'دون اشتراك ودون عمولة على مواعيدك. أنت تحدّد أيامك وساعاتك، وتصلك أجندة اليوم على الساعة 5:00.',
    cta: 'Inscrire mon cabinet — c’est gratuit',
    ctaAr: 'سجّل عيادتي — مجانًا',
  },
];

/**
 * Wilayas réellement présentes dans src/data/algeria.ts.
 * Cette liste sert de preuve de couverture : elle doit rester le reflet exact
 * des données, sans arrondi ni promesse. À compléter au fur et à mesure que de
 * nouvelles wilayas sont saisies.
 */
const COVERED_WILAYAS = [
  'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Tlemcen',
  'Tizi Ouzou', 'Béjaïa', 'Biskra', 'Bouira', 'Chlef', 'Laghouat',
  'Oum El Bouaghi', 'Béchar', 'Adrar',
];

const ICONS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  video: <><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" /></>,
  smile: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  heart: <path d="M19 14c1.5-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><path d="M17 4.5a4 4 0 0 1 0 7.5" /><path d="M21 20v-1a6 6 0 0 0-3-5" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  message: <path d="M21 12a8 8 0 0 1-11.4 7.2L3 21l1.8-6.6A8 8 0 1 1 21 12Z" />,
  venus: <><circle cx="12" cy="9" r="5" /><path d="M12 14v7M9 18h6" /></>,
  ear: <><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /><path d="M6.5 12.5a3.5 3.5 0 1 1 7 0" /></>,
  bone: <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />,
  baby: <><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />,
};

function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

interface HomePageProps {
  onSearch: (specialty: string, location: string, date: string, videoOnly?: boolean) => void;
  onDoctorClick?: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenProfessional: () => void;
  onOpenAccount?: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

export default function HomePage({ onSearch, onDoctorClick, onOpenLogin, onOpenSignup, onOpenProfessional, onOpenAccount, patientUser, onLogout }: HomePageProps) {
  const { t, language } = useLanguage();
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  /* Le champ date part sur AUJOURD'HUI, pas sur le vide.
     Sur iOS, un champ de date sans valeur ne montre rien du tout — pas même
     un « jj/mm/aaaa ». Le patient voyait un rectangle vide sous « Quand ? »,
     sans aucune indication qu'il pouvait le toucher ni de ce qu'on attendait
     de lui. Le navigateur de bureau, lui, affiche un gabarit : le défaut était
     donc invisible pendant tout le développement, et bien visible sur le seul
     appareil que la plupart des gens utiliseront.

     La recherche traitait déjà l'absence de date comme « aujourd'hui »
     (`date || todayISO`) : afficher cette date ne change donc rien au
     comportement, elle rend seulement visible ce qui était déjà vrai. */
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  /* La wilaya sert encore à mettre en évidence son nom dans la liste de
     couverture ; la daïra et la commune ne servaient qu'au pointeur de la
     carte, retirée — leurs états, le chargement de algeria-communes.json et
     le calcul de coordonnées ont disparu avec elle. */
  const [selectedWilaya, setSelectedWilaya] = useState<{ code: number; name: string; nameAr: string } | null>(null);
  const [heroTab, setHeroTab] = useState<HeroTabId>('rdv');

  const activeTab = HERO_TABS.find((tb) => tb.id === heroTab) ?? HERO_TABS[0];
  const activePhoto = PHOTOS[activeTab.photo];
  const isArabic = language === 'ar';
  const todayISO = new Date().toISOString().split('T')[0];

  const specialties = [
    { key: 'specialty.generalDoctor' }, { key: 'specialty.dentist' },
    { key: 'specialty.ophthalmologist' }, { key: 'specialty.dermatologist' },
    { key: 'specialty.cardiologist' }, { key: 'specialty.pediatrician' },
    { key: 'specialty.gynecologist' }, { key: 'specialty.ent' },
    { key: 'specialty.physiotherapist' }, { key: 'specialty.psychologist' },
    { key: 'specialty.osteopath' }, { key: 'specialty.midwife' },
  ];

  /* Les cartes de spécialité sont désormais des photographies : plus d'icônes
     à associer, seulement la clé de traduction et le visuel correspondant
     dans SPECIALTY_PHOTOS. */
  const quickSpecialties = specialties;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (specialty) onSearch(t(specialty), location, date || todayISO);
  };

  /**
   * Raccourci « D'Alger à Tamanrasset ».
   *
   * On ne lance PAS la recherche : il manque la spécialité, et un écran de
   * résultats vide serait pire que rien. On remplit le lieu, on ramène le
   * visiteur au formulaire et on lui donne le focus sur le champ qui reste à
   * remplir. Le raccourci fait donc exactement ce que le titre annonce :
   * démarrer depuis sa wilaya.
   */
  const choisirWilaya = (nom: string) => {
    setSelectedWilaya({ code: 0, name: nom, nameAr: nom });
    setLocation(nom);
    document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Après le défilement : le champ manquant prend le focus de lui-même.
    window.setTimeout(() => {
      document.getElementById('hero-specialty')?.focus({ preventScroll: true });
    }, 600);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onDoctorClick={onDoctorClick}
        onHomeClick={() => { setSpecialty(''); setLocation(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onScrollToSearch={() => document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth' })}
        onScrollToTeleconsult={() => document.getElementById('teleconsult-section')?.scrollIntoView({ behavior: 'smooth' })}
        onOpenProfessional={onOpenProfessional}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        onOpenAccount={onOpenAccount}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* ── HERO À ONGLETS ──
          Chaque onglet a sa photo, son titre et son action. La photo est
          préchargée pour l'onglet actif ; les autres restent montées mais
          masquées, pour que le changement d'onglet soit instantané. */}
      <section id="hero-search" className="relative scroll-mt-16" style={{ background: 'var(--ink)' }}>
        {/* Photos de fond, une par onglet */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {HERO_TABS.map((tab) => {
            const photo = PHOTOS[tab.photo];
            return (
              <img
                key={tab.id}
                src={photoUrl(photo, 1600)}
                srcSet={photoSrcSet(photo)}
                sizes="100vw"
                alt=""
                loading={tab.id === 'rdv' ? 'eager' : 'lazy'}
                fetchPriority={tab.id === 'rdv' ? 'high' : 'low'}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                style={{
                  opacity: heroTab === tab.id ? 1 : 0,
                  /* Le sujet n'est pas au centre de ces photos larges. Sur un
                     téléphone, le cadre devient étroit et « object-cover »
                     rogne les côtés — en coupant précisément la personne.
                     On recadre donc autour d'elle. */
                  objectPosition: `${photo.focusX ?? 50}% center`,
                }}
              />
            );
          })}
          {/* ── Voile sombre ──
              Il garantit la lisibilité du texte blanc par-dessus la photo.

              Il était en dégradé HORIZONTAL : sombre à gauche sous le texte,
              clair à droite où se trouve la personne. Parfait sur un écran
              large — désastreux sur un téléphone, où la largeur se réduit à
              rien : les 93 % d'opacité du départ recouvraient alors toute
              l'image, et on ne voyait plus personne.

              Deux voiles distincts, donc, choisis par media query dans le CSS :
              horizontal au-delà de 640 px, vertical en dessous — transparent
              en haut où se tient le sujet, dense en bas où arrive le texte. */}
          <div className="hero-voile absolute inset-0" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-12 sm:pt-8 sm:pb-20">
          {/* Onglets */}
          <div
            className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-6 sm:pb-10"
            role="tablist"
            aria-label={isArabic ? 'الخدمات' : 'Services'}
          >
            {HERO_TABS.map((tab) => {
              const active = heroTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setHeroTab(tab.id)}
                  className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                  style={{                    background: active ? '#FFFFFF' : 'rgba(255,255,255,0.10)',
                    color: active ? 'var(--accent)' : 'rgba(255,255,255,0.82)',
                  }}
                >
                  {isArabic ? tab.labelAr : tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Panneaux d'onglet, EMPILÉS dans une même cellule de grille ──
              Chaque panneau reste dans le flux, seul l'actif est visible. La
              hauteur du bloc est donc celle du plus grand des trois, en
              permanence.

              Sans cela, passer de « Prendre rendez-vous » (un formulaire
              complet, ~200 px) à « Téléconsultation » (un bouton, 48 px)
              faisait remonter toute la page d'un coup. Une hauteur fixe en
              pixels n'aurait pas tenu : le formulaire empile ses champs sur
              téléphone et double de hauteur. L'empilement, lui, s'adapte de
              lui-même à chaque largeur d'écran. */}
          <div className="hero-panneaux">

            {/* ─ Panneau « Prendre rendez-vous » ─
                Le formulaire reste la voie principale et occupe la place
                principale. L'assistant l'accompagne sur le côté : il propose,
                il n'impose pas, et on peut réserver sans jamais l'ouvrir. */}
            <div data-active={heroTab === 'rdv'} aria-hidden={heroTab !== 'rdv'}>
              <h1
                className="hero-reveal display-light mb-4 max-w-xl"
                style={{
                  /* Grande échelle en graisse légère : c'est le contraste de
                     taille qui porte la hiérarchie, pas l'épaisseur du trait. */
                  fontSize: 'clamp(2.25rem, 5.6vw, 4.25rem)',
                  color: '#FFFFFF',
                  whiteSpace: 'pre-line',
                }}
              >
                {patientUser
                  ? (isArabic
                    ? `مرحباً ${patientUser.name.split(' ')[0]}،\nهل تحتاج موعدًا؟`
                    : `Bonjour ${patientUser.name.split(' ')[0]},\nbesoin d’un rendez-vous ?`)
                  : (isArabic ? HERO_TABS[0].titleAr : HERO_TABS[0].title)}
              </h1>

              <p className="text-base sm:text-lg leading-relaxed mb-7 max-w-xl" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {isArabic ? HERO_TABS[0].subtitleAr : HERO_TABS[0].subtitle}
              </p>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
            {(
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-3"
                style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'التخصص' : 'Spécialité'}
                      </label>
                      <div className="relative">
                        <select
                          id="hero-specialty"
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          className="field ltr:pr-9 rtl:pl-9 cursor-pointer"
                          style={{ color: specialty ? 'var(--ink)' : 'var(--ink-3)' }}
                        >
                          <option value="">{isArabic ? 'اختر تخصصًا' : 'Choisir une spécialité'}</option>
                          {specialties.map((s) => (
                            <option key={s.key} value={s.key}>{t(s.key)}</option>
                          ))}
                        </select>
                        <span className="absolute inset-y-0 ltr:right-3 rtl:left-3 flex items-center pointer-events-none" style={{ color: 'var(--ink-3)' }}>
                          <Icon name="chevron" className="w-4 h-4" strokeWidth={2} />
                        </span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'المكان' : 'Où ?'}
                      </label>
                      <LocationSelector
                        onLocationChange={setLocation}
                        onWilayaChange={setSelectedWilaya}
                        showWilayaLabel={false}
                        selectVariant="hero"
                        wilayaName={selectedWilaya?.name ?? null}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* champ-date-conteneur : sans lui, la largeur intrinsèque
                        du sélecteur de date natif d'iOS pousse cette colonne
                        hors de la carte. Voir la règle dans index.css. */}
                    <div className="flex-1 champ-date-conteneur">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'متى؟' : 'Quand ?'}
                      </label>
                      <input
                        type="date"
                        value={date}
                        min={todayISO}
                        onChange={(e) => setDate(e.target.value)}
                        className="field"
                        style={{ color: date ? 'var(--ink)' : 'var(--ink-3)' }}
                      />
                    </div>
                    <div className="sm:pt-[26px]">
                      <button
                        type="submit"
                        disabled={!specialty}
                        className="btn-primary w-full sm:w-auto"
                        style={{ height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
                      >
                        <Icon name="search" className="w-4 h-4" strokeWidth={2.5} />
                        {isArabic ? 'بحث' : 'Rechercher'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Accompagnement facultatif, à côté du formulaire.

                La colonne réserve sa hauteur maximale dès le départ. Sans
                cette réserve, ouvrir l'assistant faisait passer son panneau
                de 180 px à 480 px, et poussait vers le bas tout ce qui suit —
                dont les repères « Réservation gratuite · Sans appel · Urgences ».
                Réserver la place coûte un peu de vide sous la carte repliée ;
                laisser la page sauter coûte le repère visuel du lecteur. */}
            <div className="assistant-colonne">
              <AssistantConsult
                patientUser={patientUser}
                onOpenLogin={onOpenLogin}
                isArabic={isArabic}
                onOrientation={(key) => {
                  // L'orientation remplit la spécialité et rend la main :
                  // le patient voit son formulaire rempli et peut le corriger.
                  setSpecialty(key);
                  document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
            </div>
            </div>

            {/* ─ Panneaux « Téléconsultation » et « Praticien » : action directe ─ */}
            {HERO_TABS.slice(1).map((tb) => (
              <div key={tb.id} data-active={heroTab === tb.id} aria-hidden={heroTab !== tb.id} className="max-w-xl">
                <h1
                  className="hero-reveal display-light mb-4 max-w-xl"
                  style={{
                    fontSize: 'clamp(2.25rem, 5.6vw, 4.25rem)',
                    color: '#FFFFFF',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {isArabic ? tb.titleAr : tb.title}
                </h1>

                <p className="text-base sm:text-lg leading-relaxed mb-7 max-w-xl" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {isArabic ? tb.subtitleAr : tb.subtitle}
                </p>

                {/* ── Le chemin, en toutes lettres ──
                    Un visiteur qui découvre la téléconsultation ne sait pas
                    où elle se choisit. L'ancien bouton « Commencer » l'envoyait
                    d'ailleurs sur son compte, où il n'y a rien à réserver.
                    Trois étapes nommées, puis un bouton qui fait la première. */}
                {tb.id === 'visio' && (
                  <ol className="mb-7 space-y-2.5" style={{ maxWidth: '30rem' }}>
                    {(isArabic ? [
                      'ابحث عن طبيب مع مُرشّح « استشارة عن بُعد ».',
                      'اختر « عن بُعد » ثم وقتًا من الأوقات المفتوحة للفيديو.',
                      'يوم الموعد، انضم من « حسابي » ← « مواعيدي ».',
                    ] : [
                      'Cherchez un médecin avec le filtre « Téléconsultation ».',
                      'Choisissez « À distance », puis une heure ouverte à la vidéo.',
                      'Le jour venu, rejoignez depuis « Mon compte » → « Mes rendez-vous ».',
                    ]).map((etape, k) => (
                      <li key={etape} className="flex gap-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                        <span
                          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold mt-0.5"
                          style={{ background: 'rgba(255,255,255,0.16)', color: '#FFFFFF' }}
                          aria-hidden
                        >
                          {k + 1}
                        </span>
                        {etape}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={
                      tb.id === 'visio'
                        /* On lance la recherche avec le filtre visio déjà actif :
                           le bouton fait la première étape plutôt que de la
                           décrire. Sans spécialité — le patient la choisira
                           dans les résultats. */
                        ? () => onSearch('', '', todayISO, true)
                        : onOpenProfessional
                    }
                    className="btn-primary"
                    style={{ background: '#FFFFFF', color: 'var(--accent)', height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
                  >
                    {isArabic ? tb.ctaAr : tb.cta}
                    <Icon name="arrow" className="w-4 h-4 rtl:rotate-180" strokeWidth={2} />
                  </button>
                  {tb.id === 'pro' && (
                    <button
                      type="button"
                      onClick={() => onDoctorClick?.()}
                      className="btn-primary"
                      style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
                    >
                      {isArabic ? 'مساحة الطبيب' : 'Espace docteur'}
                    </button>
                  )}
                </div>
              </div>
            ))}

          </div>

            {/* Repères de confiance */}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              {[
                { icon: 'check', label: isArabic ? 'الحجز مجاني' : 'Réservation gratuite' },
                { icon: 'clock', label: isArabic ? 'بدون مكالمة هاتفية' : 'Sans appel téléphonique' },
                { icon: 'shield', label: isArabic ? 'الاستعجالات: 14 / 115' : 'Urgences : 14 / 115' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <Icon name={item.icon} className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {item.label}
                </li>
              ))}
            </ul>
        </div>

        {/* Crédit photo — discret, mais dû à l'auteur */}
        <p
          className="absolute bottom-2 ltr:right-3 rtl:left-3 text-[10px] z-10"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <a href={activePhoto.credit.profile} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {activePhoto.credit.author}
          </a>
          {' · Unsplash'}
        </p>
      </section>

      {/* ── COUVERTURE TERRITORIALE ──
          Aplat sombre, sans illustration : la phrase porte seule.

          Les noms de wilayas étaient auparavant du texte inerte, alors que la
          consigne juste au-dessus dit « Choisissez votre wilaya ». Une promesse
          qu'on ne tient pas coûte plus cher qu'une absence de promesse : le
          visiteur essaie de cliquer, rien ne bouge, il en conclut que le site
          est cassé. Ce sont désormais de vrais boutons — ils remplissent la
          recherche et y ramènent. */}
      <section className="relative overflow-hidden" style={{ background: 'var(--nuit)' }}>
        {/* Tracé du territoire : Alger au nord, Tamanrasset au sud, et la
            distance entre les deux. Décoratif, en arrière-plan, sans effet
            sur la lecture ni sur les clics. */}
        <TraceDuTerritoire />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 text-center">
          <h2
            className="display-light mb-6"
            style={{ fontSize: 'clamp(2.25rem, 6vw, 4.5rem)', color: '#FFFFFF' }}
          >
            {isArabic ? 'من الجزائر العاصمة إلى تمنراست' : 'D’Alger à Tamanrasset'}
          </h2>

          <p
            className="mx-auto leading-relaxed"
            style={{ maxWidth: '34rem', fontSize: 'clamp(1rem, 1.6vw, 1.25rem)', color: '#B9C0F0' }}
          >
            {isArabic
              ? 'اختر ولايتك ثم دائرتك وبلديتك: تظهر لك العيادات الأقرب إليك.'
              : 'Choisissez votre wilaya, puis votre daïra et votre commune : chifak vous montre les cabinets les plus proches.'}
          </p>

          <div className="mt-12 pt-10" style={{ borderTop: '1px solid rgba(101,116,248,0.24)' }}>
            {/* Intitulé de la liste : sans lui, on ne sait pas ce que sont ces
                noms ni pourquoi ils sont seize et pas cinquante-huit. */}
            <p
              className="text-xs uppercase mb-6"
              style={{ color: '#8E97D8', letterSpacing: '0.12em' }}
            >
              {isArabic ? 'ابدأ من ولايتك' : 'Démarrez depuis votre wilaya'}
            </p>

            <ul className="flex flex-wrap justify-center gap-2.5">
              {COVERED_WILAYAS.map((w) => {
                const active = selectedWilaya?.name === w;
                return (
                  <li key={w}>
                    <button
                      type="button"
                      onClick={() => choisirWilaya(w)}
                      aria-pressed={active}
                      className="wilaya-pill"
                      data-active={active ? 'true' : undefined}
                    >
                      {w}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Les seize ci-dessus sont un raccourci, pas la couverture réelle.
                Le dire, et donner accès aux quarante-huit. */}
            <button
              type="button"
              onClick={() => {
                document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="mt-7 text-sm underline underline-offset-4 rounded-sm transition-colors"
              style={{ color: '#B9C0F0' }}
            >
              {isArabic ? 'عرض الولايات الـ 48' : 'Voir les 48 wilayas'}
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
          <h2
            className="text-2xl sm:text-[2rem] font-semibold tracking-tight mb-10"
            style={{ color: 'var(--ink)' }}
          >
            {isArabic ? 'موعدك في ثلاث خطوات' : 'Votre rendez-vous en trois étapes'}
          </h2>

          {/* Suite numérotée, sans cartes : plus proche d'une notice que d'une brochure */}
          <ol className="grid md:grid-cols-3 gap-x-10 gap-y-8">
            {[
              {
                title: isArabic ? 'ابحث' : 'Cherchez',
                desc: isArabic
                  ? 'حسب التخصص والولاية أو البلدية.'
                  : 'Par spécialité et par wilaya ou commune.',
              },
              {
                title: isArabic ? 'اختر موعدًا' : 'Choisissez un créneau',
                desc: isArabic
                  ? 'الأوقات المعروضة هي أوقات الطبيب الحقيقية.'
                  : 'Les horaires affichés sont ceux réellement ouverts par le praticien.',
              },
              {
                title: isArabic ? 'تأكيد' : 'Confirmez',
                desc: isArabic
                  ? 'تأكيد عبر البريد الإلكتروني، وتذكير قبل الموعد.'
                  : 'Confirmation par email, puis rappel avant la consultation.',
              },
            ].map((item, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="flex-shrink-0 text-4xl font-semibold leading-none tabular-nums"
                  style={{ color: 'var(--accent)', opacity: 0.28 }}
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3
                    className="text-base font-semibold mb-1.5"
                    style={{ color: 'var(--ink)' }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: '15px', lineHeight: '1.6' }}>{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Précisions concrètes — ce qu'une brochure générique ne dit jamais */}
          <div
            className="mt-12 pt-8 grid sm:grid-cols-3 gap-6"
            style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
          >
            {[
              {
                q: isArabic ? 'كم يكلّف الحجز؟' : 'Combien coûte la réservation ?',
                a: isArabic
                  ? 'الحجز مجاني. تدفع أتعاب الطبيب في العيادة كالمعتاد.'
                  : 'La réservation est gratuite. Vous réglez les honoraires au cabinet, comme d’habitude.',
              },
              {
                q: isArabic ? 'وبطاقة الشفاء؟' : 'Et la carte CHIFA ?',
                a: isArabic
                  ? 'شفاك لا يحلّ محل الضمان الاجتماعي: التعويض يبقى عبر CNAS/CASNOS.'
                  : 'chifak ne remplace pas la sécurité sociale : le remboursement passe toujours par la CNAS ou la CASNOS.',
              },
              {
                q: isArabic ? 'في حالة استعجال؟' : 'En cas d’urgence ?',
                a: isArabic
                  ? 'لا تحجز موعدًا: اتصل بـ 14 (الحماية المدنية) أو 115 (SAMU).'
                  : 'Ne prenez pas rendez-vous : appelez le 14 (Protection civile) ou le 115 (SAMU).',
              },
            ].map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{item.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK SPECIALTIES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            className="text-2xl sm:text-[2rem] font-semibold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {isArabic ? 'ابحث حسب التخصص' : 'Rechercher par spécialité'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'الطب العام، طب الأسنان، أمراض القلب…'
              : 'Médecine générale, dentaire, cardiologie…'}
          </p>
        </div>

        {/* Chaque carte est une photographie du sujet de la spécialité.
            Le voile bleu nuit est identique partout : c'est lui qui fait tenir
            douze photos très différentes comme une seule grille cohérente,
            et qui garantit la lisibilité du libellé quelle que soit l'image. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickSpecialties.map((s) => {
            const photo = SPECIALTY_PHOTOS[s.key];
            return (
              <button
                key={s.key}
                onClick={() => {
                  setSpecialty(s.key);
                  document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="specialty-card group relative overflow-hidden text-start"
                style={{ aspectRatio: '4 / 3' }}
              >
                {photo && (
                  <img
                    src={photoUrl(photo, 500, 60)}
                    /* Les fichiers locaux n'ont pas de variantes de taille :
                       photoSrcSet renvoie une chaîne vide, on omet l'attribut. */
                    {...(photoSrcSet(photo, [400, 600, 900])
                      ? {
                          srcSet: photoSrcSet(photo, [400, 600, 900]),
                          sizes: '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw',
                        }
                      : {})}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <span
                  className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-90"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(12,14,69,0.92) 0%, rgba(12,14,69,0.62) 45%, rgba(12,14,69,0.28) 100%)',
                  }}
                />
                <span
                  className="absolute inset-x-0 bottom-0 p-3.5 text-[15px] leading-tight"
                  style={{ color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                >
                  {t(s.key)}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs mt-4" style={{ color: 'var(--ink-3)' }}>
          {isArabic ? 'الصور: Unsplash وأرشيف شفاك' : 'Photographies : Unsplash et fonds propre'}
        </p>
      </section>

      {/* ── TELECONSULTATION ── */}
      {/* ── TÉLÉCONSULTATION ──
          La visio est neuve en Algérie : la plupart des visiteurs n'en ont
          jamais fait. Une section qui se contente de vanter le service laisse
          intacte la vraie question — « concrètement, comment ça se passe ? ».

          D'où trois temps : ce que c'est et quand c'est adapté, comment
          réserver, comment rejoindre le jour venu. Le troisième est le plus
          important : un patient qui a réservé mais ne trouve pas le bouton
          rate sa consultation, et c'est le praticien qui attend devant un
          écran vide. */}
      <section id="teleconsult-section" className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20 scroll-mt-20">
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--ink)' }}>

          {/* ── Ce que c'est ── */}
          <div className="grid md:grid-cols-2">
            <div className="p-6 sm:p-10 md:p-14">
              <span
                className="inline-block text-xs font-semibold uppercase px-3 py-1 rounded-full mb-5"
                style={{ background: 'rgba(101,116,248,0.18)', color: '#C9D2FB', letterSpacing: '0.08em' }}
              >
                {isArabic ? 'جديد في الجزائر' : 'Nouveau en Algérie'}
              </span>
              <h2
                className="font-semibold tracking-tight leading-tight mb-5"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', color: '#FFFFFF', whiteSpace: 'pre-line' }}
              >
                {isArabic ? 'طبيبك\nعلى الشاشة.' : 'Votre médecin,\nà l\'écran.'}
              </h2>
              <p className="text-lg leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {isArabic
                  ? 'التطبيب عن بُعد استشارة حقيقية مع طبيب حقيقي، لكن بالفيديو بدل التنقّل إلى العيادة. نفس الطبيب، نفس المدّة، نفس السرّية.'
                  : 'La téléconsultation est une vraie consultation, avec un vrai médecin — simplement en vidéo plutôt qu’au cabinet. Même praticien, même durée, même confidentialité.'}
              </p>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {isArabic
                  ? 'مفيدة خاصة إذا كنت بعيدًا عن العيادة، أو تتنقّل بصعوبة، أو لا تحتاج فحصًا بدنيًا.'
                  : 'Particulièrement utile si vous habitez loin d’un cabinet, si vous vous déplacez difficilement, ou quand un examen physique n’est pas nécessaire.'}
              </p>
            </div>

            {/* Quand c'est adapté, et quand ça ne l'est pas. Le second point
                compte autant : promettre que la visio remplace tout ferait
                perdre du temps à des patients qui ont besoin d'un examen. */}
            <div
              className="flex flex-col justify-center gap-5 p-6 sm:p-10 md:p-14"
              style={{ background: 'rgba(255,255,255,0.03)', borderInlineStart: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#9FE1CB' }}>
                  {isArabic ? 'مناسبة لـ' : 'Adaptée pour'}
                </p>
                <ul className="space-y-1.5">
                  {(isArabic
                    ? ['قراءة نتائج التحاليل', 'تجديد وصفة طبية', 'متابعة بعد استشارة', 'رأي سريع قبل التنقّل']
                    : ['Lire des résultats d’analyses', 'Renouveler une ordonnance', 'Un suivi après consultation', 'Un avis rapide avant de se déplacer']
                  ).map((x) => (
                    <li key={x} className="text-sm leading-relaxed flex gap-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <span aria-hidden style={{ color: '#9FE1CB' }}>✓</span>{x}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#FDA29B' }}>
                  {isArabic ? 'غير مناسبة لـ' : 'Pas adaptée pour'}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {isArabic
                    ? 'ما يتطلّب فحصًا بدنيًا، وكلّ حالة استعجالية. في حالة الطوارئ اتصل بالحماية المدنية 14 أو الإسعاف 115.'
                    : 'Tout ce qui demande un examen physique, et toute urgence. En cas d’urgence, appelez la Protection Civile 14 ou le SAMU 115.'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Comment ça marche, en deux temps ── */}
          <div className="border-t p-6 sm:p-10 md:p-14" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h3 className="text-xl font-semibold mb-8" style={{ color: '#FFFFFF' }}>
              {isArabic ? 'كيف تجري الأمور' : 'Comment ça se passe'}
            </h3>

            <div className="grid md:grid-cols-2 gap-10">
              {[
                {
                  titre: isArabic ? 'حجز موعد بالفيديو' : 'Réserver en téléconsultation',
                  etapes: isArabic ? [
                    'ابحث عن طبيب كالعادة، حسب التخصص والولاية.',
                    'فعّل مُرشّح « استشارة عن بُعد » : تظهر فقط العيادات التي تقترحها.',
                    'في صفحة الحجز، اختر « عن بُعد » في الخطوة الأولى.',
                    'اختر تاريخًا وساعة من الأوقات المفتوحة للفيديو، ثم أكّد.',
                  ] : [
                    'Cherchez un médecin comme d’habitude, par spécialité et par wilaya.',
                    'Activez le filtre « Téléconsultation » : seuls les praticiens qui la proposent s’affichent.',
                    'Sur la page de réservation, choisissez « À distance » à la première étape.',
                    'Prenez une date et une heure parmi les créneaux ouverts à la vidéo, puis confirmez.',
                  ],
                  note: isArabic
                    ? 'الأوقات المعروضة للفيديو تخصّ الفيديو وحده: الطبيب هو من يحدّدها.'
                    : 'Les horaires proposés en vidéo sont propres à la vidéo : c’est le praticien qui les ouvre.',
                },
                {
                  titre: isArabic ? 'الانضمام يوم الموعد' : 'Rejoindre le jour du rendez-vous',
                  etapes: isArabic ? [
                    'افتح « حسابي » من الأعلى، ثم « مواعيدي ».',
                    'ابحث عن موعدك في القائمة.',
                    'اضغط على زر « انضم للفيديو » الأزرق.',
                    'اسمح بالكاميرا والميكروفون عند طلب المتصفّح.',
                  ] : [
                    'Ouvrez « Mon compte » en haut de la page, puis « Mes rendez-vous ».',
                    'Retrouvez votre rendez-vous dans la liste.',
                    'Appuyez sur le bouton bleu « Rejoindre la visio ».',
                    'Autorisez la caméra et le micro quand le navigateur le demande.',
                  ],
                  note: isArabic
                    ? 'الزرّ يظهر فقط في مواعيد الفيديو. الرابط خاص بك وبطبيبك وحدكما.'
                    : 'Le bouton n’apparaît que sur les rendez-vous en vidéo. Le lien n’est accessible qu’à vous et à votre médecin.',
                },
              ].map((bloc, i) => (
                <div key={bloc.titre}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0"
                      style={{ background: 'var(--barbeau)', color: 'var(--nuit)' }}
                    >
                      {i + 1}
                    </span>
                    <h4 className="font-semibold" style={{ color: '#FFFFFF' }}>{bloc.titre}</h4>
                  </div>
                  <ol className="space-y-2.5 mb-4">
                    {bloc.etapes.map((e, k) => (
                      <li key={e} className="flex gap-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                        <span
                          className="flex-shrink-0 font-mono text-xs pt-0.5"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                          aria-hidden
                        >
                          {k + 1}.
                        </span>
                        {e}
                      </li>
                    ))}
                  </ol>
                  <p
                    className="text-xs leading-relaxed rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    {bloc.note}
                  </p>
                </div>
              ))}
            </div>

            {/* Ce dont on a besoin, dit simplement. « Rien à installer » est
                le point qui lève le plus de réticences. */}
            <div
              className="mt-10 pt-8 flex flex-wrap gap-x-8 gap-y-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              {(isArabic
                ? ['لا تحتاج لتثبيت أي تطبيق', 'يكفي هاتف أو حاسوب بكاميرا', 'اتصال أنترنت عادي']
                : ['Aucune application à installer', 'Un téléphone ou un ordinateur avec caméra', 'Une connexion internet ordinaire']
              ).map((x) => (
                <span key={x} className="text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                  {x}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={patientUser ? onOpenAccount : onOpenLogin}
              className="btn-primary mt-8"
              style={{ background: '#FFFFFF', color: 'var(--accent)', height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
            >
              {patientUser
                ? (isArabic ? 'اذهب إلى مواعيدي' : 'Aller à mes rendez-vous')
                : (isArabic ? 'سجّل الدخول للبدء' : 'Se connecter pour commencer')}
              <Icon name="arrow" className="w-4 h-4 rtl:rotate-180" strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOR PROFESSIONALS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        <div
          className="rounded-3xl p-6 sm:p-10 md:p-14"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--tint-20)' }}
        >
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              {/* ── Pastille « gratuit » ──
                  Placée avant le titre, donc lue en premier. Le mot était
                  jusqu'ici enfoui dans le libellé du bouton, tout en bas :
                  un praticien qui parcourt la page en diagonale ne le voyait
                  jamais, et supposait un tarif — c'est l'hypothèse par défaut
                  devant tout logiciel de cabinet. */}
              <span
                className="inline-flex items-center gap-2 rounded-full ps-2 pe-3.5 py-1.5 mb-5"
                style={{ background: '#DCF2E6', border: '1px solid rgba(31,122,77,0.28)' }}
              >
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--success)', color: '#FFFFFF' }}
                >
                  <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                </span>
                <span
                  className="text-sm font-bold tracking-wide"
                  style={{ color: '#146239' }}
                >
                  {isArabic ? 'مجاني بالكامل' : '100 % gratuit'}
                </span>
              </span>

              <h2
                className="font-semibold tracking-tight leading-tight mb-4"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: 'var(--ink)', whiteSpace: 'pre-line' }}
              >
                {isArabic ? 'أنت طبيب؟\nافتح أجندتك مجانًا.' : 'Vous êtes praticien ?\nOuvrez votre agenda gratuitement.'}
              </h2>

              {/* La vraie question d'un praticien n'est pas « combien ? » mais
                  « où est le piège ? ». On y répond avant qu'elle se pose. */}
              <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
                {isArabic
                  ? 'دون اشتراك، ودون أي عمولة على مواعيدك. أنت تحتفظ بمرضاك وبطريقة عملك — نحن نتكفّل بالأجندة فقط.'
                  : 'Sans abonnement, et sans aucune commission sur vos rendez-vous. Vous gardez vos patients et votre façon de travailler — nous ne prenons en charge que l’agenda.'}
              </p>

              {/* Les trois réponses aux trois craintes, énoncées séparément
                  pour qu'aucune ne se perde dans une phrase. */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-7">
                {(isArabic
                  ? ['بدون اشتراك', 'بدون عمولة', 'بدون بطاقة بنكية']
                  : ['Sans abonnement', 'Sans commission', 'Sans carte bancaire']
                ).map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span aria-hidden style={{ color: 'var(--success)' }}>
                      <Icon name="check" className="w-4 h-4" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-semibold" style={{ color: '#1F7A4D' }}>{item}</span>
                  </span>
                ))}
              </div>

              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {(isArabic
                  ? ['أجندة اليوم بالبريد كل صباح', 'أنت تحدّد أيامك وساعاتك', 'حجز مواعيد لمرضاك المعتادين', 'استشارة بالفيديو مدمجة']
                  : ['L’agenda du jour par email à 5h', 'Vous fixez vos jours et vos horaires', 'Créneaux réservés à vos patients habitués', 'Visioconsultation intégrée']
                ).map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onOpenProfessional}
                className="btn-primary"
                style={{ height: '52px', padding: '0 1.75rem', fontSize: '16px' }}
              >
                {isArabic ? 'أنشئ أجندتي مجانًا' : 'Créer mon agenda gratuitement'}
                <Icon name="arrow" className="w-4 h-4 rtl:rotate-180" strokeWidth={2} />
              </button>

              {/* Ce qui se passe après le clic. Un praticien hésite moins
                  quand il sait qu'il ne s'engage à rien en appuyant. */}
              <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
                {isArabic
                  ? 'دقيقتان للتسجيل. يراجع فريقنا ملفك قبل النشر.'
                  : 'Deux minutes pour s’inscrire. Notre équipe examine votre dossier avant publication.'}
              </p>
            </div>
            {/* Aperçu de ce que le médecin reçoit réellement chaque matin */}
            <div className="hidden md:block">
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg)', border: '1px solid var(--tint-20)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div
                  className="px-5 py-3 text-xs font-semibold"
                  style={{ background: 'var(--bg-2)', color: 'var(--ink-2)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                >
                  {isArabic ? 'أجندة اليوم — 05:00' : 'Votre agenda du jour — 05h00'}
                </div>
                <ul className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  {[
                    { h: '08:00', n: isArabic ? 'ك. بن علي' : 'K. Benali', free: false },
                    { h: '08:30', n: isArabic ? 'متاح' : 'Libre', free: true },
                    { h: '09:00', n: isArabic ? 'ن. حدّاد' : 'N. Haddad', free: false },
                    { h: '09:30', n: isArabic ? 'متاح' : 'Libre', free: true },
                  ].map((r) => (
                    <li key={r.h} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                      <span className="tabular-nums font-medium w-12" style={{ color: 'var(--ink-3)' }}>{r.h}</span>
                      <span style={{ color: r.free ? 'var(--ink-3)' : 'var(--ink)' }}>{r.n}</span>
                      {!r.free && (
                        <span
                          className="ms-auto w-1.5 h-1.5 rounded-full"
                          style={{ background: 'var(--success)' }}
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: 'var(--ink-3)' }}>
                {isArabic ? 'يُرسل بالبريد كل صباح.' : 'Envoyé par email chaque matin.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SANTÉ & PRÉVENTION (documentation / articles) ── */}
      <HealthArticles />

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111113', color: 'rgba(255,255,255,0.45)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-14">
            <div className="lg:col-span-2 max-w-xs">
              <div className="flex items-center gap-2.5 mb-5">
                <LogoMark className="h-9 w-9" pulseColor="#6574F8" />
                <span
                  className="text-lg font-bold text-white tracking-tight"
                >
                  chifak
                </span>
              </div>
              <p className="leading-relaxed text-sm mb-6">
                {isArabic
                  ? 'منصة رقمية لحجز المواعيد الطبية في الجزائر. بسيطة وسريعة وآمنة.'
                  : 'La plateforme de prise de rendez-vous médicaux en Algérie. Simple, rapide et sécurisée.'}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {isArabic ? 'استعجال طبي: ' : 'Urgence médicale : '}
                <a href="tel:14" className="font-semibold text-white hover:underline">14</a>
                {' · '}
                <a href="tel:115" className="font-semibold text-white hover:underline">115</a>
              </p>
              {/* Le bouton « Portail administration » a été retiré du pied de
                  page. L'administration est désormais une application servie
                  depuis un autre domaine, qui ne se cherche pas : son adresse
                  se communique aux personnes concernées. L'annoncer ici
                  invitait chaque visiteur — et chaque robot — à venir frapper
                  à la porte. */}
            </div>

            {/* Uniquement des liens qui mènent quelque part */}
            {[
              {
                title: isArabic ? 'للمرضى' : 'Patients',
                links: [
                  {
                    label: isArabic ? 'ابحث عن طبيب' : 'Chercher un praticien',
                    action: () => document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth' }),
                  },
                  {
                    label: isArabic ? 'استشارة عن بُعد' : 'Téléconsultation',
                    action: () => document.getElementById('teleconsult-section')?.scrollIntoView({ behavior: 'smooth' }),
                  },
                  patientUser
                    ? { label: isArabic ? 'مواعيدي' : 'Mes rendez-vous', action: () => onOpenAccount?.() }
                    : { label: isArabic ? 'إنشاء حساب' : 'Créer un compte', action: onOpenSignup },
                ],
              },
              {
                title: isArabic ? 'للأطباء' : 'Praticiens',
                links: [
                  { label: isArabic ? 'سجّل عيادتك' : 'Inscrire mon cabinet', action: onOpenProfessional },
                  { label: isArabic ? 'مساحة الطبيب' : 'Espace docteur', action: () => onDoctorClick?.() },
                ],
              },
            ].map((col, i) => (
              <div key={i}>
                <h4
                  className="text-sm font-semibold text-white mb-4"
                >
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <button
                        type="button"
                        onClick={link.action}
                        className="text-sm text-start transition-colors hover:text-white"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p>© 2026 chifak · {isArabic ? 'الجزائر' : 'Algérie'}</p>
              {/* Ces pages n'existaient pas. Un service qui collecte des motifs
                  de consultation et l'identité de mineurs doit dire ce qu'il en
                  fait, et où réclamer. */}
              <nav className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label={isArabic ? 'روابط قانونية' : 'Liens légaux'}>
                <a href="/conditions" className="hover:text-white/80 underline underline-offset-2">
                  {isArabic ? 'شروط الاستخدام' : 'Conditions'}
                </a>
                <a href="/confidentialite" className="hover:text-white/80 underline underline-offset-2">
                  {isArabic ? 'الخصوصية' : 'Confidentialité'}
                </a>
                <a href="/mentions-legales" className="hover:text-white/80 underline underline-offset-2">
                  {isArabic ? 'معلومات قانونية' : 'Mentions légales'}
                </a>
              </nav>
            </div>
            <p className="max-w-md sm:text-end">
              {isArabic
                ? 'شفاك ليس خدمة استعجالية ولا يقدّم تشخيصًا طبيًا.'
                : 'chifak n’est pas un service d’urgence et ne délivre aucun diagnostic médical.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
