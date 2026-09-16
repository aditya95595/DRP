# DRP deployment plan

## PostgreSQL

Use any managed PostgreSQL provider that supplies a `DATABASE_URL`. Run Prisma generation/migrations from the repository root.

## Discord bot on WispByte

Required environment variables:

- `DATABASE_URL`
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `BOT_STATUS`
- `BOT_ACTIVITY`

Start command after building: `node apps/bot/dist/index.js`.

Keep the bot under WispByte's process manager so a graceful exit from the dashboard's restart workflow can be brought back automatically. Do not expose the Discord token to the dashboard or browser.

## Dashboard on Vercel

Set the same `DATABASE_URL` plus:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Deploy `apps/dashboard` as the Next.js application (or configure the Vercel root directory accordingly).

## Configuration workflow

The intended production workflow is:

1. Dashboard authenticates the Discord administrator.
2. Server-side authorization verifies access to the selected guild.
3. Settings are validated server-side.
4. A new `ConfigVersion` is written to PostgreSQL.
5. The bot reloads configuration on restart (and may safely live-refresh selected values).
6. Audit logs record who changed what.

## WispByte Start/Stop

Do not implement fake host power controls. If WispByte provides a supported API for the specific hosting account, add a server-side adapter using secrets. Otherwise, the dashboard should provide bot `Restart` and `Maintenance` controls only.
