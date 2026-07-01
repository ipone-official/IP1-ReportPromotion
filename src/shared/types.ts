


export interface ReportItem {
  category?: string;
  subCategory?: string;
  rawSubCategory?: string;
  brand?: string;
  rawBrand?: string;
  needsReview?: boolean;
  isNpd?: boolean;
  size?: string;
  pack?: string;
  variant?: string;
  rawVariant?: string;
  rawReportSubtype?: string;
  reportType?: string;
  reportSubtype?: string;
  detail?: string;
  itemNote?: string;
  approx?: string[];
  // Phase 1: field ใหม่ (AI สกัดใน Phase 3 — ตอนนี้ optional, save เป็น null ได้)
  isCompetitor?: boolean;      // ของเรา / คู่แข่ง
  priceNormal?: number;        // ราคาปกติ
  pricePromo?: number;         // ราคาโปร
  discountPct?: number;        // %ลด (คำนวณ)
  promoType?: string;          // กลไกโปร: discount | buy_x_get_y | threshold_gift | ...
  buyQty?: number;
  freeQty?: number;
  thresholdBaht?: number;
  stockStatus?: string;        // มี / ของหมด
  facings?: number;            // จำนวน facing (display)
}

export type Session = {
  step?: string;
  awaitingText?: string;
  asked: string[];
  editing?: boolean;
  userId?: string;
  topicCode?: string;
  topicName?: string;
  channel?: string;
  account?: string;
  branch?: string;
  company?: string;
  current: Partial<ReportItem>;
  items: ReportItem[];
  startDate?: string;
  endDate?: string;
  observationDate?: string;    // Phase 1: วันที่สังเกตหน้างาน (ต่างจากวันโปร)
  photoCount: number;
  photoKeys?: string[];
  lastSeen?: number;
  extra?: string[];
  rawText?: string;
  pendingReport?: string;
  fillingMissing?: boolean;
  askingMore?: boolean;
  skipMore?: boolean;
  askRounds?: number;
  pendingFields?: string[];
  storeCands?: { account: string; branch: string }[];
  editItemIndex?: number;
  editExtraIndex?: number;
  editTarget?: { i: number; field: string };
  storeNew?: boolean;
  skippedFields?: string[];
  lastBotInteract?: number;
  approx?: string[];
  savedReportId?: number;
  typedStore?: string;
  typedBrand?: string;
  typedVariant?: string;
  typedSubCategory?: string;
  typedCompany?: string;
  typedReportSubtype?: string;
  reportSubtypeSelections?: string[];
};
