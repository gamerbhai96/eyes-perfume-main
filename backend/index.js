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

// Load environment variables
dotenv.config();

// --- Initialize App ---
const app = express();

// --- Constants ---
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_HERE';
const otpStore = {};
const allowedOrigins = [
  'https://eyes-perfume-main.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected successfully.'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });

// --- Middleware ---
// ✅ FIXED CORS BLOCK
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());
app.use(express.json());
app.use(passport.initialize());

// --- Schema Definitions ---
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});
const User = mongoose.model('User', userSchema);

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
const Product = mongoose.model('Product', productSchema);

const orderItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  name: String,
  address: String,
  phone: String,
  items: [orderItemSchema],
});
const Order = mongoose.model('Order', orderSchema);

const cartItemSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
});

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  items: [cartItemSchema],
});
const Cart = mongoose.model('Cart', cartSchema);

const reviewSchema = new mongoose.Schema({
  perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: Number,
  comment: String,
  createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model('Review', reviewSchema);

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
          password: { type: 'string', isVisible: { list: false, edit: true, new: true, show: false } },
          passwordHash: { isVisible: false },
        },
        actions: {
          new: {
            before: async (req) => {
              if (req.payload?.password) {
                const bcryptMod = (await import('bcrypt')).default;
                req.payload = {
                  ...req.payload,
                  passwordHash: await bcryptMod.hash(req.payload.password, 10),
                  password: undefined,
                };
              }
              return req;
            },
          },
          edit: {
            before: async (req) => {
              if (req.payload?.password) {
                const bcryptMod = (await import('bcrypt')).default;
                req.payload = {
                  ...req.payload,
                  passwordHash: await bcryptMod.hash(req.payload.password, 10),
                  password: undefined,
                };
              }
              return req;
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

// --- Nodemailer (SMTP Gmail App Password) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USERNAME || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASS,
  },
});

transporter.verify().then(() => console.log('📬 SMTP connected')).catch(err => console.error('SMTP Error:', err));

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOtpEmail(email, otp) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your EYES Perfume OTP Code',
    text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
  });
}

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Base Route ---
app.get('/', (req, res) => {
  res.send('🚀 EYES Perfume backend is running!');
});

// --- Auth Routes ---
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ firstName, lastName, email, passwordHash });
    await newUser.save();

    const otp = generateOtp();
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000, user: newUser };
    await sendOtpEmail(email, otp);

    res.json({ message: 'Signup successful, OTP sent.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: 'Invalid email or password.' });

    const otp = generateOtp();
    otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to email.' });
  } catch (e) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const entry = otpStore[email];
  if (!entry) return res.status(400).json({ error: 'Invalid or expired OTP session.' });
  if (Date.now() > entry.expires) return res.status(400).json({ error: 'OTP expired.' });
  if (entry.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });

  const token = jwt.sign({ id: entry.user._id, email: entry.user.email, role: entry.user.role }, JWT_SECRET, { expiresIn: '7d' });
  delete otpStore[email];
  res.json({ token, user: { id: entry.user._id, email: entry.user.email, firstName: entry.user.firstName } });
});

// --- Google OAuth ---
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      email,
      passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
    });
    await user.save();
  }
  done(null, user);
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }), (req, res) => {
  const token = jwt.sign({ id: req.user._id, email: req.user.email }, JWT_SECRET, { expiresIn: '7d' });
  const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(req.user))}`;
  res.redirect(redirectUrl);
});

// --- Products ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// --- Cart ---
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    res.json(cart ? cart.items : []);
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const idx = cart.items.findIndex(i => i.perfumeId.toString() === perfumeId);
    if (idx > -1) cart.items[idx].quantity = quantity;
    else cart.items.push({ perfumeId, quantity });

    await cart.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

// --- Checkout ---
app.post('/api/checkout', authenticateToken, async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.perfumeId');
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty.' });

    const order = new Order({
      userId: req.user.id,
      name,
      address,
      phone,
      items: cart.items.map(i => ({ perfumeId: i.perfumeId._id, quantity: i.quantity })),
    });
    await order.save();
    cart.items = [];
    await cart.save();

    res.json({ success: true, orderId: order._id });
  } catch {
    res.status(500).json({ error: 'Checkout failed.' });
  }
});

// --- Reviews ---
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body;
    const existing = await Review.findOne({ perfumeId, userId: req.user.id });
    if (existing) return res.status(400).json({ error: 'You already reviewed this product.' });

    const review = new Review({ perfumeId, userId: req.user.id, rating, comment });
    await review.save();
    res.json({ message: 'Review submitted.' });
  } catch {
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

app.get('/api/reviews/:perfumeId', async (req, res) => {
  try {
    const reviews = await Review.find({ perfumeId: req.params.perfumeId }).populate('userId', 'firstName lastName');
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// --- Test Email Route ---
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to || process.env.ADMIN_EMAIL,
      subject: 'EYES Perfume Test Email',
      text: 'This is a test email confirming SMTP is working.',
    });
    res.json({ message: 'Email sent successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email.', details: err.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS at http://localhost:${PORT}${admin.options.rootPath}`);
});
