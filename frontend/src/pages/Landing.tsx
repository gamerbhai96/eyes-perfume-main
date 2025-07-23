import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Sparkles, Star, Heart, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/1961792/pexels-photo-1961792.jpeg',
  'https://images.pexels.com/photos/1961795/pexels-photo-1961795.jpeg',
  'https://images.pexels.com/photos/724635/pexels-photo-724635.jpeg',
];

const Landing = () => {
  const { token } = useAuth();
  const { addToCart } = useCart();
  const [cartMessage, setCartMessage] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then(res => res.json())
      .then(setProducts);
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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg')] bg-cover bg-center opacity-10" />
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="float-animation">
              <Sparkles className="h-16 w-16 text-primary mx-auto mb-8" />
            </div>
            
            <h1 className="text-6xl md:text-8xl font-playfair font-bold mb-6 fade-in">
              <span className="gradient-text">EYES</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 fade-in" style={{animationDelay: '0.2s'}}>
              Where every fragrance tells a story
            </p>
            
            <p className="text-lg text-foreground/80 mb-12 max-w-2xl mx-auto fade-in" style={{animationDelay: '0.4s'}}>
              Discover our collection of luxury perfumes crafted with the finest ingredients. 
              Each scent is a journey through emotions, memories, and dreams.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center fade-in" style={{animationDelay: '0.6s'}}>
              <Link to="/products">
                <Button size="lg" className="glow-effect text-lg px-8 py-4">
                  Explore Collection
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                Discover More
              </Button>
            </div>
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 float-animation" style={{animationDelay: '1s'}}>
          <div className="w-3 h-3 bg-primary rounded-full opacity-60" />
        </div>
        <div className="absolute top-40 right-20 float-animation" style={{animationDelay: '2s'}}>
          <div className="w-2 h-2 bg-primary-glow rounded-full opacity-40" />
        </div>
        <div className="absolute bottom-40 left-20 float-animation" style={{animationDelay: '1.5s'}}>
          <div className="w-4 h-4 bg-primary rounded-full opacity-50" />
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-6 gradient-text">
              Featured Collection
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Handpicked fragrances that capture the essence of elegance and sophistication
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
              <Button size="lg" className="glow-effect">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-secondary/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-6 gradient-text">
              Why Choose EYES
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center stagger-animation">
              <div className="mb-6">
                <Sparkles className="h-12 w-12 text-primary mx-auto" />
              </div>
              <h3 className="text-xl font-playfair font-semibold mb-4">Premium Quality</h3>
              <p className="text-muted-foreground">
                Each fragrance is crafted with the finest ingredients sourced from around the world
              </p>
            </div>
            
            <div className="text-center stagger-animation" style={{animationDelay: '0.2s'}}>
              <div className="mb-6">
                <Gift className="h-12 w-12 text-primary mx-auto" />
              </div>
              <h3 className="text-xl font-playfair font-semibold mb-4">Unique Scents</h3>
              <p className="text-muted-foreground">
                Exclusive fragrances you won't find anywhere else, designed by master perfumers
              </p>
            </div>
            
            <div className="text-center stagger-animation" style={{animationDelay: '0.4s'}}>
              <div className="mb-6">
                <Heart className="h-12 w-12 text-primary mx-auto" />
              </div>
              <h3 className="text-xl font-playfair font-semibold mb-4">Crafted with Love</h3>
              <p className="text-muted-foreground">
                Every bottle is a labor of love, ensuring you receive the perfect fragrance experience
              </p>
            </div>
          </div>
        </div>
      </section>

      {cartMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded shadow-lg z-50">
          {cartMessage}
        </div>
      )}
    </div>
  );
};

export default Landing;