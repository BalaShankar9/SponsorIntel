'use client';

import { useState, useMemo } from 'react';
import { Search, ExternalLink, AlertTriangle, Phone, Globe, ShieldCheck, Flag, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

type Specialisation = 'work' | 'family' | 'asylum' | 'student' | 'business' | 'eea' | 'appeals' | 'detention';

interface Solicitor {
  id: number;
  name: string;
  city: string;
  sraNumber: string;
  specialisations: Specialisation[];
  website: string;
  phone: string;
  description: string;
  legalAid: boolean;
  founded?: string;
}

const SOLICITORS: Solicitor[] = [
  {
    id: 1,
    name: 'Bindmans LLP',
    city: 'London',
    sraNumber: '55025',
    specialisations: ['asylum', 'appeals', 'detention', 'family', 'work'],
    website: 'https://www.bindmans.com',
    phone: '020 7833 4433',
    description: 'Leading human rights and immigration law firm with extensive experience in complex asylum cases, immigration detention, and judicial review.',
    legalAid: true,
    founded: '1974',
  },
  {
    id: 2,
    name: 'Leigh Day',
    city: 'London',
    sraNumber: '60092',
    specialisations: ['asylum', 'appeals', 'detention'],
    website: 'https://www.leighday.co.uk',
    phone: '020 7650 1200',
    description: 'Award-winning firm with a specialist immigration team handling asylum claims, deportation cases and immigration detention matters.',
    legalAid: true,
    founded: '1987',
  },
  {
    id: 3,
    name: 'Fragomen LLP',
    city: 'London',
    sraNumber: '615300',
    specialisations: ['work', 'business', 'eea'],
    website: 'https://www.fragomen.com',
    phone: '020 3378 1000',
    description: 'The world\'s leading corporate immigration law firm, providing global mobility and UK sponsored worker licence advice to major employers.',
    legalAid: false,
    founded: '1951',
  },
  {
    id: 4,
    name: 'Kingsley Napley LLP',
    city: 'London',
    sraNumber: '56677',
    specialisations: ['work', 'business', 'family', 'appeals'],
    website: 'https://www.kingsleynapley.co.uk',
    phone: '020 7814 1200',
    description: 'City firm with a highly regarded immigration department advising on high-net-worth individuals, business visas, and complex appeals.',
    legalAid: false,
    founded: '1973',
  },
  {
    id: 5,
    name: 'Wilson Solicitors LLP',
    city: 'London',
    sraNumber: '484856',
    specialisations: ['asylum', 'family', 'appeals', 'detention'],
    website: 'https://www.wilsonsolicitors.co.uk',
    phone: '020 7288 6090',
    description: 'North London firm with a Legal 500-ranked immigration team specialising in asylum, trafficking, family reunion and immigration detention.',
    legalAid: true,
    founded: '1990',
  },
  {
    id: 6,
    name: 'Duncan Lewis Solicitors',
    city: 'London',
    sraNumber: '488349',
    specialisations: ['asylum', 'family', 'appeals', 'detention', 'work'],
    website: 'https://www.duncanlewis.co.uk',
    phone: '020 7923 4020',
    description: 'One of the largest legal aid immigration practices in the UK, handling asylum, detention, deportation and family visa cases nationwide.',
    legalAid: true,
    founded: '1999',
  },
  {
    id: 7,
    name: 'Gherson LLP',
    city: 'London',
    sraNumber: '55721',
    specialisations: ['work', 'business', 'family', 'appeals', 'eea'],
    website: 'https://www.gherson.com',
    phone: '020 7724 4488',
    description: 'Specialist immigration and nationality law firm providing advice on all UK visa categories, business immigration and complex nationality issues.',
    legalAid: false,
    founded: '1987',
  },
  {
    id: 8,
    name: 'Magrath Sheldrick LLP',
    city: 'London',
    sraNumber: '522641',
    specialisations: ['work', 'business', 'family', 'eea'],
    website: 'https://www.magrathsolicitors.com',
    phone: '020 7406 7072',
    description: 'Boutique immigration law firm advising ultra-high-net-worth individuals, investors and multinational employers on all UK immigration matters.',
    legalAid: false,
    founded: '2008',
  },
  {
    id: 9,
    name: 'Turpin Miller LLP',
    city: 'Oxford',
    sraNumber: '524700',
    specialisations: ['asylum', 'family', 'appeals', 'detention', 'work'],
    website: 'https://www.turpinmiller.co.uk',
    phone: '01865 770 111',
    description: 'Oxford-based immigration law firm with a strong legal aid practice covering asylum, family reunion and appeals throughout Southern England.',
    legalAid: true,
    founded: '2000',
  },
  {
    id: 10,
    name: 'Irwin Mitchell LLP',
    city: 'Sheffield',
    sraNumber: '48691',
    specialisations: ['work', 'business', 'family', 'student'],
    website: 'https://www.irwinmitchell.com',
    phone: '0370 1500 100',
    description: 'National law firm with dedicated immigration teams across the UK advising on corporate and personal immigration including skilled worker and family routes.',
    legalAid: false,
    founded: '1912',
  },
  {
    id: 11,
    name: 'Laura Devine Solicitors',
    city: 'London',
    sraNumber: '487178',
    specialisations: ['work', 'business', 'eea', 'family'],
    website: 'https://www.lauradevine.com',
    phone: '020 7469 6970',
    description: 'Award-winning immigration law boutique advising on UK and US immigration. Highly ranked by Chambers for business immigration and global mobility.',
    legalAid: false,
    founded: '2002',
  },
  {
    id: 12,
    name: 'Parker Rhodes Hickmotts Solicitors',
    city: 'Rotherham',
    sraNumber: '54228',
    specialisations: ['work', 'family', 'asylum', 'appeals'],
    website: 'https://www.prhsolicitors.co.uk',
    phone: '01709 511 100',
    description: 'Yorkshire firm with a specialist immigration team handling applications, appeals and asylum cases for individuals and employers in the region.',
    legalAid: true,
    founded: '1964',
  },
  {
    id: 13,
    name: 'Harrison Bundey Solicitors',
    city: 'Leeds',
    sraNumber: '55590',
    specialisations: ['asylum', 'family', 'appeals', 'detention'],
    website: 'https://www.harrisonbundey.co.uk',
    phone: '0113 200 7400',
    description: 'Leeds firm with a nationally recognised immigration department handling complex asylum cases, immigration detention and deportation appeals.',
    legalAid: true,
    founded: '1979',
  },
  {
    id: 14,
    name: 'JMW Solicitors LLP',
    city: 'Manchester',
    sraNumber: '47329',
    specialisations: ['work', 'business', 'family', 'student'],
    website: 'https://www.jmw.co.uk',
    phone: '0345 872 6666',
    description: 'Manchester-based full-service firm with an immigration team advising employers on sponsor licences and individuals on all personal visa routes.',
    legalAid: false,
    founded: '1987',
  },
  {
    id: 15,
    name: 'Tann Law',
    city: 'London',
    sraNumber: '649421',
    specialisations: ['work', 'family', 'business', 'student'],
    website: 'https://www.tannlaw.co.uk',
    phone: '020 3745 7828',
    description: 'Boutique SRA-regulated firm specialising in sponsor licence applications, skilled worker visas and family immigration for SMEs and individuals.',
    legalAid: false,
    founded: '2015',
  },
  {
    id: 16,
    name: 'Gowling WLG UK LLP',
    city: 'Birmingham',
    sraNumber: '471722',
    specialisations: ['work', 'business', 'eea'],
    website: 'https://gowlingwlg.com',
    phone: '020 7379 6080',
    description: 'International law firm with a UK immigration practice advising major corporations and public sector bodies on global mobility and sponsor licensing.',
    legalAid: false,
    founded: '1919',
  },
  {
    id: 17,
    name: 'Thorntons Law LLP',
    city: 'Edinburgh',
    sraNumber: '46966',
    specialisations: ['work', 'family', 'business', 'student'],
    website: 'https://www.thorntons-law.co.uk',
    phone: '01382 229 111',
    description: 'Leading Scottish law firm with an immigration practice covering personal and corporate matters for clients across Scotland.',
    legalAid: false,
    founded: '1909',
  },
  {
    id: 18,
    name: 'Bates Wells LLP',
    city: 'London',
    sraNumber: '56224',
    specialisations: ['work', 'asylum', 'family', 'appeals'],
    website: 'https://bateswells.co.uk',
    phone: '020 7551 7777',
    description: 'Purpose-driven law firm with specialist immigration work covering social enterprise, charity sector sponsorship and refugee family reunion.',
    legalAid: true,
    founded: '1970',
  },
  {
    id: 19,
    name: 'Seddons Solicitors',
    city: 'London',
    sraNumber: '55897',
    specialisations: ['work', 'family', 'business', 'eea'],
    website: 'https://www.seddons.co.uk',
    phone: '020 7725 8000',
    description: 'Central London firm with an immigration team advising private clients, entrepreneurs and employers on UK visa applications and naturalisation.',
    legalAid: false,
    founded: '1928',
  },
  {
    id: 20,
    name: 'Coventry Citizens Advice Immigration',
    city: 'Coventry',
    sraNumber: 'N/A',
    specialisations: ['family', 'asylum', 'appeals', 'eea'],
    website: 'https://www.coventrycab.org.uk',
    phone: '024 7622 3284',
    description: 'Not-for-profit OISC-registered immigration service providing free legal advice for vulnerable individuals including asylum seekers and trafficking survivors.',
    legalAid: true,
    founded: '1939',
  },
  {
    id: 21,
    name: 'Latitude Law',
    city: 'Manchester',
    sraNumber: '618823',
    specialisations: ['work', 'family', 'student', 'appeals'],
    website: 'https://www.latitude.law',
    phone: '0161 820 6080',
    description: 'Manchester immigration law boutique advising on all UK visa categories, sponsor licences and immigration appeals for individuals and businesses.',
    legalAid: false,
    founded: '2016',
  },
];

const SPEC_LABELS: Record<Specialisation, string> = {
  work: 'WORK VISAS',
  family: 'FAMILY',
  asylum: 'ASYLUM',
  student: 'STUDENT',
  business: 'BUSINESS',
  eea: 'EU/EEA',
  appeals: 'APPEALS',
  detention: 'DETENTION',
};

const SPEC_COLORS: Record<Specialisation, string> = {
  work: 'bg-amber/20 text-amber border-amber/30',
  family: 'bg-cyan/20 text-cyan border-cyan/30',
  asylum: 'bg-red/20 text-red border-red/30',
  student: 'bg-green/20 text-green border-green/30',
  business: 'bg-purple-400/20 text-purple-400 border-purple-400/30',
  eea: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
  appeals: 'bg-orange-400/20 text-orange-400 border-orange-400/30',
  detention: 'bg-pink-400/20 text-pink-400 border-pink-400/30',
};

export default function SolicitorsPage() {
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState<string>('all');
  const [legalAidFilter, setLegalAidFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return SOLICITORS.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q);
      const matchesSpec =
        specFilter === 'all' ||
        s.specialisations.includes(specFilter as Specialisation);
      const matchesLegalAid =
        legalAidFilter === 'all' ||
        (legalAidFilter === 'yes' && s.legalAid) ||
        (legalAidFilter === 'no' && !s.legalAid);
      return matchesSearch && matchesSpec && matchesLegalAid;
    });
  }, [search, specFilter, legalAidFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-cyan/30 pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-data text-lg font-bold uppercase tracking-wider text-cyan">
              IMMIGRATION SOLICITORS DIRECTORY
            </h1>
            <p className="font-data text-xs text-dim mt-0.5">
              SRA-REGULATED IMMIGRATION LAW FIRMS // UK DIRECTORY // {SOLICITORS.length} FIRMS
            </p>
          </div>
          <a
            href="https://www.sra.org.uk/consumers/register/organisation/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-cyan/40 px-3 py-1.5 font-data text-[10px] text-cyan uppercase hover:bg-cyan/10 transition-colors"
          >
            <Scale size={12} />
            SRA REGISTER
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 border border-cyan/40 bg-cyan/5 p-3">
        <AlertTriangle size={16} className="text-cyan mt-0.5 shrink-0" />
        <div>
          <p className="font-data text-xs font-bold text-cyan uppercase">
            Always verify your solicitor is SRA-regulated before paying
          </p>
          <p className="font-data text-[11px] text-dim mt-1">
            Check every solicitor on the{' '}
            <a
              href="https://www.sra.org.uk/consumers/register/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan underline hover:text-cyan/80"
            >
              official SRA register
            </a>
            {' '}before engaging their services. Only SRA-authorised solicitors or OISC-registered advisers
            are legally permitted to provide paid immigration advice in England and Wales.
            Verify Scottish solicitors on the{' '}
            <a
              href="https://www.lawscot.org.uk/find-a-solicitor/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan underline hover:text-cyan/80"
            >
              Law Society of Scotland register
            </a>.
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
            className="w-full bg-s1 border border-s3 pl-8 pr-3 py-2 font-data text-xs text-text placeholder:text-dim focus:outline-none focus:border-cyan/60 uppercase"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-data text-[10px] text-dim uppercase">SPEC:</span>
        {[
          { v: 'all', label: 'ALL' },
          { v: 'work', label: 'WORK' },
          { v: 'family', label: 'FAMILY' },
          { v: 'asylum', label: 'ASYLUM' },
          { v: 'student', label: 'STUDENT' },
          { v: 'business', label: 'BUSINESS' },
          { v: 'eea', label: 'EU/EEA' },
          { v: 'appeals', label: 'APPEALS' },
          { v: 'detention', label: 'DETENTION' },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setSpecFilter(opt.v)}
            className={cn(
              'px-2 py-1 font-data text-[10px] uppercase transition-colors border',
              specFilter === opt.v
                ? 'bg-cyan text-bg font-bold border-cyan'
                : 'text-dim hover:text-cyan border-s3',
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="mx-1 text-s3 font-data text-xs">|</span>
        <span className="font-data text-[10px] text-dim uppercase">LEGAL AID:</span>
        {[
          { v: 'all', label: 'ALL' },
          { v: 'yes', label: 'OFFERS' },
          { v: 'no', label: 'PRIVATE ONLY' },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setLegalAidFilter(opt.v)}
            className={cn(
              'px-2 py-1 font-data text-[10px] uppercase transition-colors border',
              legalAidFilter === opt.v
                ? 'bg-cyan text-bg font-bold border-cyan'
                : 'text-dim hover:text-cyan border-s3',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="font-data text-[10px] text-dim">
        SHOWING {filtered.length} OF {SOLICITORS.length} SRA-REGULATED FIRMS
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="border border-s3 bg-s1 p-4 flex flex-col gap-3 hover:border-cyan/40 transition-colors"
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-data text-sm font-bold text-text uppercase leading-tight">
                  {s.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-data text-[11px] text-dim">{s.city}</p>
                  {s.founded && (
                    <span className="font-data text-[9px] text-s3">EST. {s.founded}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="border border-cyan/40 bg-cyan/10 px-2 py-0.5 font-data text-[10px] font-bold text-cyan uppercase">
                  SRA
                </span>
                {s.legalAid && (
                  <span className="border border-green/40 bg-green/10 px-1.5 py-0.5 font-data text-[9px] font-bold text-green uppercase">
                    LEGAL AID
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="font-data text-[11px] text-dim leading-relaxed line-clamp-3">
              {s.description}
            </p>

            {/* Specialisations */}
            <div className="flex flex-wrap gap-1">
              {s.specialisations.map((spec) => (
                <span
                  key={spec}
                  className={cn(
                    'border px-1.5 py-0.5 font-data text-[9px] font-bold uppercase',
                    SPEC_COLORS[spec],
                  )}
                >
                  {SPEC_LABELS[spec]}
                </span>
              ))}
            </div>

            {/* Contact / Links */}
            <div className="mt-auto pt-2 border-t border-s3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Phone size={11} className="text-dim shrink-0" />
                <span className="font-data text-[11px] text-dim">{s.phone}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={s.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-amber hover:text-amber/80 transition-colors"
                >
                  <Globe size={11} />
                  WEBSITE
                  <ExternalLink size={9} />
                </a>
                <a
                  href={`https://www.sra.org.uk/consumers/register/organisation/?SRANumber=${s.sraNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-data text-[11px] text-cyan hover:text-cyan/80 transition-colors"
                >
                  <ShieldCheck size={11} />
                  VERIFY SRA
                  <ExternalLink size={9} />
                </a>
              </div>
              {s.sraNumber && s.sraNumber !== 'N/A' && (
                <p className="font-data text-[9px] text-s3">
                  SRA NO: {s.sraNumber}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="border border-s3 bg-s1 p-8 text-center">
          <p className="font-data text-xs text-dim uppercase">NO SOLICITORS MATCH YOUR FILTERS</p>
        </div>
      )}

      {/* Legal Aid Info */}
      <div className="border border-green/30 bg-green/5 p-4">
        <div className="flex items-start gap-3">
          <Scale size={16} className="text-green shrink-0 mt-0.5" />
          <div>
            <h3 className="font-data text-xs font-bold text-green uppercase">
              ABOUT LEGAL AID
            </h3>
            <p className="font-data text-[11px] text-dim mt-1 leading-relaxed">
              Legal aid for immigration matters is available to asylum seekers, trafficking victims, and people
              facing detention or deportation. Eligibility is means and merits tested. Firms marked LEGAL AID
              hold a contract with the Legal Aid Agency.
            </p>
            <a
              href="https://www.gov.uk/check-legal-aid"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-data text-[11px] text-green hover:text-green/80 transition-colors underline"
            >
              Check if you qualify for legal aid <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* Report a Concern */}
      <div className="border border-red/30 bg-red/5 p-4">
        <div className="flex items-start gap-3">
          <Flag size={16} className="text-red shrink-0 mt-0.5" />
          <div>
            <h3 className="font-data text-xs font-bold text-red uppercase">
              REPORT A CONCERN
            </h3>
            <p className="font-data text-[11px] text-dim mt-1 leading-relaxed">
              If a solicitor has acted improperly, is not on the SRA register, or you suspect fraud,
              report them immediately.
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a
                href="https://www.sra.org.uk/consumers/problems/report-solicitor/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-data text-[11px] text-red hover:text-red/80 transition-colors underline"
              >
                Report to SRA <ExternalLink size={10} />
              </a>
              <a
                href="https://www.legalombudsman.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-data text-[11px] text-dim hover:text-text transition-colors underline"
              >
                Legal Ombudsman <ExternalLink size={10} />
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
        any individual firm. Always verify current SRA registration status at sra.org.uk before engaging any
        solicitor. Scottish solicitors regulated by the Law Society of Scotland. Data correct to the best of
        our knowledge as of March 2026.
      </p>
    </div>
  );
}
