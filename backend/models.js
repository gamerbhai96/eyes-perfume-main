import mongoose from 'mongoose';

// User
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});
export const User = mongoose.models.User || mongoose.model('User', userSchema);

// Product
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: Number,
  image: String,
  description: String,
  category: String,
  rating: Number,
  isRecent: Boolean,
  isBestseller: Boolean,
});
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// OrderItem
const orderItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
});
// Order
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  name: String,
  address: String,
  phone: String,
  items: [orderItemSchema],
});
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// CartItem
const cartItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
});
// Cart
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  items: [cartItemSchema],
});
export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

// Review
const reviewSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: Number,
  comment: String,
  createdAt: { type: Date, default: Date.now },
});
export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema); 