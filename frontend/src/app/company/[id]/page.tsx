import { createClient } from '@supabase/supabase-js';
import { CompanyProfileClient } from './CompanyProfileClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface CompanyPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: CompanyPageProps) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  try {
    const { data } = await supabase
      .from('sponsors')
      .select('organisation_name, rating, town_city, sponsor_type')
      .eq('id', params.id)
      .single();

    if (data) {
      return {
        title: `${data.organisation_name} - SponsorIntel`,
        description: `Sponsorship intelligence for ${data.organisation_name}. Rating: ${data.rating ?? 'N/A'}, Location: ${data.town_city ?? 'UK'}, Type: ${data.sponsor_type ?? 'N/A'}`,
      };
    }
  } catch {
    // fallback
  }
  return {
    title: 'Company Profile - SponsorIntel',
    description: 'UK visa sponsor company intelligence profile.',
  };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch sponsor with profile and scores in one query
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select(`
      *,
      company_profiles (*),
      sponsor_scores (*)
    `)
    .eq('id', params.id)
    .single();

  if (!sponsor) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center border border-border bg-s1 p-10">
          <div className="mb-4 font-data text-4xl text-red">404</div>
          <h1 className="font-data text-sm font-bold uppercase tracking-widest text-amber">SPONSOR NOT FOUND</h1>
          <p className="mt-2 font-data text-[11px] text-dim">The requested sponsor could not be located in the database.</p>
          <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="mt-3 font-data text-[10px] text-muted">ID: {params.id}</p>
        </div>
      </div>
    );
  }

  // Flatten profile
  const profile = Array.isArray(sponsor.company_profiles)
    ? sponsor.company_profiles[0] || null
    : sponsor.company_profiles || null;

  // Flatten scores
  const scoresRaw = Array.isArray(sponsor.sponsor_scores)
    ? sponsor.sponsor_scores[0] || null
    : sponsor.sponsor_scores || null;

  const scores = scoresRaw
    ? {
        overall_score: scoresRaw.overall_score ?? 0,
        compliance_score: scoresRaw.compliance_score ?? null,
        financial_health_score: scoresRaw.financial_health_score ?? null,
        hiring_activity_score: scoresRaw.hiring_activity_score ?? null,
        reputation_score: scoresRaw.reputation_score ?? null,
        legitimacy_score: scoresRaw.legitimacy_score ?? null,
        track_record_score: scoresRaw.track_record_score ?? null,
        growth_signal_score: scoresRaw.growth_signal_score ?? null,
        risk_flags: scoresRaw.risk_flags ?? null,
        computed_at: scoresRaw.computed_at ?? '',
      }
    : null;

  const sponsorDetail = {
    ...sponsor,
    consecutive_a_rating_days: sponsor.consecutive_a_rating_days ?? 0,
    times_rating_changed: sponsor.times_rating_changed ?? 0,
    profile,
    scores,
    company_profiles: undefined,
    sponsor_scores: undefined,
  };

  return <CompanyProfileClient initialData={sponsorDetail} />;
}
