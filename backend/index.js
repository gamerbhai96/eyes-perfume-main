// ============================================================================
// EYES PERFUME — BACKEND (Render + MongoDB + Brevo + AdminJS + JWT)
// ----------------------------------------------------------------------------
// Features:
//   • Auth: signup → login → OTP verify (Brevo)
//   • Google OAuth
//   • AdminJS (no external session store)
//   • Products / Cart (populated) / Checkout / Orders / Reviews
//   • CORS for Vercel + Render + localhost
//   • /api/* 404 handler returns JSON (prevents HTML "<!DOCTYPE ..." in SPA)
//   • Logs incoming requests (method + path) to debug 404s quickly
// ============================================================================

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

// ------------------------------ App Setup -----------------------------------
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://eyes-perfume-main.vercel.app";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET";

// In-memory OTP store (use Redis in prod for multi-instance)
const otpStore = Object.create(null);

// ------------------------------ CORS ----------------------------------------
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://api-eyes-main.onrender.com", // your API origin (for self-calls)
];

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

// Simple request logger (helps catch wrong paths causing 404)
app.use((req, _res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  next();
});

// ------------------------------ Database ------------------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ------------------------------ Schemas -------------------------------------
// Users
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    emailVerifiedAt: { type: Date },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// Products
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

// Cart
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

// Orders
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
    paymentMethod: { type: String, default: "cod" },
    status: {
      type: String,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    items: [orderItemSchema],
    total: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

// Reviews
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

// ------------------------------ AdminJS -------------------------------------
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

const admin = new AdminJS({
  resources: [User, Product, Order, Cart, Review],
  rootPath: "/admin",
  branding: { companyName: "EYES Perfume Admin", logo: false, softwareBrothers: false },
});

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        console.log("✅ Admin login success");
        return { email };
      }
      console.warn("❌ Invalid Admin credentials");
      return null;
    },
    cookieName: "adminjs",
    cookiePassword: "no-cookie",
  },
  null,
  { resave: false, saveUninitialized: false }
);
app.use(admin.options.rootPath, adminRouter);

// ------------------------------ Brevo (Email OTP) ---------------------------
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
if (process.env.BREVO_API_KEY) {
  apiKey.apiKey = process.env.BREVO_API_KEY;
  console.log("✅ Brevo API key loaded.");
} else {
  console.error("❌ Missing BREVO_API_KEY");
}
const brevo = new Brevo.TransactionalEmailsApi();

const fromAddress = () =>
  process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
  process.env.EMAIL_FROM ||
  "noreply@eyesperfume.com";

async function sendOtpEmail(email, otp) {
  try {
    const payload = {
      sender: { name: "EYES Perfume", email: fromAddress() },
      to: [{ email }],
      subject: "Your EYES Perfume OTP Code",
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    };
    console.log("📨 Sending Brevo OTP email to:", email);
    await brevo.sendTransacEmail(payload);
    console.log("✅ Brevo email sent.");
  } catch (err) {
    console.error("❌ Brevo email error:", err?.response?.body || err);
    // don't throw here—login flow should still answer to client
  }
}

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ------------------------------ Auth Helpers --------------------------------
function authenticateToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ------------------------------ Routes: Health ------------------------------
app.get("/", (_req, res) => res.send("🚀 EYES Perfume backend running with Brevo & AdminJS"));
app.get("/__health", (_req, res) => res.json({ ok: true }));

// ------------------------------ Routes: Auth --------------------------------
// Signup → store user → send OTP to email
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body || {};
    if (!firstName || !lastName || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required" });
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
    });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);

    res.json({ message: "Signup successful. OTP sent to email." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// Login → verify password → send OTP
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) return res.status(400).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// Verify OTP → issue JWT (7d)
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body || {};
  const key = (email || "").toLowerCase();
  const entry = otpStore[key];

  if (!entry) return res.status(400).json({ error: "Invalid or expired OTP session." });
  if (Date.now() > entry.expires) return res.status(400).json({ error: "OTP expired." });
  if (entry.otp !== otp) return res.status(400).json({ error: "Incorrect OTP." });

  const { user } = entry;
  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  delete otpStore[key];
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  });
});

// ------------------------------ Routes: Google OAuth ------------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(null, false);

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
        return done(null, user);
      } catch (err) {
        return done(err);
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
    const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(
      token
    )}&user=${encodeURIComponent(JSON.stringify(req.user))}`;
    res.redirect(redirectUrl);
  }
);

// ------------------------------ Routes: Profile -----------------------------
app.get("/api/profile", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { firstName, lastName } },
      { new: true, select: "-passwordHash" }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ------------------------------ Routes: Products ----------------------------
app.get("/api/products", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    res.json(p);
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// (Optional) Admin product CRUD
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
    const p = await Product.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
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

// ------------------------------ Routes: Cart (fixed) ------------------------
// Support BOTH /api/cart and /cart to avoid 404 from frontend differences
const cartRouter = express.Router();

// GET cart → populated perfume details + subtotal + total
cartRouter.get("/", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate({
      path: "items.perfumeId",
      model: "Product",
      select: "name price image",
    });

    if (!cart || !cart.items.length) return res.json({ items: [], total: 0 });

    const items = cart.items
      .filter((it) => it.perfumeId)
      .map((it) => ({
        id: it.perfumeId._id,
        name: it.perfumeId.name,
        image: it.perfumeId.image,
        price: it.perfumeId.price,
        quantity: it.quantity,
        subtotal: Number(it.quantity) * Number(it.perfumeId.price || 0),
      }));

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
    res.json({ items, total });
  } catch (err) {
    console.error("🛒 Cart GET Error:", err);
    res.status(500).json({ error: "Failed to load cart." });
  }
});

// POST cart → add or update a single product
cartRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body || {};
    if (!perfumeId || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid input" });
    }

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const index = cart.items.findIndex(
      (i) => i.perfumeId.toString() === String(perfumeId)
    );
    if (index >= 0) cart.items[index].quantity = quantity;
    else cart.items.push({ perfumeId, quantity });

    await cart.save();
    res.json({ success: true });
  } catch (err) {
    console.error("🛒 Cart POST Error:", err);
    res.status(500).json({ error: "Failed to update cart." });
  }
});

// DELETE /cart/:perfumeId → remove item
cartRouter.delete("/:perfumeId", authenticateToken, async (req, res) => {
  try {
    const { perfumeId } = req.params;
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.json({ success: true });

    cart.items = cart.items.filter((i) => i.perfumeId.toString() !== String(perfumeId));
    await cart.save();
    res.json({ success: true });
  } catch (err) {
    console.error("🛒 Cart DELETE Error:", err);
    res.status(500).json({ error: "Failed to remove item." });
  }
});

// DELETE /cart → clear all
cartRouter.delete("/", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ success: true, message: "Cart cleared." });
  } catch (err) {
    console.error("🛒 Cart CLEAR Error:", err);
    res.status(500).json({ error: "Failed to clear cart." });
  }
});

// Mount both prefixes (prevents 404 regardless of which one frontend uses)
app.use("/api/cart", cartRouter);
app.use("/cart", cartRouter);

// ------------------------------ Routes: Checkout & Orders -------------------
app.post("/api/checkout", authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, paymentMethod } = req.body || {};
    if (!name || !address || !phone) {
      return res.status(400).json({ error: "Missing order details" });
    }

    const cart = await Cart.findOne({ userId: req.user.id }).populate("items.perfumeId");
    if (!cart || !cart.items.length) return res.status(400).json({ error: "Cart is empty" });

    const items = cart.items
      .filter((it) => it.perfumeId)
      .map((it) => ({
        perfumeId: it.perfumeId._id,
        quantity: it.quantity,
        unitPrice: it.perfumeId.price,
      }));

    const total = items.reduce((sum, it) => sum + it.quantity * (it.unitPrice || 0), 0);

    const order = await Order.create({
      userId: req.user.id,
      name,
      address,
      phone,
      paymentMethod: paymentMethod || "cod",
      items,
      total,
    });

    // (Optional) decrement stock
    for (const it of cart.items) {
      if (it.perfumeId && typeof it.perfumeId.stock === "number") {
        await Product.findByIdAndUpdate(it.perfumeId._id, { $inc: { stock: -it.quantity } });
      }
    }

    // clear cart
    cart.items = [];
    await cart.save();

    res.json({ success: true, orderId: order._id });
  } catch (e) {
    console.error("Checkout Error:", e);
    res.status(500).json({ error: "Failed to place order" });
  }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("items.perfumeId")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/orders/:id", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id }).populate("items.perfumeId");
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ------------------------------ Routes: Reviews ------------------------------
app.post("/api/reviews", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body || {};
    if (!perfumeId || rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid review details." });
    }

    const existing = await Review.findOne({ perfumeId, userId: req.user.id });
    if (existing) return res.status(400).json({ error: "You have already reviewed this product." });

    const review = new Review({ perfumeId, userId: req.user.id, rating, comment });
    await review.save();

    // Recompute aggregated rating
    const reviews = await Review.find({ perfumeId });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avg = reviews.length ? totalRating / reviews.length : 0;
    await Product.findByIdAndUpdate(perfumeId, { $set: { rating: avg, totalReviews: reviews.length } });

    res.json({ message: "Review submitted successfully." });
  } catch (e) {
    console.error("Review Error:", e);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/api/reviews/:perfumeId", async (req, res) => {
  try {
    const { perfumeId } = req.params;
    const reviews = await Review.find({ perfumeId }).populate("userId", "firstName lastName");
    res.json(reviews);
  } catch {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ------------------------------ API 404 Handler -----------------------------
// Important: return JSON for /api/* not found (prevents "<!DOCTYPE ..." in SPA)
app.use("/api", (req, res) => {
  console.warn("🔎 API 404:", req.method, req.originalUrl);
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// ------------------------------ Server Start --------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS: http://localhost:${PORT}${admin.options.rootPath}`);
});
