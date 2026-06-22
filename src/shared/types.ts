

export interface ReportItem {
  category?: string;
  subCategory?: string;
  brand?: string;
  rawBrand?: string;
  needsReview?: boolean;
  isNpd?: boolean;
  size?: string;
  pack?: string;
  variant?: string;
  reportType?: string;
  reportSubtype?: string;
  detail?: string;
  approx?: string[];
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
};
