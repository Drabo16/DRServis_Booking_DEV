import { z } from 'zod';

// =====================================================
// POST /api/events/[id]/invite
// =====================================================
export const inviteSchema = z.object({
  assignmentId: z.string().uuid('Assignment ID is required'),
});
