import { useState } from "react";
import { Save, Key, FolderOpen, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminTabProps } from "../shared/AdminTabProps";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useAuth } from "@/contexts/AuthContext";
import { sendWebhook } from "@/lib/webhookSender";
import { keyDeleteEmbed } from "@/lib/webhookTemplates";

const AdminKeysTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const { user, profile } = useAuth();
  const isOwner = profile?.role === "owner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ตั้งค่าระบบคีย์</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการระบบกดคีย์และ Webhook</p>
      </div>
      <div className="glass-card space-y-5">
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${form.keySystemEnabled ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, keySystemEnabled: !form.keySystemEnabled })} />
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบกดคีย์</span>
          </label>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${form.cooldownEnabled !== false ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, cooldownEnabled: !(form.cooldownEnabled !== false) })} />
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบ Cooldown</span>
          </label>
          <p className="text-[10px] text-muted-foreground mt-1">เปิด/ปิดระบบ Cooldown ทั้งระบบ (ปิดแล้วจะไม่มี Cooldown ทุกสินค้า)</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">คีย์สูงสุดต่อผู้ใช้ (ต่อสินค้า) <span className="text-xs text-muted-foreground font-normal">0 = ไม่จำกัด</span></label>
          <input type="number" min="0" max="999" value={form.maxKeysPerUser ?? 0} onChange={(e) => setForm({ ...form, maxKeysPerUser: Math.max(0, parseInt(e.target.value) || 0) })} className="input-glass w-full px-4 py-3 text-sm" placeholder="0 = ไม่จำกัด" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">คีย์สูงสุดต่อครั้ง <span className="text-xs text-muted-foreground font-normal">0 = ไม่จำกัด</span></label>
          <input type="number" min="0" max="999" value={form.maxKeysPerClaim ?? 0} onChange={(e) => setForm({ ...form, maxKeysPerClaim: Math.max(0, parseInt(e.target.value) || 0) })} className="input-glass w-full px-4 py-3 text-sm" placeholder="0 = ไม่จำกัด" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">เตือนเมื่อคีย์เหลือน้อยกว่า</label>
          <input type="number" min="1" max="100" value={form.lowStockThreshold || 5} onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 5 })} className="input-glass w-full px-4 py-3 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">⏳ Cooldown หลังกดคีย์ (ชั่วโมง) <span className="text-xs text-muted-foreground font-normal">0 = ไม่มี Cooldown</span></label>
          <input type="number" min="0" max="720" value={form.claimCooldownHours || 0} onChange={(e) => setForm({ ...form, claimCooldownHours: parseInt(e.target.value) || 0 })} className="input-glass w-full px-4 py-3 text-sm" disabled={form.cooldownEnabled === false} />
          <p className="text-[10px] text-muted-foreground mt-1">ค่ากลาง — ผู้ใช้ต้องรอกี่ชั่วโมงก่อนกดสินค้าตัวเลือกเดิมได้อีก (ตั้งค่าเฉพาะตัวเลือกได้ในหน้าสินค้า)</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${form.lowStockWebhookEnabled ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, lowStockWebhookEnabled: !form.lowStockWebhookEnabled })} />
            <span className="text-sm font-semibold text-foreground">แจ้งเตือนคีย์ใกล้หมดผ่าน Webhook</span>
          </label>
        </div>
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกตั้งค่าคีย์</button>

      {isOwner && (
        <div className="glass-card space-y-4 mt-6">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2"><FolderOpen size={16} /> Archive คีย์เก่า</h3>
          <p className="text-xs text-muted-foreground">ย้ายคีย์ที่ถูกกดไปแล้วเกิน 90 วัน ไปเก็บใน collection แยก เพื่อให้ query หลักเร็วขึ้น</p>
          <button
            onClick={async () => {
              try {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 90);
                const cutoffTimestamp = { seconds: Math.floor(cutoff.getTime() / 1000) };
                const q2 = query(collection(db, "keys"), where("claimed", "==", true));
                const snap = await getDocs(q2);
                let archiveCount = 0;
                const batch: Promise<void>[] = [];
                for (const docSnap of snap.docs) {
                  const data = docSnap.data();
                  const claimedAt = data.claimedAt;
                  if (!claimedAt) continue;
                  const claimedSeconds = claimedAt.seconds || 0;
                  if (claimedSeconds < cutoffTimestamp.seconds) {
                    batch.push(
                      (async () => {
                        await setDoc(doc(db, "archivedKeys", docSnap.id), { ...data, archivedAt: serverTimestamp() });
                        await deleteDoc(doc(db, "keys", docSnap.id));
                      })()
                    );
                    archiveCount++;
                  }
                }
                if (archiveCount === 0) { toast.info("ไม่มีคีย์ที่เก่าเกิน 90 วัน"); return; }
                await Promise.all(batch);
                toast.success(`Archive สำเร็จ! ย้าย ${archiveCount} คีย์เก่า`);
                if (user && profile) await logActivity(user, profile, "archive_keys", `Archive ${archiveCount} คีย์เก่าเกิน 90 วัน`);
                sendWebhook(form, "keyDelete", [keyDeleteEmbed({
                  mode: "archive",
                  actorDisplay: `${profile?.displayName || profile?.email || "Admin"} (${user?.email || "-"})`,
                  actorRole: profile?.role || "admin",
                  count: archiveCount,
                  reason: "ย้ายคีย์ที่ถูกกดเกิน 90 วันไปยัง archivedKeys",
                  brandName: form.brandName,
                })], { dedupeKey: `keyArchive:${Date.now()}` }).catch(() => {});
              } catch (err) {
                console.error("Archive error:", err);
                toast.error("Archive ล้มเหลว");
              }
            }}
            className="btn-glass w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <FolderOpen size={14} /> Archive คีย์เก่า (90 วัน+)
          </button>
          <Link to="/archived-keys" className="btn-glass w-full py-3 text-sm flex items-center justify-center gap-2 mt-2">
            <Eye size={14} /> ดูคีย์ที่ Archive แล้ว
          </Link>
          <p className="text-[10px] text-muted-foreground mt-2">⏰ ระบบจะ Auto-Archive ทุกวันเวลาเที่ยงคืนอัตโนมัติ</p>
        </div>
      )}
    </div>
  );
};

export default AdminKeysTab;
