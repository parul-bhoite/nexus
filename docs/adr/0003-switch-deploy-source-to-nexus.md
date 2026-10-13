# 3. Switch Railway deploy source to `nexus` (new services on `main`)

Date: 2026-10-11

## Status

Accepted (deploy in progress — the API boots once its secrets are pasted).

## Context

The app was deployed on Railway (project `confident-expression`) from
`parul-bhoite/nexus-os` — API (`nexus-os`) building `services/api` from `dev`,
web (`vivacious-trust`) building `apps/web` from `main`. See ADR 0001 (topology)
and ADR 0002 (dependency work-arounds).

The owner asked to deploy `parul-bhoite/nexus` instead — a second repo holding
the "signed-in app redesign" line of work — pointing **both** services at it.

Two things shaped the outcome:

1. **The target repo lacked every deploy fix.** `nexus` on both `main` and
   `feature/signed-in-app-redesign` had `next@14.2.18` (blocked by Railway's CVE
   gate) and an API image missing `anthropic`/`cryptography`/`defusedxml`
   (crash-loops). It also had no `dev` branch.
2. **Railway cannot repoint an existing service to a different repository.**
   Selecting a different repo in the "Connect Repo" / "Edit GitHub repo" picker
   fires no change mutation (confirmed via the network tab across both services).
   The "Edit" only reconnects the *same* repo.

A prerequisite also surfaced: the Railway **account** (`info.prosoftinformatics`)
had **GitHub disconnected** entirely, so the repo picker returned nothing and
branches never loaded ("could not load branches" all along). The GitHub *App*
was installed on the `parul-bhoite` GitHub account, but the Railway account was
never linked to GitHub.

## Decision

- **Connect GitHub at the Railway account level** (linked as `parul-bhoite`).
  This is what makes repo selection, branch loading, and auto-deploy work.
- **Deploy `parul-bhoite/nexus` from `main`** for both services (there is no
  `dev` on `nexus`; one branch for both means a single merge deploys the app).
- **Port the three deploy fixes to `nexus/main`** first (merged, PR #1 → `7406d58`):
  `next` → 14.2.35, and `anthropic` + `cryptography` + `defusedxml` in the API image.
- **Create two NEW services** from `nexus/main` (Railway can't repoint existing
  ones): `nexus` (API, root `services/api`, port 8000) and `peaceful-comfort`
  (web, root `apps/web`, port 3000).
- **Cross-wire over public URLs** via env vars: web's `NEXUS_API_BASE_URL` → the
  API's public URL; the API's `NEXUS_PUBLIC_BASE_URL` → the web's public URL
  (verification/reset links are built from it). Public URLs, not the private
  network, because the API's uvicorn binds IPv4 `0.0.0.0` and Railway private
  networking needs IPv6 `::`.
- **Enable auto-deploy** on the new services (now possible with GitHub connected).

## Reasoning

- The owner directed the switch; `nexus` carries the work that should run.
- Porting fixes rather than deploying `nexus` broken keeps the deployment working
  and keeps each fix in the repo whose code it applies to.
- New services were the only option — Railway won't change an existing service's
  repo. The alternative (reuse the old services) is simply not supported by the
  platform.
- One branch (`main`) for both services avoids the earlier `dev`/`main` drift.

## Consequences

- **`parul-bhoite/nexus` is canonical for deployment** going forward; `nexus-os`
  is retired for this project. Fixes land on `nexus`.
- **New public URLs** (`nexus-production-b959`, `peaceful-comfort-production-fead`);
  the old URLs stay with the now-redundant `nexus-os`/`vivacious-trust` services,
  which should be deleted once the new ones are verified.
- The API's 6 secrets had to be re-entered by the owner on the new service
  (secrets never leave their `.env`; the agent does not type them).
- This ADR lives in the `nexus-os` history; it should be committed into `nexus`
  (the canonical repo) alongside ADR 0001/0002.
- The ADR-0002 lock-drift follow-up (regenerate `requirements-dev.lock`) applies
  to `nexus` too.

## Revisit trigger

- `requirements-dev.lock` is regenerated to include `cryptography`, `defusedxml`,
  `mcp` — drop the ad-hoc `pip install` line (supersedes part of ADR 0002).
- A move to Railway's private networking (would require the API to bind `::`),
  which would remove the public-URL cross-wiring.
- `nexus-os` is revived or the repos are reconciled — re-decide which is canonical.
- Custom domains are added — the generated `*.up.railway.app` URLs change.
