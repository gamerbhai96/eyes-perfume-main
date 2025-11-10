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
const otpStore = Object.create(null);

// -------------------- CORS --------------------
const allowedOrigins = [
  FRONTEND_URL,
  "https://api-eyes-main.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
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
    name: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: Number,
    image: String,
    images: [String],
    description: String,
    notes: [String],
    brand: String,
    category: String,
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    isRecent: Boolean,
    isBestseller: Boolean,
    stock: { type: Number, default: 100 },
    tags: [String],
  },
  { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    address: String,
    phone: String,
    status: {
      type: String,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    items: [
      {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: Number,
        unitPrice: Number,
      },
    ],
    total: Number,
    paymentMethod: String,
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    items: [
      {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: Number,
      },
    ],
  },
  { timestamps: true }
);
const Cart = mongoose.model("Cart", cartSchema);

const reviewSchema = new mongoose.Schema(
  {
    perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number, min: 1, max: 5 },
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
        return { email };
      }
      return null;
    },
    cookieName: "adminjs",
    cookiePassword: "skip-session",
  },
  null,
  { resave: false, saveUninitialized: false }
);
app.use(admin.options.rootPath, adminRouter);

// -------------------- BREVO EMAIL --------------------
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
if (!process.env.BREVO_API_KEY)
  console.error("❌ BREVO_API_KEY missing! Check Render vars.");
else console.log("✅ Brevo API key loaded.");
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevo = new Brevo.TransactionalEmailsApi();

function fromAddress() {
  return (
    process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
    process.env.EMAIL_FROM ||
    "noreply@eyesperfume.com"
  );
}
async function sendOtpEmail(email, otp) {
  try {
    const payload = {
      sender: { name: "EYES Perfume", email: fromAddress() },
      to: [{ email }],
      subject: "Your EYES Perfume OTP Code",
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    };
    console.log("📨 Sending Brevo OTP email to:", email);
    const res = await brevo.sendTransacEmail(payload);
    console.log("✅ Brevo email sent:", res.body || res);
  } catch (err) {
    console.error("❌ Brevo sendTransacEmail error:", err?.response?.body || err);
    throw err;
  }
}
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

// Health
app.get("/", (_, res) => res.send("🚀 EYES Perfume backend is running!"));

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required." });
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: "Email already exists." });

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
    res.json({ message: "Signup successful, OTP sent." });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(400).json({ error: "Invalid credentials." });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, user };
    await sendOtpEmail(email, otp);
    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("🔥 /api/login internal error:", err?.response?.body || err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Verify OTP
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const entry = otpStore[email?.toLowerCase()];
  if (!entry) return res.status(400).json({ error: "Invalid or expired OTP." });
  if (Date.now() > entry.expires) return res.status(400).json({ error: "OTP expired." });
  if (entry.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });

  const user = entry.user;
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  delete otpStore[email.toLowerCase()];
  res.json({
    token,
    user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
  });
});

// -------------------- CART (FIXED) --------------------
const cartRouter = express.Router();

cartRouter.get("/", authenticateToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate({
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
        subtotal: it.quantity * (it.perfumeId.price || 0),
      }));

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
    res.json({ items, total });
  } catch (err) {
    console.error("🛒 Cart GET Error:", err);
    res.status(500).json({ error: "Failed to load cart." });
  }
});

cartRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body;
    if (!perfumeId || !quantity || quantity < 1)
      return res.status(400).json({ error: "Invalid input" });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

    const index = cart.items.findIndex((i) => i.perfumeId.toString() === perfumeId);
    if (index >= 0) cart.items[index].quantity = quantity;
    else cart.items.push({ perfumeId, quantity });

    await cart.save();
    res.json({ success: true });
  } catch (err) {
    console.error("🛒 Cart POST Error:", err);
    res.status(500).json({ error: "Failed to update cart." });
  }
});

cartRouter.delete("/:perfumeId", authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.json({ success: true });

    cart.items = cart.items.filter(
      (i) => i.perfumeId.toString() !== req.params.perfumeId
    );
    await cart.save();
    res.json({ success: true });
  } catch (err) {
    console.error("🛒 Cart DELETE Error:", err);
    res.status(500).json({ error: "Failed to remove item." });
  }
});

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

app.use("/api/cart", cartRouter);
app.use("/cart", cartRouter);

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS: http://localhost:${PORT}${admin.options.rootPath}`);
});
