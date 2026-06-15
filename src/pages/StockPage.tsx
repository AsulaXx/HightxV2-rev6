import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Copy, Download, Trash2, ArrowUpAZ, ArrowDownUp, Hash, CaseUpper, CaseLower } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { toast } from "sonner";

const StockPage = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [addNumbering, setAddNumbering] = useState(false);
  const [addPrefix, setAddPrefix] = useState(true);
  const [addBackticks, setAddBackticks] = useState(true);

  const convertStock = () => {
    if (!input.trim()) { toast.error("กรุณากรอกรหัสสินค้า"); return; }
    const codes = input.split("\n").map((l) => l.trim()).filter(Boolean);
    const result = codes.map((code, i) => {
      let line = "";
      if (addNumbering) line += `${i + 1}.) `;
      if (addBackticks) line += "`";
      if (addPrefix) line += "# ";
      line += code;
      if (addBackticks) line += "`";
      return line;
    }).join("\n");
    setOutput(result);
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(output); toast.success("คัดลอกสำเร็จ!"); };
  const downloadAsText = () => { const blob = new Blob([output], { type: "text/plain" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `stock_codes_${new Date().toISOString().split("T")[0]}.txt`; link.click(); };
  const removeDuplicates = () => { if (!input.trim()) return; const codes = input.split("\n").map((l) => l.trim()).filter(Boolean); const unique = [...new Set(codes)]; setInput(unique.join("\n")); toast.success(`ลบรหัสซ้ำ ${codes.length - unique.length} รหัส`); };
  const sortCodes = () => { if (!input.trim()) return; setInput(input.split("\n").map((l) => l.trim()).filter(Boolean).sort().join("\n")); };
  const reverseOrder = () => { if (!input.trim()) return; setInput(input.split("\n").map((l) => l.trim()).filter(Boolean).reverse().join("\n")); };
  const countCodes = () => { if (!input.trim()) { toast.info("ไม่มีรหัส"); return; } toast.info(`มี ${input.split("\n").map((l) => l.trim()).filter(Boolean).length} รหัส`); };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label className="flex items-center cursor-pointer select-none p-3 rounded-xl bg-muted/20 border border-border/30 transition-all hover:bg-muted/30">
      <div className={`toggle-slider ${checked ? "toggle-active" : ""}`} onClick={onChange} />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </label>
  );

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Tools", path: "/hub" }, { label: "จัดการสต๊อก" }]}
        title="จัดการสต๊อกสินค้า"
        subtitle="แปลงรหัสสินค้า จัดการสต็อก"
        icon={Package}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        <div className="glass-card mb-4 space-y-4 !rounded-2xl">
          <h2 className="text-sm font-bold text-foreground">🔄 แปลงรหัสสินค้า</h2>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">วางรหัสสินค้า (หนึ่งรหัสต่อบรรทัด)</label>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} className="input-glass w-full px-4 py-3 text-xs min-h-[150px] resize-y font-mono" placeholder={"90CZI8PLJHSNRKVM\nX6C0STP79Z8KVQLU"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Toggle label="🔢 เลขนำหน้า" checked={addNumbering} onChange={() => setAddNumbering(!addNumbering)} />
            <Toggle label="# นำหน้า" checked={addPrefix} onChange={() => setAddPrefix(!addPrefix)} />
            <Toggle label="` Backticks" checked={addBackticks} onChange={() => setAddBackticks(!addBackticks)} />
          </div>
          <button onClick={convertStock} className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2">🔄 แปลงรหัส</button>

          {output && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <label className="block text-xs font-semibold text-foreground">📤 ผลลัพธ์</label>
              <pre className="output-glass p-4 whitespace-pre-wrap break-all min-h-[120px] text-xs">{output}</pre>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={copyToClipboard} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><Copy size={12} /> คัดลอก</button>
                <button onClick={downloadAsText} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><Download size={12} /> ดาวน์โหลด .txt</button>
                <button onClick={() => { setInput(""); setOutput(""); }} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><Trash2 size={12} /> ล้างข้อมูล</button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="glass-card space-y-3 !rounded-2xl">
          <h2 className="text-sm font-bold text-foreground">🛠️ เครื่องมือเพิ่มเติม</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button onClick={removeDuplicates} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5">🔍 ลบรหัสซ้ำ</button>
            <button onClick={sortCodes} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><ArrowUpAZ size={12} /> A-Z</button>
            <button onClick={reverseOrder} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><ArrowDownUp size={12} /> กลับลำดับ</button>
            <button onClick={countCodes} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><Hash size={12} /> นับจำนวน</button>
            <button onClick={() => setInput(input.toUpperCase())} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><CaseUpper size={12} /> ตัวใหญ่</button>
            <button onClick={() => setInput(input.toLowerCase())} className="btn-glass px-3 py-2.5 text-xs flex items-center justify-center gap-1.5"><CaseLower size={12} /> ตัวเล็ก</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StockPage;
