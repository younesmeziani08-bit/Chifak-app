import express from 'express';
import db from '../database.js';
import { authenticatePatientToken } from '../middleware/auth.js';

const router = express.Router();

// ==================== ASSISTANT SANTÉ (IA) ====================

// Configuration IA (modèle open-source via API compatible OpenAI, ex : Groq)
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const AI_API_KEY = process.env.AI_API_KEY || '';

const ASSISTANT_SYSTEM_PROMPT = `Tu es « l'Assistant Santé chifak », un assistant d'orientation médicale pour une plateforme de prise de rendez-vous en Algérie. Tu parles au patient avec bienveillance, clarté et simplicité.

Phrases courtes et simples. Pas de jargon médical compliqué.
(Les règles de langue figurent en fin de consigne : elles priment sur tout le reste.)

TON RÔLE — UN SEUL, ET RIEN D'AUTRE :
Identifier la spécialité à consulter, le plus vite possible, puis t'effacer.
1. Poser UNE question courte à la fois pour cerner le motif (où, depuis quand, intensité).
2. ORIENTER vers la spécialité la plus adaptée parmi cette liste UNIQUEMENT :
   Médecin généraliste, Dentiste, Ophtalmologue, Dermatologue, Cardiologue, Pédiatre, Gynécologue, ORL, Kinésithérapeute, Psychologue, Ostéopathe, Sage-femme.
   En cas de doute ou de symptômes généraux, oriente vers « Médecin généraliste ».
Tu ne donnes pas de conseils de santé spontanés, tu ne fais pas de pédagogie, tu n'expliques pas le fonctionnement du site.
Si le patient te pose une question hors de ce cadre, réponds en une phrase et reviens à l'orientation.

SÉCURITÉ — TRÈS IMPORTANT :
- Tu n'es PAS un médecin et tu ne poses JAMAIS de diagnostic définitif. Rappelle-le brièvement quand c'est utile.
- Ne prescris JAMAIS de médicament précis ni de dosage. Tu peux mentionner des mesures générales et conseiller de voir un médecin ou un pharmacien.
- URGENCES : si le patient décrit des signes graves (douleur thoracique intense, difficulté à respirer, signes d'AVC comme visage qui tombe/bras faible/parole troublée, saignement abondant, perte de conscience, douleur abdominale intense, pensées suicidaires, réaction allergique grave), tu DOIS lui dire d'appeler immédiatement les secours : Protection Civile 14 (ou 1021) et SAMU 115, ou de se rendre aux urgences les plus proches, SANS attendre un rendez-vous.
- Reste dans le domaine médical et de la santé. Si on te demande autre chose, ramène poliment vers ce sujet.

COMMENT PRENDRE RENDEZ-VOUS SUR CHIFAK (à expliquer si demandé) :
1. Sur la page d'accueil, choisir la spécialité et la wilaya dans la barre de recherche.
2. Parcourir la liste des médecins et en choisir un.
3. Sélectionner une date et un créneau horaire disponibles.
4. Remplir ses informations et confirmer. Une confirmation est envoyée par e-mail.

FORMAT — RÈGLE DE BRIÈVETÉ, STRICTE :
- UNE SEULE phrase par réponse. Deux au maximum, jamais plus.
- Une seule question à la fois. Jamais deux questions dans le même message.
- Pas de formule d'accueil répétée, pas de « j'espère que tu vas bien », pas de conclusion.
- Pas de conseils spontanés : le patient veut un rendez-vous, pas un cours.
- Objectif : orienter en 2 ou 3 échanges MAXIMUM, puis t'arrêter.

RÉPONSES PROPOSÉES (technique, obligatoire) :
Chaque fois que tu poses une question, termine par une dernière ligne au format exact :
[[OPTIONS:première réponse|deuxième réponse|troisième réponse]]
- De 2 à 4 options, séparées par le caractère « | ».
- Chaque option fait 1 à 4 mots, formulée à la première personne, telle que le patient la dirait.
- Les options doivent couvrir les cas les plus probables, et rester exclusives entre elles.
- Écris-les dans la langue de la conversation.
- Cette ligne est retirée avant affichage : ne l'annonce jamais, ne la commente jamais.
Exemple de réponse complète et correcte :
Depuis combien de temps avez-vous mal ?
[[OPTIONS:Depuis aujourd'hui|Quelques jours|Plus d'une semaine]]

MARQUEUR D'ORIENTATION (technique, très important) :
Dès que tu as assez d'éléments — au plus tard au 3e échange — termine ta réponse par une dernière ligne au format exact :
[[ORIENTATION:Nom de la spécialité]]
Le nom doit être copié à l'identique depuis la liste autorisée ci-dessus, sans traduction ni variante.
Cette ligne est retirée avant affichage : ne la commente pas, ne l'annonce pas, et n'en parle jamais au patient.
Quand tu émets ce marqueur, n'émets PAS d'options : la conversation est terminée, le patient passe à la réservation.
N'émets ce marqueur qu'une seule fois.
En cas d'urgence vitale, n'émets AUCUN marqueur : le patient doit appeler les secours, pas prendre rendez-vous.`;

/** Spécialités vers lesquelles l'assistant peut orienter. Toute valeur hors de
 *  cette liste est rejetée : le modèle ne décide pas seul du vocabulaire. */
const ORIENTATION_SPECIALTIES = [
  'Médecin généraliste', 'Dentiste', 'Ophtalmologue', 'Dermatologue',
  'Cardiologue', 'Pédiatre', 'Gynécologue', 'ORL', 'Kinésithérapeute',
  'Psychologue', 'Ostéopathe', 'Sage-femme',
];

/**
 * Consignes de langue. Elles sont placées EN DERNIER dans le prompt système et
 * sont les seules à parler de langue : le prompt de base n'en impose aucune,
 * sans quoi le modèle suivait cette consigne-là plutôt que le choix du patient.
 * La règle est exclusive et répétée, y compris pour les messages écrits dans
 * une autre langue que celle retenue.
 *
 * Deux langues seulement : français et arabe littéraire. Le dialecte algérien
 * a été retiré, et chaque consigne en interdit explicitement les tournures —
 * un modèle entraîné sur du contenu maghrébin y glisse sinon spontanément.
 */
const LANGUAGE_INSTRUCTIONS = {
  ar: `RÈGLE DE LANGUE — ABSOLUE, PRIME SUR TOUT LE RESTE :
Le patient a choisi l'ARABE LITTÉRAIRE (فصحى).
Réponds EXCLUSIVEMENT en arabe standard moderne, clair et accessible.
N'emploie AUCUNE tournure dialectale algérienne : ni « واش راك »، ni « وين »، ni « ماتخافش »، ni « كيفاش »، ni « شحال »، ni « برك ».
N'emploie pas le français, sauf pour un terme médical sans équivalent courant.
Même si le patient écrit en dialecte ou en français, tu réponds en arabe littéraire.`,

  fr: `RÈGLE DE LANGUE — ABSOLUE, PRIME SUR TOUT LE RESTE :
Le patient a choisi le FRANÇAIS.
Réponds EXCLUSIVEMENT en français, dans une langue simple, chaleureuse et vouvoyée.
N'écris AUCUN mot en arabe, pas même une salutation.
Même si le patient écrit en arabe ou en dialecte, tu réponds en français.`,
};

/**
 * Extrait le marqueur d'orientation d'une réponse du modèle.
 * Renvoie le texte nettoyé et, si elle est valide, la spécialité reconnue.
 * La comparaison est insensible à la casse et aux accents pour tolérer les
 * approximations du modèle, mais la valeur renvoyée est toujours celle de la
 * liste autorisée — jamais celle produite par le modèle.
 */
function extractOrientation(text) {
  const match = /\[\[\s*ORIENTATION\s*:\s*([^\]]+?)\s*\]\]/i.exec(text || '');
  const reply = (text || '').replace(/\[\[\s*ORIENTATION\s*:[^\]]*\]\]/gi, '').trim();
  if (!match) return { reply, orientation: null };

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const wanted = norm(match[1]);
  const found = ORIENTATION_SPECIALTIES.find((s) => norm(s) === wanted) || null;
  return { reply, orientation: found };
}

/**
 * Extrait les réponses rapides proposées par le modèle.
 * Renvoie le texte nettoyé et au plus quatre options courtes.
 * Les options sont bornées en nombre et en longueur : le modèle propose,
 * mais ne décide pas de la taille de ce qui s'affiche à l'écran.
 */
function extractOptions(text) {
  const match = /\[\[\s*OPTIONS\s*:\s*([^\]]+?)\s*\]\]/i.exec(text || '');
  const reply = (text || '').replace(/\[\[\s*OPTIONS\s*:[^\]]*\]\]/gi, '').trim();
  if (!match) return { reply, options: [] };

  const options = match[1]
    .split('|')
    .map((o) => o.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter((o) => o.length > 0)
    .slice(0, 4);

  return { reply, options };
}

// POST /api/assistant/chat - Dialogue avec l'assistant santé
// Réservé aux patients connectés : la conversation porte sur des symptômes,
// donc sur des données de santé. On ne les traite pas pour un visiteur anonyme.
router.post('/api/assistant/chat', authenticatePatientToken, async (req, res) => {
  try {
    const { messages, lang } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages requis' });
    }

    // Le français est le repli : c'est la langue par défaut de l'interface.
    const langKey = ['ar', 'fr'].includes(lang) ? lang : 'fr';

    if (!AI_API_KEY) {
      return res.status(503).json({
        error: 'assistant_non_configuré',
        reply: "L'assistant n'est pas encore configuré (clé API manquante). Veuillez réessayer plus tard.",
      });
    }

    // On ne garde que les 12 derniers échanges pour limiter la taille du contexte
    const trimmed = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    const payload = {
      model: AI_MODEL,
      messages: [
        // La consigne de langue est rappelée deux fois : en fin de prompt
        // système, puis en tout dernier message. Les modèles suivent mieux
        // les instructions proches de la fin du contexte.
        { role: 'system', content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${LANGUAGE_INSTRUCTIONS[langKey]}` },
        ...trimmed,
        { role: 'system', content: LANGUAGE_INSTRUCTIONS[langKey] },
      ],
      temperature: 0.3,
      // Plafond bas assumé : la consigne impose une à deux phrases. Un plafond
      // élevé laissait le modèle dériver vers de longs paragraphes.
      max_tokens: 220,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let aiRes;
    try {
      aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('Erreur API IA:', aiRes.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'Service IA indisponible', reply: "Désolé, je rencontre un problème technique. Réessayez dans un instant." });
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "Je n'ai pas de réponse pour le moment.";

    // Le marqueur est retiré du texte affiché et la spécialité est validée
    // contre la liste autorisée avant d'être renvoyée au client.
    // Les deux marqueurs sont retirés du texte affiché, dans cet ordre.
    const step1 = extractOrientation(raw);
    const step2 = extractOptions(step1.reply);

    // Une orientation clôt la conversation : on n'affiche plus d'options,
    // même si le modèle en a produit malgré la consigne.
    const options = step1.orientation ? [] : step2.options;

    // `lang` est renvoyé pour pouvoir vérifier, depuis l'onglet réseau du
    // navigateur, quelle consigne a réellement été appliquée. Si ce champ est
    // absent de la réponse, le backend déployé est une version antérieure.
    res.json({ reply: step2.reply, orientation: step1.orientation, options, lang: langKey });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Délai dépassé', reply: 'La réponse a mis trop de temps. Réessayez.' });
    }
    console.error('Erreur assistant:', error);
    res.status(500).json({ error: 'Erreur serveur', reply: 'Une erreur est survenue.' });
  }
});

export default router;
