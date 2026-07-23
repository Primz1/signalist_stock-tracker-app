import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AppEvent extends Document {
  type: string;
  symbol?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const EventSchema = new Schema<AppEvent>(
  {
    type: { type: String, required: true, index: true },
    symbol: { type: String, uppercase: true, trim: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

EventSchema.index({ type: 1, createdAt: -1 });

export const EventModel: Model<AppEvent> =
  (models?.AppEvent as Model<AppEvent>) || model<AppEvent>('AppEvent', EventSchema);

export const createEvent = async (data: { type: string; symbol?: string; payload: Record<string, unknown> }) => {
  return EventModel.create(data);
};
