'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  UserMinus,
} from 'lucide-react'

import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types/workspace'
import {
  updateWorkspaceSchema,
  inviteMembersSchema,
  type UpdateWorkspaceFormValues,
  type InviteMembersFormValues,
} from '@/lib/validations/workspace'
import { useAuth } from '@/hooks/useAuth'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// --- General Tab ---

interface GeneralTabProps {
  workspace: Workspace
  isOwner: boolean
  onUpdate: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description'>>
  ) => Promise<{ error: string | null }>
  onDelete: (workspaceId: string) => Promise<{ error: string | null }>
  onClose: () => void
}

function GeneralTab({
  workspace,
  isOwner,
  onUpdate,
  onDelete,
  onClose,
}: GeneralTabProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<UpdateWorkspaceFormValues>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      name: workspace.name,
      description: workspace.description ?? '',
    },
  })

  async function onSubmit(values: UpdateWorkspaceFormValues) {
    setIsLoading(true)
    try {
      const result = await onUpdate(workspace.id, {
        name: values.name,
        description: values.description || null,
      })
      if (!result.error) {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    setIsLoading(true)
    try {
      const result = await onDelete(workspace.id)
      if (!result.error) {
        onClose()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={!isOwner}
                    placeholder="Workspace name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    {...field}
                    disabled={!isOwner}
                    placeholder="What is this workspace for?"
                    className="resize-none"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isOwner && (
            <Button type="submit" disabled={isLoading} size="sm">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isSaved ? (
                'Saved!'
              ) : (
                'Save changes'
              )}
            </Button>
          )}
        </form>
      </Form>

      {isOwner && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-destructive">
              Danger zone
            </h3>
            <p className="text-sm text-muted-foreground">
              Deleting a workspace is permanent and cannot be undone. All
              projects and data within will be lost.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete{' '}
                    <span className="font-semibold">{workspace.name}</span> and
                    all its projects, tasks, and data. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  )
}

// --- Members Tab ---

interface InviteLink {
  email: string
  link: string
  token: string
}

interface MembersTabProps {
  workspace: Workspace
  members: WorkspaceMember[]
  canManageMembers: boolean
  isOwner: boolean
  onInviteMembers: (
    workspaceId: string,
    input: { emails: string[]; role: Exclude<WorkspaceRole, 'owner'> }
  ) => Promise<{ error: string | null; inviteLinks?: InviteLink[] }>
  onRemoveMember: (
    workspaceId: string,
    memberId: string
  ) => Promise<{ error: string | null; unassignedTasks: number }>
  onUpdateRole: (
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole
  ) => Promise<{ error: string | null }>
  onTransferOwnership: (
    workspaceId: string,
    newOwnerId: string
  ) => Promise<{ error: string | null }>
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const roleBadgeVariant: Record<WorkspaceRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

function MembersTab({
  workspace,
  members,
  canManageMembers,
  isOwner,
  onInviteMembers,
  onRemoveMember,
  onUpdateRole,
  onTransferOwnership,
}: MembersTabProps) {
  const { user } = useAuth()
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removeWarning, setRemoveWarning] = useState<string | null>(null)

  // Transfer ownership state
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferTargetMemberId, setTransferTargetMemberId] = useState<string | null>(null)
  const [transferTargetMemberName, setTransferTargetMemberName] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)

  // Listen for transfer ownership events
  useEffect(() => {
    const handleTransferEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ memberId: string; memberName: string }>
      setTransferTargetMemberId(customEvent.detail.memberId)
      setTransferTargetMemberName(customEvent.detail.memberName)
      setShowTransferDialog(true)
    }

    window.addEventListener('transfer-ownership', handleTransferEvent)
    return () => window.removeEventListener('transfer-ownership', handleTransferEvent)
  }, [])

  const form = useForm<InviteMembersFormValues>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: {
      emails: '',
      role: 'member',
    },
  })

  async function handleTransferOwnership() {
    if (!transferTargetMemberId) return

    setIsTransferring(true)
    try {
      const result = await onTransferOwnership(workspace.id, transferTargetMemberId)
      if (!result.error) {
        setShowTransferDialog(false)
        setTransferTargetMemberId(null)
        setTransferTargetMemberName('')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  async function onSubmitInvite(values: InviteMembersFormValues) {
    setIsInviting(true)
    setInviteError(null)
    setInviteLinks([])
    try {
      const emails = values.emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      const result = await onInviteMembers(workspace.id, {
        emails,
        role: values.role,
      })
      if (!result.error) {
        form.reset()
        setInviteSuccess(true)
        if (result.inviteLinks && result.inviteLinks.length > 0) {
          setInviteLinks(result.inviteLinks)
        }
        setTimeout(() => setInviteSuccess(false), 5000)
      } else {
        setInviteError(result.error)
      }
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Members list */}
      <div>
        <h3 className="mb-3 text-sm font-medium">
          Members ({members.length})
        </h3>
        {removeWarning && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{removeWarning}</p>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              {canManageMembers && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.user_id === user?.id
              const isMemberOwner = member.role === 'owner'
              const canRemove = canManageMembers && !isSelf && !isMemberOwner

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.user_name}
                          {isSelf && (
                            <span className="ml-1 text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.user_email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[member.role]}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  {canManageMembers && (
                    <TableCell>
                      {(canRemove || (isOwner && !isSelf && !isMemberOwner)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isOwner && member.role !== 'admin' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onUpdateRole(
                                    workspace.id,
                                    member.id,
                                    'admin'
                                  )
                                }
                              >
                                Make admin
                              </DropdownMenuItem>
                            )}
                            {isOwner && member.role === 'admin' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onUpdateRole(
                                    workspace.id,
                                    member.id,
                                    'member'
                                  )
                                }
                              >
                                Remove admin
                              </DropdownMenuItem>
                            )}
                            {isOwner &&
                              !isSelf &&
                              !isMemberOwner &&
                              (member.role === 'admin' ||
                                member.role === 'member') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      // Transfer ownership - will be handled via dialog
                                      const event = new CustomEvent('transfer-ownership', {
                                        detail: { memberId: member.user_id, memberName: member.user_email }
                                      })
                                      window.dispatchEvent(event)
                                    }}
                                    className="text-orange-600 focus:text-orange-600"
                                  >
                                    Transfer ownership
                                  </DropdownMenuItem>
                                </>
                              )}
                            {isOwner &&
                              (member.role === 'admin' ||
                                member.role === 'member') && (
                                <DropdownMenuSeparator />
                              )}
                            {canRemove && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  const result = await onRemoveMember(workspace.id, member.id)
                                  if (!result.error && result.unassignedTasks > 0) {
                                    setRemoveWarning(
                                      `${result.unassignedTasks} task${result.unassignedTasks === 1 ? ' was' : 's were'} unassigned because ${member.user_name || member.user_email} was removed.`
                                    )
                                    setTimeout(() => setRemoveWarning(null), 8000)
                                  }
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Remove from workspace
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Invite members */}
      {canManageMembers && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 text-sm font-medium">Invite members</h3>
            {inviteError && (
              <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                  <Send className="h-4 w-4 shrink-0" />
                  Invitations created! Share the links below with your invitees.
                </div>
                {inviteLinks.length > 0 && (
                  <div className="space-y-1.5">
                    {inviteLinks.map((link) => (
                      <div
                        key={link.token}
                        className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs"
                      >
                        <span className="shrink-0 font-medium">
                          {link.email}:
                        </span>
                        <input
                          readOnly
                          value={link.link}
                          className="flex-1 bg-transparent text-muted-foreground outline-none"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0 px-2 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(link.link)
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmitInvite)}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="emails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email addresses</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@example.com, another@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={isInviting}>
                  {isInviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send invitations
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </>
      )}

      {/* Transfer ownership dialog */}
      <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer workspace ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to transfer ownership of{' '}
              <span className="font-semibold">{workspace.name}</span> to{' '}
              <span className="font-semibold">{transferTargetMemberName}</span>.
              <br />
              <br />
              After this transfer:
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                <li>They will become the workspace owner</li>
                <li>You will be downgraded to admin</li>
                <li>Only they can transfer ownership again</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={isTransferring}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                'Transfer ownership'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Main Settings Sheet ---

interface WorkspaceSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  members: WorkspaceMember[]
  isOwner: boolean
  canManageMembers: boolean
  onUpdate: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description'>>
  ) => Promise<{ error: string | null }>
  onDelete: (workspaceId: string) => Promise<{ error: string | null }>
  onInviteMembers: (
    workspaceId: string,
    input: { emails: string[]; role: Exclude<WorkspaceRole, 'owner'> }
  ) => Promise<{ error: string | null; inviteLinks?: InviteLink[] }>
  onRemoveMember: (
    workspaceId: string,
    memberId: string
  ) => Promise<{ error: string | null; unassignedTasks: number }>
  onUpdateRole: (
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole
  ) => Promise<{ error: string | null }>
  onTransferOwnership: (
    workspaceId: string,
    newOwnerId: string
  ) => Promise<{ error: string | null }>
}

export function WorkspaceSettings({
  open,
  onOpenChange,
  workspace,
  members,
  isOwner,
  canManageMembers,
  onUpdate,
  onDelete,
  onInviteMembers,
  onRemoveMember,
  onUpdateRole,
  onTransferOwnership,
}: WorkspaceSettingsProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Workspace settings</SheetTitle>
          <SheetDescription>
            Manage your workspace settings and team members.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">
                General
              </TabsTrigger>
              <TabsTrigger value="members" className="flex-1">
                Members
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-4">
              <GeneralTab
                workspace={workspace}
                isOwner={isOwner}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <MembersTab
                workspace={workspace}
                members={members}
                canManageMembers={canManageMembers}
                isOwner={isOwner}
                onInviteMembers={onInviteMembers}
                onRemoveMember={onRemoveMember}
                onUpdateRole={onUpdateRole}
                onTransferOwnership={onTransferOwnership}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
