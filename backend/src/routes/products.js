import { Router } from 'express';
import Product from '../models/Product.js';

const router = Router();

// Get all products
router.get('/', async (_req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error('❌ Products GET error:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        console.error('❌ Product GET error:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

export default router;
