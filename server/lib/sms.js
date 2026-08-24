/**
 * Envoi de SMS — le canal qui manquait.
 *
 * ── Pourquoi ──
 *
 * Tout passait par l'e-mail : vérification de compte, confirmation, rappel de
 * la veille, agenda du praticien. En Algérie, le SMS porte bien plus loin que
 * l'e-mail. Or le rappel de la veille est précisément ce qui décide si
 * quelqu'un se déplace ; envoyé sur un canal que le public consulte peu, il ne
 * sert à rien.
 *
 * Le téléphone est déjà collecté à l'inscription et obligatoire à la
 * réservation : la matière était là, le canal manquait.
 *
 * ── Ce que ce module fait, et ne fait pas ──
 *
 * Il parle à un fournisseur par une requête HTTP décrite ENTIÈREMENT par des
 * variables d'environnement. Aucun fournisseur n'est codé en dur : les
 * agrégateurs algériens, Twilio et les passerelles génériques exposent tous
 * une API HTTP, et figer l'un d'eux ici obligerait à toucher au code pour en
 * changer.
 *
 * Il est ÉTEINT tant que SMS_URL n'est pas renseignée, et il ne lève jamais.
 * Un SMS qui ne part pas ne doit jamais empêcher un rendez-vous d'être pris ni
 * un e-mail de partir : le SMS complète l'e-mail, il ne le remplace pas.
 *
 * ── Configuration ──
 *
 *   SMS_URL        adresse du fournisseur (son absence désactive tout)
 *   SMS_METHOD     POST par défaut
 *   SMS_AUTH       valeur de l'en-tête Authorization, si le fournisseur en veut
 *   SMS_HEADERS    en-têtes supplémentaires, en JSON
 *   SMS_BODY       gabarit du corps, avec {{to}} et {{text}}
 *   SMS_SENDER     nom ou numéro d'expéditeur, disponible en {{from}}
 *   SMS_CONTENT_TYPE  application/json par défaut
 *
 * Exemple pour une passerelle JSON :
 *   SMS_URL=https://api.exemple.dz/v1/sms
 *   SMS_AUTH=Bearer xxxxx
 *   SMS_BODY={"to":"{{to}}","from":"{{from}}","message":"{{text}}"}
 */
import '../env.js';

/**
 * Mode d'essai : le SMS est imprimé dans la console au lieu d'être remis.
 *
 *     SMS_PROVIDER=console
 *
 * Aucune passerelle SMS ne s'essaie gratuitement : toutes réclament une
 * inscription, une pièce d'identité, et souvent un numéro pré-vérifié — ce qui
 * interdit précisément d'éprouver l'envoi vers le numéro d'un patient.
 *
 * Ce mode répond à la question qu'on se pose vraiment en développement : le
 * bon texte part-il, au bon numéro, au bon moment ? La remise, elle, ne se
 * vérifie qu'avec une vraie passerelle.
 */
export function smsEnConsole() {
  return String(process.env.SMS_PROVIDER || '').trim().toLowerCase() === 'console';
}

/** Le canal est-il configuré ? Lu aussi par le diagnostic de démarrage. */
export function smsConfigure() {
  return smsEnConsole() || Boolean(process.env.SMS_URL && process.env.SMS_URL.trim());
}

/**
 * Met un numéro algérien au format international.
 *
 * Les numéros sont saisis « 0555 12 34 56 » ; presque toutes les passerelles
 * exigent « +213555123456 ». Sans cette conversion, les envois échouent un par
 * un sans que personne ne comprenne pourquoi.
 *
 * Un numéro déjà international est laissé tel quel : rien n'oblige un patient
 * à avoir un numéro algérien.
 */
export function normaliserNumero(brut) {
  if (typeof brut !== 'string') return null;
  const nettoye = brut.replace(/[\s().-]/g, '');
  if (!nettoye) return null;

  if (nettoye.startsWith('+')) {
    return /^\+\d{8,15}$/.test(nettoye) ? nettoye : null;
  }
  // 00213… → +213…
  if (nettoye.startsWith('00')) {
    const international = `+${nettoye.slice(2)}`;
    return /^\+\d{8,15}$/.test(international) ? international : null;
  }
  // 0555… → +213555…  (l'indicatif national remplace le zéro de tête)
  if (nettoye.startsWith('0')) {
    const indicatif = process.env.SMS_COUNTRY_CODE || '+213';
    const international = `${indicatif}${nettoye.slice(1)}`;
    return /^\+\d{8,15}$/.test(international) ? international : null;
  }
  // Numéro sans zéro de tête ni indicatif : on ne devine pas.
  return null;
}

/** Remplace {{to}}, {{from}} et {{text}} dans un gabarit, en échappant le JSON. */
function remplir(gabarit, { to, from, text }) {
  const pourJson = (v) => JSON.stringify(String(v)).slice(1, -1);
  return gabarit
    .replace(/\{\{to\}\}/g, pourJson(to))
    .replace(/\{\{from\}\}/g, pourJson(from))
    .replace(/\{\{text\}\}/g, pourJson(text));
}

/**
 * Envoie un SMS. Rend true si le fournisseur a accepté, false sinon.
 *
 * Ne lève JAMAIS : tous les appelants s'en servent en complément d'un e-mail
 * déjà parti, et l'échec d'un canal secondaire ne doit pas faire échouer
 * l'opération principale.
 */
export async function envoyerSms(numero, texte) {
  if (!smsConfigure()) return false;

  const to = normaliserNumero(numero);
  if (!to) {
    console.warn('SMS non envoyé : numéro inexploitable.');
    return false;
  }

  /* Les passerelles facturent au segment de 160 caractères et tronquent
     au-delà d'une certaine longueur. On coupe nous-mêmes plutôt que de
     laisser le fournisseur décider où la phrase s'arrête. */
  const text = String(texte).replace(/\s+/g, ' ').trim().slice(0, 320);
  const from = process.env.SMS_SENDER || 'chifak';

  /* Après la normalisation du numéro et la troncature : on imprime exactement
     ce qui serait parti, segments compris. */
  if (smsEnConsole()) {
    const segments = Math.ceil(text.length / 160) || 1;
    console.log(`\n📱  SMS (mode console — rien n'est remis)`);
    console.log(`    de           : ${from}`);
    console.log(`    à            : ${to}`);
    console.log(`    ${text.length} caractères, ${segments} segment${segments > 1 ? 's' : ''}`);
    console.log(`    ${text}\n`);
    return true;
  }

  const gabarit = process.env.SMS_BODY
    || '{"to":"{{to}}","from":"{{from}}","message":"{{text}}"}';

  let entetes = { 'Content-Type': process.env.SMS_CONTENT_TYPE || 'application/json' };
  if (process.env.SMS_AUTH) entetes.Authorization = process.env.SMS_AUTH;
  if (process.env.SMS_HEADERS) {
    try {
      entetes = { ...entetes, ...JSON.parse(process.env.SMS_HEADERS) };
    } catch {
      console.warn('SMS_HEADERS n\'est pas du JSON valide : ignoré.');
    }
  }

  /* Délai de garde : sans lui, une passerelle qui ne répond pas retiendrait la
     tâche des rappels indéfiniment, et les patients suivants ne recevraient
     rien du tout. */
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 15000);

  try {
    const reponse = await fetch(process.env.SMS_URL, {
      method: process.env.SMS_METHOD || 'POST',
      headers: entetes,
      body: remplir(gabarit, { to, from, text }),
      signal: controleur.signal,
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '');
      console.error(`❌ SMS refusé (${reponse.status}) :`, detail.slice(0, 200));
      return false;
    }
    console.log(`✅ SMS envoyé à ${to}`);
    return true;
  } catch (e) {
    console.error('❌ Envoi SMS impossible :', e.name === 'AbortError' ? 'délai dépassé' : e.message);
    return false;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Rappel de la veille, en SMS.
 *
 * Court par construction : un SMS se lit d'un coup d'œil sur un écran
 * verrouillé, et chaque segment de 160 caractères se paie. On garde ce qui
 * fait venir quelqu'un — qui, quand, où — et rien d'autre.
 */
export function texteRappel({ patientName, doctorName, date, heure, visio, langue = 'fr' }) {
  const prenom = String(patientName || '').split(' ')[0];
  if (langue === 'ar') {
    return visio
      ? `${prenom}، تذكير: موعد بالفيديو مع ${doctorName} غدًا ${date} على ${heure}. chifak`
      : `${prenom}، تذكير: موعدك مع ${doctorName} غدًا ${date} على ${heure}. chifak`;
  }
  return visio
    ? `${prenom}, rappel : téléconsultation avec ${doctorName} demain ${date} à ${heure}. chifak`
    : `${prenom}, rappel : rendez-vous avec ${doctorName} demain ${date} à ${heure}. chifak`;
}

/**
 * Une place s'est libérée — en SMS.
 *
 * Deux heures pour répondre, c'est court. Sur un canal que le public consulte
 * peu, la place expirerait avant d'avoir été lue : le SMS double donc le
 * courrier chaque fois qu'il est configuré.
 *
 * Le délai figure en toutes lettres. C'est la seule information qui, mal
 * comprise, fait perdre la place.
 */
export function texteCreneauLibere({ patientName, doctorName, date, heure, heures = 2, langue = 'fr' }) {
  const prenom = String(patientName || '').split(' ')[0];
  if (langue === 'ar') {
    return `${prenom}، تحرّر موعد عند ${doctorName}: ${date} على ${heure}. محجوز لك ${heures} ساعتين. أكّده من البريد الإلكتروني. chifak`;
  }
  return `${prenom}, une place s'est liberee chez ${doctorName} : ${date} a ${heure}. Reservee ${heures}h pour vous. Confirmez depuis votre e-mail. chifak`;
}
