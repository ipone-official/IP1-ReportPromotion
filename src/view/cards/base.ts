import { G } from '../theme';
import { STEP_SECTIONS } from '../../shared/steps';
import { Session } from '../../shared/types';

export function text(t: string): any {
  return { type: 'text', text: t };
}

export function fieldSubtitle(step: string, s: Session): string | undefined {
  if (step === 'category') return `สินค้าตัวที่ ${s.items.length + 1}`;
  if (step === 'subCategory' && s.current.category) return `กลุ่ม: ${s.current.category}`;
  if (step === 'brand' && s.current.subCategory) return `ประเภท: ${s.current.subCategory}`;
  if (['reportType', 'reportSubtype', 'detail'].includes(step) && s.current.brand) return `โปรของ: ${s.current.brand}`;
  if (['channel', 'account', 'branch', 'company'].includes(step) && (s as any)[step]) return `เดิม: ${(s as any)[step]}`;
  return undefined;
}

export function stepProgress(step: string): string | undefined {
  for (const sec of STEP_SECTIONS) {
    const i = sec.steps.indexOf(step);
    if (i >= 0) return `${sec.label} · ${i + 1}/${sec.steps.length}`;
  }
  return undefined;
}

export function cardHeader(title: string, subtitle?: string, progress?: string): any {
  const titleRow: any[] = [
    { type: 'box', layout: 'vertical', width: '4px', height: '16px', backgroundColor: G.accent, cornerRadius: '2px', flex: 0, contents: [{ type: 'filler' }] },
    { type: 'text', text: title, size: 'md', color: G.text, weight: 'bold', flex: 1, wrap: true, gravity: 'center' },
  ];
  if (progress) titleRow.push({ type: 'text', text: progress, size: 'xxs', color: G.faint, align: 'end', flex: 0, gravity: 'center' });
  const contents: any[] = [{ type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', contents: titleRow }];
  if (subtitle) contents.push({ type: 'text', text: subtitle, size: 'xs', color: G.sub, margin: 'xs', wrap: true });
  return { type: 'box', layout: 'vertical', backgroundColor: G.card, paddingStart: '14px', paddingEnd: '14px', paddingTop: '8px', paddingBottom: '6px', contents };
}

export function optionRow(label: string, data: any): any {
  return {
    type: 'box', layout: 'horizontal', paddingTop: '6px', paddingBottom: '6px', paddingStart: '14px', paddingEnd: '14px', spacing: 'sm', alignItems: 'center',
    action: { type: 'postback', data: JSON.stringify(data), displayText: label },
    contents: [
      { type: 'text', text: label, size: 'sm', color: G.text, weight: 'bold', flex: 1, wrap: true, gravity: 'center' },
      { type: 'text', text: '›', size: 'sm', color: G.green, align: 'end', flex: 0, gravity: 'center' },
    ],
  };
}

export function navFooter(clearData?: any, editMode?: boolean): any {
  const contents: any[] = [
    { type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'ย้อนกลับ', data: JSON.stringify({ s: 'back' }), displayText: 'ย้อนกลับ' } },
  ];
  if (clearData) contents.push({ type: 'button', style: 'link', height: 'sm', color: G.warn, action: { type: 'postback', label: 'ลบค่าช่องนี้', data: JSON.stringify(clearData), displayText: 'ลบค่าช่องนี้' } });
  else if (!editMode) contents.push({ type: 'button', style: 'link', height: 'sm', color: G.faint, action: { type: 'postback', label: 'ออก', data: JSON.stringify({ s: 'exit' }), displayText: 'ออก' } });
  return { type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '4px', contents };
}

export function fmtDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : (iso || '');
}

export function row(label: string, value?: string, editStep?: string, approx?: boolean): any {
  const missing = !value;
  const contents: any[] = [
    { type: 'text', text: label, color: G.sub, size: 'sm', flex: 5, gravity: 'top' },
    { type: 'text', text: value || '—', size: 'sm', flex: 7, wrap: true, color: missing ? G.faint : G.text, gravity: 'top' },
  ];
  if (approx && value) contents.push({ type: 'text', text: '≈', size: 'sm', color: G.warn, weight: 'bold', flex: 0 });
  const box: any = {
    type: 'box', layout: 'baseline', spacing: 'md', paddingTop: '6px', paddingBottom: '6px',
    contents,
  };
  if (editStep) box.action = { type: 'postback', data: JSON.stringify({ s: 'editfield', v: editStep }) };
  return box;
}

export function sectionLabel(t: string): any {
  return {
    type: 'box', layout: 'horizontal', flex: 1, spacing: 'sm', alignItems: 'center',
    contents: [
      { type: 'box', layout: 'vertical', width: '4px', height: '15px', backgroundColor: G.accent, cornerRadius: '2px', contents: [{ type: 'filler' }] },
      { type: 'text', text: t, size: 'sm', weight: 'bold', color: G.text, flex: 0, gravity: 'center' },
    ],
  };
}
