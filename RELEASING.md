# Release Checklist

How to cut an OurSchool release. The runtime version has a single source of
truth — the repo-root `VERSION` file — but package and deployment metadata
must be bumped with it.

## 1. Bump the version

For a release `X.Y.Z` (git tag `vX.Y.Z`):

- [ ] `VERSION` → `X.Y.Z` (read by the backend at runtime: `app/version.py`)
- [ ] `frontend/package.json` → `"version": "X.Y.Z"`
- [ ] `frontend/package-lock.json` → both root package versions set to `X.Y.Z`
- [ ] `docker-compose.ghcr.yml` → both `${IMAGE_TAG:-vX.Y.Z}` defaults and
      the "Image tag" comment at the top
- [ ] `env.EXAMPLE` → `IMAGE_TAG=vX.Y.Z` and the example line above it
- [ ] `README.md` → release status and version at the top

Sanity check nothing was missed:

```bash
rg -n 'v?[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)\.?[0-9]*)?' \
  VERSION frontend/package.json frontend/package-lock.json \
  docker-compose.ghcr.yml env.EXAMPLE README.md
```

Review every result. Historical versions in `CHANGELOG.md` are intentionally
excluded; release-facing metadata must agree on the new version.

## 2. Update the changelog

- [ ] Move the `[Unreleased]` section of `CHANGELOG.md` under a new
      `[X.Y.Z] - YYYY-MM-DD` heading; start a fresh empty `[Unreleased]`.
- [ ] Call out anything a self-hoster must do beyond pull+up (rare — the
      goal is zero manual steps).

## 3. Verify before tagging

- [ ] CI is green on the release branch (tests, migration chain, builds).
- [ ] The worktree is clean and the release commit is on `main`.
- [ ] `python3 -c 'from app.version import __version__; print(__version__)'`
      prints `X.Y.Z`.
- [ ] Fresh-install smoke test from a clean directory:
      `cp env.EXAMPLE .env`, set `SECRET_KEY`, `docker compose -f
      docker-compose.ghcr.yml --profile local-db up -d` using the previous
      release, then complete the published-image upgrade test in step 5.
- [ ] Login as the seeded admin forces a password change; app works after.

## 4. Tag

```bash
git checkout main && git pull --ff-only
git tag -a vX.Y.Z -m "OurSchool X.Y.Z"
git push origin vX.Y.Z
```

The tag push triggers `.github/workflows/publish.yml`, which runs the full CI
suite and — only if it passes — builds and pushes multi-arch images to GHCR
tagged `vX.Y.Z`, `X.Y`, and `latest`.

## 5. Verify the published images

- [ ] Both images exist and are pullable:
      `docker pull ghcr.io/dgazr/ourschool-backend:vX.Y.Z` and
      `.../ourschool-frontend:vX.Y.Z`
- [ ] `curl http://localhost:8000/health` (or `/api/health` through the
      frontend) reports a healthy service.
- [ ] `docker compose -f docker-compose.ghcr.yml exec backend python -c
      'from app.version import __version__; print(__version__)'` prints
      `X.Y.Z`.
- [ ] Complete the upgrade smoke test from step 3.

## 6. Announce

- [ ] Create a GitHub Release from the tag; paste the changelog section.
