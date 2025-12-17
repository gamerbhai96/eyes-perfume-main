import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue without database connection');
    console.log('   Make sure MONGODB_URI in .env is correct and accessible');
    // Don't exit - allow server to start for development/testing
    return null;
  }
};

export default connectDatabase;
