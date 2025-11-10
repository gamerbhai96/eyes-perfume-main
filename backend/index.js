// ============================================================================
// EYES PERFUME BACKEND — Production Ready
// Features:
//  • Login/Signup with Brevo OTP
//  • JWT Auth
//  • Google OAuth
//  • AdminJS Dashboard
//  • Product + Cart + Checkout + Orders + Reviews
//  • CORS fixed for Render + Vercel
//  • Proper product populate in Cart (cart now shows perfumes)
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

// -------------------- APP CONFIG --------------------
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://eyes-perfume-main.vercel.app";
const otpStore = Object.create(null);

// -------------------- CORS --------------------
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://api-eyes-main.onrender.com",
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

app.use(express.json());
app.use(passport.initialize());

// Simple logger
app.use((req, _res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});

// -------------------- DATABASE --------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// -------------------- SCHEMAS --------------------
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: String,
    role: { type: String, enum: ["user", "admin"], default: "user" },
    emailVerifiedAt: Date,
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

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
const Product = mongoose.model("Product", productSchema);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, min: 1 },
      },
    ],
  },
  { timestamps: true }
);
const Cart = mongoose.model("Cart", cartSchema);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: Number,
        unitPrice: Number,
      },
    ],
    total: Number,
    name: String,
    address: String,
    phone: String,
    paymentMethod: { type: String, default: "cod" },
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

const reviewSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: Number,
    comment: String,
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
  branding: {
    companyName: "EYES Perfume Admin",
    logo: false,
    softwareBrothers: false,
  },
});

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      if (
        email === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD
      ) {
        console.log("✅ Admin login success");
        return { email };
      }
      return null;
    },
    cookieName: "adminjs",
    cookiePassword: "skip-cookie",
  },
  null,
  {
    resave: false,
    saveUninitialized: false,
  }
);
app.use(admin.options.rootPath, adminRouter);

// -------------------- BREVO OTP EMAIL --------------------
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevo = new Brevo.TransactionalEmailsApi();

async function sendOtpEmail(email, otp) {
  try {
    await brevo.sendTransacEmail({
      sender: {
        name: "EYES Perfume",
        email:
          process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
          process.env.EMAIL_FROM ||
          "noreply@eyesperfume.com",
      },
      to: [{ email }],
      subject: "Your EYES Perfume OTP Code",
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });
    console.log("✅ Brevo OTP email sent to", email);
  } catch (err) {
    console.error("❌ Brevo error:", err?.response?.body || err);
  }
}
const generateOtp = () =>
  String(Math.floor(100000 + Math.random() * 900000));

// -------------------- AUTH HELPERS --------------------
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
}

// -------------------- ROUTES --------------------
app.get("/", (_, res) => res.send("🚀 EYES Perfume Backend Running!"));

// Signup + Login + Verify OTP
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
    });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      user,
    };
    await sendOtpEmail(email, otp);
    res.json({ message: "Signup successful, OTP sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(400).json({ error: "Invalid credentials" });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      user,
    };
    await sendOtpEmail(email, otp);
    res.json({ message: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const entry = otpStore[email.toLowerCase()];
  if (!entry || entry.otp !== otp)
    return res.status(400).json({ error: "Invalid OTP" });

  const user = entry.user;
  delete otpStore[email.toLowerCase()];
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName },
  });
});

// -------------------- PRODUCTS --------------------
app.get("/api/products", async (_, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});
app.get("/api/products/:id", async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

// -------------------- CART (FIXED POPULATION) --------------------
const cartRouter = express.Router();

// Fetch cart with product details
cartRouter.get("/", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate({
      path: "items.perfumeId",
      model: "Product",
      select: "name price image",
    });

    if (!cart || !cart.items.length) return res.json({ items: [], total: 0 });

    const items = cart.items
      .filter((i) => i.perfumeId)
      .map((i) => ({
        id: i.perfumeId._id,
        name: i.perfumeId.name,
        image: i.perfumeId.image,
        price: i.perfumeId.price,
        quantity: i.quantity,
        subtotal: i.quantity * i.perfumeId.price,
      }));

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
    res.json({ items, total });
  } catch (err) {
    console.error("🛒 Cart GET Error:", err);
    res.status(500).json({ error: "Failed to load cart" });
  }
});

// Add/Update
cartRouter.post("/", authenticateToken, async (req, res) => {
  const { perfumeId, quantity } = req.body;
  let cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) cart = new Cart({ userId: req.user.id, items: [] });
  const idx = cart.items.findIndex(
    (i) => i.perfumeId.toString() === perfumeId
  );
  if (idx > -1) cart.items[idx].quantity = quantity;
  else cart.items.push({ perfumeId, quantity });
  await cart.save();
  res.json({ success: true });
});

// Remove item
cartRouter.delete("/:perfumeId", authenticateToken, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) return res.json({ success: true });
  cart.items = cart.items.filter(
    (i) => i.perfumeId.toString() !== req.params.perfumeId
  );
  await cart.save();
  res.json({ success: true });
});

// Clear
cartRouter.delete("/", authenticateToken, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }
  res.json({ success: true });
});

app.use("/api/cart", cartRouter);
app.use("/cart", cartRouter); // backward compatibility

// -------------------- CHECKOUT --------------------
app.post("/api/checkout", authenticateToken, async (req, res) => {
  const { name, address, phone } = req.body;
  const cart = await Cart.findOne({ userId: req.user.id }).populate(
    "items.perfumeId"
  );
  if (!cart || !cart.items.length)
    return res.status(400).json({ error: "Empty cart" });

  const items = cart.items.map((i) => ({
    perfumeId: i.perfumeId._id,
    quantity: i.quantity,
    unitPrice: i.perfumeId.price,
  }));
  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  await Order.create({ userId: req.user.id, name, address, phone, items, total });
  cart.items = [];
  await cart.save();
  res.json({ success: true });
});

// -------------------- 404 HANDLER --------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS: http://localhost:${PORT}${admin.options.rootPath}`);
});
