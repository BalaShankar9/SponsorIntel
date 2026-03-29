'use client';

import { useState, useMemo } from 'react';
import { Search, ExternalLink, AlertTriangle, Phone, Globe, ShieldCheck, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

type OISCLevel = 1 | 2 | 3 | 'SRA';
type Specialisation = 'work' | 'family' | 'asylum' | 'student' | 'business' | 'eea';

interface Consultancy {
  id: number;
  name: string;
  city: string;
  level: OISCLevel;
  specialisations: Specialisation[];
  website: string;
  phone: string;
  description: string;
  registrationRef?: string;
}

const CONSULTANCIES: Consultancy[] = [
  {
    id: 1,
    name: 'A&P Immigration Services',
    city: 'London',
    level: 3,
    specialisations: ['work', 'business', 'family'],
    website: 'https://www.apimmigration.co.uk',
    phone: '020 7100 2000',
    description: 'OISC Level 3 adviser providing comprehensive UK immigration services including skilled worker, business visas and family reunification.',
    registrationRef: 'F200900001',
  },
  {
    id: 2,
    name: 'Asons Immigration Consultants',
    city: 'Manchester',
    level: 2,
    specialisations: ['work', 'student', 'family'],
    website: 'https://www.asons.co.uk',
    phone: '0161 413 8761',
    description: 'Based in Manchester, Asons provides OISC Level 2 advice covering skilled worker, student and family visa routes.',
    registrationRef: 'F201100050',
  },
  {
    id: 3,
    name: 'UK Visa Bureau',
    city: 'London',
    level: 3,
    specialisations: ['work', 'student', 'family', 'business'],
    website: 'https://www.visabureau.com',
    phone: '020 3582 4833',
    description: 'One of the UK\'s leading OISC-regulated immigration consultancies with over 20 years of experience across all visa categories.',
    registrationRef: 'F200100007',
  },
  {
    id: 4,
    name: 'EC Immigration',
    city: 'Birmingham',
    level: 2,
    specialisations: ['work', 'family', 'student'],
    website: 'https://www.ecimmigration.co.uk',
    phone: '0121 231 2022',
    description: 'Birmingham-based OISC Level 2 consultancy specialising in skilled worker applications and family visa reunification.',
    registrationRef: 'F201200102',
  },
  {
    id: 5,
    name: 'Global Immigration Consultants Ltd',
    city: 'London',
    level: 3,
    specialisations: ['work', 'business', 'eea'],
    website: 'https://www.globalimmigrationconsultants.co.uk',
    phone: '020 7936 6777',
    description: 'OISC Level 3 registered firm providing advice on all UK and international immigration matters including business routes and EU settlement.',
    registrationRef: 'F200400015',
  },
  {
    id: 6,
    name: 'Migrate UK',
    city: 'Oxford',
    level: 3,
    specialisations: ['work', 'business', 'family', 'student'],
    website: 'https://www.migrate-uk.com',
    phone: '01865 257 423',
    description: 'Oxford-based OISC Level 3 consultancy with deep expertise in sponsored worker routes, business immigration and family applications.',
    registrationRef: 'F200700032',
  },
  {
    id: 7,
    name: 'TFW Immigration',
    city: 'Leeds',
    level: 2,
    specialisations: ['work', 'student'],
    website: 'https://www.tfwimmigration.co.uk',
    phone: '0113 357 0720',
    description: 'Yorkshire-based OISC Level 2 practice advising employers and workers on skilled worker sponsorship and student visa routes.',
    registrationRef: 'F201500088',
  },
  {
    id: 8,
    name: 'Newland Chase',
    city: 'London',
    level: 3,
    specialisations: ['work', 'business', 'eea'],
    website: 'https://www.newlandchase.com',
    phone: '020 7759 7560',
    description: 'Global immigration management firm, OISC Level 3 registered, specialising in corporate immigration and global mobility.',
    registrationRef: 'F200600003',
  },
  {
    id: 9,
    name: 'Immigration Advice Service',
    city: 'Manchester',
    level: 3,
    specialisations: ['work', 'family', 'asylum', 'student'],
    website: 'https://iasservices.org.uk',
    phone: '0333 305 9375',
    description: 'One of the largest OISC Level 3 immigration advisory services in the UK, covering all immigration categories with offices nationwide.',
    registrationRef: 'F201000010',
  },
  {
    id: 10,
    name: 'Sunrise Immigration',
    city: 'Leicester',
    level: 2,
    specialisations: ['family', 'work', 'student'],
    website: 'https://www.sunriseimmigration.co.uk',
    phone: '0116 254 1400',
    description: 'East Midlands OISC Level 2 consultancy providing family visa, skilled worker and student route advice.',
    registrationRef: 'F201300065',
  },
  {
    id: 11,
    name: 'Harvey Nash Immigration',
    city: 'London',
    level: 3,
    specialisations: ['work', 'business'],
    website: 'https://www.harveynash.com',
    phone: '020 7333 0033',
    description: 'OISC Level 3 corporate immigration specialists supporting technology and professional services companies with sponsored worker licensing.',
    registrationRef: 'F200500008',
  },
  {
    id: 12,
    name: 'BMS Law Immigration',
    city: 'Glasgow',
    level: 2,
    specialisations: ['family', 'work', 'asylum'],
    website: 'https://www.bmslaw.co.uk',
    phone: '0141 248 6956',
    description: 'Glasgow-based OISC Level 2 firm with experience in family reunion, asylum claims and skilled worker routes in Scotland.',
    registrationRef: 'F201400077',
  },
  {
    id: 13,
    name: 'Ventura Immigration',
    city: 'Bristol',
    level: 2,
    specialisations: ['work', 'student', 'family'],
    website: 'https://www.venturaimmigration.co.uk',
    phone: '0117 214 0770',
    description: 'Bristol-based OISC Level 2 consultancy providing practical advice on skilled worker, student and family visa applications.',
    registrationRef: 'F201600091',
  },
  {
    id: 14,
    name: 'Sterling Law',
    city: 'London',
    level: 3,
    specialisations: ['work', 'family', 'eea', 'asylum'],
    website: 'https://www.sterling.law',
    phone: '020 3925 9544',
    description: 'OISC Level 3 and SRA dual-regulated practice providing a full spectrum of UK immigration services including complex asylum cases.',
    registrationRef: 'F200800020',
  },
  {
    id: 15,
    name: 'CK Solicitors & Immigration',
    city: 'London',
    level: 1,
    specialisations: ['work', 'student'],
    website: 'https://www.cksolicitors.com',
    phone: '020 8150 5552',
    description: 'OISC Level 1 adviser supporting individuals with straightforward skilled worker and student visa applications.',
    registrationRef: 'F201700112',
  },
  {
    id: 16,
    name: 'Alkali Immigration',
    city: 'Cardiff',
    level: 2,
    specialisations: ['work', 'family', 'student'],
    website: 'https://www.alkaliimmigration.co.uk',
    phone: '029 2167 0777',
    description: 'Wales-based OISC Level 2 consultancy serving clients across South Wales on work, family and student immigration matters.',
    registrationRef: 'F201800130',
  },
  {
    id: 17,
    name: 'Total Immigration',
    city: 'London',
    level: 3,
    specialisations: ['work', 'business', 'family', 'student', 'eea'],
    website: 'https://www.totalimmigration.co.uk',
    phone: '020 7700 4481',
    description: 'OISC Level 3 consultancy offering advice across all UK visa categories, with specialist knowledge of EU Settlement Scheme matters.',
    registrationRef: 'F200300012',
  },
  {
    id: 18,
    name: 'Everett Tomlin Lloyd & Pratt',
    city: 'London',
    level: 3,
    specialisations: ['work', 'family', 'asylum', 'eea'],
    website: 'https://www.etlp.co.uk',
    phone: '020 7377 5934',
    description: 'East London OISC Level 3 consultancy with long-standing experience in asylum, family reunion and skilled worker applications.',
    registrationRef: 'F200200005',
  },
  {
    id: 19,
    name: 'Premier Immigration',
    city: 'Nottingham',
    level: 2,
    specialisations: ['work', 'student', 'family'],
    website: 'https://www.premierimmigration.co.uk',
    phone: '0115 964 8700',
    description: 'East Midlands OISC Level 2 service provider covering skilled worker, student and family reunification routes.',
    registrationRef: 'F201900145',
  },
  {
    id: 20,
    name: 'Kinley Rouse Immigration',
    city: 'Edinburgh',
    level: 3,
    specialisations: ['work', 'family', 'business', 'student'],
    website: 'https://www.kinleyrouse.co.uk',
    phone: '0131 510 7990',
    description: 'Scotland\'s OISC Level 3 consultancy based in Edinburgh, specialising in corporate immigration and family applications for Scottish employers.',
    registrationRef: 'F202000160',
  },
  {
    id: 21,
    name: 'Sunrise Solicitors Immigration',
    city: 'London',
    level: 3,
    specialisations: ['work', 'asylum', 'family', 'eea'],
    website: 'https://www.sunrisesolicitors.co.uk',
    phone: '020 8571 2233',
    description: 'West London OISC Level 3 practice with specialist expertise in complex asylum claims, family visas and EU Settlement Scheme appeals.',
    registrationRef: 'F200900025',
  },
];

const SPEC_LABELS: Record<Specialisation, string> = {
  work: 'WORK VISAS',
  family: 'FAMILY',
  asylum: 'ASYLUM',
  student: 'STUDENT',
  business: 'BUSINESS',
  eea: 'EU/EEA',
};

const SPEC_COLORS: Record<Specialisation, string> = {
  work: 'bg-amber/20 text-amber border-amber/30',
  family: 'bg-cyan/20 text-cyan border-cyan/30',
  asylum: 'bg-red/20 text-red border-red/30',
  student: 'bg-green/20 text-green border-green/30',
  business: 'bg-purple-400/20 text-purple-400 border-purple-400/30',
  eea: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
};

const LEVEL_COLORS: Record<OISCLevel, string> = {
  1: 'bg-s3 text-dim border-s3',
  2: 'bg-amber/20 text-amber border-amber/40',
  3: 'bg-green/20 text-green border-green/40',
  SRA: 'bg-cyan/20 text-cyan border-cyan/40',
};

export default function ConsultanciesPage() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [specFilter, setSpecFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return CONSULTANCIES.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q);
      const matchesLevel =
        levelFilter === 'all' || String(c.level) === levelFilter;
      const matchesSpec =
        specFilter === 'all' ||
        c.specialisations.includes(specFilter as Specialisation);
      return matchesSearch && matchesLevel && matchesSpec;
    });
  }, [search, levelFilter, specFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-amber/30 pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
              OISC TRUSTED CONSULTANCIES
            </h1>
            <p className="font-data text-xs text-dim mt-0.5">
              OISC-REGISTERED IMMIGRATION ADVISERS // UK DIRECTORY // {CONSULTANCIES.length} FIRMS
            </p>
          </div>
          <a
            href="https://www.gov.uk/find-immigration-adviser"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-amber/40 px-3 py-1.5 font-data text-[10px] text-amber uppercase hover:bg-amber/10 transition-colors"
          >
            <ShieldCheck size={12} />
            OISC REGISTER
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 border border-amber/50 bg-amber/5 p-3">
        <AlertTriangle size={16} className="text-amber mt-0.5 shrink-0" />
        <div>
          <p className="font-data text-xs font-bold text-amber uppercase">
            Always verify your adviser is registered before paying
          </p>
          <p className="font-data text-[11px] text-dim mt-1">
            Check every adviser on the{' '}
            <a
              href="https://www.gov.uk/find-immigration-adviser"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber underline hover:text-amber/80"
            >
              official OISC register
            </a>
            {' '}before engaging their services. Only OISC-registered advisers (Levels 1–3) or
            SRA-regulated solicitors are legally permitted to provide immigration advice in the UK.
            Unauthorised advisers are a criminal offence under the Immigration and Asylum Act 1999.
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH BY NAME OR CITY..."
            className="w-full bg-s1 border border-s3 pl-8 pr-3 py-2 font-data text-xs text-text placeholder:text-dim focus:outline-none focus:border-amber/60 uppercase"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-data text-[10px] text-dim uppercase">LEVEL:</span>
        {[
          { v: 'all', label: 'ALL' },
          { v: '1', label: 'LEVEL 1' },
          { v: '2', label: 'LEVEL 2' },
          { v: '3', label: 'LEVEL 3' },
          { v: 'SRA', label: 'SRA' },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setLevelFilter(opt.v)}
            className={cn(
              'px-2 py-1 font-data text-[10px] uppercase transition-colors border',
              levelFilter === opt.v
                ? 'bg-amber text-bg font-bold border-amber'
                : 'text-dim hover:text-amber border-s3',
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="mx-1 text-s3 font-data text-xs">|</span>
        <span className="font-data text-[10px] text-dim uppercase">SPEC:</span>
        {[
          { v: 'all', label: 'ALL' },
          { v: 'work', label: 'WORK' },
          { v: 'family', label: 'FAMILY' },
          { v: 'asylum', label: 'ASYLUM' },
          { v: 'student', label: 'STUDENT' },
          { v: 'business', label: 'BUSINESS' },
          { v: 'eea', label: 'EU/EEA' },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setSpecFilter(opt.v)}
            className={cn(
              'px-2 py-1 font-data text-[10px] uppercase transition-colors border',
              specFilter === opt.v
                ? 'bg-amber text-bg font-bold border-amber'
                : 'text-dim hover:text-amber border-s3',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="font-data text-[10px] text-dim">
        SHOWING {filtered.length} OF {CONSULTANCIES.length} REGISTERED CONSULTANCIES
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="border border-s3 bg-s1 p-4 flex flex-col gap-3 hover:border-amber/40 transition-colors"
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-data text-sm font-bold text-text uppercase leading-tight">
                  {c.name}
                </h3>
                <p className="font-data text-[11px] text-dim mt-0.5">{c.city}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 border px-2 py-0.5 font-data text-[10px] font-bold uppercase',
                  LEVEL_COLORS[c.level],
                )}
              >
                {c.level === 'SRA' ? 'SRA' : `LVL ${c.level}`}
              </span>
            </div>

            {/* Description */}
            <p className="font-data text-[11px] text-dim leading-relaxed line-clamp-3">
              {c.description}
            </p>

            {/* Specialisations */}
            <div className="flex flex-wrap gap-1">
              {c.specialisations.map((s) => (
                <span
                  key={s}
                  className={cn(
                    'border px-1.5 py-0.5 font-data text-[9px] font-bold uppercase',
                    SPEC_COLORS[s],
                  )}
                >
                  {SPEC_LABELS[s]}
                </span>
              ))}
            </div>

            {/* Contact / Links */}
            <div className="mt-auto pt-2 border-t border-s3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Phone size={11} className="text-dim shrink-0" />
                <span className="font-data text-[11px] text-dim">{c.phone}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={c.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-amber hover:text-amber/80 transition-colors"
                >
                  <Globe size={11} />
                  WEBSITE
                  <ExternalLink size={9} />
                </a>
                <a
                  href={`https://www.gov.uk/find-immigration-adviser?query=${encodeURIComponent(c.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-cyan hover:text-cyan/80 transition-colors"
                >
                  <ShieldCheck size={11} />
                  VERIFY
                  <ExternalLink size={9} />
                </a>
              </div>
              {c.registrationRef && (
                <p className="font-data text-[9px] text-s3">
                  REF: {c.registrationRef}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="border border-s3 bg-s1 p-8 text-center">
          <p className="font-data text-xs text-dim uppercase">NO CONSULTANCIES MATCH YOUR FILTERS</p>
        </div>
      )}

      {/* Report a Concern */}
      <div className="border border-red/30 bg-red/5 p-4 mt-4">
        <div className="flex items-start gap-3">
          <Flag size={16} className="text-red shrink-0 mt-0.5" />
          <div>
            <h3 className="font-data text-xs font-bold text-red uppercase">
              REPORT A CONCERN
            </h3>
            <p className="font-data text-[11px] text-dim mt-1 leading-relaxed">
              If you suspect an immigration adviser is operating without OISC registration, or has acted
              dishonestly, you can report them to the OISC directly.
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a
                href="https://www.gov.uk/government/organisations/office-of-the-immigration-services-commissioner/about/complaints-procedure"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-data text-[11px] text-red hover:text-red/80 transition-colors underline"
              >
                Report to OISC <ExternalLink size={10} />
              </a>
              <a
                href="https://www.actionfraud.police.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-data text-[11px] text-dim hover:text-text transition-colors underline"
              >
                Action Fraud <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="font-data text-[10px] text-s3 leading-relaxed">
        DISCLAIMER: This directory is provided for informational purposes only. SponsorIntel does not endorse
        any individual firm. Always verify current registration status on the official OISC register at
        gov.uk before engaging any adviser. Data correct to the best of our knowledge as of March 2026.
      </p>
    </div>
  );
}
