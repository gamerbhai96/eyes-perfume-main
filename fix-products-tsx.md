# Fix for Products.tsx

Here are the specific changes needed to fix the errors in the Products.tsx file:

## 1. Add Product Interface

Add this interface at the top of the file, after the imports:

```typescript
interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating?: number;
  isBestseller?: boolean;
  isRecent?: boolean;
}
```

## 2. Fix Type Safety in State Initialization

Change this line:
```typescript
const [products, setProducts] = useState([]);
```

To:
```typescript
const [products, setProducts] = useState<Product[]>([]);
```

## 3. Add Null/Undefined Checks in filteredPerfumes

Change these lines:
```typescript
const filteredPerfumes = products.filter(perfume => {
  const matchesSearch = perfume.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       perfume.description.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesCategory = selectedCategory === 'all' || perfume.category === selectedCategory;
  return matchesSearch && matchesCategory;
});
```

To:
```typescript
const filteredPerfumes = products.filter(perfume => {
  const matchesSearch = 
    (perfume.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (perfume.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
  const matchesCategory = selectedCategory === 'all' || perfume.category === selectedCategory;
  return matchesSearch && matchesCategory;
});
```

## 4. Improve Error Handling in API Fetch

Change these lines:
```typescript
.catch(() => { setError('Failed to load products'); setLoading(false); });
```

To:
```typescript
.catch((err) => { 
  console.error('Error loading products:', err);
  setError('Failed to load products. Please try again later.'); 
  setLoading(false); 
});
```

## 5. Fix handleAddToCart Function Type

Change this line:
```typescript
const handleAddToCart = async (perfumeId: string) => {
```

To:
```typescript
const handleAddToCart = async (perfumeId: string): Promise<void> => {
```

These changes will fix the main TypeScript errors and improve error handling in the Products.tsx file.