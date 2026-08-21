/**
 * Rappels de rendez-vous envoyés la veille au soir.
 *
 * La base et la messagerie sont remplacées par des doublures ; le code
 * éprouvé est le vrai. Ce qui est vérifié ici n'est pas « le courrier
 * part » mais les deux propriétés qui font qu'on peut lancer la tâche sans
 * crainte :
 *
 *  — elle est REJOUABLE : un redémarrage, un déclenchement manuel après le
 *    passage automatique, deux instances derrière un répartiteur, et personne
 *    ne reçoit deux fois le même message ;
 *  — un échec d'envoi est RÉESSAYÉ : une panne de messagerie ne doit pas
 *    faire disparaître un rappel, sinon le patient ne saura jamais qu'il
 *    devait venir.
 */
import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.FRONTEND_URL = 'https://chifak.dz';
process.env.AGENDA_TIMEZONE = 'Africa/Algiers';

const DEMAIN = '2026-08-22';

/* ── Doublures ── */
const boite = [];
const reglage = { echouer: false };
const etat = { rendezVous: [], medecins: new Map(), lecturesMedecins: 0 };

mock.module('../database.js', {
  defaultExport: {
    prepare(sql) {
      return {
        all: async (...p) => {
          if (!/UPDATE appointments SET reminder_sent_at = CURRENT_TIMESTAMP/.test(sql)) return [];
          const [date, unSeul = null] = p;
          const forcer = !/reminder_sent_at IS NULL/.test(sql);
          const pris = etat.rendezVous.filter((r) => r.appointment_date === date
            && r.status !== 'cancelled'
            && (forcer || r.reminder_sent_at === null)
            && (unSeul === null || r.id === unSeul));
          for (const r of pris) r.reminder_sent_at = new Date().toISOString();
          return pris.map(({ status, appointment_date, ...reste }) => reste);
        },
        get: async (...p) => {
          if (!/FROM doctors WHERE id/.test(sql)) return undefined;
          etat.lecturesMedecins += 1;
          return etat.medecins.get(p[0]);
        },
        run: async (...p) => {
          if (/SET reminder_sent_at = NULL/.test(sql)) {
            const r = etat.rendezVous.find((x) => x.id === p[0]);
            if (r) r.reminder_sent_at = null;
          }
          return { changes: 1 };
        },
      };
    },
  },
});

mock.module('../emailService.js', {
  namedExports: {
    sendAppointmentReminder: async (email, details) => {
      if (reglage.echouer) return false;
      boite.push({ email, ...details });
      return true;
    },
  },
});

const { envoyerRappels } = await import('../rappels.js');

const MEDECINS = [
  [1, { id: 1, name: 'Dr Ahmed Benali', specialty: 'Cardiologue', address: '15 rue Didouche Mourad', city: 'Alger' }],
  [2, { id: 2, name: 'Dr Fatima Zahra', specialty: 'Pédiatre', address: '8 av. de l’Indépendance', city: 'Oran' }],
];

const rdv = (o) => ({
  doctor_id: 1, patient_email: `p${o.id}@ex.dz`, patient_name: 'Patient',
  appointment_date: DEMAIN, appointment_time: '09:00', status: 'confirmed',
  consultation_type: 'cabinet', child_first_name: null, child_last_name: null,
  language: 'fr', reminder_sent_at: null, ...o,
});

beforeEach(() => {
  boite.length = 0;
  reglage.echouer = false;
  etat.lecturesMedecins = 0;
  etat.medecins = new Map(MEDECINS);
  etat.rendezVous = [
    rdv({ id: 10, patient_name: 'Karim Benali', patient_email: 'karim@ex.dz' }),
    rdv({ id: 11, patient_name: 'Amina Saïdi', patient_email: 'amina@ex.dz', appointment_time: '09:30', consultation_type: 'video', language: 'ar' }),
    rdv({ id: 12, doctor_id: 2, patient_name: 'Yacine Haddad', patient_email: 'yacine@ex.dz', appointment_time: '10:00', child_first_name: 'Sofiane', child_last_name: 'Haddad' }),
    rdv({ id: 13, patient_email: 'annule@ex.dz', status: 'cancelled' }),
    rdv({ id: 14, patient_email: null }),
    rdv({ id: 15, patient_email: 'plus.tard@ex.dz', appointment_date: '2026-08-23' }),
  ];
});

describe('Sélection', () => {
  test('rappelle les rendez-vous du lendemain, et eux seuls', async () => {
    const r = await envoyerRappels({ date: DEMAIN });
    assert.equal(r.envoyes, 3, JSON.stringify(r));
    assert.ok(!boite.some((m) => m.email === 'annule@ex.dz'), 'un rendez-vous annulé ferait revenir pour rien');
    assert.ok(!boite.some((m) => m.email === 'plus.tard@ex.dz'));
  });

  test('un patient sans adresse est ignoré, pas compté comme envoyé', async () => {
    const r = await envoyerRappels({ date: DEMAIN });
    assert.equal(r.ignores, 1);
  });

  test('une seule lecture par praticien, pas une par rendez-vous', async () => {
    await envoyerRappels({ date: DEMAIN });
    assert.equal(etat.lecturesMedecins, 2, 'vingt rendez-vous chez le même médecin, une seule fiche');
  });

  test('une journée vide ne produit ni envoi ni erreur', async () => {
    const r = await envoyerRappels({ date: '2030-01-01' });
    assert.equal(r.envoyes, 0);
    assert.equal(boite.length, 0);
  });
});

describe('Contenu transmis au courrier', () => {
  test('le praticien, sa spécialité et son adresse', async () => {
    await envoyerRappels({ date: DEMAIN });
    const m = boite.find((x) => x.email === 'karim@ex.dz');
    assert.equal(m.doctorName, 'Dr Ahmed Benali');
    assert.equal(m.specialty, 'Cardiologue');
    assert.equal(m.address, '15 rue Didouche Mourad, Alger');
    assert.equal(m.time, '09:00');
  });

  test('la langue choisie à la réservation est respectée', async () => {
    await envoyerRappels({ date: DEMAIN });
    assert.equal(boite.find((x) => x.email === 'karim@ex.dz').language, 'fr');
    assert.equal(boite.find((x) => x.email === 'amina@ex.dz').language, 'ar',
      'un rappel en français à quelqu\'un qui a réservé en arabe');
  });

  test('le nom de l\'enfant accompagne le rendez-vous du parent', async () => {
    await envoyerRappels({ date: DEMAIN });
    const m = boite.find((x) => x.email === 'yacine@ex.dz');
    assert.equal(m.childName, 'Sofiane Haddad', 'sans lui, le parent se présente seul');
    assert.equal(m.patientName, 'Yacine Haddad');
  });

  test('le mode de consultation est transmis', async () => {
    await envoyerRappels({ date: DEMAIN });
    assert.equal(boite.find((x) => x.email === 'amina@ex.dz').consultationType, 'video');
  });
});

describe('Idempotence', () => {
  test('trois passages successifs n\'envoient qu\'une fois', async () => {
    await envoyerRappels({ date: DEMAIN });
    assert.equal(boite.length, 3);
    await envoyerRappels({ date: DEMAIN });
    await envoyerRappels({ date: DEMAIN });
    assert.equal(boite.length, 3, 'un patient qui reçoit trois fois le même rappel cesse de les lire');
  });

  test('« forcer » permet un renvoi volontaire', async () => {
    await envoyerRappels({ date: DEMAIN });
    const r = await envoyerRappels({ date: DEMAIN, forcer: true });
    assert.equal(r.envoyes, 3);
  });

  test('un seul rendez-vous peut être visé', async () => {
    const r = await envoyerRappels({ date: DEMAIN, appointmentId: 11 });
    assert.equal(r.envoyes, 1);
    assert.equal(boite[0].email, 'amina@ex.dz');
  });
});

describe('Panne de messagerie', () => {
  test('rien ne part, et la marque est RETIRÉE pour un réessai', async () => {
    reglage.echouer = true;
    const r = await envoyerRappels({ date: DEMAIN });
    assert.equal(r.envoyes, 0);
    assert.equal(r.echecs, 3);
    for (const id of [10, 11, 12]) {
      const ligne = etat.rendezVous.find((x) => x.id === id);
      assert.equal(ligne.reminder_sent_at, null,
        `rdv ${id} resté marqué : le rappel serait perdu à jamais`);
    }
  });

  test('le passage suivant rattrape, puis n\'insiste pas', async () => {
    reglage.echouer = true;
    await envoyerRappels({ date: DEMAIN });
    reglage.echouer = false;
    assert.equal((await envoyerRappels({ date: DEMAIN })).envoyes, 3);
    assert.equal((await envoyerRappels({ date: DEMAIN })).envoyes, 0);
    assert.equal(boite.length, 3);
  });
});
