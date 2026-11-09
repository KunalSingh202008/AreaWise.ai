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
import { calculateAreaScore, calculateProfileScores, updateWeights, activeWeights } from './server/scoring';
import { askAreaWiseAI } from './server/ai';
import { Locality, CommunityReport } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

// 1. Dynamic Location Resolution (Coordinates or Landmark)
app.post('/api/v1/locations/resolve', (req: Request, res: Response) => {
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

  const resolved = resolveLocationByCoordinates(lat, lng, label);

  // If not already in in-memory list, add it
  const existing = localities.find((l) => l.id === resolved.id);
  if (!existing) {
    localities.unshift(resolved);
  }

  return res.json(resolved);
});

// 2. Location Search & Discovery (Varanasi-wide)
app.get('/api/v1/locations/search', (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim().toLowerCase();
  const city = ((req.query.city as string) || '').trim().toLowerCase();

  let results = localities;

  if (city) {
    results = results.filter((l) => l.city.toLowerCase().includes(city));
  }

  if (query) {
    results = results.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        (l.hindiName && l.hindiName.includes(query)) ||
        l.pincode.includes(query) ||
        l.city.toLowerCase().includes(query) ||
        l.tagline.toLowerCase().includes(query) ||
        (l.hindiTagline && l.hindiTagline.includes(query))
    );
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
});

// 3. Locality Details
app.get('/api/v1/locations/:id', (req: Request, res: Response) => {
  const locality = localities.find((l) => l.id.toLowerCase() === req.params.id.toLowerCase());
  if (!locality) {
    return res.status(404).json({
      error: 'Locality Not Found',
      message: `The requested locality '${req.params.id}' is not in the active dataset.`,
    });
  }
  return res.json(locality);
});

// 4. Locality Score
app.get('/api/v1/locations/:id/score', (req: Request, res: Response) => {
  const locality = localities.find((l) => l.id.toLowerCase() === req.params.id.toLowerCase());
  if (!locality) {
    return res.status(404).json({ error: 'Locality Not Found' });
  }
  return res.json(locality.scores);
});

// 5. Locality Indicators
app.get('/api/v1/locations/:id/indicators', (req: Request, res: Response) => {
  const locality = localities.find((l) => l.id.toLowerCase() === req.params.id.toLowerCase());
  if (!locality) {
    return res.status(404).json({ error: 'Locality Not Found' });
  }
  return res.json(locality.indicators);
});

// 6. Locality Facilities
app.get('/api/v1/locations/:id/facilities', (req: Request, res: Response) => {
  const locality = localities.find((l) => l.id.toLowerCase() === req.params.id.toLowerCase());
  if (!locality) {
    return res.status(404).json({ error: 'Locality Not Found' });
  }

  const category = req.query.category as string;
  let facilities = locality.facilities;
  if (category && category !== 'all') {
    facilities = facilities.filter((f) => f.category === category);
  }

  return res.json(facilities);
});

// 7. Locality Map Geo-Data
app.get('/api/v1/locations/:id/map', (req: Request, res: Response) => {
  const locality = localities.find((l) => l.id.toLowerCase() === req.params.id.toLowerCase());
  if (!locality) {
    return res.status(404).json({ error: 'Locality Not Found' });
  }
  return res.json({
    center: locality.center,
    bounds: locality.bounds,
    facilities: locality.facilities,
    communityReports: communityReports.filter((r) => r.localityId === locality.id),
  });
});

// 8. Multi-Locality Comparison
app.post('/api/v1/comparisons', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 locality IDs to compare.' });
  }

  const matched = localities.filter((l) => ids.includes(l.id));
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
    const scores: Record<string, number> = {};
    matched.forEach((m) => {
      scores[m.id] = (m.scores.categoryScores as any)[cat.key] || 0;
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

    return res.json(aiResult);
  } catch (error: any) {
    console.error('Error in /api/v1/ai/ask:', error);
    return res.status(500).json({
      error: 'AI Assistance Unavailable',
      message: error?.message || 'Internal failure during evidence synthesis.',
    });
  }
});

// 10. Community Reports: List
app.get('/api/v1/community/reports', (req: Request, res: Response) => {
  const { localityId, category, status } = req.query;
  let results = [...communityReports];

  if (localityId) {
    results = results.filter((r) => r.localityId === localityId);
  }
  if (category) {
    results = results.filter((r) => r.category === category);
  }
  if (status) {
    results = results.filter((r) => r.status === status);
  }

  results.sort((a, b) => b.upvotes - a.upvotes);

  return res.json({
    total: results.length,
    reports: results,
  });
});

// 11. Community Reports: Submit
app.post('/api/v1/community/reports', (req: Request, res: Response) => {
  const { localityId, title, category, description, lat, lng, imageUrl, submittedBy } = req.body;

  if (!localityId || !title || !category || !description) {
    return res.status(400).json({ error: 'Missing required report fields (localityId, title, category, description).' });
  }

  const targetLocality = localities.find((l) => l.id === localityId);
  if (!targetLocality) {
    return res.status(400).json({ error: 'Invalid locality selected.' });
  }

  const newReport: CommunityReport = {
    id: `cr-${Date.now()}`,
    localityId,
    localityName: targetLocality.name,
    title: title.trim(),
    category,
    description: description.trim(),
    lat: lat || targetLocality.center.lat,
    lng: lng || targetLocality.center.lng,
    imageUrl: imageUrl || undefined,
    status: 'under_review',
    submittedBy: (submittedBy || 'Verified Local Resident').trim(),
    submittedAt: new Date().toISOString(),
    upvotes: 1,
  };

  communityReports.unshift(newReport);

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'COMMUNITY_REPORT_SUBMITTED',
    actor: newReport.submittedBy,
    timestamp: newReport.submittedAt,
    details: `New issue "${newReport.title}" in ${targetLocality.name} categorized under ${newReport.category}.`,
  });

  return res.status(201).json(newReport);
});

// 12. Community Reports: Upvote
app.post('/api/v1/community/reports/:id/vote', (req: Request, res: Response) => {
  const report = communityReports.find((r) => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report Not Found' });
  }
  report.upvotes += 1;
  return res.json({ id: report.id, upvotes: report.upvotes });
});

// 13. Admin: Moderate Community Report
app.patch('/api/v1/community/reports/:id/moderate', (req: Request, res: Response) => {
  const { status, officialResponse, moderator } = req.body;
  const report = communityReports.find((r) => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report Not Found' });
  }

  if (status) {
    report.status = status;
  }
  if (officialResponse !== undefined) {
    report.officialResponse = officialResponse;
  }

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'COMMUNITY_REPORT_MODERATED',
    actor: moderator || 'Senior Civic Auditor',
    timestamp: new Date().toISOString(),
    details: `Report ${report.id} updated to status "${report.status}".`,
  });

  return res.json(report);
});

// 14. Admin: Data Sources Status
app.get('/api/v1/admin/data-sources', (_req: Request, res: Response) => {
  return res.json(DATA_SOURCES);
});

// 15. Admin: Scoring Weights Config
app.get('/api/v1/admin/scoring-weights', (_req: Request, res: Response) => {
  return res.json(activeWeights);
});

app.post('/api/v1/admin/scoring-weights', (req: Request, res: Response) => {
  const newWeights = req.body;
  const updated = updateWeights(newWeights);

  localities.forEach((loc) => {
    loc.scores = calculateAreaScore(loc.scores.categoryScores, updated);
    loc.profileScores = calculateProfileScores(loc.scores.categoryScores);
  });

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'SCORING_WEIGHTS_UPDATED',
    actor: req.body.moderator || 'Admin System',
    timestamp: new Date().toISOString(),
    details: `Recalibrated AreaScore engine across all ${localities.length} localities.`,
  });

  return res.json({
    weights: updated,
    recalculatedCount: localities.length,
  });
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

// 17. Admin: Audit Logs
app.get('/api/v1/admin/audit-logs', (_req: Request, res: Response) => {
  return res.json(auditLogs);
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
