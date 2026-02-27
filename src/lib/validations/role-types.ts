import { z } from 'zod';

// =====================================================
// POST /api/role-types
// =====================================================
export const createRoleTypeSchema = z.object({
  value: z.string().min(1, 'Value is required').max(50),
  label: z.string().min(1, 'Label is required').max(100),
});

// =====================================================
// PATCH /api/role-types/[id]
// =====================================================
export const updateRoleTypeSchema = z.object({
  value: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
});
