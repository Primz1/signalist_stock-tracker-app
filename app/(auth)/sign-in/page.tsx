'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLinks from '@/components/forms/FooterLinks';
import { Alert } from '@/components/ui/alert';
import { signInWithEmail } from '@/lib/actions/auth.actions';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

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
        const callback = searchParams?.get('callbackUrl');
        router.push(callback && callback.startsWith('/') ? callback : '/dashboard');
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
      <h1 className="form-title animate-el" style={{ animationDelay: '100ms' }}>
        Welcome back
      </h1>
      <p
        className="mb-8 animate-el text-[15px] leading-6 text-ink-2"
        style={{ animationDelay: '160ms' }}
      >
        Sign in to keep tracking your signals — charts, AI research, and price alerts.
      </p>

      {showBanner && (
        <Alert
          variant="warning"
          className="mb-5 animate-el"
          style={{ animationDelay: '200ms' }}
          action={
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setShowBanner(false)}
              className="flex-none p-0.5 text-ink-2 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          }
        >
          Check your inbox — verify your email to unlock alerts.
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          name="email"
          label="Email address"
          placeholder="Enter your email address"
          register={register}
          error={errors.email}
          className="animate-el"
          style={{ animationDelay: '260ms' }}
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
          style={{ animationDelay: '340ms' }}
          validation={{ required: 'Password is required', minLength: 8 }}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="yellow-btn mt-3 w-full animate-el"
          style={{ animationDelay: '420ms' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        <div className="animate-el" style={{ animationDelay: '500ms' }}>
          <FooterLinks text="Don't have an account?" linkText="Sign up" href="/sign-up" />
        </div>
      </form>
    </>
  );
};

export default SignIn;
