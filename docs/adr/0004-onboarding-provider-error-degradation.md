# 4. Onboarding routes catch `LlmError` and degrade, never 500

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** @parul-bhoite

## Context

A dummy account created against the live Railway deployment could not finish
onboarding: `POST /api/onboarding/agent/discovery` returned a generic **500**
("Something went wrong on our side") on every attempt, and because the dashboard,
settings and Company Brain all redirect to onboarding until it completes, the one
failure locked the whole signed-in product for every new account.

Root cause, confirmed by reproducing the real-provider path locally against the
same Neon the deployment uses:

- Skills run through `SkillRunner.invoke`, which calls
  `provider.complete(request)` with no error handling.
- `AnthropicProvider` maps **every** vendor failure — overload, timeout, a
  rejected request, missing/invalid credentials, a model the key cannot access —
  onto the `LlmError` hierarchy (`LlmTransientError`, `LlmRequestError`,
  `LlmAuthError`, `LlmUnavailableError`). `LlmError` is a **separate** hierarchy
  from `SkillFailedError` (which means "the provider answered, the output was
  unusable").
- The onboarding routes caught only `SkillFailedError`. A real provider error was
  therefore uncaught at every onboarding model-call site and fell through to
  `app/main.py`'s catch-all exception handler as a 500 — losing the answer the
  person had already typed in the transaction rollback.

The discovery step is simply where a new workspace hits this first: its
`question-generation` (haiku) call is the first of its kind in the flow, so it is
the first place a provider error that is specific to that model or that key can
surface. The assistant (`app/assistant/ask.py`) and grounding
(`app/grounding/qa.py`) paths already catch `LlmError` and degrade; onboarding
never adopted the pattern.

## Decision

The onboarding routes catch `(SkillFailedError, LlmError)` at **every**
model-call site, routing a provider failure through the same degradation the
routes already apply to an unusable skill output:

- A call whose failure must surface to the client — `/read`'s brief,
  `/discovery`'s interpretation, `/next`, and the `/finish` assembly — raises
  `_unusable(...)`, a **502 Bad Gateway** carrying `{"retryable": true}`.
- The next-question generation inside `/discovery` and `/answer` goes through
  `_next_or_none`, which **defers** on failure: it returns `None`, the route
  responds 200 with `question = null`, and the answer that was already stored and
  audited in the same transaction is **kept**. The client re-asks via `/next`.

No new status code and no new response shape are introduced: `502` and
`question = null` were already the contract for `SkillFailedError`. This decision
extends that one existing contract to cover provider errors, and states it as a
cross-cutting rule for every domain that invokes a skill.

## Reasoning

- **A provider outage is a bad gateway, not an application fault.** 500 tells the
  person nothing, offers no retry, and — because onboarding gates the whole app —
  strands them. 502 with `retryable: true` is the honest status and drives a
  Retry.
- **Never fabricate to stay up.** The alternative to failing is inventing a brief
  or a question, which is the single thing the product exists not to do (I1, the
  content rule). Degrading to "could not finish this step, try again" preserves
  that guarantee; a plausible default would destroy it.
- **The answer must survive the failure.** `_next_or_none` deferring rather than
  raising is what keeps the typed answer from rolling back with the generation
  that failed after it — the behaviour `submit_answer`'s per-turn commit and the
  assembly's per-stage commit already depend on.
- **Consistency over a second mechanism.** `ask.py`/`qa.py` branch on `LlmError`
  kind at their call sites; the runner deliberately propagates `LlmError` raw so
  callers can. Converting `LlmError` to `SkillFailedError` inside the runner would
  have been one line but would have broken those existing handlers. Catching both
  types at the onboarding boundary matches the established design.

## Consequences

- Onboarding can no longer 500 on a provider error; it degrades to a 502 Retry or
  a `question = null` response. The frontend's existing `question = null` handling
  (already required for `SkillFailedError`) now also covers provider failures —
  no new client contract.
- This fix stops the 500 and preserves the answer, but it does **not** make a
  persistently-failing provider call succeed. If a deployed key cannot reach a
  model at all (the 3/3 consistent discovery failures point at the deployed
  `NEXUS_ANTHROPIC_API_KEY` lacking `claude-haiku-4-5` access, since
  `question-generation` is the only haiku call), discovery now degrades cleanly
  but still will not advance until that access is resolved. After deploy, the
  Railway log for a discovery call names the exact HTTP status instead of a bare
  500.
- A regression test (`test_a_provider_failure_in_discovery_degrades_instead_of_500`)
  drives the real failure — `LlmTransientError` on `question-generation` — against
  Postgres and asserts the degradation, the persisted answer, and the 502.

## Revisit trigger

Revisit if any of the following holds:

- A new domain starts invoking skills and needs the same guard — the rule here
  (catch `LlmError` at the model-call boundary, degrade, never 500) should be
  applied there rather than rediscovered, and at that point a shared helper or a
  runner-level policy may be worth more than per-site `except` clauses.
- 502 + `question = null` proves insufficient — e.g. the client needs to
  distinguish a transient overload (worth an automatic retry) from an auth or
  model-access error (worth surfacing to an admin), which today both collapse to
  the same 502.
- Provider error patterns change such that `LlmError` is no longer the single
  type every vendor failure maps to (a second provider, or a transport that
  raises outside the `_map_error` path in `anthropic_provider.py`).
