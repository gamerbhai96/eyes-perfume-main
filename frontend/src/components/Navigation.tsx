import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ShoppingBag, User, Search, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { perfumes } from '../data/perfumes';

const Navigation = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredSuggestions = searchTerm.length > 0
    ? perfumes.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5)
    : [];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Sparkles className="h-8 w-8 text-primary group-hover:rotate-12 transition-transform duration-300" />
              <div className="absolute inset-0 h-8 w-8 text-primary opacity-30 group-hover:animate-ping" />
            </div>
            <span className="text-2xl font-playfair font-bold gradient-text">
              EYES
            </span>
          </Link>

          {/* Hamburger for mobile */}
          <button className="lg:hidden flex items-center justify-center p-2 rounded hover:bg-secondary transition" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Open menu">
            <Menu className="h-7 w-7 text-primary" />
          </button>

          {/* Navigation Links (desktop only) */}
          <div className="hidden lg:flex items-center gap-8">
            <Link
              to="/"
              className={`font-inter font-medium transition-colors duration-300 ${
                isActive('/') 
                  ? 'text-primary' 
                  : 'text-foreground hover:text-primary'
              }`}
            >
              Home
            </Link>
            <Link
              to="/products"
              className={`font-inter font-medium transition-colors duration-300 ${
                isActive('/products') 
                  ? 'text-primary' 
                  : 'text-foreground hover:text-primary'
              }`}
            >
              Products
            </Link>
            <Link
              to="/about"
              className={`font-inter font-medium transition-colors duration-300 ${
                isActive('/about') 
                  ? 'text-primary' 
                  : 'text-foreground hover:text-primary'
              }`}
            >
              About
            </Link>
          </div>

          {/* Search Bar (desktop only) */}
          <div className="hidden md:flex items-center relative max-w-sm flex-1 mx-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fragrances..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="pl-10 bg-secondary/50 border-border/50 focus:bg-secondary"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-12 bg-background border border-border rounded shadow-lg z-50">
                {filteredSuggestions.map(p => (
                  <Link
                    to={`/products/${p.id}`}
                    key={p.id}
                    className="block px-4 py-2 hover:bg-secondary transition-colors text-foreground"
                    onMouseDown={() => setShowSuggestions(false)}
                  >
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-8 h-8 object-cover rounded" />
                      <span>{p.name}</span>
                      <span className="ml-auto text-sm text-muted-foreground">${p.price}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons (desktop only) */}
          <div className="hidden lg:flex items-center gap-4">
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center bg-primary text-primary-foreground">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/profile">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    {user.firstName}
                  </Button>
                </Link>
                <Button variant="destructive" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}
            <Link to="/products">
              <Button size="sm" className="glow-effect">
                Shop Now
              </Button>
            </Link>
          </div>
        </div>
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 bg-background border border-border rounded shadow-lg p-6 flex flex-col gap-4 animate-fadeIn z-50">
            <Link to="/" className="font-inter font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/products" className="font-inter font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>
              Products
            </Link>
            <Link to="/about" className="font-inter font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>
              About
            </Link>
            <Link to="/cart" className="font-inter font-medium text-lg flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              <ShoppingBag className="h-5 w-5" />
              Cart
              {cartCount > 0 && (
                <Badge className="h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center bg-primary text-primary-foreground">
                  {cartCount}
                </Badge>
              )}
            </Link>
            {user ? (
              <>
                <Link to="/profile" className="font-inter font-medium text-lg flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button className="font-inter font-medium text-lg text-red-600 text-left" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="font-inter font-medium text-lg flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <User className="h-4 w-4" />
                Login
              </Link>
            )}
            <Link to="/products" className="font-inter font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>
              Shop Now
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;