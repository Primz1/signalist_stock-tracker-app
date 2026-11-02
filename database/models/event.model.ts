import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AppEvent extends Document {
  type: string;
  symbol?: string;
  /** Set on private events. Events without it are public to anyone tracking the symbol. */
  userId?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

const EventSchema = new Schema<AppEvent>(
  {
    type: { type: String, required: true, index: true },
    symbol: { type: String, uppercase: true, trim: true, index: true },
    userId: { type: String },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date },
  },
  { timestamps: false }
);

EventSchema.index({ type: 1, createdAt: -1 });
EventSchema.index({ symbol: 1, _id: -1 });
EventSchema.index({ userId: 1, _id: -1 });
// Separate field: createdAt already has a plain index, and adding a TTL to it would conflict
EventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EventModel: Model<AppEvent> =
  (models?.AppEvent as Model<AppEvent>) || model<AppEvent>('AppEvent', EventSchema);

export const createEvent = async (data: {
  type: string;
  symbol?: string;
  userId?: string;
  payload: Record<string, unknown>;
  expiresAt?: Date;
}) => {
  return EventModel.create(data);
};
