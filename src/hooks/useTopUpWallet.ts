import { useState, useCallback, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/errorLogger";

export interface TopUpRecord {
  id: string;
  amount: number;
  transRef: string;
  status: "success" | "failed" | "duplicate";
  createdAt: any;
  slipData?: any;
}

export const useTopUpWallet = (userId?: string) => {
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [topUpHistory, setTopUpHistory] = useState<TopUpRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const walletRef = doc(db, "wallets", userId);
      const walletSnap = await getDoc(walletRef);
      if (walletSnap.exists()) {
        setBalance(walletSnap.data().balance || 0);
      } else {
        await setDoc(walletRef, { balance: 0, userId, createdAt: serverTimestamp() });
        setBalance(0);
      }
    } catch (err) {
      logError("useTopUpWallet.loadBalance", err);
    } finally {
      setLoadingBalance(false);
    }
  }, [userId]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const q = query(
        collection(db, "topUpHistory"),
        where("userId", "==", userId),
        limit(50)
      );
      const snap = await getDocs(q);
      const records: TopUpRecord[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as TopUpRecord))
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta;
        });
      setTopUpHistory(records);
    } catch (err) {
      logError("useTopUpWallet.loadHistory", err);
    }
  }, [userId]);

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, [loadBalance, loadHistory]);

  const toggleHistory = () => {
    setShowHistory(prev => {
      if (!prev) loadHistory();
      return !prev;
    });
  };

  return {
    balance,
    setBalance,
    loadingBalance,
    topUpHistory,
    showHistory,
    toggleHistory,
    loadBalance,
    loadHistory,
  };
};
