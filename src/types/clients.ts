// =====================================================
// CLIENTS MODULE - Type Definitions
// =====================================================

export interface Client {
  id: string;
  name: string;
  ico: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientWithStats extends Client {
  offers_count: number;
  accepted_count: number;
  total_revenue: number;
}

export interface CreateClientInput {
  name: string;
  ico?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  ico?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
}
