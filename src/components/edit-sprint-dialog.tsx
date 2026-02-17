'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import type { Sprint, UpdateSprintInput } from '@/types/sprint'
import {
  createSprintSchema,
  type CreateSprintFormValues,
} from '@/lib/validations/sprint'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface EditSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sprint: Sprint | null
  onUpdateSprint: (
    sprintId: string,
    input: UpdateSprintInput
  ) => Promise<{ data: unknown; error: string | null }>
}

export function EditSprintDialog({
  open,
  onOpenChange,
  sprint,
  onUpdateSprint,
}: EditSprintDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateSprintFormValues>({
    resolver: zodResolver(createSprintSchema),
    defaultValues: {
      name: '',
      start_date: '',
      end_date: '',
    },
  })

  // Populate form when sprint changes
  useEffect(() => {
    if (sprint) {
      form.reset({
        name: sprint.name,
        start_date: sprint.start_date,
        end_date: sprint.end_date,
      })
    }
  }, [sprint, form])

  async function onSubmit(values: CreateSprintFormValues) {
    if (!sprint) return
    setIsLoading(true)
    setServerError(null)
    try {
      const input: UpdateSprintInput = {
        name: values.name,
        start_date: values.start_date,
        end_date: values.end_date,
      }

      const result = await onUpdateSprint(sprint.id, input)
      if (!result.error) {
        onOpenChange(false)
      } else {
        setServerError(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset()
      setServerError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit sprint</DialogTitle>
          <DialogDescription>
            Update the sprint name and date range.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            {/* Sprint Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sprint name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Sprint 12, Q1 Release"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date */}
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
