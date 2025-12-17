import { Router } from 'express';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get reviews for a product
router.get('/:perfumeId', async (req, res) => {
    try {
        const reviews = await Review.find({ perfumeId: req.params.perfumeId })
            .populate('userId', 'firstName lastName')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        console.error('❌ Reviews GET Error:', err);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Submit a review
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { perfumeId, rating, comment } = req.body;

        if (!perfumeId || !rating) {
            return res.status(400).json({ error: 'Product ID and rating required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1-5' });
        }

        const product = await Product.findById(perfumeId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const existingReview = await Review.findOne({
            perfumeId,
            userId: req.user.id,
        });

        if (existingReview) {
            existingReview.rating = rating;
            existingReview.comment = comment;
            await existingReview.save();
        } else {
            await Review.create({
                perfumeId,
                userId: req.user.id,
                rating,
                comment,
            });
        }

        const reviews = await Review.find({ perfumeId });
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

        product.rating = Math.round(avgRating * 10) / 10;
        product.totalReviews = reviews.length;
        await product.save();

        console.log(`✅ Review submitted for ${product.name}`);
        res.json({ success: true, message: 'Review submitted' });
    } catch (err) {
        console.error('❌ Review Error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

export default router;
