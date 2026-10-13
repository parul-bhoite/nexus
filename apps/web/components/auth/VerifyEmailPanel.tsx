'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Button } from '@/components/ui/Button'
import { AuthError, verifyEmail } from '@/lib/auth-client'

type State =
  | { status: 'working' }
  | { status: 'verified' }
  | { status: 'unusable'; message: string }
  | { status: 'no-token' }

/**
 * Consumes the token from a verification email.
 *
 * **The token is spent by this component, not by loading the page.** It arrives
 * in the query string, and the POST happens here in the browser. A route that
 * consumed it on GET would burn it on the first thing that fetched the URL —
 * a mail scanner, a link previewer, a chat client unfurling a preview — and the
 * recipient would click a link that had already been used. Single-use tokens
 * and eager fetchers are a bad combination unless something deliberate stands
 * between them.
 *
 * Verification is **not** a gate. `doc/11` §5 records it as non-blocking:
 * required to invite or connect, not to proceed. So the failure state offers a
 * way onward rather than a dead end.
 */
export function VerifyEmailPanel() {
  const params = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<State>(token ? { status: 'working' } : { status: 'no-token' })

  // React 18 mounts twice in development. A second POST would spend a token the
  // first one already consumed and report the link as invalid to someone whose
  // verification had in fact just succeeded.
  const spent = useRef(false)

  useEffect(() => {
    if (!token || spent.current) return
    spent.current = true

    verifyEmail(token)
      .then(() => setState({ status: 'verified' }))
      .catch((error: unknown) =>
        setState({
          status: 'unusable',
          message:
            error instanceof AuthError
              ? error.message
              : 'Could not reach the account service. Try the link again in a moment.',
        }),
      )
  }, [token])

  if (state.status === 'working') {
    return <p className="text-ink-500">Confirming your email address…</p>
  }

  if (state.status === 'verified') {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-ink-700">
          Your email address is confirmed. You can invite colleagues and connect tools now.
        </p>
        <Button href="/account" size="lg" icon={<ArrowRight />} className="w-fit">
          Go to your account
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="alert"
        className="rounded-xl border border-clay-300 bg-clay-100 px-4 py-3 text-sm text-clay-600"
      >
        {state.status === 'no-token'
          ? 'This page needs the link from your confirmation email.'
          : state.message}
      </div>
      <p className="text-sm text-ink-500">
        Confirmation links work once and expire after 24 hours. Signing in and asking for a new
        one is the fastest way out of this — and you can keep using NEXUS OS meanwhile:
        confirming your address is needed to invite people and connect tools, not to look around.
      </p>
      <Link
        href="/login"
        className="font-medium text-steel-600 underline decoration-steel-300 underline-offset-2 hover:text-steel-700"
      >
        Sign in
      </Link>
    </div>
  )
}
