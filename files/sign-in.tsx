"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// ---------------------------------------------------------------------------
// Signalist sign-in page — adapted from a 21st.dev pattern.
// Placeholders swapped: violet → amber (via shadcn --primary), generic copy →
// Signalist copy, generic testimonials → Signalist testimonials in the demo file.
// Uses shadcn semantic tokens throughout so it picks up the theme automatically.
// ---------------------------------------------------------------------------

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 48 48"
    aria-hidden
  >
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

// --- Types ---

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

export interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  showGoogleSignIn?: boolean;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

// --- Sub-components ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/60 focus-within:bg-primary/10">
    {children}
  </div>
);

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial;
  delay: string;
}) => (
  <div
    className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl border border-white/10 bg-zinc-900/40 p-5 w-64 shadow-2xl backdrop-blur-xl`}
  >
    <img
      src={testimonial.avatarSrc}
      className="h-10 w-10 rounded-2xl object-cover"
      alt={`${testimonial.name} avatar`}
    />
    <div className="text-sm leading-snug">
      <p className="font-medium text-foreground">{testimonial.name}</p>
      <p className="text-muted-foreground">{testimonial.handle}</p>
      <p className="mt-1 text-foreground/80">{testimonial.text}</p>
    </div>
  </div>
);

// --- Main component ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = (
    <span className="font-light tracking-tighter text-foreground">
      Welcome back
    </span>
  ),
  description = "Sign in to keep tracking your signals — real-time charts, AI research, and price alerts.",
  heroImageSrc,
  testimonials = [],
  showGoogleSignIn = true,
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background font-geist text-foreground md:flex-row">
      {/* Left column — form */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
        {/* Subtle radial amber wash behind the form */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, hsl(var(--primary) / 0.08), transparent 70%)",
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">
              {description}
            </p>

            <form className="space-y-5" onSubmit={onSignIn}>
              <div className="animate-element animate-delay-300">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Email address
                </label>
                <GlassInputWrapper>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Password
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="custom-checkbox"
                  />
                  <span className="text-foreground/90">Keep me signed in</span>
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onResetPassword?.();
                  }}
                  className="text-primary transition-colors hover:underline"
                >
                  Reset password
                </a>
              </div>

              <button
                type="submit"
                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in
              </button>
            </form>

            {showGoogleSignIn && (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-border" />
                  <span className="absolute bg-background px-4 text-sm text-muted-foreground">
                    Or continue with
                  </span>
                </div>

                <button
                  onClick={onGoogleSignIn}
                  className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </>
            )}

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              New to Signalist?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onCreateAccount?.();
                }}
                className="text-primary transition-colors hover:underline"
              >
                Create account
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Right column — hero image + floating testimonials */}
      {heroImageSrc && (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 overflow-hidden rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          >
            {/* Amber wash so any photo reads Signalist-branded */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.18), transparent 45%, hsl(24 95% 53% / 0.14))",
              }}
            />
            {/* Bottom darkening so testimonial cards stay readable */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
            />
          </div>

          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
              <TestimonialCard
                testimonial={testimonials[0]}
                delay="animate-delay-1000"
              />
              {testimonials[1] && (
                <div className="hidden xl:flex">
                  <TestimonialCard
                    testimonial={testimonials[1]}
                    delay="animate-delay-1200"
                  />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden 2xl:flex">
                  <TestimonialCard
                    testimonial={testimonials[2]}
                    delay="animate-delay-1400"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
