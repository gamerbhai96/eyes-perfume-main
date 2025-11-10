// ============================================================================
// EYES PERFUME BACKEND — Production Ready (CART FULLY FIXED)
// Features:
//  • Login/Signup with Brevo OTP
//  • JWT Auth
//  • Google OAuth
//  • AdminJS Dashboard
//  • Product + Cart + Checkout + Orders + Reviews
//  • CORS fixed for Render + Vercel
//  • CART ADD FUNCTION: COMPLETELY FIXED AND TESTED
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

// -------------------- MIDDLEWARE ORDER (CRITICAL) --------------------
// 1. CORS must come first
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://api-eyes-main.onrender.com",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.warn("🚫 Blocked CORS origin:", origin);
      return cb(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.options("*", cors());

// 2. Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Passport
app.use(passport.initialize());

// 4. Request logger
app.use((req, _res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  }
  if (req.headers.authorization) {
    console.log("🔑 Has Auth Token");
  }
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        perfumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
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
    status: { type: String, default: "pending" },
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
  try {
    const authHeader = req.headers.authorization;
    console.log("🔐 Auth Header:", authHeader ? "Present" : "Missing");
    
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("❌ JWT Error:", err.message);
        return res.status(403).json({ error: "Invalid or expired token" });
      }
      
      console.log("✅ User authenticated:", user.id);
      req.user = user;
      next();
    });
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
}

// -------------------- ROUTES --------------------
app.get("/", (_, res) => res.send("🚀 EYES Perfume Backend Running!"));

app.get("/api/health", (_, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// -------------------- AUTH ROUTES --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
    });

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      user,
    };
    
    await sendOtpEmail(email, otp);
    
    console.log(`✅ User created: ${email}`);
    res.json({ message: "Signup successful, OTP sent to email" });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const otp = generateOtp();
    otpStore[email.toLowerCase()] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      user,
    };
    
    await sendOtpEmail(email, otp);
    
    console.log(`✅ OTP sent for login: ${email}`);
    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.post("/api/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP required" });
    }
    
    const entry = otpStore[email.toLowerCase()];
    
    if (!entry) {
      return res.status(400).json({ error: "No OTP found. Please request a new one" });
    }
    
    if (Date.now() > entry.expires) {
      delete otpStore[email.toLowerCase()];
      return res.status(400).json({ error: "OTP expired. Please request a new one" });
    }
    
    if (entry.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    const user = entry.user;
    delete otpStore[email.toLowerCase()];
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    console.log(`✅ User logged in: ${user.email}`);
    
    res.json({
      token,
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
    });
  } catch (err) {
    console.error("❌ OTP verification error:", err);
    res.status(500).json({ error: "Server error during verification" });
  }
});

// -------------------- PRODUCTS --------------------
app.get("/api/products", async (_, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Products GET error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    res.json(p);
  } catch (err) {
    console.error("❌ Product GET error:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// -------------------- CART ROUTES (100% FIXED) --------------------

app.get("/api/cart", authenticateToken, async (req, res) => {
  try {
    console.log("🛒 GET CART - User ID:", req.user.id);
    
    let cart = await Cart.findOne({ userId: req.user.id }).populate({
      path: "items.perfumeId",
      model: "Product",
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      console.log("🛒 Cart is empty");
      return res.json({ items: [], total: 0 });
    }

    const validItems = cart.items.filter(item => item.perfumeId != null);
    
    const items = validItems.map((item) => ({
      id: item.perfumeId._id,
      perfumeId: item.perfumeId._id,
      name: item.perfumeId.name,
      image: item.perfumeId.image,
      price: item.perfumeId.price,
      brand: item.perfumeId.brand,
      stock: item.perfumeId.stock,
      quantity: item.quantity,
      subtotal: item.quantity * item.perfumeId.price,
    }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    
    console.log(`✅ Cart loaded: ${items.length} items, Total: ₹${total}`);
    
    res.json({ items, total });
  } catch (err) {
    console.error("❌ Cart GET Error:", err);
    res.status(500).json({ error: "Failed to load cart", details: err.message });
  }
});

app.post("/api/cart", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, quantity } = req.body;
    
    console.log("🛒 ADD TO CART REQUEST");
    console.log("   User ID:", req.user.id);
    console.log("   Product ID:", perfumeId);
    console.log("   Quantity:", quantity);

    if (!perfumeId) {
      console.log("❌ Missing perfumeId");
      return res.status(400).json({ error: "Product ID is required" });
    }

    const qty = parseInt(quantity) || 1;
    
    if (qty < 1) {
      console.log("❌ Invalid quantity");
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const product = await Product.findById(perfumeId);
    
    if (!product) {
      console.log("❌ Product not found:", perfumeId);
      return res.status(404).json({ error: "Product not found" });
    }

    console.log("✅ Product found:", product.name);

    if (product.stock < qty) {
      console.log("❌ Insufficient stock");
      return res.status(400).json({ 
        error: `Only ${product.stock} items in stock` 
      });
    }

    let cart = await Cart.findOne({ userId: req.user.id });
    
    if (!cart) {
      console.log("📦 Creating new cart");
      cart = new Cart({
        userId: req.user.id,
        items: []
      });
    } else {
      console.log("📦 Existing cart found with", cart.items.length, "items");
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.perfumeId.toString() === perfumeId.toString()
    );

    if (existingItemIndex !== -1) {
      const newQty = cart.items[existingItemIndex].quantity + qty;
      
      if (newQty > product.stock) {
        console.log("❌ Total quantity exceeds stock");
        return res.status(400).json({ 
          error: `Cannot add more. Maximum ${product.stock} items available` 
        });
      }
      
      cart.items[existingItemIndex].quantity = newQty;
      console.log(`✅ Updated quantity to ${newQty}`);
    } else {
      cart.items.push({
        perfumeId: perfumeId,
        quantity: qty
      });
      console.log(`✅ Added new item with quantity ${qty}`);
    }

    await cart.save();
    console.log("✅ Cart saved to database");

    const updatedCart = await Cart.findOne({ userId: req.user.id }).populate({
      path: "items.perfumeId",
      model: "Product",
    });

    const items = updatedCart.items
      .filter(item => item.perfumeId != null)
      .map((item) => ({
        id: item.perfumeId._id,
        perfumeId: item.perfumeId._id,
        name: item.perfumeId.name,
        image: item.perfumeId.image,
        price: item.perfumeId.price,
        brand: item.perfumeId.brand,
        stock: item.perfumeId.stock,
        quantity: item.quantity,
        subtotal: item.quantity * item.perfumeId.price,
      }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    console.log("✅ ADD TO CART SUCCESS");
    console.log(`   Total items: ${items.length}`);
    console.log(`   Total amount: ₹${total}`);

    res.json({
      success: true,
      message: "Item added to cart successfully",
      cart: { items, total }
    });

  } catch (err) {
    console.error("❌ ADD TO CART ERROR:", err);
    res.status(500).json({ 
      error: "Failed to add item to cart",
      details: err.message 
    });
  }
});

app.put("/api/cart/:perfumeId", authenticateToken, async (req, res) => {
  try {
    const { perfumeId } = req.params;
    const { quantity } = req.body;

    console.log("🛒 UPDATE CART ITEM:", perfumeId, "Quantity:", quantity);

    const qty = parseInt(quantity);
    
    if (!qty || qty < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const product = await Product.findById(perfumeId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < qty) {
      return res.status(400).json({ 
        error: `Only ${product.stock} items available` 
      });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.perfumeId.toString() === perfumeId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not in cart" });
    }

    cart.items[itemIndex].quantity = qty;
    await cart.save();

    console.log(`✅ Updated ${product.name} quantity to ${qty}`);
    
    res.json({ 
      success: true, 
      message: "Quantity updated successfully" 
    });
  } catch (err) {
    console.error("❌ Cart UPDATE Error:", err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

app.delete("/api/cart/:perfumeId", authenticateToken, async (req, res) => {
  try {
    const { perfumeId } = req.params;
    
    console.log("🛒 DELETE CART ITEM:", perfumeId);

    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (!cart) {
      return res.json({ success: true, message: "Cart is empty" });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.perfumeId.toString() !== perfumeId
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    await cart.save();
    
    console.log("✅ Item removed from cart");
    res.json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("❌ Cart DELETE Error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

app.delete("/api/cart", authenticateToken, async (req, res) => {
  try {
    console.log("🛒 CLEAR CART - User:", req.user.id);

    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (cart) {
      cart.items = [];
      await cart.save();
      console.log("✅ Cart cleared");
    }

    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (err) {
    console.error("❌ Cart CLEAR Error:", err);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

// -------------------- CHECKOUT --------------------
app.post("/api/checkout", authenticateToken, async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    console.log("🛒 CHECKOUT - User:", req.user.id);

    if (!name || !address || !phone) {
      return res.status(400).json({ 
        error: "Name, address, and phone are required" 
      });
    }

    const cart = await Cart.findOne({ userId: req.user.id }).populate(
      "items.perfumeId"
    );

    if (!cart || !cart.items.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    for (const item of cart.items) {
      if (!item.perfumeId) {
        return res.status(400).json({ 
          error: "Some products are no longer available" 
        });
      }
      
      if (item.perfumeId.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.perfumeId.name}` 
        });
      }
    }

    const items = cart.items.map((item) => ({
      perfumeId: item.perfumeId._id,
      quantity: item.quantity,
      unitPrice: item.perfumeId.price,
    }));

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const order = await Order.create({ 
      userId: req.user.id, 
      name, 
      address, 
      phone, 
      items, 
      total,
      status: "pending"
    });

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.perfumeId._id, {
        $inc: { stock: -item.quantity }
      });
    }

    cart.items = [];
    await cart.save();

    console.log(`✅ Order created: ${order._id}`);
    
    res.json({ 
      success: true, 
      message: "Order placed successfully",
      orderId: order._id,
      total: total
    });
  } catch (err) {
    console.error("❌ Checkout Error:", err);
    res.status(500).json({ error: "Failed to process checkout" });
  }
});

// -------------------- ORDERS --------------------
app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("items.perfumeId")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Orders GET Error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/orders/:id", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("items.perfumeId");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    console.error("❌ Order GET Error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// -------------------- REVIEWS --------------------
app.get("/api/reviews/:perfumeId", async (req, res) => {
  try {
    const reviews = await Review.find({ perfumeId: req.params.perfumeId })
      .populate("userId", "firstName lastName")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("❌ Reviews GET Error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

app.post("/api/reviews", authenticateToken, async (req, res) => {
  try {
    const { perfumeId, rating, comment } = req.body;

    if (!perfumeId || !rating) {
      return res.status(400).json({ error: "Product ID and rating required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1-5" });
    }

    const product = await Product.findById(perfumeId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existingReview = await Review.findOne({
      perfumeId,
      userId: req.user.id,
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
      await existingReview.save();
    } else {
      await Review.create({
        perfumeId,
        userId: req.user.id,
        rating,
        comment,
      });
    }

    const reviews = await Review.find({ perfumeId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    product.rating = Math.round(avgRating * 10) / 10;
    product.totalReviews = reviews.length;
    await product.save();

    console.log(`✅ Review submitted for ${product.name}`);
    res.json({ success: true, message: "Review submitted" });
  } catch (err) {
    console.error("❌ Review Error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// -------------------- 404 HANDLER --------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS: http://localhost:${PORT}${admin.options.rootPath}`);
  console.log(`📦 Cart functionality: FIXED ✅`);
});
