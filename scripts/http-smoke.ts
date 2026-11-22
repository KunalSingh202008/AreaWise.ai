import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { withTestServer } from './http-test-server';

const browser = { headers: { Accept: 'text/html,application/xhtml+xml' } };
const jpegNames = (await readdir('public/assets/images')).filter((name) => name.endsWith('.jpg'));

await withTestServer('production', async (base) => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /id="root"/);
  const injectedAssets = [...html.matchAll(/(?:src|href)="(\/assets\/(?:[^"]+\.(?:js|css)))"/g)].map((match) => match[1]);
  assert.ok(injectedAssets.some((asset) => asset.endsWith('.js')));
  assert.ok(injectedAssets.some((asset) => asset.endsWith('.css')));
  for (const asset of injectedAssets) {
    const response = await fetch(base + asset);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /javascript|css/);
  }
  console.log('PASS production document and built JavaScript/CSS');

  for (const name of jpegNames) {
    const response = await fetch(`${base}/assets/images/${name}`);
    assert.equal(response.status, 200, name);
    assert.match(response.headers.get('content-type') || '', /^image\/jpeg/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], name);
  }
  assert.equal(jpegNames.length, 4);
  console.log('PASS all four production locality images');

  const apiMiss = await fetch(base + '/api/v1/unavailable', browser);
  assert.equal(apiMiss.status, 404);
  assert.deepEqual(await apiMiss.json(), { error: 'API route not found' });
  assert.equal((await fetch(base + '/assets/missing-no-extension', browser)).status, 404);
  assert.equal((await fetch(base + '/favicon-missing.ico', browser)).status, 404);
  assert.equal((await fetch(base + '/localities/sigra')).status, 404);
  assert.equal((await fetch(base + '/localities/sigra', { headers: { Accept: 'text/html;q=0' } })).status, 404);
  const deepLink = await fetch(base + '/localities/sigra', browser);
  assert.equal(deepLink.status, 200);
  assert.match(await deepLink.text(), /id="root"/);
  console.log('PASS API and asset 404s and HTML navigation fallback');

  const malformed = await fetch(base + '/api/v1/locations/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Invalid JSON body' });
  const invalidQuery = await fetch(base + '/api/v1/locations/search?q=a&q=b');
  assert.equal(invalidQuery.status, 400);
  console.log('PASS malformed JSON and repeated search filter handling');

  const admin = await fetch(base + '/api/v1/admin/audit-logs');
  assert.equal(admin.status, 401);
  assert.ok(admin.headers.get('x-request-id'));
  const moderation = await fetch(base + '/api/v1/community/reports/missing/moderate', { method: 'PATCH' });
  assert.equal(moderation.status, 401);
  console.log('PASS anonymous administrator and moderation requests rejected');

  const readiness = await fetch(base + '/api/v1/ready');
  assert.equal(readiness.status, 503);
  assert.equal((await fetch(base + '/api/v1/health')).status, 200);
  console.log('PASS database-unavailable readiness and liveness separation');
});

await withTestServer('development', async (base) => {
  const page = await fetch(base, browser);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /@vite\/client/);
  assert.equal((await fetch(base + '/api/v1/unavailable', browser)).status, 404);
  console.log('PASS Vite development startup and API routing');
}, undefined, 'argument');
