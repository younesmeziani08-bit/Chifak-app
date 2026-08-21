import { useState } from 'react';
import { applicationsAPI, type ApplicationKind } from '../../services/api';
import LocationSelector from '../home/LocationSelector';
import VerificationIdentite from './VerificationIdentite';

/**
 * Formulaire de demande d'un praticien.
 *
 * Un seul formulaire pour les deux boutons : inscription et démonstration ne
 * diffèrent que par le motif et par la présence du mot de passe. Deux
 * formulaires distincts auraient doublé la surface à maintenir pour une seule
 * différence réelle.
 *
 * Ce que le formulaire dit clairement, et qui compte plus que sa mise en page :
 * la demande est EXAMINÉE. Un praticien qui croit être publié aussitôt et se
 * cherche en vain dans l'annuaire le lendemain nous écrira, à raison.
 */

const SPECIALITES = [
  'Médecin généraliste', 'Dentiste', 'Ophtalmologue', 'Dermatologue',
  'Cardiologue', 'Pédiatre', 'Gynécologue', 'ORL', 'Kinésithérapeute',
  'Psychologue', 'Ostéopathe', 'Sage-femme',
];

interface Props {
  kind: ApplicationKind;
  isArabic: boolean;
  onDone: () => void;
}

export default function ProfessionalForm({ kind, isArabic, onDone }: Props) {
  const inscription = kind === 'registration';

  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [lieu, setLieu] = useState('');
  /* Adresse précise du cabinet : rue et numéro. Elle manquait, et le serveur
     retombait alors sur la seule wilaya au moment de créer la fiche — le
     patient recevait « Alger » en guise d'adresse et devait téléphoner pour
     savoir où se présenter. */
  const [adresse, setAdresse] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /* Résultat du contrôle facial. Uniquement le verdict et le score : aucune
     image ni gabarit ne remonte jusqu'ici — voir VerificationIdentite. */
  const [verification, setVerification] = useState<{ verifie: boolean; score: number } | null>(null);

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoye, setEnvoye] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await applicationsAPI.submit({
        kind,
        fullName,
        specialty,
        city: lieu,
        address: adresse,
        phone,
        email,
        password: inscription ? password : undefined,
        identityChecked: verification?.verifie ?? undefined,
        identityScore: verification?.score ?? undefined,
      });
      setEnvoye(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de l’envoi.');
    } finally {
      setEnvoi(false);
    }
  };

  /* ── Confirmation ──
     On annonce le délai d'examen plutôt qu'un « merci » vide : la seule
     question que se pose le praticien à cet instant est « et maintenant ? ». */
  if (envoye) {
    return (
      <div className="text-center py-8">
        <div
          className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-xl mb-2" style={{ color: 'var(--ink)' }}>
          {isArabic ? 'تم استلام طلبك' : 'Demande reçue'}
        </h3>
        <p className="text-sm leading-relaxed mx-auto mb-6" style={{ color: 'var(--ink-2)', maxWidth: '26rem' }}>
          {inscription
            ? (isArabic
              ? 'يفحص فريقنا ملفك. بعد القبول، تصلك رسالة تحتوي رمز الدخول الخاص بك، وتستعمل كلمة المرور التي اخترتها.'
              : 'Notre équipe examine votre dossier. Après acceptation, vous recevrez votre code de connexion par e-mail ; le mot de passe sera celui que vous venez de choisir.')
            : (isArabic
              ? 'سنتصل بك لتحديد موعد العرض.'
              : 'Nous vous recontactons pour convenir d’une date de démonstration.')}
        </p>
        <button type="button" onClick={onDone} className="btn-secondary">
          {isArabic ? 'إغلاق' : 'Fermer'}
        </button>
      </div>
    );
  }

  const etiquette = 'block text-[11px] font-semibold uppercase tracking-wider mb-1.5';

  return (
    <form onSubmit={soumettre} className="text-start" dir={isArabic ? 'rtl' : 'ltr'}>
      <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
        {inscription
          ? (isArabic
            ? 'يفحص فريقنا كل طلب قبل نشر الملف. هذه المرحلة تحمي المرضى: لا يظهر أي طبيب دون التحقق منه.'
            : 'Chaque demande est examinée avant publication. Cette étape protège les patients : aucun praticien n’apparaît sans vérification.')
          : (isArabic
            ? 'اترك معلوماتك، ونتصل بك لتحديد موعد.'
            : 'Laissez vos coordonnées, nous vous recontactons pour convenir d’une date.')}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pro-nom" className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'الاسم الكامل' : 'Nom complet'}
          </label>
          <input
            id="pro-nom" className="field" required value={fullName} autoComplete="name"
            onChange={(e) => setFullName(e.target.value)}
            placeholder={isArabic ? 'د. أحمد بن علي' : 'Dr Ahmed Benali'}
          />
        </div>

        <div>
          <label htmlFor="pro-specialite" className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'التخصص' : 'Spécialité'}
          </label>
          <select
            id="pro-specialite" className="field cursor-pointer" required value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="">{isArabic ? 'اختر تخصصًا' : 'Choisir une spécialité'}</option>
            {SPECIALITES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'الولاية والبلدية' : 'Wilaya et commune'}
          </label>
          {/* Même sélecteur que la recherche patient : les lieux saisis par les
              praticiens et ceux cherchés par les patients viennent alors du
              même référentiel, et se correspondent forcément. Une saisie libre
              produirait « Alger », « alger », « Alger-Centre » — trois
              praticiens introuvables par la même recherche. */}
          <LocationSelector onLocationChange={setLieu} showWilayaLabel={false} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="pro-adresse" className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'العنوان الدقيق للعيادة' : 'Adresse exacte du cabinet'}
          </label>
          <input
            id="pro-adresse" className="field" required value={adresse} autoComplete="street-address"
            onChange={(e) => setAdresse(e.target.value)}
            placeholder={isArabic ? '15 شارع ديدوش مراد' : '15 rue Didouche Mourad'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--ink-3)' }}>
            {isArabic
              ? 'هذا ما يقرأه المريض ليجدك. اذكر الرقم والشارع، وأضف الطابق إن لزم.'
              : 'C’est ce que lit le patient pour vous trouver. Indiquez le numéro et la rue, et l’étage si besoin.'}
          </p>
        </div>

        <div>
          <label htmlFor="pro-tel" className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'الهاتف' : 'Téléphone'}
          </label>
          <input
            id="pro-tel" type="tel" className="field" required value={phone} autoComplete="tel"
            onChange={(e) => setPhone(e.target.value)} placeholder="0555 12 34 56"
          />
        </div>

        <div>
          <label htmlFor="pro-email" className={etiquette} style={{ color: 'var(--ink-3)' }}>
            {isArabic ? 'البريد الإلكتروني' : 'E-mail'}
          </label>
          <input
            id="pro-email" type="email" className="field" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} placeholder="nom@cabinet.dz"
          />
        </div>

        {/* ── Mot de passe ──
            Il est chiffré dès l'envoi, avant même d'être enregistré : ce qui
            arrive en base est une empreinte, dont on ne peut pas remonter au
            mot de passe. L'administration voit qu'une demande existe, jamais
            ce secret — et il n'est pas non plus dans la fiche qu'elle consulte.

            Le dire ici, et pas seulement dans le code : un praticien à qui on
            demande de choisir un mot de passe dans un formulaire qu'un tiers
            va examiner a le droit de savoir qui pourra le lire.

            Le numéro d'inscription à l'Ordre a été retiré : il était facultatif
            et n'était utilisé nulle part. C'est l'administration qui attribue
            le code de connexion, à l'acceptation, et qui le communique. */}
        {inscription && (
          <div className="sm:col-span-2">
            <label htmlFor="pro-mdp" className={etiquette} style={{ color: 'var(--ink-3)' }}>
              {isArabic ? 'كلمة المرور' : 'Mot de passe'}
            </label>
            <input
              id="pro-mdp" type="password" className="field" required value={password}
              autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--ink-3)' }}>
              {isArabic
                ? '8 أحرف على الأقل، مع حروف وأرقام.'
                : '8 caractères minimum, lettres et chiffres.'}
            </p>

            <div
              className="mt-2.5 rounded-lg px-3 py-2.5 flex gap-2.5"
              style={{ background: 'var(--bg-2)' }}
            >
              <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} aria-hidden>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {isArabic
                  ? 'كلمة المرور تُشفَّر فور إرسالها. لا يمكن لأي شخص الاطلاع عليها — ولا حتى إدارة شفاك. أنت وحدك تعرفها.'
                  : 'Votre mot de passe est chiffré dès l’envoi. Personne ne peut le lire — pas même l’administration de chifak. Vous seul le connaissez.'}
              </p>
            </div>
          </div>
        )}

        {inscription && (
          <div className="sm:col-span-2">
            <VerificationIdentite isArabic={isArabic} onResultat={setVerification} />
          </div>
        )}
      </div>

      {erreur && (
        <p
          role="alert"
          className="mt-4 text-sm rounded-lg px-3 py-2.5"
          style={{ background: '#FDECEA', color: 'var(--danger)' }}
        >
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-7">
        <button type="submit" disabled={envoi} className="btn-primary">
          {envoi
            ? (isArabic ? 'جارٍ الإرسال…' : 'Envoi…')
            : inscription
              ? (isArabic ? 'إرسال طلبي' : 'Envoyer ma demande')
              : (isArabic ? 'طلب عرض توضيحي' : 'Demander une démo')}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary">
          {isArabic ? 'إلغاء' : 'Annuler'}
        </button>
      </div>
    </form>
  );
}
