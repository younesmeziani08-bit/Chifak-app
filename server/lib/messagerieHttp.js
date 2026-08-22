/**
 * Envoi des courriers par l'API HTTP d'un fournisseur, plutôt que par SMTP.
 *
 * ── Pourquoi cette voie existe ──
 *
 * Le service n'envoyait ses courriers que par SMTP, et en pratique par Gmail.
 * Deux problèmes s'accumulaient :
 *
 *   · Gmail plafonne à quelques centaines d'envois par jour et coupe les
 *     envois automatiques qu'il juge suspects. Un service de rendez-vous
 *     médicaux en envoie un à chaque inscription, chaque réservation, chaque
 *     rappel de la veille et chaque agenda de praticien — le plafond arrive
 *     vite, et il arrive sans prévenir ;
 *   · certains hébergements bloquent les ports SMTP sortants (587, 465). Quand
 *     c'est le cas, aucun réglage SMTP ne peut fonctionner, quel que soit le
 *     fournisseur.
 *
 * L'API HTTP répond aux deux : elle passe par le port 443, comme n'importe
 * quelle requête web, et les fournisseurs transactionnels sont faits pour ce
 * volume.
 *
 * ── Comment on la choisit ──
 *
 * Une seule variable : EMAIL_PROVIDER. Le reste est connu du code.
 *
 *   EMAIL_PROVIDER=brevo    + EMAIL_API_KEY=xkeysib-…
 *   EMAIL_PROVIDER=resend   + EMAIL_API_KEY=re_…
 *   EMAIL_PROVIDER=smtp     (ou variable absente) → voie SMTP habituelle
 *
 * Un gabarit générique aurait été plus souple, mais il aurait demandé à
 * l'exploitant de connaître la forme exacte du corps JSON de son fournisseur.
 * Deux noms à retenir valent mieux que cinq variables à composer sans se
 * tromper : c'est cette configuration-là qui n'a jamais été faite, et qui
 * empêchait toute inscription.
 */
import '../env.js';

/**
 * Découpe « "chifak" <no-reply@chifak.dz> » en nom et adresse.
 *
 * Les API attendent les deux séparément, là où SMTP accepte la forme
 * combinée. Sans ce découpage, le nom d'affichage part dans le champ adresse
 * et le fournisseur rejette l'envoi.
 */
export function decouperExpediteur(brut) {
  const valeur = String(brut || '').trim();
  const avecNom = /^"?([^"<]*)"?\s*<([^>]+)>$/.exec(valeur);
  if (avecNom) {
    return { name: avecNom[1].trim() || 'chifak', email: avecNom[2].trim() };
  }
  return { name: 'chifak', email: valeur };
}

/**
 * Les fournisseurs pris en charge.
 *
 * Chacun décrit son adresse, ses en-têtes et la forme de son corps. Ajouter un
 * fournisseur revient à ajouter une entrée ici — pas à toucher au reste.
 */
const FOURNISSEURS = {
  brevo: {
    nom: 'Brevo',
    url: 'https://api.brevo.com/v3/smtp/email',
    entetes: (cle) => ({ 'api-key': cle, 'Content-Type': 'application/json', accept: 'application/json' }),
    corps: ({ expediteur, destinataire, sujet, html }) => ({
      sender: { name: expediteur.name, email: expediteur.email },
      to: [{ email: destinataire }],
      subject: sujet,
      htmlContent: html,
    }),
  },
  resend: {
    nom: 'Resend',
    url: 'https://api.resend.com/emails',
    entetes: (cle) => ({ Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' }),
    corps: ({ expediteur, destinataire, sujet, html }) => ({
      from: `${expediteur.name} <${expediteur.email}>`,
      to: [destinataire],
      subject: sujet,
      html,
    }),
  },
};

/** Le fournisseur choisi, ou null si l'on reste en SMTP. */
export function fournisseurHttp() {
  const choisi = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (!choisi || choisi === 'smtp') return null;
  const f = FOURNISSEURS[choisi];
  if (!f) {
    console.warn(
      `⚠️  EMAIL_PROVIDER="${choisi}" est inconnu. Valeurs acceptées : `
      + `${Object.keys(FOURNISSEURS).join(', ')}, smtp. On repart en SMTP.`,
    );
    return null;
  }
  if (!process.env.EMAIL_API_KEY) {
    console.warn(`⚠️  EMAIL_PROVIDER=${choisi} sans EMAIL_API_KEY. On repart en SMTP.`);
    return null;
  }
  return { cle: choisi, ...f };
}

/** L'envoi par API est-il configuré et utilisable ? */
export function messagerieHttpConfiguree() {
  return fournisseurHttp() !== null;
}

/**
 * Envoie un courrier par l'API du fournisseur.
 *
 * Même contrat que la voie SMTP : ne lève jamais, rend true si le fournisseur
 * a accepté le message. L'appelant décide s'il poursuit — une inscription
 * refuse de créer le compte, un rappel se réessaiera au passage suivant.
 */
export async function envoyerParHttp(destinataire, { subject, html }) {
  const f = fournisseurHttp();
  if (!f) return false;

  const expediteur = decouperExpediteur(
    process.env.EMAIL_FROM || `"chifak" <${process.env.EMAIL_USER || 'no-reply@chifak.dz'}>`,
  );

  /* Délai de garde : sans lui, un fournisseur qui ne répond pas retiendrait la
     tâche des rappels indéfiniment, et les patients suivants ne recevraient
     rien du tout. */
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 20000);

  try {
    const reponse = await fetch(f.url, {
      method: 'POST',
      headers: f.entetes(process.env.EMAIL_API_KEY),
      body: JSON.stringify(f.corps({ expediteur, destinataire, sujet: subject, html })),
      signal: controleur.signal,
    });

    if (!reponse.ok) {
      /* Le détail du refus est journalisé : c'est presque toujours lui qui
         explique la panne — expéditeur non validé, clé révoquée, quota
         atteint. Sans lui, on ne voit qu'un « envoi impossible » muet. */
      const detail = await reponse.text().catch(() => '');
      console.error(
        `❌ ${f.nom} a refusé « ${subject} » pour ${destinataire} `
        + `(HTTP ${reponse.status}) : ${detail.slice(0, 300)}`,
      );
      return false;
    }

    console.log(`✅ « ${subject} » envoyé à ${destinataire} via ${f.nom}`);
    return true;
  } catch (e) {
    console.error(
      `❌ Envoi via ${f.nom} impossible :`,
      e.name === 'AbortError' ? 'délai dépassé' : e.message,
    );
    return false;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Les noms acceptés par EMAIL_PROVIDER — lu par le diagnostic de démarrage. */
export const FOURNISSEURS_CONNUS = Object.keys(FOURNISSEURS);
