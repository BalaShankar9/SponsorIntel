'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const VISA_ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Scale-Up', 'Other'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Engineering', 'Education', 'Legal', 'Creative', 'Science', 'Construction', 'Hospitality'];

interface Step {
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { title: 'Your Visa Route', subtitle: 'Which visa route are you interested in?' },
  { title: 'Your Industry', subtitle: 'Select your target industries' },
  { title: 'Salary Range', subtitle: 'What salary range are you targeting?' },
  { title: 'First Alert', subtitle: 'Set up your first smart alert' },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visaRoute, setVisaRoute] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState(30000);
  const [salaryMax, setSalaryMax] = useState(80000);

  const toggleIndustry = (ind: string) => {
    setIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const handleComplete = async () => {
    // Save preferences (best-effort)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          visa_route: visaRoute,
          target_industries: industries,
          salary_min: salaryMin,
          salary_max: salaryMax,
          onboarding_completed: true,
        });
      }
    } catch {
      // Non-critical — proceed even if save fails
    }
    router.push('/dashboard');
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleComplete();
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-amber' : 'bg-border'}`} />
          ))}
        </div>

        {/* Step Content */}
        <div className="border border-border bg-s1 rounded p-8">
          <div className="text-[10px] font-data text-amber tracking-wider mb-2">
            STEP {step + 1} OF {STEPS.length}
          </div>
          <h2 className="text-lg font-semibold mb-1">{STEPS[step].title}</h2>
          <p className="text-xs text-dim mb-6">{STEPS[step].subtitle}</p>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-2">
              {VISA_ROUTES.map((route) => (
                <button
                  key={route}
                  onClick={() => setVisaRoute(route)}
                  className={`p-3 rounded border text-xs text-left transition-all ${
                    visaRoute === route
                      ? 'border-amber bg-amber/10 text-amber'
                      : 'border-border hover:border-dim'
                  }`}
                >
                  {route}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => toggleIndustry(ind)}
                  className={`p-3 rounded border text-xs text-left transition-all ${
                    industries.includes(ind)
                      ? 'border-cyan bg-cyan/10 text-cyan'
                      : 'border-border hover:border-dim'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-data text-dim block mb-2">MINIMUM SALARY (£)</label>
                <input
                  type="range"
                  min={20000}
                  max={150000}
                  step={5000}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(Number(e.target.value))}
                  className="w-full accent-amber"
                />
                <div className="text-sm font-data text-amber">£{salaryMin.toLocaleString()}</div>
              </div>
              <div>
                <label className="text-[10px] font-data text-dim block mb-2">MAXIMUM SALARY (£)</label>
                <input
                  type="range"
                  min={20000}
                  max={200000}
                  step={5000}
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(Number(e.target.value))}
                  className="w-full accent-cyan"
                />
                <div className="text-sm font-data text-cyan">£{salaryMax.toLocaleString()}</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="border border-border rounded p-4">
                <div className="text-[10px] font-data text-green mb-1">YOUR FIRST ALERT</div>
                <p className="text-xs text-dim">
                  Get notified when new {visaRoute || 'Skilled Worker'} jobs appear
                  {industries.length > 0 ? ` in ${industries.slice(0, 2).join(', ')}` : ''}
                  {salaryMin > 20000 ? ` above £${salaryMin.toLocaleString()}` : ''}
                </p>
              </div>
              <p className="text-[10px] text-dim">You can customize alerts anytime from the Alerts page.</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="text-xs text-dim hover:text-text">
                Back
              </button>
            ) : (
              <button onClick={() => router.push('/dashboard')} className="text-xs text-dim hover:text-text">
                Skip
              </button>
            )}
            <button
              onClick={nextStep}
              className="bg-amber text-bg px-6 py-2 rounded text-xs font-semibold hover:bg-amber/90 transition-colors"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
