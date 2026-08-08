/**
 * Déclaration minimale de @vladmandic/human.
 *
 * La bibliothèque embarque ses propres types, bien plus riches. Celle-ci
 * existe pour que le projet compile même si le paquet n'est pas installé —
 * il n'est chargé qu'à la demande, sur le seul écran de vérification
 * d'identité, et une installation absente ne doit pas casser tout le build.
 *
 * On ne s'appuie ici que sur les quelques champs réellement lus dans
 * src/utils/faceMatch.ts. Si l'on venait à en utiliser d'autres, c'est ici
 * qu'il faudrait les déclarer.
 */
declare module '@vladmandic/human' {
  export interface FaceResult {
    embedding?: number[];
    faceScore?: number;
    score?: number;
    /** Vivacité estimée : 1 = personne présente. */
    live?: number;
    /** Authenticité estimée : 1 = vrai visage, 0 = écran ou impression. */
    real?: number;
  }

  export interface DetectResult {
    face?: FaceResult[];
  }

  export class Human {
    constructor(config?: Record<string, unknown>);
    load(): Promise<void>;
    warmup(): Promise<unknown>;
    detect(input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<DetectResult>;
  }
}
