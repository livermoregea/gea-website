import { spawn } from 'node:child_process';
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
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], {
  stdio: 'inherit', env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', () => { process.exitCode = 1; });
server.on('exit', code => { process.exitCode = code ?? 0; });
