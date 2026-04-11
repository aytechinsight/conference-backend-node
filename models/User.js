const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: { type: String },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
    },
    password: {
        type: String,
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'superadmin', 'reviewer 1', 'reviewer 2', 'technical reviewer'],
        default: 'user'
    },
    // Short sequential user ID embedded in article IDs (e.g. USR001)
    userId: {
        type: String,
        unique: true,
        sparse: true, // allows null for old records without a userId
    },
    googleId: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    // Profile fields
    profileComplete: { type: Boolean, default: false },
    photo: { type: String, default: '' },
    fullName: { type: String, default: '' },
    mobile: { type: String, default: '' },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pinCode: { type: String, default: '' },
        country: { type: String, default: '' },
    },
    newsletterOptOut: { type: Boolean, default: false },
}, { timestamps: true });


UserSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
