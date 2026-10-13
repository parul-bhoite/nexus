'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AuthError } from '@/lib/auth-client'
import { useLooksSignedIn } from '@/lib/hooks'
import { acceptInvitation, type AcceptResult } from '@/lib/onboarding-client'

/**
 * Joining a workspace you were invited to.
 *
 * Note what this screen does not ask. There is no role picker and no department
 * picker — doc 06 §2.2: *"Every subsequent user's role is set by the inviter,
 * never self-declared at acceptance. Self-declared role is privilege escalation
 * via dropdown."* The only thing sent is the token from the link.
 *
 * Accepting requires being signed in as the address the invitation names, which
 * is why an unauthenticated visitor is sent to sign in rather than offered a
 * shortcut. A forwarded link must not seat whoever received it in a role that
 * was chosen for somebody else.
 */

type State =
  | { status: 'idle' }
  | { status: 'joining' }
  | { status: 'joined'; result: AcceptResult }
  | { status: 'error'; message: string }

export function AcceptInvitation() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>({ status: 'idle' })

  // A hint for choosing what to render first, never a decision — the cookie it
  // reads is client-visible and therefore client-forgeable. The API answers 401
  // regardless of what this says.
  //
  // Read through the hook, not directly. Calling `looksSignedIn()` here was
  // finding F5: the cookie is empty on the server and populated on the client,
  // so the two renders chose different branches, hydration failed on every load
  // with a token, and React abandoned this Suspense boundary's server rendering
  // altogether. The security reasoning above was right; the timing was not.
  const signedIn = useLooksSignedIn()

  async function join() {
    setState({ status: 'joining' })
    try {
      setState({ status: 'joined', result: await acceptInvitation(token) })
    } catch (caught) {
      setState({
        status: 'error',
        message:
          caught instanceof AuthError
            ? caught.message
            : 'Could not reach the setup service. Is the API running?',
      })
    }
  }

  if (!token) {
    return (
      <Panel tone="warn" title="This link is incomplete">
        <p>
          An invitation link carries a token, and this one has none. Ask whoever
          invited you to send it again.
        </p>
      </Panel>
    )
  }

  if (state.status === 'joined') {
    const { result } = state
    return (
      <div className="flex flex-col gap-6">
        <Panel
          tone="calm"
          title={
            result.outcome === 'already_a_member'
              ? 'You were already in this workspace'
              : `You have joined ${result.workspace_name ?? 'the workspace'}`
          }
        >
          {result.outcome === 'already_a_member' ? (
            <p>
              Nothing has changed. You keep the role you already hold — an
              invitation link does not alter an existing member’s access, because
              that is a role change and it would be a strange thing to do to
              somebody through an email they may not have read.
            </p>
          ) : (
            <p>
              You were added as{' '}
              <span className="font-medium">{result.role?.replace('_', ' ')}</span>. That
              was set by the person who invited you, not chosen here — which is why
              this screen never offered you the choice.
            </p>
          )}
        </Panel>

        <Button href="/account" size="lg" className="w-fit">
          Go to your account
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {state.status === 'error' ? (
        <div
          role="alert"
          className="rounded-xl border border-clay-300 bg-clay-100 px-4 py-3 text-sm text-clay-600"
        >
          {state.message}
        </div>
      ) : null}

      <Panel tone="calm" title="Before you accept">
        <p>
          This invitation was sent to one email address, and it only works for the
          account that holds it. Your role and the departments you can see were
          chosen by whoever invited you.
        </p>
      </Panel>

      {signedIn ? (
        <Button
          type="button"
          onClick={join}
          disabled={state.status === 'joining'}
          size="lg"
          className="w-fit"
        >
          {state.status === 'joining' ? 'Joining…' : 'Accept invitation'}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[0.95rem] text-ink-700">
            Sign in with the address the invitation was sent to, then open this link
            again.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/login" size="lg">
              Sign in
            </Button>
            <Button href="/register" variant="secondary" size="lg">
              Create an account
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-ink-500">
        Not expecting this?{' '}
        <Link
          href="/"
          className="font-medium text-steel-600 underline decoration-steel-300 underline-offset-2 hover:text-steel-700"
        >
          Close it
        </Link>{' '}
        — nothing happens until you accept.
      </p>
    </div>
  )
}

function Panel({
  tone,
  title,
  children,
}: {
  tone: 'calm' | 'warn'
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-5 ${
        tone === 'warn' ? 'border-gold-300 bg-gold-100' : 'border-ink-100 bg-white shadow-paper'
      }`}
    >
      <p className="font-display text-lg text-ink-900">{title}</p>
      <div className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-ink-700">{children}</div>
    </div>
  )
}
