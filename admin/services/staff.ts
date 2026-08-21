import { API_URL, getAuthHeaders } from '../../src/services/http';

// ==================== PERSONNEL (ADMIN) ====================

export interface Employee {
  id: number;
  username: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  birth_place: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  position: string | null;
  hired_at: string | null;
  emergency_contact: string | null;
  notes: string | null;
  role: 'admin' | 'employee';
  staff_code: string | null;
  feedback_token: string | null;
  active: number;
  created_at: string;
  created_count: string | number;
  deleted_count: string | number;
  feedback_count: string | number;
  avg_rating: string | number | null;
}

export interface EmployeeStats {
  from: string;
  to: string;
  created: number;
  deleted: number;
  recent: { action: string; doctor_name: string | null; created_at: string }[];
}

export interface EmployeeFeedback {
  id: number;
  staff_code: string | null;
  employee_name: string | null;
  doctor_name: string | null;
  doctor_code: string | null;
  rating: number;
  comment: string | null;
  suggestion: string | null;
  created_at: string;
}

const attendreJson = async (response: Response, defaut: string) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Le serveur joint parfois un « detail » technique. Sans lui, toute panne
    // se résume à « Erreur serveur » et il faut aller lire les logs Render.
    const message = [data.error || defaut, data.detail].filter(Boolean).join(' — ');
    throw new Error(message);
  }
  return data;
};

export const employeesAPI = {
  getAll: async (): Promise<Employee[]> =>
    attendreJson(await fetch(`${API_URL}/admin/employees`, { headers: getAuthHeaders() }), 'Erreur de chargement'),

  create: async (data: {
    firstName: string;
    lastName: string;
    password: string;
    birthDate?: string;
    birthPlace?: string;
    phone?: string;
    address?: string;
    email?: string;
    position?: string;
    hiredAt?: string;
    emergencyContact?: string;
    notes?: string;
  }): Promise<Employee> =>
    attendreJson(
      await fetch(`${API_URL}/admin/employees`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
      }),
      'Erreur lors de la création'
    ),

  remove: async (id: number): Promise<void> => {
    await attendreJson(
      await fetch(`${API_URL}/admin/employees/${id}`, { method: 'DELETE', headers: getAuthHeaders() }),
      'Erreur lors de la suppression'
    );
  },

  /** Attribue un nouveau numéro de connexion. L'ancien cesse de fonctionner. */
  regenerateLogin: async (id: number): Promise<{ username: string }> =>
    attendreJson(
      await fetch(`${API_URL}/admin/employees/${id}/regenerate-login`, {
        method: 'POST', headers: getAuthHeaders(),
      }),
      'Régénération impossible'
    ),

  stats: async (id: number, from?: string, to?: string): Promise<EmployeeStats> => {
    const p = new URLSearchParams();
    if (from) p.append('from', from);
    if (to) p.append('to', to);
    const suffixe = p.toString() ? `?${p}` : '';
    return attendreJson(
      await fetch(`${API_URL}/admin/employees/${id}/stats${suffixe}`, { headers: getAuthHeaders() }),
      'Erreur de chargement'
    );
  },

  feedback: async (): Promise<EmployeeFeedback[]> =>
    attendreJson(await fetch(`${API_URL}/admin/feedback`, { headers: getAuthHeaders() }), 'Erreur de chargement'),
};
