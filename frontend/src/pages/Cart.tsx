import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CartItem {
  perfumeId: string;
  product: Product;
  quantity: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  image: string;
}

const Cart = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const { cart, fetchCart } = useCart();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/login');
    else fetchCart(); 
  }, [token, navigate, fetchCart]);

  const { addToCart } = useCart();
  const updateItem = async (perfumeId: string, quantity: number) => {
    setLoadingItemId(perfumeId);
    setError('');
    try {
      await addToCart(perfumeId, quantity);
    } catch {
      setError('Failed to update cart');
    } finally {
      setLoadingItemId(null);
    }
  };

  // Calculate total
  const total = cart.reduce((sum, item) => {
    return item.product ? sum + item.product.price * item.quantity : sum;
  }, 0);

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-6">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <Card className="perfume-card border-border/50 fade-in" style={{animationDelay: '0.2s'}}>
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-playfair font-bold">
              Your Cart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <div className="text-red-500 text-sm text-center mb-2">{error}</div>}
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground">
                <p>Your cart is empty.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link to="/products">Start shopping</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-4 mb-4">
                {cart.map(item => {
                  const product = item.product;
                  if (!product) {
                    // Show a loading skeleton or fallback while waiting for backend to populate product
                    return (
                      <li key={item.perfumeId} className="flex items-center gap-4 border-b pb-2 opacity-60 animate-pulse">
                        <div className="w-16 h-16 bg-gray-200 rounded" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                          <div className="h-3 bg-gray-100 rounded w-16" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 font-semibold">{item.quantity}</span>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={item.perfumeId} className="flex items-center gap-4 border-b pb-2">
                      <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded" />
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{product.name}</div>
                        <div className="text-sm text-muted-foreground">${product.price} x {item.quantity}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {loadingItemId === item.perfumeId ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Button variant="outline" size="icon" onClick={() => updateItem(item.perfumeId, item.quantity - 1)} disabled={item.quantity <= 1}>-</Button>
                            <span className="px-2 font-semibold">{item.quantity}</span>
                            <Button variant="outline" size="icon" onClick={() => updateItem(item.perfumeId, item.quantity + 1)}>+</Button>
                            <Button variant="destructive" size="icon" onClick={() => updateItem(item.perfumeId, 0)}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {cart.length > 0 && (
              <>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-4">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <Link to="/checkout">
                  <Button className="w-full glow-effect mt-2">Checkout</Button>
                </Link>
              </>
            )}
            <Link to="/products">
              <Button variant="outline" className="w-full mt-2">
                {cart.length > 0 ? 'Continue Shopping' : 'Start Shopping'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Cart;