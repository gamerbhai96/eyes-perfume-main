import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Loader2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Cart = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { cart, loading, updateQuantity, removeFromCart } = useCart();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const handleIncrement = async (perfumeId: string, currentQty: number) => {
    setError('');
    try {
      await updateQuantity(perfumeId, currentQty + 1);
    } catch {
      setError('Failed to update cart');
    }
  };

  const handleDecrement = async (perfumeId: string, currentQty: number) => {
    setError('');
    try {
      if (currentQty <= 1) {
        await removeFromCart(perfumeId);
      } else {
        await updateQuantity(perfumeId, currentQty - 1);
      }
    } catch {
      setError('Failed to update cart');
    }
  };

  const handleRemove = async (perfumeId: string) => {
    setError('');
    try {
      await removeFromCart(perfumeId);
    } catch {
      setError('Failed to remove item');
    }
  };

  const total = cart.reduce((sum, item) => {
    return item.product ? sum + item.product.price * item.quantity : sum;
  }, 0);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-hero py-12 px-4">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-playfair font-bold gradient-text mb-2">Shopping Cart</h1>
          <p className="text-muted-foreground">
            {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''} in your cart` : 'Your cart is empty'}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-center mb-6">
            {error}
          </div>
        )}

        {cart.length === 0 ? (
          <Card className="perfume-card border-border/50 text-center py-16">
            <CardContent>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary/50 flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-playfair font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">
                Discover our collection and find your perfect fragrance
              </p>
              <Link to="/products">
                <Button size="lg" className="glow-effect">
                  Explore Collection
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map(item => {
                const product = item.product;
                if (!product) {
                  return (
                    <Card key={item.perfumeId} className="perfume-card border-border/50 animate-pulse">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-24 h-24 bg-secondary rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-secondary rounded w-32" />
                          <div className="h-4 bg-secondary/50 rounded w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={item.perfumeId} className="perfume-card border-border/50 overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Product Image */}
                        <div className="w-32 h-32 flex-shrink-0">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            <p className="text-primary font-bold text-xl">${product.price}</p>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
                              {loading ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-6" />
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-background"
                                    onClick={() => handleDecrement(item.perfumeId, item.quantity)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-10 text-center font-semibold">{item.quantity}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-background"
                                    onClick={() => handleIncrement(item.perfumeId, item.quantity)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>

                            {/* Subtotal & Delete */}
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-lg">
                                ${(product.price * item.quantity).toFixed(2)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemove(item.perfumeId)}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="perfume-card border-border/50 sticky top-24">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-playfair">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-green-500">Free</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total</span>
                      <span className="text-primary">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Link to="/checkout" className="block">
                    <Button className="w-full glow-effect py-6 text-lg" disabled={loading}>
                      Proceed to Checkout
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>

                  <Link to="/products" className="block">
                    <Button variant="outline" className="w-full">
                      Continue Shopping
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;