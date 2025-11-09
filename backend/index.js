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
import session from "express-session";
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
const otpStore = Object.create(null);

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

process.on("uncaughtException", (err) =>
  console.error("💥 Uncaught Exception:", err)
);
process.on("unhandledRejection", (err) =>
  console.error("💥 Unhandled Rejection:", err)
);

// -------------------- SCHEMAS --------------------
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
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
    createdAt: { type: Date, default: Date.now },
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

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        return { email: process.env.ADMIN_EMAIL };
      }
      return null;
    },
    cookieName: "adminjs",
    cookiePassword: process.env.ADMIN_COOKIE_SECRET || "supersecret-cookie",
  },
  null,
  {
    resave: false,
    saveUninitialized: true,
    store: new session.MemoryStore(), // replace with Redis/Mongo store for prod
  }
);
app.use(admin.options.rootPath, adminRouter);

// -------------------- BREVO EMAIL (FIXED v1 SDK) --------------------
// Proper init for @getbrevo/brevo with ESM & Node 22+
const defaultClient = Brevo.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevo = new Brevo.TransactionalEmailsApi();

function fromAddress() {
  // If EMAIL_FROM = "EYES Perfume <noreply@eyesperfume.com>" => extract address
  return process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] || process.env.EMAIL_FROM || "noreply@eyesperfume.com";
}

async function sendOtpEmail(email, otp) {
  const sendSmtpEmail = {
    sender: { name: "EYES Perfume", email: fromAddress() },
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
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = payload;
    next();
  });
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// -------------------- ROUTES --------------------
// Health
app.get("/", (req, res) => res.send("🚀 EYES Perfume backend (Brevo) is running!"));

// -------------------- AUTH (Signup/Login/OTP) --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body || {};
    if (!firstName || !lastName || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields required." });
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: "Email already registered." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ firstName, lastName, email: email.toLowerCase(), passwordHash });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    console.log(`📧 Signup OTP for ${email}: ${otp}`);
    await sendOtpEmail(email, otp);

    res.json({ message: "Signup successful. OTP sent to email." });
  } catch (err) {
    console.error("🔥 Signup route error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.warn("❌ Login failed — user not found:", email);
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.passwordHash || "");
    if (!match) {
      console.warn("❌ Login failed — bad password for:", email);
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    console.log(`📧 Login OTP for ${email}: ${otp}`);
    await sendOtpEmail(email, otp);

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("🔥 Login route error:", err);
    res.status(500).json({ error: "Server error. Please check backend logs." });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body || {};
  const key = (email || "").toLowerCase();
  const entry = otpStore[key];

  if (!entry) return res.status(400).json({ error: "Invalid or expired OTP session." });
  if (Date.now() > entry.expires) {
    delete otpStore[key];
    return res.status(400).json({ error: "OTP expired." });
  }
  if (entry.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });

  const user = entry.user;
  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  delete otpStore[key];
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  });
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
        if (!email) return done(null, false, { message: "No email from Google" });

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
    const token = jwt.sign({ id: req.user._id, email: req.user.email, role: req.user.role }, JWT_SECRET, { expiresIn: "7d" });
    const redirectUrl = `${FRONTEND_URL}/login-success?token=${encodeURIComponent(
      token
    )}&user=${encodeURIComponent(
      JSON.stringify({
        _id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
      })
    )}`;
    res.redirect(redirectUrl);
  }
);

// -------------------- PROFILE --------------------
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Database error" });
  }
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
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// -------------------- PRODUCTS --------------------
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ error: "Failed to fetch products." });
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

// -------------------- ADMIN PRODUCT CRUD --------------------
app.post("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.json(p);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(p);
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// -------------------- CART --------------------
app.get("/api/cart", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate("items.perfumeId");
    res.json(cart ? cart.items : []);
  } catch {
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

app.post("/api/cart", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body || {};
    if (!perfumeId || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid perfume or quantity" });
    }
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });
    const idx = cart.items.findIndex((i) => i.perfumeId.toString() === String(perfumeId));
    if (idx > -1) cart.items[idx].quantity = quantity;
    else cart.items.push({ perfumeId, quantity });
    await cart.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update cart" });
  }
});

app.delete("/api/cart/:perfumeId", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.items = cart.items.filter((i) => i.perfumeId.toString() !== String(req.params.perfumeId));
      await cart.save();
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

app.delete("/api/cart", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

// -------------------- CHECKOUT & ORDERS --------------------
app.post("/api/checkout", authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, paymentMethod } = req.body || {};
    if (!name || !address || !phone) {
      return res.status(400).json({ error: "Missing order details" });
    }
    let cart = await Cart.findOne({ userId: req.user.id }).populate("items.perfumeId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
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
      paymentMethod: paymentMethod || "cod",
      items,
      total,
    });
    await order.save();

    // decrement stock
    for (const it of cart.items) {
      if (it.perfumeId && typeof it.perfumeId.stock === "number") {
        await Product.findByIdAndUpdate(it.perfumeId._id, { $inc: { stock: -it.quantity } });
      }
    }

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

// -------------------- REVIEWS --------------------
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
    const reviews = await Review.find({ perfumeId: req.params.perfumeId }).populate("userId", "firstName lastName");
    res.json(reviews);
  } catch {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// -------------------- UTILITIES --------------------
app.post("/api/test-email", async (req, res) => {
  try {
    const { to } = req.body || {};
    await brevo.sendTransacEmail({
      sender: { name: "EYES Perfume", email: fromAddress() },
      to: [{ email: to || process.env.ADMIN_EMAIL }],
      subject: "Test Email - EYES Perfume",
      htmlContent: `<p>This is a test email confirming your Brevo setup works correctly.</p>`,
    });
    res.json({ ok: true, message: `Test email sent to ${to || process.env.ADMIN_EMAIL}` });
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Failed to send test email" });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS → http://localhost:${PORT}${admin.options.rootPath}`);
});
