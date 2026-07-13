import { useAuth } from "@/contexts/AuthContext";
import { UserCog, X } from "lucide-react";

/** Floating banner shown while an owner is impersonating another user. */
const ImpersonationBanner = () => {
  const { impersonating, profile, realProfile, stopImpersonation } = useAuth();
  if (!impersonating || !profile || !realProfile) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9997] px-4">
      <div className="glass-card !py-2 !px-3 !rounded-full flex items-center gap-3 border border-amber-500/40 bg-amber-500/10 shadow-xl">
        <UserCog size={14} className="text-amber-400" />
        <span className="text-xs">
          กำลังดูเป็น <b className="text-amber-300">{profile.displayName || profile.email}</b>
          <span className="text-muted-foreground"> · {profile.role}</span>
        </span>
        <button
          onClick={stopImpersonation}
          className="ml-1 p-1 rounded-full hover:bg-amber-500/20 text-amber-300"
          title="กลับสู่บัญชี Owner"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
