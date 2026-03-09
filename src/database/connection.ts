import mongoose from 'mongoose';
import { ENV } from '../config/env';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('⚠️  Running without database...');
  }
}