import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { requireAdmin } from './server/auth';
import { pool } from './src/db';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  discoverPlaces, getGeographyImports, getPublicLocality,
  getNearbyCatalogueFacilities, inspectCoordinate,
} from './server/geography';
import { getCommunityReportsFromDb } from './src/db/repositories/communityReportRepository';
import { accountRoutes } from './server/accounts';
import { communityRoutes, listModerationReports } from './server/community';
import { HttpError, route } from './server/http';
import { renderEvidenceBrief } from './server/reports';
import { billingRoutes, billingWebhook, sandboxBillingSummary } from './server/billing';
import { workspaceRoutes } from './server/workspaces';
import {
  getAuditLogsFromDb,
} from './src/db/repositories/auditLogRepository.ts';
import { getActiveScoringWeightsFromDb } from './src/db/repositories/scoringMethodologyRepository.ts';
import { copilotRoutes } from './server/copilot';
import { Locality } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  const rawPort = portArgIndex === -1 ? process.env.PORT ?? '3000' : process.argv[portArgIndex + 1];
  const port = Number(rawPort);
  if (!rawPort || !/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error('Set PORT or --port to an integer between 1 and 65535.');
  }
  return port;
}

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use('/api', (req, res, next) => {
  const requestId = randomUUID();
  const start = performance.now();
  res.set('X-Request-Id', requestId).set('Cache-Control', 'no-store');
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    console.info(JSON.stringify({
      event: 'http.request',
      requestId,
      method: req.method,
      route: req.route?.path ?? 'api',
      status: res.statusCode,
      durationMs: Math.round(performance.now() - start),
    }));
  });
  next();
});
app.use('/api/v1/admin', requireAdmin);
app.post('/api/v1/billing/webhook/razorpay', ...billingWebhook);
app.use(express.json({ limit: '128kb' }));
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
app.use('/api/v1/me', accountRoutes);
app.use('/api/v1/ai', copilotRoutes);
app.use('/api/v1/community', communityRoutes);
app.get('/api/v1/admin/community/reports', listModerationReports);
app.get('/api/v1/admin/billing', sandboxBillingSummary);


// ==========================================
// API ROUTES (/api/v1/...)
// ==========================================

// 1. Dynamic Location Resolution (Coordinates or Landmark) via PostGIS
app.post('/api/v1/locations/resolve', async (req: Request, res: Response) => {
  const { lat, lng, label } = req.body ?? {};

  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      (label !== undefined && (typeof label !== 'string' || label.length > 150))) {
    return res.status(400).json({
      error: 'Invalid coordinates',
      message: 'Latitude and longitude numeric values are required.',
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordinates are outside WGS84 limits.' });
  }

  try {
    const resolved = await inspectCoordinate({ lat, lng }, label);
    return res.json(resolved);
  } catch (error) {
    console.error('Error in /api/v1/locations/resolve:', error);
    return res.status(503).json({ error: 'Location resolution is temporarily unavailable.' });
  }
});

// 2. Location Search & Discovery (PostgreSQL / PostGIS backed)
app.get('/api/v1/locations/search', async (req: Request, res: Response) => {
  const { q = '', city: cityQuery = '' } = req.query;
  if (typeof q !== 'string' || typeof cityQuery !== 'string' || q.length > 150 || cityQuery.length > 100) {
    return res.status(400).json({ error: 'Use one locality query and one city filter.' });
  }
  const query = q.trim();
  const city = cityQuery.trim();

  try {
    const results = await discoverPlaces(query, city);
    return res.json({ total: results.length, results });

  } catch (error) {
    console.error('Error in /api/v1/locations/search:', error);
    return res.status(503).json({ error: 'The geography catalogue is temporarily unavailable.' });
  }
});

// 3. Locality Details (PostgreSQL backed)
app.get('/api/v1/locations/:id', async (req: Request, res: Response) => {
  try {
    const locality = await getPublicLocality(req.params.id);
    if (!locality) {
      return res.status(404).json({
        error: 'Locality Not Found',
        message: `The requested locality '${req.params.id}' is not in the active dataset.`,
      });
    }
    return res.json(locality);
  } catch (error) {
    console.error('Error in /api/v1/locations/:id:', error);
    return res.status(500).json({ error: 'Failed to fetch locality' });
  }
});

app.get('/api/v1/locations/:id/report.html', route(async (req, res) => {
  const locality = await getPublicLocality(req.params.id);
  if (!locality) throw new HttpError(404, 'Place unavailable.');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(renderEvidenceBrief(locality));
}));

// 4. Locality Score
app.get('/api/v1/locations/:id/score', async (req: Request, res: Response) => {
  try {
    const locality = await getPublicLocality(req.params.id, false);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }
    return res.json(locality.scores);
  } catch (error) {
    console.error('Error in /api/v1/locations/:id/score:', error);
    return res.status(500).json({ error: 'Failed to fetch locality score' });
  }
});

// 5. Locality Indicators
app.get('/api/v1/locations/:id/indicators', async (req: Request, res: Response) => {
  try {
    const locality = await getPublicLocality(req.params.id, false);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }
    return res.json(locality.indicators);
  } catch (error) {
    console.error('Error in /api/v1/locations/:id/indicators:', error);
    return res.status(500).json({ error: 'Failed to fetch indicators' });
  }
});

// 6. Locality Facilities (PostGIS Radial Geodesic Search)
app.get('/api/v1/locations/:id/facilities', async (req: Request, res: Response) => {
  try {
    const locality = await getPublicLocality(req.params.id, false);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }

    const { category, radius = '3000' } = req.query;
    const radiusMeters = Number(radius);
    if (typeof radius !== 'string' || !/^\d+$/.test(radius) || radiusMeters < 1 || radiusMeters > 5000 ||
        (category !== undefined && (typeof category !== 'string' ||
          !['all', 'healthcare', 'education', 'transport', 'parks', 'shopping', 'civic'].includes(category)))) {
      return res.status(400).json({ error: 'Use a radius from 1 to 5000 metres and a valid category.' });
    }
    const facilitiesList = await getNearbyCatalogueFacilities(
      locality.center,
      radiusMeters,
      category as string | undefined
    );

    return res.json(facilitiesList);
  } catch (error) {
    console.error('Error in /api/v1/locations/:id/facilities:', error);
    return res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// 7. Locality Map Geo-Data
app.get('/api/v1/locations/:id/map', async (req: Request, res: Response) => {
  try {
    const locality = await getPublicLocality(req.params.id);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }
    const reports = await getCommunityReportsFromDb({ localityId: locality.id, published: true });
    return res.json({
      center: locality.center,
      bounds: locality.bounds,
      facilities: locality.facilities,
      communityReports: reports,
    });
  } catch (error) {
    console.error('Error in /api/v1/locations/:id/map:', error);
    return res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// 8. Multi-Locality Comparison (PostgreSQL backed)
app.post('/api/v1/comparisons', async (req: Request, res: Response) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 5 ||
      !ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 150) ||
      new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) {
    return res.status(400).json({ error: 'Provide 2 to 5 distinct locality IDs to compare.' });
  }

  try {
    const found = await Promise.all(ids.map((id) => getPublicLocality(id, false)));
    const matched = found.filter((locality): locality is Locality => locality !== null);

    if (matched.length !== ids.length || new Set(matched.map((place) => place.id)).size !== matched.length) {
      return res.status(404).json({ error: 'One or more localities could not be found for comparison.' });
    }

    const categories = [
      { key: 'connectivity', label: 'Connectivity & Transit' },
      { key: 'healthcare', label: 'Healthcare Accessibility' },
      { key: 'education', label: 'Education Access' },
      { key: 'environment', label: 'Environmental Intelligence' },
      { key: 'civicInfrastructure', label: 'Civic Infrastructure' },
      { key: 'dailyAmenities', label: 'Daily Amenities' },
      { key: 'propertyMarketTransparency', label: 'Property Market Transparency' },
    ];

    const comparisonMatrix = categories.map((cat) => {
      const scores: Record<string, number | null> = {};
      matched.forEach((m) => {
        const val = (m.scores.categoryScores as any)[cat.key];
        scores[m.id] = val !== null && val !== undefined ? val : null;
      });
      return {
        categoryKey: cat.key,
        categoryLabel: cat.label,
        scores,
      };
    });

    return res.json({
      localities: matched,
      comparisonMatrix,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/v1/comparisons:', error);
    return res.status(500).json({ error: 'Failed to process comparison' });
  }
});

// 14. Admin: Data Sources Status
app.get('/api/v1/admin/data-sources', async (_req, res) => {
  try {
    return res.json(await getGeographyImports());
  } catch {
    return res.status(503).json({ error: 'Dataset records are temporarily unavailable.' });
  }
});

// 15. Admin: Scoring Weights Config (PostgreSQL backed)
app.get('/api/v1/admin/scoring-weights', async (_req: Request, res: Response) => {
  try {
    const weights = await getActiveScoringWeightsFromDb();
    return res.json(weights);
  } catch (error) {
    console.error('Error fetching scoring weights:', error);
    return res.status(500).json({ error: 'Failed to fetch scoring weights' });
  }
});

app.post('/api/v1/admin/scoring-weights', (_req, res) => {
  res.status(409).json({ error: 'Apply reviewed weight changes through a new scoring methodology version.' });
});

// 16. Admin: Dataset Ingestion / CSV Validator
app.post('/api/v1/admin/import-dataset', (_req: Request, res: Response) => {
  return res.status(501).json({
    error: 'Dataset ingestion requires a persistent importer with source verification.',
  });
});

// 17. Admin: Audit Logs (PostgreSQL backed)
app.get('/api/v1/admin/audit-logs', async (_req: Request, res: Response) => {
  try {
    const logs = await getAuditLogsFromDb(100);
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ==========================================
// STATIC FILES & VITE DEV INTEGRATION
// ==========================================
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/v1/ready', async (_req, res) => {
  try {
    const { rows: [row] } = await pool.query<{ has_schema: boolean }>(`
      SELECT PostGIS_Version(), to_regclass('public.geo_places') IS NOT NULL AS has_schema
    `);
    if (row?.has_schema) return res.json({ status: 'ready' });
  } catch {
    // Readiness failing does not affect liveness or expose connection details.
  }
  return res.status(503).json({ status: 'unavailable' });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use('/api', (error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  const status = (error as { status?: number }).status;
  if (status === 400 || status === 413) {
    return res.status(status).json({ error: status === 400 ? 'Invalid JSON body' : 'Request body too large' });
  }
  console.error(JSON.stringify({
    event: 'http.error', requestId: res.getHeader('X-Request-Id'),
    kind: error instanceof Error ? error.name : 'UnknownError',
  }));
  return res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  const port = getPort();
  const host = process.env.HOST || '0.0.0.0';
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(__dirname, 'dist');
    await access(path.join(dist, 'index.html'));
    app.use(express.static(dist, { index: false }));
    app.get('/', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    app.get('*', (req: Request, res: Response) => {
      const acceptsHtml = req.get('accept')?.split(',').some(
        (type) => type.split(';')[0].trim().toLowerCase() === 'text/html' && !/;\s*q=0(?:\.0+)?\s*(?:;|$)/i.test(type)
      );
      if (!acceptsHtml || path.extname(req.path) || /^\/assets(?:\/|$)/.test(req.path)) {
        return res.sendStatus(404);
      }
      return res.sendFile(path.join(dist, 'index.html'));
    });
  }

  const server = app.listen(port, host, () => {
    console.log(`[AreaWise AI Server] running on http://${host}:${port} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
  server.on('error', reportStartupFailure);
  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit());
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

function reportStartupFailure(error: unknown) {
  console.error('AreaWise AI could not start. For production, run npm run build before npm start.', error);
  process.exitCode = 1;
}

startServer().catch(reportStartupFailure);
