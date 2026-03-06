// ---- Sponsor ----

export interface Sponsor {
  id: string;
  organisation_name: string;
  town_city: string | null;
  county: string | null;
  type_and_rating: string | null;
  rating: string | null;
  route: string[] | null;
  is_active: boolean;
  first_seen_date: string | null;
  last_seen_date: string | null;
  overall_score: number | null;
  active_job_count: number | null;
}

export interface SponsorDetail extends Sponsor {
  consecutive_a_rating_days: number;
  times_rating_changed: number;
  profile: CompanyProfile | null;
  score_breakdown: ScoreBreakdown | null;
}

export interface SponsorChange {
  id: string;
  change_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
  significance_score: number | null;
}

export interface PaginatedSponsors {
  data: Sponsor[];
  total: number;
  page: number;
  pages: number;
}

// ---- Company Profile ----

export interface CompanyProfile {
  id: string;
  sponsor_id: string;

  // Companies House
  companies_house_number: string | null;
  company_status: string | null;
  incorporation_date: string | null;
  company_type: string | null;
  sic_codes: Record<string, string> | null;
  industry_primary: string | null;
  industry_tags: string[] | null;
  registered_address: Record<string, string> | null;
  trading_address: Record<string, string> | null;

  // Financial
  has_charges: boolean | null;
  charge_count: number | null;
  has_insolvency_history: boolean | null;
  has_ccjs: boolean | null;
  last_accounts_date: string | null;
  next_accounts_due: string | null;
  accounts_overdue: boolean | null;
  confirmation_statement_overdue: boolean | null;
  estimated_revenue_band: string | null;
  credit_risk_score: number | null;

  // Workforce
  employee_count_estimate: number | null;
  employee_count_source: string | null;
  employee_growth_6m: number | null;
  employee_growth_12m: number | null;
  linkedin_url: string | null;
  linkedin_follower_count: number | null;

  // Reputation
  glassdoor_rating: number | null;
  glassdoor_review_count: number | null;
  glassdoor_ceo_approval: number | null;
  glassdoor_recommend_pct: number | null;
  trustpilot_rating: number | null;
  trustpilot_review_count: number | null;
  google_rating: number | null;
  google_review_count: number | null;

  // Online Presence
  website_url: string | null;
  website_domain_age_days: number | null;
  has_careers_page: boolean | null;
  social_links: Record<string, string> | null;
  tech_stack_detected: string[] | null;

  // Meta
  legitimacy_score: number | null;
  enrichment_level: number | null;
  enriched_at: string | null;
}

export interface ScoreBreakdown {
  overall_score: number;
  compliance_score: number | null;
  financial_health_score: number | null;
  hiring_activity_score: number | null;
  reputation_score: number | null;
  legitimacy_score: number | null;
  track_record_score: number | null;
  growth_signal_score: number | null;
  risk_flags: string[] | null;
  computed_at: string;
}

// ---- Jobs ----

export interface Job {
  id: string;
  title_raw: string;
  company_name_raw: string;
  location_raw: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_text_raw: string | null;
  source: string;
  sponsorship_likelihood: number | null;
  posted_date: string | null;
  url: string | null;
  is_on_shortage_list: boolean | null;
}

export interface JobDetail extends Job {
  description_full: string | null;
  skills_extracted: string[] | null;
  sponsorship_signals: Record<string, unknown> | null;
  contract_type: string | null;
  seniority: string | null;
  location_city: string | null;
  location_region: string | null;
  location_is_remote: boolean;
  salary_currency: string | null;
  salary_period: string | null;
  experience_years_min: number | null;
  experience_years_max: number | null;
  meets_salary_threshold: boolean | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  is_expired: boolean;
  sponsor_id: string | null;
}

export interface PaginatedJobs {
  data: Job[];
  total: number;
  page: number;
  pages: number;
}

export interface JobStats {
  total_active: number;
  new_7_days: number;
  sponsorship_likely_count: number;
  median_salary: number | null;
  by_source: Record<string, number>;
  by_city: Array<{ city: string; count: number }>;
}

// ---- Analytics ----

export interface DashboardOverview {
  total_sponsors: number;
  a_rated: number;
  b_rated: number;
  added_30d: number;
  removed_30d: number;
  changed_30d: number;
  total_jobs: number;
  total_enriched: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface AnalyticsTrends {
  sponsor_growth: TrendPoint[];
  rating_changes: { upgrades: number; downgrades: number };
  top_cities: Array<{ city: string; count: number }>;
  top_industries: Array<{ industry: string; count: number }>;
  top_hiring: Array<{ name: string; score: number; jobs: number; city: string }>;
}

export interface FilterOptions {
  cities: string[];
  counties: string[];
  routes: string[];
  industries: string[];
}

// ---- Watchlist ----

export interface WatchlistItem {
  id: string;
  sponsor_id: string;
  sponsor_name: string | null;
  sponsor_score: number | null;
  status: string | null;
  priority: number | null;
  notes: string | null;
  applied_date: string | null;
  next_followup: string | null;
  created_at: string;
}

// ---- Alerts ----

export interface Alert {
  id: string;
  alert_type: string;
  config: Record<string, unknown> | null;
  channel: string;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
}

export interface AlertHistory {
  id: string;
  alert_id: string;
  triggered_at: string;
  payload: Record<string, unknown> | null;
  read: boolean;
}

// ---- Notes ----

export interface UserNote {
  id: string;
  sponsor_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---- User ----

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// ---- Live Feed Event ----

export interface LiveEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  created_at: string;
}
