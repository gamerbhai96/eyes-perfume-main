import { Router } from 'express';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/checkout - Process checkout
router.post('/', authenticateToken, async (req, res) => {
    try {
        console.log('🛒 CHECKOUT - Processing order');
        const { name, address, phone, paymentMethod } = req.body;

        if (!name || !address || !phone) {
            return res.status(400).json({
                error: 'Name, address, and phone are required',
            });
        }

        const cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');

        if (!cart || !cart.items.length) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        console.log(`📦 Cart has ${cart.items.length} items`);

        // Filter out null products and validate stock
        const validItems = cart.items.filter(item => item.perfumeId != null);

        if (validItems.length === 0) {
            return res.status(400).json({
                error: 'No valid products in cart',
            });
        }

        for (const item of validItems) {
            if (item.perfumeId.stock < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for ${item.perfumeId.name}. Only ${item.perfumeId.stock} available.`,
                });
            }
        }

        const items = validItems.map((item) => ({
            perfumeId: item.perfumeId._id,
            name: item.perfumeId.name,
            quantity: item.quantity,
            unitPrice: item.perfumeId.price,
        }));

        const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        console.log(`💰 Order total: $${total}`);

        const order = await Order.create({
            userId: req.user.id,
            name,
            address,
            phone,
            paymentMethod: paymentMethod || 'cod',
            items,
            total,
            status: 'pending',
        });

        // Update stock
        for (const item of validItems) {
            await Product.findByIdAndUpdate(item.perfumeId._id, {
                $inc: { stock: -item.quantity },
            });
        }

        // Clear cart
        cart.items = [];
        await cart.save();

        console.log(`✅ Order created: ${order._id}`);

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id,
            total: total,
        });
    } catch (err) {
        console.error('❌ Checkout Error:', err);
        res.status(500).json({ error: 'Failed to process checkout' });
    }
});

export default router;
