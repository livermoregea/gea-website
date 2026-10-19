import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true);
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const portFlag = args.findIndex(arg => arg === '-p' || arg === '--port');
const inlinePort = args.find(arg => arg.startsWith('--port='))?.slice('--port='.length);
const port = portFlag >= 0 ? args[portFlag + 1] : inlinePort || process.env.PORT || '3000';
if (!/^\d+$/.test(port || '') || Number(port) < 1 || Number(port) > 65535) throw new Error('Use a valid development port.');
if (portFlag < 0 && !inlinePort) args.push('--port', port);
// A temporary secret is shared only by this development process and its child.
// No credentials are written to the repository or printed in the terminal.
const secret = randomBytes(32).toString('hex');
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], {
  stdio: 'inherit', env: { ...process.env, CRON_SECRET: secret },
});
let timer;
let running = false;
const enabled = process.env.GEAI_DEV_SCHEDULER !== '0' && process.env.GROQ_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY;
async function tick() {
  if (running || server.exitCode !== null) return;
  running = true;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/operations/geai/refresh`, {
      headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.attempted) console.log(`[GEAI] Background descriptions: ${result.updated}/${result.attempted} updated.`);
    } else if (response.status === 503) {
      console.warn('[GEAI] Background generation unavailable. Check GEAI database setup and server configuration.');
    }
  } catch { /* Next may still be starting; try again at the next tick. */ }
  finally { running = false; }
}
if (enabled) {
  // Only this timer calls the worker. Page loads and Refresh remain provider-free.
  // SQL caps generation at 24 / day, with a six-hour normal interval and one bounded failure retry.
  timer = setInterval(tick, 60000);
  console.log('[GEAI] Local background worker enabled; checks queued descriptions every minute.');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (timer) clearInterval(timer);
  server.kill(signal);
});
server.on('error', () => { if (timer) clearInterval(timer); process.exitCode = 1; });
server.on('exit', code => { if (timer) clearInterval(timer); process.exitCode = code ?? 0; });
