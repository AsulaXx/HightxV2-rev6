# 🔐 Secrets Configuration Guide

คู่มือสำหรับการตั้งค่า Secrets ทั้งหมดของโปรเจกต์ ใช้สำหรับเวลาย้ายโปรเจกต์ (remix) หรือสร้างใหม่
ให้กรอกค่าทั้งหมดที่นี่ก่อน แล้วค่อยนำไปใส่ใน **Lovable → Project Settings → Secrets**

> ⚠️ **ห้าม commit ไฟล์นี้พร้อมค่าจริงขึ้น Git!**
> ถ้าจะเก็บไว้ใช้งานส่วนตัว แนะนำให้ copy เป็น `SECRETS.local.md` (อยู่ใน .gitignore แล้ว)

---

## 📋 รายการ Secrets ที่ต้องตั้งค่า

### 1. Firebase Admin (สำหรับ Edge Functions)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON ทั้งก้อนของ Service Account | Firebase Console → Project Settings → Service accounts → **Generate new private key** |

```
FIREBASE_SERVICE_ACCOUNT=
```

---

### 2. Thunder API (ระบบเช็คคีย์/ลูกค้า)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `THUNDER_API_KEY` | API Key สำหรับเรียก Thunder API | https://thunder.byshield.com → Dashboard → API Keys |

```
THUNDER_API_KEY=
```

---

### 3. MeeLike (ระบบเพิ่มยอด Booster)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `MEELIKE_API_KEY` | API Key สำหรับสั่งงาน MeeLike | https://meelike.com → My Account → API |

```
MEELIKE_API_KEY=
```

---

### 4. Slip2Go (ตรวจสลิปอัตโนมัติ)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `SLIP2GO_API_KEY` | API Key สำหรับ Slip2Go | https://slip2go.com → Developer → API Key |

```
SLIP2GO_API_KEY=
```

---

### 5. RDCW (QR PromptPay / รับเงิน)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `RDCW_CLIENT_ID` | Client ID จาก RDCW | https://rdcw.co.th → Developer Portal |
| `RDCW_CLIENT_SECRET` | Client Secret จาก RDCW | (เช่นเดียวกัน) |

```
RDCW_CLIENT_ID=
RDCW_CLIENT_SECRET=
```

---

### 6. PlernPay (ช่องทางชำระเงินสำรอง)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `PLERNPAY_CLIENT_ID` | Client ID จาก PlernPay | https://plernpay.com → Developer |
| `PLERNPAY_CLIENT_SECRET` | Client Secret จาก PlernPay | (เช่นเดียวกัน) |

```
PLERNPAY_CLIENT_ID=
PLERNPAY_CLIENT_SECRET=
```

---

### 7. Ruzien Bypass (ระบบ Bypass UID)

| Secret Name | คำอธิบาย | ที่มา |
|---|---|---|
| `RUZIEN_BYPASS_PUBLIC_KEY` | Public Key สำหรับ Ruzien Bypass API | จากผู้ให้บริการ Ruzien |
| `RUZIEN_BYPASS_SECRET` | Secret Key สำหรับ Ruzien Bypass API | (เช่นเดียวกัน) |

```
RUZIEN_BYPASS_PUBLIC_KEY=
RUZIEN_BYPASS_SECRET=
```

---

## 🚀 วิธีนำไปใช้

1. กรอกค่าทั้งหมดในไฟล์นี้ (หรือ copy เป็น `SECRETS.local.md`)
2. เปิด Lovable → **Project Settings → Secrets**
3. กดปุ่ม **Add Secret** แล้วใส่ชื่อ + ค่า ทีละตัวตามตารางด้านบน
4. หรือสั่งให้ AI ใน chat ว่า "อัปเดต secret XXX ให้หน่อย" ระบบจะเปิดฟอร์มให้กรอกอย่างปลอดภัย

## 🔁 Checklist ตอนย้ายโปรเจกต์ (Remix)

- [ ] `FIREBASE_SERVICE_ACCOUNT`
- [ ] `THUNDER_API_KEY`
- [ ] `MEELIKE_API_KEY`
- [ ] `SLIP2GO_API_KEY`
- [ ] `RDCW_CLIENT_ID`
- [ ] `RDCW_CLIENT_SECRET`
- [ ] `PLERNPAY_CLIENT_ID`
- [ ] `PLERNPAY_CLIENT_SECRET`
- [ ] `RUZIEN_BYPASS_PUBLIC_KEY`
- [ ] `RUZIEN_BYPASS_SECRET`

หลังตั้งค่าครบแล้ว ระบบ Edge Functions จะทำงานได้เต็มรูปแบบ ✅
