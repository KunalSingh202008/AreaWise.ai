import { GoogleGenAI } from '@google/genai';
import { Locality, AICitation, SupportedLanguage } from '../src/types';
import { VARANASI_LOCALITIES, INITIAL_COMMUNITY_REPORTS } from './data';

interface AskAIRequest {
  prompt: string;
  localityId?: string;
  comparisonIds?: string[];
  language?: SupportedLanguage;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  activeLocalitiesList?: Locality[];
}

interface AskAIResponse {
  answer: string;
  spokenScript: string;
  citations: AICitation[];
  warningNote?: string;
  retrievedContextSummary: string;
  keyFindings?: string[];
  dataFreshness?: string;
  limitations?: string[];
  suggestedNextSteps?: string[];
}

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!geminiClient && key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 10) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export async function askAreaWiseAI(params: AskAIRequest): Promise<AskAIResponse> {
  const { prompt, localityId, comparisonIds, language = 'en', activeLocalitiesList = VARANASI_LOCALITIES } = params;

  // 1. Resolve exact target localities
  const targetLocalities: Locality[] = [];

  if (localityId) {
    const found = activeLocalitiesList.find((l) => l.id.toLowerCase() === localityId.toLowerCase());
    if (found) targetLocalities.push(found);
  }

  if (comparisonIds && comparisonIds.length > 0) {
    for (const id of comparisonIds) {
      const found = activeLocalitiesList.find((l) => l.id.toLowerCase() === id.toLowerCase());
      if (found && !targetLocalities.some((t) => t.id === found.id)) {
        targetLocalities.push(found);
      }
    }
  }

  // Fallback to active list if none specified
  const activeEvidence = targetLocalities.length > 0 ? targetLocalities : [activeLocalitiesList[0] || VARANASI_LOCALITIES[0]];

  // 2. Compile structured evidence dossier
  const evidenceDossier = activeEvidence.map((loc) => {
    return {
      locality: `${loc.name} ${loc.hindiName ? `(${loc.hindiName})` : ''}, ${loc.city} (PIN: ${loc.pincode})`,
      overallScore: loc.scores.overallScore,
      dataCoverage: `${loc.scores.coverageScore}%`,
      dataConfidence: `${loc.scores.confidenceScore}%`,
      methodology: loc.scores.methodologyVersion,
      categoryScores: loc.scores.categoryScores,
      profileScores: loc.profileScores,
      strengths: loc.strengths,
      cautions: loc.cautions,
      missingDataNotes: loc.missingDataNotes,
      keyIndicators: loc.indicators.map((ind) => ({
        indicator: ind.name,
        score: ind.score,
        metrics: ind.metrics,
        sources: ind.sources.map((s) => `${s.name} (${s.organization}, ${s.date})`),
      })),
      verifiedFacilities: loc.facilities.slice(0, 10).map((f) => ({
        name: f.name,
        category: f.category,
        distance: `${f.distanceMeters}m away`,
        status: f.verificationStatus,
        source: f.source,
      })),
    };
  });

  const communityNotes = INITIAL_COMMUNITY_REPORTS.filter((r) =>
    activeEvidence.some((e) => e.id === r.localityId)
  ).map((r) => ({
    locality: r.localityName,
    issue: r.title,
    status: r.status,
    category: r.category,
    submittedBy: r.submittedBy,
    date: r.submittedAt,
    officialAction: r.officialResponse || 'Under Review',
  }));

  const structuredContext = JSON.stringify({
    localities: evidenceDossier,
    communityReports: communityNotes,
  }, null, 2);

  const ai = getGeminiClient();

  // Extract citations
  const citations: AICitation[] = [];
  for (const loc of activeEvidence) {
    for (const ind of loc.indicators) {
      for (const s of ind.sources) {
        citations.push({
          source: `${s.name} - ${s.organization}`,
          date: s.date,
          locality: loc.name,
          confidence: `${loc.scores.confidenceScore}%`,
          metric: ind.name,
        });
      }
    }
    // Also include facilities
    for (const f of loc.facilities.slice(0, 2)) {
      citations.push({
        source: f.source,
        date: f.lastVerifiedDate,
        locality: loc.name,
        confidence: '95% (Verified Registry)',
        metric: `${f.name} (${f.distanceMeters}m)`,
      });
    }
  }

  // Multi-lingual instructions
  let langInstruction = '';
  if (language === 'hi') {
    langInstruction = `Respond in standard, fluent, clear HINDI (हिन्दी). Use Devanagari script. Keep numbers and proper place names easily readable.
Provide a spokenScript in Hindi suitable for Text-to-Speech playback.`;
  } else if (language === 'hinglish') {
    langInstruction = `Respond in natural, conversational HINGLISH (Hindi written in Roman English script, widely spoken across urban India).
Example tone: "Sigra mein connectivity kaafi strong hai, Cantt station sirf 1.8 km door hai. Par evening traffic thoda congested ho sakta hai."
Provide a spokenScript in conversational Hinglish.`;
  } else {
    langInstruction = `Respond in professional, clear, articulate ENGLISH. Provide a spokenScript in conversational English.`;
  }

  if (ai) {
    try {
      const systemInstruction = `You are AreaWise AI, an independent, objective neighborhood geospatial intelligence and decision-support assistant for India.
You provide evidence-grounded locality analysis for homebuyers, tenants, students, families, and civic researchers.
You are STRICTLY EVIDENCE-BOUND:
1. ONLY make assertions grounded in the retrieved structured evidence dossier below.
2. If the user asks about an area that is different from the retrieved locality, clarify which locality records are active.
3. NEVER fabricate property prices, speculative rent yields, unverified crime rates, or unofficial scores.
4. For missing data, explicitly state "Data currently unavailable for this metric" and cite the limitation.
5. Distinguish statutory/official sensor data (CPCB, ISRO Bhuvan, UP Jal Nigam) from community-submitted reports.
6. Format your response cleanly:
   - Provide a direct short answer.
   - List key findings with exact metric numbers and distances.
   - Note data freshness and known cautions.
   - Provide recommended next steps.
${langInstruction}`;

      const userContent = `User Question: "${prompt}"

Target Selected Locality: ${activeEvidence.map((l) => l.name).join(', ')}
Language Requested: ${language}

Retrieved Structured Locality Evidence:
${structuredContext}

Provide an evidence-grounded analysis. Also at the very end of your response, output a block:
===SPOKEN_SCRIPT===
(A concise, natural 2-sentence vocal script answering the question smoothly for the voice engine in the requested language)`;

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI response timed out after 30 seconds')), 30000);
      });

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userContent,
        config: {
          systemInstruction,
          maxOutputTokens: 800,
          temperature: 0.2,
        },
      });

      let response;
      try {
        response = await Promise.race([generatePromise, timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      const rawText = response.text || '';
      let answerText = rawText;
      let spokenScript = '';

      if (rawText.includes('===SPOKEN_SCRIPT===')) {
        const parts = rawText.split('===SPOKEN_SCRIPT===');
        answerText = parts[0].trim();
        spokenScript = parts[1].trim();
      } else {
        spokenScript = answerText.split('\n')[0].replace(/[#*]/g, '').trim();
      }

      return {
        answer: answerText,
        spokenScript: spokenScript || 'Analysis generated from verified Varanasi geospatial records.',
        citations: citations.slice(0, 6),
        retrievedContextSummary: `Synthesized from verified spatial records for ${activeEvidence.map((l) => l.name).join(', ')}.`,
        keyFindings: activeEvidence[0]?.strengths.slice(0, 3) || [],
        dataFreshness: `${activeEvidence[0]?.scores.dataFreshnessDays || 5} days`,
        limitations: activeEvidence[0]?.missingDataNotes || [],
        suggestedNextSteps: [
          'Inspect interactive layer markers on the map',
          'Compare side-by-side with another Varanasi neighborhood',
          'Review recent verified civic community submissions',
        ],
      };
    } catch (err: any) {
      console.warn('[AreaWise AI Engine] Generative reasoning deferred to verified local deterministic synthesis:', err?.message || err);
    }
  }

  // Deterministic Multilingual Fallback
  const primaryLoc = activeEvidence[0];
  let fallbackAnswer = '';
  let fallbackSpoken = '';

  if (language === 'hi') {
    fallbackAnswer = `### ${primaryLoc.hindiName || primaryLoc.name} (${primaryLoc.city}) का सांख्यिकीय विश्लेषण\n\n`;
    fallbackAnswer += `**एरियास्कोर (AreaScore): ${primaryLoc.scores.overallScore}/100** (डेटा कवरेज: ${primaryLoc.scores.coverageScore}%, विश्वसनीयता: ${primaryLoc.scores.confidenceScore}%)\n\n`;
    fallbackAnswer += `#### मुख्य खूबियां:\n`;
    primaryLoc.strengths.forEach((s) => (fallbackAnswer += `• ${s}\n`));
    fallbackAnswer += `\n#### सावधानियां एवं समस्याएं:\n`;
    primaryLoc.cautions.forEach((c) => (fallbackAnswer += `• ${c}\n`));
    fallbackAnswer += `\n#### श्रेणीगत प्रदर्शन:\n`;
    fallbackAnswer += `• कनेक्टिविटी: ${primaryLoc.scores.categoryScores.connectivity}/100\n`;
    fallbackAnswer += `• स्वास्थ्य सेवाएं: ${primaryLoc.scores.categoryScores.healthcare}/100\n`;
    fallbackAnswer += `• शिक्षा: ${primaryLoc.scores.categoryScores.education}/100\n`;
    fallbackAnswer += `• पर्यावरण: ${primaryLoc.scores.categoryScores.environment}/100\n`;
    fallbackAnswer += `• नागरिक सुविधाएं: ${primaryLoc.scores.categoryScores.civicInfrastructure}/100\n`;

    fallbackSpoken = `${primaryLoc.hindiName || primaryLoc.name} का एरियास्कोर ${primaryLoc.scores.overallScore} है। कनेक्टिविटी ${primaryLoc.scores.categoryScores.connectivity} और स्वास्थ्य स्कोर ${primaryLoc.scores.categoryScores.healthcare} दर्ज किया गया है।`;
  } else if (language === 'hinglish') {
    fallbackAnswer = `### ${primaryLoc.name} (${primaryLoc.city}) ka Evidence-Backed Analysis\n\n`;
    fallbackAnswer += `**Official AreaScore: ${primaryLoc.scores.overallScore}/100** (Data Coverage: ${primaryLoc.scores.coverageScore}%, Confidence: ${primaryLoc.scores.confidenceScore}%)\n\n`;
    fallbackAnswer += `#### Verified Khasiyat (Strengths):\n`;
    primaryLoc.strengths.forEach((s) => (fallbackAnswer += `• ${s}\n`));
    fallbackAnswer += `\n#### Cautions & Bottlenecks:\n`;
    primaryLoc.cautions.forEach((c) => (fallbackAnswer += `• ${c}\n`));
    fallbackAnswer += `\n#### Category Performance:\n`;
    fallbackAnswer += `• Connectivity: ${primaryLoc.scores.categoryScores.connectivity}/100\n`;
    fallbackAnswer += `• Healthcare: ${primaryLoc.scores.categoryScores.healthcare}/100\n`;
    fallbackAnswer += `• Education: ${primaryLoc.scores.categoryScores.education}/100\n`;
    fallbackAnswer += `• Environment: ${primaryLoc.scores.categoryScores.environment}/100\n`;
    fallbackAnswer += `• Civic Infrastructure: ${primaryLoc.scores.categoryScores.civicInfrastructure}/100\n`;

    fallbackSpoken = `${primaryLoc.name} ka overall AreaScore ${primaryLoc.scores.overallScore} out of 100 hai. Yahan connectivity ka score ${primaryLoc.scores.categoryScores.connectivity} aur healthcare ${primaryLoc.scores.categoryScores.healthcare} hai.`;
  } else {
    fallbackAnswer = `### Evidence-Grounded Analysis for ${primaryLoc.name} (${primaryLoc.city})\n\n`;
    fallbackAnswer += `**Official AreaScore: ${primaryLoc.scores.overallScore}/100** (Data Coverage: ${primaryLoc.scores.coverageScore}%, Confidence: ${primaryLoc.scores.confidenceScore}%, Freshness: ${primaryLoc.scores.dataFreshnessDays} days)\n\n`;
    fallbackAnswer += `#### Verified Key Strengths:\n`;
    primaryLoc.strengths.forEach((s) => (fallbackAnswer += `• ${s}\n`));
    fallbackAnswer += `\n#### Documented Cautions & Bottlenecks:\n`;
    primaryLoc.cautions.forEach((c) => (fallbackAnswer += `• ${c}\n`));
    fallbackAnswer += `\n#### Category Performance:\n`;
    fallbackAnswer += `• Connectivity & Transit: ${primaryLoc.scores.categoryScores.connectivity}/100\n`;
    fallbackAnswer += `• Healthcare Accessibility: ${primaryLoc.scores.categoryScores.healthcare}/100\n`;
    fallbackAnswer += `• Education Access: ${primaryLoc.scores.categoryScores.education}/100\n`;
    fallbackAnswer += `• Environmental Intelligence: ${primaryLoc.scores.categoryScores.environment}/100\n`;
    fallbackAnswer += `• Civic Infrastructure: ${primaryLoc.scores.categoryScores.civicInfrastructure}/100\n`;

    fallbackSpoken = `${primaryLoc.name} has an official AreaScore of ${primaryLoc.scores.overallScore} with ${primaryLoc.scores.coverageScore}% data coverage. Connectivity is rated at ${primaryLoc.scores.categoryScores.connectivity} and healthcare accessibility at ${primaryLoc.scores.categoryScores.healthcare}.`;
  }

  return {
    answer: fallbackAnswer,
    spokenScript: fallbackSpoken,
    citations: citations.slice(0, 6),
    warningNote: !process.env.GEMINI_API_KEY
      ? 'Generated via AreaWise verified deterministic synthesis engine (Add GEMINI_API_KEY for dynamic generative reasoning).'
      : undefined,
    retrievedContextSummary: `Synthesized from verified statutory records for ${primaryLoc.name}.`,
    keyFindings: primaryLoc.strengths.slice(0, 3),
    dataFreshness: `${primaryLoc.scores.dataFreshnessDays} days`,
    limitations: primaryLoc.missingDataNotes,
    suggestedNextSteps: [
      'Inspect interactive layer markers on the map',
      'Compare side-by-side with another Varanasi neighborhood',
      'Review recent verified civic community submissions',
    ],
  };
}
