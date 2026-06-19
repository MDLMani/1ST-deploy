import { z } from 'zod';
import { UserRole, TicketPriority, TicketStatus } from '../constants';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128),
  role: z.nativeEnum(UserRole).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const createTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(2, 'Category is required'),
  priority: z.nativeEnum(TicketPriority).optional(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().min(1, 'Assignee user ID is required'),
});

export const createCommentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
