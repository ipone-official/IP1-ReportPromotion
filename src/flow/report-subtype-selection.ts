import { Session } from '../shared/types';
import { summaryFlex, text } from '../view/cards';
import { afterField, ask, splitMultiValue, optionsFor } from './nav';
import { matchMaster } from '../domain/match';

type SubtypeTarget = {
  values: string[];
  set: (values: string[]) => void;
  done: () => any[];
};

function currentSubtypeTarget(s: Session): SubtypeTarget {
  if (s.editTarget?.field === 'reportSubtype') {
    const item = s.items[s.editTarget.i];
    return {
      values: splitMultiValue(item?.reportSubtype),
      set: (values) => {
        if (item) item.reportSubtype = values.join(', ');
      },
      done: () => {
        s.editTarget = undefined;
        s.awaitingText = undefined;
        s.reportSubtypeSelections = undefined;
        s.step = 'summary';
        return [summaryFlex(s)];
      },
    };
  }
  return {
    values: splitMultiValue(s.current.reportSubtype),
    set: (values) => {
      s.current.reportSubtype = values.join(', ');
    },
    done: () => {
      s.awaitingText = undefined;
      s.reportSubtypeSelections = undefined;
      return afterField(s, 'reportSubtype');
    },
  };
}

// พิมพ์ตอนอยู่การ์ดรายการย่อย → เพิ่มค่าเข้า multi-select (เข้า option ได้ก็ snap, ไม่ได้ก็เก็บคำที่พิมพ์ = อื่นๆ)
// แล้วโชว์การ์ดเดิม ให้เลือก/พิมพ์ต่อได้ — ไม่เด้งออกจนกว่าจะกด "เสร็จแล้ว"
export function addTypedReportSubtype(s: Session, x: string): any[] {
  const raw = (x || '').trim();
  if (!raw) return ask(s, 'reportSubtype');
  const target = currentSubtypeTarget(s);
  const opts = (optionsFor('reportSubtype', s) || []).filter((o) => o !== 'อื่นๆ');
  const current = s.reportSubtypeSelections?.length ? [...s.reportSubtypeSelections] : [...target.values];
  for (const v of splitMultiValue(raw)) {
    const matched = matchMaster(v, opts).best || v;
    if (matched && !current.includes(matched)) current.push(matched);
  }
  s.reportSubtypeSelections = current;
  target.set(current);
  return ask(s, 'reportSubtype');
}

export function onToggleReportSubtype(s: Session, value: string): any[] {
  const target = currentSubtypeTarget(s);
  const selected = s.reportSubtypeSelections?.length ? [...s.reportSubtypeSelections] : target.values;
  const next = selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value];
  s.reportSubtypeSelections = next;
  target.set(next);
  return ask(s, 'reportSubtype');
}

export function onReportSubtypeDone(s: Session): any[] {
  const target = currentSubtypeTarget(s);
  const selected = s.reportSubtypeSelections?.length ? s.reportSubtypeSelections : target.values;
  target.set(selected);
  if (!selected.length) {
    return [text('กรุณาเลือกรายการย่อยอย่างน้อย 1 รายการ หรือพิมพ์รายการที่พบในช่องแชทครับ'), ...ask(s, 'reportSubtype')];
  }
  return target.done();
}

export function onReportSubtypeClear(s: Session): any[] {
  const target = currentSubtypeTarget(s);
  s.reportSubtypeSelections = [];
  target.set([]);
  return ask(s, 'reportSubtype');
}
