/**
 * Liste d'attente : prévenir quelqu'un quand un créneau se libère.
 *
 * ── Ce qui se passait ──
 *
 * Un patient annulait, et le créneau retournait silencieusement dans le tas.
 * Personne n'était prévenu. C'est pourtant le créneau le plus précieux du
 * service : il se libère à trois jours, chez un praticien complet pour trois
 * semaines, et il repart sans que celui qui l'attendait le sache. Le patient,
 * lui, avait lu « complet » une fois et n'était jamais revenu.
 *
 * ── Prévenir ne suffit pas : il faut retenir ──
 *
 * Envoyer « un créneau s'est libéré » sans rien retenir serait cruel. La
 * personne reçoit le courrier, arrive vingt minutes plus tard, et le créneau
 * est déjà repris par quelqu'un qui passait par là. Elle aurait mieux valu ne
 * rien savoir.
 *
 * On crée donc un rendez-vous à l'état « hold » : il occupe réellement le
 * créneau, mais n'est pas confirmé. Le contrôle d'occupation partout ailleurs
 * s'écrit « status <> cancelled » — un « hold » compte donc comme pris sans
 * qu'aucune requête ait eu besoin d'être modifiée, et l'index unique du
 * créneau le protège comme les autres.
 *
 * Deux heures pour répondre. Passé ce délai, une tâche libère le créneau et
 * passe au suivant : une file qui s'arrête au premier qui ne lit pas ses
 * courriers ne sert à rien.
 */
import crypto from 'node:crypto';
import db from '../database.js';
import { envoyerCourrier } from '../emailService.js';
import { courrierCreneauLibere } from './courriers.js';
import { envoyerSms, texteCreneauLibere, smsConfigure } from './sms.js';

/** Combien de temps le créneau reste retenu pour la personne prévenue. */
export const HEURES_DE_REPONSE = 2;

/**
 * Au-delà de cet horizon, on ne dérange personne.
 *
 * Un créneau qui se libère dans quatre mois n'intéresse pas quelqu'un qui
 * attendait un désistement : il cherchait plus tôt, pas plus tard. Le
 * prévenir dresserait la liste d'attente contre elle-même — les gens s'en
 * retireraient pour ne plus recevoir de courriers sans objet.
 */
const HORIZON_JOURS = 30;

const adresseFront = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * Un créneau vient de se libérer chez ce praticien : prévenir le premier de
 * la file, et lui retenir la place.
 *
 * Ne lève jamais : elle est appelée juste après une annulation, et l'échec de
 * la liste d'attente ne doit pas faire échouer l'annulation elle-même — le
 * patient qui se décommande a le droit de partir même si personne ne reprend
 * sa place.
 *
 * @returns l'inscrit prévenu, ou null si personne ne l'a été.
 */
export async function prevenirSuivant({ doctorId, date, heure, consultationType = 'cabinet', exclure = null }) {
  try {
    // Trop loin : voir HORIZON_JOURS.
    const limite = new Date(Date.now() + HORIZON_JOURS * 86400000).toISOString().slice(0, 10);
    if (date > limite) return null;

    // Un créneau déjà passé n'intéresse personne.
    if (date < new Date().toISOString().slice(0, 10)) return null;

    /* Le premier arrivé, et lui seul. `FOR UPDATE SKIP LOCKED` : deux
       annulations simultanées chez le même praticien ne doivent pas prévenir
       deux fois la même personne pour deux créneaux différents. */
    /* `exclure` écarte quelqu'un de CE tour, sans le sortir de la file.
       Sans lui, celui qui vient de refuser un créneau se le voyait aussitôt
       reproposer : il est le plus ancien de la file, donc le premier repêché.
       Le remettre en queue de file aurait été injuste — quelqu'un qui ne peut
       pas le matin déclinerait tous les créneaux du matin et finirait par ne
       plus jamais rien recevoir. Il garde donc sa place, ce tour-ci lui passe
       simplement devant. */
    const suivant = await db.prepare(`
      UPDATE liste_attente SET statut = 'notified', notifie_le = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id FROM liste_attente
        WHERE doctor_id = ? AND statut = 'waiting'
          /* Le type est écrit explicitement : PostgreSQL ne peut pas le
             deviner d'un paramètre comparé à NULL, et rejetait la requête
             entière avec « could not determine data type of parameter ». */
          AND (?::int IS NULL OR id <> ?::int)
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, patient_name, patient_email, patient_phone, language, jeton
    `).get(doctorId, exclure, exclure);

    if (!suivant) return null;

    const medecin = await db.prepare(
      'SELECT id, name, specialty, address, city FROM doctors WHERE id = ?',
    ).get(doctorId);
    if (!medecin) return null;

    /* Le créneau est retenu par un vrai rendez-vous, à l'état « hold ». S'il
       vient d'être repris entre-temps, l'index unique refuse l'insertion : on
       remet alors la personne en attente, sans lui écrire. Mieux vaut un tour
       manqué qu'un courrier annonçant un créneau qui n'existe plus. */
    const jetonHold = crypto.randomBytes(24).toString('base64url');
    let rendezVous;
    try {
      rendezVous = await db.prepare(`
        INSERT INTO appointments
          (doctor_id, patient_name, patient_email, patient_phone,
           appointment_date, appointment_time, consultation_type, language,
           status, hold_expire_le, hold_jeton)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'hold',
                NOW() + INTERVAL '${HEURES_DE_REPONSE} hours', ?)
        RETURNING id
      `).get(
        doctorId, suivant.patient_name, suivant.patient_email, suivant.patient_phone,
        date, heure, consultationType, suivant.language === 'ar' ? 'ar' : 'fr', jetonHold,
      );
    } catch (e) {
      if (e?.code === '23505') {
        await db.prepare("UPDATE liste_attente SET statut = 'waiting', notifie_le = NULL WHERE id = ?")
          .run(suivant.id);
        return null;
      }
      throw e;
    }

    await db.prepare('UPDATE liste_attente SET appointment_id = ? WHERE id = ?')
      .run(rendezVous.id, suivant.id);

    const lien = `${adresseFront()}/place/${jetonHold}`;
    const langue = suivant.language === 'ar' ? 'ar' : 'fr';

    await envoyerCourrier(suivant.patient_email, courrierCreneauLibere({
      patientName: suivant.patient_name,
      doctorName: medecin.name,
      date,
      heure,
      lien,
      heuresDeReponse: HEURES_DE_REPONSE,
      langue,
    }));

    /* Le SMS double le courrier quand il est configuré. Deux heures pour
       répondre, c'est court : sur un canal que le public consulte peu, la
       place expirerait avant d'avoir été lue. */
    if (smsConfigure() && suivant.patient_phone) {
      await envoyerSms(suivant.patient_phone, texteCreneauLibere({
        patientName: suivant.patient_name,
        doctorName: medecin.name,
        date,
        heure,
        heures: HEURES_DE_REPONSE,
        langue,
      }));
    }

    console.log(`📣 Créneau ${date} ${heure} proposé à ${suivant.patient_email} (${HEURES_DE_REPONSE} h pour répondre)`);
    return { id: suivant.id, email: suivant.patient_email, appointmentId: rendezVous.id };
  } catch (e) {
    console.error('Liste d\'attente — impossible de prévenir le suivant :', e.message);
    return null;
  }
}

/**
 * Libère les créneaux retenus dont le délai est écoulé, et passe au suivant.
 *
 * Appelée par une tâche régulière. Sans elle, un créneau resterait bloqué
 * indéfiniment sur quelqu'un qui n'a jamais ouvert son courrier — le pire des
 * deux mondes : ni pour lui, ni pour personne.
 */
export async function libererLesPlacesExpirees() {
  const resume = { liberes: 0, reproposes: 0 };

  try {
    /* Un seul ordre sélectionne et annule : deux exécutions simultanées de la
       tâche ne doivent pas traiter la même place deux fois. */
    const expirees = await db.prepare(`
      UPDATE appointments
      SET status = 'cancelled', hold_expire_le = NULL, hold_jeton = NULL,
          cancelled_by = 'systeme', cancel_reason = 'Place non confirmée à temps'
      WHERE id IN (
        SELECT id FROM appointments
        WHERE status = 'hold' AND hold_expire_le < NOW()
        LIMIT 200
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, doctor_id, appointment_date, appointment_time, consultation_type
    `).all();

    for (const place of expirees) {
      resume.liberes += 1;

      // Celui qui n'a pas répondu quitte la file : il a eu son tour.
      await db.prepare("UPDATE liste_attente SET statut = 'parti' WHERE appointment_id = ? AND statut = 'notified'")
        .run(place.id);

      const suivant = await prevenirSuivant({
        doctorId: place.doctor_id,
        date: place.appointment_date,
        heure: place.appointment_time,
        consultationType: place.consultation_type || 'cabinet',
      });
      if (suivant) resume.reproposes += 1;
    }

    if (resume.liberes) {
      console.log(`⏳ ${resume.liberes} place(s) expirée(s), ${resume.reproposes} reproposée(s)`);
    }
  } catch (e) {
    console.error('Expiration des places retenues impossible :', e.message);
  }

  return resume;
}
