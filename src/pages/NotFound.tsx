import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative z-10 min-h-[80vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="glass-card w-full max-w-sm text-center !rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-destructive" />
        </div>
        <h1 className="text-4xl font-extrabold gradient-text mb-2">404</h1>
        <p className="text-sm text-muted-foreground mb-5">ไม่พบหน้าที่คุณต้องการ</p>
        <Link to="/" className="btn-gradient inline-flex items-center gap-2 px-6 py-2.5 text-xs">
          <Home size={14} /> กลับหน้าหลัก
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
