import { THAI_CONSONANTS_MAP, SOUNDEX_PREFIX_STRIP_REGEX } from '../shared/constants';

export function thaiSoundex(str: string): string {
  if (!str) return '0000';
  const clean = str.replace(/[^ก-ฮ]/g, '');
  if (!clean.length) return '0000';

  const first = clean[0];
  let code = first;
  let lastDigit = THAI_CONSONANTS_MAP[first] || '0';

  for (let i = 1; i < clean.length; i++) {
    const char = clean[i];
    const digit = THAI_CONSONANTS_MAP[char];
    if (digit && digit !== lastDigit) {
      code += digit;
      lastDigit = digit;
    }
  }

  if (code.length < 4) {
    return (code + '000').slice(0, 4);
  }
  return code.slice(0, 4);
}

export function soundSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  
  const clean = (s: string) => {
    let norm = s.trim().toLowerCase();
    norm = norm.replace(SOUNDEX_PREFIX_STRIP_REGEX, '');
    return norm.replace(/[^ก-ฮ]/g, '');
  };

  const cleanA = clean(a);
  const cleanB = clean(b);
  if (cleanA.length === 0 || cleanB.length === 0) return false;
  return thaiSoundex(cleanA) === thaiSoundex(cleanB);
}

export function soundexPrefixMatch(rawStr: string, targetStr: string): number {
  if (!rawStr || !targetStr || targetStr.length < 3) return 0;
  const minMatchLen = Math.max(3, Math.ceil(targetStr.length * 0.6));
  const targetLen = targetStr.length;
  const limit = Math.min(rawStr.length, targetLen + 4);
  for (let len = limit; len >= targetLen - 2; len--) {
    if (len < minMatchLen) continue;
    const prefix = rawStr.slice(0, len);
    if (soundSimilar(prefix, targetStr)) {
      return len;
    }
  }
  return 0;
}
