import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShoppingBag, CreditCard, Truck, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { API_URL } from '@/lib/api';

const Checkout = () => {
  const { cart, fetchCart } = useCart();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);

  // Address selection state
  const [addresses, setAddresses] = useState(() => {
    const saved = localStorage.getItem('addresses');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);

  useEffect(() => {
    const saved = localStorage.getItem('addresses');
    const loaded = saved ? JSON.parse(saved) : [];
    setAddresses(loaded);
    if (loaded.length > 0) setSelectedAddressId(loaded[0].id);
  }, []);

  // Calculate total using cart's product data (not hardcoded perfumes)
  const total = cart.reduce((sum, item) => {
    return item.product ? sum + item.product.price * item.quantity : sum;
  }, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...form, paymentMethod })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Checkout failed');
      else {
        setSuccess('Order placed successfully!');
        fetchCart();
        setTimeout(() => navigate('/orders'), 2500);
      }
    } catch {
      setError('Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  // Add confetti effect on order success
  useEffect(() => {
    if (success) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 9999,
      });
    }
  }, [success]);

  if (!token) return null;

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${step >= s
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-secondary text-muted-foreground'
            }`}>
            {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
          </div>
          {s < 3 && (
            <div className={`w-12 h-1 mx-1 rounded transition-all duration-300 ${step > s ? 'bg-primary' : 'bg-secondary'
              }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-hero py-12 px-4">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <StepIndicator />

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Order Summary */}
          <div className="lg:col-span-2">
            <Card className="perfume-card border-border/50 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-playfair flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Your cart is empty</p>
                ) : (
                  <>
                    <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
                      {cart.map(item => {
                        const product = item.product;
                        if (!product) return null;
                        return (
                          <li key={item.perfumeId} className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded-lg border border-border/50"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{product.name}</div>
                              <div className="text-sm text-muted-foreground">
                                ${product.price} × {item.quantity}
                              </div>
                            </div>
                            <div className="font-bold text-primary">
                              ${(product.price * item.quantity).toFixed(2)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="border-t border-border/50 pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Shipping</span>
                        <span className="text-green-500">Free</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold pt-2 border-t border-border/50">
                        <span>Total</span>
                        <span className="text-primary">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Checkout Form */}
          <div className="lg:col-span-3">
            <Card className="perfume-card border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-playfair">Complete Your Order</CardTitle>
                <p className="text-muted-foreground">Fill in your details to place your order</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Shipping Details */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    Shipping Details
                  </h3>

                  {addresses.length > 0 && !showAddressForm ? (
                    <div className="space-y-3 mb-4">
                      {addresses.map((addr: any) => (
                        <label
                          key={addr.id}
                          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:border-primary/50 ${selectedAddressId === addr.id
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border'
                            }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={addr.id}
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="accent-primary w-4 h-4"
                          />
                          <div className="flex-1">
                            <div className="font-semibold">{addr.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {addr.line1 || addr.address}, {addr.city || ''} {addr.state || ''} {addr.zip || ''}, {addr.country || ''}
                            </div>
                          </div>
                        </label>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => { setShowAddressForm(true); setStep(1); }}
                      >
                        + Add New Address
                      </Button>
                    </div>
                  ) : (
                    <form className="space-y-4" onSubmit={(e) => {
                      e.preventDefault();
                      const newAddr = { ...form, id: Date.now() };
                      const updated = [...addresses, newAddr];
                      setAddresses(updated);
                      localStorage.setItem('addresses', JSON.stringify(updated));
                      setSelectedAddressId(newAddr.id);
                      setShowAddressForm(false);
                      setStep(2);
                    }}>
                      <div>
                        <label className="block text-sm font-medium mb-2">Full Name</label>
                        <input
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="John Doe"
                          className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Address</label>
                        <input
                          name="address"
                          value={form.address}
                          onChange={handleChange}
                          placeholder="123 Main St, City, Country"
                          className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <input
                          name="phone"
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="+1 234 567 8900"
                          className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1">Save Address</Button>
                        {addresses.length > 0 && (
                          <Button type="button" variant="ghost" onClick={() => setShowAddressForm(false)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  )}
                </div>

                {/* Payment Method */}
                {((addresses.length > 0 && !showAddressForm) || step >= 2) && (
                  <div className="pt-4 border-t border-border/50">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Payment Method
                    </h3>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(v) => { setPaymentMethod(v); setStep(3); }}
                      className="grid sm:grid-cols-3 gap-3"
                    >
                      {[
                        { value: 'paypal', label: 'PayPal', icon: '🅿️', desc: 'Pay securely' },
                        { value: 'upi', label: 'UPI', icon: '📱', desc: 'Indian payments' },
                        { value: 'cod', label: 'Cash on Delivery', icon: '💵', desc: 'Pay on arrival' },
                      ].map((method) => (
                        <label
                          key={method.value}
                          className={`flex flex-col items-center border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-primary/50 ${paymentMethod === method.value
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border'
                            }`}
                        >
                          <RadioGroupItem value={method.value} id={method.value} className="sr-only" />
                          <span className="text-3xl mb-2">{method.icon}</span>
                          <span className="font-medium text-sm">{method.label}</span>
                          <span className="text-xs text-muted-foreground">{method.desc}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-center">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-500/10 text-green-500 px-4 py-3 rounded-xl text-center font-medium">
                    🎉 {success}
                  </div>
                )}

                {/* Submit Button */}
                <form onSubmit={handleCheckout}>
                  <Button
                    type="submit"
                    className="w-full glow-effect text-lg py-6 rounded-xl shadow-lg hover:scale-[1.02] transition-transform"
                    disabled={loading || cart.length === 0 || (addresses.length === 0 && !form.name)}
                  >
                    {loading ? 'Processing...' : `Place Order • $${total.toFixed(2)}`}
                  </Button>
                </form>

                <Link to="/cart">
                  <Button variant="ghost" className="w-full">
                    ← Back to Cart
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;