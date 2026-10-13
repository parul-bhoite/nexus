'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AuthError, fetchSession, logout, type SessionState } from '@/lib/auth-client'
import { Waiting } from '@/components/ui/Waiting'

/**
 * What a signed-in person can currently see.
 *
 * Which is: their account, and an honest account of why there is nothing else
 * yet. A workspace requires a verified domain, so a new account has none — and
 * the rest of the product is scoped to a workspace. Rendering an empty dashboard
 * would imply the data is missing; naming the gate explains it.
 */

type State =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'ready'; session: SessionState }
  | { status: 'error'; message: string }

export function AccountPanel() {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let live = true
    fetchSession()
      .then((session) => {
        if (!live) return
        setState(session ? { status: 'ready', session } : { status: 'anonymous' })
      })
      .catch((error: unknown) => {
        if (!live) return
        setState({
          status: 'error',
          message:
            error instanceof AuthError
              ? error.message
              : 'Could not reach the account service. Is the API running?',
        })
      })
    return () => {
      live = false
    }
  }, [])

  async function onSignOut() {
    setSigningOut(true)
    try {
      await logout()
    } catch {
      // Sign-out is best-effort from here. The button must never trap someone on
      // this page, so a failed call still returns them to a signed-out view —
      // the session cookie is cleared by the API, and if the call never landed
      // the session simply expires on its own.
    }
    router.replace('/login')
  }

  if (state.status === 'loading') {
    return <Waiting>Loading your account…</Waiting>
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-clay-300 bg-clay-100 px-4 py-3 text-sm text-clay-600"
      >
        {state.message}
      </div>
    )
  }

  if (state.status === 'anonymous') {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[0.95rem] text-ink-700">
          You are not signed in. Your session may have expired — they last 12 hours.
        </p>
        <Button href="/login" size="lg" className="w-fit">
          Sign in
        </Button>
      </div>
    )
  }

  const { session } = state
  // One company per account (`doc/11` §3.2), so this is a single row rather
  // than a list, and there is no switcher — `POST /auth/workspace` was deleted
  // in P3 because there is never a second workspace to switch to.
  //
  // `session.workspaces` stays an array. The schema is many-to-many by choice
  // (see `app/domain/membership.py`), so the wire format that carries zero or
  // one entry today can carry more if doc 06 §2.1's agency case is revived.
  const company = session.workspaces[0] ?? null

  return (
    <div className="flex flex-col gap-8">
      {/* ── Identity ──

          Finding F8. This showed a user UUID beside a workspace UUID, on the
          one page that promises *"everything below is read from the API"* —
          with the company's actual name sitting in the row directly beneath.
          `GET /auth/session` now carries the email, and the second cell is gone
          rather than restated: the company already has a section of its own,
          and printing its name twice over is how the UUID came to look
          acceptable in the first place. */}
      <dl className="overflow-hidden rounded-2xl border border-ink-100 bg-white px-5 py-4">
        <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-400">
          Signed in as
        </dt>
        <dd className="mt-1 break-all text-sm text-ink-800">
          {session.email ?? <span className="font-mono">{session.user_id}</span>}
        </dd>
      </dl>

      {/* ── Workspaces ── */}
      <section>
        <h2 className="font-display text-lg font-medium text-ink-900">Your company</h2>

        {company ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-paper">
              <span className="font-medium text-ink-900">{company.name}</span>
              <span className="rounded-full bg-bone-200 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.08em] text-ink-600">
                {company.role}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-ink-100 bg-white px-5 py-5 shadow-paper">
              <p className="font-display text-lg text-ink-900">Set up your workspace</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-700">
                Tell NEXUS about your business, and invite the people who work in it.
                Each answer is stored at its own scope — the deal size as a Sales fact,
                the marketing budget as a Finance one — and the wizard shows you which
                before you type it.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button href="/dashboard">Go to your dashboard</Button>
                <Button href="/onboarding" variant="secondary">
                  Workspace setup
                </Button>
                <Button href="/settings" variant="secondary">
                  Settings
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-2xl border border-ink-100 bg-white px-5 py-5 shadow-paper">
            {/* **D19: creating a company needs no domain claim.**

                This said a workspace "only exists once someone has proved they
                control the domain", and pointed at the API. Both stopped being
                true when D19 split creation from verification —
                `app/auth/companies.py` carries the split, and `/register-company`
                is the screen.

                It stranded every founder who had just registered: the one page
                they land on told them to go and edit a DNS record, and nothing
                anywhere linked to the step they actually needed. Verification
                still gates *inviting colleagues*, which is where it belongs. */}
            <p className="font-display text-lg text-ink-900">Create your company</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-700">
              One step, and you can start straight away. You do not need to prove you own
              the domain first — that comes later, and only when you want to invite your
              colleagues, which is the rule that stops anyone adding themselves to your
              company.
            </p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-700">
              When you do come to prove it, that needs a DNS TXT record, a file published
              on the site, or an email address on the domain itself.{' '}
              <Link
                href="/settings"
                className="font-medium text-steel-600 underline decoration-steel-300 underline-offset-2 hover:text-steel-700"
              >
                Settings
              </Link>{' '}
              walks through whichever you pick.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button href="/register-company">Create your company</Button>
            </div>
          </div>
        )}
      </section>

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={onSignOut}
          disabled={signingOut}
          className="w-fit"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </div>
  )
}
