import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { History, Copy, ArrowLeft, Package, Clock, Search, ShoppingCart, MessageSquare, ChevronDown, ChevronUp, CalendarDays, Banknote, ExternalLink, Zap } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as fsLimit } from "firebase/firestore";
import { toast } from "sonner";

interface ClaimRecord {
  key: string;
  productId: string;
  durationId: string;
  claimedAt: { seconds: number } | null;
  batchId?: string;
  claimMessage?: string;
  claimNote?: string;
  price?: number;
  purchaseType?: string;
}

interface BatchGroup {
  batchId: string;
  claims: ClaimRecord[];
  claimedAt: { seconds: number } | null;
  message?: string;
  totalPrice: number;
}

const ClaimHistoryPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [ruzienClaims, setRuzienClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    const loadClaims = async () => {
      try {
        const q = query(
          collection(db, "keys"),
          where("claimed", "==", true),
          where("claimedBy", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map((d) => d.data() as ClaimRecord)
          .sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0));
        setClaims(data);

        // Load Ruizen Bypass UID claim history
        try {
          const rq = query(
            collection(db, "ruzienBypassClaims"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            fsLimit(200)
          );
          const rsnap = await getDocs(rq);
          setRuzienClaims(rsnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (re) {
          console.error("Failed to load ruzien claims:", re);
        }
      } catch (err) {
        console.error("Failed to load claims:", err);
      }
      setLoading(false);
    };
    loadClaims();
  }, [user]);

  if (authLoading) return null;
  if (!user) return <RedirectToLogin />;
  

  const getProductName = (productId: string) => {
    const product = (settings.products || []).find((p) => p.id === productId);
    return product?.name || "สินค้า";
  };

  const getDurationLabel = (productId: string, durationId: string) => {
    const product = (settings.products || []).find((p) => p.id === productId);
    const duration = product?.durations.find((d) => d.id === durationId);
    return duration?.label || "ไม่ทราบ";
  };

  const getPostPurchaseButtons = (productId: string) => {
    const product = (settings.products || []).find((p) => p.id === productId);
    return (product?.postPurchaseButtons || []).filter(b => b.url?.trim()).slice(0, 4);
  };

  const renderPostPurchaseButtons = (productId: string) => {
    const buttons = getPostPurchaseButtons(productId);
    if (buttons.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {buttons.map((b, i) => (
          <a
            key={i}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <ExternalLink size={10} /> {b.label?.trim() || "เปิดลิงก์"}
          </a>
        ))}
      </div>
    );
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("คัดลอกคีย์สำเร็จ!");
  };

  const copyAllKeys = (keys: string[]) => {
    navigator.clipboard.writeText(keys.join("\n"));
    toast.success(`คัดลอก ${keys.length} คีย์สำเร็จ!`);
  };

  const formatDate = (timestamp: { seconds: number } | null) => {
    if (!timestamp) return "ไม่ทราบ";
    return new Date(timestamp.seconds * 1000).toLocaleString("th-TH");
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const filteredClaims = claims.filter((c) => {
    if (filterProduct && c.productId !== filterProduct) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.key.toLowerCase().includes(q) && !getProductName(c.productId).toLowerCase().includes(q)) return false;
    }
    if (dateFrom && c.claimedAt) {
      const claimDate = new Date(c.claimedAt.seconds * 1000);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (claimDate < fromDate) return false;
    }
    if (dateTo && c.claimedAt) {
      const claimDate = new Date(c.claimedAt.seconds * 1000);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (claimDate > toDate) return false;
    }
    return true;
  });

  const batchGroups: BatchGroup[] = [];
  const noBatchClaims: ClaimRecord[] = [];
  const batchMap = new Map<string, ClaimRecord[]>();

  for (const claim of filteredClaims) {
    if (claim.batchId) {
      if (!batchMap.has(claim.batchId)) batchMap.set(claim.batchId, []);
      batchMap.get(claim.batchId)!.push(claim);
    } else {
      noBatchClaims.push(claim);
    }
  }

  for (const [batchId, batchClaims] of batchMap) {
    batchGroups.push({
      batchId,
      claims: batchClaims,
      claimedAt: batchClaims[0]?.claimedAt || null,
      message: batchClaims[0]?.claimMessage,
      totalPrice: batchClaims.reduce((sum, c) => sum + (c.price || 0), 0),
    });
  }

  batchGroups.sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0));

  const pageSizes = [10, 20, 50, 100, 250, 500, 0]; // 0 = all
  const totalItems = batchGroups.length + noBatchClaims.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginate the combined list
  const allItems: { type: "batch"; data: BatchGroup }[] | { type: "single"; data: ClaimRecord }[] = [];
  const combinedItems = [
    ...batchGroups.map(b => ({ type: "batch" as const, data: b, time: b.claimedAt?.seconds || 0 })),
    ...noBatchClaims.map(c => ({ type: "single" as const, data: c, time: c.claimedAt?.seconds || 0 })),
  ].sort((a, b) => b.time - a.time);
  
  const paginatedItems = combinedItems.slice((safeCurrentPage - 1) * effectivePageSize, safeCurrentPage * effectivePageSize);

  const products = settings.products || [];

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ร้านกดคีย์", path: "/store" }, { label: "ประวัติการกดคีย์" }]}
        title="ประวัติการกดคีย์"
        subtitle={`${claims.length} รายการทั้งหมด`}
        icon={History}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass w-full pl-9 pr-4 py-2.5 text-sm"
              placeholder="ค้นหาคีย์หรือชื่อสินค้า..."
            />
          </div>
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="input-glass px-3 py-2.5 text-sm">
            <option value="">ทุกสินค้า</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">แสดง:</span>
            {pageSizes.map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  pageSize === size
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
                }`}
              >
                {size === 0 ? "ทั้งหมด" : size}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{filteredClaims.length} รายการ</span>
        </div>

        {/* Date Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <CalendarDays size={14} className="text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-glass w-full px-3 py-2 text-sm"
              placeholder="จากวันที่"
            />
          </div>
          <span className="text-muted-foreground text-sm self-center hidden sm:block">ถึง</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-glass w-full px-3 py-2 text-sm"
              placeholder="ถึงวันที่"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="btn-glass px-3 py-2 text-xs"
            >
              ล้าง
            </button>
          )}
        </div>

        {/* Ruizen Bypass UID claims */}
        {ruzienClaims.length > 0 && (() => {
          const nowMs = Date.now();
          const filteredRuzien = ruzienClaims.filter((r: any) => {
            // Hide expired Ruizen Bypass entries automatically
            if (r.expires_at) {
              const expMs = new Date(r.expires_at).getTime();
              if (Number.isFinite(expMs) && expMs <= nowMs) return false;
            }
            if (searchQuery) {
              const s = searchQuery.toLowerCase();
              if (!String(r.key || "").toLowerCase().includes(s)
                && !String(r.game_uid || "").toLowerCase().includes(s)
                && !"ruizen bypass uid".includes(s)) return false;
            }
            const ts = r.createdAt?.seconds;
            if (dateFrom && ts) {
              const d = new Date(ts * 1000);
              const f = new Date(dateFrom); f.setHours(0,0,0,0);
              if (d < f) return false;
            }
            if (dateTo && ts) {
              const d = new Date(ts * 1000);
              const t = new Date(dateTo); t.setHours(23,59,59,999);
              if (d > t) return false;
            }
            return true;
          });
          if (filteredRuzien.length === 0) return null;
          return (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Zap size={14} className="text-amber-400" />
                <h3 className="text-xs font-bold text-foreground">Ruizen Bypass UID ({filteredRuzien.length})</h3>
              </div>
              {filteredRuzien.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="badge-primary flex items-center gap-0.5"><Zap size={8} /> Ruizen Bypass</span>
                        <span className="badge-date flex items-center gap-0.5"><Clock size={8} /> {r.durationLabel || `${r.days} วัน`}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-foreground font-mono">UID: {r.game_uid}</span>
                      </div>
                      <code className="text-xs font-mono block break-all text-primary select-all">{r.key}</code>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] text-muted-foreground">{formatDate(r.createdAt)}</p>
                        {r.price > 0 ? (
                          <span className="text-[10px] font-bold text-primary">฿{Number(r.price).toLocaleString()}</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">ฟรี</span>
                        )}
                        {r.expires_at && (
                          <span className="text-[10px] text-muted-foreground">หมดอายุ: {new Date(r.expires_at).toLocaleString("th-TH")}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => copyKey(r.key)} className="btn-glass px-2.5 py-1.5 text-[10px] flex items-center gap-1 shrink-0"><Copy size={10} /> คัดลอก</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {loading ? (
          <div className="rounded-xl border border-border bg-card text-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="rounded-xl border border-border bg-card text-center py-16">
            <History size={36} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{claims.length === 0 ? "ยังไม่มีประวัติการกดคีย์" : "ไม่พบผลลัพธ์"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((item, idx) => {
              if (item.type === "batch") {
                const batch = item.data as BatchGroup;
                const isExpanded = expandedBatches.has(batch.batchId);
                const productSummary = new Map<string, number>();
                batch.claims.forEach(c => {
                  const name = `${getProductName(c.productId)} (${getDurationLabel(c.productId, c.durationId)})`;
                  productSummary.set(name, (productSummary.get(name) || 0) + 1);
                });

                return (
                  <motion.div
                    key={batch.batchId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => toggleBatch(batch.batchId)}
                      className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/10 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ShoppingCart size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">ตะกร้า {batch.claims.length} คีย์</span>
                          {batch.totalPrice > 0 ? (
                            <span className="text-xs font-bold text-primary">฿{batch.totalPrice.toLocaleString()}</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">ฟรี</span>
                          )}
                          {batch.message && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MessageSquare size={9} /> มีข้อความ</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Array.from(productSummary).map(([name, count]) => (
                            <span key={name} className="badge-primary">{name} ×{count}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDate(batch.claimedAt)}</p>
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border px-3.5 pb-3.5 pt-3 space-y-2">
                        {batch.message && (
                          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs text-foreground">
                            <span className="font-medium text-primary">💬</span> {batch.message}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button onClick={() => copyAllKeys(batch.claims.map(c => c.key))} className="btn-glass px-2.5 py-1 text-[10px] flex items-center gap-1">
                            <Copy size={10} /> คัดลอกทั้งหมด
                          </button>
                        </div>
                        {batch.claims.map((claim, ci) => (
                          <div key={ci} className="flex flex-col p-2.5 rounded-lg bg-muted/20 border border-border">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="badge-primary flex items-center gap-0.5"><Package size={8} /> {getProductName(claim.productId)}</span>
                                  <span className="badge-date flex items-center gap-0.5"><Clock size={8} /> {getDurationLabel(claim.productId, claim.durationId)}</span>
                                </div>
                                <code className="text-xs font-mono block truncate mt-1 text-primary">{claim.key}</code>
                                {claim.price !== undefined && claim.price > 0 && (
                                  <span className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-0.5">
                                    <Banknote size={9} /> ฿{claim.price.toLocaleString()}
                                    {claim.purchaseType === "reseller" && <span className="text-amber-500 ml-0.5">(Reseller)</span>}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => copyKey(claim.key)} className="btn-glass px-2 py-1 text-[10px] flex items-center gap-0.5 shrink-0 ml-2"><Copy size={10} /></button>
                            </div>
                            {claim.claimNote && (
                              <div className="mt-1.5 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/15 text-[10px] text-foreground">
                                <span className="font-medium text-primary">📝 หมายเหตุจากร้าน:</span> {claim.claimNote}
                              </div>
                            )}
                            {renderPostPurchaseButtons(claim.productId)}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              } else {
                const claim = item.data as ClaimRecord;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    className="p-3.5 rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="badge-primary flex items-center gap-0.5"><Package size={8} /> {getProductName(claim.productId)}</span>
                          <span className="badge-date flex items-center gap-0.5"><Clock size={8} /> {getDurationLabel(claim.productId, claim.durationId)}</span>
                        </div>
                        <code className="text-xs font-mono block truncate text-primary">{claim.key}</code>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-muted-foreground">{formatDate(claim.claimedAt)}</p>
                          {claim.price !== undefined && claim.price > 0 ? (
                            <span className="text-[10px] font-bold text-primary">฿{claim.price.toLocaleString()}</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">ฟรี</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => copyKey(claim.key)} className="btn-glass px-2.5 py-1.5 text-[10px] flex items-center gap-1 shrink-0"><Copy size={10} /> คัดลอก</button>
                    </div>
                    {claim.claimNote && (
                      <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/15 text-[10px] text-foreground">
                        <span className="font-medium text-primary">📝 หมายเหตุจากร้าน:</span> {claim.claimNote}
                      </div>
                    )}
                    {renderPostPurchaseButtons(claim.productId)}
                  </motion.div>
                );
              }
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">ก่อนหน้า</button>
            <span className="text-xs text-muted-foreground">หน้า {safeCurrentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">ถัดไป</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClaimHistoryPage;
