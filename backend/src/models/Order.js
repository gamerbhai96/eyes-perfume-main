import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        items: [
            {
                perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                quantity: Number,
                unitPrice: Number,
            },
        ],
        total: Number,
        name: String,
        address: String,
        phone: String,
        paymentMethod: { type: String, default: 'cod' },
        status: { type: String, default: 'pending' },
    },
    { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
