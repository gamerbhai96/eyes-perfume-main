import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: Number,
        comment: String,
    },
    { timestamps: true }
);

reviewSchema.index({ perfumeId: 1, userId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
