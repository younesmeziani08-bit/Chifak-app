import { useEffect, useState } from 'react';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { deuxiemeFacteurAPI, type EtatDeuxiemeFacteur } from '../services/api';

/**
 * Double authentification : activation, état, désactivation.
 *
 * ── Trois partis pris ──
 *
 * 1. Le secret s'affiche en toutes lettres, à recopier à la main, et PAS en
 *    QR code. Le générateur de QR employé ailleurs dans cet écran envoie son
 *    contenu à un service tiers ; lui confier un secret de double
 *    authentification reviendrait à lui remettre le second facteur. La saisie
 *    manuelle prend trente secondes et n'arrive qu'une fois par personne.
 *
 * 2. Rien n'est activé tant que la personne n'a pas produit un code valide.
 *    Activer d'abord et vérifier ensuite enfermerait dehors quiconque aurait
 *    mal recopié — au moment précis où plus personne ne peut l'aider.
 *
 * 3. Les codes de secours s'affichent une seule fois, et l'écran le dit avant
 *    de les montrer. Seules leurs empreintes sont conservées ; les redonner
 *    est impossible, pas seulement interdit.
 */
export default function SecuritePanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [etat, setEtat] = useState<EtatDeuxiemeFacteur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  /** Secret en cours de mise en place, avant preuve. */
  const [preparation, setPreparation] = useState<{ secret: string; adresse: string } | null>(null);
  const [code, setCode] = useState('');
  /** Codes de secours fraîchement créés. Cette liste ne réapparaîtra jamais. */
  const [codesDeSecours, setCodesDeSecours] = useState<string[] | null>(null);
  const [confirmeNotes, setConfirmeNotes] = useState(false);

  const charger = async () => {
    setChargement(true);
    try {
      setEtat(await deuxiemeFacteurAPI.etat());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const preparer = async () => {
    setErreur('');
    setOccupe(true);
    try {
      setPreparation(await deuxiemeFacteurAPI.preparer());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setOccupe(false);
    }
  };

  const activer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setOccupe(true);
    try {
      const { codesDeSecours: codes } = await deuxiemeFacteurAPI.activer(code);
      setCodesDeSecours(codes);
      setPreparation(null);
      setCode('');
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setOccupe(false);
    }
  };

  const desactiver = async () => {
    const saisi = window.prompt(isArabic
      ? 'أدخل رمزًا صالحًا لتعطيل المصادقة الثنائية:'
      : 'Saisissez un code valide pour désactiver la double authentification :');
    if (!saisi) return;
    setErreur('');
    setOccupe(true);
    try {
      await deuxiemeFacteurAPI.desactiver(saisi);
      setCodesDeSecours(null);
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setOccupe(false);
    }
  };

  const carte = 'rounded-xl p-5';
  const bordure = { background: '#FFFFFF', border: '1px solid var(--tint-10)' };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} style={{ maxWidth: '42rem' }}>
      <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>
        {isArabic ? 'المصادقة الثنائية' : 'Double authentification'}
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
        {isArabic
          ? 'كلمة المرور وحدها تفتح قائمة كل الأطباء وبياناتهم وحسابات الموظفين. الرمز الثاني يجعل كلمة مرور مسروقة غير كافية.'
          : 'Un mot de passe seul ouvre la liste de tous les praticiens, leurs coordonnées et les comptes employés. Le second code rend un mot de passe volé insuffisant.'}
      </p>

      {erreur && (
        <p role="alert" className="text-sm rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FDECEA', color: 'var(--danger)' }}>
          {erreur}
        </p>
      )}

      {/* ── Codes de secours, affichés une seule fois ── */}
      {codesDeSecours && (
        <div className={carte} style={{ background: '#FFFAEB', border: '1px solid #FEC84B', marginBottom: '1.5rem' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#93370D' }}>
            {isArabic ? 'رموز الطوارئ — تُعرض مرة واحدة فقط' : 'Codes de secours — affichés une seule fois'}
          </p>
          <p className="text-sm leading-relaxed mb-3" style={{ color: '#93370D' }}>
            {isArabic
              ? 'اكتبها في مكان آمن. لا يحتفظ الخادم إلا ببصماتها: لا يمكن عرضها مجددًا. كل رمز يُستعمل مرة واحدة، ويسمح بالدخول عند فقدان الهاتف.'
              : 'Notez-les dans un endroit sûr. Le serveur n’en conserve que les empreintes : les réafficher est impossible. Chaque code sert une fois, et permet d’entrer si vous perdez votre téléphone.'}
          </p>
          <ul className="grid grid-cols-2 gap-2 mb-3">
            {codesDeSecours.map((c) => (
              <li key={c} className="font-mono text-sm px-3 py-2 rounded" style={{ background: '#FFFFFF', color: 'var(--ink)' }}>
                {c}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#93370D' }}>
            <input type="checkbox" checked={confirmeNotes} onChange={(e) => setConfirmeNotes(e.target.checked)} />
            {isArabic ? 'كتبتُها في مكان آمن' : 'Je les ai notés en lieu sûr'}
          </label>
          <button
            type="button"
            disabled={!confirmeNotes}
            onClick={() => { setCodesDeSecours(null); setConfirmeNotes(false); }}
            className="btn-secondary mt-3"
            style={{ height: '40px', fontSize: '14px' }}
          >
            {isArabic ? 'إخفاء' : 'Masquer'}
          </button>
        </div>
      )}

      {chargement ? (
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
      ) : etat?.actif ? (
        <div className={carte} style={bordure}>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--success)', color: '#fff' }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>
              {isArabic ? 'مفعّلة على حسابك' : 'Active sur votre compte'}
            </span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? `يتبقى ${etat.codesDeSecoursRestants} من رموز الطوارئ.`
              : `Il vous reste ${etat.codesDeSecoursRestants} code${etat.codesDeSecoursRestants > 1 ? 's' : ''} de secours.`}
            {etat.codesDeSecoursRestants <= 2 && (
              <span style={{ color: 'var(--danger)' }}>
                {isArabic
                  ? ' أعد التفعيل للحصول على رموز جديدة.'
                  : ' Désactivez puis réactivez pour en obtenir de nouveaux.'}
              </span>
            )}
          </p>
          <button type="button" onClick={desactiver} disabled={occupe} className="btn-secondary" style={{ height: '40px', fontSize: '14px', color: 'var(--danger)' }}>
            {isArabic ? 'تعطيل' : 'Désactiver'}
          </button>
        </div>
      ) : preparation ? (
        <form onSubmit={activer} className={carte} style={bordure}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            {isArabic ? '1. أضف هذا المفتاح إلى تطبيق المصادقة' : '1. Ajoutez cette clé dans votre application d’authentification'}
          </p>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'Google Authenticator أو Authy أو ما شابه. اختر « إدخال مفتاح الإعداد » ثم انسخ ما يلي:'
              : 'Google Authenticator, Authy ou équivalent. Choisissez « Saisir une clé de configuration », puis recopiez :'}
          </p>
          <p
            className="font-mono text-lg tracking-wider px-4 py-3 rounded-lg mb-1 select-all break-all"
            style={{ background: 'var(--bg-2)', color: 'var(--ink)' }}
          >
            {preparation.secret}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--ink-3)' }}>
            {isArabic
              ? 'النوع: مبني على الوقت. لا تشارك هذا المفتاح مع أي كان.'
              : 'Type : basé sur le temps. Ne communiquez cette clé à personne.'}
          </p>

          <label htmlFor="code-2fa" className="block text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            {isArabic ? '2. أدخل الرمز المعروض' : '2. Saisissez le code affiché'}
          </label>
          <input
            id="code-2fa"
            className="field font-mono text-lg tracking-widest"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
          />
          <p className="text-xs mt-1.5 mb-4" style={{ color: 'var(--ink-3)' }}>
            {isArabic
              ? 'لن يُفعَّل شيء قبل التحقق من هذا الرمز.'
              : 'Rien n’est activé tant que ce code n’a pas été vérifié.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={occupe || code.length !== 6} className="btn-primary" style={{ height: '42px', fontSize: '14px' }}>
              {isArabic ? 'تفعيل' : 'Activer'}
            </button>
            <button type="button" onClick={() => { setPreparation(null); setCode(''); }} className="btn-secondary" style={{ height: '42px', fontSize: '14px' }}>
              {isArabic ? 'إلغاء' : 'Annuler'}
            </button>
          </div>
        </form>
      ) : (
        <div className={carte} style={bordure}>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'غير مفعّلة. حسابك محمي بكلمة المرور وحدها.'
              : 'Inactive. Votre compte n’est protégé que par son mot de passe.'}
          </p>
          <button type="button" onClick={preparer} disabled={occupe} className="btn-primary" style={{ height: '42px', fontSize: '14px' }}>
            {isArabic ? 'تفعيل المصادقة الثنائية' : 'Activer la double authentification'}
          </button>
        </div>
      )}
    </div>
  );
}
