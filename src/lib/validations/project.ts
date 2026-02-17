import { z } from 'zod'

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Project name must be at least 3 characters')
      .max(100, 'Project name must be at most 100 characters')
      .trim(),
    description: z
      .string()
      .max(500, 'Description must be at most 500 characters')
      .trim()
      .optional()
      .or(z.literal('')),
    start_date: z.string().optional().or(z.literal('')),
    end_date: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be on or after start date',
      path: ['end_date'],
    }
  )

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Project name must be at least 3 characters')
      .max(100, 'Project name must be at most 100 characters')
      .trim(),
    description: z
      .string()
      .max(500, 'Description must be at most 500 characters')
      .trim()
      .optional()
      .or(z.literal('')),
    start_date: z.string().optional().or(z.literal('')),
    end_date: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be on or after start date',
      path: ['end_date'],
    }
  )

export type UpdateProjectFormValues = z.infer<typeof updateProjectSchema>
