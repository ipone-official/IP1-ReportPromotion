export const DEFAULT_SYNONYM_GROUPS: string[][] = [
  ["ซอง", "ถุง"],
  ["ขวด", "กระป๋อง", "กระปุก"],
  ["กล่อง", "ลัง"],
  ["แพ็ค", "โหล", "ชุด", "ชิ้น"],
  ["ลิตร", "ล"],
  ["มล", "มิลลิลิตร"]
];

export const DEFAULT_VARIANT_CLUSTERS: string[][] = [
  ["ชมพู", "ซากุระ", "sakura", "pink", "พิงค์", "บลอสซั่ม", "blossom", "ฟลอรัล", "floral", "โรส", "rose"],
  ["แดง", "แพชชั่น", "passion", "red", "โรแมนซ์", "romance"],
  ["ฟ้า", "เฟรช", "fresh", "blue", "มอร์นิ่ง", "morning", "โอเชี่ยน", "ocean"],
  ["ขาว", "เจนเทิล", "gentle", "white", "แป้งเด็ก", "เพียว", "pure"],
  ["ดำ", "มิสทีค", "mystique", "black"],
  ["ม่วง", "ลาเวนเดอร์", "lavender", "purple"],
  ["ทอง", "ลักซ์", "luxe", "gold", "ซันไชน์", "sunshine"]
];

export const DEFAULT_SUBCAT_KEYWORDS: Record<string, string[]> = {
  "ปรับผ้านุ่ม": ["ปรับ", "นุ่ม", "softener", "ปรับผ้านุ่ม", "ซากุระ", "ชมพู", "ซันไรส์", "แพชชั่น", "มิสทีค", "ลาเวนเดอร์", "บลอสซั่ม", "โรส", "ฟลอรัล", "โรมานซ์", "บูเก้", "sunrise", "mystique", "passion"],
  "ซักผ้า": ["ซัก", "laundry", "detergent", "ซักผ้า", "เจลบอล", "คลีน", "ต้านกลิ่นอับ", "ต้านแบคทีเรีย", "ตากในร่ม", "สะอาด", "indoor", "clean"],
  "ล้างจาน": ["ล้างจาน", "dish", "dishwash", "ล้าง", "มะนาว", "เจลล้างจาน"]
};

export const THAI_DIGITS_STR = "๐๑๒๓๔๕๖๗๘๙";

export const NORM_CHAR_MAP_REGEX = /[×✕*]/g;
export const NORM_WHITESPACE_REGEX = /\s+/g;
export const TONE_STRIP_REGEX = /[็-๎]/g;

export const DATE_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DATE_SIGNAL_REGEX_1 = /(?:เสาร์อาทิตย์|สิ้นเดือน|ปลายเดือน|ศุกร์|เสาร์|อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัส|นี้|หน้า)/;
export const DATE_SIGNAL_REGEX_2 = /(?:เริ่ม|ตั้งแต่|ถึง|หมด|สิ้นสุด|จบ)\s*(?:วันนี้|พรุ่งนี้|มะรืน)|(?:วันนี้|พรุ่งนี้|มะรืน)\s*(?:ถึง|[-–]|จนถึง|สิ้น)|วันที่\s*\d|เริ่ม\s*\d/;
export const DATE_SIGNAL_REGEX_3 = /\d{1,2}\s*[-–/]\s*\d{1,2}/;
export const DATE_SIGNAL_REGEX_4 = /\d{1,2}\s*(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)/;

export const DAY_NAMES_LIST = [
  { name: 'อาทิตย์', val: 0 },
  { name: 'จันทร์', val: 1 },
  { name: 'อังคาร', val: 2 },
  { name: 'พุธ', val: 3 },
  { name: 'พฤหัส', val: 4 },
  { name: 'ศุกร์', val: 5 },
  { name: 'เสาร์', val: 6 }
];

export const DAY_WEEK_CHECK_REGEX = /ถึง|จนถึง|หมด|สิ้นสุด|[-–]/;

export const SIZE_PACK_REGEX_1 = /^([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]*)\s*(?:x|✕|×|\*)\s*(\d+)$/i;
export const SIZE_PACK_REGEX_2 = /^(\d+)\s*(?:x|✕|×|\*)\s*([\d\.,\s]+[a-zA-Z\u0e00-\u0e7f\.]+)$/i;

export const SIZE_NORM_REPLACEMENTS = [
  { p: /ml|มิลลิลิตร/g, r: "มล" },
  { p: /kg|กิโลกรัม/g, r: "กก" },
  { p: /(?<!ม)[ลl](?!\d|ิตร)/g, r: "ลิตร" },
  { p: /(?<![kK])g|กรัม/g, r: "กรัม" },
];

export const CANONICAL_L_REGEX = /^(\d+(?:\.\d+)?)\s*(?:ลิตร|ล|l|L)$/;
export const CANONICAL_KG_REGEX = /^(\d+(?:\.\d+)?)\s*(?:กก|กิโลกรัม|kg|KG)$/;

export const BARE_NUMBER_REGEX = /^\d+(\.\d+)?$/;
export const BARE_NUMBER_CHECK_REGEX = /^\d+(\.\d+)?$/;
export const BARE_NUMBER_CANDIDATE_REGEX = /^\d+(\.\d+)?(มล|กรัม|กก|ลิตร)$/;

export const BARE_PACK_REGEX = /^\d+$/;
export const BARE_PACK_CANDIDATE_REGEX = /^\d+(ซอง|ขวด|ชิ้น|แพ็ค|ถุง)$/;

export const RANGE_MIN_MAX_REGEX = /^(\d+(?:\.\d+)?)[-–—](\d+(?:\.\d+)?)/;

export const PREFIX_STRIP_REGEX = /^(สี|กลิ่น)/;

export const SUBCAT_SNAP_KEYWORDS = ["ปรับ", "ซัก", "ล้าง", "เข้มข้น", "สเปรย์", "ฆ่าเชื้อ", "รีด", "ผ้า", "จาน"];

export const PACK_KEYWORDS_LIST = ['ซอง', 'ขวด', 'ชิ้น', 'แพ็ค', 'แพค', 'ลัง', 'ถุง', 'โหล'];
export const SIZE_UNITS_LIST = ['มล', 'กรัม', 'กก', 'ลิตร', 'ml', 'g', 'kg', 'l'];

export const COMPANY_MARKER_REGEX = /บริษัท|บจก|บมจ|ผู้ผลิต/;
export const YEAR_SIGNAL_REGEX = /\b(20\d{2}|25\d{2})\b|ปีหน้า|ปีที่แล้ว|ปีก่อน/;

export const PRICE_SUFFIX_REGEX = /(\d+)\s*(?:-\s*บาท|บาท\s*-\s*|บาท\s*\.-|\.-\s*บาท|\.-)/gi;
export const PRICE_BARE_NUM_REGEX = /(\d+)\s*บ(?:าท)?(?![ก-ฮ])/g;
export const PRICE_PREFIX_SHORTHAND_REGEX = /(ลดเหลือ|ราคา|เหลือ)\s*(\d+)(?!\d)(?!\s*(?:บาท|บ(?![ก-ฮ])))/gi;

export const LIST_MARKERS_REGEX = /^\s*[\d๐-๙]+\s*[\.\-\)\s]*\s*/;
export const CHAIN_PREFIX_STRIP_REGEX = /^(ร้าน|ห้าง|สาขา|บริษัท|บจก|บมจ|blueshop|blue\s*shop|bigc|big\s*c)/;

export const THAI_CONSONANTS_MAP: Record<string, string> = {
  'ก': '1', 'ข': '1', 'ฃ': '1', 'ค': '1', 'ฅ': '1', 'ฆ': '1',
  'จ': '2', 'ฉ': '2', 'ช': '2', 'ซ': '2', 'ฌ': '2',
  'ฎ': '2', 'ฏ': '2', 'ฐ': '2', 'ฑ': '2', 'ฒ': '2',
  'ด': '2', 'ต': '2', 'ถ': '2', 'ท': '2', 'ธ': '2',
  'ศ': '2', 'ษ': '2', 'ส': '2',
  'ณ': '3', 'น': '3', 'ม': '3', 'ล': '3', 'ฬ': '3',
  'บ': '4', 'ป': '4', 'ผ': '4', 'ฝ': '4', 'พ': '4', 'ฟ': '4', 'ภ': '4',
  'ย': '5', 'ญ': '5',
  'ร': '6',
  'ว': '7',
  'อ': '8', 'ฮ': '8',
  'ง': '9'
};

export const SOUNDEX_PREFIX_STRIP_REGEX = /^(น้ำยา|ผลิตภัณฑ์)/;

export const ESCAPE_RE_REGEX = /[.*+?^${}()|[\]\\]/g;
export const CORE_NORM_STRIP_1 = /[()]/g;
export const CORE_NORM_STRIP_2 = /ร้าน|ห้าง|บริษัท|บจก|บมจ|หจก|สาขา|จังหวัด|จ\.|อ\.|ต\.|ม\.|\bm\s*\d+\b/gi;
export const CORE_NORM_STRIP_3 = /[็-๎]/g;
export const CORE_NORM_STRIP_4 = /[.\s\-]/g;
export const BRANCH_REPLACE_PREFIX_REGEX = /^(blueshop|blue\s*shop|bigc|big\s*c|สหไทย|โอเชียน|โอเชี่ยน|แจ่มฟ้า|นานาภัณฑ์|เอสอาร์|sr6|sr)/i;
export const ACC_CORE_STRIP_REGEX = /บริษัท|มหาชน|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วน|หจก\.?|จำกัด|จก\.?|ร้าน|ค้าส่ง/gi;

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const TEXT_RESTART_EXIT_REGEX = /^(เริ่ม|เริ่มใหม่|start|ยกเลิก|reset)$/i;
export const TEXT_SKIP_MORE_REGEX = /^(ข้าม|ข้ามทั้งหมด|พอ|พอแล้ว|ครบแล้ว|จบ|skip|ไม่มี|ไม่มีแล้ว|ไม่รู้)$/i;
export const TEXT_SKIP_FIELDS_EXTRACT_REGEX = /^(?:ข้าม|ไม่มี|ไม่รู้)\s*(.+)$/;
export const REPORT_KW_REGEX = /คู่แข่ง|สินค้าใหม่|โปรโมชั่น|กิจกรรม|บูธ|ลดราคา|แจ้ง/g;
export const TEXT_CORRECT_TYPO_REGEX = /พิมพ์ผิด|เมื่อกี้\S{0,8}ผิด|ที่ถูก(คือ|ต้องเป็น|เป็น)|แก้เป็น|ขอแก้/;
export const RESIDUAL_CLEAN_REGEX = /^[-–—.,\s]+|[-–—.,\s]+$/g;
export const NORM_ENG_REGEX = /[^a-z0-9]/g;
