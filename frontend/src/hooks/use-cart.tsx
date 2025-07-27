import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { API_URL } from '@/lib/api';

interface CartItem {
  product: any;
  perfumeId: string;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  fetchCart: () => void;
  addToCart: (perfumeId: string, quantity?: number) => Promise<void>;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);

  const fetchCart = async () => {
    if (!token) return setCart([]);
    try {
      const res = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCart(Array.isArray(data) ? data : []);
    } catch {
      setCart([]);
    }
  };

  useEffect(() => {
    fetchCart();
    // eslint-disable-next-line
  }, [token]);

  const addToCart = async (perfumeId: string, quantity: number = 1) => {
    if (!token) throw new Error('Not authenticated');
    // Optimistic update
    setCart(prevCart => {
      const idx = prevCart.findIndex(item => item.perfumeId === perfumeId);
      if (quantity < 1) {
        // Remove item
        return prevCart.filter(item => item.perfumeId !== perfumeId);
      } else if (idx > -1) {
        // Update quantity
        return prevCart.map(item =>
          item.perfumeId === perfumeId ? { ...item, quantity } : item
        );
      } else {
        // Add new item
        return [...prevCart, { perfumeId, quantity }];
      }
    });
    // Sync with backend
    const res = await fetch(`${API_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ perfumeId, quantity })
    });
    if (!res.ok) {
      // Revert on error
      await fetchCart();
      throw new Error('Failed to update cart');
    }
    // Optionally, you can re-fetch the cart here if you want to ensure consistency
    // await fetchCart();
  };

  const contextValue: CartContextType = {
    cart,
    cartCount: cart.length,
    fetchCart,
    addToCart,
    setCart,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};