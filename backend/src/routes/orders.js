import { Router } from 'express';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Checkout
router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const { name, address, phone } = req.body;

        if (!name || !address || !phone) {
            return res.status(400).json({
                error: 'Name, address, and phone are required',
            });
        }

        const cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');

        if (!cart || !cart.items.length) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Validate stock
        for (const item of cart.items) {
            if (!item.perfumeId) {
                return res.status(400).json({
                    error: 'Some products are no longer available',
                });
            }

            if (item.perfumeId.stock < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for ${item.perfumeId.name}`,
                });
            }
        }

        const items = cart.items.map((item) => ({
            perfumeId: item.perfumeId._id,
            quantity: item.quantity,
            unitPrice: item.perfumeId.price,
        }));

        const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        const order = await Order.create({
            userId: req.user.id,
            name,
            address,
            phone,
            items,
            total,
            status: 'pending',
        });

        // Update stock
        for (const item of cart.items) {
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

// Get user orders
router.get('/', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id })
            .populate('items.perfumeId')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error('❌ Orders GET Error:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.id,
        }).populate('items.perfumeId');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (err) {
        console.error('❌ Order GET Error:', err);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

export default router;
