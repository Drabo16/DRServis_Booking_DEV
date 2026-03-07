import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Název je povinný').max(500),
  ico: z.string().max(20).optional().nullable(),
  contact_person: z.string().max(200).optional().nullable(),
  email: z.string().email('Neplatný email').max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  ico: z.string().max(20).optional().nullable(),
  contact_person: z.string().max(200).optional().nullable(),
  email: z.string().email('Neplatný email').max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});
