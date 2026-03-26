# Sub-Project 4: Notification & Alerting System

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Sub-Project 1 (Data Foundation — register diffs, Intel items)

## Purpose

Replace bespoke notification code with a production notification engine. Users get instant alerts for sponsor changes, new jobs, policy updates, and risk signals across email, in-app, and webhook channels.

## Components

### 1. Novu Integration (38K stars)

Open-source notification infrastructure with visual workflow builder.

**Notification workflows:**
- **New Sponsor Alert:** Register diff detects new sponsor → match against user's saved searches → in-app + email
- **Rating Change Alert:** Sponsor A→B rating change → alert all users tracking that sponsor → in-app + email
- **Job Match Alert:** New job matches user's saved search criteria → in-app notification
- **Intel Alert:** Critical/high impact intel item matches user's subscription → in-app + email_instant
- **Weekly Digest:** Monday 06:00 UTC summary of all changes, new jobs, intel items → email
- **Risk Signal:** Company shows late filings, outstanding charges, or officer departures → in-app

**Architecture:**
- Self-host Novu on Railway (Docker container)
- Or use Novu Cloud free tier (30K events/month)
- Backend triggers Novu events via Python SDK
- Novu handles delivery, retries, preference management
- User notification preferences stored in Novu subscriber profile

### 2. Resend Email Delivery

Resend for transactional emails (already in plan from Intel spec).

**Email templates:**
- Welcome email (on registration)
- Sponsor alert email (new/changed/removed sponsor)
- Weekly digest email (HTML with company logos, job counts, trend charts)
- Intel alert email (policy change with impact summary)

### 3. Real-time WebSocket Signals

Enhance existing WebSocket endpoint for live dashboard updates.

**Signal types pushed to connected clients:**
- `sponsor:new` — New sponsor detected in register
- `sponsor:rating_change` — Rating changed
- `job:new_batch` — New batch of jobs discovered
- `intel:critical` — Critical immigration policy change
- `agent:mission_complete` — Agent finished a task (for admin dashboard)

### 4. Webhook Integration

Allow users to configure webhook URLs for programmatic alerts.

**Use case:** Immigration lawyers, HR platforms, recruitment agencies want to integrate SponsorIntel signals into their own systems.

**Endpoint:** `POST /api/v1/webhooks` — Register a webhook URL with event filters.

## Success Criteria

1. Users receive email alerts within 5 minutes of a critical sponsor change
2. Weekly digest emails have >30% open rate
3. WebSocket updates appear on dashboard within 2 seconds of event
4. Webhook delivery has 99.5% success rate with automatic retries
