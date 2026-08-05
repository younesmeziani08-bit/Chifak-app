import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { feedbackAPI } from '../services/api';

/**
 * Page atteinte par le médecin en scannant le QR code d'un employé.
 *
 * Volontairement sans authentification : exiger un compte ici ferait chuter le
 * taux de réponse, et l'information recueillie n'est pas sensible pour celui
 * qui la donne. Le jeton du lien est aléatoire et le dépôt est limité en
 * fréquence côté serveur.
 */
export default function FeedbackPage({ token }: { token: string }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [staff, setStaff] = useState<{ name: string; staffCode: string | null } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({ doctorName: '', doctorCode: '', comment: '', suggestion: '' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    feedbackAPI.whoIs(token)
      .then(setStaff)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Lien invalide'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setSending(true);
    setSendError('');
    try {
      await feedbackAPI.submit(token, { rating, ...form });
      setDone(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const cadre = 'min-h-screen flex items-center justify-center px-4 py-10 hero-pattern';

  if (loadError) {
    return (
      <div className={cadre} dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <p className="text-lg mb-2" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'رابط غير صالح' : 'Lien invalide'}
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'قد يكون الحساب حُذف. اطلب رمزًا جديدًا.'
              : 'Ce compte a peut-être été supprimé. Demandez un nouveau QR code.'}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={cadre} dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="text-4xl mb-3">✅</div>
          <p className="text-lg mb-2" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'شكرًا لك' : 'Merci pour votre retour'}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'وصل رأيك إلى الإدارة. لن يطّلع عليه الموظف المعني.'
              : 'Votre avis est parvenu à l’administration. L’employé concerné n’y a pas accès.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cadre} dir={isArabic ? 'rtl' : 'ltr'}>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-3)' }}>chifak</p>
        <h1 className="text-xl mb-1" style={{ color: 'var(--ink)' }}>
          {isArabic ? 'قيّم المرافقة' : 'Évaluez votre accompagnement'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
          {staff
            ? (isArabic ? `الموظف: ${staff.name}` : `Employé : ${staff.name}`)
            : (isArabic ? 'جارٍ التحميل…' : 'Chargement…')}
        </p>

        {/* Note */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'تقييمك *' : 'Votre note *'}
          </label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} / 5`}
                aria-pressed={rating === n}
                className={`w-12 h-12 rounded-xl text-2xl transition ${
                  n <= rating ? 'text-amber-500 bg-amber-50' : 'text-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <input
            value={form.doctorName}
            onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
            placeholder={isArabic ? 'اسمك (اختياري)' : 'Votre nom (facultatif)'}
            className="field"
          />
          <input
            value={form.doctorCode}
            onChange={(e) => setForm({ ...form, doctorCode: e.target.value })}
            placeholder={isArabic ? 'رمز الطبيب (اختياري)' : 'Code médecin (facultatif)'}
            className="field"
          />
        </div>

        <textarea
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          rows={3}
          placeholder={isArabic ? 'كيف كانت المرافقة؟' : 'Comment s’est passé l’accompagnement ?'}
          className="field mb-3 resize-none"
        />

        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink)' }}>
          {isArabic ? 'اقتراح لتحسين شفاك' : 'Une idée pour améliorer chifak ?'}
        </label>
        <textarea
          value={form.suggestion}
          onChange={(e) => setForm({ ...form, suggestion: e.target.value })}
          rows={3}
          placeholder={isArabic ? 'ما الذي ينقصك في المنصّة؟' : 'Que manque-t-il à la plateforme selon vous ?'}
          className="field mb-4 resize-none"
        />

        {sendError && <p className="text-sm text-red-600 mb-3">{sendError}</p>}

        <button type="submit" disabled={!rating || sending} className="btn-primary w-full" style={{ height: '48px' }}>
          {sending
            ? (isArabic ? 'جارٍ الإرسال…' : 'Envoi…')
            : (isArabic ? 'إرسال' : 'Envoyer mon avis')}
        </button>

        <p className="text-xs mt-3 text-center" style={{ color: 'var(--ink-3)' }}>
          {isArabic
            ? 'يُقرأ رأيك من طرف الإدارة فقط.'
            : 'Votre avis n’est lu que par l’administration de chifak.'}
        </p>
      </form>
    </div>
  );
}
