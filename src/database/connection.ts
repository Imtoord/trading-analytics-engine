import mongoose from 'mongoose';
import dns      from 'dns';
import { ENV } from '../config/env';

// Node.js ≥19 has a known issue resolving MongoDB Atlas SRV records via the
// system DNS (127.0.0.53 on some setups). Force Cloudflare DNS to fix it.
dns.setServers(['1.1.1.1', '8.8.8.8']);

export async function connectDatabase(): Promise<void> {
  if (!ENV.MONGODB_URI) {
    console.log('⚠️  MONGODB_URI not set — running without database.');
    return;
  }
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('⚠️  Running without database...');
  }
}

