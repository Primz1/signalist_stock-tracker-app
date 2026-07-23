import { getProfile } from '@/lib/actions/userProfile.actions';
import SettingsForm from '@/components/settings/SettingsForm';

export default async function SettingsPage() {
  const res = await getProfile();
  const profile =
    res.success && res.data
      ? (res.data as {
          country: string;
          investmentGoals: string;
          riskTolerance: string;
          preferredIndustry: string;
        })
      : null;

  return <SettingsForm initialProfile={profile} />;
}
