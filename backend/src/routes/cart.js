import { Router } from 'express';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get cart
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('🛒 GET CART - User ID:', req.user.id);

        let cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');

        if (!cart || !cart.items || cart.items.length === 0) {
            console.log('🛒 Cart is empty');
            return res.json({ items: [], total: 0 });
        }

        // Filter out any null products (in case product was deleted)
        const validItems = cart.items.filter((item) => item.perfumeId != null);

        const items = validItems.map((item) => ({
            id: item.perfumeId._id,
            perfumeId: item.perfumeId._id,
            name: item.perfumeId.name,
            image: item.perfumeId.image,
            price: item.perfumeId.price,
            brand: item.perfumeId.brand,
            stock: item.perfumeId.stock,
            quantity: item.quantity,
            subtotal: item.quantity * item.perfumeId.price,
        }));

        const total = items.reduce((sum, item) => sum + item.subtotal, 0);

        console.log(`✅ Cart loaded: ${items.length} items, Total: $${total}`);

        res.json({ items, total });
    } catch (err) {
        console.error('❌ Cart GET Error:', err);
        res.status(500).json({ error: 'Failed to load cart', details: err.message });
    }
});

// Add to cart
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { perfumeId, quantity } = req.body;

        console.log('🛒 ADD TO CART');
        console.log('   User:', req.user.id);
        console.log('   Product:', perfumeId);
        console.log('   Quantity:', quantity);

        if (!perfumeId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        const qty = parseInt(quantity) || 1;

        if (qty < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        // Verify product exists
        const product = await Product.findById(perfumeId);

        if (!product) {
            console.log('❌ Product not found');
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log('✅ Product found:', product.name, 'Price:', product.price);

        // Check stock
        if (product.stock < qty) {
            return res.status(400).json({
                error: `Only ${product.stock} items in stock`,
            });
        }

        // Find or create cart
        let cart = await Cart.findOne({ userId: req.user.id });

        if (!cart) {
            console.log('📦 Creating new cart');
            cart = new Cart({
                userId: req.user.id,
                items: [],
            });
        }

        // Check if item already exists
        const existingItemIndex = cart.items.findIndex(
            (item) => item.perfumeId.toString() === perfumeId.toString()
        );

        if (existingItemIndex !== -1) {
            // Update quantity
            const newQty = cart.items[existingItemIndex].quantity + qty;

            if (newQty > product.stock) {
                return res.status(400).json({
                    error: `Cannot add more. Maximum ${product.stock} items available`,
                });
            }

            cart.items[existingItemIndex].quantity = newQty;
            console.log(`✅ Updated quantity to ${newQty}`);
        } else {
            // Add new item
            cart.items.push({
                perfumeId: perfumeId,
                quantity: qty,
            });
            console.log(`✅ Added new item with quantity ${qty}`);
        }

        // Save cart
        await cart.save();
        console.log('💾 Cart saved');

        // Get updated cart with populated products
        const updatedCart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');

        const items = updatedCart.items
            .filter((item) => item.perfumeId != null)
            .map((item) => ({
                id: item.perfumeId._id,
                perfumeId: item.perfumeId._id,
                name: item.perfumeId.name,
                image: item.perfumeId.image,
                price: item.perfumeId.price,
                brand: item.perfumeId.brand,
                stock: item.perfumeId.stock,
                quantity: item.quantity,
                subtotal: item.quantity * item.perfumeId.price,
            }));

        const total = items.reduce((sum, item) => sum + item.subtotal, 0);

        console.log('✅ CART SUCCESS');
        console.log(`   Items: ${items.length}`);
        console.log(`   Total: $${total}`);

        res.json({
            success: true,
            message: 'Item added to cart',
            cart: { items, total },
        });
    } catch (err) {
        console.error('❌ ADD TO CART ERROR:', err);
        res.status(500).json({
            error: 'Failed to add item to cart',
            details: err.message,
        });
    }
});

// Update cart item quantity
router.put('/:perfumeId', authenticateToken, async (req, res) => {
    try {
        const { perfumeId } = req.params;
        const { quantity } = req.body;

        const qty = parseInt(quantity);

        if (!qty || qty < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        const product = await Product.findById(perfumeId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.stock < qty) {
            return res.status(400).json({
                error: `Only ${product.stock} items available`,
            });
        }

        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.perfumeId.toString() === perfumeId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not in cart' });
        }

        cart.items[itemIndex].quantity = qty;
        await cart.save();

        console.log(`✅ Updated ${product.name} quantity to ${qty}`);

        res.json({
            success: true,
            message: 'Quantity updated successfully',
        });
    } catch (err) {
        console.error('❌ Cart UPDATE Error:', err);
        res.status(500).json({ error: 'Failed to update cart item' });
    }
});

// Remove item from cart
router.delete('/:perfumeId', authenticateToken, async (req, res) => {
    try {
        const { perfumeId } = req.params;

        console.log('🛒 DELETE CART ITEM:', perfumeId);

        const cart = await Cart.findOne({ userId: req.user.id });

        if (!cart) {
            return res.json({ success: true, message: 'Cart is empty' });
        }

        const initialLength = cart.items.length;
        cart.items = cart.items.filter(
            (item) => item.perfumeId.toString() !== perfumeId
        );

        if (cart.items.length === initialLength) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }

        await cart.save();

        console.log('✅ Item removed from cart');
        res.json({ success: true, message: 'Item removed from cart' });
    } catch (err) {
        console.error('❌ Cart DELETE Error:', err);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

// Clear entire cart
router.delete('/', authenticateToken, async (req, res) => {
    try {
        console.log('🛒 CLEAR CART - User:', req.user.id);

        const cart = await Cart.findOne({ userId: req.user.id });

        if (cart) {
            cart.items = [];
            await cart.save();
            console.log('✅ Cart cleared');
        }

        res.json({ success: true, message: 'Cart cleared successfully' });
    } catch (err) {
        console.error('❌ Cart CLEAR Error:', err);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});

export default router;
