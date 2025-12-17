import { Router } from 'express';
import authRoutes from './auth.js';
import productRoutes from './products.js';
import cartRoutes from './cart.js';
import orderRoutes from './orders.js';
import reviewRoutes from './reviews.js';
import checkoutRoutes from './checkout.js';

const router = Router();

// Mount all routes
router.use('/', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/checkout', checkoutRoutes); // Direct checkout endpoint
router.use('/reviews', reviewRoutes);

export default router;
