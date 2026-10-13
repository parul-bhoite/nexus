/**
 * The global shell (`doc/12` P15, doc 05 §1).
 *
 * **The denominator is always beside the score.** A score alone is a claim the
 * founder cannot check; "out of three" lets them count their own departments
 * and agree with us. That agreement is what makes every other number on the
 * page worth reading.
 *
 * **A score of `null` renders as absent, never as zero.** I10: zero is a
 * statement about their business, absence is a statement about our data, and a
 * dashboard showing 0/100 to a company that has connected nothing looks like a
 * verdict on them.
 */

type ShellData = {
  score: number | null
  score_denominator: number
  capabilities_delivered: number
  capabilities_total: number
  assistant_reserved: boolean
}

export function Shell({ shell, company }: { shell: ShellData; company: string }) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-title font-medium text-ink-900">{company}</h1>

        <div className="text-right">
          {shell.score === null ? (
            // Absent, and it says why. A greyed-out "0" would be read as a
            // score, and no caption undoes a number somebody has already seen.
            <>
              <p className="font-mono text-2xs uppercase tracking-[0.12em] text-steel-700">
                Company health
              </p>
              <p className="mt-1 text-[0.95rem] text-ink-600">
                Not yet — no department has enough behind it to score.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-title font-medium text-ink-900">
                {shell.score.toFixed(0)}
              </p>
              <p className="font-mono text-2xs uppercase tracking-[0.12em] text-steel-700">
                across {shell.score_denominator} department
                {shell.score_denominator === 1 ? '' : 's'}
              </p>
            </>
          )}
        </div>
      </header>

      {/* A pair, never a percentage. The denominator is the part that makes the
          claim checkable, and "0 of 24" is a sentence somebody can argue with. */}
      <div className="rounded-2xl border border-ink-100 bg-bone-100 px-5 py-4">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-steel-700">
          What is built
        </p>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-800">
          <strong>
            {shell.capabilities_delivered} of {shell.capabilities_total}
          </strong>{' '}
          capabilities for the departments you run.{' '}
          {shell.capabilities_delivered === 0
            ? 'None of them is implemented yet, and every tile below says so rather than showing an outline you could mistake for a working widget.'
            : null}
        </p>
      </div>

      {shell.assistant_reserved ? (
        /* Q67. Reserved rather than absent: a blank region where a feature is
           coming reads as a bug, and a fake one reads as a lie. */
        <div className="rounded-2xl border border-dashed border-ink-200 px-5 py-4">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-400">
            Ask this director
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            A chat panel belongs here. It will answer from your own documents and
            numbers, cite every one, and refuse anything outside what you can see.
            It is not built, so there is nothing here to try.
          </p>
        </div>
      ) : null}
    </section>
  )
}
