import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export const useWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "wallets", user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setBalance(snapshot.data().balance || 0);
        } else {
          setBalance(0);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Wallet listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { balance, loading };
};
