/**
 * Comparaison de visages, entièrement dans le navigateur.
 *
 * PRINCIPE ABSOLU : aucune image, aucune vidéo, aucun gabarit biométrique ne
 * quitte l'appareil du praticien. Les modèles sont téléchargés vers lui, pas
 * ses données vers nous. Le serveur ne reçoit qu'un verdict et un score.
 *
 * Ce que la comparaison fait réellement : chaque visage est transformé en un
 * vecteur de quelques centaines de nombres. Deux photos de la même personne
 * donnent des vecteurs proches. On mesure cette proximité et on la compare à
 * un seuil. Il n'y a ni reconnaissance ni identification — seulement une
 * distance entre deux images fournies au même instant par la même personne.
 *
 * Ce que la comparaison NE fait PAS :
 * — elle ne prouve rien au serveur, puisqu'elle s'exécute chez l'utilisateur ;
 * — elle n'atteste aucune qualification médicale ;
 * — elle se trompe, dans les deux sens, et d'autant plus que la photo d'une
 *   carte d'identité est petite, imprimée et parfois ancienne.
 */

/** Modèle chargé une seule fois pour toute la session. */
let instance: any = null;
let chargement: Promise<any> | null = null;

/**
 * Seuil de similarité.
 *
 * Réglé volontairement bas : sur une photo de carte d'identité — petite,
 * tramée, souvent prise il y a dix ans — un seuil sévère rejetterait
 * massivement de vrais praticiens. Le prix de cette tolérance est assumé :
 * ce contrôle filtre, il ne tranche pas. C'est l'administration qui décide.
 */
export const SEUIL_SIMILARITE = 0.45;

/** Score minimal de vivacité : en dessous, on soupçonne une photo de photo. */
export const SEUIL_VIVACITE = 0.6;

export interface Empreinte {
  vecteur: number[];
  /** Confiance de la détection du visage lui-même. */
  confiance: number;
  /** Vivacité estimée, absente sur une image de carte (c'est normal). */
  vivacite?: number;
  /** Probabilité que l'image soit un écran ou une impression. */
  factice?: number;
}

async function charger() {
  if (instance) return instance;
  if (chargement) return chargement;

  chargement = (async () => {
    /* Import différé : les modèles pèsent plusieurs mégaoctets. Sur une
       connexion mobile algérienne, les charger au démarrage de la page ferait
       payer ce poids à tous les visiteurs — dont l'immense majorité ne
       verront jamais cet écran. */
    const { Human } = await import('@vladmandic/human');

    const human = new Human({
      backend: 'webgl',
      modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human-models/models/',
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 1, minConfidence: 0.3 },
        mesh: { enabled: true },
        description: { enabled: true },   // le vecteur d'empreinte
        antispoof: { enabled: true },     // écran ou impression
        liveness: { enabled: true },      // présence réelle
        iris: { enabled: false },
        emotion: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      filter: { enabled: true, equalization: true },
    });

    await human.load();
    await human.warmup();
    instance = human;
    return human;
  })();

  return chargement;
}

/** Précharge les modèles pendant que l'utilisateur lit les explications. */
export function prechargerModeles() {
  charger().catch(() => { /* l'échec sera signalé au moment de l'usage */ });
}

/**
 * Extrait l'empreinte du visage présent dans une image.
 * Renvoie null si aucun visage n'est trouvé, ou s'il l'est trop faiblement.
 */
export async function extraireEmpreinte(
  source: HTMLVideoElement | HTMLCanvasElement,
): Promise<Empreinte | null> {
  const human = await charger();
  const resultat = await human.detect(source);
  const visage = resultat.face?.[0];

  if (!visage || !visage.embedding || visage.embedding.length === 0) return null;

  return {
    vecteur: Array.from(visage.embedding as number[]),
    confiance: visage.faceScore ?? visage.score ?? 0,
    vivacite: typeof visage.live === 'number' ? visage.live : undefined,
    factice: typeof visage.real === 'number' ? 1 - visage.real : undefined,
  };
}

/**
 * Similarité entre deux empreintes, de 0 à 1.
 * Distance cosinus : deux vecteurs pointant dans la même direction donnent 1.
 */
export function similarite(a: Empreinte, b: Empreinte): number {
  const u = a.vecteur;
  const v = b.vecteur;
  if (u.length !== v.length || u.length === 0) return 0;

  let produit = 0;
  let normeU = 0;
  let normeV = 0;
  for (let i = 0; i < u.length; i += 1) {
    produit += u[i] * v[i];
    normeU += u[i] * u[i];
    normeV += v[i] * v[i];
  }
  if (normeU === 0 || normeV === 0) return 0;

  const cos = produit / (Math.sqrt(normeU) * Math.sqrt(normeV));
  // La distance cosinus va de -1 à 1 ; on la ramène sur 0 à 1.
  return Math.max(0, Math.min(1, (cos + 1) / 2));
}

/** Capture l'image courante d'un flux vidéo, sans jamais l'écrire sur disque. */
export function capturerImage(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0);
  return canvas;
}

/**
 * Efface une empreinte de la mémoire.
 *
 * Geste symbolique autant que technique : le ramasse-miettes s'en chargerait
 * de toute façon. Mais écraser explicitement les valeurs rend le principe
 * visible dans le code — ces vecteurs ne survivent pas à l'écran qui les a
 * produits, et le prochain qui lira ce fichier le saura.
 */
export function effacer(empreinte: Empreinte | null) {
  if (!empreinte) return;
  empreinte.vecteur.fill(0);
  empreinte.vecteur.length = 0;
}
