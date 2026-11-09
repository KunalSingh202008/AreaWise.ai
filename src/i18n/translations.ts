import { SupportedLanguage } from '../types';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  pilotBadge: string;
  nav: {
    overview: string;
    dashboard: string;
    explorer: string;
    compare: string;
    community: string;
    assistant: string;
    admin: string;
    saved: string;
  };
  dashboard: {
    title: string;
    areaScore: string;
    familyScore: string;
    studentScore: string;
    commuterScore: string;
    investorScore: string;
    coverage: string;
    confidence: string;
    freshness: string;
    verifiedStrengths: string;
    knownCautions: string;
    indicatorsTitle: string;
    mapTitle: string;
    missingDataTitle: string;
    saveArea: string;
    savedArea: string;
    compareArea: string;
    downloadReport: string;
    askAI: string;
    inspectData: string;
    hideData: string;
    statutorySources: string;
    observedMetric: string;
    dataDate: string;
    observedValue: string;
    source: string;
    customResolvedNotice: string;
  };
  comparison: {
    title: string;
    subtitle: string;
    selectPrompt: string;
    aiTitle: string;
    generateBtn: string;
    generatingBtn: string;
  };
  voice: {
    micStart: string;
    micListening: string;
    micStop: string;
    speaking: string;
    stopSpeech: string;
    replay: string;
    unsupported: string;
    greeting: string;
    voiceActive: string;
  };
  community: {
    title: string;
    subtitle: string;
    reportIssueBtn: string;
    allCategories: string;
    statusUnderReview: string;
    statusVerified: string;
    statusActionTaken: string;
    confirmations: string;
  };
  propertyTrends: {
    title: string;
    subtitle: string;
    avgPrice: string;
    cagr: string;
    rentalYield: string;
    infraGrowth: string;
    investmentRating: string;
    tabPriceInfra: string;
    tabRentalVolume: string;
    tabCatalysts: string;
    tabROICalculator: string;
    priceAxis: string;
    infraAxis: string;
    rentalYieldAxis: string;
    volumeAxis: string;
    calculatorTitle: string;
    calculatorSubtitle: string;
    propertySize: string;
    horizon: string;
    projectedValue: string;
    cumulativeRent: string;
    totalReturn: string;
    sourcesNote: string;
  };
  search: {
    placeholder: string;
    inspectBtn: string;
    noResults: string;
    popularAreas: string;
  };
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: 'AreaWise.ai',
    tagline: 'Know the Area Before You Own the Address.',
    pilotBadge: 'Varanasi Pilot Hub',
    nav: {
      overview: 'Overview',
      dashboard: 'Locality Dashboard',
      explorer: 'Map Explorer',
      compare: 'Compare Areas',
      community: 'Civic Community',
      assistant: 'AI Assistant',
      admin: 'Admin Portal',
      saved: 'Saved Areas',
    },
    dashboard: {
      title: 'Locality Intelligence Dashboard',
      areaScore: 'AreaScore',
      familyScore: 'FamilyScore',
      studentScore: 'StudentScore',
      commuterScore: 'CommuterScore',
      investorScore: 'InvestorScore',
      coverage: 'Data Coverage',
      confidence: 'Data Confidence',
      freshness: 'Data Freshness',
      verifiedStrengths: 'Verified Strengths',
      knownCautions: 'Known Cautions & Bottlenecks',
      indicatorsTitle: 'Underlying Empirical Indicators & Citations',
      mapTitle: 'Geospatial Layer Explorer',
      missingDataTitle: 'Transparent Disclosure of Missing Datasets',
      saveArea: 'Save Area',
      savedArea: 'Saved Area',
      compareArea: 'Compare',
      downloadReport: 'Download PDF Report',
      askAI: 'Ask AreaWise AI',
      inspectData: 'Inspect Records',
      hideData: 'Hide Records',
      statutorySources: 'Cited Statutory Sources',
      observedMetric: 'Indicator Metric',
      dataDate: 'Data Date',
      observedValue: 'Observed Value',
      source: 'Attributable Source',
      customResolvedNotice: 'Custom Pin Resolved via Spatial Containment Engine',
    },
    comparison: {
      title: 'Locality Comparison Engine',
      subtitle: 'Compare up to 3 Varanasi neighborhoods side-by-side using normalized empirical indicators.',
      selectPrompt: 'Select Areas:',
      aiTitle: 'AI Comparative Trade-Off Analysis',
      generateBtn: 'Generate AI Comparison',
      generatingBtn: 'Synthesizing Evidence...',
    },
    voice: {
      micStart: 'Click to Speak',
      micListening: 'Listening to your voice...',
      micStop: 'Stop Listening',
      speaking: 'AreaWise AI is speaking...',
      stopSpeech: 'Stop Audio',
      replay: 'Replay Voice Response',
      unsupported: 'Web Speech API is not supported in this browser.',
      greeting: 'Namaste! Ask any question about Varanasi localities in English, Hindi, or Hinglish.',
      voiceActive: 'Voice Mode Active',
    },
    community: {
      title: 'Resident Civic Intelligence',
      subtitle: 'Ground-level civic reports verified by neighborhood residents and municipal monitors.',
      reportIssueBtn: 'Report Civic Issue',
      allCategories: 'All Categories',
      statusUnderReview: 'Under Review',
      statusVerified: 'Verified by Surveyor',
      statusActionTaken: 'Action Taken',
      confirmations: 'Confirmations',
    },
    propertyTrends: {
      title: 'Property Market & Infrastructure Growth Trends',
      subtitle: 'Multi-year empirical valuation trajectory correlated with Smart City & civic infrastructure completion milestones.',
      avgPrice: 'Avg Capital Rate',
      cagr: '5-Yr CAGR',
      rentalYield: 'Gross Rental Yield',
      infraGrowth: 'Infra Growth Index',
      investmentRating: 'Investment Potential',
      tabPriceInfra: 'Price vs Infrastructure Correlation',
      tabRentalVolume: 'Rental Yield & Transaction Volume',
      tabCatalysts: 'Key Infrastructure Catalysts',
      tabROICalculator: 'Investment ROI Simulator',
      priceAxis: 'Capital Rate (₹/sq.ft)',
      infraAxis: 'Infra Index (0-100)',
      rentalYieldAxis: 'Rental Yield (%)',
      volumeAxis: 'Registry Volume Index',
      calculatorTitle: 'Estimated Appreciation & Yield Simulator',
      calculatorSubtitle: 'Simulate forward return projections based on 5-year empirical CAGR and infrastructure acceleration.',
      propertySize: 'Carpet Area (sq.ft)',
      horizon: 'Investment Horizon',
      projectedValue: 'Projected Valuation',
      cumulativeRent: 'Cumulative Rent Yield',
      totalReturn: 'Total Estimated Gain',
      sourcesNote: 'Verified statutory registry trends compiled from UP Stamp & Registration Circle Rates, VDA Master Plan 2031, and AreaWise Empirical Index.',
    },
    search: {
      placeholder: 'Search any Varanasi area (Sigra, Lanka, Mahmoorganj, Bhelupur, Assi, Sarnath, PIN)...',
      inspectBtn: 'Inspect',
      noResults: 'No exact match found. Click on the map to resolve custom coordinates.',
      popularAreas: 'Popular Localities:',
    },
  },
  hi: {
    appName: 'AreaWise.ai',
    tagline: 'पता खरीदने से पहले, इलाके को जानें।',
    pilotBadge: 'वाराणसी पायलट हब',
    nav: {
      overview: 'अवलोकन',
      dashboard: 'इलाका डैशबोर्ड',
      explorer: 'मानचित्र अन्वेषक',
      compare: 'क्षेत्र तुलना',
      community: 'नागरिक समुदाय',
      assistant: 'एआई सहायक',
      admin: 'प्रशासन पोर्टल',
      saved: 'सहेजे गए क्षेत्र',
    },
    dashboard: {
      title: 'इलाका बुद्धिमत्ता डैशबोर्ड',
      areaScore: 'एरियास्कोर (AreaScore)',
      familyScore: 'पारिवारिक स्कोर (FamilyScore)',
      studentScore: 'छात्र स्कोर (StudentScore)',
      commuterScore: 'यात्री स्कोर (CommuterScore)',
      investorScore: 'निवेशक स्कोर (InvestorScore)',
      coverage: 'डेटा कवरेज',
      confidence: 'डेटा विश्वसनीयता',
      freshness: 'डेटा नवीनता',
      verifiedStrengths: 'सत्यापित खूबियां',
      knownCautions: 'सावधानियां एवं समस्याएं',
      indicatorsTitle: 'आधारभूत सांख्यिकीय संकेतक एवं प्रमाण',
      mapTitle: 'भू-स्थानिक मानचित्र अन्वेषक',
      missingDataTitle: 'अनुपलब्ध डेटा की पारदर्शी सूचना',
      saveArea: 'इलाका सहेजें',
      savedArea: 'सहेजा गया',
      compareArea: 'तुलना करें',
      downloadReport: 'पीडीएफ रिपोर्ट डाउनलोड करें',
      askAI: 'एरियावाइज एआई से पूछें',
      inspectData: 'डेटा देखें',
      hideData: 'डेटा छुपाएं',
      statutorySources: 'सत्यापित सरकारी एवं सेंसर स्रोत',
      observedMetric: 'संकेतक मीट्रिक',
      dataDate: 'माप तिथि',
      observedValue: 'दर्ज मान',
      source: 'आधिकारिक स्रोत',
      customResolvedNotice: 'कस्टम स्थान: भू-स्थानिक गणना द्वारा विश्लेषित',
    },
    comparison: {
      title: 'इलाका तुलना इंजन',
      subtitle: 'वाराणसी के 3 इलाकों की निष्पक्ष सांख्यिकीय संकेतकों के आधार पर सीधी तुलना करें।',
      selectPrompt: 'इलाके चुनें:',
      aiTitle: 'एआई आधारित तुलनात्मक विश्लेषण',
      generateBtn: 'एआई तुलना बनाएं',
      generatingBtn: 'प्रमाण जुटाए जा रहे हैं...',
    },
    voice: {
      micStart: 'बोलने के लिए क्लिक करें',
      micListening: 'आपकी आवाज सुनी जा रही है...',
      micStop: 'सुनना बंद करें',
      speaking: 'एरियावाइज एआई बोल रहा है...',
      stopSpeech: 'आवाज रोकें',
      replay: 'पुनः सुनें',
      unsupported: 'इस ब्राउज़र में स्पीच एपीआई समर्थित नहीं है।',
      greeting: 'नमस्ते! वाराणसी के किसी भी इलाके के बारे में हिन्दी या अंग्रेजी में पूछें।',
      voiceActive: 'आवाज मोड सक्रिय',
    },
    community: {
      title: 'नागरिक जमीनी समस्याएं एवं रिपोर्ट',
      subtitle: 'स्थानीय निवासियों और नगर निगम मॉनिटरों द्वारा सत्यापित नागरिक शिकायतें।',
      reportIssueBtn: 'समस्या दर्ज करें',
      allCategories: 'सभी श्रेणियां',
      statusUnderReview: 'समीक्षाधीन',
      statusVerified: 'सर्वेयर द्वारा सत्यापित',
      statusActionTaken: 'कार्रवाई पूर्ण',
      confirmations: 'नागरिक समर्थन',
    },
    propertyTrends: {
      title: 'प्रॉपर्टी बाजार एवं अवसंरचना विकास रुझान',
      subtitle: 'स्मार्ट सिटी एवं बुनियादी ढांचे के विस्तार के साथ ऐतिहासिक मूल्य वृद्धि का सांख्यिकीय विश्लेषण।',
      avgPrice: 'औसत पूंजीगत दर',
      cagr: '5-वर्षीय चक्रवृद्धि वृद्धि (CAGR)',
      rentalYield: 'किराया यील्ड (प्रति वर्ष)',
      infraGrowth: 'अवसंरचना सूचकांक',
      investmentRating: 'निवेश क्षमता रेटिंग',
      tabPriceInfra: 'मूल्य बनाम अवसंरचना सह-संबंध',
      tabRentalVolume: 'किराया यील्ड एवं रजिस्ट्री संख्या',
      tabCatalysts: 'प्रमुख अवसंरचना उत्प्रेरक (Catalysts)',
      tabROICalculator: 'निवेश रिटर्न (ROI) कैलकुलेटर',
      priceAxis: 'पूंजीगत दर (₹/वर्ग फुट)',
      infraAxis: 'अवसंरचना सूचकांक (0-100)',
      rentalYieldAxis: 'किराया यील्ड (%)',
      volumeAxis: 'रजिस्ट्री वॉल्यूम इंडेक्स',
      calculatorTitle: 'अनुमानित संपत्ति मूल्यांकन एवं रिटर्न कैलकुलेटर',
      calculatorSubtitle: 'ऐतिहासिक वृद्धि और आगामी इंफ्रास्ट्रक्चर प्रोजेक्ट्स के आधार पर भविष्य के रिटर्न का आकलन करें।',
      propertySize: 'क्षेत्रफल (वर्ग फुट)',
      horizon: 'निवेश अवधि',
      projectedValue: 'अनुमानित भविष्य मूल्य',
      cumulativeRent: 'कुल अनुमानित किराया आय',
      totalReturn: 'कुल अनुमानित लाभ',
      sourcesNote: 'यूपी स्टांप एवं निबंधन सर्किल दरें, वीडीए मास्टर प्लान 2031 और एरियावाइज सांख्यिकीय मॉडल द्वारा सत्यापित।',
    },
    search: {
      placeholder: 'वाराणसी का कोई भी इलाका खोजें (सिगरा, लंका, महमूरगंज, भेलूपुर, अस्सी, सारनाथ, पिन)...',
      inspectBtn: 'विश्लेषण करें',
      noResults: 'सटीक नाम नहीं मिला। मानचित्र पर क्लिक करके नया इलाका जोड़ें।',
      popularAreas: 'प्रमुख इलाके:',
    },
  },
  hinglish: {
    appName: 'AreaWise.ai',
    tagline: 'Address lene se pehle, Area ko jaan lo.',
    pilotBadge: 'Varanasi Pilot Hub',
    nav: {
      overview: 'Overview',
      dashboard: 'Locality Dashboard',
      explorer: 'Map Explorer',
      compare: 'Compare Areas',
      community: 'Civic Community',
      assistant: 'AI Assistant',
      admin: 'Admin Portal',
      saved: 'Saved Areas',
    },
    dashboard: {
      title: 'Locality Intelligence Dashboard',
      areaScore: 'AreaScore',
      familyScore: 'FamilyScore',
      studentScore: 'StudentScore',
      commuterScore: 'CommuterScore',
      investorScore: 'InvestorScore',
      coverage: 'Data Coverage',
      confidence: 'Data Confidence',
      freshness: 'Data Freshness',
      verifiedStrengths: 'Verified Khasiyat (Strengths)',
      knownCautions: 'Cautions & Bottlenecks',
      indicatorsTitle: 'Real Empirical Indicators & Proof',
      mapTitle: 'Geospatial Layer Explorer',
      missingDataTitle: 'Missing Data ki Transparent Jankari',
      saveArea: 'Save Area',
      savedArea: 'Saved Area',
      compareArea: 'Compare Karein',
      downloadReport: 'Download PDF Report',
      askAI: 'AreaWise AI se Poochhein',
      inspectData: 'Data Dekhein',
      hideData: 'Hide Karein',
      statutorySources: 'Government & Sensor Sources',
      observedMetric: 'Indicator Metric',
      dataDate: 'Data Date',
      observedValue: 'Observed Value',
      source: 'Source',
      customResolvedNotice: 'Custom Location Spatial Engine dwara analyze kiya gaya',
    },
    comparison: {
      title: 'Locality Comparison Engine',
      subtitle: 'Varanasi ke 3 areas ko aamne-saamne compare karein real verified data ke sath.',
      selectPrompt: 'Areas Select Karein:',
      aiTitle: 'AI Comparative Trade-Off Analysis',
      generateBtn: 'AI Comparison Generate Karein',
      generatingBtn: 'Evidence check ho raha hai...',
    },
    voice: {
      micStart: 'Bolne ke liye click karein',
      micListening: 'Sun raha hoon, boliye...',
      micStop: 'Stop Listening',
      speaking: 'AreaWise AI bol raha hai...',
      stopSpeech: 'Mute / Stop',
      replay: 'Dobaara Sunein',
      unsupported: 'Aapka browser Speech API support nahi karta.',
      greeting: 'Namaste! Varanasi ke kisi bhi area ke baare mein poohein, main real data se bataunga.',
      voiceActive: 'Voice Mode On',
    },
    community: {
      title: 'Resident Civic Intelligence',
      subtitle: 'Ground-level civic reports jo local residents aur municipal monitors ne verify ki hain.',
      reportIssueBtn: 'Nayi Problem Report Karein',
      allCategories: 'Sabhi Categories',
      statusUnderReview: 'Under Review',
      statusVerified: 'Surveyor Verified',
      statusActionTaken: 'Action Taken',
      confirmations: 'Confirmations',
    },
    propertyTrends: {
      title: 'Property Market & Infra Growth Trends',
      subtitle: 'Smart City aur civic infrastructure completion ke sath historical property rate appreciation ka analysis.',
      avgPrice: 'Avg Rate (₹/sq.ft)',
      cagr: '5-Yr CAGR',
      rentalYield: 'Rental Yield (Annual)',
      infraGrowth: 'Infra Growth Index',
      investmentRating: 'Investment Potential',
      tabPriceInfra: 'Price vs Infra Correlation',
      tabRentalVolume: 'Rental Yield & Registry Volume',
      tabCatalysts: 'Infra Milestones & Projects',
      tabROICalculator: 'Investment ROI Simulator',
      priceAxis: 'Rate (₹/sq.ft)',
      infraAxis: 'Infra Index (0-100)',
      rentalYieldAxis: 'Yield (%)',
      volumeAxis: 'Registry Volume Index',
      calculatorTitle: 'Appreciation & Rental Yield Simulator',
      calculatorSubtitle: 'Historical CAGR aur upcoming infrastructure ke basis par future valuation simulate karein.',
      propertySize: 'Carpet Area (sq.ft)',
      horizon: 'Investment Horizon',
      projectedValue: 'Projected Future Value',
      cumulativeRent: 'Total Rental Earnings',
      totalReturn: 'Total Estimated Gain',
      sourcesNote: 'UP Stamp & Registration circle rates, VDA Master Plan 2031 aur AreaWise index se verified data.',
    },
    search: {
      placeholder: 'Varanasi ka koi bhi area search karein (Sigra, Lanka, Mahmoorganj, Bhelupur, Assi, PIN)...',
      inspectBtn: 'Inspect',
      noResults: 'Direct match nahi mila. Map pe click karke custom area analyze karein.',
      popularAreas: 'Top Localities:',
    },
  },
};
