# UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the SponsorIntel frontend from a functional prototype into an addictive "Bloomberg of Immigration" intelligence terminal with micro-interactions, personalization, power-user features, community layer, and gamification.

**Architecture:** Dark terminal theme with real-time Supabase subscriptions, personalized dashboard sections, command palette, community ratings, gamification system. All new database tables created via Supabase SQL migration. Frontend is Next.js 14 with Tailwind + Recharts + Lucide icons. Backend is FastAPI with async SQLAlchemy.

**Tech Stack:** Next.js 14, Tailwind CSS, Supabase Realtime, Recharts, Lucide React, FastAPI, Celery, PostgreSQL, Zustand

---

## Phase 1: Core UX (Tasks 1-10)

### Task 1: Update Tailwind Config with Design Token System

**Files:**
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1 (3 min):** Replace the entire `tailwind.config.ts` with the spec's design token system. This adds: amber/cyan sub-tokens (dim, glow), font-size tokens (4xs-2xs), spacing aliases, box-shadows (glow-*), z-index scale, transition durations/easing, and all new keyframe/animation definitions.

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        s1: '#111111',
        s2: '#1a1a1a',
        s3: '#222222',
        s4: '#2a2a2a',
        border: '#2a2a2a',
        'border-hover': 'rgba(255,255,255,0.20)',
        'border-focus': '#00e5ff',
        text: '#e0e0e0',
        dim: '#888888',
        muted: '#555555',
        faint: 'rgba(255,255,255,0.10)',
        amber: {
          DEFAULT: '#f5a623',
          dim: 'rgba(245,166,35,0.15)',
          glow: 'rgba(245,166,35,0.30)',
        },
        cyan: {
          DEFAULT: '#00e5ff',
          dim: 'rgba(0,229,255,0.15)',
          glow: 'rgba(0,229,255,0.30)',
        },
        green: '#00d4aa',
        red: '#ff4757',
        blue: '#4a9eff',
        purple: '#a78bfa',
        accent: '#4a9eff',
        accent2: '#f5a623',
        orange: '#f5a623',
        yellow: '#f5a623',
        pink: '#a78bfa',
      },
      fontSize: {
        '4xs': ['0.5rem', { lineHeight: '1.2', letterSpacing: '0.2em' }],
        '3xs': ['0.5625rem', { lineHeight: '1.2', letterSpacing: '0.15em' }],
        '2xs': ['0.625rem', { lineHeight: '1.2', letterSpacing: '0.05em' }],
      },
      fontFamily: {
        data: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
        ui: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      spacing: {
        'sidebar-collapsed': '48px',
        'sidebar-expanded': '200px',
        'topbar-h': '40px',
        'ticker-h': '28px',
      },
      boxShadow: {
        'glow-amber': '0 0 20px rgba(245,166,35,0.08)',
        'glow-cyan': '0 0 15px rgba(0,229,255,0.10)',
        'glow-green': '0 0 12px rgba(0,212,170,0.10)',
        'glow-red': '0 0 12px rgba(255,71,87,0.10)',
      },
      zIndex: {
        'base': '0',
        'elevated': '10',
        'dropdown': '20',
        'sidebar': '30',
        'overlay': '40',
        'modal': '50',
        'hover-preview': '90',
        'command-palette': '100',
        'toast': '110',
        'tooltip': '120',
      },
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
        'slower': '500ms',
        'slowest': '1000ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-smooth': 'cubic-bezier(0.45, 0, 0.55, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'ticker-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.2)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(245, 166, 35, 0.15)' },
        },
        'pulse-glow-cyan': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 229, 255, 0.2)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(0, 229, 255, 0.15)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'data-flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'card-hover-lift': {
          '0%': { transform: 'translateY(0)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
          '100%': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
        },
        'new-item-flash': {
          '0%': { boxShadow: '0 0 0 0 rgba(0,229,255,0.4)' },
          '50%': { boxShadow: '0 0 16px 4px rgba(0,229,255,0.15)' },
          '100%': { boxShadow: '0 0 0 0 rgba(0,229,255,0)' },
        },
        'radar-draw': {
          '0%': { strokeDashoffset: '300', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { strokeDashoffset: '0', opacity: '1' },
        },
        'number-counter': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
          '60%': { opacity: '1', transform: 'translateY(-1px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-exit': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-4px)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.04' },
          '50%': { opacity: '0.08' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'background-radar': {
          '0%': { transform: 'scale(0)', opacity: '0.03' },
          '50%': { opacity: '0.015' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        fadeOut: 'fadeOut 200ms ease-out',
        slideInUp: 'slideInUp 200ms ease-out',
        slideInDown: 'slideInDown 200ms ease-out',
        slideInLeft: 'slideInLeft 200ms ease-out',
        slideInRight: 'slideInRight 200ms ease-out',
        'ticker-scroll': 'ticker-scroll 40s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-glow-cyan': 'pulse-glow-cyan 2s ease-in-out infinite',
        'count-up': 'count-up 300ms ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'data-flash': 'data-flash 0.4s ease-out',
        'card-hover-lift': 'card-hover-lift 200ms ease-out forwards',
        'new-item-flash': 'new-item-flash 1s ease-out',
        'radar-draw': 'radar-draw 1000ms ease-out forwards',
        'number-counter': 'number-counter 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'stagger-in': 'stagger-in 300ms ease-out both',
        'page-enter': 'page-enter 300ms ease-out',
        'page-exit': 'page-exit 200ms ease-in',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'background-radar': 'background-radar 60s ease-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2 (2 min):** Verify the build compiles with the new config.

```bash
cd frontend && npx tailwindcss --content './src/**/*.tsx' --output /dev/null 2>&1 | head -5
# Expected: no errors
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/tailwind.config.ts
git commit -m "feat(ui): update tailwind config with full design token system

Adds amber/cyan sub-tokens, font-size tokens (4xs-2xs), glow shadows,
z-index scale, transition durations/easings, and 20+ new keyframe animations
per the UI/UX overhaul spec."
```

---

### Task 2: Create `user_profiles` Table (Supabase SQL Migration)

**Files:**
- Create: `supabase/migrations/20260323000001_user_profiles.sql`

- [ ] **Step 1 (3 min):** Write the migration SQL file. This creates the `user_profiles` table and its RLS policies.

```sql
-- supabase/migrations/20260323000001_user_profiles.sql
-- User profile for dashboard personalization (visa route, target industries, locations)

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    visa_route VARCHAR(100),
    target_industries TEXT[],
    target_locations TEXT[],
    current_status VARCHAR(100) CHECK (
        current_status IN (
            'outside_uk',
            'uk_different_visa',
            'uk_graduate',
            'uk_sponsored',
            'uk_citizen_pr',
            'other'
        )
    ),
    nationality VARCHAR(100),
    setup_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only manage their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
    ON user_profiles FOR ALL
    USING (auth.uid() = user_id);

-- Allow service role full access (for backend writes)
CREATE POLICY "Service role manages profiles"
    ON user_profiles FOR ALL
    USING (true);

COMMENT ON TABLE user_profiles IS 'User preferences for personalized dashboard, intel relevance scoring, and route-specific data.';
```

- [ ] **Step 2 (2 min):** Apply the migration via Supabase CLI.

```bash
cd supabase && npx supabase db push
# Expected: "Applied migration 20260323000001_user_profiles.sql"
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add supabase/migrations/20260323000001_user_profiles.sql
git commit -m "feat(db): create user_profiles table with RLS

Stores visa route, target industries, target locations, current status,
and nationality for dashboard personalization."
```

---

### Task 3: Create `saved_searches` Table (Supabase SQL Migration)

**Files:**
- Create: `supabase/migrations/20260323000002_saved_searches.sql`

- [ ] **Step 1 (3 min):** Write the migration SQL file.

```sql
-- supabase/migrations/20260323000002_saved_searches.sql
-- Saved search filters with new-result detection

CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    filters JSONB NOT NULL,
    result_count_at_save INTEGER,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saved_searches_user
    ON saved_searches (user_id, created_at DESC);

-- RLS: users can only manage their own searches
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own searches"
    ON saved_searches FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages searches"
    ON saved_searches FOR ALL
    USING (true);

COMMENT ON TABLE saved_searches IS 'User-pinned search filter sets with new-result detection via result_count_at_save delta.';
```

- [ ] **Step 2 (2 min):** Apply the migration.

```bash
cd supabase && npx supabase db push
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add supabase/migrations/20260323000002_saved_searches.sql
git commit -m "feat(db): create saved_searches table with RLS

Stores named filter sets per user. Supports new-result detection
via result_count_at_save delta comparison."
```

---

### Task 4: Profile Setup API + Backend Route

**Files:**
- Create: `backend/app/api/v1/profile.py`
- Modify: `backend/app/main.py` (register router)

- [ ] **Step 1 (5 min):** Create the profile API router with `POST /profile/setup` and `GET /profile` endpoints.

```python
"""
User profile API endpoints for dashboard personalization.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileSetup(BaseModel):
    visa_route: Optional[str] = Field(None, max_length=100)
    target_industries: Optional[list[str]] = None
    target_locations: Optional[list[str]] = None
    current_status: Optional[str] = Field(
        None,
        pattern=r"^(outside_uk|uk_different_visa|uk_graduate|uk_sponsored|uk_citizen_pr|other)$",
    )
    nationality: Optional[str] = Field(None, max_length=100)


class ProfileResponse(BaseModel):
    user_id: str
    visa_route: Optional[str] = None
    target_industries: Optional[list[str]] = None
    target_locations: Optional[list[str]] = None
    current_status: Optional[str] = None
    nationality: Optional[str] = None
    setup_completed: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/setup", response_model=ProfileResponse)
async def setup_profile(
    data: ProfileSetup,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create or update the user's profile preferences."""
    now = datetime.utcnow()
    # Upsert via raw SQL since user_profiles is a Supabase-managed table
    # (not an Alembic model)
    await db.execute(
        text("""
            INSERT INTO user_profiles (
                user_id, visa_route, target_industries, target_locations,
                current_status, nationality, setup_completed, created_at, updated_at
            ) VALUES (
                :user_id, :visa_route, :target_industries, :target_locations,
                :current_status, :nationality, TRUE, :now, :now
            )
            ON CONFLICT (user_id) DO UPDATE SET
                visa_route = EXCLUDED.visa_route,
                target_industries = EXCLUDED.target_industries,
                target_locations = EXCLUDED.target_locations,
                current_status = EXCLUDED.current_status,
                nationality = EXCLUDED.nationality,
                setup_completed = TRUE,
                updated_at = EXCLUDED.updated_at
        """),
        {
            "user_id": str(user.id),
            "visa_route": data.visa_route,
            "target_industries": data.target_industries,
            "target_locations": data.target_locations,
            "current_status": data.current_status,
            "nationality": data.nationality,
            "now": now,
        },
    )
    await db.commit()

    # Fetch back
    result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=500, detail="Profile save failed")

    return ProfileResponse(
        user_id=str(row["user_id"]),
        visa_route=row["visa_route"],
        target_industries=row["target_industries"],
        target_locations=row["target_locations"],
        current_status=row["current_status"],
        nationality=row["nationality"],
        setup_completed=row["setup_completed"],
        created_at=str(row["created_at"]) if row["created_at"] else None,
        updated_at=str(row["updated_at"]) if row["updated_at"] else None,
    )


@router.get("/", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get the current user's profile."""
    result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.mappings().one_or_none()
    if not row:
        # Return empty profile (setup not completed)
        return ProfileResponse(user_id=str(user.id))

    return ProfileResponse(
        user_id=str(row["user_id"]),
        visa_route=row["visa_route"],
        target_industries=row["target_industries"],
        target_locations=row["target_locations"],
        current_status=row["current_status"],
        nationality=row["nationality"],
        setup_completed=row["setup_completed"],
        created_at=str(row["created_at"]) if row["created_at"] else None,
        updated_at=str(row["updated_at"]) if row["updated_at"] else None,
    )
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`. Add the import alongside the existing router includes:

```python
from app.api.v1.profile import router as profile_router
# ... in the app setup section:
app.include_router(profile_router, prefix="/api/v1")
```

- [ ] **Step 3 (2 min):** Test the endpoint manually.

```bash
cd backend && python -c "
from app.api.v1.profile import ProfileSetup
p = ProfileSetup(visa_route='Skilled Worker', target_industries=['Technology'], current_status='outside_uk')
print('Schema OK:', p.model_dump())
"
# Expected: prints the model dict without errors
```

- [ ] **Step 4 (1 min):** Commit.

```bash
git add backend/app/api/v1/profile.py backend/app/main.py
git commit -m "feat(api): add user profile setup and retrieval endpoints

POST /api/v1/profile/setup — upsert visa route, industries, locations
GET /api/v1/profile — retrieve current user profile"
```

---

### Task 5: Profile Setup Wizard Frontend Component

**Files:**
- Create: `frontend/src/components/profile/SetupWizard.tsx`

- [ ] **Step 1 (5 min):** Create the multi-step setup wizard component. It collects visa route, industries, locations, and current status. Matches existing Card/form patterns from the codebase.

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import {
  Globe,
  Briefcase,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const VISA_ROUTES = [
  'Skilled Worker',
  'Health & Care Worker',
  'Global Talent',
  'Innovator Founder',
  'Graduate',
  'Scale-Up',
  'High Potential Individual',
  'Other',
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Engineering',
  'Hospitality',
  'Retail',
  'Construction',
  'Legal',
  'Consulting',
  'Manufacturing',
  'Energy',
  'Charity / Non-profit',
  'Other',
];

const UK_LOCATIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
  'Edinburgh',
  'Glasgow',
  'Liverpool',
  'Sheffield',
  'Cambridge',
  'Oxford',
  'Newcastle',
  'Nottingham',
  'Cardiff',
  'Belfast',
  'Any / Remote',
];

const STATUS_OPTIONS = [
  { value: 'outside_uk', label: 'Outside the UK' },
  { value: 'uk_different_visa', label: 'In UK on a different visa' },
  { value: 'uk_graduate', label: 'In UK on Graduate visa' },
  { value: 'uk_sponsored', label: 'In UK on sponsored visa' },
  { value: 'uk_citizen_pr', label: 'UK citizen / permanent resident' },
  { value: 'other', label: 'Other' },
];

const STEPS = [
  { icon: Globe, label: 'Visa Route' },
  { icon: Briefcase, label: 'Industries' },
  { icon: MapPin, label: 'Locations' },
  { icon: User, label: 'Status' },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [visaRoute, setVisaRoute] = useState<string>('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const { token } = useAuthStore();

  const toggleItem = useCallback(
    (list: string[], setList: (v: string[]) => void, item: string) => {
      setList(
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
      );
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/setup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            visa_route: visaRoute || null,
            target_industries: industries.length > 0 ? industries : null,
            target_locations: locations.length > 0 ? locations : null,
            current_status: status || null,
          }),
        }
      );
      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg !p-0 border-amber/20 animate-slideInUp">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-data text-sm font-bold uppercase tracking-[0.15em] text-amber">
            Mission Briefing
          </h2>
          <p className="text-xs text-dim mt-1">
            Personalize your intelligence terminal in 4 steps
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex border-b border-border">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setStep(i)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-data uppercase tracking-wider transition-colors',
                i === step
                  ? 'text-amber bg-amber/5 border-b-2 border-amber'
                  : i < step
                    ? 'text-green'
                    : 'text-dim'
              )}
            >
              {i < step ? (
                <Check size={10} className="text-green" />
              ) : (
                <s.icon size={10} />
              )}
              {s.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="p-5 min-h-[260px]">
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Which visa route are you interested in?
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {VISA_ROUTES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setVisaRoute(r)}
                    className={cn(
                      'px-3 py-2 text-xs font-data border transition-colors text-left',
                      visaRoute === r
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Select your target industries (multiple allowed)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => toggleItem(industries, setIndustries, ind)}
                    className={cn(
                      'px-3 py-2 text-xs font-data border transition-colors text-left',
                      industries.includes(ind)
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Where in the UK do you want to work? (multiple allowed)
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {UK_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => toggleItem(locations, setLocations, loc)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-data border transition-colors text-left',
                      locations.includes(loc)
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                What is your current immigration status?
              </p>
              <div className="space-y-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'w-full px-3 py-2.5 text-xs font-data border transition-colors text-left',
                      status === opt.value
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className={cn(
              'flex items-center gap-1 text-xs font-data',
              step === 0 ? 'text-muted cursor-not-allowed' : 'text-dim hover:text-text'
            )}
          >
            <ChevronLeft size={12} />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 text-xs font-data text-amber hover:text-text transition-colors"
            >
              Next
              <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber/20 border border-amber/30 text-amber text-xs font-data font-bold uppercase tracking-wider hover:bg-amber/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Launch Terminal'}
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2 (2 min):** Verify the file compiles by running the Next.js type checker.

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | grep -i "SetupWizard" | head -5
# Expected: no type errors for SetupWizard.tsx
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/profile/SetupWizard.tsx
git commit -m "feat(ui): add profile setup wizard component

4-step wizard collecting visa route, target industries, locations,
and immigration status. Uses amber terminal aesthetic."
```

---

### Task 6: TrendArrow and EmptyState Reusable Components

**Files:**
- Create: `frontend/src/components/ui/TrendArrow.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`

- [ ] **Step 1 (3 min):** Create the `TrendArrow` component that shows a directional arrow with percentage change. Reuses the TrendIndicator pattern from `StatCard.tsx`.

```tsx
'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendArrowProps {
  value: number;         // e.g. +12.3 or -5.1
  suffix?: string;       // e.g. "%" or "pts"
  period?: string;       // e.g. "7d" or "30d" — shown in tooltip
  size?: 'sm' | 'md';
  className?: string;
}

export function TrendArrow({
  value,
  suffix = '%',
  period = '30d',
  size = 'sm',
  className,
}: TrendArrowProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
  const color = isPositive ? 'text-green' : isNeutral ? 'text-dim' : 'text-red';
  const iconSize = size === 'sm' ? 10 : 12;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-data', textSize, color, className)}
      title={`${isPositive ? '+' : ''}${value.toFixed(1)}${suffix} vs ${period} ago`}
    >
      <Icon size={iconSize} />
      <span className="tabular-nums">
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}
```

- [ ] **Step 2 (4 min):** Create the `EmptyState` component with contextual messaging and suggested action.

```tsx
'use client';

import { SearchX, FileQuestion, Database, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  suggestion?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  suggestion,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="mb-3 text-muted">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="font-data text-sm font-semibold text-text uppercase tracking-wider mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-dim max-w-md mb-2">{description}</p>
      )}
      {suggestion && (
        <p className="text-[10px] text-amber font-data mb-3">{suggestion}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-1.5 border border-amber/30 bg-amber/10 text-amber text-xs font-data font-semibold uppercase tracking-wider hover:bg-amber/20 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/ui/TrendArrow.tsx frontend/src/components/ui/EmptyState.tsx
git commit -m "feat(ui): add TrendArrow and EmptyState reusable components

TrendArrow: directional indicator with color + tooltip for 7d/30d changes.
EmptyState: contextual empty state with icon, description, suggestion, and CTA."
```

---

### Task 7: NumberAnimation Component

**Files:**
- Create: `frontend/src/components/ui/NumberAnimation.tsx`

- [ ] **Step 1 (4 min):** Create the `NumberAnimation` component that animates count-up from old to new value using `requestAnimationFrame`.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';

interface NumberAnimationProps {
  value: number;
  duration?: number;       // ms, default 300
  format?: 'number' | 'compact' | 'percent' | 'currency';
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

export function NumberAnimation({
  value,
  duration = 300,
  format = 'compact',
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
}: NumberAnimationProps) {
  const [display, setDisplay] = useState<string>('');
  const prevValue = useRef<number>(value);
  const rafId = useRef<number>(0);

  const formatValue = (v: number): string => {
    switch (format) {
      case 'compact':
        return formatNumber(v);
      case 'percent':
        return `${v.toFixed(decimals)}%`;
      case 'currency':
        return `£${v >= 1000 ? formatNumber(v) : v.toLocaleString()}`;
      case 'number':
      default:
        return decimals > 0
          ? v.toFixed(decimals)
          : Math.round(v).toLocaleString();
    }
  };

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      setDisplay(`${prefix}${formatValue(to)}${suffix}`);
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(`${prefix}${formatValue(current)}${suffix}`);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [value, duration, format, prefix, suffix, decimals]);

  return (
    <span className={cn('font-data tabular-nums', className)}>
      {display}
    </span>
  );
}
```

- [ ] **Step 2 (2 min):** Verify it compiles.

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | grep "NumberAnimation" | head -3
# Expected: no errors
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/ui/NumberAnimation.tsx
git commit -m "feat(ui): add NumberAnimation component with requestAnimationFrame

Smooth count-up/down animation for metric values with configurable
format (compact, percent, currency, number), duration, and decimals."
```

---

### Task 8: Loading Messages Component

**Files:**
- Create: `frontend/src/components/ui/LoadingTerminal.tsx`

- [ ] **Step 1 (3 min):** Create the contextual loading message component with terminal cursor blink.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LoadingTerminalProps {
  messages?: string[];
  className?: string;
}

const DEFAULT_MESSAGES = [
  'Scanning 140,910 sponsors...',
  'Cross-referencing Companies House filings...',
  'Analyzing hiring patterns across 8,697 jobs...',
  'Checking enrichment levels...',
  'Loading intelligence data...',
];

export function LoadingTerminal({
  messages = DEFAULT_MESSAGES,
  className,
}: LoadingTerminalProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className={cn('flex items-center gap-2 py-8 justify-center', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
      <span className="font-data text-xs text-dim animate-fadeIn" key={index}>
        {messages[index]}
      </span>
      <span className="terminal-cursor font-data text-xs" />
    </div>
  );
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/ui/LoadingTerminal.tsx
git commit -m "feat(ui): add LoadingTerminal component with rotating contextual messages

Cycles through domain-specific loading messages with terminal cursor blink."
```

---

### Task 9: Score Explanation Panel ("Why this score?")

**Files:**
- Create: `frontend/src/components/ui/ScoreBreakdown.tsx`
- Create: `backend/app/api/v1/score_breakdown.py`

- [ ] **Step 1 (5 min):** Create the score breakdown API endpoint that returns the 7-factor weighted breakdown.

```python
"""
Score explanation endpoint — returns the 7-factor weighted breakdown.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_auth
from app.core.database import get_db
from app.models.scoring import SponsorScore
from app.models.user import User

router = APIRouter(prefix="/sponsors", tags=["sponsors"])

# Weights per the spec scoring engine
WEIGHTS = {
    "compliance": 0.20,
    "financial_health": 0.15,
    "hiring_activity": 0.15,
    "reputation": 0.15,
    "legitimacy": 0.10,
    "track_record": 0.15,
    "growth_signal": 0.10,
}


@router.get("/{sponsor_id}/score-breakdown")
async def get_score_breakdown(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """Detailed score factor breakdown for 'Why this score?' panel."""
    result = await db.execute(
        select(SponsorScore)
        .where(SponsorScore.sponsor_id == sponsor_id)
        .order_by(SponsorScore.computed_at.desc())
        .limit(1)
    )
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="No score data for this sponsor")

    risk_flags = []
    if score.risk_flags:
        if isinstance(score.risk_flags, list):
            risk_flags = score.risk_flags
        elif isinstance(score.risk_flags, dict):
            risk_flags = score.risk_flags.get("flags", [])

    factors = [
        {
            "key": "compliance",
            "label": "Compliance",
            "weight": WEIGHTS["compliance"],
            "score": score.compliance_score,
        },
        {
            "key": "financial_health",
            "label": "Financial Health",
            "weight": WEIGHTS["financial_health"],
            "score": score.financial_health_score,
        },
        {
            "key": "hiring_activity",
            "label": "Hiring Activity",
            "weight": WEIGHTS["hiring_activity"],
            "score": score.hiring_activity_score,
        },
        {
            "key": "reputation",
            "label": "Reputation",
            "weight": WEIGHTS["reputation"],
            "score": score.reputation_score,
        },
        {
            "key": "legitimacy",
            "label": "Legitimacy",
            "weight": WEIGHTS["legitimacy"],
            "score": score.legitimacy_score,
        },
        {
            "key": "track_record",
            "label": "Track Record",
            "weight": WEIGHTS["track_record"],
            "score": score.track_record_score,
        },
        {
            "key": "growth_signal",
            "label": "Growth Signal",
            "weight": WEIGHTS["growth_signal"],
            "score": score.growth_signal_score,
        },
    ]

    # Determine the weakest factor for improvement suggestion
    scored_factors = [f for f in factors if f["score"] is not None]
    weakest = min(scored_factors, key=lambda f: f["score"]) if scored_factors else None
    suggestion = None
    if weakest and weakest["score"] is not None and weakest["score"] < 60:
        suggestion = f"Improving {weakest['label']} (currently {weakest['score']}/100) would have the biggest impact on this score."

    return {
        "sponsor_id": str(sponsor_id),
        "overall_score": score.overall_score,
        "computed_at": score.computed_at.isoformat(),
        "factors": factors,
        "risk_flags": risk_flags,
        "suggestion": suggestion,
    }
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`.

```python
from app.api.v1.score_breakdown import router as score_breakdown_router
app.include_router(score_breakdown_router, prefix="/api/v1")
```

- [ ] **Step 3 (5 min):** Create the frontend `ScoreBreakdown` panel component.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';

interface Factor {
  key: string;
  label: string;
  weight: number;
  score: number | null;
}

interface ScoreBreakdownProps {
  sponsorId: string;
  overallScore: number;
  className?: string;
}

function ScoreBar({ score, label, weight }: { score: number | null; label: string; weight: number }) {
  const s = score ?? 0;
  const color =
    s >= 80 ? 'bg-green' : s >= 60 ? 'bg-amber' : s > 0 ? 'bg-red' : 'bg-s3';
  const textColor =
    s >= 80 ? 'text-green' : s >= 60 ? 'text-amber' : s > 0 ? 'text-red' : 'text-dim';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] text-dim uppercase tracking-wider">
          {label}{' '}
          <span className="text-muted">({Math.round(weight * 100)}%)</span>
        </span>
        <span className={cn('font-data text-[11px] font-bold tabular-nums', textColor)}>
          {score !== null ? score : '--'}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-s3 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-slower', color)}
          style={{ width: `${s}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreBreakdown({ sponsorId, overallScore, className }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<{
    factors: Factor[];
    risk_flags: string[];
    suggestion: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || data) return;

    async function fetchBreakdown() {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/sponsors/${sponsorId}/score-breakdown`
        );
        if (res.ok) {
          const json = await res.json();
          setData({
            factors: json.factors,
            risk_flags: json.risk_flags || [],
            suggestion: json.suggestion,
          });
        }
      } catch (err) {
        console.error('Score breakdown fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBreakdown();
  }, [isOpen, sponsorId, data]);

  const scoreColor =
    overallScore >= 80
      ? 'text-green'
      : overallScore >= 60
        ? 'text-amber'
        : 'text-red';

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[10px] font-data text-dim hover:text-amber transition-colors"
      >
        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        Why this score?
      </button>

      {isOpen && (
        <Card className="mt-2 !p-3 animate-slideInUp border-amber/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-data text-[10px] uppercase tracking-[0.15em] text-dim">
              Score Breakdown
            </span>
            <span className={cn('font-data text-lg font-bold tabular-nums', scoreColor)}>
              {overallScore}/100
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-2.5 bg-s2 rounded w-32 mb-1" />
                  <div className="h-1.5 bg-s2 rounded w-full" />
                </div>
              ))}
            </div>
          ) : data ? (
            <>
              <div className="space-y-2.5">
                {data.factors.map((f) => (
                  <ScoreBar
                    key={f.key}
                    score={f.score}
                    label={f.label}
                    weight={f.weight}
                  />
                ))}
              </div>

              {data.risk_flags.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={10} className="text-red" />
                    <span className="font-data text-[9px] uppercase tracking-wider text-red">
                      Risk Flags
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {data.risk_flags.map((flag, i) => (
                      <li key={i} className="text-[10px] text-dim font-data">
                        - {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.suggestion && (
                <div className="mt-3 pt-3 border-t border-border flex items-start gap-1.5">
                  <Lightbulb size={10} className="text-amber flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber font-data">
                    {data.suggestion}
                  </span>
                </div>
              )}
            </>
          ) : null}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4 (1 min):** Commit.

```bash
git add backend/app/api/v1/score_breakdown.py backend/app/main.py \
  frontend/src/components/ui/ScoreBreakdown.tsx
git commit -m "feat: add score breakdown panel (\"Why this score?\")

Backend: GET /api/v1/sponsors/{id}/score-breakdown returns 7-factor
weighted breakdown with risk flags and improvement suggestion.
Frontend: expandable ScoreBreakdown panel with animated score bars."
```

---

### Task 10: Daily Briefing Dashboard Section

**Files:**
- Create: `frontend/src/components/dashboard/DailyBriefing.tsx`
- Create: `backend/app/api/v1/dashboard.py`

- [ ] **Step 1 (5 min):** Create the dashboard API endpoint that returns the daily briefing data.

```python
"""
Dashboard personalization endpoints.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_auth, require_auth
from app.core.database import get_db
from app.models.job import Job
from app.models.sponsor import Sponsor
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/briefing")
async def daily_briefing(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Daily briefing: new sponsors, rating changes, watchlist jobs."""
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    # Load user profile for personalization
    profile_result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    profile = profile_result.mappings().one_or_none()

    # New A-rated sponsors in last 7 days
    new_a_query = (
        select(func.count(Sponsor.id))
        .where(
            Sponsor.rating == "A",
            Sponsor.first_seen_date >= week_ago.date(),
        )
    )
    new_a_count = (await db.execute(new_a_query)).scalar() or 0

    # New jobs matching user's target locations in last 7 days
    new_jobs_query = select(func.count(Job.id)).where(
        Job.created_at >= week_ago,
        Job.sponsorship_likelihood >= 60,
    )
    new_jobs_count = (await db.execute(new_jobs_query)).scalar() or 0

    # Watchlist companies with new activity
    watchlist_activity_count = 0
    try:
        wl_result = await db.execute(
            text("""
                SELECT COUNT(DISTINCT w.sponsor_id)
                FROM watchlist w
                JOIN jobs j ON j.sponsor_id = w.sponsor_id
                WHERE w.user_id = :uid
                  AND j.created_at >= :since
            """),
            {"uid": str(user.id), "since": week_ago},
        )
        watchlist_activity_count = wl_result.scalar() or 0
    except Exception:
        pass  # watchlist table may not exist yet

    items = []
    if new_a_count > 0:
        items.append({
            "type": "new_sponsors",
            "text": f"{new_a_count} new A-rated sponsor{'s' if new_a_count != 1 else ''} this week",
            "link": "/search?rating=A&sort=first_seen_date&dir=desc",
            "color": "green",
        })
    if new_jobs_count > 0:
        items.append({
            "type": "new_jobs",
            "text": f"{new_jobs_count} new sponsorship-likely job{'s' if new_jobs_count != 1 else ''}",
            "link": "/jobs",
            "color": "cyan",
        })
    if watchlist_activity_count > 0:
        items.append({
            "type": "watchlist",
            "text": f"{watchlist_activity_count} watchlist compan{'ies' if watchlist_activity_count != 1 else 'y'} posted new jobs",
            "link": "/watchlist",
            "color": "amber",
        })
    if not items:
        items.append({
            "type": "quiet",
            "text": "All quiet on the sponsorship front. No major changes today.",
            "link": "/dashboard",
            "color": "dim",
        })

    return {
        "date": now.strftime("%A, %d %B %Y"),
        "items": items,
        "profile_setup": profile is not None and profile.get("setup_completed", False),
    }
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`.

```python
from app.api.v1.dashboard import router as dashboard_router
app.include_router(dashboard_router, prefix="/api/v1")
```

- [ ] **Step 3 (4 min):** Create the `DailyBriefing` frontend component.

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, ArrowRight, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface BriefingItem {
  type: string;
  text: string;
  link: string;
  color: string;
}

interface BriefingData {
  date: string;
  items: BriefingItem[];
  profile_setup: boolean;
}

const COLOR_MAP: Record<string, string> = {
  green: 'text-green',
  cyan: 'text-cyan',
  amber: 'text-amber',
  dim: 'text-dim',
};

const DOT_COLOR_MAP: Record<string, string> = {
  green: 'bg-green',
  cyan: 'bg-cyan',
  amber: 'bg-amber',
  dim: 'bg-dim',
};

export function DailyBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    async function fetchBriefing() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/dashboard/briefing`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Briefing fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBriefing();
  }, [token, isAuthenticated]);

  if (loading) {
    return (
      <Card className="!p-0">
        <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
          <Newspaper size={11} className="text-amber" />
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">
            [DAILY BRIEFING]
          </span>
        </div>
        <div className="px-4 py-4 animate-pulse">
          <div className="h-3 bg-s2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-s2 rounded w-1/2" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="!p-0 border-amber/10">
      <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
        <Sparkles size={11} className="text-amber" />
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">
          [DAILY BRIEFING]
        </span>
        <span className="flex-1 border-t border-border/50" />
        <span className="font-data text-[9px] text-dim">{data.date?.toUpperCase()}</span>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-4">
        {data.items.map((item, i) => (
          <Link
            key={i}
            href={item.link}
            className={cn(
              'group flex items-center gap-2 text-xs font-data transition-colors hover:text-text',
              COLOR_MAP[item.color] || 'text-dim'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLOR_MAP[item.color] || 'bg-dim')} />
            {item.text}
            <ArrowRight
              size={10}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4 (1 min):** Commit.

```bash
git add backend/app/api/v1/dashboard.py backend/app/main.py \
  frontend/src/components/dashboard/DailyBriefing.tsx
git commit -m "feat: add daily briefing section for personalized dashboard

Backend: GET /api/v1/dashboard/briefing returns new sponsors, jobs,
watchlist activity. Frontend: DailyBriefing card with color-coded items."
```

---

## Phase 2: Power User Features (Tasks 11-17)

### Task 11: Upgrade Command Palette with Structured Query Builder

**Files:**
- Modify: `frontend/src/components/ui/CommandPalette.tsx`

- [ ] **Step 1 (5 min):** Add structured filter suggestion logic to the existing `CommandPalette`. When user types keywords, suggest structured filters. Add a `filters` state array and render filter chips. Insert this state and logic block at the top of the component function body (after the existing state declarations):

```tsx
// --- ADD to CommandPalette.tsx: state + suggestion logic ---

interface FilterChip {
  type: 'location' | 'rating' | 'industry' | 'route';
  label: string;
  value: string;
}

// Inside the component:
const [filters, setFilters] = useState<FilterChip[]>([]);

const FILTER_SUGGESTIONS: Array<{
  pattern: RegExp;
  type: FilterChip['type'];
  label: string;
  value: string;
}> = [
  { pattern: /\blondon\b/i, type: 'location', label: 'Location: London', value: 'London' },
  { pattern: /\bmanchester\b/i, type: 'location', label: 'Location: Manchester', value: 'Manchester' },
  { pattern: /\bbirmingham\b/i, type: 'location', label: 'Location: Birmingham', value: 'Birmingham' },
  { pattern: /\bleeds\b/i, type: 'location', label: 'Location: Leeds', value: 'Leeds' },
  { pattern: /\bbristol\b/i, type: 'location', label: 'Location: Bristol', value: 'Bristol' },
  { pattern: /\ba[- ]?rated\b/i, type: 'rating', label: 'Rating: A', value: 'A' },
  { pattern: /\bb[- ]?rated\b/i, type: 'rating', label: 'Rating: B', value: 'B' },
  { pattern: /\btech(nology)?\b/i, type: 'industry', label: 'Industry: Technology', value: 'Technology' },
  { pattern: /\bhealthcare\b/i, type: 'industry', label: 'Industry: Healthcare', value: 'Healthcare' },
  { pattern: /\bfinance?\b/i, type: 'industry', label: 'Industry: Finance', value: 'Finance' },
  { pattern: /\bskilled\s?worker\b/i, type: 'route', label: 'Route: Skilled Worker', value: 'Skilled Worker' },
];

const matchedSuggestions = FILTER_SUGGESTIONS.filter(
  (s) => query.length > 1 && s.pattern.test(query) && !filters.some((f) => f.value === s.value)
);

const addFilter = (chip: FilterChip) => {
  setFilters((prev) => [...prev, chip]);
  setQuery('');
};

const removeFilter = (idx: number) => {
  setFilters((prev) => prev.filter((_, i) => i !== idx));
};

const applyFilters = () => {
  const params = new URLSearchParams();
  filters.forEach((f) => {
    if (f.type === 'location') params.set('city', f.value);
    if (f.type === 'rating') params.set('rating', f.value);
    if (f.type === 'industry') params.set('industry', f.value);
    if (f.type === 'route') params.set('route', f.value);
  });
  if (query) params.set('search', query);
  router.push(`/search?${params.toString()}`);
  onClose();
};
```

- [ ] **Step 2 (3 min):** Add the filter chips UI and suggestions below the input. Insert this JSX between the input and the results list:

```tsx
{/* Filter chips */}
{filters.length > 0 && (
  <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
    {filters.map((f, i) => (
      <span
        key={i}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber/10 border border-amber/20 text-amber text-[10px] font-data"
      >
        {f.label}
        <button
          onClick={() => removeFilter(i)}
          className="hover:text-red transition-colors ml-0.5"
        >
          x
        </button>
      </span>
    ))}
    <button
      onClick={applyFilters}
      className="px-2 py-0.5 bg-amber/20 border border-amber/30 text-amber text-[10px] font-data font-bold hover:bg-amber/30 transition-colors"
    >
      Apply Filters
    </button>
  </div>
)}

{/* Structured filter suggestions */}
{matchedSuggestions.length > 0 && (
  <div className="border-b border-border py-1">
    <div className="px-3 py-0.5">
      <span className="font-data text-[9px] uppercase tracking-wider text-muted">
        Suggested Filters
      </span>
    </div>
    {matchedSuggestions.map((s, i) => (
      <button
        key={i}
        onClick={() => addFilter({ type: s.type, label: s.label, value: s.value })}
        className="w-full px-3 py-1.5 text-left text-xs font-data text-cyan hover:bg-s2 transition-colors flex items-center gap-2"
      >
        <Zap size={10} />
        {s.label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/ui/CommandPalette.tsx
git commit -m "feat(ui): upgrade command palette with structured filter suggestions

Typing city names, ratings, or industries now suggests structured
filter chips. Chips combine into search query parameters."
```

---

### Task 12: Add Quick Action Buttons to HoverPreview

**Files:**
- Modify: `frontend/src/components/ui/HoverPreview.tsx`

- [ ] **Step 1 (4 min):** Add quick action buttons (Watch, Compare, View Profile) to the bottom of the existing `HoverPreview` card. Add this JSX block inside the floating card, after the existing preview data display:

```tsx
{/* Quick Actions — add at bottom of preview card */}
<div className="border-t border-border mt-2 pt-2 flex items-center gap-1.5">
  <button
    onClick={(e) => {
      e.stopPropagation();
      // Navigate to company profile
      window.location.href = `/company/${sponsorId}`;
    }}
    className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-amber border border-amber/20 hover:bg-amber/10 transition-colors"
  >
    <Eye size={9} />
    Profile
  </button>
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.location.href = `/compare?ids=${sponsorId}`;
    }}
    className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-cyan border border-cyan/20 hover:bg-cyan/10 transition-colors"
  >
    <GitCompareArrows size={9} />
    Compare
  </button>
  <button
    onClick={(e) => {
      e.stopPropagation();
      // TODO: wire to watchlist add
    }}
    className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-green border border-green/20 hover:bg-green/10 transition-colors"
  >
    <Star size={9} />
    Watch
  </button>
</div>
```

- [ ] **Step 2 (2 min):** Add the required icon imports at the top of `HoverPreview.tsx`:

```tsx
import { Eye, GitCompareArrows, Star } from 'lucide-react';
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/ui/HoverPreview.tsx
git commit -m "feat(ui): add quick action buttons to HoverPreview card

Adds Profile, Compare, and Watch buttons to the floating company
preview card for one-click navigation."
```

---

### Task 13: Saved Searches API + Frontend

**Files:**
- Create: `backend/app/api/v1/saved_searches.py`
- Modify: `backend/app/main.py`
- Create: `frontend/src/components/search/SaveSearchButton.tsx`

- [ ] **Step 1 (4 min):** Create the saved searches backend API.

```python
"""
Saved searches CRUD endpoints.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/searches", tags=["searches"])


class SaveSearchRequest(BaseModel):
    name: str = Field(..., max_length=200)
    filters: dict
    result_count: Optional[int] = None


class SavedSearchResponse(BaseModel):
    id: str
    name: str
    filters: dict
    result_count_at_save: Optional[int] = None
    last_viewed_at: Optional[str] = None
    created_at: Optional[str] = None


@router.post("/save", response_model=SavedSearchResponse)
async def save_search(
    data: SaveSearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Save a search with filters."""
    # Check limit for free users (max 10)
    if user.plan.value == "free":
        count_result = await db.execute(
            text("SELECT COUNT(*) FROM saved_searches WHERE user_id = :uid"),
            {"uid": str(user.id)},
        )
        count = count_result.scalar() or 0
        if count >= 10:
            raise HTTPException(
                status_code=403,
                detail="Free plan allows max 10 saved searches. Upgrade to Pro for unlimited.",
            )

    new_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO saved_searches (id, user_id, name, filters, result_count_at_save)
            VALUES (:id, :uid, :name, :filters::jsonb, :count)
        """),
        {
            "id": new_id,
            "uid": str(user.id),
            "name": data.name,
            "filters": str(data.filters).replace("'", '"'),
            "count": data.result_count,
        },
    )
    await db.commit()

    return SavedSearchResponse(
        id=new_id,
        name=data.name,
        filters=data.filters,
        result_count_at_save=data.result_count,
    )


@router.get("/", response_model=list[SavedSearchResponse])
async def list_searches(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """List user's saved searches."""
    result = await db.execute(
        text("""
            SELECT id, name, filters, result_count_at_save, last_viewed_at, created_at
            FROM saved_searches
            WHERE user_id = :uid
            ORDER BY created_at DESC
        """),
        {"uid": str(user.id)},
    )
    rows = result.mappings().all()
    return [
        SavedSearchResponse(
            id=str(r["id"]),
            name=r["name"],
            filters=r["filters"] if isinstance(r["filters"], dict) else {},
            result_count_at_save=r["result_count_at_save"],
            last_viewed_at=str(r["last_viewed_at"]) if r["last_viewed_at"] else None,
            created_at=str(r["created_at"]) if r["created_at"] else None,
        )
        for r in rows
    ]


@router.delete("/{search_id}")
async def delete_search(
    search_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete a saved search."""
    result = await db.execute(
        text("DELETE FROM saved_searches WHERE id = :id AND user_id = :uid"),
        {"id": str(search_id), "uid": str(user.id)},
    )
    await db.commit()
    return {"deleted": True}
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`.

```python
from app.api.v1.saved_searches import router as saved_searches_router
app.include_router(saved_searches_router, prefix="/api/v1")
```

- [ ] **Step 3 (3 min):** Create the frontend `SaveSearchButton` component.

```tsx
'use client';

import { useState } from 'react';
import { Bookmark, Check, X } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface SaveSearchButtonProps {
  filters: Record<string, string>;
  resultCount?: number;
}

export function SaveSearchButton({ filters, resultCount }: SaveSearchButtonProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { token } = useAuthStore();

  const handleSave = async () => {
    if (!name.trim() || !token) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/searches/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            filters,
            result_count: resultCount,
          }),
        }
      );
      if (res.ok) {
        setSaved(true);
        setShowInput(false);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Save search error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-data text-green">
        <Check size={10} />
        Saved
      </span>
    );
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Search name..."
          className="h-6 px-2 text-[10px] font-data bg-s2 border border-border text-text placeholder:text-muted focus:border-amber outline-none w-32"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="h-6 px-2 bg-amber/20 border border-amber/30 text-amber text-[10px] font-data disabled:opacity-50"
        >
          {saving ? '...' : 'Save'}
        </button>
        <button
          onClick={() => setShowInput(false)}
          className="h-6 px-1 text-dim hover:text-text"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1 text-[10px] font-data text-dim hover:text-amber transition-colors"
    >
      <Bookmark size={10} />
      Save Search
    </button>
  );
}
```

- [ ] **Step 4 (1 min):** Commit.

```bash
git add backend/app/api/v1/saved_searches.py backend/app/main.py \
  frontend/src/components/search/SaveSearchButton.tsx
git commit -m "feat: add saved searches CRUD + SaveSearchButton component

Backend: POST/GET/DELETE for saved_searches with free plan limit (10).
Frontend: inline save button with name input for search page."
```

---

### Task 14: Keyboard Shortcut Overlay

**Files:**
- Create: `frontend/src/components/ui/ShortcutOverlay.tsx`
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1 (5 min):** Create the full-screen shortcut reference overlay.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: 'Cmd+K', description: 'Open command palette' },
      { keys: '?', description: 'Show keyboard shortcuts' },
      { keys: 'Esc', description: 'Close overlay / modal' },
      { keys: '[', description: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'G D', description: 'Go to Dashboard' },
      { keys: 'G S', description: 'Go to Search' },
      { keys: 'G B', description: 'Go to Companies' },
      { keys: 'G J', description: 'Go to Jobs' },
      { keys: 'G M', description: 'Go to Map' },
      { keys: 'G T', description: 'Go to Trends' },
      { keys: 'G I', description: 'Go to Signals' },
      { keys: 'G C', description: 'Go to Compare' },
      { keys: 'G W', description: 'Go to Watchlist' },
      { keys: 'G K', description: 'Go to Tracker' },
      { keys: 'G A', description: 'Go to Alerts' },
      { keys: 'G N', description: 'Go to Notes' },
      { keys: 'G E', description: 'Go to Engine (admin)' },
    ],
  },
  {
    title: 'Search',
    shortcuts: [
      { keys: '/', description: 'Focus search input' },
      { keys: 'Enter', description: 'Execute search' },
      { keys: 'Tab', description: 'Next filter suggestion' },
    ],
  },
  {
    title: 'Table',
    shortcuts: [
      { keys: 'J / Down', description: 'Next row' },
      { keys: 'K / Up', description: 'Previous row' },
      { keys: 'Enter', description: 'Open selected company' },
      { keys: 'W', description: 'Watch/unwatch selected' },
    ],
  },
];

export function ShortcutOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter(
      (s) =>
        !filter ||
        s.description.toLowerCase().includes(filter.toLowerCase()) ||
        s.keys.toLowerCase().includes(filter.toLowerCase())
    ),
  })).filter((g) => g.shortcuts.length > 0);

  return (
    <div className="fixed inset-0 z-command-palette bg-bg/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl border border-border bg-s1 animate-slideInUp max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-data text-sm font-bold uppercase tracking-[0.15em] text-amber">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-dim hover:text-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-s2 border border-border px-3 py-1.5">
            <Search size={12} className="text-dim" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter shortcuts..."
              className="flex-1 bg-transparent text-xs font-data text-text placeholder:text-muted outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-data text-[10px] uppercase tracking-[0.2em] text-muted mb-2">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between py-1 px-2 hover:bg-s2/30 transition-colors"
                  >
                    <span className="text-xs text-dim">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.split('+').map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted text-[9px] mx-0.5">+</span>}
                          <kbd className="px-1.5 py-0.5 bg-s3 border border-border text-[10px] font-data text-text rounded-sm">
                            {key.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="font-data text-[9px] text-muted">
            Press <kbd className="px-1 bg-s3 border border-border text-[9px] rounded-sm">?</kbd> to toggle
          </span>
          <span className="font-data text-[9px] text-muted">
            <kbd className="px-1 bg-s3 border border-border text-[9px] rounded-sm">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 (2 min):** Add `<ShortcutOverlay />` to the `AppShell` layout. Import and render it alongside `CommandPalette`:

```tsx
import { ShortcutOverlay } from '@/components/ui/ShortcutOverlay';
// In the render return, alongside CommandPalette:
<ShortcutOverlay />
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/ui/ShortcutOverlay.tsx \
  frontend/src/components/layout/AppShell.tsx
git commit -m "feat(ui): add keyboard shortcut overlay (press ? to toggle)

Full-screen searchable shortcut reference with groups for Global,
Navigation, Search, and Table shortcuts."
```

---

### Task 15: Integrate NumberAnimation into StatCard

**Files:**
- Modify: `frontend/src/components/ui/StatCard.tsx`

- [ ] **Step 1 (3 min):** Import `NumberAnimation` and use it for the value display. Replace the static value rendering with the animated version. In `StatCard.tsx`, replace the value `<p>` element:

Replace:
```tsx
<p className={cn('font-data text-lg font-bold leading-tight tabular-nums', colors.valueColor)}>
  {value}
</p>
```

With:
```tsx
<p className={cn('font-data text-lg font-bold leading-tight tabular-nums', colors.valueColor)}>
  {typeof value === 'number' ? (
    <NumberAnimation value={value} className={colors.valueColor} />
  ) : (
    value
  )}
</p>
```

Add the import at the top:
```tsx
import { NumberAnimation } from './NumberAnimation';
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/ui/StatCard.tsx
git commit -m "feat(ui): integrate NumberAnimation into StatCard

Numeric StatCard values now animate with count-up when they change."
```

---

### Task 16: Add Trend Arrows to Dashboard MarketPulse

**Files:**
- Modify: `frontend/src/components/dashboard/MarketPulse.tsx`

- [ ] **Step 1 (3 min):** Import `TrendArrow` and add trend data to each stat card in the MarketPulse grid. The trend values will be calculated from historical data (or use 0 as placeholder until the trend endpoint is ready). Add `TrendArrow` as a child element next to existing subtitle displays:

```tsx
import { TrendArrow } from '@/components/ui/TrendArrow';

// In each StatCard that shows a numeric metric, add the trend prop:
// Example for total sponsors:
<StatCard
  label="Total Sponsors"
  value={formatNumber(stats?.total_sponsors ?? 0)}
  color="amber"
  trend={{ value: 2.1, suffix: '%' }}
  // ... rest of existing props
/>
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/dashboard/MarketPulse.tsx
git commit -m "feat(ui): add trend arrows to MarketPulse dashboard stats

All metric cards now show 30-day trend indicators."
```

---

### Task 17: Contextual Loading Messages in Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1 (3 min):** Import `LoadingTerminal` and `DailyBriefing`, and replace the agent swarm loading skeleton with contextual messages. Add `DailyBriefing` above the agent status panel.

At the top of `dashboard/page.tsx`, add:
```tsx
import { LoadingTerminal } from '@/components/ui/LoadingTerminal';
import { DailyBriefing } from '@/components/dashboard/DailyBriefing';
```

Replace the 4-card loading skeleton in the agent swarm section:
```tsx
// Replace: Array.from({ length: 4 }).map((_, i) => ( <div key={i} className="px-4 py-3 animate-pulse">...
// With:
<div className="col-span-4">
  <LoadingTerminal
    messages={[
      'Connecting to agent swarm...',
      'Checking scraper health across 23 sources...',
      'Aggregating today\'s job harvest...',
      'Computing enrichment queue depth...',
    ]}
  />
</div>
```

Add `<DailyBriefing />` as the first child inside the outer `<div className="space-y-2">`:
```tsx
<div className="space-y-2">
  <DailyBriefing />
  {/* ... existing terminal header bar ... */}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(ui): add daily briefing + contextual loading to dashboard

Daily briefing card shows personalized updates at the top.
Loading skeletons replaced with rotating terminal-style messages."
```

---

## Phase 3: Real-time & Micro-interactions (Tasks 18-20)

### Task 18: Supabase Realtime Hook

**Files:**
- Create: `frontend/src/hooks/useRealtimeSubscription.ts`

- [ ] **Step 1 (4 min):** Create a reusable hook for Supabase Realtime `postgres_changes` subscriptions. Follows the pattern from `supabase.ts` for client usage.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: string;
  event?: ChangeEvent;
  filter?: string;   // e.g. "sponsor_id=eq.some-uuid"
  schema?: string;
  enabled?: boolean;
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtimeSubscription({
  table,
  event = '*',
  filter,
  schema = 'public',
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`;

    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        channelConfig as never,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onChange?.(payload);

          if (payload.eventType === 'INSERT') onInsert?.(payload);
          if (payload.eventType === 'UPDATE') onUpdate?.(payload);
          if (payload.eventType === 'DELETE') onDelete?.(payload);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, filter, schema, enabled]);

  return channelRef;
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/hooks/useRealtimeSubscription.ts
git commit -m "feat: add useRealtimeSubscription hook for Supabase postgres_changes

Reusable hook with auto-cleanup on unmount. Supports table/event/filter
configuration with separate onInsert/onUpdate/onDelete callbacks."
```

---

### Task 19: Real-time Data Flash on Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1 (4 min):** Use `useRealtimeSubscription` to listen for sponsor changes and trigger data-flash animations. Add this block inside the `DashboardPage` component, after the existing state declarations:

```tsx
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// Inside DashboardPage component body:
const [flashedSponsorId, setFlashedSponsorId] = useState<string | null>(null);

useRealtimeSubscription({
  table: 'sponsors',
  event: '*',
  enabled: true,
  onChange: (payload) => {
    // Trigger data flash animation
    const id = (payload.new as Record<string, unknown>)?.id as string;
    if (id) {
      setFlashedSponsorId(id);
      setTimeout(() => setFlashedSponsorId(null), 500);
    }
    // Optionally refetch stats
  },
});

useRealtimeSubscription({
  table: 'sponsor_scores',
  event: 'UPDATE',
  enabled: true,
  onChange: () => {
    // Score update: could trigger a re-fetch of market pulse stats
    // For now, the 15s polling interval in enrichStats handles this
  },
});
```

- [ ] **Step 2 (2 min):** Apply the `data-updated` CSS class conditionally to top company rows. In the `topCompanies.map()` section, add:

```tsx
className={cn(
  'stagger-item grid grid-cols-[24px_1fr_50px_40px] items-center border-b border-border/15 px-3 py-1.5 hover:bg-s2/40 transition-colors',
  flashedSponsorId === c.id && 'data-updated'
)}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add real-time Supabase subscriptions to dashboard

Subscribes to sponsors and sponsor_scores changes. Company rows flash
with data-updated animation when their data changes in real-time."
```

---

### Task 20: Score Badge Pulse Animation

**Files:**
- Modify: `frontend/src/components/ui/ScoreBadge.tsx`

- [ ] **Step 1 (3 min):** Update the existing `ScoreBadge` component to accept a `pulse` prop that triggers the cyan glow animation when a score is freshly updated.

```tsx
'use client';

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = 'sm', pulse = false, className }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span className={cn(
        'inline-flex items-center justify-center font-data font-bold tabular-nums bg-s3 text-dim',
        size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[11px] px-1.5 py-0.5',
        className
      )}>
        --
      </span>
    );
  }

  const bg = score >= 80 ? 'bg-green/20' : score >= 60 ? 'bg-amber/20' : 'bg-red/20';
  const text = score >= 80 ? 'text-green' : score >= 60 ? 'text-amber' : 'text-red';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-data font-bold tabular-nums transition-all',
        bg,
        text,
        size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[11px] px-1.5 py-0.5',
        pulse && 'animate-pulse-glow-cyan',
        className
      )}
    >
      {score}
    </span>
  );
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/ui/ScoreBadge.tsx
git commit -m "feat(ui): add pulse animation prop to ScoreBadge

Score badges can now pulse with cyan glow when freshly re-scored."
```

---

## Phase 4: Community Layer (Tasks 21-25)

### Task 21: Create Community Database Tables (Supabase Migration)

**Files:**
- Create: `supabase/migrations/20260323000003_community_tables.sql`

- [ ] **Step 1 (5 min):** Write the migration for `community_ratings`, `salary_reports`, and `success_stories` with full RLS policies.

```sql
-- supabase/migrations/20260323000003_community_tables.sql
-- Community layer: ratings, salary reports, success stories

-- 1. Community Ratings
CREATE TABLE IF NOT EXISTS community_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (
        interaction_type IN ('applied', 'interviewed', 'sponsored', 'worked_here')
    ),
    rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
    rating_process INTEGER CHECK (rating_process BETWEEN 1 AND 5),
    rating_interview INTEGER CHECK (rating_interview BETWEEN 1 AND 5),
    rating_sponsorship INTEGER CHECK (rating_sponsorship BETWEEN 1 AND 5),
    rating_culture INTEGER CHECK (rating_culture BETWEEN 1 AND 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    UNIQUE (user_id, sponsor_id)
);

ALTER TABLE community_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved ratings" ON community_ratings FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own ratings" ON community_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own ratings" ON community_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ratings" ON community_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages ratings" ON community_ratings FOR ALL USING (true);

-- 2. Salary Reports
CREATE TABLE IF NOT EXISTS salary_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    role_title VARCHAR(300) NOT NULL,
    salary_annual INTEGER NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE salary_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read salary reports" ON salary_reports FOR SELECT USING (true);
CREATE POLICY "Users create own reports" ON salary_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages reports" ON salary_reports FOR ALL USING (true);

-- 3. Success Stories
CREATE TABLE IF NOT EXISTS success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    story_text TEXT NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER,
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved stories" ON success_stories FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own stories" ON success_stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own stories" ON success_stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages stories" ON success_stories FOR ALL USING (true);
```

- [ ] **Step 2 (2 min):** Apply the migration.

```bash
cd supabase && npx supabase db push
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add supabase/migrations/20260323000003_community_tables.sql
git commit -m "feat(db): create community_ratings, salary_reports, success_stories tables

Full RLS policies: public read for approved items, users manage own
submissions, service role has full access."
```

---

### Task 22: Community API Endpoints

**Files:**
- Create: `backend/app/api/v1/community.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1 (5 min):** Create the community API router with rating submission, salary reports, and success stories.

```python
"""
Community layer API: ratings, salary reports, success stories.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin, require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/community", tags=["community"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RatingSubmit(BaseModel):
    sponsor_id: str
    interaction_type: str = Field(..., pattern=r"^(applied|interviewed|sponsored|worked_here)$")
    rating_overall: int = Field(..., ge=1, le=5)
    rating_process: Optional[int] = Field(None, ge=1, le=5)
    rating_interview: Optional[int] = Field(None, ge=1, le=5)
    rating_sponsorship: Optional[int] = Field(None, ge=1, le=5)
    rating_culture: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class SalaryReportSubmit(BaseModel):
    sponsor_id: str
    role_title: str = Field(..., max_length=300)
    salary_annual: int = Field(..., ge=10000, le=500000)
    visa_route: Optional[str] = Field(None, max_length=100)
    year: int = Field(..., ge=2015, le=2030)


class SuccessStorySubmit(BaseModel):
    sponsor_id: str
    story_text: str = Field(..., min_length=20, max_length=5000)
    visa_route: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=2015, le=2030)
    is_anonymous: bool = True


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------

@router.post("/ratings")
async def submit_rating(
    data: RatingSubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit or update a community rating for a sponsor."""
    await db.execute(
        text("""
            INSERT INTO community_ratings (
                user_id, sponsor_id, interaction_type, rating_overall,
                rating_process, rating_interview, rating_sponsorship,
                rating_culture, comment
            ) VALUES (
                :uid, :sid, :interaction, :overall,
                :process, :interview, :sponsorship, :culture, :comment
            )
            ON CONFLICT (user_id, sponsor_id) DO UPDATE SET
                interaction_type = EXCLUDED.interaction_type,
                rating_overall = EXCLUDED.rating_overall,
                rating_process = EXCLUDED.rating_process,
                rating_interview = EXCLUDED.rating_interview,
                rating_sponsorship = EXCLUDED.rating_sponsorship,
                rating_culture = EXCLUDED.rating_culture,
                comment = EXCLUDED.comment,
                is_approved = FALSE,
                updated_at = now()
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "interaction": data.interaction_type,
            "overall": data.rating_overall,
            "process": data.rating_process,
            "interview": data.rating_interview,
            "sponsorship": data.rating_sponsorship,
            "culture": data.rating_culture,
            "comment": data.comment,
        },
    )
    await db.commit()
    return {"status": "submitted", "message": "Your rating is pending approval."}


@router.get("/ratings/{sponsor_id}")
async def get_ratings(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get approved community ratings for a sponsor."""
    result = await db.execute(
        text("""
            SELECT rating_overall, rating_process, rating_interview,
                   rating_sponsorship, rating_culture, interaction_type,
                   comment, created_at
            FROM community_ratings
            WHERE sponsor_id = :sid AND is_approved = TRUE
            ORDER BY created_at DESC
            LIMIT 50
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()

    # Compute averages
    if not rows:
        return {"ratings": [], "averages": None, "count": 0}

    avg_overall = sum(r["rating_overall"] for r in rows) / len(rows)
    return {
        "ratings": [dict(r) for r in rows],
        "averages": {"overall": round(avg_overall, 1)},
        "count": len(rows),
    }


# ---------------------------------------------------------------------------
# Salary Reports
# ---------------------------------------------------------------------------

@router.post("/salary-reports")
async def submit_salary_report(
    data: SalaryReportSubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit an anonymous salary report."""
    await db.execute(
        text("""
            INSERT INTO salary_reports (user_id, sponsor_id, role_title, salary_annual, visa_route, year)
            VALUES (:uid, :sid, :role, :salary, :route, :year)
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "role": data.role_title,
            "salary": data.salary_annual,
            "route": data.visa_route,
            "year": data.year,
        },
    )
    await db.commit()
    return {"status": "submitted"}


@router.get("/salary-reports/{sponsor_id}")
async def get_salary_reports(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated salary reports (only if >= 3 reports for anonymity)."""
    result = await db.execute(
        text("""
            SELECT role_title, visa_route,
                   COUNT(*) as report_count,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_annual) as median_salary,
                   MIN(salary_annual) as min_salary,
                   MAX(salary_annual) as max_salary
            FROM salary_reports
            WHERE sponsor_id = :sid
            GROUP BY role_title, visa_route
            HAVING COUNT(*) >= 3
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Success Stories
# ---------------------------------------------------------------------------

@router.post("/success-stories")
async def submit_success_story(
    data: SuccessStorySubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit a success story."""
    await db.execute(
        text("""
            INSERT INTO success_stories (user_id, sponsor_id, story_text, visa_route, year, is_anonymous)
            VALUES (:uid, :sid, :story, :route, :year, :anon)
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "story": data.story_text,
            "route": data.visa_route,
            "year": data.year,
            "anon": data.is_anonymous,
        },
    )
    await db.commit()
    return {"status": "submitted", "message": "Your story is pending admin approval."}


@router.get("/success-stories/{sponsor_id}")
async def get_success_stories(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get approved success stories for a sponsor."""
    result = await db.execute(
        text("""
            SELECT story_text, visa_route, year, is_anonymous, created_at
            FROM success_stories
            WHERE sponsor_id = :sid AND is_approved = TRUE
            ORDER BY created_at DESC
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Admin Moderation
# ---------------------------------------------------------------------------

@router.get("/admin/pending")
async def get_pending(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Get pending community items for admin review."""
    ratings = await db.execute(
        text("""
            SELECT cr.*, s.organisation_name
            FROM community_ratings cr
            JOIN sponsors s ON s.id = cr.sponsor_id
            WHERE cr.is_approved = FALSE
            ORDER BY cr.created_at DESC LIMIT 50
        """)
    )
    stories = await db.execute(
        text("""
            SELECT ss.*, s.organisation_name
            FROM success_stories ss
            JOIN sponsors s ON s.id = ss.sponsor_id
            WHERE ss.is_approved = FALSE
            ORDER BY ss.created_at DESC LIMIT 50
        """)
    )
    return {
        "pending_ratings": [dict(r) for r in ratings.mappings().all()],
        "pending_stories": [dict(r) for r in stories.mappings().all()],
    }


@router.post("/admin/approve/{item_type}/{item_id}")
async def approve_item(
    item_type: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Approve a community rating or success story."""
    table = "community_ratings" if item_type == "rating" else "success_stories"
    if item_type not in ("rating", "story"):
        raise HTTPException(status_code=400, detail="Invalid item type")

    await db.execute(
        text(f"UPDATE {table} SET is_approved = TRUE, approved_at = now() WHERE id = :id"),
        {"id": str(item_id)},
    )
    await db.commit()
    return {"status": "approved"}


@router.post("/admin/reject/{item_type}/{item_id}")
async def reject_item(
    item_type: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Reject (delete) a community rating or success story."""
    table = "community_ratings" if item_type == "rating" else "success_stories"
    if item_type not in ("rating", "story"):
        raise HTTPException(status_code=400, detail="Invalid item type")

    await db.execute(
        text(f"DELETE FROM {table} WHERE id = :id"),
        {"id": str(item_id)},
    )
    await db.commit()
    return {"status": "rejected"}
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`.

```python
from app.api.v1.community import router as community_router
app.include_router(community_router, prefix="/api/v1")
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add backend/app/api/v1/community.py backend/app/main.py
git commit -m "feat(api): add community ratings, salary reports, success stories endpoints

Includes rating submission with upsert, salary aggregation with >= 3
anonymity threshold, success stories with approval workflow, admin moderation."
```

---

### Task 23: Community Rating Form Component

**Files:**
- Create: `frontend/src/components/community/RatingForm.tsx`

- [ ] **Step 1 (5 min):** Create the rating form for company profiles.

```tsx
'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface RatingFormProps {
  sponsorId: string;
  onSubmit?: () => void;
}

const INTERACTION_TYPES = [
  { value: 'applied', label: 'I Applied' },
  { value: 'interviewed', label: 'I Was Interviewed' },
  { value: 'sponsored', label: 'I Was Sponsored' },
  { value: 'worked_here', label: 'I Worked Here' },
];

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-data text-dim uppercase tracking-wider">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className="transition-colors"
          >
            <Star
              size={14}
              className={cn(
                star <= value ? 'fill-amber text-amber' : 'text-s4 hover:text-amber/50'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RatingForm({ sponsorId, onSubmit }: RatingFormProps) {
  const { token, isAuthenticated } = useAuthStore();
  const [interactionType, setInteractionType] = useState('');
  const [overall, setOverall] = useState(0);
  const [process, setProcess] = useState(0);
  const [interview, setInterview] = useState(0);
  const [sponsorship, setSponsorship] = useState(0);
  const [culture, setCulture] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isAuthenticated) {
    return (
      <Card className="!p-3">
        <p className="text-xs text-dim font-data text-center">
          Sign in to rate this sponsor
        </p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="!p-3 border-green/20">
        <p className="text-xs text-green font-data text-center">
          Rating submitted. Pending admin approval.
        </p>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (!interactionType || overall === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/ratings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sponsor_id: sponsorId,
            interaction_type: interactionType,
            rating_overall: overall,
            rating_process: process || null,
            rating_interview: interview || null,
            rating_sponsorship: sponsorship || null,
            rating_culture: culture || null,
            comment: comment || null,
          }),
        }
      );
      if (res.ok) {
        setSubmitted(true);
        onSubmit?.();
      }
    } catch (err) {
      console.error('Rating submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="!p-3">
      <h4 className="font-data text-[10px] uppercase tracking-[0.15em] text-dim mb-3">
        Rate This Sponsor
      </h4>

      {/* Interaction type */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {INTERACTION_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setInteractionType(t.value)}
            className={cn(
              'px-2 py-1.5 text-[10px] font-data border transition-colors',
              interactionType === t.value
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-border text-dim hover:border-amber/30'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Star ratings */}
      <div className="space-y-2 mb-3">
        <StarRating value={overall} onChange={setOverall} label="Overall *" />
        <StarRating value={process} onChange={setProcess} label="Application Process" />
        <StarRating value={interview} onChange={setInterview} label="Interview" />
        <StarRating value={sponsorship} onChange={setSponsorship} label="Sponsorship Support" />
        <StarRating value={culture} onChange={setCulture} label="Work Culture" />
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)..."
        maxLength={2000}
        rows={3}
        className="w-full px-2 py-1.5 bg-s2 border border-border text-xs font-data text-text placeholder:text-muted resize-none focus:border-amber outline-none mb-3"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !interactionType || overall === 0}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber/20 border border-amber/30 text-amber text-xs font-data font-bold uppercase tracking-wider hover:bg-amber/30 transition-colors disabled:opacity-50"
      >
        <Send size={10} />
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </Card>
  );
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/community/RatingForm.tsx
git commit -m "feat(ui): add community RatingForm component

Multi-category star rating form (overall, process, interview,
sponsorship, culture) with interaction type selection and comment."
```

---

### Task 24: Community Ratings Display Component

**Files:**
- Create: `frontend/src/components/community/CommunityRatings.tsx`

- [ ] **Step 1 (4 min):** Create a display component that shows aggregated community ratings on company profiles.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Star, Users } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface Rating {
  rating_overall: number;
  interaction_type: string;
  comment: string | null;
  created_at: string;
}

interface CommunityRatingsProps {
  sponsorId: string;
}

export function CommunityRatings({ sponsorId }: CommunityRatingsProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averages, setAverages] = useState<{ overall: number } | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRatings() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/ratings/${sponsorId}`
        );
        if (res.ok) {
          const data = await res.json();
          setRatings(data.ratings || []);
          setAverages(data.averages);
          setCount(data.count || 0);
        }
      } catch (err) {
        console.error('Community ratings fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRatings();
  }, [sponsorId]);

  if (loading) {
    return (
      <Card className="!p-3 animate-pulse">
        <div className="h-3 bg-s2 rounded w-32 mb-2" />
        <div className="h-5 bg-s2 rounded w-16" />
      </Card>
    );
  }

  if (count === 0) {
    return (
      <Card className="!p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={11} className="text-dim" />
          <CardTitle>Community Ratings</CardTitle>
        </div>
        <p className="text-[10px] text-dim font-data">
          No community ratings yet. Be the first to rate this sponsor.
        </p>
      </Card>
    );
  }

  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users size={11} className="text-amber" />
          <CardTitle>Community Ratings</CardTitle>
        </div>
        <span className="font-data text-[9px] text-dim">{count} reviews</span>
      </div>

      {/* Average score */}
      {averages && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-data text-xl font-bold text-amber tabular-nums">
            {averages.overall.toFixed(1)}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                className={cn(
                  s <= Math.round(averages.overall)
                    ? 'fill-amber text-amber'
                    : 'text-s4'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {ratings.slice(0, 5).map((r, i) => (
          <div key={i} className="border-t border-border/30 pt-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-data text-cyan uppercase">
                {r.interaction_type.replace('_', ' ')}
              </span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={8}
                    className={cn(
                      s <= r.rating_overall ? 'fill-amber text-amber' : 'text-s4'
                    )}
                  />
                ))}
              </div>
            </div>
            {r.comment && (
              <p className="text-[10px] text-dim leading-relaxed">
                {r.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/community/CommunityRatings.tsx
git commit -m "feat(ui): add CommunityRatings display component

Shows aggregated community rating average, star display, and
individual review cards for company profile pages."
```

---

### Task 25: Success Stories + Salary Reports Components

**Files:**
- Create: `frontend/src/components/community/SuccessStories.tsx`
- Create: `frontend/src/components/community/SalaryReports.tsx`

- [ ] **Step 1 (4 min):** Create the SuccessStories display component.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Award, UserCheck } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

interface Story {
  story_text: string;
  visa_route: string | null;
  year: number | null;
  is_anonymous: boolean;
  created_at: string;
}

interface SuccessStoriesProps {
  sponsorId: string;
}

export function SuccessStories({ sponsorId }: SuccessStoriesProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStories() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/success-stories/${sponsorId}`
        );
        if (res.ok) {
          setStories(await res.json());
        }
      } catch (err) {
        console.error('Success stories fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStories();
  }, [sponsorId]);

  if (loading || stories.length === 0) return null;

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Award size={11} className="text-green" />
        <CardTitle>Success Stories</CardTitle>
        <span className="ml-auto font-data text-[9px] text-green bg-green/10 px-1.5 py-0.5">
          {stories.length} sponsored
        </span>
      </div>
      <div className="space-y-2">
        {stories.map((s, i) => (
          <div
            key={i}
            className="border border-border/30 p-2 stagger-item"
          >
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={10} className="text-green" />
              <span className="text-[9px] font-data text-green">
                {s.visa_route || 'Visa sponsored'}{s.year ? ` (${s.year})` : ''}
              </span>
            </div>
            <p className="text-[10px] text-dim leading-relaxed">{s.story_text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2 (4 min):** Create the SalaryReports display component.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

interface SalaryData {
  role_title: string;
  visa_route: string | null;
  report_count: number;
  median_salary: number;
  min_salary: number;
  max_salary: number;
}

interface SalaryReportsProps {
  sponsorId: string;
}

export function SalaryReports({ sponsorId }: SalaryReportsProps) {
  const [data, setData] = useState<SalaryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSalary() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/salary-reports/${sponsorId}`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Salary reports fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSalary();
  }, [sponsorId]);

  if (loading || data.length === 0) return null;

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Banknote size={11} className="text-amber" />
        <CardTitle>Community Salary Reports</CardTitle>
      </div>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between py-1 border-b border-border/20">
            <div>
              <span className="text-[11px] font-data text-text">{d.role_title}</span>
              {d.visa_route && (
                <span className="ml-1.5 text-[9px] font-data text-cyan">
                  ({d.visa_route})
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="font-data text-[11px] font-bold text-amber tabular-nums">
                £{Math.round(d.median_salary).toLocaleString()}
              </span>
              <span className="font-data text-[8px] text-dim block">
                {d.report_count} reports | £{Math.round(d.min_salary).toLocaleString()}-£{Math.round(d.max_salary).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/community/SuccessStories.tsx \
  frontend/src/components/community/SalaryReports.tsx
git commit -m "feat(ui): add SuccessStories and SalaryReports community components

SuccessStories shows approved visa success stories with route and year.
SalaryReports shows aggregated salary data (>= 3 threshold enforced)."
```

---

## Phase 5: Gamification (Tasks 26-29)

### Task 26: Create Gamification Database Tables

**Files:**
- Create: `supabase/migrations/20260323000004_gamification_tables.sql`

- [ ] **Step 1 (4 min):** Write the migration for `user_activity`, `user_achievements`, and `user_streaks`.

```sql
-- supabase/migrations/20260323000004_gamification_tables.sql
-- Gamification: activity points, achievements, streaks

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_user_activity_user ON user_activity (user_id, created_at DESC);
CREATE INDEX idx_user_activity_daily ON user_activity (user_id, (created_at::date));

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS user_streaks (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_check_in DATE,
    total_points INTEGER DEFAULT 0
);

-- RLS Policies
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own activity" ON user_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages activity" ON user_activity FOR ALL USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Service role manages achievements" ON user_achievements FOR ALL USING (true);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own streaks" ON user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages streaks" ON user_streaks FOR ALL USING (true);
```

- [ ] **Step 2 (2 min):** Apply the migration.

```bash
cd supabase && npx supabase db push
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add supabase/migrations/20260323000004_gamification_tables.sql
git commit -m "feat(db): create user_activity, user_achievements, user_streaks tables

Full RLS: user reads own data, public reads achievements,
service role manages all. Indexed for daily activity queries."
```

---

### Task 27: Gamification API Endpoints

**Files:**
- Create: `backend/app/api/v1/gamification.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1 (5 min):** Create the gamification backend with check-in, activity tracking, and stats.

```python
"""
Gamification API: points, streaks, achievements.
"""

import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/gamification", tags=["gamification"])

DAILY_CAP = 50

POINT_MAP = {
    "watch": 5,
    "rate": 10,
    "salary_report": 15,
    "success_story": 20,
    "raw_tool": 5,
    "checkin": 3,
    "report_data": 25,
}

ACHIEVEMENTS = {
    "first_watch": {"label": "First Watch", "description": "Watched first company", "condition_type": "watch", "threshold": 1},
    "analyst": {"label": "Analyst", "description": "Used 5 RAW tools", "condition_type": "raw_tool", "threshold": 5},
    "researcher": {"label": "Researcher", "description": "Rated 10 sponsors", "condition_type": "rate", "threshold": 10},
    "deep_diver": {"label": "Deep Diver", "description": "Viewed 50 company profiles", "condition_type": "view_profile", "threshold": 50},
    "contributor": {"label": "Contributor", "description": "Submitted 5 community ratings", "condition_type": "rate", "threshold": 5},
    "streak_7": {"label": "Week Warrior", "description": "7-day check-in streak", "condition_type": "streak", "threshold": 7},
    "streak_30": {"label": "Monthly Master", "description": "30-day check-in streak", "condition_type": "streak", "threshold": 30},
}


class TrackActivity(BaseModel):
    activity_type: str = Field(..., pattern=r"^(watch|rate|salary_report|success_story|raw_tool|view_profile|report_data)$")
    target_id: Optional[str] = None


@router.post("/checkin")
async def daily_checkin(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Daily check-in for streak and points."""
    uid = str(user.id)
    today = date.today()

    # Check if already checked in today
    existing = await db.execute(
        text("""
            SELECT id FROM user_activity
            WHERE user_id = :uid AND activity_type = 'checkin'
              AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    if existing.first():
        return {"status": "already_checked_in", "points": 0}

    # Check daily cap
    day_points = await db.execute(
        text("""
            SELECT COALESCE(SUM(points), 0) as total
            FROM user_activity
            WHERE user_id = :uid AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    current_daily = day_points.scalar() or 0
    if current_daily >= DAILY_CAP:
        return {"status": "daily_cap_reached", "points": 0}

    points = POINT_MAP["checkin"]

    # Record activity
    await db.execute(
        text("""
            INSERT INTO user_activity (user_id, activity_type, points, metadata)
            VALUES (:uid, 'checkin', :pts, '{}')
        """),
        {"uid": uid, "pts": points},
    )

    # Update streak
    await db.execute(
        text("""
            INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_check_in, total_points)
            VALUES (:uid, 1, 1, :today, :pts)
            ON CONFLICT (user_id) DO UPDATE SET
                current_streak = CASE
                    WHEN user_streaks.last_check_in = :yesterday THEN user_streaks.current_streak + 1
                    WHEN user_streaks.last_check_in = :today THEN user_streaks.current_streak
                    ELSE 1
                END,
                longest_streak = GREATEST(
                    user_streaks.longest_streak,
                    CASE
                        WHEN user_streaks.last_check_in = :yesterday THEN user_streaks.current_streak + 1
                        ELSE 1
                    END
                ),
                last_check_in = :today,
                total_points = user_streaks.total_points + :pts
        """),
        {"uid": uid, "today": today, "yesterday": today - timedelta(days=1), "pts": points},
    )

    await db.commit()

    # Check streak achievements
    streak_result = await db.execute(
        text("SELECT current_streak FROM user_streaks WHERE user_id = :uid"),
        {"uid": uid},
    )
    current_streak = streak_result.scalar() or 0
    for key, ach in ACHIEVEMENTS.items():
        if ach["condition_type"] == "streak" and current_streak >= ach["threshold"]:
            await db.execute(
                text("""
                    INSERT INTO user_achievements (user_id, achievement_key)
                    VALUES (:uid, :key)
                    ON CONFLICT (user_id, achievement_key) DO NOTHING
                """),
                {"uid": uid, "key": key},
            )
    await db.commit()

    return {"status": "checked_in", "points": points, "streak": current_streak}


@router.post("/track")
async def track_activity(
    data: TrackActivity,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Track an activity for points. Server validates idempotency."""
    uid = str(user.id)
    today = date.today()

    # Check idempotency for target-specific actions
    if data.target_id and data.activity_type in ("watch", "rate"):
        existing = await db.execute(
            text("""
                SELECT id FROM user_activity
                WHERE user_id = :uid AND activity_type = :atype
                  AND metadata->>'target_id' = :tid
            """),
            {"uid": uid, "atype": data.activity_type, "tid": data.target_id},
        )
        if existing.first():
            return {"status": "already_tracked", "points": 0}

    # Check daily cap
    day_points = await db.execute(
        text("""
            SELECT COALESCE(SUM(points), 0) as total
            FROM user_activity
            WHERE user_id = :uid AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    current_daily = day_points.scalar() or 0
    if current_daily >= DAILY_CAP:
        return {"status": "daily_cap_reached", "points": 0}

    points = POINT_MAP.get(data.activity_type, 0)
    if points == 0:
        return {"status": "unknown_activity", "points": 0}

    import json
    metadata = json.dumps({"target_id": data.target_id} if data.target_id else {})

    await db.execute(
        text("""
            INSERT INTO user_activity (user_id, activity_type, points, metadata)
            VALUES (:uid, :atype, :pts, :meta::jsonb)
        """),
        {"uid": uid, "atype": data.activity_type, "pts": points, "meta": metadata},
    )

    # Update total points
    await db.execute(
        text("""
            INSERT INTO user_streaks (user_id, total_points)
            VALUES (:uid, :pts)
            ON CONFLICT (user_id) DO UPDATE SET
                total_points = user_streaks.total_points + :pts
        """),
        {"uid": uid, "pts": points},
    )

    await db.commit()

    # Check activity-based achievements
    for key, ach in ACHIEVEMENTS.items():
        if ach["condition_type"] == data.activity_type:
            count_result = await db.execute(
                text("""
                    SELECT COUNT(*) FROM user_activity
                    WHERE user_id = :uid AND activity_type = :atype
                """),
                {"uid": uid, "atype": data.activity_type},
            )
            total_count = count_result.scalar() or 0
            if total_count >= ach["threshold"]:
                await db.execute(
                    text("""
                        INSERT INTO user_achievements (user_id, achievement_key)
                        VALUES (:uid, :key)
                        ON CONFLICT (user_id, achievement_key) DO NOTHING
                    """),
                    {"uid": uid, "key": key},
                )
    await db.commit()

    return {"status": "tracked", "points": points}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get user's gamification stats: points, streak, achievements."""
    uid = str(user.id)

    streak_result = await db.execute(
        text("SELECT * FROM user_streaks WHERE user_id = :uid"),
        {"uid": uid},
    )
    streak = streak_result.mappings().one_or_none()

    achievements_result = await db.execute(
        text("SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = :uid"),
        {"uid": uid},
    )
    achievements = [
        {"key": r["achievement_key"], "unlocked_at": str(r["unlocked_at"])}
        for r in achievements_result.mappings().all()
    ]

    return {
        "total_points": streak["total_points"] if streak else 0,
        "current_streak": streak["current_streak"] if streak else 0,
        "longest_streak": streak["longest_streak"] if streak else 0,
        "last_check_in": str(streak["last_check_in"]) if streak and streak["last_check_in"] else None,
        "achievements": achievements,
        "achievement_definitions": {
            k: {"label": v["label"], "description": v["description"]}
            for k, v in ACHIEVEMENTS.items()
        },
    }
```

- [ ] **Step 2 (2 min):** Register the router in `backend/app/main.py`.

```python
from app.api.v1.gamification import router as gamification_router
app.include_router(gamification_router, prefix="/api/v1")
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add backend/app/api/v1/gamification.py backend/app/main.py
git commit -m "feat(api): add gamification endpoints (check-in, activity tracking, stats)

50pt daily cap, idempotent tracking, streak computation, automatic
achievement unlocking. 7 achievement types defined."
```

---

### Task 28: Streak Counter + Points Display Components

**Files:**
- Create: `frontend/src/components/gamification/StreakCounter.tsx`
- Create: `frontend/src/components/gamification/PointsDisplay.tsx`

- [ ] **Step 1 (3 min):** Create the StreakCounter component for Topbar/Sidebar display.

```tsx
'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakCounterProps {
  streak: number;
  compact?: boolean;
  className?: string;
}

export function StreakCounter({ streak, compact = false, className }: StreakCounterProps) {
  if (streak === 0 && compact) return null;

  const flameColor = streak >= 30 ? 'text-red' : streak >= 7 ? 'text-amber' : 'text-dim';

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={`${streak}-day check-in streak`}
    >
      <Flame size={compact ? 10 : 14} className={flameColor} />
      {!compact && (
        <span className={cn('font-data text-[10px] font-bold tabular-nums', flameColor)}>
          {streak}
        </span>
      )}
      {!compact && streak > 0 && (
        <span className="font-data text-[8px] text-dim uppercase">day streak</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2 (3 min):** Create the PointsDisplay component.

```tsx
'use client';

import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsDisplayProps {
  points: number;
  compact?: boolean;
  className?: string;
}

export function PointsDisplay({ points, compact = false, className }: PointsDisplayProps) {
  const tier =
    points >= 1000
      ? { label: 'EXPERT', color: 'text-amber' }
      : points >= 500
        ? { label: 'ANALYST', color: 'text-cyan' }
        : points >= 100
          ? { label: 'RESEARCHER', color: 'text-green' }
          : { label: 'NEWCOMER', color: 'text-dim' };

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={`Research Score: ${points} points (${tier.label})`}
    >
      <Trophy size={compact ? 10 : 12} className={tier.color} />
      <span className={cn('font-data font-bold tabular-nums', tier.color, compact ? 'text-[9px]' : 'text-[11px]')}>
        {points}
      </span>
      {!compact && (
        <span className={cn('font-data text-[8px] uppercase tracking-wider', tier.color)}>
          {tier.label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/gamification/StreakCounter.tsx \
  frontend/src/components/gamification/PointsDisplay.tsx
git commit -m "feat(ui): add StreakCounter and PointsDisplay gamification components

StreakCounter: flame icon with color tiers (dim < 7d, amber >= 7d, red >= 30d).
PointsDisplay: trophy icon with tier labels (Newcomer/Researcher/Analyst/Expert)."
```

---

### Task 29: Achievement Badge Component

**Files:**
- Create: `frontend/src/components/gamification/AchievementBadge.tsx`

- [ ] **Step 1 (3 min):** Create the achievement badge display component.

```tsx
'use client';

import { Trophy, Star, Search, Eye, Users, Flame, Brain, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface AchievementBadgeProps {
  achievementKey: string;
  label: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  size?: 'sm' | 'md';
}

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_watch: Star,
  analyst: Brain,
  researcher: Search,
  deep_diver: Eye,
  contributor: MessageSquare,
  streak_7: Flame,
  streak_30: Flame,
};

const ACHIEVEMENT_COLORS: Record<string, string> = {
  first_watch: 'text-amber',
  analyst: 'text-purple',
  researcher: 'text-cyan',
  deep_diver: 'text-green',
  contributor: 'text-amber',
  streak_7: 'text-amber',
  streak_30: 'text-red',
};

export function AchievementBadge({
  achievementKey,
  label,
  description,
  unlocked,
  unlockedAt,
  size = 'md',
}: AchievementBadgeProps) {
  const Icon = ACHIEVEMENT_ICONS[achievementKey] || Trophy;
  const color = unlocked
    ? ACHIEVEMENT_COLORS[achievementKey] || 'text-amber'
    : 'text-muted';
  const iconSize = size === 'sm' ? 14 : 20;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 border transition-all',
        unlocked
          ? 'border-amber/20 bg-amber/5'
          : 'border-border bg-s1 opacity-40'
      )}
      title={unlocked ? `Unlocked: ${description}` : `Locked: ${description}`}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          size === 'sm' ? 'h-7 w-7' : 'h-10 w-10',
          unlocked ? 'bg-amber/10' : 'bg-s3'
        )}
      >
        <Icon size={iconSize} className={color} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'font-data font-bold uppercase tracking-wider truncate',
            size === 'sm' ? 'text-[9px]' : 'text-[10px]',
            color
          )}
        >
          {label}
        </p>
        <p className="text-[8px] text-dim truncate">{description}</p>
        {unlocked && unlockedAt && (
          <p className="text-[7px] text-muted font-data">
            Unlocked {new Date(unlockedAt).toLocaleDateString('en-GB')}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/gamification/AchievementBadge.tsx
git commit -m "feat(ui): add AchievementBadge component with per-achievement icons

Shows locked/unlocked state with icon, label, description, and unlock date.
7 achievement types with custom icons and colors."
```

---

## Phase 6: Visual Polish (Tasks 30-33)

### Task 30: Animated Background Radar Grid

**Files:**
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1 (3 min):** Add the animated radar background CSS. Append to the end of `globals.css`:

```css
/* ===== Phase 6: Visual Polish ===== */

/* Animated background radar grid */
.bg-radar {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.bg-radar::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 1px solid rgba(245, 166, 35, 0.03);
  transform: translate(-50%, -50%) scale(0);
  animation: background-radar 60s ease-out infinite;
}

.bg-radar::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 1px solid rgba(245, 166, 35, 0.03);
  transform: translate(-50%, -50%) scale(0);
  animation: background-radar 60s ease-out infinite;
  animation-delay: 30s;
}

/* Subtle dot grid pattern */
.bg-dots {
  background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Gradient border on hover for cards */
.hover-gradient-border {
  position: relative;
}
.hover-gradient-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  background: linear-gradient(135deg, rgba(245,166,35,0.3) 0%, transparent 50%, rgba(74,158,255,0.2) 100%);
  border-radius: inherit;
  z-index: -1;
  opacity: 0;
  transition: opacity 200ms ease-out;
}
.hover-gradient-border:hover::before {
  opacity: 1;
}

/* Fresh data highlight (< 24h) */
.fresh-data {
  border-left: 2px solid rgba(0, 229, 255, 0.4) !important;
  background: rgba(0, 229, 255, 0.02);
}

/* Critical alert glow halo */
.alert-glow {
  animation: pulse-glow 2s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(255, 71, 87, 0.15);
}
```

- [ ] **Step 2 (2 min):** Add the background elements to `layout.tsx`. In `RootLayout`, add the radar and dot grid as the first children inside `<body>`:

```tsx
<body className="bg-bg font-ui text-text antialiased">
  <div className="bg-radar" aria-hidden="true" />
  <div className="bg-dots fixed inset-0 pointer-events-none z-[-1]" aria-hidden="true" />
  <AppShell>{children}</AppShell>
</body>
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/styles/globals.css frontend/src/app/layout.tsx
git commit -m "feat(ui): add animated radar background + dot grid + gradient borders

Subtle 60s radar sweep animation, 24px dot grid at 3% opacity,
gradient border on hover, fresh data highlight, and alert glow halo."
```

---

### Task 31: Upgrade Card Hover with Gradient Borders

**Files:**
- Modify: `frontend/src/components/ui/Card.tsx`

- [ ] **Step 1 (3 min):** Update `Card` interactive variant to use the gradient border on hover. Replace the `interactive` clause:

Replace:
```tsx
interactive && 'hover:border-amber/20 hover:shadow-[0_0_20px_-8px_rgba(245,166,35,0.08)] cursor-pointer',
```

With:
```tsx
interactive && 'hover-gradient-border hover:shadow-glow-amber cursor-pointer hover:-translate-y-0.5 transition-transform',
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/components/ui/Card.tsx
git commit -m "feat(ui): upgrade Card interactive variant with gradient border and lift

Cards now show a subtle amber-to-blue gradient border on hover
with shadow glow and slight upward translate."
```

---

### Task 32: Sound Effects System (Optional)

**Files:**
- Create: `frontend/src/hooks/useSoundEffects.ts`
- Create: `frontend/src/lib/sounds.ts`

- [ ] **Step 1 (3 min):** Create the sound effects hook (off by default, user-configurable).

```tsx
// frontend/src/lib/sounds.ts
'use client';

// Sound effect URLs (tiny base64 inline or hosted audio)
// These are placeholder paths — replace with actual audio files
const SOUND_URLS = {
  notification: '/sounds/notification.mp3',
  milestone: '/sounds/milestone.mp3',
  achievement: '/sounds/achievement.mp3',
} as const;

type SoundType = keyof typeof SOUND_URLS;

class SoundManager {
  private enabled = false;
  private audioCache = new Map<SoundType, HTMLAudioElement>();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sponsorintel-sounds', enabled ? '1' : '0');
    }
  }

  isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('sponsorintel-sounds');
    this.enabled = stored === '1';
    return this.enabled;
  }

  play(type: SoundType) {
    if (!this.enabled || typeof window === 'undefined') return;

    try {
      let audio = this.audioCache.get(type);
      if (!audio) {
        audio = new Audio(SOUND_URLS[type]);
        audio.volume = 0.3;
        this.audioCache.set(type, audio);
      }
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Silently ignore autoplay restrictions
      });
    } catch {
      // Audio not available
    }
  }
}

export const soundManager = new SoundManager();
```

- [ ] **Step 2 (3 min):** Create the hook for components to use.

```tsx
// frontend/src/hooks/useSoundEffects.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { soundManager } from '@/lib/sounds';

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(soundManager.isEnabled());
  }, []);

  const toggle = useCallback(() => {
    const newState = !enabled;
    setEnabled(newState);
    soundManager.setEnabled(newState);
  }, [enabled]);

  const play = useCallback((type: 'notification' | 'milestone' | 'achievement') => {
    soundManager.play(type);
  }, []);

  return { enabled, toggle, play };
}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/lib/sounds.ts frontend/src/hooks/useSoundEffects.ts
git commit -m "feat(ui): add optional sound effects system (off by default)

SoundManager with localStorage persistence. Supports notification,
milestone, and achievement sounds. User-toggleable."
```

---

### Task 33: Data Highlights and Final Consistency Pass

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/src/components/ui/Badge.tsx`

- [ ] **Step 1 (3 min):** Add the NEW micro-tag class and data freshness utilities. Append to `globals.css`:

```css
/* NEW micro-tag for freshly enriched companies */
.micro-tag-new {
  @apply inline-flex items-center gap-0.5 px-1 py-0 text-[7px] font-data font-bold uppercase tracking-wider;
  @apply bg-cyan/15 text-cyan border border-cyan/20;
  animation: fadeIn 200ms ease-out;
}

/* Score pulse animation on re-score */
.score-pulse {
  animation: pulse-glow-cyan 1s ease-out;
}

/* Page enter animation wrapper */
.page-animate-in {
  animation: page-enter 300ms ease-out;
}

/* Staggered grid items */
.stagger-grid > * {
  animation: stagger-in 300ms ease-out both;
}
.stagger-grid > *:nth-child(1) { animation-delay: 0ms; }
.stagger-grid > *:nth-child(2) { animation-delay: 50ms; }
.stagger-grid > *:nth-child(3) { animation-delay: 100ms; }
.stagger-grid > *:nth-child(4) { animation-delay: 150ms; }
.stagger-grid > *:nth-child(5) { animation-delay: 200ms; }
.stagger-grid > *:nth-child(6) { animation-delay: 250ms; }
.stagger-grid > *:nth-child(7) { animation-delay: 300ms; }
.stagger-grid > *:nth-child(8) { animation-delay: 350ms; }
```

- [ ] **Step 2 (3 min):** Update `Badge.tsx` to use the full design token color system. Add a `NEW` variant and `size` prop. Update the Badge component to match the spec:

```tsx
'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'red' | 'amber' | 'blue' | 'cyan' | 'purple' | 'new';
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANTS: Record<string, string> = {
  default: 'bg-s3 text-dim border border-border',
  green: 'bg-green/15 text-green border border-green/20',
  red: 'bg-red/15 text-red border border-red/20',
  amber: 'bg-amber/15 text-amber border border-amber/20',
  blue: 'bg-accent/15 text-accent border border-accent/20',
  cyan: 'bg-cyan/15 text-cyan border border-cyan/20',
  purple: 'bg-purple/15 text-purple border border-purple/20',
  new: 'bg-cyan/15 text-cyan border border-cyan/20 animate-new-item-flash',
};

const SIZES: Record<string, string> = {
  sm: 'text-3xs px-1 py-0.5',
  md: 'text-2xs px-1.5 py-0.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-data font-semibold uppercase tracking-wider',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/styles/globals.css frontend/src/components/ui/Badge.tsx
git commit -m "feat(ui): add data highlights, NEW micro-tag, Badge redesign

Adds fresh-data highlights, stagger-grid animations, page-enter class,
score-pulse, and NEW variant Badge per the design token system."
```

---

## Integration & Type Updates

### Task 34: Update TypeScript Types for New Features

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1 (3 min):** Add types for all new community and gamification features. Append to the end of `types/index.ts`:

```typescript
// ---- User Profile ----

export interface UserProfile {
  user_id: string;
  visa_route: string | null;
  target_industries: string[] | null;
  target_locations: string[] | null;
  current_status: string | null;
  nationality: string | null;
  setup_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// ---- Community ----

export interface CommunityRating {
  rating_overall: number;
  rating_process: number | null;
  rating_interview: number | null;
  rating_sponsorship: number | null;
  rating_culture: number | null;
  interaction_type: string;
  comment: string | null;
  created_at: string;
}

export interface SalaryReport {
  role_title: string;
  visa_route: string | null;
  report_count: number;
  median_salary: number;
  min_salary: number;
  max_salary: number;
}

export interface SuccessStory {
  story_text: string;
  visa_route: string | null;
  year: number | null;
  is_anonymous: boolean;
  created_at: string;
}

// ---- Gamification ----

export interface GamificationStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  last_check_in: string | null;
  achievements: Array<{
    key: string;
    unlocked_at: string;
  }>;
  achievement_definitions: Record<
    string,
    { label: string; description: string }
  >;
}

// ---- Saved Search ----

export interface SavedSearch {
  id: string;
  name: string;
  filters: Record<string, string>;
  result_count_at_save: number | null;
  last_viewed_at: string | null;
  created_at: string | null;
}

// ---- Score Breakdown ----

export interface ScoreFactor {
  key: string;
  label: string;
  weight: number;
  score: number | null;
}

export interface ScoreBreakdownData {
  sponsor_id: string;
  overall_score: number;
  computed_at: string;
  factors: ScoreFactor[];
  risk_flags: string[];
  suggestion: string | null;
}

// ---- Daily Briefing ----

export interface BriefingItem {
  type: string;
  text: string;
  link: string;
  color: string;
}

export interface DailyBriefingData {
  date: string;
  items: BriefingItem[];
  profile_setup: boolean;
}
```

- [ ] **Step 2 (1 min):** Commit.

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): add TypeScript types for community, gamification, profiles, saved searches

Adds UserProfile, CommunityRating, SalaryReport, SuccessStory,
GamificationStats, SavedSearch, ScoreBreakdownData, DailyBriefingData."
```

---

### Task 35: Integrate Gamification into Sidebar and Topbar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/Topbar.tsx`

- [ ] **Step 1 (4 min):** Add gamification stats to the Sidebar. Import the components and fetch user stats. In `Sidebar.tsx`, add a state hook for gamification data and display the points and streak in the footer section, between the collapse toggle and the version label:

```tsx
import { PointsDisplay } from '@/components/gamification/PointsDisplay';
import { StreakCounter } from '@/components/gamification/StreakCounter';
import { useAuthStore } from '@/lib/auth';

// Inside Sidebar component, add:
const { token, isAuthenticated } = useAuthStore();
const [gamStats, setGamStats] = useState<{ total_points: number; current_streak: number } | null>(null);

useEffect(() => {
  if (!isAuthenticated || !token) return;
  async function fetchGamStats() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/gamification/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setGamStats({ total_points: data.total_points, current_streak: data.current_streak });
      }
    } catch { /* silent */ }
  }
  fetchGamStats();
}, [isAuthenticated, token]);
```

Add the display in the bottom section (before the version label), wrapped in `!collapsed &&`:

```tsx
{!collapsed && gamStats && (
  <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
    <PointsDisplay points={gamStats.total_points} compact />
    <StreakCounter streak={gamStats.current_streak} compact />
  </div>
)}
```

- [ ] **Step 2 (3 min):** Add streak counter to `Topbar.tsx`. Import and display next to the notification bell:

```tsx
import { StreakCounter } from '@/components/gamification/StreakCounter';

// In the right actions div, before the Bell button:
{/* Streak */}
{isAuthenticated && (
  <StreakCounter streak={0} compact className="mr-1" />
)}
```

Note: The streak value will be wired to the Zustand store or fetched via SWR once the gamification data is loaded globally. For now, this sets up the layout position.

- [ ] **Step 3 (1 min):** Commit.

```bash
git add frontend/src/components/layout/Sidebar.tsx \
  frontend/src/components/layout/Topbar.tsx
git commit -m "feat(ui): integrate gamification points and streak into Sidebar and Topbar

Sidebar footer shows research score and streak counter.
Topbar shows compact streak indicator next to notifications."
```

---

## Summary

**Total tasks:** 35
**Phase 1 (Core UX):** Tasks 1-10 — Tailwind tokens, user profiles, setup wizard, TrendArrow, EmptyState, NumberAnimation, LoadingTerminal, ScoreBreakdown, DailyBriefing
**Phase 2 (Power User):** Tasks 11-17 — Command palette upgrade, HoverPreview actions, saved searches, shortcut overlay, StatCard animation, trend arrows, contextual loading
**Phase 3 (Real-time):** Tasks 18-20 — Realtime hook, dashboard data flash, score badge pulse
**Phase 4 (Community):** Tasks 21-25 — Community tables, API, rating form, ratings display, success stories + salary reports
**Phase 5 (Gamification):** Tasks 26-29 — Gamification tables, API, streak/points components, achievement badges
**Phase 6 (Visual Polish):** Tasks 30-33 — Animated background, gradient borders, sounds, data highlights
**Integration:** Tasks 34-35 — TypeScript types, Sidebar/Topbar gamification integration

**New database tables (Supabase SQL):** `user_profiles`, `saved_searches`, `community_ratings`, `salary_reports`, `success_stories`, `user_activity`, `user_achievements`, `user_streaks`

**New backend routes:** `/profile`, `/dashboard`, `/community`, `/gamification`, `/searches`, `/sponsors/{id}/score-breakdown`

**New frontend components:** SetupWizard, TrendArrow, EmptyState, NumberAnimation, LoadingTerminal, ScoreBreakdown, DailyBriefing, ShortcutOverlay, SaveSearchButton, RatingForm, CommunityRatings, SuccessStories, SalaryReports, StreakCounter, PointsDisplay, AchievementBadge
