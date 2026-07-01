
export const STORE_STEPS = ['topic', 'channel', 'account', 'branch', 'company'];
export const PRODUCT_STEPS = ['category', 'subCategory', 'brand', 'size', 'pack', 'variant', 'reportType', 'reportSubtype'];
export const CLOSING_STEPS = ['startDate', 'endDate', 'photo'];

export const ORDER = [...STORE_STEPS, ...PRODUCT_STEPS, 'addMore', ...CLOSING_STEPS, 'summary'];

export const STEP_SECTIONS: { label: string; steps: string[] }[] = [
  { label: 'ข้อมูลร้าน', steps: STORE_STEPS },
  { label: 'สินค้า', steps: PRODUCT_STEPS },
  { label: 'ปิดท้าย', steps: CLOSING_STEPS },
];

export const FIELD_TITLE: Record<string, string> = {
  topic: 'หัวข้อที่จะแจ้ง', channel: 'ช่องทาง', account: 'ห้าง / ร้านค้า',
  branch: 'สาขา', company: 'บริษัท', category: 'กลุ่มสินค้า',
  subCategory: 'ประเภทสินค้า', brand: 'ยี่ห้อ', size: 'ไซส์', pack: 'แพ็ค',
  variant: 'กลิ่น / สี / รสชาติ', addMore: 'เพิ่มสินค้า',
  reportType: 'รายการที่จะแจ้ง', reportSubtype: 'รายการย่อย',
  itemNote: 'รายละเอียดสินค้า',
  startDate: 'วันเริ่มรายการ', endDate: 'วันจบรายการ',
  product: 'สินค้า + โปร (กรอกใหม่)',
};

export const EDITABLE_STEPS = ['topic', 'channel', 'account', 'branch', 'company', 'product', 'startDate', 'endDate'];
