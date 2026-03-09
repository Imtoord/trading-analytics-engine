import mongoose, { Schema, Document } from 'mongoose';

export interface ICandle extends Document {
  symbol:    string;
  timeframe: string;
  time:      string;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

const CandleSchema = new Schema<ICandle>({
  symbol:    { type: String, required: true, index: true },
  timeframe: { type: String, required: true },
  time:      { type: String, required: true },
  open:      Number,
  high:      Number,
  low:       Number,
  close:     Number,
  volume:    { type: Number, default: 0 },
});

CandleSchema.index({ symbol: 1, timeframe: 1, time: 1 }, { unique: true });

export const Candle = mongoose.model<ICandle>('Candle', CandleSchema);