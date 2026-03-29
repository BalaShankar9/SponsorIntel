'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('PASSWORDS DO NOT MATCH');
      return;
    }
    if (password.length < 8) {
      setError('PASSWORD MUST BE AT LEAST 8 CHARACTERS');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name);
      router.push('/login?registered=true');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'REGISTRATION FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-bg">
      <div className="w-full max-w-sm border border-amber/30 bg-s1 p-6">
        {/* Branding */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border border-amber bg-amber/10">
            <span className="font-data text-lg font-bold text-amber">SI</span>
          </div>
          <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
            SponsorIntel Terminal
          </h1>
          <p className="mt-1 font-data text-[10px] tracking-widest text-dim">
            CREATE YOUR TERMINAL ACCESS
          </p>
        </div>

        {/* Divider */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-s3" />
          <span className="font-data text-[9px] text-muted">NEW ACCOUNT</span>
          <div className="h-px flex-1 bg-s3" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-data text-[9px] uppercase tracking-wider text-dim">FULL NAME</label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-0.5 w-full border border-s3 bg-bg px-3 py-2 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
            />
          </div>
          <div>
            <label className="font-data text-[9px] uppercase tracking-wider text-dim">EMAIL</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-0.5 w-full border border-s3 bg-bg px-3 py-2 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
            />
          </div>
          <div>
            <label className="font-data text-[9px] uppercase tracking-wider text-dim">PASSWORD</label>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-0.5 w-full border border-s3 bg-bg px-3 py-2 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
            />
          </div>
          <div>
            <label className="font-data text-[9px] uppercase tracking-wider text-dim">CONFIRM PASSWORD</label>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-0.5 w-full border border-s3 bg-bg px-3 py-2 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
            />
          </div>
          {error && (
            <p className="font-data text-[10px] text-red">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber py-2 font-data text-xs font-bold uppercase tracking-wider text-bg transition-colors hover:bg-amber/80 disabled:opacity-50"
          >
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="mt-4 text-center font-data text-[10px] text-dim">
          ALREADY HAVE ACCESS?{' '}
          <Link href="/login" className="text-amber hover:underline">
            SIGN IN
          </Link>
        </p>
      </div>
    </div>
  );
}
