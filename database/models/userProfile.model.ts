import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface UserProfile extends Document {
  userId: string;
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<UserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    country: { type: String, required: true, trim: true },
    investmentGoals: { type: String, required: true, trim: true },
    riskTolerance: { type: String, required: true, trim: true },
    preferredIndustry: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const UserProfileModel: Model<UserProfile> =
  (models?.UserProfile as Model<UserProfile>) || model<UserProfile>('UserProfile', UserProfileSchema);

export const upsertUserProfile = async (params: {
  userId: string;
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
}) => {
  return UserProfileModel.findOneAndUpdate(
    { userId: params.userId },
    { $set: params },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

export const getUserProfile = async (userId: string) => {
  return UserProfileModel.findOne({ userId }).lean();
};
