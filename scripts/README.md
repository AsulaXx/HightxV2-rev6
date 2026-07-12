# Dev Seed Scripts

## seed-firestore.mjs

เติมข้อมูลขั้นต่ำที่จำเป็นสำหรับเทสระบบ (owner user, settings, stats, 1 category, 1 product, 1 key, wallet).

### วิธีใช้

1. **ดาวน์โหลด Service Account** จาก Firebase Console
   `Project Settings → Service Accounts → Generate new private key`
   บันทึกเป็น `service-account.json` ที่ root ของโปรเจค
   (ไฟล์นี้อยู่ใน `.gitignore` แล้ว — อย่า commit)

2. **สมัคร account ในเว็บ 1 ครั้ง** (ผ่าน `/login`) เพื่อให้ Firebase Auth สร้าง UID
   แล้ว copy UID จาก Firebase Console → Authentication

3. **ติดตั้ง dep และรัน**
   ```bash
   npm i -D firebase-admin
   node scripts/seed-firestore.mjs <YOUR_UID> your@email.com
   ```

4. Refresh เว็บ → คุณจะเป็น `owner` มีเครดิต 1000 + มี demo product ให้กดซื้อ

### รันซ้ำได้
สคริปต์ใช้ `merge: true` — รันซ้ำจะ update ไม่ทับข้อมูลที่มี (ยกเว้น `keys` ที่สร้างใหม่ทุกครั้ง)
