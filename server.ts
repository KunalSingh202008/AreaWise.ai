import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  VARANASI_LOCALITIES,
  INITIAL_COMMUNITY_REPORTS,
  DATA_SOURCES,
  resolveLocationByCoordinates,
  haversineDistanceMeters,
} from './server/data';
import {
  getAllLocalitiesFromDb,
  getLocalityByIdFromDb,
  searchLocalitiesInDb,
  resolveLocationSpatial,
  getFacilitiesSpatial,
} from './src/db/repositories/localityRepository.ts';
import {
  getCommunityReportsFromDb,
  createCommunityReportInDb,
  voteOnReportInDb,
  moderateReportInDb,
} from './src/db/repositories/communityReportRepository.ts';
import {
  getAuditLogsFromDb,
} from './src/db/repositories/auditLogRepository.ts';
import {
  saveAIConversationAndMessages,
} from './src/db/repositories/aiConversationRepository.ts';
import {
  getActiveScoringWeightsFromDb,
  updateScoringWeightsInDb,
} from './src/db/repositories/scoringMethodologyRepository.ts';
import { calculateAreaScore, calculateProfileScores, updateWeights, activeWeights } from './server/scoring';
import { askAreaWiseAI } from './server/ai';
import { Locality, CommunityReport } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  // In development, dev server must always bind to port 3000
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  return process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
}

const PORT = getPort();

app.use(express.json({ limit: '10mb' }));

// In-memory runtime state
let localities: Locality[] = JSON.parse(JSON.stringify(VARANASI_LOCALITIES));
let communityReports: CommunityReport[] = JSON.parse(JSON.stringify(INITIAL_COMMUNITY_REPORTS));
let auditLogs: { id: string; action: string; actor: string; timestamp: string; details: string }[] = [
  {
    id: 'log-1',
    action: 'SYSTEM_BOOTSTRAP',
    actor: 'AreaWise Core Engine',
    timestamp: '2026-11-06T00:00:00Z',
    details: 'Initialized Varanasi pilot data with full Varanasi-wide localities and geospatial spatial resolver.',
  },
];

// ==========================================
// API ROUTES (/api/v1/...)
// ==========================================

// 1. Dynamic Location Resolution (Coordinates or Landmark) via PostGIS
app.post('/api/v1/locations/resolve', async (req: Request, res: Response) => {
  const { lat, lng, label } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({
      error: 'Invalid coordinates',
      message: 'Latitude and longitude numeric values are required.',
    });
  }

  // Check bounds within greater Varanasi metropolitan box (25.10 to 25.50 N, 82.80 to 83.20 E)
  if (lat < 25.10 || lat > 25.50 || lng < 82.80 || lng > 83.20) {
    return res.status(400).json({
      error: 'Location outside pilot boundary',
      message: 'The current pilot covers Varanasi Metropolitan Area (Lat: 25.10°N-25.50°N, Lng: 82.80°E-83.20°E).',
    });
  }

  try {
    const resolved = await resolveLocationSpatial(lat, lng, label);
    return res.json(resolved);
  } catch (error) {
    console.error('Error in /api/v1/locations/resolve:', error);
    const fallback = resolveLocationByCoordinates(lat, lng, label);
    return res.json(fallback);
  }
});

// 2. Location Search & Discovery (PostgreSQL / PostGIS backed)
app.get('/api/v1/locations/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim();
  const city = ((req.query.city as string) || '').trim();

  try {
    let results: Locality[];
    if (query) {
      results = await searchLocalitiesInDb(query, city);
    } else {
      results = await getAllLocalitiesFromDb();
      if (city) {
        results = results.filter((l) => l.city.toLowerCase().includes(city.toLowerCase()));
      }
    }

    return res.json({
      total: results.length,
      results: results.map((l) => ({
        id: l.id,
        name: l.name,
        hindiName: l.hindiName,
        city: l.city,
        state: l.state,
        pincode: l.pincode,
        center: l.center,
        overallScore: l.scores.overallScore,
        coverageScore: l.scores.coverageScore,
        confidenceScore: l.scores.confidenceScore,
        previewImage: l.previewImage,
        tagline: l.tagline,
        hindiTagline: l.hindiTagline,
        isCustomResolved: l.isCustomResolved,
      })),
    });
  } catch (error) {
    console.error('Error in /api/v1/locations/search:', error);
    return res.status(500).json({ error: 'Failed to search localities' });
  }
});

// 3. Locality Details (PostgreSQL backed)
app.get('/api/v1/locations/:id', async (req: Request, res: Response) => {
  try {
    const locality = await getLocalityByIdFromDb(req.params.id);
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

// 4. Locality Score
app.get('/api/v1/locations/:id/score', async (req: Request, res: Response) => {
  try {
    const locality = await getLocalityByIdFromDb(req.params.id);
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
    const locality = await getLocalityByIdFromDb(req.params.id);
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
    const locality = await getLocalityByIdFromDb(req.params.id);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }

    const category = req.query.category as string;
    const radiusMeters = req.query.radius ? parseInt(req.query.radius as string, 10) : 3000;
    const facilitiesList = await getFacilitiesSpatial(
      locality.center.lat,
      locality.center.lng,
      radiusMeters,
      category
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
    const locality = await getLocalityByIdFromDb(req.params.id);
    if (!locality) {
      return res.status(404).json({ error: 'Locality Not Found' });
    }
    const reports = await getCommunityReportsFromDb({ localityId: locality.id });
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
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 locality IDs to compare.' });
  }

  try {
    const matched: Locality[] = [];
    for (const id of ids) {
      const loc = await getLocalityByIdFromDb(id);
      if (loc) matched.push(loc);
    }

    if (matched.length < 2) {
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

// 9. AreaWise AI Assistant RAG (Multilingual & Spoken Script Support)
app.post('/api/v1/ai/ask', async (req: Request, res: Response) => {
  try {
    const { prompt, localityId, comparisonIds, language = 'en', chatHistory } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A prompt is required.' });
    }

    const aiResult = await askAreaWiseAI({
      prompt,
      localityId,
      comparisonIds,
      language,
      chatHistory,
      activeLocalitiesList: localities,
    });

    // Persist conversation session and messages into PostgreSQL
    try {
      await saveAIConversationAndMessages({
        conversationId: req.body.conversationId,
        localityId,
        comparisonIds,
        language,
        prompt,
        answer: aiResult.answer,
        spokenScript: aiResult.spokenScript,
        citations: aiResult.citations,
        warningNote: aiResult.warningNote,
      });
    } catch (persistErr) {
      console.error('Failed to persist AI conversation in DB:', persistErr);
    }

    return res.json(aiResult);
  } catch (error: any) {
    console.error('Error in /api/v1/ai/ask:', error);
    return res.status(500).json({
      error: 'AI Assistance Unavailable',
      message: error?.message || 'Internal failure during evidence synthesis.',
    });
  }
});

// 10. Community Reports: List (PostgreSQL backed)
app.get('/api/v1/community/reports', async (req: Request, res: Response) => {
  try {
    const { localityId, category, status } = req.query;
    const reports = await getCommunityReportsFromDb({
      localityId: localityId as string,
      category: category as string,
      status: status as string,
    });

    return res.json({
      total: reports.length,
      reports,
    });
  } catch (error) {
    console.error('Error in /api/v1/community/reports:', error);
    return res.status(500).json({ error: 'Failed to fetch community reports' });
  }
});

// 11. Community Reports: Submit (PostgreSQL backed with transactions & audit log)
app.post('/api/v1/community/reports', async (req: Request, res: Response) => {
  try {
    const { localityId, title, category, description, lat, lng, imageUrl, submittedBy } = req.body;

    if (!localityId || !title || !category || !description) {
      return res.status(400).json({ error: 'Missing required report fields (localityId, title, category, description).' });
    }

    const newReport = await createCommunityReportInDb({
      localityId,
      title,
      category,
      description,
      lat,
      lng,
      imageUrl,
      submittedBy,
    });

    return res.status(201).json(newReport);
  } catch (error: any) {
    console.error('Error submitting community report:', error);
    const status = error?.message?.includes('not found') ? 400 : 500;
    return res.status(status).json({ error: error?.message || 'Failed to submit community report' });
  }
});

// 12. Community Reports: Upvote (PostgreSQL backed with transactions)
app.post('/api/v1/community/reports/:id/vote', async (req: Request, res: Response) => {
  try {
    const result = await voteOnReportInDb(req.params.id, 1);
    return res.json(result);
  } catch (error: any) {
    console.error('Error voting on community report:', error);
    const status = error?.message?.includes('Not Found') ? 404 : 500;
    return res.status(status).json({ error: error?.message || 'Failed to record vote' });
  }
});

// 13. Admin: Moderate Community Report (PostgreSQL backed with transactions)
app.patch('/api/v1/community/reports/:id/moderate', async (req: Request, res: Response) => {
  try {
    const { status, officialResponse, moderator } = req.body;
    const updated = await moderateReportInDb(req.params.id, status, officialResponse, moderator);
    return res.json(updated);
  } catch (error: any) {
    console.error('Error moderating community report:', error);
    const statusCode = error?.message?.includes('Not Found') ? 404 : 500;
    return res.status(statusCode).json({ error: error?.message || 'Failed to moderate report' });
  }
});

// 14. Admin: Data Sources Status
app.get('/api/v1/admin/data-sources', (_req: Request, res: Response) => {
  return res.json(DATA_SOURCES);
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

app.post('/api/v1/admin/scoring-weights', async (req: Request, res: Response) => {
  try {
    const newWeights = req.body;
    const moderator = req.body.moderator || 'Admin System';
    const updated = await updateScoringWeightsInDb(newWeights, moderator);

    return res.json({
      weights: updated,
      recalculatedCount: 13,
    });
  } catch (error) {
    console.error('Error updating scoring weights:', error);
    return res.status(500).json({ error: 'Failed to update scoring weights' });
  }
});

// 16. Admin: Dataset Ingestion / CSV Validator
app.post('/api/v1/admin/import-dataset', (req: Request, res: Response) => {
  const { localityId, category, records, sourceName } = req.body;

  if (!localityId || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Valid localityId and non-empty records array required.' });
  }

  const locality = localities.find((l) => l.id === localityId);
  if (!locality) {
    return res.status(404).json({ error: 'Locality not found.' });
  }

  let validCount = 0;
  let skippedDuplicates = 0;

  for (const item of records) {
    if (item.name && item.lat && item.lng) {
      const duplicate = locality.facilities.some(
        (f) => f.name.toLowerCase() === item.name.toLowerCase()
      );
      if (duplicate) {
        skippedDuplicates++;
        continue;
      }

      locality.facilities.push({
        id: `f-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        category: category || item.category || 'civic',
        subcategory: item.subcategory || 'Imported Civic Point',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lng),
        distanceMeters: haversineDistanceMeters(locality.center, {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lng),
        }),
        address: item.address || `${locality.name}, ${locality.city}`,
        source: sourceName || 'Admin CSV Batch Ingestion',
        verificationStatus: 'verified',
        lastVerifiedDate: new Date().toISOString().split('T')[0],
      });
      validCount++;
    }
  }

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'DATASET_IMPORTED',
    actor: 'Dataset Administrator',
    timestamp: new Date().toISOString(),
    details: `Imported ${validCount} valid facility points into ${locality.name} (Skipped ${skippedDuplicates} duplicate records).`,
  });

  return res.json({
    success: true,
    localityId,
    importedFacilities: validCount,
    skippedDuplicates,
    currentFacilityTotal: locality.facilities.length,
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
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[AreaWise AI Server] running on http://0.0.0.0:${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
