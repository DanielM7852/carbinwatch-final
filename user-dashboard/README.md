# CarbinWatcher user dashboard

Next.js app (Vercel + DynamoDB). Run all commands from this directory.

```bash
npm install
cp .env.example .env.local   # add secrets; never commit .env.local
npm run dev
```

## Vercel

Set **Root Directory** to `user-dashboard` in the Vercel project so builds run from this folder. Add the same environment variables as in `.env.example`.
