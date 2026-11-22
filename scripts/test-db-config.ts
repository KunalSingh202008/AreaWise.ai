export function parseTestCluster(value = process.env.PG_TEST_URL) {
  if (!value) {
    throw new Error('Set PG_TEST_URL to a disposable local PostgreSQL server before running database tests.');
  }
  const url = new URL(value);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.search || url.hash || url.pathname !== '/postgres') {
    throw new Error('PG_TEST_URL must point to the postgres database on an isolated loopback PostgreSQL server.');
  }
  return url;
}

export function assertIsolatedTestDatabase() {
  const cluster = parseTestCluster();
  const target = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
  if (process.env.AREAWISE_RUN_DB_TESTS !== '1' || target.host !== cluster.host ||
      target.username !== cluster.username || target.password !== cluster.password ||
      target.protocol !== cluster.protocol || target.search || target.hash ||
      !/^\/areawise_test_[a-f0-9]{32}$/.test(target.pathname)) {
    throw new Error('Database integration fixtures must run through npm run test:db.');
  }
}
