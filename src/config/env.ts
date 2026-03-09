import dotenv from 'dotenv';
import path   from 'path';

// Try to load .env from multiple locations
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

// Hardcoded fallback so server always works
const FMP_KEY = process.env.FMP_API_KEY || 'zTIuEPRlxpxOT3Mi6BnHU4olSaItcaCD';
const FMP_URL = process.env.FMP_BASE_URL || 'https://financialmodelingprep.com/stable';

console.log(`[ENV] FMP_KEY: ${FMP_KEY.slice(0,8)}...`);
console.log(`[ENV] FMP_URL: ${FMP_URL}`);

export const ENV = {
  PORT:         parseInt(process.env.PORT || '3000'),
  MONGODB_URI:  process.env.MONGODB_URI  || '',
  FMP_API_KEY:  FMP_KEY,
  FMP_BASE_URL: FMP_URL,
};