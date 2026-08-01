import { useEffect, useState } from 'react';
import { reviewsAPI } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

interface AdminReview {
  id: number;
  doctor_name: string;
  specialty: string;
  patient_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function AdminReviews() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await reviewsAPI.getAll();
      setReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(isArabic ? 'حذف هذا التقييم؟' : 'Supprimer cet avis ?')) return;
    try {
      await reviewsAPI.remove(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erreur');
    }
  };

  if (loading) return <p className="text-gray-500">{isArabic ? 'جاري التحميل…' : 'Chargement…'}</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (reviews.length === 0) return <p className="text-gray-500">{isArabic ? 'لا توجد تقييمات.' : 'Aucun avis pour le moment.'}</p>;

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-gray-900">{r.doctor_name}</span>
              <span className="text-xs text-blue-600">{r.specialty}</span>
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <svg key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
                  </svg>
                ))}
              </span>
            </div>
            {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {r.patient_name || (isArabic ? 'مريض' : 'Patient')} · {new Date(r.created_at).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR')}
            </p>
          </div>
          <button
            onClick={() => handleDelete(r.id)}
            className="flex-shrink-0 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            {isArabic ? 'حذف' : 'Supprimer'}
          </button>
        </div>
      ))}
    </div>
  );
}
