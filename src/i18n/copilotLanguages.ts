export const copilotLanguages = {
  auto: 'Detect from question',
  en: 'English', hi: 'हिन्दी', hinglish: 'Hinglish',
  as: 'অসমীয়া', bn: 'বাংলা', brx: 'बड़ो', doi: 'डोगरी', gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ', ks: 'کٲشُر', kok: 'कोंकणी', mai: 'मैथिली', ml: 'മലയാളം',
  mni: 'মৈতৈলোন্', mr: 'मराठी', ne: 'नेपाली', or: 'ଓଡ଼ିଆ', pa: 'ਪੰਜਾਬੀ',
  sa: 'संस्कृतम्', sat: 'ᱥᱟᱱᱛᱟᱲᱤ', sd: 'سنڌي', ta: 'தமிழ்', te: 'తెలుగు', ur: 'اردو',
} as const;

export type CopilotLanguage = keyof typeof copilotLanguages;

export function isCopilotLanguage(value: unknown): value is CopilotLanguage {
  return typeof value === 'string' && Object.hasOwn(copilotLanguages, value);
}
