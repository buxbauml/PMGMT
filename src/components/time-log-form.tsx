'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'

import type { TimeLog } from '@/types/task'
import {
  createTimeLogSchema,
  type CreateTimeLogFormValues,
} from '@/lib/validations/task'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TimeLogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingLog?: TimeLog | null
  onSubmit: (values: {
    duration: number
    description?: string
    logged_date: string
  }) => Promise<{ error: string | null }>
}

export function TimeLogForm({
  open,
  onOpenChange,
  editingLog,
  onSubmit,
}: TimeLogFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const isEditing = !!editingLog

  const form = useForm<CreateTimeLogFormValues>({
    resolver: zodResolver(createTimeLogSchema),
    defaultValues: {
      duration: '' as unknown as number,
      description: '',
      logged_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  // Reset form when dialog opens or editingLog changes
  useEffect(() => {
    if (open) {
      if (editingLog) {
        form.reset({
          duration: editingLog.duration,
          description: editingLog.description ?? '',
          logged_date: editingLog.logged_date,
        })
      } else {
        form.reset({
          duration: '' as unknown as number,
          description: '',
          logged_date: format(new Date(), 'yyyy-MM-dd'),
        })
      }
      setServerError(null)
    }
  }, [open, editingLog, form])

  async function handleSubmit(values: CreateTimeLogFormValues) {
    setIsLoading(true)
    setServerError(null)
    try {
      const result = await onSubmit({
        duration: values.duration,
        description: values.description || undefined,
        logged_date: values.logged_date,
      })
      if (!result.error) {
        form.reset()
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
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit time log' : 'Log time'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this time log entry.'
              : 'Record time spent on this task.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {serverError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Duration (hours)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="24"
                      placeholder="e.g. 1.5 = 1h 30m"
                      autoFocus
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          field.onChange('' as unknown as number)
                        } else {
                          field.onChange(parseFloat(val))
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{' '}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you work on?"
                      className="resize-none"
                      rows={3}
                      maxLength={500}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="logged_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(new Date(field.value + 'T00:00:00'), 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value
                            ? new Date(field.value + 'T00:00:00')
                            : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, 'yyyy-MM-dd'))
                          }
                        }}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
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
                    {isEditing ? 'Saving...' : 'Logging...'}
                  </>
                ) : isEditing ? (
                  'Save changes'
                ) : (
                  'Log time'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
