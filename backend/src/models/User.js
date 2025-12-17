import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        firstName: String,
        lastName: String,
        email: { type: String, required: true, unique: true, lowercase: true },
        passwordHash: String,
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
        emailVerifiedAt: Date,
    },
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
