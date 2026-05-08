import { useEffect, useState, useCallback } from "react";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  image?: string;
  quantity: number;
}

const STORAGE_KEY = "cart-items";

const read = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const emit = () => window.dispatchEvent(new Event("cart-updated"));

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(read);

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = (next: CartItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setItems(next);
    emit();
  };

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    const current = read();
    const existing = current.find((i) => i.id === item.id);
    const next = existing
      ? current.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + qty } : i))
      : [...current, { ...item, quantity: qty }];
    persist(next);
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    const current = read();
    persist(
      qty <= 0
        ? current.filter((i) => i.id !== id)
        : current.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    persist(read().filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => persist([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const currency = items[0]?.currency ?? "FCFA";

  return { items, addItem, updateQuantity, removeItem, clear, total, count, currency };
};
