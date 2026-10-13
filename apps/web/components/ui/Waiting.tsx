'use client'

import { useEffect, useState } from 'react'

/**
 * A wait that says something new as it goes on.
 *
 * Finding F9. Six actions in this product take eight to fifteen seconds against
 * Neon — signing in, creating a company, saving a department block, loading any
 * of three pages — and each showed one static label for the whole duration.
 * That is not slow, it is indistinguishable from hung: at ten seconds with no
 * changing signal a person retries or leaves, and a retry on a POST is the
 * worst possible response to a request that was working.
 *
 * The latency is largely environmental and understood — `CONTINUE-HERE.md`
 * records the suite taking ~20 minutes against Neon versus ~1m40s against local
 * Postgres — so this does not pretend to fix it. It makes the wait legible,
 * which is the product's own Q57: **never one spinner.**
 *
 * **Nothing here is a progress bar.** A bar implies a proportion, and we do not
 * know one — the same rule that keeps a score absent rather than zero. What
 * changes is the *sentence*, and each one is true when it appears: the first
 * says what is happening, the later ones say that it is still happening and
 * why it might take this long.
 */

/** When to move to the next line, in ms since the wait started. */
const STEPS = [3_000, 8_000] as const

export function Waiting({
  children,
  className = 'font-mono text-sm text-ink-500',
  slow = 'Still going — the database is in another region, so this can take a few seconds.',
  verySlow = 'Taking longer than usual. Nothing has failed; it is worth waiting rather than retrying.',
}: {
  /** What is happening, said once. Shown immediately. */
  children: React.ReactNode
  className?: string
  slow?: string
  verySlow?: string
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // Two timers rather than an interval: nothing here counts, so there is no
    // reason to wake the component up every second to re-render the same words.
    const timers = STEPS.map((at, index) =>
      setTimeout(() => setElapsed(index + 1), at),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
      <p className={className}>{children}</p>
      {elapsed >= 1 ? <p className="text-sm text-ink-500">{elapsed >= 2 ? verySlow : slow}</p> : null}
    </div>
  )
}
