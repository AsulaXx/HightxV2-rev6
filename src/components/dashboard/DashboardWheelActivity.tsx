import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit as fLimit } from "firebase/firestore";
import { Loader2, RefreshCw, Trophy, Coins, Users as UsersIcon, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toThaiDateKey } from "@/lib/utils";

interface WheelClaim {
  id: string;
  wheelId?: string;
  wheelName?: string;
  prizeId?: string;
  prizeLabel?: string;
  productName?: string;
  durationLabel?: string;
  key?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  costCredit?: number;
  attemptId?: string;
  claimedAt?: any;
  createdAt?: any;
}

const toDateSafe = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return null;
};

const todayISO = () => {
  return toThaiDateKey();
};
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toThaiDateKey(d);
};

const getClaimDate = (claim: WheelClaim): Date | null => {
  return toDateSafe(claim.claimedAt) || toDateSafe(claim.createdAt);
};

export default function DashboardWheelActivity() {
  const [from, setFrom] = useState<string>(daysAgoISO(7));
  const [to, setTo] = useState<string>(todayISO());
  const [loading, setLoading] = useState(false);
  const [claims, setClaims] = useState<WheelClaim[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Best-effort server-side range; fall back to client filter for non-Timestamp claimedAt
      // Use a simple orderBy query and filter on the client.
      // Avoids missing docs when `claimedAt` is stored as a string (legacy)
      // and prevents zero-result range queries from blocking display.
      // Always fetch unsorted to include legacy docs missing `claimedAt`.
      // orderBy() would silently drop docs that lack the indexed field.
      let docs: WheelClaim[] = [];
      try {
        const snap = await getDocs(query(collection(db, "wheelClaims"), fLimit(2000)));
        docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      } catch (e) {
        console.error("[DashboardWheelActivity] read failed", e);
        throw e;
      }
      const filtered = docs.filter(c => {
        const dt = getClaimDate(c);
        if (!dt) return false;
        const dateKey = toThaiDateKey(dt);
        return dateKey >= from && dateKey <= to;
      });
      // sort by best-available timestamp desc
      filtered.sort((a, b) => {
        const da = getClaimDate(a)?.getTime() || 0;
        const db2 = getClaimDate(b)?.getTime() || 0;
        return db2 - da;
      });
      setClaims(filtered);
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const stats = useMemo(() => {
    const totalClaims = claims.length;
    const totalRevenue = claims.reduce((s, c) => s + (Number(c.costCredit) || 0), 0);
    const uniqueUsers = new Set(claims.map(c => c.userId).filter(Boolean)).size;
    const byUser = new Map<string, { name: string; count: number; spent: number }>();
    const byPrize = new Map<string, { label: string; count: number }>();
    const byWheel = new Map<string, { name: string; count: number; revenue: number }>();
    for (const c of claims) {
      const uid = c.userId || "unknown";
      const u = byUser.get(uid) || { name: c.userName || c.userEmail || uid, count: 0, spent: 0 };
      u.count++; u.spent += Number(c.costCredit) || 0;
      byUser.set(uid, u);
      const pid = c.prizeId || c.prizeLabel || "unknown";
      const p = byPrize.get(pid) || { label: c.prizeLabel || c.productName || pid, count: 0 };
      p.count++;
      byPrize.set(pid, p);
      const wid = c.wheelId || "unknown";
      const w = byWheel.get(wid) || { name: c.wheelName || wid, count: 0, revenue: 0 };
      w.count++; w.revenue += Number(c.costCredit) || 0;
      byWheel.set(wid, w);
    }
    const topUsers = [...byUser.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const topPrizes = [...byPrize.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const topWheels = [...byWheel.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    return { totalClaims, totalRevenue, uniqueUsers, topUsers, topPrizes, topWheels };
  }, [claims]);

  const exportXLSX = () => {
    const rows = claims.map(c => ({
      claimedAt: getClaimDate(c)?.toLocaleString("th-TH") || "",
      wheel: c.wheelName || "",
      prize: c.prizeLabel || "",
      product: c.productName || "",
      duration: c.durationLabel || "",
      key: c.key || "",
      userName: c.userName || "",
      userEmail: c.userEmail || "",
      userId: c.userId || "",
      costCredit: Number(c.costCredit) || 0,
      attemptId: c.attemptId || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WheelClaims");
    XLSX.writeFile(wb, `wheel-claims-${from}_${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">ตั้งแต่</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">ถึง</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-sm" />
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1 hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} โหลดข้อมูล
        </button>
        <button onClick={exportXLSX} disabled={!claims.length}
          className="px-3 py-1.5 rounded-md bg-muted text-foreground text-sm flex items-center gap-1 hover:bg-muted/70 disabled:opacity-50">
          <Download size={14} /> Export Excel
        </button>
        <div className="ml-auto text-xs text-muted-foreground">รายการ: {claims.length}</div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy size={14} /> จำนวนเคลม</div>
          <div className="text-2xl font-bold mt-1">{stats.totalClaims.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins size={14} /> รายได้ (เครดิต)</div>
          <div className="text-2xl font-bold mt-1">{stats.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><UsersIcon size={14} /> ผู้ใช้ที่เล่น</div>
          <div className="text-2xl font-bold mt-1">{stats.uniqueUsers.toLocaleString()}</div>
        </div>
      </div>

      {/* Top breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <h4 className="text-sm font-semibold mb-2">Top ผู้ใช้</h4>
          {stats.topUsers.length === 0 ? <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p> :
            <ul className="text-xs space-y-1">
              {stats.topUsers.map((u, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {u.name}</span>
                  <span className="text-muted-foreground">{u.count} ครั้ง / {u.spent.toLocaleString()}</span>
                </li>
              ))}
            </ul>}
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <h4 className="text-sm font-semibold mb-2">Top รางวัล</h4>
          {stats.topPrizes.length === 0 ? <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p> :
            <ul className="text-xs space-y-1">
              {stats.topPrizes.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {p.label}</span>
                  <span className="text-muted-foreground">{p.count} ครั้ง</span>
                </li>
              ))}
            </ul>}
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <h4 className="text-sm font-semibold mb-2">Top วงล้อ (รายได้)</h4>
          {stats.topWheels.length === 0 ? <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p> :
            <ul className="text-xs space-y-1">
              {stats.topWheels.map((w, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {w.name}</span>
                  <span className="text-muted-foreground">{w.revenue.toLocaleString()} ({w.count})</span>
                </li>
              ))}
            </ul>}
        </div>
      </div>

      {/* Recent table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 text-sm font-semibold">เคลมล่าสุด</div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-1.5">เวลา</th>
                <th className="px-2 py-1.5">ผู้ใช้</th>
                <th className="px-2 py-1.5">วงล้อ</th>
                <th className="px-2 py-1.5">รางวัล</th>
                <th className="px-2 py-1.5 text-right">เครดิต</th>
              </tr>
            </thead>
            <tbody>
              {claims.slice(0, 100).map(c => (
                <tr key={c.id} className="border-t border-border/50">
                  <td className="px-2 py-1.5 whitespace-nowrap">{getClaimDate(c)?.toLocaleString("th-TH") || "-"}</td>
                  <td className="px-2 py-1.5">{c.userName || c.userEmail || c.userId}</td>
                  <td className="px-2 py-1.5">{c.wheelName || "-"}</td>
                  <td className="px-2 py-1.5">{c.prizeLabel || c.productName || "-"}</td>
                  <td className="px-2 py-1.5 text-right">{(Number(c.costCredit) || 0).toLocaleString()}</td>
                </tr>
              ))}
              {!claims.length && !loading && (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
