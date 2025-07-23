import { Star, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: any;
  onAddToCart: (productId: string) => void;
  onQuickView?: (product: any) => void;
  showWishlist?: boolean;
  index?: number; // Add index prop for stagger animation
}

const DEFAULT_IMAGE = 'https://images.pexels.com/photos/1895015/pexels-photo-1895015.jpeg';

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart, 
  onQuickView, 
  showWishlist,
  index = 0  // Default to 0 if not provided
}) => {
  const [imgError, setImgError] = React.useState(false);
  const navigate = useNavigate();
  const discount = product.originalPrice && product.price < product.originalPrice
    ? Math.round(100 - (product.price / product.originalPrice) * 100)
    : null;

  const handleCardClick = () => {
    navigate(`/products/${product._id}`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking the button
    onAddToCart(product._id);
  };

  return (
    <Card 
      className="relative flex flex-col h-full perfume-card border-border/50 shadow-sm hover:shadow-lg transition-shadow bg-card rounded-xl overflow-hidden cursor-pointer stagger-animation"
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="relative w-full aspect-[4/5] bg-white flex items-center justify-center overflow-hidden">
        <img
          src={imgError ? DEFAULT_IMAGE : (product.image || DEFAULT_IMAGE)}
          alt={product.name}
          className="object-cover w-full h-full transition-transform duration-300 hover:scale-105"
          onError={() => setImgError(true)}
        />
        {product.isBestseller && (
          <Badge className="absolute top-2 left-2 bg-yellow-400 text-black font-bold">Bestseller</Badge>
        )}
        {product.isRecent && (
          <Badge className="absolute top-2 right-2 bg-primary text-white font-bold">New</Badge>
        )}
        {showWishlist && (
          <Heart 
            className="absolute top-2 right-2 h-6 w-6 text-white/80 hover:text-primary transition-colors cursor-pointer" 
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
      <CardContent className="flex-1 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-semibold line-clamp-1 flex-1" title={product.name}>{product.name}</span>
        </div>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-xl font-bold text-primary">${product.price}</span>
          {product.originalPrice && (
            <span className="line-through text-sm text-muted-foreground">${product.originalPrice}</span>
          )}
          {discount && (
            <span className="text-green-600 text-xs font-semibold">{discount}% off</span>
          )}
        </div>
        <div className="flex items-center gap-1 mb-2">
          {product.rating ? (
            <>
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">({product.rating.toFixed(1)})</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No ratings</span>
          )}
        </div>
        <div className="flex-1" />
        <Button 
          className="w-full glow-effect button-primary mt-2" 
          onClick={handleAddToCartClick}
        >
          Add to Cart
        </Button>
        {onQuickView && (
          <Button 
            variant="outline" 
            className="w-full button-outline mt-2" 
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
          >
            Quick View
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductCard; 