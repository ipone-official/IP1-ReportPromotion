# Roadmap (ฉบับ pilot-driven 2 เดือน) — IP1 Promo Bot: แม่นกับ "ของที่ทำนายไม่ได้"

## ความจริงตั้งต้น (ที่กำหนดทั้งแผน)
**หน้างานพิมพ์อะไรมาก็ไม่รู้ล่วงหน้า (open-world)** → จะ "เทสให้ครบทุกอย่าง" เป็นไปไม่ได้
ดังนั้นแผนนี้ **ไม่เน้นเดา input ล่วงหน้า** แต่เน้น 2 อย่าง:
1. **ออกแบบให้รับมือ "อะไรก็ได้" อย่างไม่พัง** (robust to unknown)
2. **เอาของจริงมาเจอเร็วที่สุด (pilot) แล้วเรียน/วัดจากของจริง** — ของจริงคือตัววัดเดียวที่เชื่อได้

> ⚠️ gold set สังเคราะห์ = แค่ "ตาข่ายกันของเดิมพัง" (regression net) **ไม่ใช่หลักฐานว่าแม่น** — ตัวเลขจริงมาจาก pilot เท่านั้น

## หลักการ
- **Capture-first** — AI อ่าน/เก็บทุกอย่างแม้ไม่รู้จัก ข้อมูลไม่หาย
- **LLM generalize** — ใช้ความรู้โลกของ AI ครอบของที่ master ไม่มี (ของใหม่/คู่แข่งที่ไม่เคยเห็น)
- **Graceful + confirm** — ไม่รู้จัก → flag + ถามยืนยัน ไม่พัง ไม่เดาผิดเงียบ
- **Learn continuously** — ทุก input จริง → โต master/alias เอง → รอบหน้าแม่นขึ้น
- **Measure on real data** — วัดจาก pilot ไม่ใช่จากจินตนาการ

## สถานะ Phase 0 (เสร็จแล้ว)
- ✅ infra (gateway+worker+redis+meili+sql, deploy, durability) · matching (string+Meili typo)
- ✅ master seed 73 ยี่ห้อ + ownBrands · schema 11 field structured (price/promo/competitor/...)
- ✅ AI สกัด structured fields (วัด synthetic: ส่วนใหญ่ 100%, isCompetitor/size/pricePromo ติดเพดานข้อมูล)
- ✅ eval harness (`eval-goldset.ts`) = regression net · promote-brands/alias-learning (รอ data จริง)

---

## Phase 1 (สัปดาห์ 1-2) — ทำให้ "รับมือของที่ไม่รู้จัก" ได้ก่อน ⭐
> ก่อน pilot ต้องมั่นใจว่า "เจออะไรก็ไม่พัง + ของใหม่ไม่หาย"
- **AI-assisted entity resolution** — AI ติดธงต่อ item: ตรง master / ใหม่จริง / มั่ว → ใหม่จริง **เชื่อ + ลงทะเบียน master อัตโนมัติ** (ไม่ตี needsReview ทิ้ง) ← ตัวรับมือ unknown โดยตรง
- **Confidence + confirm UX** — มั่นใจสูง=auto, ต่ำ=ถามปุ่มยืนยัน (ไม่เดาผิดเงียบ)
- **Self-learning wired** — ยืนยัน/แก้ของคน → promote-brands + alias-learning ทำงานอัตโนมัติ
- regression net: gold set สังเคราะห์เล็ก ๆ (มีแล้ว) ใช้กันโค้ดเดิมพัง
- 🎯 DoD: พิมพ์ยี่ห้อ/ร้านที่ไม่เคยเห็น → ระบบเก็บได้ + flag/ลงทะเบียน ไม่พัง

## Phase 2 (สัปดาห์ 2-3) — PILOT เร็ว + วัดจากของจริง ⭐⭐
> หัวใจของแผนนี้ — เอาของจริงมาเจอ ไม่ใช่รอท้าย
- **Soft pilot** — ปล่อยหน้างานจริง 3-10 คนใช้ (channel จริง) เก็บ log ทุกอย่าง
- **สร้าง gold set จากของจริง** — เอา log pilot จริงมา คน(ทีม)รีวิว/เฉลย → **gold set ที่เชื่อได้** (แทน synthetic)
- **วัด accuracy บนของจริง** ครั้งแรก → รู้เลขจริงต่อ field
- 🎯 DoD: มีข้อมูลจริงไหลเข้า + gold set จริง + baseline accuracy ที่เชื่อถือได้

## Phase 3 (สัปดาห์ 3-5) — ไล่อุดจาก "ของจริง" (วนเรียนรู้)
> climbing loop: ดูที่พลาดจริง → แก้ → วัดซ้ำ
- **mine log pilot** — หา failure mode ที่เจอจริงบ่อยสุด (master gap / matching / prompt / field ใหม่)
- อุดทีละจุดตามความถี่จริง: promote ยี่ห้อจริง, จูน matching/prompt, จูน isCompetitor (ด้วย brand→company จากของจริง)
- re-measure บน gold จริงทุกครั้ง (CI)
- 🎯 DoD: accuracy ต่อ field บนของจริงไต่ถึงเป้า KPI

## Phase 4 (สัปดาห์ 5-6) — BI บนข้อมูลจริง
- การ์ด/flow ยืนยัน field ใหม่ + dashboard (ส่วนลด/เรา-vs-คู่แข่ง/เทรนด์) จาก report จริง ([sql/08_bi_views.sql](sql/08_bi_views.sql))
- 🎯 DoD: ได้ insight ธุรกิจจากของจริง

## Phase 5 (สัปดาห์ 6-8) — แข็งแรง + ขยาย → ปิดงาน
- **Security/PDPA** (rotate sa/secret, least-priv, encryption, ดูแล personal data)
- **Observability** (Sentry + uptime `/healthz` + alert) · **Backup/DR** · **CI gate** (build+eval ผ่านก่อน deploy)
- **ขยาย pilot → full rollout** + validate accuracy รอบสุดท้ายบนของจริง = ปิดงาน
- 🎯 DoD: ปลอดภัย/ตรวจสอบได้/กู้คืนได้ + rollout จริงผ่านเกณฑ์

---

## Self-improving loop (อยู่ตัวหลังส่งมอบ)
```
หน้างาน(อะไรก็ได้) → AI สกัด+เก็บ → resolve(master+Meili+LLM knowledge) → confidence
   ├ สูง → auto    ├ ใหม่จริง → เชื่อ+ลงทะเบียน    └ ต่ำ/มั่ว → คนยืนยัน
                          ↓ การแก้ของคน → +gold(จริง) +alias +master โตเอง
                          ↓ re-measure(บนของจริง) → ดีขึ้นค่อย ship (CI)
```

## KPI ปิดงาน (วัดบน "ของจริงจาก pilot" เท่านั้น)
brand/store >90% · is_competitor >90% (เมื่อมี brand→company) · dates >95% · price สกัด >85% · auto-accept >70% · needsReview(จริง) <20%

## ✅ Definition of Done
- [ ] ระบบรับมือ unknown ได้ (capture+ลงทะเบียน+confirm ไม่พัง)
- [ ] pilot จริงรัน + gold set จากของจริง + วัด accuracy ของจริง
- [ ] ไล่อุดจาก log จริงจนถึง KPI
- [ ] BI dashboard บนข้อมูลจริง
- [ ] security/PDPA + observability + backup + CI
- [ ] full rollout ผ่านเกณฑ์

## สิ่งที่เปลี่ยนจากฉบับก่อน (สำคัญ)
1. **pilot ขยับจากสัปดาห์ 7-8 → 2-3** (ของจริงคือตัววัดเดียว ต้องมาก่อน)
2. **gold set สังเคราะห์ลดบทบาท → regression net** ; gold จริงจาก pilot = ตัวหลัก
3. **Phase 1 เปลี่ยนเป็น "รับมือ unknown" ก่อน** (ไม่ใช่ไล่วัดทุก field บน synthetic)
