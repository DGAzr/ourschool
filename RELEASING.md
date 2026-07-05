# Release Checklist

How to cut an OurSchool release. The version has a single source of truth —
the repo-root `VERSION` file — but a few artifacts reference it and must be
bumped together (step 1 lists all of them).

## 1. Bump the version

For a release `X.Y.Z` (git tag `vX.Y.Z`):

- [ ] `VERSION` → `X.Y.Z` (read by the backend at runtime: `app/version.py`)
- [ ] `frontend/package.json` → `"version": "X.Y.Z"`
- [ ] `docker-compose.ghcr.yml` → both `${IMAGE_TAG:-vX.Y.Z}` defaults and
      the "Image tag" comment at the top
- [ ] `env.EXAMPLE` → `IMAGE_TAG=vX.Y.Z` and the example line above it
- [ ] `README.md` → version badge at the top

Sanity check nothing was missed:

```bash
grep -rn "$(cat VERSION | sed 's/\./\\./g')" --include="*.yml" --include="*.json" \
  --include="*.md" --include="env.EXAMPLE" . | grep -v node_modules | grep -v CHANGELOG
```

## 2. Update the changelog

- [ ] Move the `[Unreleased]` section of `CHANGELOG.md` under a new
      `[X.Y.Z] - YYYY-MM-DD` heading; start a fresh empty `[Unreleased]`.
- [ ] Call out anything a self-hoster must do beyond pull+up (rare — the
      goal is zero manual steps).

## 3. Verify before tagging

- [ ] CI is green on the release branch (tests, migration chain, builds).
- [ ] Fresh-install smoke test from a clean directory:
      `cp env.EXAMPLE .env`, set `SECRET_KEY`, `docker compose -f
      docker-compose.ghcr.yml --profile local-db up -d` (previous release),
      then bump `IMAGE_TAG` to the new tag once published (step 5) and
      confirm the upgrade path migrates cleanly.
- [ ] Login as the seeded admin forces a password change; app works after.

## 4. Tag

```bash
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag push triggers `.github/workflows/publish.yml`, which runs the full CI
suite and — only if it passes — builds and pushes multi-arch images to GHCR
tagged `vX.Y.Z`, `X.Y`, and `latest`.

## 5. Verify the published images

- [ ] Both images exist and are pullable:
      `docker pull ghcr.io/dgazr/ourschool-backend:vX.Y.Z` and
      `.../ourschool-frontend:vX.Y.Z`
- [ ] `curl http://localhost:8000/` (or the `/api/health` endpoint through
      the frontend) reports version `X.Y.Z`.
- [ ] Complete the upgrade smoke test from step 3.

## 6. Announce

- [ ] Create a GitHub Release from the tag; paste the changelog section.
