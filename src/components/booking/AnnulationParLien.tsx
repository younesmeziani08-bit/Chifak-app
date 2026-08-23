import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { rendezVousParJetonAPI, type RendezVousParJeton } from '../../services/annulations';
import { Alerte, Bouton, CarteRdv, Chargement, Entete, PageCarte } from '../shared/Carte';

/**
 * /rdv/&lt;jeton&gt; — voir et annuler un rendez-vous SANS COMPTE.
 *
 * ── Pourquoi cette page existe ──
 *
 * L'application propose délibérément de réserver sans créer de compte. Mais
 * une seule route pouvait annuler, et elle exigeait un jeton patient : celui
 * qui avait réservé en invité n'avait donc AUCUN moyen de se décommander. Le
 * créneau restait bloqué, et le praticien attendait quelqu'un qui ne viendrait
 * pas.
 *
 * Le lien qui mène ici part dans l'e-mail de confirmation. Le jeton tient lieu
 * d'authentification : il ne se devine pas, et il n'ouvre que ce rendez-vous —
 * ni un compte, ni un dossier, ni la liste des autres.
 *
 * La page sert aussi les patients qui ont un compte : c'est le chemin le plus
 * court, et il évite d'avoir à retrouver ses identifiants pour libérer un
 * créneau qu'on sait déjà ne pas pouvoir honorer.
 */

interface Props {
  jeton: string;
  onRetourAccueil: () => void;
}

export default function AnnulationParLien({ jeton, onRetourAccueil }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [rdv, setRdv] = useState<RendezVousParJeton | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [annulation, setAnnulation] = useState(false);
  const [annule, setAnnule] = useState(false);

  useEffect(() => {
    let vivant = true;
    rendezVousParJetonAPI.lire(jeton)
      .then((r) => { if (vivant) { setRdv(r); setAnnule(r.status === 'cancelled'); } })
      .catch((e: Error) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [jeton]);

  const annuler = async () => {
    setAnnulation(true);
    setErreur('');
    try {
      await rendezVousParJetonAPI.annuler(jeton);
      setAnnule(true);
      setConfirmation(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Annulation impossible');
    } finally {
      setAnnulation(false);
    }
  };

  if (chargement) {
    return <PageCarte isArabic={isArabic}><Chargement isArabic={isArabic} /></PageCarte>;
  }

  if (!rdv) {
    return (
      <PageCarte isArabic={isArabic}>
        <Entete icone="lienRompu" ton="sourdine" titre={isArabic ? 'رابط غير صالح' : 'Lien invalide ou expiré'} />
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'قد يكون الموعد أُلغي بالفعل، أو أن الرابط غير مكتمل. تحقّق من البريد الإلكتروني الذي استلمته.'
            : 'Le rendez-vous a peut-être déjà été annulé, ou le lien est incomplet. Vérifiez l’e-mail que vous avez reçu.'}
        </p>
        <Bouton onClick={onRetourAccueil}>{isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}</Bouton>
      </PageCarte>
    );
  }

  return (
    <PageCarte isArabic={isArabic}>
      <Entete
        icone={annule ? 'coche' : 'calendrier'}
        ton={annule ? 'sourdine' : 'accent'}
        titre={annule
          ? (isArabic ? 'أُلغي الموعد' : 'Rendez-vous annulé')
          : (isArabic ? 'موعدك' : 'Votre rendez-vous')}
      />

      <div className="mb-6">
        <CarteRdv
          praticien={rdv.doctor_name}
          specialite={rdv.specialty}
          date={rdv.appointment_date}
          heure={rdv.appointment_time}
          adresse={rdv.consultation_type !== 'video' ? `${rdv.address}, ${rdv.city}` : null}
          annulee={annule}
          isArabic={isArabic}
        />
      </div>

      {erreur && <Alerte>{erreur}</Alerte>}

      {annule ? (
        <>
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'تم تحرير الموعد. يمكنك حجز موعد آخر متى شئت.'
              : 'Le créneau a été libéré. Vous pouvez reprendre rendez-vous quand vous le souhaitez.'}
          </p>
          <Bouton onClick={onRetourAccueil}>
            {isArabic ? 'حجز موعد آخر' : 'Prendre un autre rendez-vous'}
          </Bouton>
        </>
      ) : confirmation ? (
        <>
          {/* On nomme la conséquence, pas la gravité : « définitif » informe,
              « attention » ne fait qu'alarmer. */}
          <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'هل تريد فعلاً إلغاء هذا الموعد؟ لا يمكن التراجع عن ذلك.'
              : 'Le créneau sera aussitôt rendu disponible, et cette action est définitive.'}
          </p>
          <div className="space-y-2.5">
            <Bouton variante="danger" onClick={annuler} disabled={annulation}>
              {annulation
                ? (isArabic ? 'جارٍ الإلغاء…' : 'Annulation…')
                : (isArabic ? 'نعم، ألغِ الموعد' : 'Oui, annuler ce rendez-vous')}
            </Bouton>
            <Bouton variante="contour" onClick={() => setConfirmation(false)} disabled={annulation}>
              {isArabic ? 'تراجع' : 'Non, je le garde'}
            </Bouton>
          </div>
        </>
      ) : (
        <>
          <Bouton variante="contour" onClick={() => setConfirmation(true)}>
            {isArabic ? 'إلغاء هذا الموعد' : 'Annuler ce rendez-vous'}
          </Bouton>
          <div className="mt-2.5">
            <Bouton variante="discret" onClick={onRetourAccueil}>
              {isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}
            </Bouton>
          </div>
        </>
      )}
    </PageCarte>
  );
}
