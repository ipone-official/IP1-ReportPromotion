import { Session } from '../shared/types';
import { savePhoto, deletePhotos } from '../infra/photoStore';
import { summaryFlex, text } from '../view/cards';
import { ask, continueLoop } from './nav';

export function onImage(s: Session, photo?: { data: Buffer; type: string }): any[] {
  if (!photo) {
    if (s.step === 'photo') return [text('ดึงรูปจาก LINE ไม่สำเร็จ กรุณาส่งรูปอีกครั้งครับ'), ...ask(s, 'photo')];
    return [text('ดึงรูปจาก LINE ไม่สำเร็จ กรุณาส่งรูปอีกครั้งครับ')];
  }
  (s.photoKeys = s.photoKeys || []).push(savePhoto(photo.data));
  s.photoCount = s.photoKeys.length;
  if (s.askingMore) {
    const next = continueLoop(s);
    if (next) return next;
  }
  s.step = 'summary';
  return [];
}

export function onDelReportPhoto(s: Session, photoIndex: number): any[] {
  const keys = s.photoKeys || [];
  const key = keys[photoIndex];
  if (key) deletePhotos([key]);
  s.photoKeys = keys.filter((_, j) => j !== photoIndex);
  s.photoCount = s.photoKeys.length;
  s.step = 'summary';
  return [text('ลบรูปแล้วครับ'), summaryFlex(s)];
}
