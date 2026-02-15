'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { mockInvitations } from '@/lib/mock-data/workspaces'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<
    'idle' | 'accepting' | 'accepted' | 'error'
  >('idle')

  // Mock: find invitation by token
  const invitation = mockInvitations.find((inv) => inv.token === params.token)

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not logged in
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              You need to sign in to accept this workspace invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href={`/login?redirect=/invite/${params.token}`}>
                Sign in to continue
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Invalid or expired invitation
  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please ask the
              workspace owner to send a new invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Accepted state
  if (status === 'accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Welcome to {invitation.workspace_name}!</CardTitle>
            <CardDescription>
              You have successfully joined the workspace.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/">Go to workspace</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Main invite card
  async function handleAccept() {
    setStatus('accepting')
    // Mock: simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800))
    setStatus('accepted')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Workspace invitation</CardTitle>
          <CardDescription>
            You have been invited to join a workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                {invitation.workspace_name
                  ?.split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div>
                <p className="font-medium">{invitation.workspace_name}</p>
                <p className="text-sm text-muted-foreground">
                  Invited by {invitation.invited_by_name}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                You will join as{' '}
                <span className="font-medium text-foreground">
                  {invitation.role}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/">Decline</Link>
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={status === 'accepting'}
          >
            {status === 'accepting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join workspace'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
