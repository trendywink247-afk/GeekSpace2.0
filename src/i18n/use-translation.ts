import { useState, useCallback, useMemo } from 'react';
import { HI } from './hi';

const LANG_KEY = 'agentin_lang';

export function useTranslation() {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'en');

  const t = useCallback((key: string): string => {
    if (lang === 'hi') return HI[key] ?? key;
    return key;
  }, [lang]);

  const toggleLang = useCallback(() => {
    const next = lang === 'en' ? 'hi' : 'en';
    localStorage.setItem(LANG_KEY, next);
    setLang(next);
  }, [lang]);

  return useMemo(() => ({
    t, lang, toggleLang, isHindi: lang === 'hi',
  }), [t, lang, toggleLang]);
}
