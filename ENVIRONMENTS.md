# Environments (Dev / Test / Production)

## Neon Branch Mapping
- `dev` environment -> Neon `dev` branch
- `test` environment -> Neon `test` branch
- `production` environment -> Neon `main` branch

Use a different `DATABASE_URL` per branch.

## Files
Tracked templates (safe to commit):
- `.env.development`
- `.env.test`
- `.env.production`
- `.env.example`
- `.env.development.example`
- `.env.test.example`
- `.env.production.example`

Local secrets (ignored by git):
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

## Setup
1. Keep non-secret defaults in `.env.development`, `.env.test`, `.env.production`.
2. Put real secrets (`DATABASE_URL`, API keys) in matching `.local` files.
3. Scripts automatically load:
   - base file with `--env-file`
   - secret override with `--env-file-if-exists`

Example local file:

```env
DATABASE_URL="postgresql://<user>:<password>@<branch-host>/<db>?sslmode=require&channel_binding=require"
```

## Commands
- Frontend dev: `npm run dev`
- Frontend dev (test mode): `npm run dev:test`
- Frontend build (production): `npm run build`
- Frontend build (test): `npm run build:test`
- Frontend preview: `npm run preview`
- Frontend preview (test): `npm run preview:test`
- Fullstack dev (Express + API + Vite middleware): `npm run app:dev`
- Fullstack dev over HTTPS (for secure mic on local/LAN): `PORT=5051 npm run app:dev:https`
- Fullstack dev test mode: `npm run app:dev:test`
- Fullstack build/start (production): `npm run app:build:production` then `npm run app:start:production`
- Fullstack build/start (test): `npm run app:build:test` then `npm run app:start:test`
- Predeploy smoke check (production): `npm run predeploy:production`
- Predeploy smoke check (test): `npm run predeploy:test`
- Push schema (dev/test/prod):
  - `npm run db:push`
  - `npm run db:push:test`
  - `npm run db:push:production`

## DB Verification
- Health endpoint: `GET /api/health/db`
- Local URL: `http://localhost:5000/api/health/db`
- Expected success response:
  - `{ "ok": true, "now": "<timestamp>" }`

## Notes
- `npm run dev` is frontend-only Vite. Use `npm run app:dev` when backend `/api/*` routes are required.
- For microphone capture, use a secure origin:
  - local machine: `http://localhost:<port>`
  - LAN devices: run `npm run app:dev:https` and open `https://<your-lan-ip>:<port>` after trusting the dev certificate.
- Only `VITE_*` values are exposed to browser code.
- Never store secrets in `VITE_*` variables.
