import { DATE_ISO_REGEX } from '../shared/constants';
import * as D from '../infra/master';

export function normalizeDate(d: any): string | undefined {
  if (!d) return undefined;
  const m = String(d).trim().match(DATE_ISO_REGEX);
  if (!m) return undefined;
  let y = parseInt(m[1], 10);
  if (y > 2400) y -= 543;
  const mo = parseInt(m[2], 10), da = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return undefined;
  const iso = `${y}-${m[2]}-${m[3]}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (isNaN(dt.getTime()) || dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== da) {
    return undefined;
  }
  return iso;
}

export function hasDateSignal(raw: string): boolean {
  const r = String(raw || '');
  if (D.dateSignalRegex1.test(r)) return true;
  return D.dateSignalRegex2.test(r)
    || D.dateSignalRegex3.test(r)
    || D.dateSignalRegex4.test(r);
}

export function parseRelativeDates(text: string, refDate: Date = new Date()): { startDate?: string; endDate?: string } | null {
  const normText = text.replace(/\s+/g, '');
  
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };

  if (normText.includes('เสาร์อาทิตย์หน้า')) {
    let day = refDate.getDay();
    if (day === 0) day = 7;
    const sat = new Date(refDate);
    sat.setDate(refDate.getDate() + (6 - day + 7));
    const sun = new Date(refDate);
    sun.setDate(refDate.getDate() + (7 - day + 7));
    return {
      startDate: formatLocalDate(sat),
      endDate: formatLocalDate(sun)
    };
  }
  
  if (normText.includes('เสาร์อาทิตย์นี้')) {
    let day = refDate.getDay();
    if (day === 0) day = 7;
    const sat = new Date(refDate);
    sat.setDate(refDate.getDate() + (6 - day));
    const sun = new Date(refDate);
    sun.setDate(refDate.getDate() + (7 - day));
    return {
      startDate: formatLocalDate(sat),
      endDate: formatLocalDate(sun)
    };
  }

  if (normText.includes('สิ้นเดือนหน้า') || normText.includes('ปลายเดือนหน้า')) {
    const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 2, 0);
    return { endDate: formatLocalDate(lastDay) };
  }
  
  if (normText.includes('สิ้นเดือนนี้') || normText.includes('ปลายเดือนนี้') || normText.includes('สิ้นเดือน') || normText.includes('ปลายเดือน')) {
    const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    return { endDate: formatLocalDate(lastDay) };
  }
  
  const isEnd = D.dayWeekCheckRegex.test(text);

  // Common relative day patterns
  if (normText.includes('วันนี้')) {
    const today = new Date(refDate);
    if (isEnd) return { endDate: formatLocalDate(today) };
    return { startDate: formatLocalDate(today) };
  }
  if (normText.includes('พรุ่งนี้')) {
    const tomorrow = new Date(refDate);
    tomorrow.setDate(refDate.getDate() + 1);
    if (isEnd) return { endDate: formatLocalDate(tomorrow) };
    return { startDate: formatLocalDate(tomorrow) };
  }
  if (normText.includes('มะรืน')) {
    const dayAfter = new Date(refDate);
    dayAfter.setDate(refDate.getDate() + 2);
    if (isEnd) return { endDate: formatLocalDate(dayAfter) };
    return { startDate: formatLocalDate(dayAfter) };
  }

  // Week-level patterns
  if (normText.includes('สัปดาห์หน้า') || normText.includes('อาทิตย์หน้า')) {
    const currentDay = refDate.getDay();
    const daysToNextMon = currentDay === 0 ? 1 : (8 - currentDay);
    const nextMon = new Date(refDate);
    nextMon.setDate(refDate.getDate() + daysToNextMon);
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);
    return { startDate: formatLocalDate(nextMon), endDate: formatLocalDate(nextSun) };
  }

  // Month-level patterns
  if (normText.includes('ต้นเดือนหน้า')) {
    const firstDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    return { startDate: formatLocalDate(firstDay) };
  }
  if (normText.includes('ต้นเดือน')) {
    const firstDay = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    return { startDate: formatLocalDate(firstDay) };
  }
  if (normText.includes('กลางเดือนหน้า')) {
    const midDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 15);
    return { startDate: formatLocalDate(midDay) };
  }
  if (normText.includes('กลางเดือน')) {
    const midDay = new Date(refDate.getFullYear(), refDate.getMonth(), 15);
    return { startDate: formatLocalDate(midDay) };
  }
  if (normText.includes('เดือนหน้า')) {
    const firstDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 2, 0);
    return { startDate: formatLocalDate(firstDay), endDate: formatLocalDate(lastDay) };
  }


  for (const d of D.dayNamesList) {
    if (normText.includes(`${d.name}หน้า`)) {
      let currentDay = refDate.getDay();
      let diff = d.val - currentDay;
      if (diff <= 0) diff += 7;
      diff += 7;
      const targetDate = new Date(refDate);
      targetDate.setDate(refDate.getDate() + diff);
      if (isEnd) return { endDate: formatLocalDate(targetDate) };
      return { startDate: formatLocalDate(targetDate) };
    }
    if (normText.includes(`${d.name}นี้`)) {
      let currentDay = refDate.getDay();
      let diff = d.val - currentDay;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(refDate);
      targetDate.setDate(refDate.getDate() + diff);
      if (isEnd) return { endDate: formatLocalDate(targetDate) };
      return { startDate: formatLocalDate(targetDate) };
    }
    if (normText.includes(`${d.name}`)) {
      let currentDay = refDate.getDay();
      let diff = d.val - currentDay;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(refDate);
      targetDate.setDate(refDate.getDate() + diff);
      if (isEnd) return { endDate: formatLocalDate(targetDate) };
      return { startDate: formatLocalDate(targetDate) };
    }
  }

  return null;
}
