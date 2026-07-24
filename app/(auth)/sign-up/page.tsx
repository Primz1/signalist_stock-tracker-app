'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import SelectField from '@/components/forms/SelectField';
import { INVESTMENT_GOALS, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from '@/lib/constants';
import { CountrySelectField } from '@/components/forms/CountrySelectField';
import FooterLinks from '@/components/forms/FooterLinks';
import { signUpWithEmail } from '@/lib/actions/auth.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const SignUp = () => {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      country: 'US',
      investmentGoals: 'Growth',
      riskTolerance: 'Medium',
      preferredIndustry: 'Technology',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      const result = await signUpWithEmail(data);
      if (result.success) {
        toast.success('Account created! Check your email for the verification link.');
        router.push('/sign-in?verify=1');
        return;
      }

      toast.error('Sign Up failed', {
        description: result.message || 'Failed to create an account.',
      });
    } catch (e) {
      console.error(e);
      toast.error('Sign Up failed', {
        description: e instanceof Error ? e.message : 'Failed to create an account.',
      });
    }
  };

  return (
    <>
      <h1 className="form-title animate-el" style={{ animationDelay: '100ms' }}>
        Create your account
      </h1>
      <p
        className="mb-7 animate-el text-sm text-[#A1A1A1]"
        style={{ animationDelay: '160ms' }}
      >
        Signalist personalizes signals based on your goals.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div
          className="animate-el text-[12px] font-medium uppercase tracking-wide text-[#6E6E6E]"
          style={{ animationDelay: '200ms' }}
        >
          Account
        </div>
        <InputField
          name="fullName"
          label="Full name"
          placeholder="Jane Trader"
          register={register}
          error={errors.fullName}
          className="animate-el"
          validation={{ required: 'Full name is required', minLength: 2 }}
        />
        <InputField
          name="email"
          label="Email address"
          placeholder="Enter your email address"
          register={register}
          error={errors.email}
          className="animate-el"
          validation={{
            required: 'Email is required',
            pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' },
          }}
        />
        <InputField
          name="password"
          label="Password"
          placeholder="Enter your password"
          type="password"
          register={register}
          error={errors.password}
          className="animate-el"
          validation={{ required: 'Password is required', minLength: 8 }}
        />

        <div className="animate-el space-y-4 border-t border-[#242424] pt-4" style={{ animationDelay: '360ms' }}>
          <div className="text-[12px] font-medium uppercase tracking-wide text-[#6E6E6E]">
            Market
          </div>
          <CountrySelectField
            name="country"
            label="Country"
            control={control}
            error={errors.country}
            required
          />
        </div>

        <div className="animate-el space-y-4 border-t border-[#242424] pt-4" style={{ animationDelay: '420ms' }}>
          <div className="text-[12px] font-medium uppercase tracking-wide text-[#6E6E6E]">
            Preferences
          </div>
          <SelectField
            name="investmentGoals"
            label="Investment goals"
            placeholder="Select your investment goal"
            options={INVESTMENT_GOALS}
            control={control}
            error={errors.investmentGoals}
            required
          />
          <SelectField
            name="riskTolerance"
            label="Risk tolerance"
            placeholder="Select your risk level"
            options={RISK_TOLERANCE_OPTIONS}
            control={control}
            error={errors.riskTolerance}
            required
          />
          <SelectField
            name="preferredIndustry"
            label="Preferred industry"
            placeholder="Select your preferred industry"
            options={PREFERRED_INDUSTRIES}
            control={control}
            error={errors.preferredIndustry}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="yellow-btn mt-2 w-full animate-el"
          style={{ animationDelay: '500ms' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>

        <div className="animate-el" style={{ animationDelay: '560ms' }}>
          <FooterLinks text="Already have an account?" linkText="Sign in" href="/sign-in" />
        </div>
      </form>
    </>
  );
};

export default SignUp;
