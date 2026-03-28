const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

// --- Email Transporter ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- SEND OTP ---
exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const existingUser = await User.findOne({ email, isEmailVerified: true });
        if (existingUser) return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await User.findOneAndUpdate(
            { email },
            { email, otp, otpExpiry, isEmailVerified: false },
            { upsert: true, new: true }
        );

        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP for iCreate 2026 Registration',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #1e293b; margin-bottom: 8px;">iCreate 2026</h2>
                    <p style="color: #64748b; margin-bottom: 24px;">Use the OTP below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #0f172a;">
                        ${otp}
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you did not request this, you can safely ignore this email.</p>
                </div>
            `
        });

        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('sendOtp error:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- VERIFY OTP & REGISTER ---
exports.verifyOtpAndRegister = async (req, res) => {
    try {
        const { email, password, otp } = req.body;
        const user = await User.findOne({ email }).select('+otp +otpExpiry');

        if (!user || !user.otp) return res.status(400).json({ message: 'No OTP found for this email. Please request a new one.' });
        if (user.otpExpiry < new Date()) return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

        user.password = password;
        user.isEmailVerified = true;
        user.role = 'user';
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.status(201).json({
            _id: user._id,
            email: user.email,
            role: user.role,
            profileComplete: user.profileComplete,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('verifyOtpAndRegister error:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- LOGIN ---
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('+password');

        if (!user) return res.status(401).json({ message: 'Invalid email or password' });
        if (!user.password) return res.status(401).json({ message: 'This account uses Google Sign-In. Please use Google to log in.' });
        if (!user.isEmailVerified) return res.status(401).json({ message: 'Email not verified. Please register and verify your OTP first.' });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileComplete: user.profileComplete || false,
            photo: user.photo || '',
            fullName: user.fullName || '',
            mobile: user.mobile || '',
            address: user.address || {},
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- GOOGLE AUTH ---
exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
            // Link Google to existing account if needed
            if (!user.googleId) {
                user.googleId = googleId;
                user.isEmailVerified = true;
                if (!user.photo) user.photo = picture;
                await user.save();
            }
        } else {
            user = await User.create({
                googleId, email, name, photo: picture,
                isEmailVerified: true, role: 'user'
            });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileComplete: user.profileComplete,
            photo: user.photo,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('googleAuth error:', error);
        res.status(500).json({ message: 'Google authentication failed. ' + error.message });
    }
};

// --- UPDATE PROFILE ---
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, mobile, address, photo } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { fullName, mobile, address, photo: photo || '', profileComplete: true, name: fullName },
            { new: true }
        );
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileComplete: user.profileComplete,
            photo: user.photo,
            fullName: user.fullName,
            mobile: user.mobile,
            address: user.address,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- GET ME ---
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- FORGOT PASSWORD (send OTP) ---
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email, isEmailVerified: true });
        if (!user) return res.status(404).json({ message: 'No verified account found with this email.' });
        if (user.googleId && !user.password) return res.status(400).json({ message: 'This account uses Google Sign-In. Password reset is not available.' });

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Password Reset OTP — iCreate 2026',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                    <h2 style="color:#1e293b;margin-bottom:8px;">iCreate 2026 — Password Reset</h2>
                    <p style="color:#64748b;margin-bottom:24px;">Use this OTP to reset your password. It expires in <strong>10 minutes</strong>.</p>
                    <div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:bold;color:#0f172a;">${otp}</div>
                    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you did not request this, please ignore this email.</p>
                </div>`
        });

        res.json({ message: 'Password reset OTP sent to your email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- RESET PASSWORD (verify OTP + set new password) ---
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

        const user = await User.findOne({ email }).select('+otp +otpExpiry +password');
        if (!user || !user.otp) return res.status(400).json({ message: 'No reset request found. Please request a new OTP.' });
        if (user.otpExpiry < new Date()) return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

        user.password = newPassword; // pre-save hook will hash it
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
