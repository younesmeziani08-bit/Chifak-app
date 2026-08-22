import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { doctorsAPI, appointmentsAPI } from '../../services/api';
import { slotsForDay } from '../../utils/slots';
import type { Doctor } from '../../types/metier';
import DoctorAvatar from '../shared/DoctorAvatar';

/**
 * /dr/&lt;id&gt; — la page qu'on atteint en scannant le QR code affiché sur la
 * porte d'un cabinet.
 *
 * ── La situation qu'elle sert ──
 *
 * Quelqu'un s'est déplacé. Il est debout devant une porte, souvent fermée —
 * le soir, un vendredi, entre midi et deux. Il a son téléphone à la main et
 * trente secondes d'attention. Il veut savoir s'il y a de la place, et
 * repartir avec un rendez-vous.
 *
 * ── Pourquoi cette page est séparée de la réservation habituelle ──
 *
 * BookingPage est bâtie autour d'un COMPTE : les coordonnées y sont
 * verrouillées et relues en base, et l'écran rappelle que « le compte est
 * strictement personnel ». C'est un bon principe — il garantit au praticien
 * de savoir qui il reçoit — et il ne tient pas debout devant une porte : la
 * personne devrait créer un compte, attendre un code par courrier, et le
 * saisir, sur un trottoir.
 *
 * Cette page-ci demande donc les trois choses nécessaires — nom, téléphone,
 * adresse — et rien d'autre. Le serveur accepte déjà ce mode : la route de
 * réservation n'exige aucun jeton, précisément pour ce cas.
 *
 * ── Ce qui protège ce chemin ──
 *
 * Dix réservations par heure et par connexion, cinq par heure et par adresse,
 * et un index unique en base qui empêche deux personnes de prendre le même
 * créneau au même instant. Le créneau choisi disparaît immédiatement de
 * l'application, et le rendez-vous figure dans l'agenda que le praticien
 * reçoit à cinq heures — au même titre que les autres, car c'est un
 * rendez-vous comme les autres.
 */

interface Props {
  doctorId: number;
  onRetourAccueil: () => void;
}

type Etape = 'creneaux' | 'coordonnees' | 'confirme';

const JOURS_AFFICHES = 14;

/** Les jours proposés, à partir d'aujourd'hui. */
function construireJours(nombre: number, langue: string) {
  const court = new Intl.DateTimeFormat(langue, { weekday: 'short', day: 'numeric', month: 'short' });
  const long = new Intl.DateTimeFormat(langue, { weekday: 'long', day: 'numeric', month: 'long' });
  return Array.from({ length: nombre }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return {
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      court: court.format(d),
      long: long.format(d),
      aujourdhui: i === 0,
    };
  });
}

export default function ReservationDevantLaPorte({ doctorId, onRetourAccueil }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const langue = isArabic ? 'ar' : 'fr-FR';

  const [medecin, setMedecin] = useState<Doctor | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const jours = useMemo(() => construireJours(JOURS_AFFICHES, langue), [langue]);
  const [jour, setJour] = useState(jours[0].iso);
  const [creneau, setCreneau] = useState<string | null>(null);
  const [etape, setEtape] = useState<Etape>('creneaux');

  /** Créneaux déjà pris sur toute la fenêtre — clé « date|heure ». */
  const [pris, setPris] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({ nom: '', telephone: '', email: '', motif: '' });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const d = await doctorsAPI.getById(doctorId);
        if (vivant) setMedecin(d as Doctor);
      } catch {
        if (vivant) setErreur('introuvable');
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => { vivant = false; };
  }, [doctorId]);

  /* Les créneaux déjà réservés, sur toute la fenêtre affichée et en une seule
     requête. Les charger jour par jour ferait clignoter la liste à chaque
     changement de date, sur une connexion mobile qui n'est pas toujours bonne
     devant une porte. */
  useEffect(() => {
    let vivant = true;
    appointmentsAPI.getBookedSlots(jours[0].iso, jours[jours.length - 1].iso)
      .then((lignes) => {
        if (!vivant) return;
        setPris(new Set(
          lignes
            .filter((l) => l.doctor_id === doctorId)
            .map((l) => `${l.appointment_date}|${l.appointment_time}`),
        ));
      })
      .catch(() => { /* la liste reste telle quelle : au pire on propose un créneau pris,
                        et la base refusera la réservation avec un message clair */ });
    return () => { vivant = false; };
  }, [doctorId, jours]);

  const creneauxLibres = useMemo(() => {
    if (!medecin) return [];
    return slotsForDay(medecin, jour, 'cabinet').filter((h) => !pris.has(`${jour}|${h}`));
  }, [medecin, jour, pris]);

  /* Un créneau du jour même déjà passé n'a plus de sens : il est midi, on ne
     propose pas neuf heures. */
  const creneauxAVenir = useMemo(() => {
    if (jour !== jours[0].iso) return creneauxLibres;
    const maintenant = new Date();
    const heureActuelle = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
    return creneauxLibres.filter((h) => h > heureActuelle);
  }, [creneauxLibres, jour, jours]);

  const reserver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medecin || !creneau) return;
    setEnvoi(true);
    setErreur('');
    try {
      await appointmentsAPI.create(
        {
          doctorId: medecin.id,
          patientName: form.nom.trim(),
          patientEmail: form.email.trim(),
          patientPhone: form.telephone.trim(),
          reason: form.motif.trim() || undefined,
          appointmentDate: jour,
          appointmentTime: creneau,
          consultationType: 'cabinet',
          language: isArabic ? 'ar' : 'fr',
        },
        /* Sans compte, délibérément. Un jeton patient traînant dans le
           navigateur — le téléphone d'un proche, un poste partagé — ferait
           réattribuer le rendez-vous à son titulaire, et la personne
           réellement reçue n'apparaîtrait nulle part. */
        { pourSonPropreCompte: false },
      );
      setEtape('confirme');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Réservation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  // ── États d'attente et d'erreur ──

  if (chargement) {
    return (
      <Cadre>
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600 mb-3" />
          <p className="text-sm text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
        </div>
      </Cadre>
    );
  }

  if (!medecin) {
    return (
      <Cadre>
        <div className="text-center py-8">
          <div className="text-4xl mb-4" aria-hidden="true">🔍</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">
            {isArabic ? 'الطبيب غير موجود' : 'Praticien introuvable'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {isArabic
              ? 'قد يكون رمز QR قديمًا. اسأل في العيادة.'
              : 'Ce QR code est peut-être ancien. Demandez au cabinet.'}
          </p>
          <BoutonPrincipal onClick={onRetourAccueil}>
            {isArabic ? 'العودة للرئيسية' : 'Aller sur chifak'}
          </BoutonPrincipal>
        </div>
      </Cadre>
    );
  }

  const jourChoisi = jours.find((j) => j.iso === jour);

  // ── Confirmation ──

  if (etape === 'confirme') {
    return (
      <Cadre>
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5 text-3xl" aria-hidden="true">✓</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {isArabic ? 'تم حجز موعدك' : 'Rendez-vous confirmé'}
          </h1>
          <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
            {isArabic ? 'مع ' : 'Avec '}<strong>{medecin.name}</strong><br />
            {jourChoisi?.long} {isArabic ? 'على' : 'à'} <strong>{creneau}</strong>
          </p>
          <div className="rounded-2xl p-4 text-start mb-6" style={{ background: 'var(--bg-2)' }}>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isArabic
                ? 'أُرسل بريد تأكيد إلى عنوانك، ويحتوي على رابط لإلغاء الموعد إن لزم الأمر.'
                : 'Un e-mail de confirmation vient de partir à votre adresse. Il contient un lien pour annuler si vous ne pouvez plus venir.'}
            </p>
          </div>
          <BoutonPrincipal onClick={onRetourAccueil}>
            {isArabic ? 'اكتشف chifak' : 'Découvrir chifak'}
          </BoutonPrincipal>
        </div>
      </Cadre>
    );
  }

  // ── Coordonnées ──

  if (etape === 'coordonnees') {
    const complet = form.nom.trim().length >= 2 && form.telephone.trim().length >= 8 && form.email.includes('@');
    return (
      <Cadre>
        <button
          type="button"
          onClick={() => { setEtape('creneaux'); setCreneau(null); }}
          className="mb-5 text-sm font-bold text-blue-600 inline-flex items-center gap-1.5"
        >
          <span aria-hidden="true">{isArabic ? '→' : '←'}</span>
          {isArabic ? 'تغيير الموعد' : 'Changer de créneau'}
        </button>

        <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg-2)' }}>
          <p className="text-sm text-gray-500">{medecin.name}</p>
          <p className="text-[17px] font-bold text-gray-900 mt-0.5">
            {jourChoisi?.long} · {creneau}
          </p>
        </div>

        <form onSubmit={reserver} className="space-y-4">
          <Champ
            id="rp-nom" label={isArabic ? 'الاسم الكامل' : 'Nom et prénom'}
            value={form.nom} onChange={(v) => setForm({ ...form, nom: v })}
            placeholder={isArabic ? 'اسمك' : 'Votre nom'} autoComplete="name" required
          />
          <Champ
            id="rp-tel" label={isArabic ? 'الهاتف' : 'Téléphone'}
            value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })}
            placeholder="0555 12 34 56" type="tel" autoComplete="tel" required
          />
          <Champ
            id="rp-email" label="Email"
            value={form.email} onChange={(v) => setForm({ ...form, email: v })}
            placeholder="vous@exemple.dz" type="email" autoComplete="email" required
            aide={isArabic
              ? 'لإرسال التأكيد ورابط الإلغاء.'
              : 'Pour recevoir la confirmation et le lien d’annulation.'}
          />
          <Champ
            id="rp-motif" label={isArabic ? 'سبب الزيارة (اختياري)' : 'Motif (facultatif)'}
            value={form.motif} onChange={(v) => setForm({ ...form, motif: v })}
            placeholder={isArabic ? 'مثال: فحص' : 'Ex. : contrôle'}
          />

          {erreur && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-medium text-red-600" role="alert">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={!complet || envoi}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-2xl transition-colors active:scale-[0.99]"
          >
            {envoi
              ? (isArabic ? 'جارٍ الحجز…' : 'Réservation…')
              : (isArabic ? 'تأكيد الموعد' : 'Confirmer le rendez-vous')}
          </button>
        </form>
      </Cadre>
    );
  }

  // ── Choix du créneau ──

  return (
    <Cadre large>
      <div className="flex items-center gap-4 mb-6">
        <DoctorAvatar doctor={medecin} className="w-14 h-14 flex-shrink-0" rounded="rounded-2xl" />
        <div className="min-w-0">
          <h1 className="text-xl font-black text-gray-900 leading-tight">{medecin.name}</h1>
          <p className="text-sm text-gray-500">{medecin.specialty}</p>
        </div>
      </div>

      <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
        {isArabic
          ? 'اختر موعدًا متاحًا. لا حاجة لإنشاء حساب.'
          : 'Choisissez un créneau disponible. Aucun compte n’est nécessaire.'}
      </p>

      {/* Bande de jours : le pouce fait défiler, sans quitter la page. */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5 -mx-1 px-1">
        {jours.map((j) => (
          <button
            key={j.iso}
            type="button"
            onClick={() => { setJour(j.iso); setCreneau(null); }}
            aria-label={j.long}
            aria-pressed={jour === j.iso}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              jour === j.iso
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {j.aujourdhui ? (isArabic ? 'اليوم' : "Auj.") : j.court}
          </button>
        ))}
      </div>

      {creneauxAVenir.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-2)' }}>
          <p className="text-gray-600 font-medium mb-1">
            {isArabic ? 'لا يوجد موعد متاح' : 'Aucun créneau ce jour-là'}
          </p>
          <p className="text-sm text-gray-500">
            {isArabic ? 'جرّب يومًا آخر أعلاه.' : 'Essayez un autre jour ci-dessus.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {creneauxAVenir.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => { setCreneau(h); setEtape('coordonnees'); }}
                className="py-3.5 rounded-xl border-2 border-gray-200 bg-white text-[15px] font-bold text-gray-800 hover:border-blue-500 hover:text-blue-700 active:scale-[0.97] transition-all tabular-nums"
              >
                {h}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-5 text-center leading-relaxed">
            {isArabic
              ? 'المواعيد المحجوزة لا تظهر هنا.'
              : 'Les créneaux déjà réservés n’apparaissent pas dans cette liste.'}
          </p>
        </>
      )}
    </Cadre>
  );
}

/* ── Petits éléments d'habillage, gardés dans ce fichier : ils ne servent
      qu'ici et n'ont pas vocation à être réutilisés ailleurs. ── */

function Cadre({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  const { language } = useLanguage();
  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center p-4 py-8"
      style={{ background: 'var(--bg-2)' }}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className={`w-full ${large ? 'max-w-xl' : 'max-w-md'} bg-white rounded-3xl shadow-xl p-6 sm:p-8`}>
        {children}
      </div>
    </div>
  );
}

function BoutonPrincipal({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors"
    >
      {children}
    </button>
  );
}

function Champ({
  id, label, value, onChange, placeholder, type = 'text', autoComplete, required, aide,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string; required?: boolean; aide?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 border border-gray-300 rounded-2xl text-[15px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
      />
      {aide && <p className="text-xs text-gray-400 mt-1.5 px-1">{aide}</p>}
    </div>
  );
}
