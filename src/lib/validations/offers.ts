import { z } from 'zod';

// =====================================================
// Offer Status enum
// =====================================================
export const offerStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled']);

// =====================================================
// POST /api/offers
// =====================================================
export const createOfferSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  event_id: z.string().uuid().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  offer_set_id: z.string().uuid().optional().nullable(),
  set_label: z.string().max(200).optional().nullable(),
});

// =====================================================
// PATCH /api/offers/[id]
// =====================================================
export const updateOfferSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  event_id: z.string().uuid().optional().nullable(),
  status: offerStatusSchema.optional(),
  valid_until: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional(),
  is_vat_payer: z.boolean().optional(),
  offer_set_id: z.string().uuid().optional().nullable(),
  set_label: z.string().max(200).optional().nullable(),
  recalculate: z.boolean().optional(),
  visibility: z.enum(['private', 'all']).optional(),
});

// =====================================================
// POST /api/offers/[id]/items (single item)
// =====================================================
export const createOfferItemSchema = z.object({
  category: z.string().min(1, 'Category is required').max(200),
  subcategory: z.string().max(200).optional().nullable(),
  name: z.string().min(1, 'Name is required').max(500),
  days_hours: z.number().min(0).default(1),
  quantity: z.number().min(0).default(0),
  unit_price: z.number().min(0).default(0),
  sort_order: z.number().int().min(0).default(0),
  template_item_id: z.string().uuid().optional().nullable(),
});

// POST /api/offers/[id]/items (bulk mode)
export const bulkAddOfferItemsSchema = z.object({
  items: z.array(z.object({
    template_item_id: z.string().uuid(),
    days_hours: z.number().min(0).default(1),
    quantity: z.number().min(0).default(1),
    unit_price: z.number().min(0).optional(),
  })).min(1),
});

// PATCH /api/offers/[id]/items (single update)
export const updateOfferItemSchema = z.object({
  item_id: z.string().uuid(),
  days_hours: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  unit_price: z.number().min(0).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// PATCH /api/offers/[id]/items (batch update)
export const batchUpdateOfferItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    days_hours: z.number().min(0).optional(),
    quantity: z.number().min(0).optional(),
    unit_price: z.number().min(0).optional(),
  })).min(1),
});

// =====================================================
// Offer Presets
// =====================================================
export const createPresetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
});

const presetItemSchema = z.object({
  template_item_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(200),
  subcategory: z.string().max(200).optional().nullable(),
  unit: z.string().max(50).default('ks'),
  unit_price: z.number().min(0).default(0),
  days_hours: z.number().min(0).default(1),
  quantity: z.number().min(0).default(1),
  sort_order: z.number().int().min(0),
});

export const updatePresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional(),
  is_vat_payer: z.boolean().optional(),
  items: z.array(presetItemSchema).optional(),
});

// =====================================================
// Offer Sets
// =====================================================
export const createOfferSetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  description: z.string().max(2000).optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  status: offerStatusSchema.default('draft'),
  valid_until: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateOfferSetSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  status: offerStatusSchema.optional(),
  valid_until: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional(),
  is_vat_payer: z.boolean().optional(),
});

// POST /api/offers/sets/[id]/items (custom item)
export const createSetItemSchema = z.object({
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(200),
  subcategory: z.string().max(200).optional().nullable(),
  unit: z.string().max(50).default('ks'),
  unit_price: z.number().min(0).default(0),
  quantity: z.number().min(0).default(1),
  days_hours: z.number().min(0).default(1),
  sort_order: z.number().int().min(0).default(999),
});

// POST /api/offers/sets/[id]/items (template mode)
export const createSetItemFromTemplateSchema = z.object({
  template_item_id: z.string().uuid(),
  quantity: z.number().min(0).default(1),
  days_hours: z.number().min(0).default(1),
});

// POST /api/offers/sets/[id]/items (batch mode)
export const bulkAddSetItemsSchema = z.object({
  items: z.array(z.object({
    template_item_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(500),
    category: z.string().min(1).max(200),
    subcategory: z.string().max(200).optional().nullable(),
    unit: z.string().max(50).default('ks'),
    unit_price: z.number().min(0).default(0),
    quantity: z.number().min(0).default(1),
    days_hours: z.number().min(0).default(1),
    sort_order: z.number().int().min(0).default(0),
  })).min(1),
});

// PATCH /api/offers/sets/[id]/items
export const updateSetItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().min(0).optional(),
  days_hours: z.number().min(0).optional(),
  unit_price: z.number().min(0).optional(),
});

// =====================================================
// Template Items (Ceník)
// =====================================================
export const createTemplateItemSchema = z.object({
  category_id: z.string().uuid('Category is required'),
  name: z.string().min(1, 'Name is required').max(500),
  subcategory: z.string().max(200).optional().nullable(),
  default_price: z.number().min(0).default(0),
  unit: z.string().max(50).default('ks'),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const updateTemplateItemSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  subcategory: z.string().max(200).optional().nullable(),
  default_price: z.number().min(0).optional(),
  unit: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  category_id: z.string().uuid().optional(),
});
