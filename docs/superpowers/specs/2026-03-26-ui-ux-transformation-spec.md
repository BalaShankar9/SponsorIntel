# Sub-Project 5: UI/UX Transformation

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Sub-Projects 1, 4 (Data + Notifications feed the UI)

## Purpose

Transform SponsorIntel from a data dashboard into a world-class intelligence terminal that converts first-time visitors into subscribers. Professional landing page, guided onboarding, enhanced visualizations, and polished micro-interactions.

## Components

### 1. Marketing Landing Page (`/`)

Currently redirects to /dashboard. Need a conversion-optimized landing page.

**Sections:**
- Hero: "UK Visa Sponsorship Intelligence" — real-time counter showing total sponsors, live jobs, intel items
- Social proof: "Tracking 140,000+ sponsors across 23 job boards"
- Feature showcase: 6 cards (Search, Jobs, Intel, Map, Trends, Alerts) with live data previews
- Pricing: Embedded pricing component
- CTA: "Start Free — No Credit Card Required"

**Design:** Dark Bloomberg terminal aesthetic (consistent with app). Animated sponsor counter, live job ticker bar, subtle radar animation.

### 2. Onboarding Wizard (Post-Registration)

Guide new users to value within 60 seconds.

**Steps:**
1. "What's your visa route?" — Skilled Worker / Global Talent / Graduate / Other
2. "What's your industry?" — Multi-select from top 10 industries
3. "What's your target salary?" — Slider £25K-£150K
4. "Set up your first alert" — Pre-filled based on selections
5. "Your dashboard is ready" — Redirect to personalized dashboard

**Data stored:** User profile preferences → drives personalized dashboard, job recommendations, intel filtering.

### 3. UK Choropleth Map (Nivo)

Replace current Leaflet map with Nivo `@nivo/geo` choropleth showing sponsor density by region.

**Layers:**
- Sponsor count by county (heat map)
- Average salary by region (color scale)
- Job posting density (bubble overlay)
- Click region → drill down to city-level sponsors

### 4. Enhanced Dashboard Components

**Tremor integration** for professional metric cards:
- Sparklines on all stat cards (7-day trend)
- Area charts for job volume over time
- Bar lists for top industries/cities
- Progress bars for enrichment completion

### 5. Ticker Bar (Live Feed)

Persistent bottom ticker showing real-time events:
- "🟢 New sponsor: TechCorp Ltd (London, A-rated)"
- "📊 42 new Skilled Worker jobs in the last hour"
- "⚠️ Policy Alert: Salary threshold review announced"

Already have `TickerBar.tsx` component — enhance with SignalBus WebSocket feed.

### 6. Page Transitions & Micro-interactions

- Route transitions: fade + slide-up (CSS-only, no library needed)
- Number animations: count-up on stat cards (already have `NumberAnimation.tsx`)
- Skeleton loading: shimmer effect on all data-loading states
- Toast notifications: sonner (already installed) for real-time alerts
- Sound effects: subtle click/notification sounds (already have `useSoundEffects.ts`)

### 7. Mobile Responsive Polish

Current state: basic responsive with `lg:` breakpoints. Need:
- Sidebar → bottom navigation on mobile
- Cards stack to single column
- Tables → card-based list view on mobile
- Touch-friendly filter chips
- Swipe gestures on tracker kanban

### 8. SEO & Meta Tags

- Per-page meta titles/descriptions
- Open Graph images (auto-generated using Satori/`@vercel/og` pattern)
- Structured data (JSON-LD) for job listings (Google for Jobs)
- Sitemap generation for public pages

## Success Criteria

1. Landing page converts >5% of visitors to free signups
2. Onboarding wizard completion rate >70%
3. Mobile Lighthouse score >85
4. All pages have proper meta tags and OG images
5. Page load time <2s on 3G connection (Next.js static generation)
6. Zero layout shift (CLS < 0.1)
