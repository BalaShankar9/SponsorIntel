'use client';

import { ExternalLink, Building2, Calendar, MapPin, Tag, Link2, Brain, Search, Mail, Phone, Briefcase, Globe, Star, Shield } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { SponsorDetail, AIIntelligence, SearchTips } from '@/types';

interface OverviewTabProps {
  sponsor: SponsorDetail;
}

function DataRow({ label, value, color, mono = true }: { label: string; value: string | number | null | undefined; color?: string; mono?: boolean }) {
  const displayValue = value === null || value === undefined || value === '' ? '--' : String(value);
  const isDash = displayValue === '--';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/15 last:border-0 group">
      <span className="text-[11px] text-dim">{label}</span>
      <span className={cn(
        'text-[12px] text-right max-w-[60%] truncate',
        mono && 'font-data',
        isDash ? 'text-muted' : (color || 'text-text')
      )}>
        {displayValue}
      </span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-s1 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-s2/50 px-3 py-2">
        {icon && <span className="text-amber">{icon}</span>}
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber">
          {title}
        </h4>
      </div>
      <div className="px-3 py-2">
        {children}
      </div>
    </div>
  );
}

function SicCodeTag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center rounded bg-s2 px-2 py-0.5 font-data text-[10px] text-dim ring-1 ring-border">
      {code}
    </span>
  );
}

function TagList({ items, color = 'text-cyan', bg = 'bg-cyan/10', ring = 'ring-cyan/15' }: { items: string[]; color?: string; bg?: string; ring?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={cn('rounded px-2 py-0.5 font-data text-[10px] ring-1', color, bg, ring)}>
          {item}
        </span>
      ))}
    </div>
  );
}

/** Keys in social_links that are nested objects or metadata, not clickable URLs */
const SOCIAL_SKIP_KEYS = new Set([
  'ai_intelligence', 'search_tips', 'contact_email', 'contact_phone',
  'website_description', 'website_title', 'website_analysis', 'directors', 'linkedin'
]);

export function OverviewTab({ sponsor }: OverviewTabProps) {
  const profile = sponsor.profile;

  const chNumber = profile?.companies_house_number;
  const chUrl = chNumber
    ? `https://find-and-update.company-information.service.gov.uk/company/${chNumber}`
    : null;

  // Parse SIC codes - handle both array of strings and Record<string, string>
  const sicCodes: string[] = [];
  if (profile?.sic_codes) {
    if (Array.isArray(profile.sic_codes)) {
      sicCodes.push(...(profile.sic_codes as string[]));
    } else if (typeof profile.sic_codes === 'object') {
      Object.entries(profile.sic_codes).forEach(([k, v]) => {
        sicCodes.push(v ? `${k} - ${v}` : k);
      });
    }
  }

  const registeredAddress = profile?.registered_address;
  const fullAddress = registeredAddress
    ? (registeredAddress as Record<string, string>).full_address ||
      Object.values(registeredAddress as Record<string, string>).filter(Boolean).join(', ')
    : null;

  // Extract AI enrichment data from social_links
  const aiIntel = profile?.social_links?.ai_intelligence as AIIntelligence | undefined;
  const searchTips = profile?.social_links?.search_tips as SearchTips | undefined;

  // Filter social_links to only URL entries
  const socialUrlEntries = profile?.social_links
    ? Object.entries(profile.social_links).filter(
        ([key, val]) => !SOCIAL_SKIP_KEYS.has(key) && typeof val === 'string' && (val as string).startsWith('http')
      ) as [string, string][]
    : [];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Left Column: Sponsor Details + AI Intelligence */}
      <div className="space-y-3">
        <SectionCard title="Sponsorship Status" icon={<Building2 size={13} />}>
          <DataRow
            label="Status"
            value={sponsor.is_active ? 'ACTIVE SPONSOR' : 'INACTIVE'}
            color={sponsor.is_active ? 'text-green' : 'text-red'}
          />
          <DataRow
            label="Rating"
            value={sponsor.rating ? `${sponsor.rating}-Rated` : null}
            color={sponsor.rating === 'A' ? 'text-green' : 'text-red'}
          />
          <DataRow label="Sponsor Type" value={sponsor.sponsor_type} />
          <DataRow label="Routes" value={sponsor.route?.join(', ')} />
          <DataRow
            label="Consecutive A-Rating Days"
            value={sponsor.consecutive_a_rating_days > 0 ? `${sponsor.consecutive_a_rating_days} days` : '0'}
            color={sponsor.consecutive_a_rating_days > 365 ? 'text-green' : sponsor.consecutive_a_rating_days > 0 ? 'text-amber' : undefined}
          />
          <DataRow
            label="Rating Changes"
            value={sponsor.times_rating_changed}
            color={sponsor.times_rating_changed > 2 ? 'text-red' : sponsor.times_rating_changed > 0 ? 'text-amber' : 'text-green'}
          />
          <DataRow label="First Seen" value={formatDate(sponsor.first_seen_date ?? null)} />
          <DataRow label="Last Seen" value={formatDate(sponsor.last_seen_date ?? null)} />
        </SectionCard>

        {/* Workforce */}
        {profile && (profile.employee_count_estimate !== null || profile.linkedin_url) && (
          <SectionCard title="Workforce & Growth">
            <DataRow label="Employees (est.)" value={profile.employee_count_estimate?.toLocaleString()} />
            {profile.employee_count_source && (
              <DataRow label="Source" value={profile.employee_count_source} />
            )}
            {profile.employee_growth_6m !== null && (
              <DataRow
                label="Growth (6m)"
                value={`${profile.employee_growth_6m > 0 ? '+' : ''}${profile.employee_growth_6m}%`}
                color={profile.employee_growth_6m > 0 ? 'text-green' : profile.employee_growth_6m < 0 ? 'text-red' : undefined}
              />
            )}
            {profile.employee_growth_12m !== null && (
              <DataRow
                label="Growth (12m)"
                value={`${profile.employee_growth_12m > 0 ? '+' : ''}${profile.employee_growth_12m}%`}
                color={profile.employee_growth_12m > 0 ? 'text-green' : profile.employee_growth_12m < 0 ? 'text-red' : undefined}
              />
            )}
            {profile.linkedin_follower_count !== null && (
              <DataRow label="LinkedIn Followers" value={profile.linkedin_follower_count?.toLocaleString()} />
            )}
          </SectionCard>
        )}

        {/* Online Presence */}
        {profile && (profile.website_url || profile.linkedin_url || profile.social_links) && (
          <SectionCard title="Online Presence" icon={<Link2 size={13} />}>
            {profile.website_url && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim">Website</span>
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-amber hover:text-text transition-colors"
                >
                  {profile.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 40)}
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
            {profile.social_links?.website_description && (
              <div className="py-1.5 border-b border-border/15">
                <span className="text-[10px] text-dim">Description</span>
                <p className="mt-0.5 text-[11px] text-text/80 leading-relaxed">
                  {profile.social_links.website_description as string}
                </p>
              </div>
            )}
            {profile.website_domain_age_days !== null && (
              <DataRow label="Domain Age" value={`${Math.round(profile.website_domain_age_days / 365)} years`} />
            )}
            {(profile.has_careers_page !== null || profile.careers_page_url) && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim">Careers Page</span>
                {profile.careers_page_url ? (
                  <a
                    href={profile.careers_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-data text-[11px] text-green hover:text-text transition-colors"
                  >
                    View Careers <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className={cn('font-data text-[12px]', profile.has_careers_page ? 'text-green' : 'text-dim')}>
                    {profile.has_careers_page ? 'YES' : 'NO'}
                  </span>
                )}
              </div>
            )}
            {profile.linkedin_url && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim">LinkedIn</span>
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-amber hover:text-text transition-colors"
                >
                  Company Profile <ExternalLink size={10} />
                </a>
              </div>
            )}
            {/* Contact info */}
            {profile.social_links?.contact_email && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim flex items-center gap-1"><Mail size={10} /> Email</span>
                <a
                  href={`mailto:${profile.social_links.contact_email}`}
                  className="font-data text-[11px] text-amber hover:text-text transition-colors"
                >
                  {profile.social_links.contact_email as string}
                </a>
              </div>
            )}
            {profile.social_links?.contact_phone && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim flex items-center gap-1"><Phone size={10} /> Phone</span>
                <a
                  href={`tel:${profile.social_links.contact_phone}`}
                  className="font-data text-[11px] text-text"
                >
                  {profile.social_links.contact_phone as string}
                </a>
              </div>
            )}
            {/* URL-type social links (skip nested objects) */}
            {socialUrlEntries.map(([platform, url]) => (
              <div key={platform} className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim capitalize">{platform.replace(/_/g, ' ')}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-amber hover:text-text transition-colors"
                >
                  Link <ExternalLink size={10} />
                </a>
              </div>
            ))}
            {profile.tech_stack_detected && profile.tech_stack_detected.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] uppercase tracking-wider text-dim">Tech Stack</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {profile.tech_stack_detected.map((tech) => (
                    <span key={tech} className="rounded bg-s2 px-1.5 py-0.5 font-data text-[9px] text-cyan ring-1 ring-cyan/15">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.enrichment_level !== null && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-dim">Enrichment Level</span>
                  <span className="font-data text-[11px] text-amber">L{profile.enrichment_level}</span>
                </div>
                <div className="mt-1 h-1 w-full bg-s3 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-gradient-to-r from-amber/60 to-amber rounded-full transition-all"
                    style={{ width: `${Math.min((profile.enrichment_level / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* AI Intelligence */}
        {aiIntel && (
          <SectionCard title="AI Intelligence" icon={<Brain size={13} />}>
            {aiIntel.description && (
              <div className="py-1.5 border-b border-border/15">
                <p className="text-[11px] text-text/90 leading-relaxed">{aiIntel.description}</p>
              </div>
            )}
            {aiIntel.visa_sponsorship_likelihood && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim flex items-center gap-1"><Shield size={10} /> Visa Sponsorship</span>
                <span className={cn('font-data text-[11px] font-bold uppercase',
                  aiIntel.visa_sponsorship_likelihood === 'high' ? 'text-green' :
                  aiIntel.visa_sponsorship_likelihood === 'medium' ? 'text-amber' : 'text-red'
                )}>
                  {aiIntel.visa_sponsorship_likelihood}
                </span>
              </div>
            )}
            {aiIntel.headquarters_city && <DataRow label="HQ City" value={aiIntel.headquarters_city} />}
            {aiIntel.parent_company && <DataRow label="Parent Company" value={aiIntel.parent_company} />}
            {aiIntel.services && aiIntel.services.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Services</span>
                <div className="mt-1.5">
                  <TagList items={aiIntel.services} />
                </div>
              </div>
            )}
            {aiIntel.hiring_sectors && aiIntel.hiring_sectors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim flex items-center gap-1">
                  <Briefcase size={10} /> Hiring Sectors
                </span>
                <div className="mt-1.5">
                  <TagList items={aiIntel.hiring_sectors} color="text-green" bg="bg-green/10" ring="ring-green/15" />
                </div>
              </div>
            )}
            {aiIntel.typical_sponsored_roles && aiIntel.typical_sponsored_roles.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Typical Sponsored Roles</span>
                <div className="mt-1.5">
                  <TagList items={aiIntel.typical_sponsored_roles} color="text-purple" bg="bg-purple/10" ring="ring-purple/15" />
                </div>
              </div>
            )}
            {aiIntel.competitors && aiIntel.competitors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Competitors</span>
                <div className="mt-1.5">
                  <TagList items={aiIntel.competitors} color="text-dim" bg="bg-s2" ring="ring-border" />
                </div>
              </div>
            )}
            {aiIntel.key_facts && aiIntel.key_facts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Key Facts</span>
                <ul className="mt-1.5 space-y-1">
                  {aiIntel.key_facts.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-text/80">
                      <span className="text-amber mt-0.5">&#8226;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiIntel.company_culture && (
              <div className="mt-2 pt-2 border-t border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Culture</span>
                <p className="mt-1 text-[11px] text-text/70 leading-relaxed italic">{aiIntel.company_culture}</p>
              </div>
            )}
            {aiIntel.analyzed_at && (
              <div className="mt-2 pt-2 border-t border-border/15 flex items-center justify-between">
                <span className="text-[9px] text-muted">Analyzed {formatDate(aiIntel.analyzed_at)}</span>
                {aiIntel.model_used && <span className="font-data text-[9px] text-muted">{aiIntel.model_used}</span>}
              </div>
            )}
          </SectionCard>
        )}

        {/* Job Search Tips */}
        {searchTips && (
          <SectionCard title="Job Search Tips" icon={<Search size={13} />}>
            {searchTips.search_names && searchTips.search_names.length > 0 && (
              <div className="py-1.5 border-b border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim">Search Names</span>
                <div className="mt-1.5">
                  <TagList items={searchTips.search_names} color="text-amber" bg="bg-amber/10" ring="ring-amber/15" />
                </div>
              </div>
            )}
            {searchTips.job_boards && searchTips.job_boards.length > 0 && (
              <div className="py-1.5 border-b border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim flex items-center gap-1">
                  <Globe size={10} /> Recommended Job Boards
                </span>
                <div className="mt-1.5">
                  <TagList items={searchTips.job_boards} color="text-text" bg="bg-s2" ring="ring-border" />
                </div>
              </div>
            )}
            {searchTips.application_tips && (
              <div className="py-1.5 border-b border-border/15">
                <span className="text-[10px] uppercase tracking-wider text-dim flex items-center gap-1">
                  <Star size={10} /> Application Tips
                </span>
                <p className="mt-1 text-[11px] text-text/80 leading-relaxed">{searchTips.application_tips}</p>
              </div>
            )}
            {searchTips.best_time_to_apply && (
              <div className="py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-dim">Best Time to Apply</span>
                <p className="mt-1 text-[11px] text-text/80 leading-relaxed">{searchTips.best_time_to_apply}</p>
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* Right Column: Companies House Data */}
      <div className="space-y-3">
        {profile ? (
          <>
            <SectionCard title="Companies House" icon={<Building2 size={13} />}>
              <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                <span className="text-[11px] text-dim">Company Number</span>
                {chUrl ? (
                  <a
                    href={chUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-data text-[12px] text-amber hover:text-text transition-colors font-bold"
                  >
                    {chNumber}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="font-data text-[12px] text-muted">--</span>
                )}
              </div>
              <DataRow
                label="Company Status"
                value={profile.company_status?.toUpperCase()}
                color={profile.company_status?.toLowerCase() === 'active' ? 'text-green' : 'text-red'}
              />
              <DataRow label="Company Type" value={profile.company_type} />
              <DataRow label="Incorporated" value={formatDate(profile.incorporation_date)} />
              <DataRow label="Industry" value={profile.industry_primary} color="text-cyan" />

              {/* Registered Address */}
              {fullAddress && (
                <div className="mt-2 pt-2 border-t border-border/15">
                  <div className="flex items-start gap-1.5">
                    <MapPin size={11} className="mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-dim">Registered Address</span>
                      <p className="mt-0.5 font-data text-[11px] text-text leading-relaxed">
                        {fullAddress}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SIC Codes */}
              {sicCodes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/15">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Tag size={11} className="text-muted" />
                    <span className="text-[10px] uppercase tracking-wider text-dim">SIC Codes</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sicCodes.map((code) => (
                      <SicCodeTag key={code} code={code} />
                    ))}
                  </div>
                </div>
              )}

              {/* Industry Tags */}
              {profile.industry_tags && profile.industry_tags.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/15">
                  <span className="text-[10px] uppercase tracking-wider text-dim">Industry Tags</span>
                  <div className="mt-1.5">
                    <TagList items={profile.industry_tags} color="text-purple" bg="bg-purple/10" ring="ring-purple/15" />
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Filing & Accounts */}
            <SectionCard title="Filing Status" icon={<Calendar size={13} />}>
              <DataRow label="Last Accounts" value={formatDate(profile.last_accounts_date)} />
              <DataRow label="Next Accounts Due" value={formatDate(profile.next_accounts_due)} />
              {profile.accounts_overdue !== null && (
                <DataRow
                  label="Accounts Overdue"
                  value={profile.accounts_overdue ? 'YES' : 'NO'}
                  color={profile.accounts_overdue ? 'text-red' : 'text-green'}
                />
              )}
              {profile.confirmation_statement_overdue !== null && (
                <DataRow
                  label="Confirmation Statement"
                  value={profile.confirmation_statement_overdue ? 'OVERDUE' : 'CURRENT'}
                  color={profile.confirmation_statement_overdue ? 'text-red' : 'text-green'}
                />
              )}
              {profile.estimated_revenue_band && (
                <DataRow label="Revenue Band" value={profile.estimated_revenue_band} color="text-amber" />
              )}
            </SectionCard>

            {/* Reputation summary */}
            {(profile.glassdoor_rating !== null || profile.trustpilot_rating !== null || profile.google_rating !== null) && (
              <SectionCard title="Reputation Snapshot">
                {profile.glassdoor_rating !== null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                    <span className="text-[11px] text-dim">Glassdoor</span>
                    <div className="flex items-center gap-2">
                      <RatingStars rating={profile.glassdoor_rating} />
                      {profile.glassdoor_review_count !== null && (
                        <span className="font-data text-[10px] text-muted">({profile.glassdoor_review_count})</span>
                      )}
                    </div>
                  </div>
                )}
                {profile.trustpilot_rating !== null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                    <span className="text-[11px] text-dim">Trustpilot</span>
                    <div className="flex items-center gap-2">
                      <RatingStars rating={profile.trustpilot_rating} />
                      {profile.trustpilot_review_count !== null && (
                        <span className="font-data text-[10px] text-muted">({profile.trustpilot_review_count})</span>
                      )}
                    </div>
                  </div>
                )}
                {profile.google_rating !== null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/15">
                    <span className="text-[11px] text-dim">Google</span>
                    <div className="flex items-center gap-2">
                      <RatingStars rating={profile.google_rating} />
                      {profile.google_review_count !== null && (
                        <span className="font-data text-[10px] text-muted">({profile.google_review_count})</span>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}
          </>
        ) : (
          <div className="border border-border bg-s1 p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Building2 size={24} className="text-muted mb-2" />
              <p className="font-data text-[11px] text-dim uppercase tracking-wider">
                No enrichment data available
              </p>
              <p className="mt-1 text-[10px] text-muted">
                Company profile has not been enriched yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  const color = rating >= 4 ? 'text-green' : rating >= 3 ? 'text-amber' : 'text-red';
  return (
    <div className="flex items-center gap-1">
      <span className={cn('font-data text-[12px] font-bold', color)}>
        {rating.toFixed(1)}
      </span>
      <div className="flex gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-sm',
              i <= filled ? (rating >= 4 ? 'bg-green' : rating >= 3 ? 'bg-amber' : 'bg-red') : 'bg-s3'
            )}
          />
        ))}
      </div>
    </div>
  );
}
