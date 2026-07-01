import { Session } from '../shared/types';
import {
  TEXT_RESTART_EXIT_REGEX,
  TEXT_SKIP_MORE_REGEX,
  TEXT_SKIP_FIELDS_EXTRACT_REGEX
} from '../shared/constants';
import { editItemFromText, onExtraText, applyItemFieldText } from './item-edit';
import { text, topicReadyCard, summaryFlex } from '../view/cards';
import { fastParse } from './flow-parser';
import { matchFieldText } from './field-match';
import { optionsFor, continueLoop } from './nav';
import { parseSkipFields } from './completeness';

export { ask } from './nav';
export { resolveStore } from '../domain/store-resolve';
export { buildItem, mergeParsed } from '../domain/items';
export type { Session } from '../shared/types';
export { onImage, onDelReportPhoto } from './photo';
export {
  onEdit,
  onEditField,
  onEditProducts,
  onEditItem,
  onDelItem,
  onEditItemType,
  onAddItem,
  onAddItemField,
  onEditItemField,
  onEditItemMore,
  onConfirmItemApprox,
  onClearItemField,
  onEditExtraList,
  onDelExtra,
  onEditExtra,
  onAddExtra
} from './item-edit';
export { getSession, loadSession, saveSession } from './session-manager';
import {
  start,
  startReport,
  goBack,
  onSelect,
  onPickTopic,
  endSession,
  onRestartExit,
  onExit,
  confirmRestart,
  onResume,
  onExample,
  onGuided,
  onDate,
  onUseBranch,
  onClearField,
  onToggleReportSubtype,
  onReportSubtypeDone,
  onReportSubtypeClear,
  onUseStore,
  onStorePick,
  onSave,
  onNoEndDate
} from './flow-actions';
import { addTypedReportSubtype } from './report-subtype-selection';

export {
  start,
  startReport,
  goBack,
  onSelect,
  onPickTopic,
  endSession,
  onRestartExit,
  onExit,
  confirmRestart,
  onResume,
  onExample,
  onGuided,
  onDate,
  onUseBranch,
  onClearField,
  onToggleReportSubtype,
  onReportSubtypeDone,
  onReportSubtypeClear,
  onUseStore,
  onStorePick,
  onSave,
  onNoEndDate
};

export async function onText(s: Session, t: string): Promise<any[]> {
  const x = (t || '').trim();
  if (TEXT_RESTART_EXIT_REGEX.test(x)) return startReport(s);
  if (s.awaitingText === 'edititem') {
    s.awaitingText = undefined;
    return editItemFromText(s, x);
  }
  if (s.awaitingText === 'extra') return onExtraText(s, x);
  if (s.awaitingText === 'itemfield' && s.editTarget) return applyItemFieldText(s, x);
  if (s.awaitingText === 'customtopic') {
    if (!x) return [text('พิมพ์ชื่อหัวข้อที่ต้องการแจ้งได้เลยครับ')];
    s.awaitingText = undefined;
    s.topicName = x;
    s.step = undefined;
    return [topicReadyCard(x)];
  }
  if (s.awaitingText === 'reportSubtype' || s.step === 'reportSubtype') {
    // อยู่การ์ดรายการย่อย (multi-select) → พิมพ์ = เพิ่มเข้าตัวเลือก ไม่เด้งออก (อื่นๆ พิมพ์เองได้)
    return addTypedReportSubtype(s, x);
  }
  if (s.awaitingText) {
    const f = s.awaitingText;
    s.awaitingText = undefined;
    return matchFieldText(s, f, x, onSelect);
  }
  if (s.fillingMissing && s.step && optionsFor(s.step, s)) return matchFieldText(s, s.step, x, onSelect);
  if (s.askingMore) {
    if (TEXT_SKIP_MORE_REGEX.test(x)) {
      s.askingMore = false;
      s.skipMore = true;
      s.step = 'summary';
      return [text('รับทราบครับ จัดทำสรุปให้แล้ว'), summaryFlex(s)];
    }
    const lines = x.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const skipKeys: string[] = [];
    const skipLabels: string[] = [];
    const blocked: string[] = [];
    const rest: string[] = [];
    for (const line of lines) {
      const mSkip = line.match(TEXT_SKIP_FIELDS_EXTRACT_REGEX);
      const sel = mSkip ? parseSkipFields(mSkip[1]) : null;
      if (sel) {
        skipKeys.push(...sel.keys);
        skipLabels.push(...sel.labels);
        blocked.push(...sel.blocked);
      } else {
        rest.push(line);
      }
    }
    const msgs: any[] = [];
    if (skipKeys.length) {
      s.skippedFields = [...new Set([...(s.skippedFields || []), ...skipKeys])];
      msgs.push(text(`รับทราบครับ ข้ามรายการ: ${[...new Set(skipLabels)].join(', ')}`));
    }
    if (blocked.length) {
      msgs.push(
        text(
          `${[...new Set(blocked)].join(', ')} เป็นข้อมูลที่จำเป็น ไม่สามารถข้ามได้ครับ (สามารถแก้ไขหรือลบรายการแทนได้)`
        )
      );
    }
    if (rest.length) return [...msgs, ...(await fastParse(s, rest.join('\n')))];
    if (msgs.length) {
      const next = continueLoop(s);
      return next ? [...msgs, ...next] : [...msgs, summaryFlex(s)];
    }
    return fastParse(s, x);
  }
  if (!s.topicName) {
    const body = x.replace(/^\s*(แจ้ง|รายงาน|report)[:\s]*/i, '').trim();
    return startReport(s, body);
  }
  return fastParse(s, x);
}
