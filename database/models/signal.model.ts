import { Schema, model, models, type Document, type Model } from 'mongoose';
import {
  SIGNAL_DIRECTIONS,
  SIGNAL_STATUSES,
  SIGNAL_TYPES,
  type EvidenceItem,
  type MarketContextClass,
  type Provenance,
  type ScoreComponents,
  type Severity,
  type SignalDirection,
  type SignalStatus,
  type SignalType,
} from '@/lib/intelligence/types';

export type SignalHistoryEntry = { status: SignalStatus; at: Date; note: string };

export interface SignalDoc extends Document {
  signalId: string;
  symbol: string;
  assetType: 'stock' | 'etf' | 'crypto';
  type: SignalType;
  direction: SignalDirection;
  /** 0-100: how large the move is. */
  strength: number;
  /** 0-100: how much independent evidence agrees. Separate from strength on purpose. */
  confidence: number;
  severity: Severity;
  status: SignalStatus;
  components: ScoreComponents;
  evidence: EvidenceItem[];
  relatedEvents: string[];
  /** Price level the signal depends on, e.g. the broken resistance. Crossing back invalidates it. */
  keyLevel?: number;
  context: MarketContextClass;
  provenance: Provenance;
  history: SignalHistoryEntry[];
  startedAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  aiExplanation?: string;
  aiGeneratedAt?: Date;
  /** False when the explanation is deterministic fallback copy. */
  aiValidated?: boolean;
  /** Engine state, kept so the next run continues the same signal. */
  side: 'up' | 'down' | 'neutral';
  peakStrength: number;
  lastSupportAt: Date;
  supportingTypes: string[];
  contradictingTypes: string[];
}

const SignalSchema = new Schema<SignalDoc>(
  {
    signalId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    assetType: { type: String, required: true, enum: ['stock', 'etf', 'crypto'] },
    type: { type: String, required: true, enum: SIGNAL_TYPES },
    direction: { type: String, required: true, enum: SIGNAL_DIRECTIONS },
    strength: { type: Number, required: true, min: 0, max: 100 },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    status: { type: String, required: true, enum: SIGNAL_STATUSES },
    components: { type: Schema.Types.Mixed, default: {} },
    evidence: { type: Schema.Types.Mixed, default: [] },
    relatedEvents: { type: [String], default: [] },
    keyLevel: { type: Number },
    context: { type: String, default: 'unknown' },
    provenance: { type: Schema.Types.Mixed, required: true },
    history: { type: Schema.Types.Mixed, default: [] },
    startedAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    endedAt: { type: Date },
    aiExplanation: { type: String },
    aiGeneratedAt: { type: Date },
    aiValidated: { type: Boolean },
    side: { type: String, required: true, enum: ['up', 'down', 'neutral'] },
    peakStrength: { type: Number, required: true },
    lastSupportAt: { type: Date, required: true },
    supportingTypes: { type: [String], default: [] },
    contradictingTypes: { type: [String], default: [] },
  },
  { timestamps: false }
);

SignalSchema.index({ symbol: 1, status: 1, updatedAt: -1 });
SignalSchema.index({ updatedAt: -1 });
SignalSchema.index({ status: 1, updatedAt: -1 });

export const SignalModel: Model<SignalDoc> =
  (models?.Signal as Model<SignalDoc>) || model<SignalDoc>('Signal', SignalSchema);

export const OPEN_SIGNAL_STATUSES: SignalStatus[] = ['DETECTED', 'ACTIVE', 'WEAKENING'];
