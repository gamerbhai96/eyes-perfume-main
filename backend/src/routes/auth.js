import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendOtpEmail, generateOtp } from '../utils/email.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// In-memory OTP store (consider using Redis in production)
const otpStore = Object.create(null);

// Rate limiting for resend (prevent spam)
const resendCooldown = Object.create(null);
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
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

        const emailResult = await sendOtpEmail(email, otp);

        console.log(`✅ User created: ${email}`);

        if (!emailResult.success) {
            console.error('⚠️ Email failed but user created:', emailResult.error);
            // User is created, but email failed - still allow login with manual OTP check
            return res.json({
                message: 'Account created. Email sending failed - please try resending OTP.',
                emailError: true
            });
        }

        res.json({ message: 'Signup successful, OTP sent to email' });
    } catch (err) {
        console.error('❌ Signup error:', err);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const otp = generateOtp();
        otpStore[email.toLowerCase()] = {
            otp,
            expires: Date.now() + 5 * 60 * 1000,
            user,
        };

        const emailResult = await sendOtpEmail(email, otp);

        console.log(`✅ OTP sent for login: ${email}`);

        if (!emailResult.success) {
            console.error('⚠️ Email failed for login:', emailResult.error);
            return res.json({
                message: 'Login successful but email failed. Please try resending OTP.',
                emailError: true
            });
        }

        res.json({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const emailLower = email.toLowerCase();

        // Check cooldown to prevent spam
        const lastResend = resendCooldown[emailLower];
        if (lastResend && Date.now() - lastResend < RESEND_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastResend)) / 1000);
            return res.status(429).json({
                error: `Please wait ${remainingSeconds} seconds before requesting another OTP`,
                retryAfter: remainingSeconds
            });
        }

        // Check if there's an existing OTP entry (user is in login/signup flow)
        const existingEntry = otpStore[emailLower];

        if (!existingEntry) {
            // No pending OTP - user needs to login/signup first
            return res.status(400).json({ error: 'No pending verification. Please login or signup first.' });
        }

        // Generate new OTP
        const otp = generateOtp();
        otpStore[emailLower] = {
            ...existingEntry,
            otp,
            expires: Date.now() + 5 * 60 * 1000,
        };

        // Update cooldown
        resendCooldown[emailLower] = Date.now();

        // Send email
        await sendOtpEmail(email, otp);

        console.log(`✅ OTP resent to: ${email}`);
        res.json({
            message: 'New OTP sent to your email',
            cooldown: RESEND_COOLDOWN_MS / 1000
        });
    } catch (err) {
        console.error('❌ Resend OTP error:', err);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }

        const entry = otpStore[email.toLowerCase()];

        if (!entry) {
            return res.status(400).json({ error: 'No OTP found. Please request a new one' });
        }

        if (Date.now() > entry.expires) {
            delete otpStore[email.toLowerCase()];
            return res.status(400).json({ error: 'OTP expired. Please request a new one' });
        }

        if (entry.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        const user = entry.user;
        delete otpStore[email.toLowerCase()];
        delete resendCooldown[email.toLowerCase()]; // Clear cooldown on success

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ User logged in: ${user.email}`);

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
        });
    } catch (err) {
        console.error('❌ OTP verification error:', err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

export default router;
