import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export async function withTestServer<T>(
  mode: 'development' | 'production',
  test: (base: string) => Promise<T>,
  env?: NodeJS.ProcessEnv,
  portSource: 'env' | 'argument' = 'env',
) {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port.');
  const { port } = address;
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));

  const cli = portSource === 'argument' ? ['--port', String(port)] : [];
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts', ...cli], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://areawise_test@127.0.0.1:1/areawise_test',
      GEMINI_API_KEY: '',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      ...env,
      NODE_ENV: mode,
      HOST: '127.0.0.1',
      PORT: portSource === 'env' ? String(port) : 'unusable-unless-overridden',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  const collect = (chunk: Buffer) => { logs = (logs + chunk.toString()).slice(-8000); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const done = once(child, 'exit');
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && child.exitCode === null) {
      const response = await fetch(base + '/api/v1/health', {
        signal: AbortSignal.timeout(1000),
      }).catch(() => undefined);
      if (response?.ok) return await test(base);
      await delay(75);
    }
    throw new Error(`The ${mode} server did not start.\n${logs}`);
  } finally {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
    await done;
  }
}
