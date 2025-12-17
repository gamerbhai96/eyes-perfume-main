import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Sparkles, Star, Heart, Gift, Quote, Truck, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import React from 'react';

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Fashion Designer",
    text: "EYES fragrances have become an essential part of my daily routine. The Midnight Oud is absolutely captivating.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
  },
  {
    name: "James Chen",
    role: "Entrepreneur",
    text: "The quality is unmatched. Golden Amber has received so many compliments. Worth every penny.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
  },
  {
    name: "Elena Rodriguez",
    role: "Artist",
    text: "Each scent tells a unique story. I'm completely in love with the Mystic Rose collection.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop"
  }
];

const Landing = React.memo(() => {
  const { token } = useAuth();
  const { addToCart } = useCart();
  const [cartMessage, setCartMessage] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then(res => res.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const handleAddToCart = async (perfumeId: string) => {
    if (!token) {
      setCartMessage('Please log in to add to cart.');
      return;
    }
    try {
      await addToCart(perfumeId, 1);
      setCartMessage('Added to cart!');
    } catch {
      setCartMessage('Failed to add to cart');
    }
    setTimeout(() => setCartMessage(''), 2000);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background" />

        {/* Animated Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full float-animation"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${6 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="float-animation mb-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
            </div>

            <h1 className="text-7xl md:text-9xl font-playfair font-bold mb-6 fade-in">
              <span className="gradient-text">EYES</span>
            </h1>

            <p className="text-2xl md:text-3xl text-foreground/80 mb-4 fade-in font-light" style={{ animationDelay: '0.2s' }}>
              Where every fragrance tells a story
            </p>

            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto fade-in" style={{ animationDelay: '0.4s' }}>
              Discover our collection of luxury perfumes crafted with the finest ingredients.
              Each scent is a journey through emotions, memories, and dreams.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in" style={{ animationDelay: '0.6s' }}>
              <Link to="/products">
                <Button size="lg" className="glow-effect text-lg px-10 py-6 rounded-xl">
                  Explore Collection
                </Button>
              </Link>
              <Link to="/about">
                <Button variant="outline" size="lg" className="text-lg px-10 py-6 rounded-xl border-primary/30 hover:bg-primary/10">
                  Our Story
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-primary/30 flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-primary rounded-full" />
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-8 bg-secondary/30 border-y border-border/50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, text: "Free Shipping", sub: "On orders over $50" },
              { icon: Shield, text: "100% Authentic", sub: "Guaranteed genuine" },
              { icon: RefreshCw, text: "Easy Returns", sub: "30-day returns" },
              { icon: Gift, text: "Gift Wrapping", sub: "Available on request" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 justify-center">
                <item.icon className="w-6 h-6 text-primary flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">{item.text}</div>
                  <div className="text-xs text-muted-foreground">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-4 block">Our Collection</span>
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-6 gradient-text">
              Featured Fragrances
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Handpicked scents that capture the essence of elegance and sophistication
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {products.slice(0, 4).map((product, index) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToCart={handleAddToCart}
                index={index}
              />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/products">
              <Button size="lg" className="glow-effect px-10">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-4 block">Why EYES</span>
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-6 gradient-text">
              Crafted for Excellence
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Sparkles, title: "Premium Quality", desc: "Each fragrance is crafted with the finest ingredients sourced from around the world" },
              { icon: Gift, title: "Unique Scents", desc: "Exclusive fragrances you won't find anywhere else, designed by master perfumers" },
              { icon: Heart, title: "Crafted with Love", desc: "Every bottle is a labor of love, ensuring you receive the perfect fragrance experience" },
            ].map((item, i) => (
              <Card key={i} className="perfume-card text-center p-8 border-border/50" style={{ animationDelay: `${i * 0.2}s` }}>
                <CardContent className="pt-6">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-playfair font-semibold mb-4">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-primary text-sm font=semibold tracking-widest uppercase mb-4 block">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-6 gradient-text">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <Card key={i} className="perfume-card p-6 border-border/50">
                <CardContent className="pt-4">
                  <Quote className="w-8 h-8 text-primary/30 mb-4" />
                  <p className="text-foreground/80 mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-24 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/3616949/pexels-photo-3616949.jpeg')] bg-cover bg-center opacity-5" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-playfair font-bold mb-4 gradient-text">
              Join Our Community
            </h2>
            <p className="text-muted-foreground mb-8">
              Subscribe to receive exclusive offers, early access to new fragrances, and personalized recommendations.
            </p>

            {subscribed ? (
              <div className="bg-primary/10 text-primary px-6 py-4 rounded-xl">
                ✨ Thank you for subscribing! Check your email for a welcome gift.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-6 py-4 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                <Button type="submit" size="lg" className="glow-effect px-8">
                  Subscribe
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Cart Message Toast */}
      {cartMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-background border border-border text-foreground px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {cartMessage}
        </div>
      )}
    </div>
  );
});

export default Landing;