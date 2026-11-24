import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { parseTestCluster } from './test-db-config';
import { withTestServer } from './http-test-server';
import type { CatalogueCoverage, PublishedObservation } from '../src/types';

const cluster = parseTestCluster();
const template = process.env.AREAWISE_CATALOGUE_TEST_TEMPLATE || 'areawise_preview';
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!/^areawise_[a-z0-9_]{1,40}$/.test(template) || !emulator || !/^127\.0\.0\.1:\d+$/.test(emulator)) {
  throw new Error('Use a disposable local catalogue database and a loopback Firebase Auth emulator.');
}
const project = 'demo-areawise-local';
const database = 'areawise_product_' + randomUUID().replaceAll('-', '');
const password = randomUUID();
const webhookSecret = 'disposable-local-product-webhook';
const testEmailDomain = 'example.test';
const adminDb = new Pool({ connectionString: cluster.href, connectionTimeoutMillis: 5000 });
const firebase = initializeApp({ projectId: project }, 'product-test');
const auth = getAuth(firebase);
const accountIds: string[] = [];

interface Account { email: string; uid: string; token: string }

async function user(label: string, claims?: Record<string, boolean>): Promise<Account> {
  const email = label + '-' + randomUUID().slice(0, 8) + '@' + testEmailDomain;
  const record = await auth.createUser({ email, password, displayName: label, emailVerified: true });
  accountIds.push(record.uid);
  if (claims) await auth.setCustomUserClaims(record.uid, claims);
  const response = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-local`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  const { idToken } = await response.json();
  assert.ok(idToken);
  return { email, uid: record.uid, token: idToken };
}

async function request(base: string, path: string, options: {
  status?: number; account?: Account; method?: string; body?: object;
} = {}) {
  const response = await fetch(base + '/api/v1' + path, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.account ? { Authorization: 'Bearer ' + options.account.token } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  assert.equal(response.status, options.status ?? 200, `${options.method ?? 'GET'} ${path}: ${text.slice(0, 500)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}

const write = (account: Account, body?: object, method = 'POST', status = 200) => ({ account, body, method, status });

const sigra = 'geo-10546713';
const kolkata = 'geo-1275004';
const bengaluru = 'geo-1277333';
const mumbai = 'geo-1275339';
const chennai = 'geo-1264527';

async function publicProduct(base: string) {
  await request(base, '/ready');
  const country: CatalogueCoverage = await request(base, '/locations/coverage');
  assert.ok(country.totals.places > 500000);
  assert.ok(country.totals.pincodes > 19000);
  assert.equal(country.sources.length, 2);
  assert.ok(country.sources.every((source: { licenseUrl: string }) => source.licenseUrl === 'https://creativecommons.org/licenses/by/4.0/'));
  assert.equal(country.areas.filter((area) => area.name !== null).length, 36);
  for (const count of ['places', 'postalEntries', 'facilities'] as const) {
    assert.equal(country.areas.reduce((sum, area) => sum + area[count], 0), country.totals[count]);
  }
  assert.ok(country.areas.some((area) => area.name === 'Arunachal Pradesh' && area.places > 0 && area.postalEntries > 0));
  const delhi = await request(base, '/locations/coverage?region=Delhi');
  assert.equal(delhi.region, 'National Capital Territory of Delhi');
  for (const [region, districts] of [['Ladakh', ['Leh', 'Kargil']], ['Telangana', ['Peddapalli']]] as const) {
    const territory: CatalogueCoverage = await request(base, `/locations/coverage?region=${region}`);
    for (const district of districts) {
      assert.ok(territory.areas.some((area) => area.name === district && area.postalEntries > 0));
    }
  }
  const jammu: CatalogueCoverage = await request(base, '/locations/coverage?region=Jammu%20%26%20Kashmir');
  assert.ok(jammu.areas.every((area) => area.name !== 'Kargil' && area.name !== 'Leh'));
  const region = await request(base, '/locations/coverage?region=Uttar%20Pradesh');
  assert.ok(region.areas.some((area: { name: string }) => area.name === 'Varanasi'));
  assert.ok(region.totals.places > 0 && region.totals.places < country.totals.places);
  await request(base, '/locations/coverage?region=Unknown', { status: 404 });
  await request(base, '/locations/coverage?region=a&region=b', { status: 400 });
  console.log('PASS all 36 states and union territories, district coverage, and dated source snapshots');
  const featured = await request(base, '/locations/search');
  assert.ok(featured.total >= 4);
  const results = await request(base, '/locations/search?q=Sigra');
  assert.ok(results.results.some((place: { id: string }) => place.id === sigra));
  const postal = await request(base, '/locations/search?q=221010');
  assert.ok(postal.total > 0);
  assert.ok(postal.results.every((place: { pincode: string; kind: string }) => place.pincode === '221010' && place.kind === 'postal'));
  const bengali = await request(base, '/locations/search?q=' + encodeURIComponent('কলকাতা'));
  assert.ok(bengali.results.some((place: { id: string }) => place.id === kolkata));
  const restricted = await request(base, '/locations/search?q=Mumbai&city=Karnataka');
  assert.equal(restricted.total, 0);
  console.log('PASS real nationwide name, PIN, Bengali alias and regional catalogue search');

  const place = await request(base, '/locations/sigra');
  assert.equal(place.id, sigra);
  assert.equal(place.scores.overallScore, null);
  assert.equal(place.scores.coverageScore, 0);
  assert.equal(place.geography.source.publisher, 'GeoNames');
  assert.match(place.geography.source.snapshotSha256, /^[a-f0-9]{64}$/);
  assert.equal(place.bounds.length, 0);
  const facilities = await request(base, `/locations/${sigra}/facilities?category=transport&radius=5000`);
  assert.ok(facilities.length > 0);
  assert.ok(facilities.every((point: { distanceMeters: number; category: string; sourceUrl: string }) =>
    point.distanceMeters <= 5000 && point.category === 'transport' && /^https:\/\/www\.geonames\.org\//.test(point.sourceUrl)));
  const exact = await request(base, '/locations/resolve', { method: 'POST', body: { lat: 12.97194, lng: 77.59369 } });
  assert.equal(exact.city, '');
  assert.equal(exact.pincode, null);
  assert.equal(exact.scores.overallScore, null);
  await request(base, '/locations/resolve', { method: 'POST', body: { lat: 124, lng: 77 }, status: 400 });
  console.log('PASS source attribution, blocked synthetic scores, geographic pin lookup and PostGIS proximity');

  const compare = await request(base, '/comparisons', { method: 'POST', body: { ids: [sigra, mumbai, bengaluru, kolkata, chennai] } });
  assert.equal(compare.localities.length, 5);
  assert.equal(compare.comparisonMatrix.length, 7);
  assert.ok(compare.comparisonMatrix.every((field: { scores: object }) => Object.values(field.scores).every((value) => value === null)));
  await request(base, '/comparisons', { method: 'POST', body: { ids: [sigra, sigra] }, status: 400 });
  const report = await request(base, `/locations/${sigra}/report.html`);
  assert.match(report, /Sigra Evidence Brief/);
  assert.match(report, /GeoNames/);
  assert.match(report, /Withheld/);
  assert.match(report, /@page \{ size: A4/);
  console.log('PASS five-place comparison and printable evidence report');

  for (const language of ['en', 'hi', 'hinglish', 'bn']) {
    const answer = await request(base, '/ai/ask', { method: 'POST', body: { localityId: sigra, language, prompt: 'What records are available?' } });
    assert.equal(answer.mode, 'evidence_only');
    assert.equal(answer.providerStatus, 'not_configured');
    assert.ok(answer.citations.some((citation: { url: string }) => /geonames\.org\/10546713/.test(citation.url)));
    if (language === 'hi') assert.match(answer.answer, /चुने/);
    if (language === 'hinglish') assert.match(answer.answer, /Chuni/);
  }
  await request(base, '/ai/ask', { method: 'POST', body: { localityId: 'geo-0', prompt: 'Unknown area' }, status: 404 });
  console.log('PASS Copilot retrieves real evidence and labels the missing Gemini provider');
}

async function accountProduct(base: string, db: Pool, author: Account, reader: Account, admin: Account) {
  await request(base, '/me', { status: 401 });
  await request(base, '/admin/audit-logs', { account: reader, status: 403 });
  const sources = await request(base, '/admin/data-sources', { account: admin });
  assert.equal(sources.filter((source: { active: boolean }) => source.active).length, 2);
  await request(base, '/me/preferences', write(author, { language: 'hi', preferredProfile: 'student' }, 'PATCH', 204));
  await request(base, `/me/saved/${sigra}`, write(author, undefined, 'PUT', 204));
  await request(base, `/me/saved/${sigra}`, write(author, undefined, 'PUT', 204));
  const profile = await request(base, '/me', { account: author });
  assert.deepEqual(profile.savedLocalityIds, [sigra]);
  assert.equal(profile.language, 'hi');
  assert.equal(profile.preferredProfile, 'student');
  assert.deepEqual((await request(base, '/me', { account: reader })).savedLocalityIds, []);
  console.log('PASS Firebase emulator authentication, admin role, persisted settings and account-isolated bookmarks');

  const comparison = await request(base, '/me/comparisons', write(author, { title: 'Isolated comparison test', placeIds: [sigra, kolkata] }, 'POST', 201));
  await request(base, `/me/comparisons/${comparison.id}`, write(reader, undefined, 'DELETE', 404));
  assert.equal((await request(base, '/me', { account: author })).comparisons[0].id, comparison.id);

  const report = await request(base, '/community/reports', write(author, {
    localityId: sigra, category: 'drainage', title: 'Isolated fixture: drainage report',
    description: 'This record is only used in a disposable local test database.', submittedBy: 'Untrusted input',
  }, 'POST', 201));
  assert.equal(report.submittedBy, 'Community member');
  assert.equal(report.status, 'under_review');
  assert.equal((await request(base, `/community/reports?localityId=${sigra}`)).total, 0);
  assert.equal((await request(base, '/me/reports', { account: author })).reports[0].id, report.id);
  assert.equal((await request(base, '/me/reports', { account: reader })).reports.length, 0);
  await request(base, `/community/reports/${report.id}/moderate`, write(reader, { status: 'verified' }, 'PATCH', 403));
  await request(base, `/community/reports/${report.id}/moderate`, write(admin, { status: 'verified', officialResponse: 'Local test moderation' }, 'PATCH'));
  assert.equal((await request(base, `/community/reports?localityId=${sigra}`)).total, 1);
  const votes = await Promise.all([1, 2].map(() => request(base, `/community/reports/${report.id}/vote`, write(reader))));
  assert.deepEqual(votes.map((vote) => vote.upvotes), [1, 1]);
  const map = await request(base, `/locations/${sigra}/map`);
  assert.equal(map.communityReports[0].id, report.id);
  console.log('PASS private submission, role-gated moderation, public map publication and concurrent vote deduplication');

  const chat = await request(base, '/ai/ask', write(author, {
    localityId: sigra, language: 'hinglish', prompt: 'Source kya hai?', saveConversation: true,
  }));
  assert.ok(chat.conversationId);
  await request(base, `/ai/conversations/${chat.conversationId}`, { account: reader, status: 404 });
  const followUp = await request(base, '/ai/ask', write(author, {
    localityId: sigra, prompt: 'Which source record?', recentQuestions: ['Source kya hai?'],
    saveConversation: true, conversationId: chat.conversationId,
  }));
  assert.equal(followUp.conversationId, chat.conversationId);
  assert.equal((await request(base, `/ai/conversations/${chat.conversationId}`, { account: author })).messages.length, 4);
  await request(base, `/ai/conversations/${chat.conversationId}`, write(author, undefined, 'DELETE', 204));
  await request(base, `/ai/conversations/${chat.conversationId}`, { account: author, status: 404 });
  console.log('PASS opt-in conversation persistence, ownership and deletion');

  await request(base, '/workspaces', write(reader, { name: 'Forbidden workspace' }, 'POST', 403));
  const workspace = await request(base, '/workspaces', write(author, { name: 'Isolated B2B test' }, 'POST', 201));
  await request(base, `/workspaces/${workspace.id}`, { account: reader, status: 404 });
  const project = await request(base, `/workspaces/${workspace.id}/projects`, write(author, { name: 'Evidence project', placeIds: [sigra, mumbai] }, 'POST', 201));
  const invite = await request(base, `/workspaces/${workspace.id}/invites`, write(author, { role: 'viewer' }, 'POST', 201));
  await request(base, '/workspaces/accept-invite', write(reader, { token: invite.token }));
  await request(base, '/workspaces/accept-invite', write(reader, { token: invite.token }, 'POST', 404));
  assert.equal((await request(base, `/workspaces/${workspace.id}`, { account: reader })).role, 'viewer');
  await request(base, `/workspaces/${workspace.id}/projects`, write(reader, { name: 'Denied', placeIds: [sigra, mumbai] }, 'POST', 403));
  const csv = await request(base, `/workspaces/${workspace.id}/projects/${project.id}/export.csv`, { account: reader });
  assert.match(csv, /GeoNames/);
  assert.match(csv, /Mumbai/);
  console.log('PASS professional project export, one-use invitation and workspace isolation');

  await billingProduct(base, db, author, reader);
  await observationProduct(base, db, admin, reader);
}

async function billingProduct(base: string, db: Pool, author: Account, reader: Account) {
  const byUid = await db.query<{ id: number }>('SELECT id FROM users WHERE uid = $1', [author.uid]);
  const userId = byUid.rows[0].id;
  const reportCheckout = randomUUID();
  const subscriptionCheckout = randomUUID();
  const nonce = randomUUID().replaceAll('-', '').slice(0, 12);
  const orderId = 'order_Test' + nonce;
  const subId = 'sub_Test' + nonce;
  const paymentId = 'pay_Test' + nonce;
  // These handles exist only in the disposable provider-event test database. No provider calls are made.
  await db.query(`
    INSERT INTO billing_checkouts (id, user_id, request_key, kind, sku, title, amount_paise, provider_id, place_id, state)
    VALUES ($1,$2,$3,'report','test-report','Fixture evidence report',1000,NULL,$4,'preparing')
  `, [reportCheckout, userId, randomUUID(), sigra]);
  await db.query(`
    INSERT INTO billing_checkouts (id, user_id, request_key, kind, sku, title, amount_paise, provider_id, provider_plan_id, tier, state)
    VALUES ($1,$2,$3,'subscription','test-pro','Fixture Professional',2000,NULL,'plan_TestOnly','professional','needs_review')
  `, [subscriptionCheckout, userId, randomUUID()]);
  const captureAt = Math.floor(Date.now() / 1000);
  const payment = { id: paymentId, order_id: orderId, amount: 1000, currency: 'INR', status: 'captured', captured: true, created_at: captureAt };
  async function event(id: string, type: string, payload: object, signed = true, status = 200) {
    const body = JSON.stringify({ event: type, created_at: captureAt, payload });
    const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
    const result = await fetch(base + '/api/v1/billing/webhook/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-Razorpay-Event-Id': id,
        'X-Razorpay-Signature': signed ? signature : '0'.repeat(64),
      },
      body,
    });
    assert.equal(result.status, status, await result.clone().text());
    return result.json();
  }
  const authOnly = { account: author };
  await request(base, `/billing/checkouts/${reportCheckout}/report.csv`, { ...authOnly, status: 404 });
  await event('bad-' + nonce, 'payment.captured', { payment: { entity: payment } }, false, 401);
  const paymentOnly = { payment: { entity: payment } };
  const paidOrder = { ...paymentOnly, order: { entity: {
    id: orderId, receipt: 'aw_' + reportCheckout.replaceAll('-', ''), amount: 1000, currency: 'INR',
  } } };
  await event('capture-' + nonce, 'payment.captured', paymentOnly, true, 503);
  const capture = await event('paid-' + nonce, 'order.paid', paidOrder);
  assert.equal(capture.applied, true);
  assert.equal((await event('capture-' + nonce, 'payment.captured', paymentOnly)).applied, false);
  assert.equal((await event('capture-' + nonce, 'payment.captured', { payment: { entity: payment } })).duplicate, true);
  await event('latefail-' + nonce, 'payment.failed', { payment: { entity: { ...payment, status: 'failed' } } });
  assert.equal((await request(base, '/billing/history', authOnly)).charges.length, 1);
  await request(base, `/billing/checkouts/${reportCheckout}/report.csv`, { account: reader, status: 404 });
  assert.match(await request(base, `/billing/checkouts/${reportCheckout}/report.csv`, authOnly), /GeoNames/);

  await event('refund-' + nonce, 'refund.processed', { refund: { entity: {
    id: 'rfnd_Test' + nonce, payment_id: paymentId, amount: 1000, status: 'processed', created_at: captureAt,
  } } });
  await request(base, `/billing/checkouts/${reportCheckout}/report.csv`, { ...authOnly, status: 404 });
  const entity = {
    id: subId, plan_id: 'plan_TestOnly', current_end: captureAt + 86400,
    notes: { areawise_checkout_id: subscriptionCheckout },
  };
  await event('sub-' + nonce, 'subscription.charged', {
    subscription: { entity }, payment: { entity: { ...payment, id: 'pay_Sub' + nonce, order_id: undefined, amount: 2000 } },
  });
  assert.equal((await request(base, '/billing/history', authOnly)).tier, 'professional');
  await event('cancel-' + nonce, 'subscription.cancelled', { subscription: { entity } });
  assert.equal((await request(base, '/billing/history', authOnly)).tier, null);
  console.log('PASS early signed payment reconciliation, event replay, owner-only export, refund and subscription entitlement');
}

async function observationProduct(base: string, db: Pool, admin: Account, reader: Account) {
  const review = '/admin/observations';
  const profile = `/locations/${mumbai}`;
  // NASA Langley Research Center POWER Daily API v2.10.5, accessed 2026-11-24.
  // MERRA-2 T2M daily value in UTC at the Mumbai catalogue point.
  const measurement = {
    placeId: mumbai, category: 'environment', metric: 'Daily air temperature at 2 metres',
    value: '24.37', unit: '°C', observationDate: '2025-01-15', publisher: 'NASA Langley Research Center POWER',
    referenceUrl: 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=SB&longitude=72.88261&latitude=19.07283&start=20250115&end=20250115&format=JSON&time-standard=UTC',
    licenseUrl: 'https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance',
    geographicLevel: 'MERRA-2 model grid cell covering the Mumbai catalogue point',
    limitations: 'NASA POWER Daily API v2.10.5, accessed 2026-11-24. A daily UTC estimate on a model grid with limited representation of neighbourhood conditions.',
    commercialReuseConfirmed: true, geographicMatchConfirmed: true,
  };
  const before = await request(base, profile);
  assert.deepEqual(before.center, { lat: 19.07283, lng: 72.88261 });
  const coverageBefore: CatalogueCoverage = await request(base, '/locations/coverage?region=Maharashtra');
  await request(base, review, { status: 401 });
  await request(base, review, { account: reader, status: 403 });
  await request(base, review, write(reader, measurement, 'POST', 403));
  for (const invalid of [
    { observationDate: '2025-02-29' }, { observationDate: '2099-12-31' },
    { commercialReuseConfirmed: false }, { geographicMatchConfirmed: false },
    { referenceUrl: 'https://user:secret@example.test' }, { licenseUrl: 'http://127.0.0.1' },
    { category: 'toString' }, { geographicLevel: '' },
  ]) {
    await request(base, review, write(admin, { ...measurement, ...invalid }, 'POST', 400));
  }
  await request(base, review, write(admin, { ...measurement, placeId: 'geo-0' }, 'POST', 404));

  const submit = () => fetch(base + '/api/v1' + review, {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(measurement),
  });
  const responses = await Promise.all([submit(), submit()]);
  const [published, duplicate] = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201], JSON.stringify([published, duplicate]));
  assert.equal(duplicate.id, published.id);
  assert.equal(published.status, 'published');
  assert.equal(published.placeId, mumbai);
  assert.equal(published.referenceUrl, measurement.referenceUrl);
  const correction = { ...measurement, limitations: measurement.limitations + ' Spatial resolution is approximately 0.5° by 0.625°.' };
  await request(base, review, write(admin, correction, 'POST', 409));
  const list = await request(base, `${review}?placeId=${mumbai}`, { account: admin });
  assert.ok(list.observations.some((entry: { id: string; status: string }) => entry.id === published.id && entry.status === 'published'));

  const updated = await request(base, profile);
  assert.ok(updated.observations.some((entry: PublishedObservation) =>
    entry.id === published.id && entry.value === '24.37' && entry.geographicLevel === measurement.geographicLevel));
  assert.equal(updated.scores.overallScore, null);
  const report = await request(base, `${profile}/report.html`);
  assert.match(report, /24\.37 °C/);
  assert.match(report, /NASA Langley Research Center POWER/);
  const ask = () => request(base, '/ai/ask', {
    method: 'POST', body: { localityId: mumbai, prompt: 'What evidence is available for this place?' },
  });
  const cited = (answer: { citations: { kind: string; url: string }[] }) => answer.citations.some((item) =>
    item.kind === 'reviewed_observation' && item.url === measurement.referenceUrl);
  assert.ok(cited(await ask()));
  const coverageAfter: CatalogueCoverage = await request(base, '/locations/coverage?region=Maharashtra');
  assert.equal(coverageAfter.totals.observations, coverageBefore.totals.observations + 1);
  const withdrawals = `${review}/${published.id}/withdraw`;
  const reason = 'Clarify the source grid resolution in the published limitations.';
  await request(base, withdrawals, write(reader, { reason }, 'POST', 403));
  await request(base, withdrawals, write(admin, { reason: ' ' }, 'POST', 400));
  const attempts = await Promise.all([1, 2].map(() => request(base, withdrawals, write(admin, { reason }))));
  assert.ok(attempts.every((entry) => entry.status === 'withdrawn'));
  assert.ok(!(await request(base, profile)).observations.some((entry: PublishedObservation) => entry.id === published.id));
  assert.ok(!(await request(base, `${profile}/report.html`)).includes(measurement.metric));
  assert.ok(!cited(await ask()));
  const coverageWithdrawn: CatalogueCoverage = await request(base, '/locations/coverage?region=Maharashtra');
  assert.equal(coverageWithdrawn.totals.observations, coverageBefore.totals.observations);
  await request(base, review, write(admin, measurement, 'POST', 409));
  const replacement = await request(base, review, write(admin, correction, 'POST', 201));
  assert.notEqual(replacement.id, published.id);
  assert.equal(replacement.value, published.value);
  const { rows } = await db.query(`
    SELECT action, actor, details FROM audit_logs WHERE entity_id = $1 ORDER BY id
  `, [published.id]);
  assert.deepEqual(rows.map((row) => row.action), ['observation_published', 'observation_withdrawn']);
  assert.ok(rows.every((row) => row.actor === admin.uid && row.details.placeId === mumbai));
  assert.equal(rows[1].details.reason, reason);
  console.log('PASS administrator evidence review, concurrent publish and withdrawal, attribution, coverage, reports, Copilot citations and audit');
}

let created = false;
try {
  await adminDb.query(`CREATE DATABASE "${database}" TEMPLATE "${template}"`);
  created = true;
  const target = new URL(cluster.href);
  target.pathname = '/' + database;
  const baseEnv = { DATABASE_URL: target.href };
  await withTestServer('production', publicProduct, baseEnv);

  const [author, reader, admin] = await Promise.all([user('Researcher', { professional: true }), user('Viewer'), user('Moderator', { admin: true })]);
  const productDb = new Pool({ connectionString: target.href });
  try {
    await withTestServer('development', (base) => accountProduct(base, productDb, author, reader, admin), {
      ...baseEnv, FIREBASE_PROJECT_ID: project, FIREBASE_AUTH_EMULATOR_HOST: emulator,
      RAZORPAY_KEY_ID: 'rzp_test_DisposableFixture', RAZORPAY_KEY_SECRET: 'local-only', RAZORPAY_WEBHOOK_SECRET: webhookSecret,
      RAZORPAY_SANDBOX_PLANS: '',
    });
  } finally {
    await productDb.end();
  }
} finally {
  for (const uid of accountIds) await auth.deleteUser(uid).catch(() => undefined);
  await deleteApp(firebase);
  if (created) await adminDb.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await adminDb.end();
}
