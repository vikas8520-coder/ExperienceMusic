# Deployment

This app is deployable as a single Node service (Express API + static client).

## Required Environment Variables

- `DATABASE_URL` (Neon connection string with `sslmode=require`)
- `NODE_ENV=production`
- `APP_ENV=production`
- `VITE_MODE=production`
- `VITE_APP_ENV=production`
- `VITE_ENABLE_DEBUG_OVERLAY=false`

Optional:
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `SOUNDCLOUD_CLIENT_ID`
- `SOUNDCLOUD_CLIENT_SECRET`

## Render (Blueprint)

1. Push this repository.
2. In Render, create Blueprint from repo.
3. Render reads `render.yaml`.
4. Set secret env vars (`DATABASE_URL`, API keys).
5. Trigger deploy.

Health check endpoint:
- `/api/health/db`

## Run Migrations

Run once per deploy (or when schema changes):

```bash
node ./node_modules/drizzle-kit/bin.cjs push
```

## Docker-Based Hosts

Use the included `Dockerfile`:

```bash
docker build -t experience-music .
docker run -p 5000:5000 --env DATABASE_URL=... experience-music
```
