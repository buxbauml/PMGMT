'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'

import type { Task, UpdateTaskInput } from '@/types/task'
import type { Sprint } from '@/types/sprint'
import type { WorkspaceMember } from '@/types/workspace'
import {
  updateTaskSchema,
  type UpdateTaskFormValues,
} from '@/lib/validations/task'

import { FileAttachmentsSection } from '@/components/file-attachments-section'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  members: WorkspaceMember[]
  sprints?: Sprint[]
  canDelete: boolean
  onUpdateTask: (
    taskId: string,
    input: UpdateTaskInput
  ) => Promise<{ data: unknown; error: string | null }>
  onDeleteTask: (taskId: string) => Promise<{ error: string | null }>
  // File attachment props
  workspaceId?: string | null
  projectId?: string | null
  currentUserId?: string
  isAdmin?: boolean
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  members,
  sprints,
  canDelete,
  onUpdateTask,
  onDeleteTask,
  workspaceId,
  projectId,
  currentUserId,
  isAdmin = false,
}: EditTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const form = useForm<UpdateTaskFormValues>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      assignee_id: '',
      sprint_id: '',
      status: 'to_do',
      priority: 'medium',
      estimated_hours: null,
    },
  })

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        assignee_id: task.assignee_id ?? '',
        sprint_id: task.sprint_id ?? '',
        status: task.status,
        priority: task.priority,
        estimated_hours: task.estimated_hours ?? null,
      })
    }
  }, [task, form])

  async function onSubmit(values: UpdateTaskFormValues) {
    if (!task) return

    setIsLoading(true)
    setServerError(null)
    try {
      const input: UpdateTaskInput = {
        title: values.title,
        description: values.description || null,
        assignee_id:
          values.assignee_id && values.assignee_id !== 'unassigned'
            ? values.assignee_id
            : null,
        sprint_id:
          values.sprint_id && values.sprint_id !== 'none'
            ? values.sprint_id
            : null,
        status: values.status,
        priority: values.priority,
        estimated_hours:
          values.estimated_hours !== null && values.estimated_hours !== undefined
            ? values.estimated_hours
            : null,
      }

      const result = await onUpdateTask(task.id, input)
      if (!result.error) {
        onOpenChange(false)
      } else {
        setServerError(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!task) return

    setIsDeleting(true)
    try {
      const result = await onDeleteTask(task.id)
      if (!result.error) {
        setShowDeleteDialog(false)
        onOpenChange(false)
      } else {
        setServerError(result.error)
        setShowDeleteDialog(false)
      }
    } finally {
      setIsDeleting(false)
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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update task details. Changes are saved when you click Save.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-0 overflow-hidden">
              <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 pb-1">
              {serverError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              {/* Completion info */}
              {task?.status === 'done' && task.completed_at && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                  Completed{' '}
                  {format(parseISO(task.completed_at), 'MMM d, yyyy h:mm a')}
                  {task.completed_by_name && (
                    <> by {task.completed_by_name}</>
                  )}
                </div>
              )}

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Set up CI/CD pipeline"
                        {...field}
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
                        placeholder="Add more details about this task..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignee */}
              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Assignee{' '}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((member) => (
                          <SelectItem
                            key={member.user_id}
                            value={member.user_id}
                          >
                            {member.user_name || member.user_email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sprint (only shown when sprints are available) */}
              {sprints && sprints.length > 0 && (
                <FormField
                  control={form.control}
                  name="sprint_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Sprint{' '}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No sprint" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No sprint</SelectItem>
                          {sprints.map((sprint) => (
                            <SelectItem key={sprint.id} value={sprint.id}>
                              {sprint.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Estimated Hours */}
              <FormField
                control={form.control}
                name="estimated_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Estimated Hours{' '}
                      <span className="font-normal text-muted-foreground">
                        (optional, e.g. 1.5 = 1h 30m)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="999"
                        placeholder="e.g. 4"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === '') {
                            field.onChange(null)
                          } else {
                            const num = parseFloat(val)
                            field.onChange(isNaN(num) ? null : num)
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="to_do"
                            id="edit-status-todo"
                          />
                          <Label
                            htmlFor="edit-status-todo"
                            className="cursor-pointer font-normal"
                          >
                            To Do
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="in_progress"
                            id="edit-status-in-progress"
                          />
                          <Label
                            htmlFor="edit-status-in-progress"
                            className="cursor-pointer font-normal"
                          >
                            In Progress
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="done"
                            id="edit-status-done"
                          />
                          <Label
                            htmlFor="edit-status-done"
                            className="cursor-pointer font-normal"
                          >
                            Done
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="low"
                            id="edit-priority-low"
                          />
                          <Label
                            htmlFor="edit-priority-low"
                            className="cursor-pointer font-normal"
                          >
                            Low
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="medium"
                            id="edit-priority-medium"
                          />
                          <Label
                            htmlFor="edit-priority-medium"
                            className="cursor-pointer font-normal"
                          >
                            Medium
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="high"
                            id="edit-priority-high"
                          />
                          <Label
                            htmlFor="edit-priority-high"
                            className="cursor-pointer font-normal"
                          >
                            High
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File Attachments */}
              {workspaceId && projectId && task && (
                <FileAttachmentsSection
                  workspaceId={workspaceId}
                  projectId={projectId}
                  taskId={task.id}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              )}
              </div>
              </ScrollArea>

              <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
                <div>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isLoading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
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
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold">{task?.title}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
