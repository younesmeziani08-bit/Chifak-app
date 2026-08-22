import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { listeAttenteAPI } from '../../services/listeAttente';

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
      <div className="rounded-2xl p-4 border border-green-200 bg-green-50">
        <p className="text-sm font-bold text-green-800 mb-1">
          {isArabic ? '✓ أنت في قائمة الانتظار' : '✓ Vous êtes sur la liste d’attente'}
        </p>
        <p className="text-sm text-green-800/80 leading-relaxed">
          {isArabic
            ? 'سنُعلمك فور تحرّر موعد. يُحجز لك ساعتين لتأكيده.'
            : 'Nous vous préviendrons dès qu’une place se libère. Elle vous sera réservée deux heures, le temps de la confirmer.'}
        </p>
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={`${compact ? 'text-sm py-2.5 px-4' : 'w-full py-3.5'} rounded-xl border-2 border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition-colors`}
      >
        {isArabic ? '🔔 أعلِمني عند توفّر موعد' : '🔔 Prévenez-moi si une place se libère'}
      </button>
    );
  }

  return (
    <form onSubmit={sInscrire} className="rounded-2xl p-4 border border-blue-200 bg-blue-50/50 space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900">
          {isArabic ? `قائمة انتظار ${nomMedecin}` : `Liste d’attente de ${nomMedecin}`}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mt-1">
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
        <p className="text-sm font-medium text-red-600" role="alert">{erreur}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={!complet || envoi}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold transition-colors"
        >
          {envoi
            ? (isArabic ? 'جارٍ…' : 'Inscription…')
            : (isArabic ? 'أعلِمني' : 'Me prévenir')}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold"
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
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <input
        id={id}
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
      />
    </div>
  );
}
