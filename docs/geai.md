# AI workspace summaries retired

AI dashboard briefings and generated descriptions have been removed. Officer and admin dashboards show ordinary permission-filtered workspace records; task, attendance, score, and weekly digest features remain available. Weekly digests are snapshots of saved records and do not call an AI model.

AI usage is retained for task submission clarification and PEET review in the website and Discord. Keep `GROQ_API_KEY` and `GROQ_PEET_MODEL` configured for those workflows; do not remove the shared Groq credentials.

The old `/api/operations/geai` endpoint returns HTTP 410 without reading or queuing cache work. The old `/api/operations/geai/refresh` endpoint still requires `CRON_SECRET`, then returns HTTP 410 with zero attempted updates and makes no database or model calls. The Vercel summary cron and local development summary timer are removed. Existing GEAI database tables can remain for history; no SQL migration or data deletion is required for this removal.

Deploy the updated website and `vercel.json` to stop production summary generation. Any external scheduler targeting the retired endpoint can be removed; after deployment it cannot generate summaries even if it keeps calling the endpoint. Other cron jobs and `CRON_SECRET` remain needed for features such as Discord notifications.

Verification: `node --test tests/geai.cjs tests/gea-operations-ui.cjs tests/peet-ai.cjs` and `npx tsc --noEmit`.
