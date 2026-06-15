import React, { createContext, useContext, useState, useCallback } from "react";
import { Product, ProductDuration } from "@/contexts/SiteSettingsContext";

export interface CartItem {
  id: string;
  product: Product;
  duration: ProductDuration;
  quantity: number;
  note: string;
}

interface CartContextType {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  showCart: boolean;
  setShowCart: (show: boolean) => void;
  addToCart: (product: Product, duration: ProductDuration, maxKeysPerClaim: number, maxKeysPerUser: number, availableCounts: Record<string, number>, claimedCount: Record<string, number>) => { ok: boolean; reason?: "cap" | "maxPerUser" | "outOfStock" | "maxPerClaim" };
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, delta: number, maxKeysPerClaim: number, maxKeysPerUser: number, availableCounts: Record<string, number>, claimedCount: Record<string, number>) => void;
  updateCartNote: (itemId: string, note: string) => void;
  clearCart: () => void;
  totalCartItems: number;
  getCartCountForProduct: (productId: string, durationId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const addToCart = useCallback((product: Product, duration: ProductDuration, maxKeysPerClaim: number, maxKeysPerUser: number, availableCounts: Record<string, number>, claimedCount: Record<string, number>) => {
    const ck = `${product.id}_${duration.id}`;
    const used = claimedCount[ck] || 0;
    const avail = availableCounts[ck] || 0;
    const inCartNow = cart.filter(c => c.product.id === product.id && c.duration.id === duration.id).reduce((sum, c) => sum + c.quantity, 0);

    const mpu = Math.max(0, maxKeysPerUser || 0);
    const mpc = Math.max(0, maxKeysPerClaim || 0);
    // ตรวจเงื่อนไขก่อน เพื่อรู้ผลจริงคืน caller (0 = ไม่จำกัด)
    if (avail <= inCartNow) return { ok: false as const, reason: "outOfStock" as const };
    if (mpu > 0 && used + inCartNow >= mpu) return { ok: false as const, reason: "maxPerUser" as const };
    if (mpc > 0 && inCartNow >= mpc) return { ok: false as const, reason: "maxPerClaim" as const };

    setCart(prev => {
      const inCart = prev.filter(c => c.product.id === product.id && c.duration.id === duration.id).reduce((sum, c) => sum + c.quantity, 0);
      const cap = Math.max(0, Math.min(
        mpc > 0 ? mpc : Number.MAX_SAFE_INTEGER,
        Math.max(0, avail),
        mpu > 0 ? Math.max(0, mpu - used) : Number.MAX_SAFE_INTEGER,
      ));
      if (cap < 1) return prev;
      if (inCart >= cap) return prev;

      const existing = prev.find(c => c.product.id === product.id && c.duration.id === duration.id);
      if (existing) {
        return prev.map(c => c.id === existing.id ? { ...c, quantity: existing.quantity + 1 } : c);
      }
      return [...prev, { id: `${product.id}_${duration.id}_${Date.now()}`, product, duration, quantity: 1, note: "" }];
    });
    return { ok: true as const };
  }, [cart]);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(c => c.id !== itemId));
  }, []);

  const updateCartQuantity = useCallback((itemId: string, delta: number, maxKeysPerClaim: number, maxKeysPerUser: number, availableCounts: Record<string, number>, claimedCount: Record<string, number>) => {
    setCart(prev => prev.map(c => {
      if (c.id !== itemId) return c;
      const ck = `${c.product.id}_${c.duration.id}`;
      const used = claimedCount[ck] || 0;
      const avail = availableCounts[ck] || 0;
      const mpc = Math.max(0, maxKeysPerClaim || 0);
      const mpu = Math.max(0, maxKeysPerUser || 0);
      const cap = Math.min(
        mpc > 0 ? mpc : Number.MAX_SAFE_INTEGER,
        Math.max(0, avail),
        mpu > 0 ? Math.max(0, mpu - used) : Number.MAX_SAFE_INTEGER,
      );
      // ถ้า cap = 0 (สินค้าหมด/เกินสิทธิ์) คงค่าเดิมไว้ ไม่ลดอัตโนมัติ ปล่อยให้ผู้ใช้กด − หรือ × ลบเอง
      if (cap < 1) return c;
      return { ...c, quantity: Math.max(1, Math.min(cap, c.quantity + delta)) };
    }));
  }, []);

  const updateCartNote = useCallback((itemId: string, note: string) => {
    setCart(prev => prev.map(c => c.id === itemId ? { ...c, note } : c));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalCartItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const getCartCountForProduct = useCallback((productId: string, durationId: string) => {
    return cart.filter(c => c.product.id === productId && c.duration.id === durationId).reduce((s, c) => s + c.quantity, 0);
  }, [cart]);

  return (
    <CartContext.Provider value={{ cart, setCart, showCart, setShowCart, addToCart, removeFromCart, updateCartQuantity, updateCartNote, clearCart, totalCartItems, getCartCountForProduct }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
