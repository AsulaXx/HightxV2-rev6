import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import {
  getBalance, getOrderStatus, getServices, refillOrder, cancelOrder,
  DEFAULT_PROFIT_CONFIG, type BoosterService, type BoosterProfitConfig,
} from "@/lib/boosterApi";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
  Wallet, Search, RefreshCw, XCircle, Loader2, ClipboardList,
  TrendingUp, Rocket, Layers,
  Settings, Percent, Save,
  BarChart3, Plus, Trash2, Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Label } from "@/components/ui/label";
import BoosterCatalogPanel from "@/components/admin/BoosterCatalogPanel";
import { Navigate } from "react-router-dom";

interface OrderRecord {
  id: string;
  orderId: number;
  userId: string;
  userEmail: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  baseCost: number;
  totalCost: number;
  profit: number;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
  "In progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
  Completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
  Canceled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/15",
  Partial: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/15",
};

const BoosterAdminPage = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const boosterApiKey = settings.booster?.apiKey || undefined;
  const [balanceData, setBalanceData] = useState<{ balance: string; currency: string } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [checkOrderId, setCheckOrderId] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Services
  const [services, setServices] = useState<BoosterService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Orders filter
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");

  // Profit config
  const [profitConfig, setProfitConfig] = useState<BoosterProfitConfig>(DEFAULT_PROFIT_CONFIG);
  const [editConfig, setEditConfig] = useState<BoosterProfitConfig>(DEFAULT_PROFIT_CONFIG);
  const [configSaving, setConfigSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const isAdmin = profile && ["owner", "admin"].includes(profile.role);

  useEffect(() => {
    if (isAdmin) {
      loadOrders();
      loadBalance();
      loadServices();
      loadProfitConfig();
    }
  }, [isAdmin]);

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  async function loadProfitConfig() {
    try {
      const snap = await getDoc(doc(db, "settings", "boosterProfit"));
      if (snap.exists()) {
        const data = { ...DEFAULT_PROFIT_CONFIG, ...snap.data() } as BoosterProfitConfig;
        setProfitConfig(data);
        setEditConfig(data);
      }
    } catch { /* use default */ }
  }

  async function saveProfitConfig() {
    setConfigSaving(true);
    try {
      await setDoc(doc(db, "settings", "boosterProfit"), editConfig);
      setProfitConfig(editConfig);
      toast.success("บันทึกการตั้งค่ากำไรเรียบร้อย!");
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      setConfigSaving(false);
    }
  }

  async function loadBalance() {
    setBalanceLoading(true);
    try { setBalanceData(await getBalance(boosterApiKey)); } catch (err: any) { toast.error(err.message); } finally { setBalanceLoading(false); }
  }
  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const q = query(collection(db, "boosterOrders"), orderBy("createdAt", "desc"), limit(200));
      const snap = await getDocs(q);
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderRecord)));
    } catch (err: any) { toast.error(err.message); } finally { setOrdersLoading(false); }
  }
  async function loadServices() {
    setServicesLoading(true);
    try { const data = await getServices(boosterApiKey); setServices(Array.isArray(data) ? data : []); } catch (err: any) { toast.error(err.message); } finally { setServicesLoading(false); }
  }
  async function handleCheckStatus() {
    if (!checkOrderId.trim()) return;
    setChecking(true); setCheckResult(null);
    try { setCheckResult(await getOrderStatus(checkOrderId.trim(), boosterApiKey)); } catch (err: any) { toast.error(err.message); } finally { setChecking(false); }
  }
  async function handleRefill(orderId: string) {
    setActionLoading(`refill-${orderId}`);
    try { await refillOrder(orderId, boosterApiKey); toast.success(`Refill สำเร็จ #${orderId}`); } catch (err: any) { toast.error(err.message); } finally { setActionLoading(null); }
  }
  async function handleCancel(orderId: string) {
    setActionLoading(`cancel-${orderId}`);
    try { await cancelOrder(orderId, boosterApiKey); toast.success(`ยกเลิกสำเร็จ #${orderId}`); } catch (err: any) { toast.error(err.message); } finally { setActionLoading(null); }
  }

  // Computed
  const serviceCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    services.forEach((s) => catMap.set(s.category, (catMap.get(s.category) || 0) + 1));
    return Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [services]);
  const orderCategories = useMemo(() => Array.from(new Set(orders.map((o) => o.category).filter(Boolean))).sort(), [orders]);
  const filteredOrders = useMemo(() => orders.filter((o) => {
    const matchCat = !orderCategoryFilter || o.category === orderCategoryFilter;
    const matchSearch = !orderSearch || o.serviceName?.toLowerCase().includes(orderSearch.toLowerCase()) || o.orderId?.toString().includes(orderSearch) || o.userEmail?.toLowerCase().includes(orderSearch.toLowerCase());
    return matchCat && matchSearch;
  }), [orders, orderCategoryFilter, orderSearch]);
  const totalProfit = useMemo(() => orders.reduce((sum, o) => sum + (o.profit || 0), 0), [orders]);
  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + (o.totalCost || 0), 0), [orders]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <PageBreadcrumb items={[{ label: "HightX Booster Admin", path: "/boosteradminpanel" }]} title="HightX Booster Admin" subtitle="จัดการบริการ ตั้งค่ากำไร และติดตามออเดอร์" icon={Rocket} />

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">ยอดเงินต้นทาง</p>
            <p className="text-lg font-bold gradient-text">{balanceData ? `฿${parseFloat(balanceData.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={loadBalance} disabled={balanceLoading} className="ml-auto h-7 w-7"><RefreshCw className={`w-3.5 h-3.5 ${balanceLoading ? "animate-spin" : ""}`} /></Button>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5 text-accent" /></div>
          <div><p className="text-xs text-muted-foreground">ออเดอร์</p><p className="text-lg font-bold text-foreground">{orders.length}</p></div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">ยอดขาย</p><p className="text-lg font-bold text-primary">฿{totalRevenue.toFixed(2)}</p></div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><BarChart3 className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">กำไรสุทธิ</p><p className="text-lg font-bold text-emerald-500">฿{totalProfit.toFixed(2)}</p></div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="settings" className="space-y-5">
        <div className="glass-card !p-1.5">
          <TabsList className="w-full bg-transparent grid grid-cols-4">
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs sm:text-sm">
              <Settings className="w-3.5 h-3.5 mr-1" /> ตั้งค่ากำไร
            </TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs sm:text-sm">
              <Layers className="w-3.5 h-3.5 mr-1" /> แคตตาล็อก
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs sm:text-sm">
              <ClipboardList className="w-3.5 h-3.5 mr-1" /> ออเดอร์
            </TabsTrigger>
            <TabsTrigger value="check" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs sm:text-sm">
              <Search className="w-3.5 h-3.5 mr-1" /> เช็คสถานะ
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ Settings Tab ═══ */}
        <TabsContent value="settings" className="space-y-6">
          {/* Global Markup */}
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Percent className="w-4 h-4 text-primary" /></div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">กำไรรวม (Global Markup)</h3>
                <p className="text-[11px] text-muted-foreground">บวกเพิ่มจากราคาต้นทุนสำหรับทุกหมวดหมู่ที่ไม่ได้ตั้งค่าแยก</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0} max={999}
                value={editConfig.globalMarkup}
                onChange={(e) => setEditConfig({ ...editConfig, globalMarkup: Math.max(0, parseInt(e.target.value) || 0) })}
                className="bg-background/50 w-28 text-center font-bold text-lg"
              />
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ตัวอย่าง: ราคาต้นทุน ฿10 → ขาย ฿{(10 * (1 + editConfig.globalMarkup / 100)).toFixed(2)}
            </p>
          </div>

          {/* Category Markup */}
          <div className="glass-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center"><Layers className="w-4 h-4 text-accent" /></div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">กำไรแยกตามหมวดหมู่</h3>
                  <p className="text-[11px] text-muted-foreground">ตั้ง % กำไรเฉพาะหมวดหมู่ (Override ค่า Global)</p>
                </div>
              </div>
            </div>

            {Object.entries(editConfig.categoryMarkup).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(editConfig.categoryMarkup).map(([cat, markup]) => (
                  <div key={cat} className="flex items-center gap-3 glass-card !p-3 !rounded-lg">
                    <span className="text-sm font-medium text-foreground min-w-[120px] truncate">{cat}</span>
                    <Input
                      type="number"
                      min={0} max={999}
                      value={markup}
                      onChange={(e) => setEditConfig({
                        ...editConfig,
                        categoryMarkup: { ...editConfig.categoryMarkup, [cat]: Math.max(0, parseInt(e.target.value) || 0) },
                      })}
                      className="bg-background/50 w-24 text-center font-bold"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        const updated = { ...editConfig.categoryMarkup };
                        delete updated[cat];
                        setEditConfig({ ...editConfig, categoryMarkup: updated });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่ได้ตั้งค่ากำไรแยกหมวดหมู่ ใช้ค่า Global ({editConfig.globalMarkup}%) ทั้งหมด</p>
            )}

            {/* Add category markup */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="เลือกหรือพิมพ์ชื่อหมวดหมู่..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  list="cat-suggestions"
                  className="bg-background/50"
                />
                <datalist id="cat-suggestions">
                  {serviceCategories
                    .filter(({ name }) => !editConfig.categoryMarkup[name])
                    .map(({ name }) => <option key={name} value={name} />)}
                </datalist>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="glass-panel"
                onClick={() => {
                  if (!newCatName.trim()) return;
                  setEditConfig({
                    ...editConfig,
                    categoryMarkup: { ...editConfig.categoryMarkup, [newCatName.trim()]: editConfig.globalMarkup },
                  });
                  setNewCatName("");
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่ม
              </Button>
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={saveProfitConfig} disabled={configSaving} className="btn-gradient w-full gap-2">
            {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการตั้งค่ากำไร
          </Button>
        </TabsContent>

        {/* ═══ Catalog Tab ═══ */}
        <TabsContent value="catalog" className="space-y-4">
          <BoosterCatalogPanel
            services={services}
            profitConfig={profitConfig}
            loading={servicesLoading}
            onRefresh={loadServices}
          />
        </TabsContent>

        {/* ═══ Orders Tab ═══ */}
        <TabsContent value="orders" className="space-y-4">
          <div className="glass-card !p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="ค้นหาออเดอร์..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="pl-10 bg-background/50 border-border/50" />
              </div>
              <Button variant="outline" size="sm" onClick={loadOrders} disabled={ordersLoading} className="glass-panel shrink-0">
                <RefreshCw className={`w-4 h-4 mr-1 ${ordersLoading ? "animate-spin" : ""}`} /> รีเฟรช
              </Button>
            </div>
          </div>

          {orderCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button variant={!orderCategoryFilter ? "default" : "ghost"} size="sm" onClick={() => setOrderCategoryFilter(null)} className={!orderCategoryFilter ? "btn-gradient !py-1.5 !px-3" : ""}>ทั้งหมด ({orders.length})</Button>
              {orderCategories.map((cat) => {
                const count = orders.filter((o) => o.category === cat).length;
                return (
                  <Button key={cat} variant={orderCategoryFilter === cat ? "default" : "outline"} size="sm" onClick={() => setOrderCategoryFilter(cat === orderCategoryFilter ? null : cat)} className={`gap-1.5 ${orderCategoryFilter === cat ? "btn-gradient !py-1.5 !px-3" : "glass-panel hover:border-primary/30"}`}>
                    {cat} <span className="text-[10px] opacity-70">({count})</span>
                  </Button>
                );
              })}
            </div>
          )}

          {ordersLoading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-card text-center py-14"><ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" /><p className="text-foreground font-medium">ไม่พบออเดอร์</p></div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.map((order) => (
                <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card-hover !p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-foreground border border-border/50">#{order.orderId}</span>
                        <Badge className={`text-[10px] ${statusColors[order.status] || "bg-muted/50 text-muted-foreground"}`}>{order.status}</Badge>
                        {order.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">{order.category}</span>}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{order.serviceName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{order.userEmail} • {new Date(order.createdAt).toLocaleString("th-TH")}</p>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Link2 className="w-3 h-3 shrink-0" /> {order.link}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold gradient-text">฿{order.totalCost?.toFixed(2)}</p>
                        {order.profit > 0 && <p className="text-[10px] text-emerald-500 font-medium">กำไร ฿{order.profit.toFixed(2)}</p>}
                        <p className="text-[10px] text-muted-foreground">x{order.quantity?.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="outline" className="glass-panel h-8 w-8 hover:border-primary/30" onClick={() => handleRefill(order.orderId.toString())} disabled={actionLoading === `refill-${order.orderId}`} title="Refill">
                          {actionLoading === `refill-${order.orderId}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="icon" variant="outline" className="glass-panel h-8 w-8 hover:border-destructive/30 text-destructive" onClick={() => handleCancel(order.orderId.toString())} disabled={actionLoading === `cancel-${order.orderId}`} title="Cancel">
                          {actionLoading === `cancel-${order.orderId}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Check Status Tab ═══ */}
        <TabsContent value="check" className="space-y-4">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Search className="w-4 h-4 text-primary" /></div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">เช็คสถานะออเดอร์</h3>
                <p className="text-[11px] text-muted-foreground">ใส่ Order ID เพื่อตรวจสอบสถานะจากระบบ</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Order ID..." value={checkOrderId} onChange={(e) => setCheckOrderId(e.target.value)} className="bg-background/50 border-border/50 font-mono" onKeyDown={(e) => e.key === "Enter" && handleCheckStatus()} />
              <Button onClick={handleCheckStatus} disabled={checking} className="btn-gradient shrink-0">{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button>
            </div>
            <AnimatePresence>
              {checkResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card !bg-primary/[0.02] space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">สถานะ</span><Badge className={`${statusColors[checkResult.status] || ""}`}>{checkResult.status}</Badge></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">ค่าใช้จ่าย</span><span className="font-semibold gradient-text">฿{checkResult.charge}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Start Count</span><span className="font-mono text-sm text-foreground">{checkResult.start_count}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Remains</span><span className="font-mono text-sm text-foreground">{checkResult.remains}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">สกุลเงิน</span><span className="text-sm text-foreground">{checkResult.currency}</span></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BoosterAdminPage;
