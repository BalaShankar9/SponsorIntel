'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'LOGIN FAILED');
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
            UK SPONSORSHIP INTELLIGENCE PLATFORM
          </p>
        </div>

        {/* Divider */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-s3" />
          <span className="font-data text-[9px] text-muted">AUTHENTICATE</span>
          <div className="h-px flex-1 bg-s3" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
          </button>
        </form>

        <p className="mt-4 text-center font-data text-[10px] text-dim">
          NO ACCOUNT?{' '}
          <Link href="/register" className="text-amber hover:underline">
            REGISTER
          </Link>
        </p>
      </div>
    </div>
  );
}
