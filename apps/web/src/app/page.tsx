"use client";
import React, { type FormEvent, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('sarah@example.com');
  const [password, setPassword] = useState('password123');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  console.log('Logging in with:', { email, password });
};

  return (
    <div className="flex min-h-screen w-full bg-background font-sans antialiased text-text-primary transition-colors duration-300">
      
      <div 
        className="relative hidden w-2/2 flex-col items-center justify-center p-8 lg:flex border-r border-text-secondary/10"
        style={{
          backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, var(--primary) 30%, transparent), color-mix(in srgb, var(--background-secondary) 80%, transparent)), url('/login_screen_side_image.png')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      >

        <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-card-bg-primary/80 p-12 text-center shadow-xl backdrop-blur-md border border-text-secondary/10">
          <h1 className="font-serif text-5xl font-bold tracking-wide text-primary mb-4">
            LAFAM
          </h1>
          <p className="italic text-text-secondary text-lg font-medium">
            Elevate your practice. Nourish your soul.
          </p>
          
         
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form */}
      <div className="flex w-full flex-col justify-center bg-background px-6 py-12 sm:px-16 lg:w-1/2 lg:px-24 xl:px-32">
        <div className="mx-auto  w-full max-w-md">
          
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-4xl font-semibold tracking-tight text-text-primary mb-3">
              Welcome Back
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Sign in to book sessions, manage your wellness wallet, and access your profile.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email  */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 h-5 w-5 text-text-secondary/60" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary py-4 pl-12 pr-4 text-sm text-text-primary placeholder-text-secondary/50 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {/* Password  */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
                  Password
                </label>
                <a href="#forgot" className="text-xs font-semibold text-primary hover:underline">
                  Forgot Password?
                </a>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 h-5 w-5 text-text-secondary/60" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary py-4 pl-12 pr-12 text-sm text-text-primary placeholder-text-secondary/50 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-text-secondary/60 hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-4 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-all hover:brightness-110 active:scale-[0.99]"
            >
              Sign In
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-text-secondary/10"></div>
            </div>
            <span className="relative bg-background px-4 text-xs font-medium text-text-secondary">
              Or continue with
            </span>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-text-secondary/20 bg-card-bg-primary py-3.5 text-sm font-semibold text-text-primary transition-all hover:bg-background-primary active:scale-[0.98]">
              {/* Google Icon SVG */}
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.94 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.6 2.8C6.01 7.12 8.78 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.6 2.8c2.1-1.94 3.83-4.8 3.83-8.53z"/>
                <path fill="#FBBC05" d="M5.1 14.7c-.25-.76-.39-1.57-.39-2.4s.14-1.64.39-2.4L1.5 7.1C.54 9.03 0 11.19 0 13.5s.54 4.47 1.5 6.4l3.6-2.82z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.6-2.8c-1.1.74-2.52 1.18-4.36 1.18-3.22 0-5.99-2.08-6.96-5.26l-3.6 2.8C3.4 20.35 7.35 23 12 23z"/>
              </svg>
              Google
            </button>
            
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-text-secondary/20 bg-card-bg-primary py-3.5 text-sm font-semibold text-text-primary transition-all hover:bg-background-primary active:scale-[0.98]">
              {/* Apple Icon SVG configured to respect theme color updates */}
              <svg className="h-4 w-4 text-text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Footer Sign Up */}
          <p className="mt-10 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <a href="#signup" className="font-semibold text-primary hover:underline">
              Sign Up
            </a>
          </p>

        </div>
      </div>

    </div>
  );
}