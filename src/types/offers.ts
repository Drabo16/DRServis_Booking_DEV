// =====================================================
// OFFERS MODULE - Type Definitions
// =====================================================
// Types for quotes/offers management
// To remove: delete this file

// =====================================================
// Template Types (Ceník)
// =====================================================

export interface OfferTemplateCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OfferTemplateItem {
  id: string;
  category_id: string;
  name: string;
  subcategory: string | null;
  default_price: number;
  unit: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfferTemplateItemWithCategory extends OfferTemplateItem {
  category: OfferTemplateCategory | null;
}

// =====================================================
// Offer Types
// =====================================================

export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Offer {
  id: string;
  offer_number: number;
  year: number;
  title: string;
  event_id: string | null;
  status: OfferStatus;
  valid_until: string | null;
  notes: string | null;
  subtotal_equipment: number;
  subtotal_personnel: number;
  subtotal_transport: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  is_vat_payer: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferWithDetails extends Offer {
  event: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
  } | null;
  created_by_profile: {
    id: string;
    full_name: string;
  } | null;
  items_count: number;
}

export interface OfferItem {
  id: string;
  offer_id: string;
  category: string;
  subcategory: string | null;
  name: string;
  days_hours: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  template_item_id: string | null;
  created_at: string;
}

export interface OfferWithItems extends Offer {
  items: OfferItem[];
  event: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
  } | null;
}

// =====================================================
// Offer Preset Types (Vzorové nabídky)
// =====================================================

export interface OfferPreset {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  is_vat_payer: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferPresetWithCount extends OfferPreset {
  items_count: number;
}

export interface OfferPresetItem {
  id: string;
  preset_id: string;
  template_item_id: string | null;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  unit_price: number;
  days_hours: number;
  quantity: number;
  sort_order: number;
}

export interface OfferPresetWithItems extends OfferPreset {
  items: OfferPresetItem[];
}

// =====================================================
// Offer Set Types (Sety nabídek)
// =====================================================

export interface OfferSet {
  id: string;
  name: string;
  description: string | null;
  event_id: string | null;
  status: OfferStatus;
  valid_until: string | null;
  notes: string | null;
  total_equipment: number;
  total_personnel: number;
  total_transport: number;
  total_discount: number;
  total_amount: number;
  is_vat_payer: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferSetWithDetails extends OfferSet {
  event: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
  } | null;
  created_by_profile: {
    id: string;
    full_name: string;
  } | null;
  offers_count: number;
}

export interface OfferSetWithOffers extends OfferSet {
  event: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
  } | null;
  offers: (Offer & { set_label: string | null })[];
}

export interface OfferInSet extends Offer {
  set_label: string | null;
  offer_set_id: string | null;
}

// =====================================================
// Input Types (for mutations)
// =====================================================

export interface CreateOfferInput {
  title: string;
  event_id?: string;
  valid_until?: string;
  notes?: string;
  offer_set_id?: string;
  set_label?: string;
}

export interface CreateOfferSetInput {
  name: string;
  description?: string;
  event_id?: string;
  valid_until?: string;
  notes?: string;
}

export interface UpdateOfferSetInput {
  name?: string;
  description?: string | null;
  event_id?: string | null;
  status?: OfferStatus;
  valid_until?: string | null;
  notes?: string | null;
  is_vat_payer?: boolean;
}

export interface UpdateOfferInput {
  title?: string;
  event_id?: string | null;
  status?: OfferStatus;
  valid_until?: string | null;
  notes?: string | null;
  discount_percent?: number;
  is_vat_payer?: boolean;
}

export interface CreateOfferItemInput {
  offer_id: string;
  category: string;
  subcategory?: string;
  name: string;
  days_hours?: number;
  quantity?: number;
  unit_price?: number;
  sort_order?: number;
  template_item_id?: string;
}

export interface UpdateOfferItemInput {
  days_hours?: number;
  quantity?: number;
  unit_price?: number;
  sort_order?: number;
}

export interface BulkAddOfferItemsInput {
  offer_id: string;
  items: {
    template_item_id: string;
    quantity: number;
    days_hours?: number;
  }[];
}

// =====================================================
// Filter Types
// =====================================================

export interface OffersFilter {
  status?: OfferStatus;
  year?: number;
  event_id?: string;
  search?: string;
}

// =====================================================
// Statistics Types
// =====================================================

export interface OffersStats {
  total_offers: number;
  offers_by_status: {
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
  total_value_accepted: number;
  total_value_sent: number;
  average_offer_value: number;
  conversion_rate: number; // accepted / (accepted + rejected) * 100
  offers_this_month: number;
  offers_this_year: number;
}

// =====================================================
// Category Groups (for display)
// =====================================================

export const OFFER_CATEGORY_GROUPS = {
  equipment: ['Ground support', 'Zvuková technika', 'Světelná technika', 'LED obrazovky + video'],
  personnel: ['Technický personál'],
  transport: ['Doprava'],
} as const;

export const OFFER_CATEGORY_ORDER = [
  'Ground support',
  'Zvuková technika',
  'Světelná technika',
  'LED obrazovky + video',
  'Technický personál',
  'Doprava',
] as const;

export type OfferCategoryGroup = 'equipment' | 'personnel' | 'transport';

export function getCategoryGroup(category: string): OfferCategoryGroup {
  if (OFFER_CATEGORY_GROUPS.personnel.includes(category as any)) return 'personnel';
  if (OFFER_CATEGORY_GROUPS.transport.includes(category as any)) return 'transport';
  return 'equipment';
}

// =====================================================
// Helper Functions
// =====================================================

export function calculateItemTotal(item: { days_hours: number; quantity: number; unit_price: number }): number {
  return item.days_hours * item.quantity * item.unit_price;
}

export function calculateOfferTotals(items: OfferItem[]): {
  subtotal_equipment: number;
  subtotal_personnel: number;
  subtotal_transport: number;
  total_before_discount: number;
} {
  let subtotal_equipment = 0;
  let subtotal_personnel = 0;
  let subtotal_transport = 0;

  for (const item of items) {
    const group = getCategoryGroup(item.category);
    const total = item.total_price;

    switch (group) {
      case 'equipment':
        subtotal_equipment += total;
        break;
      case 'personnel':
        subtotal_personnel += total;
        break;
      case 'transport':
        subtotal_transport += total;
        break;
    }
  }

  return {
    subtotal_equipment,
    subtotal_personnel,
    subtotal_transport,
    total_before_discount: subtotal_equipment + subtotal_personnel + subtotal_transport,
  };
}

export function calculateDiscountAmount(
  subtotal_equipment: number,
  discount_percent: number
): number {
  // Discount applies only to equipment
  return Math.round(subtotal_equipment * (discount_percent / 100));
}

export function calculateFinalTotal(
  subtotal_equipment: number,
  subtotal_personnel: number,
  subtotal_transport: number,
  discount_percent: number
): number {
  const discount_amount = calculateDiscountAmount(subtotal_equipment, discount_percent);
  return subtotal_equipment + subtotal_personnel + subtotal_transport - discount_amount;
}

export function formatOfferNumber(offer_number: number, year: number): string {
  return `${offer_number}/${year}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Status display helpers
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Koncept',
  sent: 'Odesláno',
  accepted: 'Přijato',
  rejected: 'Odmítnuto',
  expired: 'Vypršelo',
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};
