import { z } from 'zod';

// =====================================================
// POST /api/warehouse/items
// =====================================================
export const createWarehouseItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  category_id: z.string().uuid().optional().nullable(),
  quantity_total: z.number().int().min(0, 'Quantity must be non-negative'),
  is_rent: z.boolean().default(false),
  description: z.string().max(2000).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).default('ks'),
  notes: z.string().max(5000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
});

// =====================================================
// PATCH /api/warehouse/items/[id]
// =====================================================
export const updateWarehouseItemSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  category_id: z.string().uuid().optional().nullable(),
  quantity_total: z.number().int().min(0).optional(),
  is_rent: z.boolean().optional(),
  description: z.string().max(2000).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional(),
  notes: z.string().max(5000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
});

// =====================================================
// POST /api/warehouse/categories
// =====================================================
export const createWarehouseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#6b7280'),
  sort_order: z.number().int().min(0).default(0),
});

// =====================================================
// PATCH /api/warehouse/categories/[id]
// =====================================================
export const updateWarehouseCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  sort_order: z.number().int().min(0).optional(),
});

// =====================================================
// POST /api/warehouse/reservations
// =====================================================
export const createReservationSchema = z.object({
  event_id: z.string().uuid().optional().nullable(),
  item_id: z.string().uuid('Item ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  notes: z.string().max(2000).optional().nullable(),
});

// =====================================================
// POST /api/warehouse/kits
// =====================================================
export const createKitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  description: z.string().max(2000).optional().nullable(),
  items: z.array(z.object({
    item_id: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1, 'At least one item is required'),
});

// =====================================================
// PATCH /api/warehouse/kits/[id]
// =====================================================
export const updateKitSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  items: z.array(z.object({
    item_id: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
});

// =====================================================
// POST /api/warehouse/kits/reserve
// =====================================================
export const reserveKitSchema = z.object({
  kit_id: z.string().uuid('Kit ID is required'),
  event_id: z.string().uuid().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  notes: z.string().max(2000).optional().nullable(),
});
