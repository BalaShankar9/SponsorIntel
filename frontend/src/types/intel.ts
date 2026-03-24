// ---- Intel Module ----

export type IntelTopic =
  | "rule_change"
  | "policy_update"
  | "court_decision"
  | "statistics"
  | "opinion"
  | "news"
  | "community";

export type IntelImpactLevel = "critical" | "high" | "medium" | "low";
export type IntelSourceCategory = "government" | "legal" | "news" | "community";
export type IntelPolicyStage =
  | "proposed"
  | "consultation"
  | "parliamentary_debate"
  | "enacted"
  | "effective";
export type IntelNotifChannel = "in_app" | "email_instant" | "email_digest";
export type IntelItemStatus = "raw" | "classified" | "analyzed" | "deduped";

export interface IntelItem {
  id: string;
  title: string;
  source_name: string;
  source_url: string | null;
  source_category: IntelSourceCategory;
  published_at: string | null;
  content_snippet: string | null;
  topic: IntelTopic | null;
  impact_level: IntelImpactLevel | null;
  visa_routes_affected: string[] | null;
  summary: string | null;
  status: IntelItemStatus;
  created_at: string;
}

export interface IntelItemDetail extends IntelItem {
  content_text: string | null;
  nationalities_affected: string[] | null;
  industries_affected: string[] | null;
  who_affected: string | null;
  action_required: string | null;
  before_after: Record<string, string> | null;
  dedup_cluster_id: string | null;
  scanner_agent: string | null;
  updated_at: string;
}

export interface IntelFeedResponse {
  data: IntelItem[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface IntelFeedFilters {
  topic?: IntelTopic;
  impact?: IntelImpactLevel;
  visa_route?: string;
  nationality?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface IntelTimelineNode {
  id: string;
  title: string;
  published_at: string | null;
  impact_level: IntelImpactLevel | null;
  visa_routes_affected: string[] | null;
  summary: string | null;
  before_after: Record<string, string> | null;
}

export interface IntelTimelineResponse {
  nodes: IntelTimelineNode[];
  total: number;
}

export interface IntelCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  visa_routes: string[] | null;
  source_url: string | null;
  is_confirmed: boolean;
}

export interface IntelCalendarResponse {
  events: IntelCalendarEvent[];
  month: number;
  year: number;
}

export interface IntelStatistic {
  id: string;
  stat_type: string;
  visa_route: string | null;
  nationality: string | null;
  period: string | null;
  value: number;
  previous_value: number | null;
  change_pct: number | null;
  source: string | null;
  published_at: string | null;
}

export interface IntelStatsResponse {
  statistics: IntelStatistic[];
  total: number;
  visa_route: string | null;
}

export interface IntelPolicy {
  id: string;
  title: string;
  description: string | null;
  stage: IntelPolicyStage;
  visa_routes_affected: string[] | null;
  source_url: string | null;
  effective_date: string | null;
  last_update_summary: string | null;
  last_updated_at: string | null;
  created_at: string;
  is_followed: boolean;
}

export interface IntelPolicyListResponse {
  policies: IntelPolicy[];
  total: number;
}

export interface IntelSubscription {
  id: string;
  user_id: string;
  filter_topics: string[] | null;
  filter_visa_routes: string[] | null;
  filter_nationalities: string[] | null;
  filter_industries: string[] | null;
  filter_min_impact: IntelImpactLevel;
  channel: IntelNotifChannel;
  is_active: boolean;
  created_at: string;
}

export interface IntelSubscriptionCreate {
  filter_topics?: string[];
  filter_visa_routes?: string[];
  filter_nationalities?: string[];
  filter_industries?: string[];
  filter_min_impact?: IntelImpactLevel;
  channel?: IntelNotifChannel;
}

export interface IntelNotification {
  id: string;
  intel_item_id: string | null;
  subscription_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  item_impact_level: IntelImpactLevel | null;
  item_source_name: string | null;
}

export interface IntelNotificationListResponse {
  notifications: IntelNotification[];
  total: number;
  unread_count: number;
  page: number;
  pages: number;
}

export interface IntelDigestSection {
  heading: string;
  items: IntelItem[];
}

export interface IntelDigestPreview {
  subject: string;
  generated_at: string;
  top_items: IntelItem[];
  statistics_snapshot: IntelStatistic[];
  upcoming_calendar: IntelCalendarEvent[];
  personalized_items: IntelItem[];
  sections: IntelDigestSection[];
}

// ---- Lawyer Finder ----

export type CaseComplexity = 'straightforward' | 'complex' | 'appeal';
export type RegistrationType = 'oisc' | 'sra';
export type ReviewSource = 'google' | 'trustpilot' | 'user';
export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

export interface LawyerSearchParams {
  visa_route: string;
  nationality?: string;
  location?: string;
  case_complexity: CaseComplexity;
  budget_range?: string;
  language_pref?: string;
  page?: number;
  per_page?: number;
}

export interface LawyerSummary {
  id: string;
  name: string;
  firm_name: string | null;
  registration_type: RegistrationType;
  registration_number: string;
  oisc_level: number | null;
  accreditations: string[];
  practice_areas: string[];
  city: string | null;
  offers_remote: boolean;
  combined_rating: number | null;
  google_review_count: number;
  trustpilot_review_count: number;
  fee_initial_consultation: string | null;
  fee_hourly_range: string | null;
  website: string | null;
  distance_miles: number | null;
  match_score: number;
  why_matched: string;
}

export interface LawyerSearchResponse {
  results: LawyerSummary[];
  total: number;
  page: number;
  per_page: number;
  search_id: string;
}

export interface LawyerDetail extends Omit<LawyerSummary, 'distance_miles' | 'match_score' | 'why_matched'> {
  practising_status: string;
  languages: string[];
  fee_fixed_range: string | null;
  offers_legal_aid: boolean;
  address: string | null;
  postcode: string | null;
  google_rating: number | null;
  trustpilot_rating: number | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  disciplinary_history: Array<{ date: string; summary: string; outcome: string }>;
  last_verified_at: string | null;
  source_url: string | null;
}

export interface LawyerReview {
  id: string;
  source: ReviewSource;
  author_name: string | null;
  rating: number;
  review_text: string | null;
  review_date: string | null;
  visa_route_mentioned: string | null;
  sentiment: ReviewSentiment | null;
}

export interface LawyerReviewsResponse {
  reviews: LawyerReview[];
  total: number;
  page: number;
  per_page: number;
  avg_rating: number | null;
}

export interface LawyerCompareResponse {
  lawyers: LawyerDetail[];
  comparison_dimensions: string[];
}
