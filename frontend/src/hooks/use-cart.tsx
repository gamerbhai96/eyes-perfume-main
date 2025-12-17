import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  fetchCart: () => Promise<void>;
  addToCart: (perfumeId: string, quantity?: number) => Promise<void>;
  removeFromCart: (perfumeId: string) => Promise<void>;
  updateQuantity: (perfumeId: string, quantity: number) => Promise<void>;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchCart = useCallback(async () => {
    if (!token) {
      setCart([]);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const res = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const items = data.items || [];
      setCart(items.map((item: any) => ({
        perfumeId: item.perfumeId || item.id,
        product: {
          _id: item.perfumeId || item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          brand: item.brand,
          stock: item.stock,
        },
        quantity: item.quantity
      })));
    } catch {
      setCart([]);
    } finally {
      fetchingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    fetchCart();
  }, [token]);

  // Add items to cart (POST - adds to existing quantity)
  const addToCart = useCallback(async (perfumeId: string, quantity: number = 1) => {
    if (!token) throw new Error('Not authenticated');

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ perfumeId, quantity })
      });

      if (!res.ok) {
        throw new Error('Failed to add to cart');
      }

      await fetchCart();
    } finally {
      setLoading(false);
    }
  }, [token, fetchCart]);

  // Remove item from cart (DELETE)
  const removeFromCart = useCallback(async (perfumeId: string) => {
    if (!token) throw new Error('Not authenticated');

    setLoading(true);
    setCart(prev => prev.filter(item => item.perfumeId !== perfumeId));

    try {
      const res = await fetch(`${API_URL}/cart/${perfumeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        await fetchCart();
        throw new Error('Failed to remove item');
      }
    } finally {
      setLoading(false);
    }
  }, [token, fetchCart]);

  // Update quantity to exact value (PUT - sets exact quantity)
  const updateQuantity = useCallback(async (perfumeId: string, quantity: number) => {
    if (!token) throw new Error('Not authenticated');

    if (quantity <= 0) {
      return removeFromCart(perfumeId);
    }

    setLoading(true);
    // Optimistic update
    setCart(prev => prev.map(item =>
      item.perfumeId === perfumeId ? { ...item, quantity } : item
    ));

    try {
      // Use PUT to set exact quantity (not add to existing)
      const res = await fetch(`${API_URL}/cart/${perfumeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity })
      });

      if (!res.ok) {
        await fetchCart();
        throw new Error('Failed to update quantity');
      }
    } finally {
      setLoading(false);
    }
  }, [token, fetchCart, removeFromCart]);

  const contextValue: CartContextType = {
    cart,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    fetchCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    setCart,
    loading,
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