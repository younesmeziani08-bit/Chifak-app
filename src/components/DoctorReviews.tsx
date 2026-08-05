import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { reviewsAPI } from '../services/api';

/**
 * Avis des patients sous la fiche d'un praticien.
 *
 * Affichés publiquement et définitivement : la route de suppression a été
 * retirée du serveur. Une note qu'un praticien pourrait faire effacer ne
 * vaudrait rien pour le patient suivant.
 *
 * Présentation reprise des fiches de lieu : note moyenne à gauche, répartition
 * par étoile à droite, puis les commentaires. La répartition en dit plus que
 * la moyenne — trois avis à 1 et trois à 5 donnent la même moyenne que six
 * avis à 3, sans rien signifier de comparable.
 */

interface Review {
  id: number;
  patient_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

function Etoiles({ note, taille = 'text-base' }: { note: number; taille?: string }) {
  return (
    <span className={`${taille} tracking-tight`} aria-label={`${note} sur 5`}>
      <span className="text-amber-500">{'★'.repeat(Math.round(note))}</span>
      <span className="text-gray-200">{'★'.repeat(5 - Math.round(note))}</span>
    </span>
  );
}

export default function DoctorReviews({ doctorId }: { doctorId: number }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  /** Au-delà de cinq avis, on replie : la fiche resterait sinon interminable. */
  const [tout, setTout] = useState(false);

  useEffect(() => {
    let alive = true;
    reviewsAPI.getForDoctor(doctorId)
      .then((rows) => { if (alive) setReviews(Array.isArray(rows) ? rows : []); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [doctorId]);

  if (loading) return null;

  const total = reviews.length;
  const moyenne = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const repartition = [5, 4, 3, 2, 1].map((n) => ({
    note: n,
    nombre: reviews.filter((r) => r.rating === n).length,
  }));
  const visibles = tout ? reviews : reviews.slice(0, 5);

  return (
    <section className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-5">
        {isArabic ? 'آراء المرضى' : 'Avis des patients'}
      </h3>

      {total === 0 ? (
        <p className="text-sm text-gray-500">
          {isArabic
            ? 'لا توجد آراء بعد. كن أول من يترك رأيه بعد موعدك.'
            : 'Aucun avis pour le moment. Vous pourrez en laisser un après votre consultation.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-8 items-start pb-5 mb-5 border-b border-gray-100">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 leading-none">
                {moyenne.toFixed(1)}
              </div>
              <div className="mt-1.5"><Etoiles note={moyenne} /></div>
              <div className="text-xs text-gray-500 mt-1">
                {total} {isArabic ? 'رأي' : total > 1 ? 'avis' : 'avis'}
              </div>
            </div>

            {/* Répartition : une barre par niveau de note */}
            <div className="flex-1 min-w-[180px] space-y-1">
              {repartition.map(({ note, nombre }) => (
                <div key={note} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-3 tabular-nums">{note}</span>
                  <span className="text-amber-500 text-xs">★</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: total ? `${(nombre / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-end tabular-nums">{nombre}</span>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-4">
            {visibles.map((r) => (
              <li key={r.id} className="pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {(r.patient_name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.patient_name || (isArabic ? 'مريض' : 'Patient')}
                    </p>
                    <div className="flex items-center gap-2">
                      <Etoiles note={r.rating} taille="text-xs" />
                      <span className="text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
                          year: 'numeric', month: 'long',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed ps-12">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>

          {total > 5 && (
            <button
              type="button"
              onClick={() => setTout((v) => !v)}
              className="mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              {tout
                ? (isArabic ? 'عرض أقل' : 'Afficher moins')
                : (isArabic ? `عرض كل الآراء (${total})` : `Voir les ${total} avis`)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
