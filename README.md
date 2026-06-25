# zeva-care-notes-site — public deploy target

**Generated artifact, not source.** This repository holds only the compiled,
**NON-PHI** static page for Zeva Care (the PA clinical-note composition aid) and
its autonomous GitHub Pages deploy pipeline.

- **Source of truth:** the private repo `donnie-donatellolabs/zeva-care-notes`.
- **Why a separate repo:** GitHub Pages isn't available on private repos under the
  current plan. Keeping the deploy target public (and PHI-free by construction —
  this is exactly what the scope means by "the frontend ships NON-PHI static assets
  only, so the static host never sees PHI") lets the app deploy live over HTTPS
  while the spec, prototype, and all source stay private.
- **Contents:** `site/` (built `index.html` + hashed assets + `health.json`),
  `scripts/healthcheck.mjs`, and `.github/workflows/pages.yml` (deploy → post-deploy
  health check → auto-rollback). No PHI, no secrets.
- **Custom domain (`zevacare.co`):** add a `CNAME` to `site/` and point the apex DNS
  at GitHub Pages. Until then the live URL is the project page below.

## Auto-rollback

`pages.yml` deploys, then runs a post-deploy health check against the live
`health.json`. On failure the `rollback` job restores `site/` to the previous
commit, pushes it (source truth), and **re-dispatches** the deploy workflow to
re-publish the good content. The re-dispatch is required because a second
`deploy-pages` in the same run conflicts on the `github-pages` artifact, and a
`GITHUB_TOKEN` push does not auto-trigger a workflow run. Use the workflow's
`force_health_fail` input to exercise this end-to-end.

Live: https://donnie-donatellolabs.github.io/zeva-care-notes-site/
Health: https://donnie-donatellolabs.github.io/zeva-care-notes-site/health.json
