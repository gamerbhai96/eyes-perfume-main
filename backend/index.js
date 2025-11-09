import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// --- AdminJS Imports ---
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';

// Load environment variables ASAP
dotenv.config();

// --- Mongoose Schema Definitions ---

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: Number,
  image: String,
  description: String,
  category: String,
  rating: Number,
  isRecent: Boolean,       // renamed from isNew to avoid conflict
  isBestseller: Boolean,
}, { timestamps: true });
const Product = mongoose.model('Product', productSchema);

const orderItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, min: 1, default: 1 },
});

const orderSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:{ type: Date, default: Date.now },
  name: String,
  address: String,
  phone: String,
  items: [orderItemSchema],
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);

const cartItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, min: 1, default: 1 },
});

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  items: [cartItemSchema],
}, { timestamps: true });
const Cart = mongoose.model('Cart', cartSchema);

const reviewSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, min: 1, max: 5, required: true },
  comment:   String,
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
const Review = mongoose.model('Review', reviewSchema);

// --- Main App Initialization ---
const app = express();

// --- Constants ---
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_HERE';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || `${FRONTEND_URL},http://localhost:5173,http://127.0.0.1:5173`)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Simple in-memory OTP store (consider Redis for prod)
const otpStore = {};

// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/perfume';
console.log('Connecting to MongoDB:', mongoUri);
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected successfully.'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --- Middleware ---
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// --- AdminJS Setup ---
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
          password: {
            type: 'string',
            isVisible: { list: false, edit: true, filter: false, show: false, new: true },
          },
          passwordHash: { isVisible: false },
        },
        actions: {
          new: {
            before: async (request) => {
              if (request.payload?.password) {
                const bcryptMod = (await import('bcrypt')).default;
                request.payload = {
                  ...request.payload,
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
      labels: {
        Product: "Product",
        Order: "Order",
        Cart: "Cart",
        Review: "Review",
        User: "User",
      },
      properties: {
        // User
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        passwordHash: "Password Hash",
        role: "Role",
        // Product
        name: "Name",
        price: "Price",
        originalPrice: "Original Price",
        image: "Image",
        description: "Description",
        category: "Category",
        rating: "Rating",
        isRecent: "Is Recent",
        isBestseller: "Is Bestseller",
        // Order
        userId: "User",
        createdAt: "Created At",
        address: "Address",
        phone: "Phone",
        items: "Items",
        // OrderItem
        perfumeId: "Perfume",
        quantity: "Quantity",
        // Cart
        // Review
        comment: "Comment",
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

// --- Nodemailer (SMTP) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', // false -> STARTTLS on 587
  auth: {
    user: process.env.SMTP_USERNAME || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASS,
  },
});

// optional: verify SMTP on boot (logs only)
transporter.verify().then(() => {
  console.log('📬 SMTP server is ready to take messages');
}).catch(err => {
  console.warn('⚠️ SMTP verify failed (emails may not send):', err?.message || err);
});

function sendOtpEmail(email, otp) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USERNAME || process.env.EMAIL_USER,
    to: email,
    subject: 'Your EYES Perfume OTP Code',
    text: `Your OTP code is: ${otp}. It expires in 5 minutes.`,
  });
}

function generateOtp() {
  return (Math.floor(100000 + Math.random() * 900000)).toString();
}

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Health check ---
app.get('/', (req, res) => {
  res.send('Perfume backend is running!');
});

// --- Auth & OTP Routes ---
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ firstName, lastName, email: email.toLowerCase(), passwordHash });
    await newUser.save();

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user: newUser };
    await sendOtpEmail(email, otp);

    res.json({ message: 'Signup successful, OTP sent to email.' });
  } catch (e) {
    console.error("Signup Error:", e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
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
    console.error("Login Error:", e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const entry = otpStore[(email || '').toLowerCase()];

  if (!entry) return res.status(400).json({ error: 'Invalid or expired OTP session.' });
  if (Date.now() > entry.expires) {
    delete otpStore[(email || '').toLowerCase()];
    return res.status(400).json({ error: 'OTP expired.' });
  }
  if (entry.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });

  const { user } = entry;
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  delete otpStore[(email || '').toLowerCase()];
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName, role: user.role }
  });
});

// --- Google OAuth ---
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
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
    });
    await newUser.save();
    done(null, newUser);
  } catch (err) {
    done(err);
  }
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }))}`;
    res.redirect(redirectUrl);
  }
);

// --- User Profile Routes ---
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Product Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// --- Cart Routes ---
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    if (!cart) return res.json([]);
    res.json(cart.items.map(item => ({
      perfumeId: item.perfumeId._id,
      product: item.perfumeId,
      quantity: item.quantity,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body;
    if (!perfumeId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid perfume or quantity' });
    }
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const idx = cart.items.findIndex(item => item.perfumeId.toString() === perfumeId);
    if (idx > -1) {
      cart.items[idx].quantity = quantity;
    } else {
      cart.items.push({ perfumeId, quantity });
    }
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
    cart.items = cart.items.filter(item => item.perfumeId.toString() !== perfumeId);
    await cart.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// --- Order Routes ---
app.post('/api/checkout', authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, paymentMethod } = req.body; // paymentMethod placeholder
    if (!name || !address || !phone) {
      return res.status(400).json({ error: 'Missing order details' });
    }
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const order = new Order({
      userId: req.user.id,
      name,
      address,
      phone,
      items: cart.items.map(item => ({
        perfumeId: item.perfumeId._id,
        quantity: item.quantity,
      })),
    });
    await order.save();
    cart.items = [];
    await cart.save();
    res.json({ success: true, orderId: order._id });
  } catch {
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

// --- Review Routes ---
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body;
    if (!perfumeId || rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid review details.' });
    }

    const existingReview = await Review.findOne({ perfumeId, userId: req.user.id });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product.' });
    }

    const newReview = new Review({ perfumeId, userId: req.user.id, rating, comment });
    await newReview.save();

    // Recalculate product rating
    const product = await Product.findById(perfumeId);
    if (product) {
      const reviews = await Review.find({ perfumeId: product._id });
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      product.rating = reviews.length > 0 ? totalRating / reviews.length : 0;
      await product.save();
    }

    res.json({ message: 'Review submitted successfully.' });
  } catch (e) {
    console.error("Review Error:", e);
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

// --- Utility: Test email route (optional; remove in prod) ---
app.post('/api/test-email', async (req, res) => {
  try {
    const { to = process.env.ADMIN_EMAIL } = req.body || {};
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USERNAME || process.env.EMAIL_USER,
      to,
      subject: 'Test Email - EYES Perfume',
      text: 'This is a test email confirming your SMTP configuration works.',
    });
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to send test email' });
  }
});

// --- Server Listen ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS dashboard is available at http://localhost:${PORT}${admin.options.rootPath}`);
});
