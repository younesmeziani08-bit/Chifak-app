import { API_URL, getAuthHeaders } from './http';

/* La branche « démo » a été supprimée.
   Quand le jeton valait la chaîne « demo-local-token », la réservation
   n'atteignait jamais le serveur : elle écrivait dans le stockage local et
   renvoyait une confirmation. Aucun code ne pose cette valeur — c'était donc
   du code mort, mais du code mort armé : une ligne dans la console du
   navigateur suffisait à faire croire à un patient que son rendez-vous était
   pris, sans qu'aucun praticien ne le voie jamais. */

// ==================== APPOINTMENTS ====================

export interface AppointmentCreate {
  /* Rendez-vous pris par un parent pour son enfant mineur. Le compte reste
     celui du parent ; seul le nom affiché au praticien change. */
  forChild?: boolean;
  childFirstName?: string;
  childLastName?: string;
  childAge?: number;
  doctorId: number;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorAddress?: string;
  doctorCity?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  reason?: string;
  /** 'cabinet' (défaut) ou 'video'. Le serveur refuse 'video' si le
   *  praticien n'a pas activé la téléconsultation sur son compte. */
  consultationType?: 'cabinet' | 'video';
}

export const appointmentsAPI = {
  /**
   * Crée un rendez-vous.
   *
   * `pourSonPropreCompte` décide si le jeton du patient connecté accompagne la
   * demande. Le serveur s'en sert pour relire les coordonnées du titulaire en
   * base — c'est ce qui rend le compte réellement personnel — et pour
   * autoriser un rendez-vous au nom d'un enfant mineur.
   *
   * Le praticien qui pose un rendez-vous de suivi pour SON patient doit passer
   * `false`. Sinon, si un compte patient traîne dans le navigateur du cabinet
   * — ordinateur partagé, praticien qui utilise aussi l'application pour
   * lui-même — le serveur réattribuerait le rendez-vous au titulaire de ce
   * compte, et le patient réellement reçu n'apparaîtrait nulle part.
   */
  create: async (
    appointment: AppointmentCreate,
    { pourSonPropreCompte = true }: { pourSonPropreCompte?: boolean } = {},
  ) => {
    const patientToken = pourSonPropreCompte
      ? localStorage.getItem('chifak_patient_token')
      : null;

    const response = await fetch(`${API_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(patientToken && { Authorization: `Bearer ${patientToken}` }),
      },
      body: JSON.stringify(appointment)
    });

    if (!response.ok) {
      /* Une réponse d'erreur n'est pas toujours du JSON — une panne de
         passerelle ou un plantage renvoie du HTML, et `response.json()` jette
         alors une erreur d'analyse qui remplace le vrai problème par un
         « Unexpected token < » incompréhensible. */
      const detail = await response.json().catch(() => null);
      throw new Error(
        detail?.error
        || `Erreur lors de la création du rendez-vous (${response.status})`
      );
    }

    return await response.json();
  },

  getAll: async () => {
    const response = await fetch(`${API_URL}/appointments`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des rendez-vous');
    }

    return await response.json();
  },

  /**
   * Compteurs de rendez-vous à venir, calculés en base.
   *
   * Le tableau de bord n'a besoin que de nombres. Les obtenir en téléchargeant
   * la liste complète des rendez-vous faisait transiter le nom, le téléphone
   * et l'e-mail de chaque patient jusqu'au navigateur, pour n'en afficher
   * aucun.
   */
  getUpcomingStats: async (): Promise<{ total: number; parMedecin: Record<number, number> }> => {
    const response = await fetch(`${API_URL}/appointments/upcoming-stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors du comptage des rendez-vous');
    return await response.json();
  },

  getMy: async () => {
    const patientToken = localStorage.getItem('chifak_patient_token');

    const response = await fetch(`${API_URL}/patient/appointments`, {
      headers: {
        'Content-Type': 'application/json',
        ...(patientToken && { Authorization: `Bearer ${patientToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de vos rendez-vous');
    }

    return await response.json();
  },

  /**
   * Créneaux déjà pris, pour les masquer.
   *
   * `jusquA` demande une fenêtre plutôt qu'une seule journée. La liste de
   * résultats en a besoin : elle annonce « Prochaine disponibilité : mardi
   * 25 », et sans connaître les réservations de ce jour-là elle pouvait
   * désigner une journée déjà complète.
   */
  getBookedSlots: async (
    date: string,
    jusquA?: string,
  ): Promise<{ doctor_id: number; appointment_date: string; appointment_time: string }[]> => {
    try {
      const fenetre = jusquA ? `&to=${encodeURIComponent(jusquA)}` : '';
      const response = await fetch(`${API_URL}/booked-slots?date=${encodeURIComponent(date)}${fenetre}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },

  cancel: async (id: number) => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/patient/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de l'annulation");
    }
    return await response.json();
  },

  /* La reprogrammation n'existe plus : pour déplacer un rendez-vous, on
     l'annule puis on en reprend un depuis la recherche, avec les
     disponibilités réelles du praticien sous les yeux. Voir la note dans
     server/routes/appointments.js. */
};

