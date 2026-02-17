'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import type { CreateSprintInput } from '@/types/sprint'
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

interface CreateSprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateSprint: (
    input: CreateSprintInput
  ) => Promise<{ data: unknown; error: string | null; warning?: string | null }>
}

export function CreateSprintDialog({
  open,
  onOpenChange,
  onCreateSprint,
}: CreateSprintDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)

  const form = useForm<CreateSprintFormValues>({
    resolver: zodResolver(createSprintSchema),
    defaultValues: {
      name: '',
      start_date: '',
      end_date: '',
    },
  })

  async function onSubmit(values: CreateSprintFormValues) {
    setIsLoading(true)
    setServerError(null)
    setOverlapWarning(null)
    try {
      const input: CreateSprintInput = {
        name: values.name,
        start_date: values.start_date,
        end_date: values.end_date,
      }

      const result = await onCreateSprint(input)
      if (!result.error) {
        if (result.warning) {
          setOverlapWarning(result.warning)
          // Auto-dismiss warning after 6 seconds, then close
          setTimeout(() => {
            setOverlapWarning(null)
            form.reset()
            onOpenChange(false)
          }, 6000)
        } else {
          form.reset()
          onOpenChange(false)
        }
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
      setOverlapWarning(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create sprint</DialogTitle>
          <DialogDescription>
            Plan a new sprint with a name and date range.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}
            {overlapWarning && (
              <div className="rounded-md border border-yellow-500/20 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                {overlapWarning}
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
                    Creating...
                  </>
                ) : (
                  'Create sprint'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
