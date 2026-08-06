import { API_URL } from './http';

// ==================== ASSISTANT SANTÉ (IA) ====================

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Langue de conversation choisie par le patient au démarrage. */
export type AssistantLang = 'ar' | 'fr';

export interface AssistantReply {
  reply: string;
  /** Spécialité suggérée, ou null tant que l'assistant n'a pas assez d'éléments. */
  orientation: string | null;
  /** Réponses rapides à proposer au patient. Vide une fois l'orientation donnée. */
  options: string[];
}

/** Levée quand la session patient manque ou a expiré (HTTP 401 / 403). */
export class AssistantAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantAuthError';
  }
}

export const assistantAPI = {
  chat: async (messages: AssistantMessage[], lang: AssistantLang): Promise<AssistantReply> => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, lang }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      throw new AssistantAuthError(data.error || 'Session expirée');
    }
    if (!response.ok) {
      // Le backend renvoie souvent un champ "reply" lisible même en cas d'erreur
      throw new Error(data.reply || data.error || 'Erreur de l\'assistant');
    }
    return {
      reply: data.reply || '',
      orientation: data.orientation ?? null,
      options: Array.isArray(data.options) ? data.options : [],
    };
  },
};

