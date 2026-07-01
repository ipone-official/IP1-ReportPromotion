import {
  SIZE_PACK_REGEX_1,
  SIZE_PACK_REGEX_2,
  SIZE_NORM_REPLACEMENTS,
  PRICE_SUFFIX_REGEX,
  PRICE_BARE_NUM_REGEX,
  PRICE_PREFIX_SHORTHAND_REGEX
} from '../shared/constants';

export function splitSizePack(sizeStr: string): { size?: string; pack?: string } {
  if (!sizeStr) return {};
  const s = sizeStr.trim();
  const pattern1 = /^([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]*)\s*(?:x|✕|×|\*|\/|แพ็ค|แพค)\s*(\d+)$/i;
  const match1 = s.match(pattern1);
  if (match1) {
    return {
      size: match1[1].trim(),
      pack: match1[2].trim()
    };
  }
  const pattern2 = /^(\d+)\s*(?:x|✕|×|\*|\/|แพ็ค|แพค)\s*([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]+)$/i;
  const match2 = s.match(pattern2);
  if (match2) {
    return {
      size: match2[2].trim(),
      pack: match2[1].trim()
    };
  }
  const pattern3 = /^แพ็ค\s*(\d+)\s*([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]+)$/i;
  const match3 = s.match(pattern3);
  if (match3) {
    return {
      size: match3[2].trim(),
      pack: match3[1].trim()
    };
  }
  const pattern4 = /^([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]*)\s*แพ็ค\s*(\d+)$/i;
  const match4 = s.match(pattern4);
  if (match4) {
    return {
      size: match4[1].trim(),
      pack: match4[2].trim()
    };
  }
  return { size: s };
}

export function normalizeSize(s: string): string {
  let v = String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  for (const r of SIZE_NORM_REPLACEMENTS) {
    v = v.replace(r.p, r.r);
  }
  return v;
}

export function cleanDetailPrice(detail: string): string {
  if (!detail) return detail;
  let v = detail.trim();
  v = v.replace(/฿\s*(\d+(?:\.\d+)?)/g, '$1 บาท');
  v = v.replace(/(\d+(?:\.\d+)?)\s*฿/g, '$1 บาท');
  v = v.replace(PRICE_SUFFIX_REGEX, '$1 บาท');
  v = v.replace(PRICE_BARE_NUM_REGEX, '$1 บาท');
  v = v.replace(PRICE_PREFIX_SHORTHAND_REGEX, '$1 $2 บาท');
  v = v.replace(/(ลดเหลือ|ราคา|เหลือ|พิเศษ|ลด)\s*(\d+(?:\.\d+)?)(?!\d)(?!\s*(?:บาท|บ(?![ก-ฮ])))/gi, '$1 $2 บาท');
  v = v.replace(/\s+/g, ' ');
  return v;
}

export function parseSizeToNumeric(sizeStr: string): number | null {
  if (!sizeStr) return null;
  let clean = String(sizeStr).toLowerCase().replace(/\s+/g, '').replace(/๐/g, '0').replace(/๑/g, '1').replace(/๒/g, '2').replace(/๓/g, '3').replace(/๔/g, '4').replace(/๕/g, '5').replace(/๖/g, '6').replace(/๗/g, '7').replace(/๘/g, '8').replace(/๙/g, '9');
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(มล|ml|fl\.?oz|oz|ออนซ์|l|ลิตร|ล|g|กรัม|kg|กก|กิโลกรัม|cc|ซีซี|แผ่น|ชิ้น|แคปซูล)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2];
    if (['l', 'ลิตร', 'ล'].includes(unit)) return val * 1000;
    if (['kg', 'กก', 'กิโลกรัม'].includes(unit)) return val * 1000;
    if (['oz', 'ออนซ์'].includes(unit) || unit.startsWith('fl')) return val * 29.5735;  // fl oz → ml
    if (['cc', 'ซีซี'].includes(unit)) return val; // cc ≈ ml
    return val;
  }
  const matchNum = clean.match(/(\d+(?:\.\d+)?)/);
  if (matchNum) return parseFloat(matchNum[1]);
  return null;
}
