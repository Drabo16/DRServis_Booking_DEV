import { z } from 'zod';

// =====================================================
// POST /api/users
// =====================================================
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(320),
  full_name: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'manager', 'technician']),
  specialization: z.string().max(500).optional().nullable(),
  is_drservis: z.boolean().default(true),
  company: z.string().max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

// =====================================================
// PATCH /api/users/[id]
// =====================================================
export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'manager', 'technician']).optional(),
  specialization: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  is_drservis: z.boolean().optional(),
  company: z.string().max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});
