import { z } from 'zod';

// =====================================================
// POST /api/assignments
// =====================================================
export const createAssignmentSchema = z.object({
  position_id: z.string().uuid('Position ID is required'),
  technician_id: z.string().uuid('Technician ID is required'),
  notes: z.string().max(2000).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

// =====================================================
// PATCH /api/assignments/[id]
// =====================================================
export const updateAssignmentSchema = z.object({
  attendance_status: z.enum(['pending', 'accepted', 'declined', 'tentative']).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});
