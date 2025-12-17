import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: String,
        price: Number,
        image: String,
        description: String,
        brand: String,
        category: String,
        stock: { type: Number, default: 50 },
        rating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
