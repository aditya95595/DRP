# DRP — Emergency Hamburg Roleplay Control

A Discord bot + premium web dashboard for an Emergency Hamburg Roblox roleplay community.

## Architecture

- **Bot:** Node.js + discord.js, intended for WispByte
- **Dashboard:** Next.js, intended for Vercel
- **Database:** PostgreSQL + Prisma
- **Auth:** Discord OAuth2 (to be wired into dashboard deployment)
- **Shared registry:** every bot command is defined in `packages/core/commands.js`

## Categories

- 🎮 Roleplay
- 👮 Departments
- 📋 Records
- 📢 Sessions & Announcements
- 📊 Statistics
- 🏆 Activity
- ⚙️ Configuration
- 🤖 Bot
- 🧰 Utility

Moderation, support, Roblox-dispatch/911 and generic ticket systems are intentionally not part of this project.

## Development

1. Copy `.env.example` to the appropriate service environment.
2. Create a PostgreSQL database.
3. Install dependencies with `npm install`.
4. Run Prisma migrations/generation.
5. Start the dashboard and bot independently.

## Deployment

The dashboard is designed for Vercel. The bot is designed for a persistent Node.js process on WispByte. The database is shared by both services.

A WispByte host power Start/Stop control must only be enabled when an official WispByte API is configured; otherwise the dashboard exposes safe bot restart/maintenance controls instead of pretending to power off the host.

## Status

Initial production-oriented scaffold created. Core command registry, database schema, dashboard shell, health endpoint, and bot bootstrap are included. Feature modules can now be expanded against the shared schema without replacing the architecture.
