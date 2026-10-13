# 5. Run `question-generation` on Sonnet, not Haiku

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** @parul-bhoite

## Context

Onboarding's interview step calls the `question-generation` skill to word the
next question. Alone among the onboarding skills it ran on `claude-haiku-4-5` —
a deliberate cost choice, since it is a cheap mechanical skill (manifest and
`anthropic_provider.py` both say so).

The live deployment exposed the problem. Every Sonnet-backed step worked —
website research, the brief, the discovery interpretation — but the interview
could not advance: `GET /api/onboarding/agent/next` returned a provider error on
every attempt. Verified end-to-end against the Railway deployment with a real
company (prosoftinformatics.com): the grounded brief rendered correctly, the
discovery answer was accepted and saved, and then generation failed. The
deployed `NEXUS_ANTHROPIC_API_KEY`'s Anthropic account can call `claude-sonnet-5`
but **not** `claude-haiku-4-5`, so the one Haiku call in the whole journey was
the one that failed — turning the interview into a dead end for every new
workspace.

Two fixes were already in place by this point and are **not** superseded here:
ADR 0004 makes that failure degrade to a 502 Retry instead of a 500, and keeps
the typed answer. Those make the failure *safe*; they do not make the interview
*complete*. Completing it needs a model the key can actually reach.

## Decision

Point `question-generation` at **`claude-sonnet-5`**, with `effort = "low"` and
`max_output_tokens = 2048` (manifest `version` bumped 6 → 7).

- **`effort = "low"`** is set explicitly rather than left unset. Every other
  Sonnet-5 skill declares an effort; none runs it unset, so unset is untested
  ground. Low matches the mechanical nature of the task and keeps the call cheap.
- **2048 output tokens**, up from 1024. On Sonnet-5 the reasoning budget and the
  answer are drawn from the same `max_output_tokens` allowance, so a tight cap can
  be spent thinking and truncate the question — the trap `user-discovery`
  documents at the other extreme. Low effort plus 2048 leaves ample room for a
  one-line question.

Validated against the real provider before shipping: the Sonnet config returns a
well-formed, non-truncated question bound to a declared field.

## Reasoning

- **The tier is a preference; a working journey is not.** Haiku was chosen to
  save money on a high-frequency mechanical call. That saving is worthless if the
  key cannot call Haiku at all. One skill on a larger model is the price of an
  onboarding that finishes.
- **Switch the model, not the key — because that is the lever we hold.** Enabling
  Haiku access on the deployed Anthropic account is the narrower change and
  remains the better long-term answer (see Revisit). But that is an account-side
  action outside this repository; the model a skill uses is in the manifest, under
  version control, and testable here.
- **Correctness is unaffected.** Sonnet-5 is strictly more capable than Haiku 4.5
  at wording a grounded question; the validators the question passes through are
  unchanged. If anything the questions improve.

## Consequences

- Each `question-generation` call is now a Sonnet call: more expensive and slower
  (~4–5s vs ~1s) than Haiku. The interview makes up to `MAX_QUESTIONS` of them,
  and the rejection loop can add more — `MAX_REJECTIONS` and its comment in
  `onboarding_agent.py` were written around Haiku's cost and are worth a second
  look if the loop ever runs hot on Sonnet. In normal use the retry-feedback
  mechanism keeps rejections rare.
- The "Haiku is the cheap-mechanical tier" rule in `anthropic_provider.py` now has
  one documented exception. The provider's `_REJECTS_EFFORT`/`_accepts_sampling`
  handling already does the right thing for Sonnet (omits `temperature`, sends
  `effort`), so no provider change was needed.
- This is independent of and complementary to ADR 0004: 0004 makes a generation
  failure safe; this makes generation succeed on the deployed key.

## Revisit trigger

- **If `claude-haiku-4-5` access is enabled on the production key**, reconsider
  reverting to Haiku for the cost saving — the only reason this skill left that
  tier was the access gap, not a quality problem. Weigh the saving against the
  better questions Sonnet produces before reverting.
- **If the per-interview cost or latency of Sonnet generation becomes a concern**
  at volume, revisit — options include a cheaper accessible tier, caching, or
  tightening `MAX_REJECTIONS`.
- **If a second model provider or a model-routing layer is introduced**, the
  per-skill model pin in the manifest is the thing it would replace.
