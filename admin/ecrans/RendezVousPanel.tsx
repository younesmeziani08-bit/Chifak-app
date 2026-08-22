import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { appointmentsAPI, annulationsCabinetAPI } from '../services/api';

/**
 * Les rendez-vous du service, et le geste qui manquait : les annuler.
 *
 * ── Pourquoi cet écran n'existait pas, et pourquoi il doit exister ──
 *
 * L'administration ne voyait que des COMPTEURS. La route qui liste les
 * rendez-vous existait depuis toujours et n'était affichée nulle part ; et
 * surtout, une seule route pouvait annuler un rendez-vous — celle du patient
 * connecté.
 *
 * Or c'est l'accueil qui décroche quand quelqu'un appelle pour dire qu'il ne
 * viendra pas, et c'est lui qu'on prévient quand un praticien est souffrant.
 * Sans ce geste, le créneau restait bloqué et le praticien attendait
 * quelqu'un qui ne viendrait pas.
 *
 * ── Ce que cet écran n'affiche pas ──
 *
 * Ni les remarques du praticien sur son patient, ni la salle de
 * visioconférence : le serveur ne les envoie pas, et cet écran n'a aucune
 * raison de les connaître. L'accueil a besoin de savoir QUI vient QUAND et
 * chez QUI, pas de lire un dossier médical.
 */

interface RendezVous {
  id: number;
  doctor_id: number;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  reason?: string | null;
  status: string;
  consultation_type?: string;
  doctor_name: string;
  specialty: string;
  city: string;
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_age?: number | null;
}

type Filtre = 'avenir' | 'tous' | 'annules';

const ETATS: Record<string, { fr: string; ar: string; classe: string }> = {
  confirmed: { fr: 'Confirmé', ar: 'مؤكد', classe: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { fr: 'Annulé', ar: 'ملغى', classe: 'bg-red-50 text-red-600 border-red-200' },
  completed: { fr: 'Honoré', ar: 'تمّت', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  no_show: { fr: 'Absent', ar: 'لم يحضر', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function RendezVousPanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [liste, setListe] = useState<RendezVous[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('avenir');
  const [cible, setCible] = useState<number | null>(null);
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState<number | null>(null);

  const charger = async () => {
    try {
      setListe(await appointmentsAPI.getAll());
      setErreur('');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return liste
      .filter((r) => {
        if (filtre === 'avenir') return r.status === 'confirmed' && r.appointment_date >= aujourdhui;
        if (filtre === 'annules') return r.status === 'cancelled';
        return true;
      })
      .filter((r) => !q || [
        r.patient_name, r.patient_email, r.patient_phone, r.doctor_name,
        r.child_first_name, r.child_last_name,
      ].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
  }, [liste, recherche, filtre, aujourdhui]);

  const annuler = async (id: number) => {
    setEnCours(id);
    try {
      await annulationsCabinetAPI.annuler(id, motif.trim() || undefined);
      setCible(null);
      setMotif('');
      await charger();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Annulation impossible');
    } finally {
      setEnCours(null);
    }
  };

  const dateLisible = (iso: string) => new Intl.DateTimeFormat(isArabic ? 'ar' : 'fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${iso}T12:00:00`));

  const filtres: { cle: Filtre; libelle: string }[] = [
    { cle: 'avenir', libelle: isArabic ? 'القادمة' : 'À venir' },
    { cle: 'tous', libelle: isArabic ? 'الكل' : 'Tous' },
    { cle: 'annules', libelle: isArabic ? 'الملغاة' : 'Annulés' },
  ];

  if (chargement) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
        <p className="text-sm text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="rdv-recherche" className="sr-only">
              {isArabic ? 'بحث' : 'Rechercher un patient ou un praticien'}
            </label>
            <input
              id="rdv-recherche"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={isArabic ? 'اسم، هاتف، بريد…' : 'Nom, téléphone, e-mail, praticien…'}
            />
          </div>
          <div className="flex gap-1.5" role="group" aria-label={isArabic ? 'تصفية' : 'Filtrer'}>
            {filtres.map((f) => (
              <button
                key={f.cle}
                type="button"
                onClick={() => setFiltre(f.cle)}
                aria-pressed={filtre === f.cle}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                  filtre === f.cle ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.libelle}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {visibles.length} {isArabic ? 'موعد' : visibles.length > 1 ? 'rendez-vous' : 'rendez-vous'}
          {filtre === 'avenir' && (isArabic ? ' قادم' : ' à venir')}
        </p>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600" role="alert">{erreur}</div>
      )}

      {visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500">{isArabic ? 'لا يوجد موعد مطابق' : 'Aucun rendez-vous correspondant'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((r) => {
            const etat = ETATS[r.status] || ETATS.confirmed;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    {r.child_first_name ? (
                      <>
                        <div className="font-bold text-gray-900">
                          {r.child_first_name} {r.child_last_name}
                          <span className="ms-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                            {r.child_age} {isArabic ? 'سنة' : 'ans'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {isArabic ? 'الوليّ : ' : 'Accompagnant : '}{r.patient_name}
                        </div>
                      </>
                    ) : (
                      <div className="font-bold text-gray-900">{r.patient_name}</div>
                    )}
                    <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                      <div>📞 {r.patient_phone}</div>
                      <div className="break-all">✉️ {r.patient_email}</div>
                      <div>🩺 {r.doctor_name} · {r.specialty}</div>
                      {r.reason && <div>📝 {r.reason}</div>}
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <div className="font-bold text-blue-700">{dateLisible(r.appointment_date)}</div>
                    <div className="text-sm text-gray-500 tabular-nums">{r.appointment_time}</div>
                    <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full border ${etat.classe}`}>
                      {isArabic ? etat.ar : etat.fr}
                    </span>
                  </div>
                </div>

                {r.status === 'confirmed' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {cible === r.id ? (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                        <label htmlFor={`motif-${r.id}`} className="block text-xs font-bold text-red-800 mb-1.5">
                          {isArabic ? 'سبب الإلغاء (يُرسل للمريض)' : 'Motif de l’annulation (transmis au patient)'}
                        </label>
                        <input
                          id={`motif-${r.id}`}
                          value={motif}
                          onChange={(e) => setMotif(e.target.value)}
                          className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mb-3"
                          placeholder={isArabic ? 'مثال: طلب المريض هاتفيًا' : 'Ex. : demande du patient par téléphone'}
                        />
                        <p className="text-xs text-red-700/80 mb-3 leading-relaxed">
                          {isArabic
                            ? 'سيتم إعلام المريض بالبريد، وسيتحرر الموعد فورًا.'
                            : 'Le patient est prévenu par e-mail, et le créneau redevient disponible immédiatement.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => annuler(r.id)}
                            disabled={enCours === r.id}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {enCours === r.id
                              ? (isArabic ? 'جارٍ…' : 'Annulation…')
                              : (isArabic ? 'تأكيد الإلغاء' : 'Confirmer l’annulation')}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setCible(null); setMotif(''); }}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-600"
                          >
                            {isArabic ? 'تراجع' : 'Renoncer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setCible(r.id); setMotif(''); }}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        {isArabic ? 'إلغاء الموعد' : 'Annuler ce rendez-vous'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
