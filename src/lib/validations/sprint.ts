import { z } from 'zod'

export const createSprintSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Sprint name must be at least 3 characters')
      .max(100, 'Sprint name must be at most 100 characters')
      .trim(),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const end = new Date(data.end_date)
      return end > start
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

export type CreateSprintFormValues = z.infer<typeof createSprintSchema>

export const updateSprintSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Sprint name must be at least 3 characters')
      .max(100, 'Sprint name must be at most 100 characters')
      .trim()
      .optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date)
        const end = new Date(data.end_date)
        return end > start
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

export type UpdateSprintFormValues = z.infer<typeof updateSprintSchema>
