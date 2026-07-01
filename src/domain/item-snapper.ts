import { snapStrict, snapExact, norm } from './match';
import { soundSimilar } from './soundex';
import { synonymGroups, variantClusters, subcatKeywords } from '../infra/master';
import { normalizeSize, parseSizeToNumeric } from './item-utils';
import {
  CANONICAL_L_REGEX,
  CANONICAL_KG_REGEX,
  BARE_NUMBER_CHECK_REGEX,
  BARE_NUMBER_CANDIDATE_REGEX,
  BARE_PACK_REGEX,
  BARE_PACK_CANDIDATE_REGEX,
  RANGE_MIN_MAX_REGEX,
  PREFIX_STRIP_REGEX,
  SUBCAT_SNAP_KEYWORDS
} from '../shared/constants';

export function snapSize(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  let valStr = String(value).trim();
  
  const lMatch = valStr.match(CANONICAL_L_REGEX);
  if (lMatch) {
    const num = parseFloat(lMatch[1]);
    valStr = `${num * 1000} มล`;
  } else {
    const kgMatch = valStr.match(CANONICAL_KG_REGEX);
    if (kgMatch) {
      const num = parseFloat(kgMatch[1]);
      valStr = `${num * 1000} กรัม`;
    }
  }

  const ex = snapExact(valStr, list);
  if (ex) return ex;

  const nv = normalizeSize(valStr);
  const matched = list.find((o) => normalizeSize(o) === nv);
  if (matched) return matched;

  if (BARE_NUMBER_CHECK_REGEX.test(nv)) {
    const numericPart = nv;
    const candidates = list.filter(o => {
      const no = normalizeSize(o);
      return no.startsWith(numericPart) && BARE_NUMBER_CANDIDATE_REGEX.test(no);
    });
    if (candidates.length === 1) {
      return candidates[0];
    } else if (candidates.length > 1) {
      const mlCand = candidates.find(o => normalizeSize(o).endsWith('มล'));
      if (mlCand) return mlCand;
      return candidates[0];
    }
  }

  const vNum = parseSizeToNumeric(valStr);
  if (vNum !== null) {
    // Phase 1: Try to find a single-size exact match first
    for (const sizeOpt of list) {
      if (/[-–—~]/.test(sizeOpt)) continue;
      if (sizeOpt.includes('/')) continue;
      const optNum = parseSizeToNumeric(sizeOpt);
      if (optNum !== null && optNum === vNum) return sizeOpt;
    }

    // Phase 2: If no single-size exact match, fall back to multi-size options
    for (const sizeOpt of list) {
      if (/[-–—~]/.test(sizeOpt)) continue;
      const normOpt = sizeOpt.toLowerCase().replace(/\s+/g, '');
      if (normOpt.includes('/')) {
        const parts = normOpt.split('/');
        for (const part of parts) {
          const partNum = parseSizeToNumeric(part);
          if (partNum !== null && partNum === vNum) return sizeOpt;
        }
      }
    }
  }


  const isInputRange = /[-–—~]/.test(String(value));
  const filteredList = isInputRange ? list : list.filter(o => !/[-–—~]/.test(o));
  return snapStrictNoPhonetic(value, filteredList);
}

export function snapPack(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const ex = snapExact(value, list);
  if (ex) return ex;

  const nv = norm(value);
  const matched = list.find((o) => norm(o) === nv);
  if (matched) return matched;

  if (BARE_PACK_REGEX.test(nv)) {
    const candidates = list.filter(o => {
      const no = norm(o);
      return no.startsWith(nv) && BARE_PACK_CANDIDATE_REGEX.test(no);
    });
    if (candidates.length === 1) {
      return candidates[0];
    } else if (candidates.length > 1) {
      const preferredCand = candidates.find(o => /ซอง|ขวด/.test(norm(o)));
      if (preferredCand) return preferredCand;
      return candidates[0];
    }
  }

  return snapStrictNoPhonetic(value, list);
}

export function snapStrictNoPhonetic(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const nv = norm(value);
  const ex = list.find((o) => norm(o) === nv);
  if (ex) return ex;

  const scored = list.map((o) => {
    const no = norm(o);
    const bigrams = (s: string) => {
      const out: string[] = [];
      for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
      return out.length ? out : s ? [s] : [];
    };
    const diceRaw = (a: string, b: string) => {
      if (a === b) return 1;
      const A = bigrams(a), B = bigrams(b);
      if (!A.length || !B.length) return 0;
      const cnt = new Map<string, number>();
      for (const g of B) cnt.set(g, (cnt.get(g) || 0) + 1);
      let inter = 0;
      for (const g of A) {
        const c = cnt.get(g) || 0;
        if (c > 0) { inter++; cnt.set(g, c - 1); }
      }
      return (2 * inter) / (A.length + B.length);
    };
    const score = diceRaw(nv, no);
    return { value: o, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top && top.score >= 0.75) {
    const nb = norm(top.value);
    if (Math.min(nb.length, nv.length) / Math.max(nb.length, nv.length) >= 0.75) {
      return top.value;
    }
  }
  return undefined;
}

export function snapVariant(value: any, list: string[]): string | undefined {
  if (!value) return undefined;

  // Step 0: Exact normalized match — if input exactly equals a master variant, return it immediately.
  // This prevents dice/bigram scoring from preferring a longer partial match.
  const nv0 = norm(value);
  const exactMatch = list.find(o => norm(o) === nv0);
  if (exactMatch) return exactMatch;
  
  // Step 1: Near-exact match (dice bigram ≥ 0.75 + length ratio ≥ 0.75)
  const ex = snapStrictNoPhonetic(value, list);
  if (ex) return ex;

  const nv = norm(value);
  const cleanV = nv.replace(PREFIX_STRIP_REGEX, '');

  // Step 2: Phonetic similarity (soundex) with length ratio guard
  if (cleanV.length >= 2) {
    const matched = list.find((o) => {
      const no = norm(o).replace(PREFIX_STRIP_REGEX, '');
      const lenRatio = Math.min(cleanV.length, no.length) / Math.max(cleanV.length, no.length);
      return no === cleanV || (soundSimilar(cleanV, no) && lenRatio >= 0.7);
    });
    if (matched) return matched;
  }

  // Step 3: Variant Cluster matching — STRICT EXACT KEYWORD ONLY
  // Enterprise safeguard: Only match if cleanV EXACTLY equals a cluster keyword
  // (e.g. "ชมพู" → cluster) NOT if it merely CONTAINS one as a substring
  // (e.g. "เจนเทิลคิส" must NOT match via "เจนเทิล" substring)
  //
  // This prevents false cross-variant snapping for any variant name that
  // happens to contain a cluster keyword embedded within it.
  const grp = variantClusters.find(g => g.some(kw => cleanV === kw));
  if (grp) {
    // Score all master variants against the cluster
    const scored: { value: string; score: number }[] = [];
    
    for (const opt of list) {
      const nOpt = norm(opt);
      let score = 0;
      
      // Direct containment: input is found inside the master variant name
      if (cleanV.length >= 2 && nOpt.includes(cleanV)) {
        score = 1.0;
      } else {
        // Cluster keyword match: a keyword from the same group is in the master variant
        for (const kw of grp) {
          if (nOpt.includes(kw)) {
            score = 0.9;
            break;
          }
        }
      }
      
      if (score >= 0.9) {
        scored.push({ value: opt, score });
      }
    }
    
    // Enterprise safeguard: Only snap if there's exactly ONE best match.
    // If multiple variants tie at the same score, it's ambiguous — don't guess.
    // e.g. "ขาว" → "พาวเวอร์ ขาว", "เพียวขาว", "พรีเมี่ยมออร์แกนิค ขาว"
    //   = 3 variants at score 1.0 → ambiguous → return undefined
    if (scored.length === 1) {
      return scored[0].value;
    }
    if (scored.length > 1) {
      const topScore = Math.max(...scored.map(s => s.score));
      const topMatches = scored.filter(s => s.score === topScore);
      if (topMatches.length === 1) {
        return topMatches[0].value;
      }
      // Multiple variants at same score → ambiguous, don't snap
    }
  }

  return undefined;
}

export function snapSubCategory(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const ex = snapStrict(value, list);
  if (ex) return ex;

  const nv = norm(value);
  let bestMatch: string | undefined = undefined;
  let maxIntersection = 0;
  
  const matchedKwsOfVal = SUBCAT_SNAP_KEYWORDS.filter(kw => nv.includes(kw));
  if (matchedKwsOfVal.length === 0) return undefined;

  for (const sub of list) {
    const nsub = norm(sub);
    let intersection = 0;
    for (const kw of matchedKwsOfVal) {
      if (nsub.includes(kw)) {
        intersection++;
      }
    }
    if (intersection > maxIntersection) {
      maxIntersection = intersection;
      bestMatch = sub;
    } else if (intersection === maxIntersection && intersection > 0 && !!bestMatch) {
      if (nsub.length < norm(bestMatch).length) {
        bestMatch = sub;
      }
    }
  }
  if (maxIntersection >= 1) return bestMatch;
  return undefined;
}
