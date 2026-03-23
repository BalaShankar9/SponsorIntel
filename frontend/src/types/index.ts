// ---- Sponsor ----

export interface Sponsor {
  id: string;
  organisation_name: string;
  organisation_name_normalised?: string | null;
  town_city?: string | null;
  county?: string | null;
  type_and_rating?: string | null;
  rating?: string | null;
  sponsor_type?: string | null;
  route?: string[] | null;
  is_active?: boolean;
  first_seen_date?: string | null;
  last_seen_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SponsorDetail extends Sponsor {
  consecutive_a_rating_days: number;
  times_rating_changed: number;
  profile: CompanyProfile | null;
  scores: ScoreBreakdown | null;
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

// ---- AI Enrichment ----

export interface AIIntelligence {
  description: string | null;
  services: string[] | null;
  key_facts: string[] | null;
  competitors: string[] | null;
  hiring_sectors: string[] | null;
  typical_sponsored_roles: string[] | null;
  visa_sponsorship_likelihood: string | null;
  company_culture: string | null;
  headquarters_city: string | null;
  parent_company: string | null;
  is_well_known: boolean | null;
  model_used: string | null;
  analyzed_at: string | null;
}

export interface SearchTips {
  search_names: string[] | null;
  job_boards: string[] | null;
  application_tips: string | null;
  best_time_to_apply: string | null;
}

export interface SocialLinks {
  // Nested AI data
  ai_intelligence?: AIIntelligence;
  search_tips?: SearchTips;
  // Contact info
  contact_email?: string;
  contact_phone?: string;
  // Website metadata
  website_description?: string;
  website_title?: string;
  // URL links (dynamic keys like linkedin, companies_house, twitter, etc.)
  [key: string]: string | AIIntelligence | SearchTips | undefined;
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
  careers_page_url: string | null;
  social_links: SocialLinks | null;
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
  location_city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_text_raw: string | null;
  salary_currency: string | null;
  salary_period: string | null;
  source: string;
  source_url: string | null;
  sponsorship_likelihood: number | null;
  sponsorship_signals?: Record<string, unknown> | null;
  posted_date: string | null;
  description_snippet: string | null;
  skills_extracted: string[] | null;
  contract_type: string | null;
  seniority: string | null;
  work_model: string | null;
  is_on_shortage_list: boolean | null;
  meets_salary_threshold: boolean | null;
  sponsor_id: string | null;
  data_quality_score: number | null;
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
  // New swarm fields
  data_quality_score: number | null;
  work_model: string | null;
  department: string | null;
  visa_routes_eligible: string[] | null;
  red_flags: Record<string, unknown> | null;
  culture_signals: Record<string, unknown> | null;
  benefits: Record<string, unknown> | null;
  source_urls: string[] | null;
}

// ---- Swarm ----

export interface SwarmMetrics {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  jobs_scraped: number;
  jobs_validated: number;
  jobs_enriched: number;
  jobs_expired: number;
  errors_total: number;
  llm_calls_count: number;
}

export interface SourceHealth {
  id: string;
  source: string;
  logged_at: string;
  jobs_returned: number;
  success_rate: number;
  avg_completeness: number;
  is_paused: boolean;
}

export interface SwarmAlert {
  id: string;
  alert_type: string;
  source: string | null;
  severity: string;
  message: string;
  created_at: string;
  acknowledged: boolean;
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
  top_sponsor_types: Array<{ sponsor_type: string; count: number }>;
  top_hiring: Array<{ name: string; city: string; consecutive_a_rating_days: number }>;
}

export interface FilterOptions {
  cities: string[];
  counties: string[];
  routes: string[];
  sponsor_types: string[];
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
