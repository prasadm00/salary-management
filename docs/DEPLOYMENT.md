# Deployment

Free hosting: **Neon** (PostgreSQL) and **Render** (one web service that serves both the API and the web app).
No payment details are needed.

## 1. Create the database (Neon)
1. Sign up at https://neon.tech and create a project.
2. Copy the **connection string**. It contains the password, so keep it private.

## 2. Create the tables and add the data
Run on your computer, with the Neon address:
```bash
export DATABASE_URL="<your Neon connection string>"
npm ci
npm run db:generate -w api
npm run db:deploy -w api                  # creates the tables
SEED_CONFIRM=yes npm run seed -w api      # adds 10,000 fictional employees (confirmation needed on a remote database)
```

## 3. Create the web service (Render)
1. Push the repo to GitHub.
2. On https://render.com choose **New > Blueprint** and pick the repo. Render reads `render.yaml`.
3. When asked, enter `DATABASE_URL` (the Neon connection string).
4. Deploy. The first build takes a few minutes.

The web app and the API share one address, so no CORS setting is needed.
Migrations are applied automatically at each start.

## 4. Check it
Open the Render address. Check the dashboard, a search, and a salary change.
Or run `APP_URL=https://<your-app>.onrender.com node docs/qa/smoke.mjs` (see `docs/qa/README.md`).
The smoke test changes one salary, so reseed afterwards (step 2).

## 5. Keep it awake (optional)
The free service sleeps after 15 minutes and takes about a minute to wake up.
A free monitor such as UptimeRobot can call `/api/health` every 5 minutes.

## Updating
Push to `main`. Render rebuilds and redeploys.

## Problems
| Problem | Fix |
| --- | --- |
| First page is slow | The free server was asleep. Wait a minute. |
| Build fails | Read the build log in Render. Check that `buildCommand` kept `--include=dev`. |
| "Cannot reach the database" | Check `DATABASE_URL`. It must end in `?sslmode=require` for Neon. |
| Empty tables | Run the seed (step 2). |
