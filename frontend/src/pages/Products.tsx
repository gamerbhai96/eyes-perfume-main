import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Heart, Star, Search, Filter, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { Link } from 'react-router-dom';
import * as api from '@/lib/api';
import ProductCard from '@/components/ProductCard';

const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/1961792/pexels-photo-1961792.jpeg',
  'https://images.pexels.com/photos/1961795/pexels-photo-1961795.jpeg',
  'https://images.pexels.com/photos/724635/pexels-photo-724635.jpeg',
];

const Products = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { token } = useAuth();
  const { addToCart } = useCart();
  const [cartMessage, setCartMessage] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getProducts()
      .then(data => { setProducts(data); setLoading(false); })
      .catch(() => { setError('Failed to load products'); setLoading(false); });
  }, []);

  const categories = [
    { id: 'all', name: 'All Fragrances' },
    { id: 'floral', name: 'Floral' },
    { id: 'oriental', name: 'Oriental' },
    { id: 'fresh', name: 'Fresh' },
    { id: 'woody', name: 'Woody' }
  ];

  const filteredPerfumes = products.filter(perfume => {
    const matchesSearch = perfume.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         perfume.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || perfume.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading products...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen pt-20">
      {/* Header */}
      <section className="py-16 bg-gradient-hero">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-playfair font-bold mb-6 gradient-text fade-in">
            Our Collection
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto fade-in" style={{animationDelay: '0.2s'}}>
            Discover the perfect fragrance that speaks to your soul
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search fragrances..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="transition-all duration-300"
                >
                  {category.name}
                </Button>
              ))}
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              {filteredPerfumes.length} fragrances found
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {filteredPerfumes.map((product, index) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToCart={handleAddToCart}
                index={index}
              />
            ))}
          </div>
          
          {filteredPerfumes.length === 0 && (
            <div className="text-center py-16">
              <div className="text-muted-foreground text-lg mb-4">
                No fragrances found matching your criteria
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
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

export default Products;