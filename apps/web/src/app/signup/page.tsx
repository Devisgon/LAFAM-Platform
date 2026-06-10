"use client";
import React, { type FormEvent, useState } from 'react';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function RegisterScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('Sarah Sanctuary');
  const [email, setEmail] = useState('sarah@example.com');
  const [phone, setPhone] = useState('+1 (555) 000-0000');
  const [password, setPassword] = useState('password123');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  console.log('Registering with:', { name, email, phone, password, agreeToTerms });
};

  return (
    <div className="flex min-h-screen w-full relative lg:static font-sans antialiased text-text-primary transition-colors duration-300">
      
    

      <div 
        className="relative hidden lg:flex lg:w-[70%] flex-col items-center justify-center p-12 border-r border-text-secondary/10"
        style={{
          backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--background-secondary) 60%, transparent)), url('/signup_screen_bg_image.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
        }}
      >

        {/* Floating Narrative Typography Block */}
        <div className="relative z-10 flex w-full max-w-lg flex-col items-center justify-center text-center text-white px-6">
          <h1 className="font-serif text-5xl font-bold tracking-tight mb-4 drop-shadow-sm leading-tight">
            Begin Your <br /> Journey.
          </h1>
        
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form (30% width) */}
      <div className="relative z-10 flex w-full flex-col justify-center px-6 py-12 sm:px-16 lg:w-[30%] lg:bg-background lg:px-8 xl:px-12 ml-auto">
        
        {/* Mobile Branding Wrapper Card */}
        <div className="mx-auto w-full max-w-md bg-card-bg-primary/95 p-6 sm:p-10 lg:p-0 rounded-3xl lg:rounded-none shadow-xl lg:shadow-none border border-text-secondary/5 lg:border-none backdrop-blur-md lg:backdrop-blur-none">
          
          {/* Section Header Content */}
          <div className="mb-6 text-center lg:text-left">
            <span className="inline-block font-serif text-xl font-bold tracking-wider text-primary mb-2">
              LAFAM
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-text-primary mb-1.5">
              Create an Account
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Please fill in your details to get started.
            </p>
          </div>

          {/* Form container */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-xs font-semibold text-text-secondary">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-4 h-4 w-4 text-text-secondary/60" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary/60 lg:bg-background-primary py-3.5 pl-12 pr-4 text-sm text-text-primary placeholder-text-secondary/40 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Sarah Sanctuary"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 h-4 w-4 text-text-secondary/60" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary/60 lg:bg-background-primary py-3.5 pl-12 pr-4 text-sm text-text-primary placeholder-text-secondary/40 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="sarah@example.com"
                  required
                />
              </div>
            </div>

            {/* Phone Number Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-xs font-semibold text-text-secondary">
                Phone Number
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-4 h-4 w-4 text-text-secondary/60" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary/60 lg:bg-background-primary py-3.5 pl-12 pr-4 text-sm text-text-primary placeholder-text-secondary/40 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 h-4 w-4 text-text-secondary/60" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-background-primary/60 lg:bg-background-primary py-3.5 pl-12 pr-12 text-sm text-text-primary placeholder-text-secondary/40 outline-none transition-all border border-text-secondary/10 focus:border-primary/40 focus:bg-card-bg-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-text-secondary/60 hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Terms of Service Checkbox */}
            <div className="flex items-start gap-3 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-text-secondary/30 text-primary focus:ring-primary/30 accent-primary"
                required
              />
              <label htmlFor="terms" className="text-xs text-text-secondary leading-normal select-none">
                I agree to the{' '}
                <a href="#terms" className="font-medium text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </a>.
              </label>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-button-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-all hover:brightness-105 active:scale-[0.99] pt-2"
            >
              Create Account
            </button>
          </form>

          {/* Footer Backlink Reference */}
          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <a href="#signin" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </p>

        </div>
      </div>

    </div>
  );
}