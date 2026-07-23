'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLinks from '@/components/forms/FooterLinks';
import { signInWithEmail } from '@/lib/actions/auth.actions';
import { toast } from 'sonner';
import { useState } from 'react';
import { X } from 'lucide-react';

const SignIn = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showBanner, setShowBanner] = useState(!!searchParams?.get('verify'));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      const result = await signInWithEmail(data);
      if (result.success) {
        router.push('/');
        return;
      }

      const description = result.message || 'Please try again.';
      toast.error('Sign in failed', { description });

      if (description.toLowerCase().includes('verify')) {
        toast.info('Check your email inbox (and spam folder) for the verification link we sent you.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Sign In failed', {
        description: e instanceof Error ? e.message : 'Failed to Sign In.',
      });
    }
  };

  return (
    <>
      <h1 className="form-title">Welcome back</h1>
      <p className="mb-7 text-sm text-[#A1A1A1]">
        Sign in to keep tracking your signals — charts, AI research, and price alerts.
      </p>

      {showBanner && (
        <div className="mb-5 flex items-start justify-between gap-2 rounded-xl border border-[rgba(253,212,88,0.4)] bg-[rgba(253,212,88,0.1)] px-3.5 py-3">
          <div className="text-[13px] text-[#F5F5F5]">
            Check your inbox — verify your email to unlock alerts.
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowBanner(false)}
            className="flex-none p-0.5 text-[#A1A1A1] hover:text-[#F5F5F5]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          name="email"
          label="Email address"
          placeholder="Enter your email address"
          register={register}
          error={errors.email}
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
          validation={{ required: 'Password is required', minLength: 8 }}
        />

        <Button type="submit" disabled={isSubmitting} className="yellow-btn mt-2 w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <FooterLinks text="Don't have an account?" linkText="Sign up" href="/sign-up" />
      </form>
    </>
  );
};

export default SignIn;
