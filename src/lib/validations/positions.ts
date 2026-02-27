import { z } from 'zod';

// =====================================================
// POST /api/positions
// =====================================================
export const createPositionSchema = z.object({
  event_id: z.string().uuid('Event ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  role_type: z.string().min(1, 'Role type is required').max(50),
  requirements: z.string().max(2000).optional().nullable(),
  shift_start: z.string().optional().nullable(),
  shift_end: z.string().optional().nullable(),
});
