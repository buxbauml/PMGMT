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

// --- Attachment validation (PROJ-8) ---

export const createAttachmentSchema = z.object({
  original_filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename must be at most 255 characters'),
  file_size: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(10 * 1024 * 1024, 'File size must not exceed 10 MB'),
  mime_type: z.enum([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
  ], { message: 'Unsupported file type' }),
  storage_path: z
    .string()
    .min(1, 'Storage path is required')
    .max(500, 'Storage path is too long'),
})
