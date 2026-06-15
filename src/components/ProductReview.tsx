import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, User, ThumbsUp, MoreVertical, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp, doc, deleteDoc, getDocs, limit as fbLimit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { logError } from "@/lib/errorLogger";
import { toast } from "sonner";

/* ─────────── Star Rating Input ─────────── */

export const StarRating = ({
  value,
  onChange,
  size = 16,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-all duration-150 ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110 active:scale-95"}`}
        >
          <Star
            size={size}
            className={`transition-colors ${
              star <= (hover || value) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

/* ─────────── Compact Star Display ─────────── */

export const StarDisplay = ({ rating, count, size = 12 }: { rating: number; count: number; size?: number }) => {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-px">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={`${star <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
};

/* ─────────── Review Form ─────────── */

export const ReviewForm = ({ productId }: { productId: string }) => {
  const { user, profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Check if user already reviewed this product
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "reviews"),
      where("productId", "==", productId),
      where("userId", "==", user.uid),
      fbLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHasReviewed(!snap.empty);
    });
    return () => unsub();
  }, [user, productId]);

  // Check if user has purchased this product
  const [hasPurchased, setHasPurchased] = useState(false);
  useEffect(() => {
    if (!user) return;
    const checkPurchase = async () => {
      try {
        const q = query(
          collection(db, "claimHistory"),
          where("userId", "==", user.uid),
          where("productId", "==", productId),
          fbLimit(1)
        );
        const snap = await getDocs(q);
        setHasPurchased(!snap.empty);
      } catch (err) {
        logError("ReviewForm.checkPurchase", err, "warn");
      }
    };
    checkPurchase();
  }, [user, productId]);

  const handleSubmit = async () => {
    if (!user || !profile || rating === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        productId,
        userId: user.uid,
        userName: profile.displayName || profile.email || "ผู้ใช้",
        rating,
        comment: comment.trim(),
        createdAt: Timestamp.now(),
      });
      toast.success("ส่งรีวิวสำเร็จ!");
      setRating(0);
      setComment("");
    } catch (err) {
      logError("ReviewForm.submit", err, "error");
      toast.error("ส่งรีวิวไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;
  if (hasReviewed) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        ✅ คุณได้รีวิวสินค้านี้แล้ว
      </div>
    );
  }
  if (!hasPurchased) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        💡 ซื้อสินค้านี้ก่อนจึงจะรีวิวได้
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <h4 className="text-xs font-bold text-foreground">เขียนรีวิว</h4>
      <StarRating value={rating} onChange={setRating} size={20} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="แชร์ความคิดเห็นของคุณ... (ไม่บังคับ)"
        className="input-glass w-full text-xs min-h-[60px] resize-none"
        maxLength={500}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{comment.length}/500</span>
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="btn-gradient px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send size={12} />
          {submitting ? "กำลังส่ง..." : "ส่งรีวิว"}
        </button>
      </div>
    </div>
  );
};

/* ─────────── Review List ─────────── */

export const ReviewList = ({ productId }: { productId: string }) => {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const isAdmin = profile ? ["admin", "owner"].includes(profile.role) : false;

  useEffect(() => {
    const q = query(
      collection(db, "reviews"),
      where("productId", "==", productId),
      orderBy("createdAt", "desc"),
      fbLimit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [productId]);

  const handleDelete = async (reviewId: string) => {
    if (!confirm("ต้องการลบรีวิวนี้?")) return;
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      toast.success("ลบรีวิวแล้ว");
    } catch (err) {
      logError("ReviewList.delete", err, "error");
      toast.error("ลบไม่สำเร็จ");
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        ยังไม่มีรีวิว — เป็นคนแรกที่รีวิว!
      </div>
    );
  }

  // Calculate summary
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass-card p-4 flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
          <StarRating value={Math.round(avgRating)} readonly size={14} />
          <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} รีวิว</p>
        </div>
        <div className="flex-1 space-y-1">
          {ratingCounts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-3">{star}</span>
              <Star size={10} className="text-yellow-400 fill-yellow-400" />
              <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-4 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-2">
        {reviews.map((review, i) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={12} className="text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">{review.userName}</p>
                  <StarRating value={review.rating} readonly size={10} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {review.createdAt?.toDate
                    ? new Date(review.createdAt.toDate()).toLocaleDateString("th-TH")
                    : ""}
                </span>
                {(isAdmin || review.userId === user?.uid) && (
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors"
                    title="ลบรีวิว"
                  >
                    <Trash2 size={11} className="text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            </div>
            {review.comment && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{review.comment}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/* ─────────── Hook: useProductRatings ─────────── */

export const useProductRatings = (productIds: string[]) => {
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {
    if (productIds.length === 0) return;

    const q = query(collection(db, "reviews"));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, { sum: number; count: number }> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const pid = data.productId;
        if (!productIds.includes(pid)) return;
        if (!map[pid]) map[pid] = { sum: 0, count: 0 };
        map[pid].sum += data.rating || 0;
        map[pid].count += 1;
      });
      const result: Record<string, { avg: number; count: number }> = {};
      for (const pid of productIds) {
        if (map[pid]) {
          result[pid] = { avg: map[pid].sum / map[pid].count, count: map[pid].count };
        }
      }
      setRatings(result);
    });
    return () => unsub();
  }, [productIds.join(",")]);

  return ratings;
};
