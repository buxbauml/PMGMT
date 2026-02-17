'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface InvitationData {
  id: string
  workspace_id: string
  workspace_name: string
  invited_by_name: string
  invited_email: string
  role: string
  status: string
  expires_at: string
  already_member: boolean
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [status, setStatus] = useState<
    'idle' | 'accepting' | 'accepted' | 'error'
  >('idle')
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // Fetch invitation details when authenticated
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setFetchLoading(false)
      return
    }

    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations/${params.token}`)
        const json = await res.json()

        if (!res.ok) {
          setFetchError(json.error ?? 'Invitation not found')
          return
        }

        setInvitation(json.data)
      } catch {
        setFetchError('Failed to load invitation details')
      } finally {
        setFetchLoading(false)
      }
    }

    fetchInvitation()
  }, [authLoading, isAuthenticated, params.token])

  if (authLoading || (isAuthenticated && fetchLoading)) {
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

  // Error fetching invitation (invalid, expired, already accepted)
  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription>{fetchError}</CardDescription>
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

  if (!invitation) {
    return null
  }

  // Already a member
  if (invitation.already_member) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Already a member</CardTitle>
            <CardDescription>
              You are already a member of {invitation.workspace_name}.
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
    setAcceptError(null)
    try {
      const res = await fetch(`/api/invitations/${params.token}/accept`, {
        method: 'POST',
      })

      if (!res.ok) {
        const json = await res.json()
        // 409 = already a member, treat as success
        if (res.status === 409) {
          setStatus('accepted')
          return
        }
        setAcceptError(json.error ?? 'Failed to accept invitation')
        setStatus('error')
        return
      }

      setStatus('accepted')
    } catch {
      setAcceptError('Failed to accept invitation')
      setStatus('error')
    }
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
          {acceptError && (
            <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {acceptError}
            </div>
          )}
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
