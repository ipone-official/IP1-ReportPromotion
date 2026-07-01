import * as D from '../infra/master';
import { snapStrict } from '../domain/match';
import { saveReport, sqlEnabled, logParse } from '../infra/db';
import { deletePhotos } from '../infra/photoStore';
import { Session } from '../shared/types';
import { resolveStore, nearbyAccounts } from '../domain/store-resolve';
import { resetSession } from './session-manager';
import {
  dropApprox,
  addApprox,
  applyStoreChannel,
  setItemField,
  sessionSnapshot,
  normalizeDate,
  alignReportSubtype,
} from '../domain/items';
import { firstMissing, saveBlockers } from './completeness';
import {
  text,
  welcomeCard,
  topicPickCard,
  topicReadyCard,
  promptCard,
  confirmCard,
  summaryFlex,
  exitCard,
  savedCard,
} from '../view/cards';
import { ask, afterField, optionsFor, continueLoop, clearField } from './nav';
import { applyItemFieldValue } from './item-edit';
import { fastParse, ITEM_FIELD_LABEL } from './flow-parser';
import {
  registerLearnedAlias,
  registerLearnedBranchAlias,
  registerLearnedBrandAlias,
  registerLearnedCompanyAlias,
  registerLearnedReportSubtypeAlias,
  registerLearnedSubCategoryAlias,
  registerLearnedVariantAlias,
} from './alias-learning';
export {
  onToggleReportSubtype,
  onReportSubtypeDone,
  onReportSubtypeClear,
} from './report-subtype-selection';

export function start(s: Session): any[] {
  resetSession(s);
  return [welcomeCard()];
}

export function startReport(s: Session, pending?: string): any[] {
  if (s.step !== 'topic') resetSession(s);
  if (pending && pending.trim()) s.pendingReport = pending.trim();
  s.step = 'topic';
  if (s.asked[s.asked.length - 1] !== 'topic') s.asked.push('topic');
  return [topicPickCard(D.topics.map((t) => t.name))];
}

export function goBack(s: Session): any[] {
  if (s.editing) {
    s.editing = false;
    return ask(s, 'summary');
  }
  s.asked.pop();
  const prev = s.asked.pop();
  if (!prev) return s.items.length || s.topicName ? ask(s, 'summary') : start(s);
  clearField(s, prev);
  return ask(s, prev);
}

export function onSelect(s: Session, step: string, value: string): any[] {
  if (s.editTarget) {
    if (value === 'อื่นๆ') {
      s.awaitingText = 'itemfield';
      return [promptCard(ITEM_FIELD_LABEL[s.editTarget.field] || 'ข้อมูล', 'พิมพ์ในช่องแชทด้านล่างได้เลยครับ')];
    }
    return applyItemFieldValue(s, s.editTarget.i, s.editTarget.field, value);
  }
  if (value === 'อื่นๆ' && step !== 'addMore') {
    s.awaitingText = step;
    s.step = step;
    const lbl: Record<string, string> = { company: 'ชื่อบริษัท', account: 'ชื่อห้าง/ร้าน', branch: 'ชื่อสาขา' };
    return [promptCard(ITEM_FIELD_LABEL[step] || lbl[step] || 'ข้อมูล', 'พิมพ์ในช่องแชทด้านล่างได้เลยครับ')];
  }
  switch (step) {
    case 'topic':
      s.topicName = value;
      s.topicCode = D.topicCode(value);
      dropApprox(s, 'topic');
      break;
    case 'channel':
      s.channel = value;
      dropApprox(s, 'channel');
      break;
    case 'account':
      registerLearnedAlias(s, value);
      s.account = value;
      s.storeNew = false;
      dropApprox(s, 'store');
      break;
    case 'branch':
      registerLearnedBranchAlias(s, value);
      s.branch = value;
      s.storeNew = false;
      dropApprox(s, 'store');
      break;
    case 'company':
      registerLearnedCompanyAlias(s, value);
      s.company = value;
      dropApprox(s, 'company');
      break;
    case 'category':
      s.current.category = value;
      break;
    case 'subCategory':
      registerLearnedSubCategoryAlias(s, value);
      s.current.subCategory = value;
      break;
    case 'brand':
      registerLearnedBrandAlias(s, value);
      s.current.brand = value;
      break;
    case 'size':
      s.current.size = value;
      break;
    case 'pack':
      s.current.pack = value;
      break;
    case 'variant':
      registerLearnedVariantAlias(s, value);
      s.current.variant = value;
      break;
    case 'addMore':
      if (s.current.subCategory || s.current.brand) s.items.push({ ...s.current });
      s.current = {};
      if (value.includes('เพิ่ม')) return ask(s, 'category');
      if (s.editing) {
        s.editing = false;
        return ask(s, 'summary');
      }
      return ask(s, 'startDate');
    case 'reportType': {
      const allTypes = s.topicCode ? (D.reportTypesByTopic[s.topicCode] || []) : Object.values(D.reportTypesByTopic).flat();
      const snappedType = snapStrict(value, allTypes) || undefined;
      s.current.reportType = snappedType || value;
      if (s.current.reportSubtype && snappedType) {
        const validSubs = D.subtypesByReportType[snappedType] || [];
        if (!validSubs.includes(s.current.reportSubtype)) {
          s.current.reportSubtype = undefined;
        }
      }
      break;
    }
    case 'reportSubtype': {
      registerLearnedReportSubtypeAlias(s, value);
      const alignment = alignReportSubtype(value, s.topicCode);
      if (alignment.subtype) {
        s.current.reportSubtype = alignment.subtype;
        if (alignment.reportType) {
          s.current.reportType = alignment.reportType;
        }
      } else {
        s.current.reportSubtype = value;
      }
      break;
    }
  }
  if (step === 'account' || step === 'branch') applyStoreChannel(s);
  return afterField(s, step);
}

export async function onPickTopic(s: Session, value: string): Promise<any[]> {
  s.topicName = value;
  s.topicCode = D.topicCode(value);
  dropApprox(s, 'topic');
  if (s.editing) {
    s.editing = false;
    s.step = 'summary';
    return [summaryFlex(s)];
  }
  const pending = s.pendingReport;
  s.pendingReport = undefined;
  s.step = undefined;
  if (s.topicCode === 'etc' && !pending) {
    s.awaitingText = 'customtopic';
    return [promptCard('เรื่องอื่นๆ', 'พิมพ์ชื่อหัวข้อที่ต้องการแจ้งได้เลยครับ')];
  }
  if (pending) return fastParse(s, pending);
  return [topicReadyCard(value)];
}

export function endSession(s: Session): any[] {
  resetSession(s);
  return [exitCard()];
}

export function onRestartExit(s: Session): any[] {
  resetSession(s);
  return [exitCard('ล้างข้อมูลแล้ว')];
}

export function onExit(s: Session): any[] {
  if (s.items.length || s.topicName) {
    return [confirmCard('doexit', 'หากออกจากระบบ ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป ต้องการยืนยันหรือไม่', 'ออก')];
  }
  return endSession(s);
}

export function confirmRestart(s: Session): any[] {
  if (s.items.length || s.topicName) {
    return [confirmCard('dorestart', 'ล้างข้อมูลที่กรอกไว้ทั้งหมดและออกจากระบบ ต้องการยืนยันหรือไม่', 'ล้างข้อมูล')];
  }
  return onRestartExit(s);
}

export function onResume(s: Session): any[] {
  return ask(s, s.step || 'summary');
}

export function onExample(): any[] {
  return [
    text(
      'ตัวอย่างการพิมพ์ (แทนค่าในวงเล็บเหลี่ยมด้วยข้อมูลจริงของคุณ):\n\nแจ้ง [ชื่อห้าง] [สาขา]\n[ยี่ห้อสินค้า] [ขนาด] [ราคา/ลด/โปร]\n[ยี่ห้อสินค้า] [ขนาด] [แพ็ค] [ราคา]\n[วันเริ่ม]-[วันจบ] บริษัท [ชื่อบริษัท]\n\nพิมพ์กี่สินค้าก็ได้ ระบบจะแยกรายการให้อัตโนมัติ หากข้อมูลไม่ครบ ระบบจะสอบถามเพิ่มเติมครับ'
    ),
  ];
}

export function onGuided(s: Session): any[] {
  return ask(s, firstMissing(s) || 'topic');
}

export function onDate(s: Session, step: string, date: string): any[] {
  const d = normalizeDate(date);
  if (!d) return [text('วันที่ไม่ถูกต้อง กรุณาเลือกใหม่อีกครั้งครับ'), ...ask(s, step)];
  if (step === 'startDate') {
    s.startDate = d;
    if (s.endDate && s.endDate < d) s.endDate = undefined;
    return [];
  }
  if (step === 'endDate') {
    if (s.startDate && d < s.startDate) {
      return [text('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม กรุณาเลือกใหม่ครับ'), ...ask(s, 'endDate')];
    }
    s.endDate = d;
  }
  return afterField(s, step);
}

// ปุ่ม "ไม่มีวันจบ" บนการ์ดวันที่ — โปรต่อเนื่อง/ไม่มีกำหนดสิ้นสุด
// ทำเหมือนผู้ใช้พิมพ์ "ข้ามวันจบ": ใส่ endDate เข้า skippedFields บอทเลิกทวง, เซฟได้ (DB เก็บ end_date = NULL)
export function onNoEndDate(s: Session): any[] {
  s.endDate = undefined;
  s.skippedFields = [...new Set([...(s.skippedFields || []), 'endDate'])];
  return afterField(s, 'endDate');
}

export function onUseBranch(s: Session, value: string): any[] {
  s.branch = value;
  s.awaitingText = undefined;
  dropApprox(s, 'store');
  return afterField(s, 'branch');
}

export function onClearField(s: Session, step: string): any[] {
  if (step === 'date') {
    clearField(s, 'startDate');
    clearField(s, 'endDate');
  } else {
    clearField(s, step);
  }
  s.editing = false;
  s.awaitingText = undefined;
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function onUseStore(s: Session, field: string, value: string): any[] {
  s.storeNew = true;
  s.awaitingText = undefined;
  dropApprox(s, 'store');
  if (field === 'branch') {
    s.branch = value;
  } else {
    s.account = value;
    s.branch = undefined;
  }
  const f = firstMissing(s);
  if (f) {
    s.fillingMissing = true;
    return ask(s, f);
  }
  const next = continueLoop(s);
  if (next) return [text('บันทึกเป็น "ร้านใหม่" แล้วครับ ทีมงานจะเพิ่มเข้าระบบให้'), ...next];
  return [
    text('บันทึกเป็น "ร้านใหม่" แล้วครับ ทีมงานจะเพิ่มเข้าระบบให้ กรุณาตรวจสอบ แล้วกดบันทึกรายงาน'),
    summaryFlex(s),
  ];
}

export function onStorePick(s: Session, account: string, branch: string): any[] {
  registerLearnedAlias(s, account);
  s.account = account;
  s.storeNew = false;
  s.storeCands = undefined;
  dropApprox(s, 'store');
  applyStoreChannel(s);
  if (!branch) {
    s.branch = undefined;
    return afterField(s, 'account');
  }
  s.branch = branch;
  return afterField(s, 'branch');
}

export async function onSave(s: Session): Promise<any[]> {
  if (s.savedReportId && !s.items.length && !s.extra?.length && !(s.rawText && s.rawText.trim())) {
    return [text(`รายงานนี้บันทึกไปแล้วครับ (เลขที่ #${s.savedReportId})\nแท็กบอทเพื่อเริ่มรายงานใหม่ได้เลย`)];
  }
  const errs = saveBlockers(s);
  if (errs.length) {
    return [text('ยังไม่สามารถบันทึกได้ครับ กรุณาตรวจสอบ:\n• ' + errs.join('\n• ')), summaryFlex(s)];
  }
  acceptNewBrands(s);
  let savedId: number | undefined;
  try {
    if (sqlEnabled()) {
      savedId = await saveReport(s);
      console.log('บันทึกลง SQL: report id', savedId, 'โดย', s.userId);
      const allKeys = s.photoKeys || [];
      if (allKeys.length) await deletePhotos(allKeys);
    } else {
      console.log('SAVED (demo):', JSON.stringify({ topic: s.topicName, items: s.items }));
    }
  } catch (e: any) {
    console.error('save error', e);
    return [text('บันทึกลงระบบไม่สำเร็จครับ กรุณากดบันทึกอีกครั้ง\n(' + (e.message || '') + ')'), summaryFlex(s)];
  }
  const recap = {
    id: savedId,
    store: [s.account, s.branch].filter(Boolean).join(' · ') || undefined,
    nItems: s.items.length,
    nPhotos: s.photoKeys?.length || 0,
  };
  logParse({ userId: s.userId, raw: s.rawText, merged: sessionSnapshot(s), outcome: 'saved', reportId: savedId });
  start(s);
  s.savedReportId = savedId;
  return [savedCard(recap)];
}

export function acceptNewBrands(s: Session): void {
  for (const it of s.items) {
    if (!it.needsReview) continue;
    if (!it.brand && it.rawBrand) {
      it.brand = it.rawBrand;
      it.isNpd = true;
    }
    if (it.brand) it.needsReview = false;
  }
}
