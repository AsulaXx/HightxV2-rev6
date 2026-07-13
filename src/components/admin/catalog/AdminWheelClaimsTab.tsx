import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit as fLimit } from "firebase/firestore";
import { Loader2, RefreshCw, Download, Search } from "lucide-react";
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

const todayISO = () => toThaiDateKey();
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toThaiDateKey(d);
};

const fmtRaw = (v: any): string => {
  if (!v) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v?.toDate === "function") {
    try { return v.toDate().toISOString(); } catch { return "[Timestamp]"; }
  }
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  try { return JSON.stringify(v); } catch { return String(v); }
};

const fmtType = (v: any): string => {
  if (v == null) return "null";
  if (v instanceof Date) return "Date";
  if (typeof v?.toDate === "function") return "Timestamp";
  if (typeof v?.seconds === "number") return "Timestamp-like";
  return typeof v;
};

export default function AdminWheelClaimsTab() {
  const [from, setFrom] = useState<string>(daysAgoISO(7));
  const [to, setTo] = useState<string>(todayISO());
  const [loading, setLoading] = useState(false);
  const [allClaims, setAllClaims] = useState<WheelClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [includeUndated, setIncludeUndated] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, "wheelClaims"), fLimit(5000)));
      const docs: WheelClaim[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setAllClaims(docs);
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = allClaims.filter(c => {
      const dt = toDateSafe(c.claimedAt) || toDateSafe(c.createdAt);
      if (!dt) return includeUndated;
      const key = toThaiDateKey(dt);
      if (key < from || key > to) return false;
      if (s) {
        const blob = [
          c.id, c.userId, c.userEmail, c.userName, c.wheelName, c.wheelId,
          c.prizeLabel, c.productName, c.key, c.attemptId,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      const da = (toDateSafe(a.claimedAt) || toDateSafe(a.createdAt))?.getTime() || 0;
      const db2 = (toDateSafe(b.claimedAt) || toDateSafe(b.createdAt))?.getTime() || 0;
      return db2 - da;
    });
    return rows;
  }, [allClaims, from, to, search, includeUndated]);

  const stats = useMemo(() => {
    const total = allClaims.length;
    const inRange = filtered.length;
    const undated = allClaims.filter(c => !toDateSafe(c.claimedAt) && !toDateSafe(c.createdAt)).length;
    const onlyCreated = allClaims.filter(c => !toDateSafe(c.claimedAt) && toDateSafe(c.createdAt)).length;
    return { total, inRange, undated, onlyCreated };
  }, [allClaims, filtered]);

  const exportXLSX = () => {
    const rows = filtered.map(c => ({
      id: c.id,
      claimedAt_raw: fmtRaw(c.claimedAt),
      claimedAt_type: fmtType(c.claimedAt),
      createdAt_raw: fmtRaw(c.createdAt),
      createdAt_type: fmtType(c.createdAt),
      thaiDateKey: toThaiDateKey(toDateSafe(c.claimedAt) || toDateSafe(c.createdAt) || undefined),
      wheelId: c.wheelId || "",
      wheelName: c.wheelName || "",
      prizeId: c.prizeId || "",
      prizeLabel: c.prizeLabel || "",
      productName: c.productName || "",
      key: c.key || "",
      userId: c.userId || "",
      userName: c.userName || "",
      userEmail: c.userEmail || "",
      costCredit: Number(c.costCredit) || 0,
      attemptId: c.attemptId || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WheelClaims");
    XLSX.writeFile(wb, `wheel-claims-inspect-${from}_${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">ตรวจ Wheel Claims (ต้นทาง)</h2>
        <p className="text-xs text-muted-foreground mt-1">
          แสดงข้อมูลดิบจาก collection <code>wheelClaims</code> เพื่อเทียบกับที่ Dashboard / UI แสดง
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end p-3 rounded-xl border border-border bg-muted/20">
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">ตั้งแต่ (เขตเวลาไทย)</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground mb-1">ถึง</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1">ค้นหา (user/prize/key/id)</label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="พิมพ์เพื่อค้นหา..."
              className="bg-background border border-border rounded-md pl-7 pr-2 py-1.5 text-sm w-full" />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <input type="checkbox" checked={includeUndated} onChange={e => setIncludeUndated(e.target.checked)} />
          รวมรายการไม่มีวันที่
        </label>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1 hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} โหลดใหม่
        </button>
        <button onClick={exportXLSX} disabled={!filtered.length}
          className="px-3 py-1.5 rounded-md bg-muted text-foreground text-sm flex items-center gap-1 hover:bg-muted/70 disabled:opacity-50">
          <Download size={14} /> Export
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-muted/30 border border-border">
          <div className="text-xs text-muted-foreground">ทั้งหมดใน DB (โหลด)</div>
          <div className="text-xl font-bold mt-1">{stats.total.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border">
          <div className="text-xs text-muted-foreground">ตรงเงื่อนไขที่ฟิลเตอร์</div>
          <div className="text-xl font-bold mt-1 text-primary">{stats.inRange.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border">
          <div className="text-xs text-muted-foreground">ไม่มี claimedAt (ใช้ createdAt)</div>
          <div className="text-xl font-bold mt-1">{stats.onlyCreated.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border">
          <div className="text-xs text-muted-foreground">ไม่มีวันที่เลย</div>
          <div className="text-xl font-bold mt-1">{stats.undated.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">claimedAt (raw / type)</th>
                <th className="px-2 py-2">createdAt (raw / type)</th>
                <th className="px-2 py-2">Thai Date</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Wheel</th>
                <th className="px-2 py-2">Prize</th>
                <th className="px-2 py-2 text-right">เครดิต</th>
                <th className="px-2 py-2">Doc ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const dt = toDateSafe(c.claimedAt) || toDateSafe(c.createdAt);
                return (
                  <tr key={c.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      <div>{fmtRaw(c.claimedAt)}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtType(c.claimedAt)}</div>
                    </td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      <div>{fmtRaw(c.createdAt)}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtType(c.createdAt)}</div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {dt ? toThaiDateKey(dt) : <span className="text-destructive">ไม่มี</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <div>{c.userName || c.userEmail || "-"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{c.userId || ""}</div>
                    </td>
                    <td className="px-2 py-1.5">{c.wheelName || c.wheelId || "-"}</td>
                    <td className="px-2 py-1.5">
                      <div>{c.prizeLabel || c.productName || "-"}</div>
                      {c.key && <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">{c.key}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{(Number(c.costCredit) || 0).toLocaleString()}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{c.id}</td>
                  </tr>
                );
              })}
              {!filtered.length && !loading && (
                <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูลตามเงื่อนไข</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
