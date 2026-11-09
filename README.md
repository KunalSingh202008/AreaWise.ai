# AreaWise AI – Know the Area Before You Own the Address

**Category**: PropTech / Geospatial Intelligence / AI / Data Analytics  
**Pilot Hub**: Varanasi, Uttar Pradesh, India (Sigra, Lanka, Mahmoorganj)  
**Methodology Version**: `v1.2.0-pilot`  
**License**: Apache-2.0

---

## 1. Product Overview

**AreaWise AI** is an independent neighborhood research, geospatial intelligence, and decision-support platform designed for homebuyers, renters, students, families, property consultants, and civic researchers in India.

### Core Value Proposition
- **Strictly NOT a Property Listing Site**: Unlike property classifieds and broker portals that hide waterlogging, power cuts, and environmental hazards to drive transactions, AreaWise evaluates localities through objective, evidence-grounded open data.
- **Evidence-Grounded Intelligence**: Powered by statutory air sensors (CPCB CAAQMS), satellite canopy metrics (ISRO Bhuvan), municipal SCADA logs (Varanasi Nagar Nigam & Smart City), and water quality audits (UP Jal Nigam).
- **Separation of Coverage and Confidence**: Does not compute deceptive composite scores for unobserved areas. If data coverage is below 40%, composite AreaScores are withheld with a transparent limitation notice.
- **Personalized Weighting Profiles**: Dynamic assessments for `FamilyScore`, `StudentScore`, `CommuterScore`, and `InvestorScore`.

---

## 2. Key Features & Workflows

1. **Locality Search & Autocomplete**: Search by locality name, city, PIN code (`221010`, `221005`), or quick-select pilot buttons.
2. **Locality Dashboard**:
   - AreaScore gauge (0–100) with eligibility verification.
   - Data Reliability Strip: Coverage Score (%), Confidence Score (%), Freshness (days).
   - Profile Score switcher (Family, Student, Commute, Investor).
   - 7 category indicator bars with drilldown tables, sources, and dates.
   - Verified Strengths vs. Known Cautions & Bottlenecks.
   - Missing data warnings and statutory citations.
3. **Interactive Map Explorer**:
   - OpenStreetMap tile integration with custom category markers (Healthcare, Education, Transit, Parks, Shopping, Civic).
   - Adjustable radius filtering (500m, 1km, 2km, 5km).
   - Clickable facility inspector with verified distances and source attribution.
4. **Locality Comparison Engine**:
   - Side-by-side comparative matrix of up to 3 localities (e.g. Sigra vs. Lanka vs. Mahmoorganj).
   - AI comparative trade-off analysis synthesized from statutory evidence.
5. **AreaWise AI Assistant**:
   - RAG conversational assistant powered by Google Gen AI (`gemini-3.8-flash`) and deterministic local evidence synthesis.
   - Displays real underlying statutory citations (source, date, locality, metric).
   - Strictly avoids fabricating speculative property values or unverified crime claims.
6. **Resident Community Hub**:
   - Submit civic issues (waterlogging, road damage, water supply, street lighting, waste, air/noise).
   - Photo upload preview and location tags.
   - Status tracking (`under_review`, `verified`, `action_taken`).
   - Community confirmations and municipal resolution notes.
7. **Official Evidence PDF Brief**:
   - High-fidelity downloadable and printable evidence dossier with executive summary, category breakdown, and statutory citations.
8. **Administrative Governance Portal**:
   - Scoring weight configurator with real-time 100% normalization and locality recalibration.
   - CSV dataset batch ingestion simulator with coordinate validation and deduplication.
   - Resident report moderation queue.
   - Connected open data source health telemetry.
   - Audit logs trail.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Leaflet GIS mapping.
- **Backend**: Express (Node.js/TypeScript via TSX), RESTful APIs (`/api/v1/...`).
- **AI / LLM**: `@google/genai` with `gemini-3.8-flash` for server-side RAG evidence synthesis.
- **Data Integrations**: CPCB CAAQMS, ISRO Bhuvan LISS-IV, Varanasi Nagar Nigam & Smart City SCADA, UP Jal Nigam, OpenStreetMap (ODbL).

---

## 4. REST API Documentation

- `GET /api/v1/locations/search?q={query}&city={city}` - Search localities with autocomplete.
- `GET /api/v1/locations/{id}` - Full locality profile and indicators.
- `GET /api/v1/locations/{id}/score` - AreaScore and data quality metrics.
- `GET /api/v1/locations/{id}/indicators` - Indicator breakdown and statutory metrics.
- `GET /api/v1/locations/{id}/facilities?category={cat}` - Geospatial facilities in locality.
- `GET /api/v1/locations/{id}/map` - Coordinates, bounding polygon, and civic markers.
- `POST /api/v1/comparisons` - Multi-locality side-by-side comparison payload.
- `POST /api/v1/ai/ask` - Evidence-grounded conversational RAG endpoint.
- `GET /api/v1/community/reports` - List civic reports with filters.
- `POST /api/v1/community/reports` - Submit new civic issue.
- `POST /api/v1/community/reports/{id}/vote` - Upvote / confirm civic issue.
- `PATCH /api/v1/community/reports/{id}/moderate` - Admin moderation and municipal response.
- `GET /api/v1/admin/data-sources` - Live data source sync health.
- `POST /api/v1/admin/scoring-weights` - Recalibrate category distribution.
- `POST /api/v1/admin/import-dataset` - Batch CSV ingestion and deduplication.
- `GET /api/v1/admin/audit-logs` - System audit log trail.

---

## 5. Setup & Development Instructions

```bash
# Install dependencies
npm install

# Run dev server (Full-stack Express + Vite on port 3000)
npm run dev

# Run TypeScript checks
npm run lint

# Build for production
npm run build

# Start production server
npm start
```
