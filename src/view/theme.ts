import { text } from "express";

export const THEME = {
  navy: '#0D3D6E',          // header หลัก (deep navy)
  band: '#0A3159',          // แถบสถานะใต้หัว
  primary: '#1255A3',       // ปุ่มหลัก / link
  headerKicker: '#7BAFD4',  // "IP1 PROMO REPORT" บน header
  headerSub: '#B8D4EA',     // subtitle บน header
  chipBg: '#163E72',        // pill สถานะบน band
  chipText: '#E2EEF8',

  accentBg: '#EBF3FA',
  accentText: '#0D3D6E',
  accentRule: '#1255A3',
  sectionBar: '#1255A3',

  text: '#111827',
  textSoft: '#1F2937',
  sub: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',

  line: '#D1D5DB',
  lineSoft: '#E5E7EB',
  bg: '#FFFFFF',
  bgAlt: '#F9FAFB',

  success: '#065F46',
  successText: '#0D3D6E',
  successBg: '#EBF3FA',
  warn: '#92400E',
  warnText: '#78350F',
  warnDeep: '#451A03',
  warnBg: '#FEF3C7',
  danger: '#991B1B',

  header: '#0D3D6E',
};

export const G = {
  card: '#FFFFFF',
  text: '#191C1D',
  sub: '#41493E',
  line: '#C0C9BB',
  faint: '#717A6D',
  green: '#1B5E20',
  greenDeep: '#00450D',
  greenSoft: '#ACF4A4',
  chipBg: '#ECEEEF',
  chipText: '#41493E',
  npdBg: '#293E47',
  warnBg: '#FFDAD6',
  warnText: '#93000A',
  warn: '#BA1A1A',
  surfLow: '#F2F4F5',
  accent: '#06B6D4',
};


export function badge(label: string, kind: 'warn' | 'success' | 'info' = 'warn'): any {
  const c =
    kind === 'success' ? { bg: '#D1FAE5', fg: '#065F46' } :
    kind === 'info'    ? { bg: '#DBEAFE', fg: '#1255A3' } :
                         { bg: THEME.warnBg, fg: THEME.warnText };
  return {
    type: 'box', layout: 'baseline', flex: 0, backgroundColor: c.bg,
    cornerRadius: '8px', paddingStart: '7px', paddingEnd: '7px', paddingTop: '2px', paddingBottom: '2px',
    contents: [{ type: 'text', text: label, size: 'xxs', color: c.fg, weight: 'bold' }],
  };
}

export function badgeRow(label: string, kind: 'warn' | 'success' | 'info' = 'warn', margin = 'sm'): any {
  return { type: 'box', layout: 'horizontal', margin, contents: [badge(label, kind), { type: 'filler' }] };
}
