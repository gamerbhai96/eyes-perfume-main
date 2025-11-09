import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSMongoose from "@adminjs/mongoose";
import Brevo from "@getbrevo/brevo";

dotenv.config();

// -------------------- APP SETUP --------------------
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://eyes-perfume-main.vercel.app";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET";
const otpStore = {};

const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// -------------------- DATABASE --------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// -------------------- MIDDLEWARE --------------------
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.warn("🚫 Blocked CORS origin:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());
app.use(express.json());
app.use(passport.initialize());

// -------------------- SCHEMAS --------------------
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    emailVerifiedAt: { type: Date },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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
const Product = mongoose.model("Product", productSchema);

const orderItemSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    items: [orderItemSchema],
    total: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, default: "cod" },
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

const cartItemSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);
const Cart = mongoose.model("Cart", cartSchema);

const reviewSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);
reviewSchema.index({ perfumeId: 1, userId: 1 }, { unique: true });
const Review = mongoose.model("Review", reviewSchema);

// -------------------- ADMINJS --------------------
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});
const admin = new AdminJS({
  resources: [User, Product, Order, Cart, Review],
  rootPath: "/admin",
  branding: { companyName: "EYES Perfume Admin" },
});
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(admin, {
  authenticate: async (email, password) => {
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      return { email: process.env.ADMIN_EMAIL };
    }
    return null;
  },
  cookieName: "adminjs",
  cookiePassword: process.env.ADMIN_COOKIE_SECRET || "supersecret-cookie",
});
app.use(admin.options.rootPath, adminRouter);

// -------------------- BREVO EMAIL --------------------
const brevo = new Brevo.TransactionalEmailsApi();
brevo.authentications["apiKey"].apiKey = process.env.BREVO_API_KEY;

async function sendOtpEmail(email, otp) {
  const sendSmtpEmail = {
    sender: {
      name: "EYES Perfume",
      email: process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] || "noreply@eyesperfume.com",
    },
    to: [{ email }],
    subject: "Your EYES Perfume OTP Code",
    htmlContent: `<p>Your OTP code is <b>${otp}</b>. It expires in 5 minutes.</p>`,
  };
  await brevo.sendTransacEmail(sendSmtpEmail);
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// -------------------- AUTH HELPERS --------------------
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// -------------------- ROUTES --------------------
app.get("/", (req, res) => res.send("🚀 EYES Perfume backend (Brevo) is running!"));

// -------------------- AUTH --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required." });
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: "Email already registered." });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ firstName, lastName, email, passwordHash });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user: newUser };
    await sendOtpEmail(email, otp);
    res.json({ message: "Signup successful, OTP sent." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(400).json({ error: "Invalid credentials." });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);
    res.json({ message: "OTP sent to your email." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const entry = otpStore[email.toLowerCase()];
  if (!entry) return res.status(400).json({ error: "Invalid or expired OTP session." });
  if (Date.now() > entry.expires) return res.status(400).json({ error: "OTP expired." });
  if (entry.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });

  const token = jwt.sign(
    { id: entry.user._id, email: entry.user.email, role: entry.user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  delete otpStore[email.toLowerCase()];
  res.json({ token, user: entry.user });
});

// -------------------- GOOGLE OAUTH --------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            firstName: profile.name?.givenName || "",
            lastName: profile.name?.familyName || "",
            email,
            passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
            emailVerifiedAt: new Date(),
          });
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/login` }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id, email: req.user.email }, JWT_SECRET, { expiresIn: "7d" });
    const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(req.user))}`;
    res.redirect(redirectUrl);
  }
);

// -------------------- PROFILE --------------------
app.get("/api/profile", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});
app.put("/api/profile", authenticateToken, async (req, res) => {
  const { firstName, lastName } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { $set: { firstName, lastName } }, { new: true }).select("-passwordHash");
  res.json(user);
});

// -------------------- PRODUCTS --------------------
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
app.get("/api/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// -------------------- ADMIN PRODUCT CRUD --------------------
app.post("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.json(p);
  } catch {
    res.status(500).json({ error: "Failed to create product" });
  }
});
app.put("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(p);
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
});
app.delete("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// -------------------- CART --------------------
app.get("/api/cart", authenticateToken, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id }).populate("items.perfumeId");
  res.json(cart ? cart.items : []);
});
app.post("/api/cart", authenticateToken, async (req, res) => {
  const { perfumeId, quantity } = req.body;
  let cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) cart = new Cart({ userId: req.user.id, items: [] });
  const idx = cart.items.findIndex((i) => i.perfumeId.toString() === String(perfumeId));
  if (idx > -1) cart.items[idx].quantity = quantity;
  else cart.items.push({ perfumeId, quantity });
  await cart.save();
  res.json({ success: true });
});
app.delete("/api/cart/:perfumeId", authenticateToken, async (req, res) => {
  const { perfumeId } = req.params;
  const cart = await Cart.findOne({ userId: req.user.id });
  if (cart) {
    cart.items = cart.items.filter((i) => i.perfumeId.toString() !== perfumeId);
    await cart.save();
  }
  res.json({ success: true });
});
app.delete("/api/cart", authenticateToken, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }
  res.json({ success: true });
});

// -------------------- CHECKOUT & ORDERS --------------------
app.post("/api/checkout", authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, paymentMethod } = req.body;
    const cart = await Cart.findOne({ userId: req.user.id }).populate("items.perfumeId");
    if (!cart || !cart.items.length) return res.status(400).json({ error: "Cart is empty" });

    const items = cart.items.map((it) => ({
      perfumeId: it.perfumeId._id,
      quantity: it.quantity,
      unitPrice: it.perfumeId.price,
    }));
    const total = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const order = await Order.create({
      userId: req.user.id,
      name,
      address,
      phone,
      items,
      total,
      paymentMethod: paymentMethod || "cod",
    });

    for (const it of cart.items)
      await Product.findByIdAndUpdate(it.perfumeId._id, { $inc: { stock: -it.quantity } });

    cart.items = [];
    await cart.save();
    res.json({ success: true, orderId: order._id });
  } catch (e) {
    console.error("Checkout Error:", e);
    res.status(500).json({ error: "Failed to place order" });
  }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id })
    .populate("items.perfumeId")
    .sort({ createdAt: -1 });
  res.json(orders);
});
app.get("/api/orders/:id", authenticateToken, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user.id }).populate("items.perfumeId");
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

// -------------------- REVIEWS --------------------
app.post("/api/reviews", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body;
    const existing = await Review.findOne({ perfumeId, userId: req.user.id });
    if (existing) return res.status(400).json({ error: "Already reviewed" });

    await Review.create({ perfumeId, userId: req.user.id, rating, comment });
    const reviews = await Review.find({ perfumeId });
    const avg = reviews.reduce((a, b) => a + b.rating, 0) / reviews.length;
    await Product.findByIdAndUpdate(perfumeId, { rating: avg, totalReviews: reviews.length });
    res.json({ message: "Review submitted" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/reviews/:perfumeId", async (req, res) => {
  const reviews = await Review.find({ perfumeId: req.params.perfumeId }).populate("userId", "firstName lastName");
  res.json(reviews);
});

// -------------------- TEST EMAIL --------------------
app.post("/api/test-email", async (req, res) => {
  try {
    const { to } = req.body;
    await brevo.sendTransacEmail({
      sender: {
        name: "EYES Perfume",
        email: process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] || "noreply@eyesperfume.com",
      },
      to: [{ email: to || process.env.ADMIN_EMAIL }],
      subject: "Test Email - EYES Perfume",
      htmlContent: `<p>This is a test email confirming your Brevo setup works correctly.</p>`,
    });
    res.json({ ok: true, message: "Test email sent" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS → http://localhost:${PORT}${admin.options.rootPath}`);
});
