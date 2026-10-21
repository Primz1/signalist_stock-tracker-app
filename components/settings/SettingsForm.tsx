'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import SelectField from '@/components/forms/SelectField';
import { INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from '@/lib/constants';
import { CountrySelectField } from '@/components/forms/CountrySelectField';
import { updateProfile } from '@/lib/actions/userProfile.actions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { PageEnter } from '@/components/ui/motion';

type ProfileForm = {
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
};

export default function SettingsForm({
  initialProfile,
}: {
  initialProfile: ProfileForm | null;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    defaultValues: initialProfile ?? {
      country: 'US',
      investmentGoals: 'Growth',
      riskTolerance: 'Medium',
      preferredIndustry: 'Technology',
    },
  });

  const onSubmit = async (data: ProfileForm) => {
    const res = await updateProfile(data);
    if (res.success) {
      toast.success('Profile updated');
    } else {
      toast.error(res.message);
    }
  };

  return (
    <PageEnter>
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
      <div className="mb-2">
        <h1 className="page-title">Settings</h1>
        <p className="page-lede">
          Your market and preferences. Research and AI scores use these to frame what they show
          you.
        </p>
      </div>

      <CountrySelectField name="country" label="Country" control={control} error={errors.country} required />
      <SelectField
        name="investmentGoals"
        label="Investment goal"
        placeholder="Select goals"
        options={INVESTMENT_GOALS}
        control={control}
        error={errors.investmentGoals}
        required
      />
      <SelectField
        name="riskTolerance"
        label="Risk tolerance"
        placeholder="Select risk"
        options={RISK_TOLERANCE_OPTIONS}
        control={control}
        error={errors.riskTolerance}
        required
      />
      <SelectField
        name="preferredIndustry"
        label="Preferred industry"
        placeholder="Select industry"
        options={PREFERRED_INDUSTRIES}
        control={control}
        error={errors.preferredIndustry}
        required
      />

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="yellow-btn"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Save changes'
        )}
      </Button>
    </form>
    </PageEnter>
  );
}
