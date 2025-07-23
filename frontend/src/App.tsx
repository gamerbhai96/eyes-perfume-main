import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Landing from "./pages/Landing";
import Products from "./pages/Products";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./hooks/use-auth";
import Profile from "./pages/Profile";
import Cart from "./pages/Cart";
import { CartProvider } from "./hooks/use-cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import Product from "./pages/Product";
import About from "./pages/About";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}> {/* <-- FIX IS HERE: query-client -> queryClient */}
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Navigation />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/products" element={<Products />} />
                <Route path="/about" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/products/:id" element={<Product />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;