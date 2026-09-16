# DRP Control — Emergency Hamburg Roleplay

DRP Control is a Discord bot + premium web dashboard built for an Emergency Hamburg Roblox roleplay community. The bot runs as a persistent Node.js service (WispByte), while the dashboard is designed for Vercel. Both services share PostgreSQL through Prisma.

## Product scope

The project focuses on RP operations, departments, records, session announcements, statistics, activity and bot configuration. It intentionally does **not** include a generic moderation category, support/ticket system, 911/dispatch system, or pretend Roblox game-control APIs.

## Dashboard

The dashboard includes a dark SaaS control center with:

- Discord OAuth2 login and Manage Server authorization
- Server/workspace selector
- Live bot heartbeat, latency, uptime and configuration version
- Active RP session overview
- Automation switches and thresholds
- Discord-style embed preview
- Versioned configuration with Save / Save & Restart workflow
- Department, duty, records, statistics and leaderboard sections
- Searchable command center with detailed command metadata
- Responsive layout for desktop, tablet and mobile

## Bot

The bot uses the shared command registry in `packages/core/src/commands.ts` so the dashboard and Discord command browser stay aligned. It registers slash commands, tracks heartbeats in PostgreSQL, applies configured presence, stores RP sessions/operations/records, writes audit logs and polls the shared control queue for dashboard-triggered restart/maintenance requests.

The restart workflow is intentionally process-manager friendly: the dashboard queues `RESTART`, the bot exits gracefully, and WispByte's process supervisor should start the configured service again.

Discord's current app model is slash-command oriented; Discord's June 2026 developer update also highlights stricter controls around privileged server-member and presence data, so only the access the bot actually needs should be enabled. citeturn900563search0

## Environment

Copy `.env.example` to the service's environment and fill in the secrets there. Never commit `.env`, bot tokens or OAuth client secrets.

Required:

- `DATABASE_URL`
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

For the dashboard, set Vercel's Root Directory to `apps/dashboard`. For WispByte, run the bot workspace from `apps/bot` with `npm run build` and `npm start`, or run the root workspace script documented by the host.

## Database

Generate Prisma Client:

```bash
npx prisma generate --schema packages/core/prisma/schema.prisma
```

For a new development database, apply the schema with your preferred Prisma migration workflow. Keep production migrations reviewed before applying them.

## Discord setup

Create a Discord application in the Developer Portal, add a bot user, configure the OAuth2 redirect URL as:

`https://YOUR-DASHBOARD-DOMAIN/api/auth/callback/discord`

Enable only the intents your implementation needs. Slash commands are the primary command surface; Discord also provides server-side command permissions through Integrations. citeturn900563search11

## Deployment

Dashboard: Vercel → Root Directory `apps/dashboard`.

Bot: WispByte → persistent Node.js process running `apps/bot`.

Database: managed PostgreSQL accessible to both services.

WispByte host power Start/Stop controls must only be enabled once an official host API integration is configured. Otherwise DRP Control exposes safe bot-level restart and maintenance operations rather than faking host power state.

## Current state

The repository now contains the production-oriented architecture, Prisma models, OAuth route, secure guild authorization helpers, live dashboard API, premium dashboard UI, shared command registry, bot command engine, heartbeats, audit logging and dashboard-to-bot control queue.
