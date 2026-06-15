import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { getOrderStatus, type BoosterOrderStatus } from "@/lib/boosterApi";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
  ClipboardList, Loader2, RefreshCw, Rocket, Search,
  Clock, Link2, ExternalLink, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";

interface OrderRecord {
  id: string;
  orderId: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  totalCost: number;
  sellingRate: number;
  status: string;
  createdAt: string;
  lastCheckedAt?: string;
  startCount?: string;
  remains?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
  "In progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
  Completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
  Canceled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/15",
  Partial: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/15",
  Processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
};

const statusLabels: Record<string, string> = {
  pending: "รอดำเนินการ",
  "In progress": "กำลังดำเนินการ",
  Completed: "สำเร็จ",
  Canceled: "ยกเลิก",
  Partial: "สำเร็จบางส่วน",
  Processing: "กำลังประมวลผล",
};

const statusIcons: Record<string, React.ReactNode> = {
  Completed: <CheckCircle className="w-3.5 h-3.5" />,
  Canceled: <XCircle className="w-3.5 h-3.5" />,
  Partial: <AlertTriangle className="w-3.5 h-3.5" />,
};

const BoosterOrderHistoryPage = () => {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, BoosterOrderStatus>>({});

  const apiKey = settings.booster?.apiKey || undefined;

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "boosterOrders"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const loadedOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderRecord));
      setOrders(loadedOrders);
      return loadedOrders;
    } catch (err: any) {
      toast.error("โหลดประวัติไม่สำเร็จ: " + err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadOrders().then((loadedOrders) => {
        if (loadedOrders && loadedOrders.length > 0) {
          autoCheckPendingOrders(loadedOrders);
        }
      });
    }
  }, [user, loadOrders]);

  /** อัปเดตสถานะลง Firestore */
  const updateOrderInFirestore = async (docId: string, status: string, liveData: BoosterOrderStatus) => {
    try {
      await updateDoc(doc(db, "boosterOrders", docId), {
        status,
        lastCheckedAt: new Date().toISOString(),
        startCount: liveData.start_count || "",
        remains: liveData.remains || "",
      });
    } catch {
      // silent fail — non-critical
    }
  };

  /** เช็คสถานะ single order */
  const checkLiveStatus = async (order: OrderRecord) => {
    setCheckingStatus(order.orderId);
    try {
      const result = await getOrderStatus(order.orderId, apiKey);
      setLiveStatuses((prev) => ({ ...prev, [order.orderId]: result }));

      // อัปเดตสถานะใน Firestore + local state
      if (result.status && result.status !== order.status) {
        await updateOrderInFirestore(order.id, result.status, result);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? { ...o, status: result.status, lastCheckedAt: new Date().toISOString(), startCount: result.start_count, remains: result.remains }
              : o
          )
        );
        
        // แจ้งเตือนเมื่อสถานะเปลี่ยน
        if (result.status === "Completed") {
          toast.success(`✅ ออเดอร์ #${order.orderId} เสร็จสมบูรณ์แล้ว!`);
        } else if (result.status === "Canceled") {
          toast.error(`❌ ออเดอร์ #${order.orderId} ถูกยกเลิก`);
        } else if (result.status === "Partial") {
          toast.warning(`⚠️ ออเดอร์ #${order.orderId} สำเร็จบางส่วน`);
        }
      }
    } catch (err: any) {
      toast.error("เช็คสถานะไม่สำเร็จ: " + err.message);
    } finally {
      setCheckingStatus(null);
    }
  };

  /** เช็คสถานะออเดอร์ที่ยังไม่เสร็จทั้งหมด */
  const autoCheckPendingOrders = async (orderList: OrderRecord[]) => {
    const pendingOrders = orderList.filter(
      (o) => !["Completed", "Canceled"].includes(o.status)
    );
    if (pendingOrders.length === 0) return;

    setCheckingAll(true);
    let updated = 0;
    for (const order of pendingOrders) {
      try {
        const result = await getOrderStatus(order.orderId, apiKey);
        setLiveStatuses((prev) => ({ ...prev, [order.orderId]: result }));

        if (result.status && result.status !== order.status) {
          await updateOrderInFirestore(order.id, result.status, result);
          setOrders((prev) =>
            prev.map((o) =>
              o.id === order.id
                ? { ...o, status: result.status, lastCheckedAt: new Date().toISOString(), startCount: result.start_count, remains: result.remains }
                : o
            )
          );
          updated++;
        }
      } catch {
        // skip failed checks
      }
    }
    setCheckingAll(false);
    if (updated > 0) {
      toast.success(`อัปเดตสถานะ ${updated} ออเดอร์แล้ว`);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.serviceName?.toLowerCase().includes(q) ||
        o.orderId?.toString().includes(q) ||
        o.category?.toLowerCase().includes(q) ||
        (statusLabels[o.status] || o.status)?.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const totalSpent = useMemo(() => orders.reduce((s, o) => s + (o.totalCost || 0), 0), [orders]);
  const completedCount = useMemo(() => orders.filter((o) => o.status === "Completed").length, [orders]);
  const pendingCount = useMemo(() => orders.filter((o) => !["Completed", "Canceled"].includes(o.status)).length, [orders]);

  if (!user) return <RedirectToLogin />;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PageBreadcrumb
        items={[
          { label: "HightX Follower Booster", path: "/hightxfollowerbooster" },
          { label: "ประวัติออเดอร์", path: "/booster-orders" },
        ]}
        title="ประวัติออเดอร์ Booster"
        subtitle="ติดตามสถานะการสั่งซื้อบริการปั๊มผู้ติดตามทั้งหมดของคุณ"
        icon={ClipboardList}
      />

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ทั้งหมด</p>
            <p className="text-lg font-bold text-foreground">{orders.length}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ยอดใช้จ่าย</p>
            <p className="text-lg font-bold gradient-text">฿{totalSpent.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">สำเร็จ</p>
            <p className="text-lg font-bold text-foreground">{completedCount}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">กำลังดำเนินการ</p>
            <p className="text-lg font-bold text-foreground">{pendingCount}</p>
          </div>
        </div>
      </motion.div>

      {/* Search + Refresh */}
      <div className="glass-card !p-3 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วย Order ID, ชื่อบริการ, สถานะ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading} className="shrink-0 gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>
          {pendingCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => autoCheckPendingOrders(orders)}
              disabled={checkingAll}
              className="shrink-0 gap-1.5"
            >
              {checkingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">เช็คทั้งหมด ({pendingCount})</span>
              <span className="sm:hidden">{pendingCount}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">กำลังโหลดประวัติ...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16">
          <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-lg font-medium text-foreground mb-1">
            {searchQuery ? "ไม่พบออเดอร์" : "ยังไม่มีประวัติออเดอร์"}
          </p>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "ลองเปลี่ยนคำค้นหา" : "สั่งซื้อบริการได้ที่หน้า HightX Follower Booster"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkingAll && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังเช็คสถานะออเดอร์ที่ยังไม่เสร็จ...
            </div>
          )}
          {filtered.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const live = liveStatuses[order.orderId];
            const displayStatus = live?.status || order.status;
            const isTerminal = ["Completed", "Canceled"].includes(displayStatus);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card-hover !p-0 overflow-hidden"
              >
                {/* Main row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-foreground border border-border/50">
                        #{order.orderId}
                      </span>
                      <Badge className={`text-[10px] gap-1 ${statusColors[displayStatus] || "bg-muted/50 text-muted-foreground"}`}>
                        {statusIcons[displayStatus]}
                        {statusLabels[displayStatus] || displayStatus}
                      </Badge>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">
                        {order.category}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{order.serviceName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleString("th-TH")}
                      </p>
                      {order.lastCheckedAt && (
                        <p className="text-[10px] text-muted-foreground/60">
                          เช็คล่าสุด: {new Date(order.lastCheckedAt).toLocaleTimeString("th-TH")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold gradient-text">฿{order.totalCost?.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">x{order.quantity?.toLocaleString()}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-border/50 p-4 space-y-3 bg-muted/5"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">ราคาต่อ 1,000</span>
                        <p className="font-medium text-foreground">฿{order.sellingRate?.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">จำนวน</span>
                        <p className="font-medium text-foreground">{order.quantity?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">สถานะ</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className={`text-[10px] gap-1 ${statusColors[displayStatus] || ""}`}>
                            {statusIcons[displayStatus]}
                            {statusLabels[displayStatus] || displayStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-xs">ลิงก์</span>
                      <p className="text-sm text-primary truncate flex items-center gap-1 mt-0.5">
                        <Link2 className="w-3 h-3 shrink-0" />
                        <a href={order.link} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                          {order.link}
                        </a>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </p>
                    </div>

                    {/* Live status or saved data */}
                    {(live || order.startCount) && (
                      <div className="glass-card !p-3 space-y-1.5 text-sm">
                        <p className="text-xs font-medium text-foreground mb-2">📡 ข้อมูลจากระบบ</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">สถานะ</span>
                          <Badge className={statusColors[live?.status || displayStatus] || ""}>
                            {statusIcons[live?.status || displayStatus]}
                            {statusLabels[live?.status || displayStatus] || live?.status || displayStatus}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Start Count</span>
                          <span className="font-mono text-foreground">{live?.start_count || order.startCount || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">เหลือ</span>
                          <span className="font-mono text-foreground">{live?.remains || order.remains || "-"}</span>
                        </div>
                        {live?.charge && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">ค่าใช้จ่ายจริง (ต้นทุน)</span>
                            <span className="font-mono text-foreground">{live.charge} {live.currency}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Canceled/Partial notice */}
                    {displayStatus === "Canceled" && (
                      <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-destructive">ออเดอร์นี้ถูกยกเลิก</p>
                          <p className="text-[11px] text-destructive/70 mt-0.5">หากเครดิตยังไม่ได้คืน กรุณาติดต่อแอดมิน</p>
                        </div>
                      </div>
                    )}
                    {displayStatus === "Partial" && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">ออเดอร์สำเร็จบางส่วน</p>
                          <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">บริการถูกดำเนินการไม่ครบตามจำนวนที่สั่ง ส่วนที่เหลืออาจได้รับเงินคืน</p>
                        </div>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant={isTerminal ? "ghost" : "outline"}
                      className="glass-panel w-full gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        checkLiveStatus(order);
                      }}
                      disabled={checkingStatus === order.orderId}
                    >
                      {checkingStatus === order.orderId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      เช็คสถานะล่าสุด
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BoosterOrderHistoryPage;
