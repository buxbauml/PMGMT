import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Task title must be at least 3 characters')
    .max(200, 'Task title must be at most 200 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  assignee_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  sprint_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['to_do', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
})

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Task title must be at least 3 characters')
    .max(200, 'Task title must be at most 200 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .trim()
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  assignee_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  sprint_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['to_do', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
})

export type UpdateTaskFormValues = z.infer<typeof updateTaskSchema>

// --- Comment validation (PROJ-5) ---

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters')
    .trim()
    .refine((val) => val.trim().length > 0, 'Comment cannot be empty'),
})

export type CreateCommentFormValues = z.infer<typeof createCommentSchema>

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters')
    .trim()
    .refine((val) => val.trim().length > 0, 'Comment cannot be empty'),
})

export type UpdateCommentFormValues = z.infer<typeof updateCommentSchema>
