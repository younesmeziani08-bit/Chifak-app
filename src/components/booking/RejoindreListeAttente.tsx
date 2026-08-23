import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { listeAttenteAPI } from '../../services/listeAttente';
import { Icone } from '../shared/Carte';

/**
 * « Prévenez-moi si une place se libère. »
 *
 * ── Le moment où cet écran compte ──
 *
 * Quelqu'un vient de lire « aucun créneau » chez le praticien qu'il voulait
 * voir. C'est l'instant précis où il quitte l'application pour ne plus jamais
 * revenir — et c'est dommage, parce que quelqu'un annulera. Le créneau
 * repartira simplement à qui passait par là.
 *
 * ── Trois champs, pas de compte ──
 *
 * Quelqu'un qui vient de lire « complet » ne va pas créer un compte pour
 * espérer. Nom, téléphone, adresse : le strict nécessaire pour le prévenir.
 *
 * Le formulaire dit d'emblée ce qui se passera — une place réservée deux
 * heures — parce que c'est cette promesse-là qui décide de s'inscrire ou non.
 * « On vous préviendra » sans plus de précision ne vaut pas qu'on laisse son
 * numéro.
 */

interface Props {
  doctorId: number;
  nomMedecin: string;
  /** Repli discret quand la carte est affichée au milieu d'une liste. */
  compact?: boolean;
}

export default function RejoindreListeAttente({ doctorId, nomMedecin, compact = false }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [inscrit, setInscrit] = useState(false);

  const complet = form.nom.trim().length >= 2
    && form.telephone.trim().length >= 8
    && form.email.includes('@');

  const sInscrire = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      await listeAttenteAPI.sInscrire(doctorId, {
        patientName: form.nom.trim(),
        patientEmail: form.email.trim(),
        patientPhone: form.telephone.trim(),
      }, isArabic ? 'ar' : 'fr');
      setInscrit(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Inscription impossible');
    } finally {
      setEnvoi(false);
    }
  };

  if (inscrit) {
    return (
      <div
        className="flex items-start gap-3 p-4"
        style={{ borderRadius: 'var(--r-lg)', background: 'var(--accent-bg)' }}
      >
        <span style={{ color: 'var(--success)' }} className="mt-0.5 flex-shrink-0">
          <Icone nom="coche" className="w-[18px] h-[18px]" />
        </span>
        <div>
          <p className="text-[14px]" style={{ color: 'var(--ink)', fontWeight: 600 }}>
            {isArabic ? 'أنت في قائمة الانتظار' : 'Vous êtes sur la liste d’attente'}
          </p>
          <p className="text-[13px] leading-relaxed mt-1" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'سنُعلمك فور تحرّر موعد. يُحجز لك ساعتين لتأكيده.'
              : 'Nous vous préviendrons dès qu’une place se libère. Elle vous sera réservée deux heures, le temps de la confirmer.'}
          </p>
        </div>
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={`${compact ? 'text-[14px] py-2.5 px-4' : 'w-full py-3.5'} inline-flex items-center justify-center gap-2 transition-colors`}
        style={{
          borderRadius: 'var(--r-md)', fontWeight: 600, color: 'var(--accent)',
          background: 'var(--accent-bg)',
        }}
      >
        <Icone nom="cloche" className="w-[18px] h-[18px]" />
        {isArabic ? 'أعلِمني عند توفّر موعد' : 'Prévenez-moi si une place se libère'}
      </button>
    );
  }

  return (
    <form
      onSubmit={sInscrire}
      className="p-4 space-y-3"
      style={{ borderRadius: 'var(--r-lg)', background: 'var(--bg-2)', boxShadow: 'inset 0 0 0 1px var(--tint-10)' }}
    >
      <div>
        <p className="text-[14px]" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {isArabic ? `قائمة انتظار ${nomMedecin}` : `Liste d’attente de ${nomMedecin}`}
        </p>
        {/* La promesse exacte, avant les champs : c'est elle qui décide si
            l'on laisse son numéro, pas le bouton. */}
        <p className="text-[13px] leading-relaxed mt-1" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'عند إلغاء أحد المرضى، نُعلمك أوّلًا ونحجز لك الموعد ساعتين. لا حاجة لحساب.'
            : 'Quand un patient annule, vous êtes prévenu en premier et la place vous est réservée deux heures. Aucun compte nécessaire.'}
        </p>
      </div>

      <Champ
        id={`att-nom-${doctorId}`} label={isArabic ? 'الاسم الكامل' : 'Nom et prénom'}
        value={form.nom} onChange={(v) => setForm({ ...form, nom: v })}
        autoComplete="name" placeholder={isArabic ? 'اسمك' : 'Votre nom'}
      />
      <Champ
        id={`att-tel-${doctorId}`} label={isArabic ? 'الهاتف' : 'Téléphone'}
        value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })}
        type="tel" autoComplete="tel" placeholder="0555 12 34 56"
      />
      <Champ
        id={`att-mail-${doctorId}`} label="Email"
        value={form.email} onChange={(v) => setForm({ ...form, email: v })}
        type="email" autoComplete="email" placeholder="vous@exemple.dz"
      />

      {erreur && (
        <p className="text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{erreur}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={!complet || envoi}
          className="px-5 py-2.5 text-[14px] transition-colors disabled:opacity-55"
          style={{ borderRadius: 'var(--r-md)', fontWeight: 600, background: 'var(--accent)', color: '#FFFFFF' }}
        >
          {envoi
            ? (isArabic ? 'جارٍ…' : 'Inscription…')
            : (isArabic ? 'أعلِمني' : 'Me prévenir')}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="px-5 py-2.5 text-[14px]"
          style={{
            borderRadius: 'var(--r-md)', fontWeight: 600, background: 'var(--bg)',
            color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--tint-20)',
          }}
        >
          {isArabic ? 'تراجع' : 'Annuler'}
        </button>
      </div>
    </form>
  );
}

function Champ({
  id, label, value, onChange, placeholder, type = 'text', autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] mb-1" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-[14px] outline-none transition
          focus:ring-2 focus:ring-offset-0"
        style={{
          borderRadius: 'var(--r-md)', background: 'var(--bg)',
          color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--tint-20)',
        }}
      />
    </div>
  );
}
