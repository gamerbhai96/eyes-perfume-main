import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
import { Resend } from 'resend';

dotenv.config();

// -------------------------------------
// App & Constants
// -------------------------------------
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_HERE';

// allowlist for CORS (Vercel + local)
const allowedOrigins = [
  FRONTEND_URL,
  'https://eyes-perfume-main.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// in-memory OTP store (switch to Redis for prod)
const otpStore = Object.create(null);

// -------------------------------------
// MongoDB
// -------------------------------------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/perfume';
console.log('Connecting to MongoDB:', MONGODB_URI);
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// -------------------------------------
// Middleware (CORS FIRST!)
// -------------------------------------
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // mobile apps, curl, etc.
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.warn('🚫 Blocked CORS origin:', origin);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());
app.use(express.json());
app.use(passport.initialize());

// -------------------------------------
// Schemas & Models
// -------------------------------------
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    emailVerifiedAt: { type: Date },
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    image: String,
    images: [String],
    description: String,
    notes: [String],
    brand: String,
    category: String,
    rating: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 },
    isRecent: Boolean,
    isBestseller: Boolean,
    stock: { type: Number, default: 100, min: 0 },
    tags: [String],
  },
  { timestamps: true }
);
const Product = mongoose.model('Product', productSchema);

const orderItemSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt:{ type: Date, default: Date.now },
    name:     { type: String, required: true },
    address:  { type: String, required: true },
    phone:    { type: String, required: true },
    status:   { type: String, enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'placed' },
    items:    [orderItemSchema],
    total:    { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, default: 'cod' },
  },
  { timestamps: true }
);
const Order = mongoose.model('Order', orderSchema);

const cartItemSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);
const Cart = mongoose.model('Cart', cartSchema);

const reviewSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating:    { type: Number, min: 1, max: 5, required: true },
    comment:   { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
reviewSchema.index({ perfumeId: 1, userId: 1 }, { unique: true });
const Review = mongoose.model('Review', reviewSchema);

// -------------------------------------
// AdminJS
// -------------------------------------
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

const admin = new AdminJS({
  resources: [
    {
      resource: User,
      options: {
        properties: {
          password: { type: 'string', isVisible: { list: false, edit: true, filter: false, show: false, new: true } },
          passwordHash: { isVisible: false },
        },
        actions: {
          new: {
            before: async (request) => {
              if (request.payload?.password) {
                const bcryptMod = (await import('bcrypt')).default;
                request.payload = {
                  ...request.payload,
                  email: request.payload.email?.toLowerCase(),
                  passwordHash: await bcryptMod.hash(request.payload.password, 10),
                  password: undefined,
                };
              }
              return request;
            },
          },
          edit: {
            before: async (request) => {
              if (request.payload?.password) {
                const bcryptMod = (await import('bcrypt')).default;
                request.payload = {
                  ...request.payload,
                  email: request.payload.email?.toLowerCase(),
                  passwordHash: await bcryptMod.hash(request.payload.password, 10),
                  password: undefined,
                };
              }
              return request;
            },
          },
        },
      },
    },
    Product,
    Order,
    Cart,
    Review,
  ],
  rootPath: '/admin',
  branding: { companyName: 'EYES Perfume Admin' },
  locale: {
    translations: {
      labels: { User: 'User', Product: 'Product', Order: 'Order', Cart: 'Cart', Review: 'Review' },
      properties: {
        firstName: 'First Name', lastName: 'Last Name', email: 'Email', passwordHash: 'Password Hash', role: 'Role',
        name: 'Name', price: 'Price', originalPrice: 'Original Price', image: 'Image', description: 'Description',
        category: 'Category', brand: 'Brand', rating: 'Rating', isRecent: 'Is Recent', isBestseller: 'Is Bestseller',
        stock: 'Stock', userId: 'User', createdAt: 'Created At', address: 'Address', phone: 'Phone', items: 'Items',
        perfumeId: 'Perfume', quantity: 'Quantity', comment: 'Comment',
      },
    },
  },
});

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(admin, {
  authenticate: async (email, password) => {
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      return { email: process.env.ADMIN_EMAIL };
    }
    return null;
  },
  cookieName: 'adminjs',
  cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'supersecret-cookie',
});
app.use(admin.options.rootPath, adminRouter);

// -------------------------------------
// Email (Resend HTTPS API — Render friendly)
// -------------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOtpEmail(email, otp) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'EYES Perfume <noreply@eyesperfume.com>',
    to: email,
    subject: 'Your EYES Perfume OTP Code',
    text: `Your OTP code is: ${otp}. It expires in 5 minutes.`,
  });
}

function generateOtp() {
  return (Math.floor(100000 + Math.random() * 900000)).toString();
}

// -------------------------------------
// Auth helpers
// -------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403);
    req.user = payload;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// -------------------------------------
// Routes
// -------------------------------------

// Health
app.get('/', (req, res) => {
  res.send('🚀 EYES Perfume backend is running!');
});

// Auth — signup
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ firstName, lastName, email: email.toLowerCase(), passwordHash });
    await newUser.save();

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user: newUser };
    await sendOtpEmail(email, otp);

    res.json({ message: 'Signup successful, OTP sent to email.' });
  } catch (e) {
    console.error('Signup Error:', e);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Auth — login (sends OTP)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to your email to complete login.' });
  } catch (e) {
    console.error('Login Error:', e);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Auth — verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};
  const key = (email || '').toLowerCase();
  const entry = otpStore[key];

  if (!entry) return res.status(400).json({ error: 'Invalid or expired OTP session.' });
  if (Date.now() > entry.expires) {
    delete otpStore[key];
    return res.status(400).json({ error: 'OTP expired.' });
  }
  if (entry.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });

  const { user } = entry;
  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  delete otpStore[key];
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  });
});

// Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0].value?.toLowerCase();
        if (!email) return done(null, false, { message: 'No email from Google' });

        let user = await User.findOne({ email });
        if (user) return done(null, user);

        const newUser = new User({
          firstName: profile.name?.givenName || '',
          lastName:  profile.name?.familyName || '',
          email,
          passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
          emailVerifiedAt: new Date(),
        });
        await newUser.save();
        done(null, newUser);
      } catch (err) {
        done(err);
      }
    }
  )
);

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(
      token
    )}&user=${encodeURIComponent(
      JSON.stringify({
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      })
    )}`;
    res.redirect(redirectUrl);
  }
);

// Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { firstName, lastName } },
      { new: true, select: '-passwordHash' }
    );
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Products (with simple filtering/pagination support)
app.get('/api/products', async (req, res) => {
  try {
    const { q, category, brand, minPrice, maxPrice, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: String(q), $options: 'i' };
    if (category) filter.category = String(category);
    if (brand) filter.brand = String(brand);
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Admin product CRUD (optional)
app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.json(p);
  } catch {
    res.status(500).json({ error: 'Failed to create product' });
  }
});
app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(p);
  } catch {
    res.status(500).json({ error: 'Failed to update product' });
  }
});
app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    if (!cart) return res.json([]);
    const out = cart.items.map((it) => ({
      perfumeId: it.perfumeId?._id,
      product: it.perfumeId,
      quantity: it.quantity,
    }));
    res.json(out);
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body || {};
    if (!perfumeId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid perfume or quantity' });
    }
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });
    const idx = cart.items.findIndex((it) => it.perfumeId.toString() === String(perfumeId));
    if (idx > -1) cart.items[idx].quantity = quantity;
    else cart.items.push({ perfumeId, quantity });
    await cart.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

app.delete('/api/cart/:perfumeId', authenticateToken, async (req, res) => {
  try {
    const { perfumeId } = req.params;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.json({ success: true });
    cart.items = cart.items.filter((it) => it.perfumeId.toString() !== String(perfumeId));
    await cart.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

app.delete('/api/cart', authenticateToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// Orders
app.post('/api/checkout', authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, paymentMethod } = req.body || {};
    if (!name || !address || !phone) {
      return res.status(400).json({ error: 'Missing order details' });
    }
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const items = cart.items.map((it) => ({
      perfumeId: it.perfumeId._id,
      quantity: it.quantity,
      unitPrice: it.perfumeId.price,
    }));
    const total = items.reduce((sum, it) => sum + it.quantity * (it.unitPrice || 0), 0);
    const order = new Order({
      userId: req.user.id,
      name,
      address,
      phone,
      paymentMethod: paymentMethod || 'cod',
      items,
      total,
    });
    await order.save();

    // Optional: decrement stock
    for (const it of cart.items) {
      if (it.perfumeId && typeof it.perfumeId.stock === 'number') {
        await Product.findByIdAndUpdate(it.perfumeId._id, { $inc: { stock: -it.quantity } });
      }
    }

    cart.items = [];
    await cart.save();

    res.json({ success: true, orderId: order._id });
  } catch (e) {
    console.error('Checkout Error:', e);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate('items.perfumeId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id }).populate('items.perfumeId');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Reviews
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body || {};
    if (!perfumeId || rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid review details.' });
    }
    const existing = await Review.findOne({ perfumeId, userId: req.user.id });
    if (existing) return res.status(400).json({ error: 'You have already reviewed this product.' });

    const review = new Review({ perfumeId, userId: req.user.id, rating, comment });
    await review.save();

    // Recompute product rating
    const reviews = await Review.find({ perfumeId });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avg = reviews.length ? totalRating / reviews.length : 0;
    await Product.findByIdAndUpdate(perfumeId, { $set: { rating: avg, totalReviews: reviews.length } });

    res.json({ message: 'Review submitted successfully.' });
  } catch (e) {
    console.error('Review Error:', e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/reviews/:perfumeId', async (req, res) => {
  try {
    const { perfumeId } = req.params;
    const reviews = await Review.find({ perfumeId }).populate('userId', 'firstName lastName');
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Utilities
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'EYES Perfume <noreply@eyesperfume.com>',
      to: to || process.env.ADMIN_EMAIL,
      subject: 'Test Email - EYES Perfume',
      text: 'This is a test email confirming your email setup works via Resend on Render.',
    });
    res.json({ ok: true, message: `Test email sent to ${to || process.env.ADMIN_EMAIL}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err?.message || 'Failed to send test email' });
  }
});

// -------------------------------------
// Start
// -------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS → http://localhost:${PORT}${admin.options.rootPath}`);
});
