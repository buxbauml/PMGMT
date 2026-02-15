import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(3, 'Workspace name must be at least 3 characters')
    .max(50, 'Workspace name must be at most 50 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
})

export type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceSchema>

export const inviteMembersSchema = z.object({
  emails: z
    .string()
    .min(1, 'Please enter at least one email address')
    .refine(
      (value) => {
        const emails = value.split(',').map((e) => e.trim()).filter(Boolean)
        return emails.length > 0
      },
      'Please enter at least one valid email address'
    )
    .refine(
      (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const emails = value.split(',').map((e) => e.trim()).filter(Boolean)
        return emails.every((email) => emailRegex.test(email))
      },
      'One or more email addresses are invalid'
    ),
  role: z.enum(['admin', 'member']),
})

export type InviteMembersFormValues = z.infer<typeof inviteMembersSchema>

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(3, 'Workspace name must be at least 3 characters')
    .max(50, 'Workspace name must be at most 50 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
})

export type UpdateWorkspaceFormValues = z.infer<typeof updateWorkspaceSchema>
