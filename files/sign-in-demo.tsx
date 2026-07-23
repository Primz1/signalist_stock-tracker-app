"use client";

import { SignInPage, Testimonial } from "@/components/ui/sign-in";

// Signalist testimonials — replace the generic placeholders with voices that
// match the audience: retail investors, options traders, long-term investors.
const signalistTestimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/34.jpg",
    name: "0xxghost",
    handle: "Retail investor",
    text: "The AI research catches things I'd miss. It's like having an analyst on call for every ticker in my watchlist.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Nadia Rehman",
    handle: "Options trader",
    text: "Charts are TradingView-grade, alerts hit my inbox in seconds, and paper trading is how I test every thesis.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/22.jpg",
    name: "Marco Alvarez",
    handle: "Long-term investor",
    text: "Watchlists, indicators, and AI signals in one place. I stopped juggling four apps the day I signed up.",
  },
];

const SignInPageDemo = () => {
  const handleSignIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    // Wire this up to your auth handler (NextAuth, Clerk, custom, etc.)
    console.log("Sign in submitted:", data);
  };

  const handleGoogleSignIn = () => {
    // Wire this up to your OAuth flow. If Google auth isn't implemented,
    // pass `showGoogleSignIn={false}` to hide the button entirely.
    console.log("Continue with Google clicked");
  };

  const handleResetPassword = () => {
    console.log("Reset password clicked");
  };

  const handleCreateAccount = () => {
    // e.g. router.push("/sign-up")
    console.log("Create account clicked");
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
        testimonials={signalistTestimonials}
        onSignIn={handleSignIn}
        onGoogleSignIn={handleGoogleSignIn}
        onResetPassword={handleResetPassword}
        onCreateAccount={handleCreateAccount}
      />
    </div>
  );
};

export default SignInPageDemo;
