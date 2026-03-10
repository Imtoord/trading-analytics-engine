import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[ENV] Missing required environment variable: ${key}`);
  return val;
}

export const ENV = {
  PORT:         parseInt(process.env.PORT || '3000'),
  MONGODB_URI:  process.env.MONGODB_URI  || '',
  FMP_API_KEY:  requireEnv('FMP_API_KEY'),
  FMP_BASE_URL: process.env.FMP_BASE_URL || '',
  FMP_V3_URL:   process.env.FMP_V3_URL   || '',
};

console.log(`[ENV] PORT=${ENV.PORT}  FMP_KEY=${ENV.FMP_API_KEY.slice(0, 8)}...  FMP_URL=${ENV.FMP_BASE_URL}`);
