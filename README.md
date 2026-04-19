# carbinwatcher-final

Household waste dashboard (Next.js on Vercel). Application code lives in **`user-dashboard/`**.

## Local setup

```bash
cd user-dashboard
npm install
cp .env.example .env.local
```

Edit `user-dashboard/.env.local` with your AWS and DynamoDB values. **Do not commit `.env.local`** — it is gitignored (it lives only under `user-dashboard/` and never appears in `git status` when staged).

From the **repo root** you can also run (after `npm install` inside `user-dashboard`):

```bash
npm run dev
```

Or from `user-dashboard`: `npm run dev`. Open [http://localhost:3000](http://localhost:3000).

## GitHub

Create a new repository named `carbinwatcher-final`, then from this repo root:

```bash
git remote add origin https://github.com/<you>/carbinwatcher-final.git
git branch -M main
git add -A
git commit -m "Initial commit: user-dashboard Next.js app"
git push -u origin main
```
