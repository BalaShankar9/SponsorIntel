import { CompanyProfileClient } from './CompanyProfileClient';

interface CompanyPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: CompanyPageProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${API_URL}/api/v1/sponsors/${params.id}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      return {
        title: `${data.organisation_name} - SponsorIntel`,
        description: `Sponsorship intelligence for ${data.organisation_name}. Score: ${data.overall_score ?? 'N/A'}, Rating: ${data.rating ?? 'N/A'}, Location: ${data.town_city ?? 'UK'}`,
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
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let sponsor = null;

  try {
    const res = await fetch(`${API_URL}/api/v1/sponsors/${params.id}`, { next: { revalidate: 300 } });
    if (res.ok) {
      sponsor = await res.json();
    }
  } catch {
    // handled below
  }

  if (!sponsor) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text">Company Not Found</h1>
          <p className="mt-2 text-sm text-dim">The requested sponsor could not be found.</p>
        </div>
      </div>
    );
  }

  return <CompanyProfileClient initialData={sponsor} />;
}
