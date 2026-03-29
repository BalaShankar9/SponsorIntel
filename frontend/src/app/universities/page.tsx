'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, X, GraduationCap, MapPin, Globe, ExternalLink,
  ChevronUp, ChevronDown, Info, Star, Filter, AlertCircle,
  BookOpen, Briefcase, Users, PoundSterling, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface University {
  id: number;
  name: string;
  city: string;
  region: string;
  qsRank2025: number;
  isRussellGroup: boolean;
  internationalPct: number;   // % of student body
  ugFeeMin: number;           // £ per year
  ugFeeMax: number;
  pgFeeMin: number;
  pgFeeMax: number;
  employmentRate: number;     // % in grad-level employment 15 months after graduation (HESA)
  notableCourses: string[];
  website: string;
  totalStudents: number;
  internationalStudents: number;
}

type SortKey = 'qsRank2025' | 'internationalPct' | 'ugFeeMin' | 'pgFeeMin' | 'employmentRate';
type SortDir = 'asc' | 'desc';

// ── Real data ─────────────────────────────────────────────────────────────────
// Sources: QS World University Rankings 2025, HESA 2022/23, university websites

const UNIVERSITIES: University[] = [
  {
    id: 1,
    name: 'University of Oxford',
    city: 'Oxford',
    region: 'South East',
    qsRank2025: 3,
    isRussellGroup: true,
    internationalPct: 46,
    ugFeeMin: 26770,
    ugFeeMax: 39010,
    pgFeeMin: 26770,
    pgFeeMax: 45620,
    employmentRate: 94,
    notableCourses: ['PPE', 'Medicine', 'Law', 'Computer Science', 'Engineering'],
    website: 'https://www.ox.ac.uk',
    totalStudents: 26380,
    internationalStudents: 12135,
  },
  {
    id: 2,
    name: 'University of Cambridge',
    city: 'Cambridge',
    region: 'East of England',
    qsRank2025: 5,
    isRussellGroup: true,
    internationalPct: 40,
    ugFeeMin: 24507,
    ugFeeMax: 63990,
    pgFeeMin: 25740,
    pgFeeMax: 58038,
    employmentRate: 95,
    notableCourses: ['Natural Sciences', 'Mathematics', 'Engineering', 'Law', 'Economics'],
    website: 'https://www.cam.ac.uk',
    totalStudents: 24450,
    internationalStudents: 9780,
  },
  {
    id: 3,
    name: 'Imperial College London',
    city: 'London',
    region: 'London',
    qsRank2025: 8,
    isRussellGroup: true,
    internationalPct: 59,
    ugFeeMin: 35100,
    ugFeeMax: 44900,
    pgFeeMin: 32000,
    pgFeeMax: 54000,
    employmentRate: 93,
    notableCourses: ['Engineering', 'Medicine', 'Business', 'Physics', 'Computing'],
    website: 'https://www.imperial.ac.uk',
    totalStudents: 19400,
    internationalStudents: 11446,
  },
  {
    id: 4,
    name: 'University College London (UCL)',
    city: 'London',
    region: 'London',
    qsRank2025: 9,
    isRussellGroup: true,
    internationalPct: 54,
    ugFeeMin: 23900,
    ugFeeMax: 38800,
    pgFeeMin: 21300,
    pgFeeMax: 37800,
    employmentRate: 90,
    notableCourses: ['Architecture', 'Laws', 'Medicine', 'Economics', 'Psychology'],
    website: 'https://www.ucl.ac.uk',
    totalStudents: 43965,
    internationalStudents: 23741,
  },
  {
    id: 5,
    name: 'London School of Economics (LSE)',
    city: 'London',
    region: 'London',
    qsRank2025: 45,
    isRussellGroup: true,
    internationalPct: 71,
    ugFeeMin: 23160,
    ugFeeMax: 23160,
    pgFeeMin: 24048,
    pgFeeMax: 36192,
    employmentRate: 89,
    notableCourses: ['Economics', 'Politics', 'Law', 'Finance', 'International Relations'],
    website: 'https://www.lse.ac.uk',
    totalStudents: 12070,
    internationalStudents: 8570,
  },
  {
    id: 6,
    name: 'University of Edinburgh',
    city: 'Edinburgh',
    region: 'Scotland',
    qsRank2025: 27,
    isRussellGroup: true,
    internationalPct: 47,
    ugFeeMin: 20910,
    ugFeeMax: 33500,
    pgFeeMin: 19100,
    pgFeeMax: 34200,
    employmentRate: 87,
    notableCourses: ['Medicine', 'Law', 'Informatics', 'Business', 'Veterinary Medicine'],
    website: 'https://www.ed.ac.uk',
    totalStudents: 43730,
    internationalStudents: 20553,
  },
  {
    id: 7,
    name: 'University of Manchester',
    city: 'Manchester',
    region: 'North West',
    qsRank2025: 34,
    isRussellGroup: true,
    internationalPct: 38,
    ugFeeMin: 21000,
    ugFeeMax: 32500,
    pgFeeMin: 18000,
    pgFeeMax: 33000,
    employmentRate: 86,
    notableCourses: ['Business', 'Engineering', 'Medicine', 'Computer Science', 'Physics'],
    website: 'https://www.manchester.ac.uk',
    totalStudents: 45135,
    internationalStudents: 17151,
  },
  {
    id: 8,
    name: "King's College London",
    city: 'London',
    region: 'London',
    qsRank2025: 40,
    isRussellGroup: true,
    internationalPct: 46,
    ugFeeMin: 22680,
    ugFeeMax: 34500,
    pgFeeMin: 20000,
    pgFeeMax: 35000,
    employmentRate: 87,
    notableCourses: ['Law', 'Medicine', 'Dentistry', 'Nursing', 'War Studies'],
    website: 'https://www.kcl.ac.uk',
    totalStudents: 36255,
    internationalStudents: 16677,
  },
  {
    id: 9,
    name: 'University of Bristol',
    city: 'Bristol',
    region: 'South West',
    qsRank2025: 54,
    isRussellGroup: true,
    internationalPct: 31,
    ugFeeMin: 22770,
    ugFeeMax: 29500,
    pgFeeMin: 18000,
    pgFeeMax: 28000,
    employmentRate: 85,
    notableCourses: ['Aerospace Engineering', 'Law', 'Medicine', 'Economics', 'Chemistry'],
    website: 'https://www.bristol.ac.uk',
    totalStudents: 26990,
    internationalStudents: 8367,
  },
  {
    id: 10,
    name: 'University of Warwick',
    city: 'Coventry',
    region: 'West Midlands',
    qsRank2025: 69,
    isRussellGroup: true,
    internationalPct: 40,
    ugFeeMin: 22350,
    ugFeeMax: 31700,
    pgFeeMin: 18000,
    pgFeeMax: 39250,
    employmentRate: 87,
    notableCourses: ['Business', 'Economics', 'Mathematics', 'Computer Science', 'Engineering'],
    website: 'https://www.warwick.ac.uk',
    totalStudents: 27470,
    internationalStudents: 10988,
  },
  {
    id: 11,
    name: 'University of Glasgow',
    city: 'Glasgow',
    region: 'Scotland',
    qsRank2025: 78,
    isRussellGroup: true,
    internationalPct: 33,
    ugFeeMin: 17950,
    ugFeeMax: 27750,
    pgFeeMin: 16500,
    pgFeeMax: 27750,
    employmentRate: 84,
    notableCourses: ['Medicine', 'Law', 'Veterinary Medicine', 'Engineering', 'Arts'],
    website: 'https://www.gla.ac.uk',
    totalStudents: 38135,
    internationalStudents: 12585,
  },
  {
    id: 12,
    name: 'Durham University',
    city: 'Durham',
    region: 'North East',
    qsRank2025: 82,
    isRussellGroup: true,
    internationalPct: 27,
    ugFeeMin: 21450,
    ugFeeMax: 25000,
    pgFeeMin: 18000,
    pgFeeMax: 30000,
    employmentRate: 84,
    notableCourses: ['Law', 'Business', 'Physics', 'Archaeology', 'Natural Sciences'],
    website: 'https://www.durham.ac.uk',
    totalStudents: 22215,
    internationalStudents: 5998,
  },
  {
    id: 13,
    name: 'University of Sheffield',
    city: 'Sheffield',
    region: 'Yorkshire',
    qsRank2025: 111,
    isRussellGroup: true,
    internationalPct: 33,
    ugFeeMin: 20500,
    ugFeeMax: 26950,
    pgFeeMin: 17500,
    pgFeeMax: 26000,
    employmentRate: 83,
    notableCourses: ['Engineering', 'Architecture', 'Medicine', 'Music', 'Chemistry'],
    website: 'https://www.sheffield.ac.uk',
    totalStudents: 32145,
    internationalStudents: 10608,
  },
  {
    id: 14,
    name: 'University of Nottingham',
    city: 'Nottingham',
    region: 'East Midlands',
    qsRank2025: 113,
    isRussellGroup: true,
    internationalPct: 29,
    ugFeeMin: 20500,
    ugFeeMax: 27650,
    pgFeeMin: 16500,
    pgFeeMax: 26000,
    employmentRate: 83,
    notableCourses: ['Business', 'Pharmacy', 'Engineering', 'Medicine', 'Law'],
    website: 'https://www.nottingham.ac.uk',
    totalStudents: 35390,
    internationalStudents: 10263,
  },
  {
    id: 15,
    name: 'University of Leeds',
    city: 'Leeds',
    region: 'Yorkshire',
    qsRank2025: 86,
    isRussellGroup: true,
    internationalPct: 30,
    ugFeeMin: 21000,
    ugFeeMax: 27500,
    pgFeeMin: 18000,
    pgFeeMax: 27000,
    employmentRate: 83,
    notableCourses: ['Medicine', 'Law', 'Business', 'Engineering', 'Fashion'],
    website: 'https://www.leeds.ac.uk',
    totalStudents: 38965,
    internationalStudents: 11690,
  },
  {
    id: 16,
    name: 'University of Birmingham',
    city: 'Birmingham',
    region: 'West Midlands',
    qsRank2025: 90,
    isRussellGroup: true,
    internationalPct: 31,
    ugFeeMin: 21000,
    ugFeeMax: 28000,
    pgFeeMin: 17500,
    pgFeeMax: 27500,
    employmentRate: 83,
    notableCourses: ['Business', 'Engineering', 'Medicine', 'Law', 'Sports Science'],
    website: 'https://www.birmingham.ac.uk',
    totalStudents: 38310,
    internationalStudents: 11876,
  },
  {
    id: 17,
    name: 'University of Southampton',
    city: 'Southampton',
    region: 'South East',
    qsRank2025: 99,
    isRussellGroup: true,
    internationalPct: 31,
    ugFeeMin: 20700,
    ugFeeMax: 26800,
    pgFeeMin: 17500,
    pgFeeMax: 26000,
    employmentRate: 84,
    notableCourses: ['Engineering', 'Computer Science', 'Medicine', 'Oceanography', 'Music'],
    website: 'https://www.southampton.ac.uk',
    totalStudents: 27415,
    internationalStudents: 8499,
  },
  {
    id: 18,
    name: 'University of Exeter',
    city: 'Exeter',
    region: 'South West',
    qsRank2025: 149,
    isRussellGroup: true,
    internationalPct: 27,
    ugFeeMin: 20500,
    ugFeeMax: 24500,
    pgFeeMin: 16500,
    pgFeeMax: 24000,
    employmentRate: 82,
    notableCourses: ['Business', 'Law', 'Medicine', 'Biosciences', 'Politics'],
    website: 'https://www.exeter.ac.uk',
    totalStudents: 29370,
    internationalStudents: 7930,
  },
  {
    id: 19,
    name: 'University of York',
    city: 'York',
    region: 'Yorkshire',
    qsRank2025: 197,
    isRussellGroup: false,
    internationalPct: 26,
    ugFeeMin: 20000,
    ugFeeMax: 24250,
    pgFeeMin: 16500,
    pgFeeMax: 24500,
    employmentRate: 81,
    notableCourses: ['Computer Science', 'Politics', 'History', 'Music', 'Psychology'],
    website: 'https://www.york.ac.uk',
    totalStudents: 20985,
    internationalStudents: 5456,
  },
  {
    id: 20,
    name: 'University of Bath',
    city: 'Bath',
    region: 'South West',
    qsRank2025: 210,
    isRussellGroup: false,
    internationalPct: 32,
    ugFeeMin: 20900,
    ugFeeMax: 25700,
    pgFeeMin: 17000,
    pgFeeMax: 27000,
    employmentRate: 88,
    notableCourses: ['Engineering', 'Business', 'Pharmacy', 'Architecture', 'Sports Science'],
    website: 'https://www.bath.ac.uk',
    totalStudents: 20580,
    internationalStudents: 6586,
  },
  {
    id: 21,
    name: 'University of St Andrews',
    city: 'St Andrews',
    region: 'Scotland',
    qsRank2025: 104,
    isRussellGroup: false,
    internationalPct: 45,
    ugFeeMin: 21370,
    ugFeeMax: 28430,
    pgFeeMin: 18000,
    pgFeeMax: 27000,
    employmentRate: 85,
    notableCourses: ['International Relations', 'Mathematics', 'Medicine', 'Philosophy', 'Film Studies'],
    website: 'https://www.st-andrews.ac.uk',
    totalStudents: 10135,
    internationalStudents: 4561,
  },
  {
    id: 22,
    name: 'University of Liverpool',
    city: 'Liverpool',
    region: 'North West',
    qsRank2025: 182,
    isRussellGroup: true,
    internationalPct: 27,
    ugFeeMin: 20160,
    ugFeeMax: 25000,
    pgFeeMin: 16500,
    pgFeeMax: 26500,
    employmentRate: 81,
    notableCourses: ['Medicine', 'Veterinary Science', 'Law', 'Business', 'Architecture'],
    website: 'https://www.liverpool.ac.uk',
    totalStudents: 27990,
    internationalStudents: 7557,
  },
  {
    id: 23,
    name: 'Queen Mary University of London',
    city: 'London',
    region: 'London',
    qsRank2025: 117,
    isRussellGroup: true,
    internationalPct: 47,
    ugFeeMin: 21000,
    ugFeeMax: 27500,
    pgFeeMin: 17500,
    pgFeeMax: 28000,
    employmentRate: 82,
    notableCourses: ['Medicine', 'Law', 'Engineering', 'Business', 'Drama'],
    website: 'https://www.qmul.ac.uk',
    totalStudents: 29735,
    internationalStudents: 13975,
  },
  {
    id: 24,
    name: 'Cardiff University',
    city: 'Cardiff',
    region: 'Wales',
    qsRank2025: 151,
    isRussellGroup: true,
    internationalPct: 25,
    ugFeeMin: 20450,
    ugFeeMax: 26000,
    pgFeeMin: 16500,
    pgFeeMax: 26000,
    employmentRate: 82,
    notableCourses: ['Journalism', 'Medicine', 'Architecture', 'Engineering', 'Law'],
    website: 'https://www.cardiff.ac.uk',
    totalStudents: 35130,
    internationalStudents: 8783,
  },
  {
    id: 25,
    name: 'Newcastle University',
    city: 'Newcastle',
    region: 'North East',
    qsRank2025: 155,
    isRussellGroup: true,
    internationalPct: 28,
    ugFeeMin: 21000,
    ugFeeMax: 26000,
    pgFeeMin: 17000,
    pgFeeMax: 26500,
    employmentRate: 83,
    notableCourses: ['Medicine', 'Architecture', 'Engineering', 'Marine Biology', 'Accounting'],
    website: 'https://www.ncl.ac.uk',
    totalStudents: 29375,
    internationalStudents: 8225,
  },
  {
    id: 26,
    name: "Queen's University Belfast",
    city: 'Belfast',
    region: 'Northern Ireland',
    qsRank2025: 251,
    isRussellGroup: true,
    internationalPct: 20,
    ugFeeMin: 20250,
    ugFeeMax: 24500,
    pgFeeMin: 15500,
    pgFeeMax: 25000,
    employmentRate: 80,
    notableCourses: ['Medicine', 'Law', 'Engineering', 'Business', 'Pharmacy'],
    website: 'https://www.qub.ac.uk',
    totalStudents: 25365,
    internationalStudents: 5073,
  },
  {
    id: 27,
    name: 'Loughborough University',
    city: 'Loughborough',
    region: 'East Midlands',
    qsRank2025: 247,
    isRussellGroup: false,
    internationalPct: 30,
    ugFeeMin: 20000,
    ugFeeMax: 24500,
    pgFeeMin: 16500,
    pgFeeMax: 23000,
    employmentRate: 89,
    notableCourses: ['Sports Science', 'Engineering', 'Design', 'Business', 'Mathematics'],
    website: 'https://www.lboro.ac.uk',
    totalStudents: 18270,
    internationalStudents: 5481,
  },
  {
    id: 28,
    name: 'University of Sussex',
    city: 'Brighton',
    region: 'South East',
    qsRank2025: 261,
    isRussellGroup: false,
    internationalPct: 35,
    ugFeeMin: 19200,
    ugFeeMax: 23750,
    pgFeeMin: 16000,
    pgFeeMax: 23500,
    employmentRate: 80,
    notableCourses: ['Media Studies', 'Psychology', 'Law', 'International Development', 'Physics'],
    website: 'https://www.sussex.ac.uk',
    totalStudents: 20820,
    internationalStudents: 7287,
  },
  {
    id: 29,
    name: 'Lancaster University',
    city: 'Lancaster',
    region: 'North West',
    qsRank2025: 306,
    isRussellGroup: false,
    internationalPct: 33,
    ugFeeMin: 19800,
    ugFeeMax: 23400,
    pgFeeMin: 16000,
    pgFeeMax: 24000,
    employmentRate: 81,
    notableCourses: ['Business', 'Law', 'Physics', 'Computer Science', 'English Literature'],
    website: 'https://www.lancaster.ac.uk',
    totalStudents: 16975,
    internationalStudents: 5602,
  },
  {
    id: 30,
    name: 'University of Leicester',
    city: 'Leicester',
    region: 'East Midlands',
    qsRank2025: 381,
    isRussellGroup: false,
    internationalPct: 26,
    ugFeeMin: 19200,
    ugFeeMax: 23900,
    pgFeeMin: 15500,
    pgFeeMax: 22500,
    employmentRate: 80,
    notableCourses: ['Space Science', 'Genetics', 'Law', 'Museum Studies', 'Medicine'],
    website: 'https://www.leicester.ac.uk',
    totalStudents: 22290,
    internationalStudents: 5795,
  },
];

const CITIES = Array.from(new Set(UNIVERSITIES.map(u => u.city))).sort();
const REGIONS = Array.from(new Set(UNIVERSITIES.map(u => u.region))).sort();

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-GB');
}

function fmtFee(n: number) {
  return `£${(n / 1000).toFixed(0)}k`;
}

function rankBadgeColor(rank: number) {
  if (rank <= 10) return 'text-amber border-amber/40 bg-amber/10';
  if (rank <= 50) return 'text-green border-green/40 bg-green/10';
  if (rank <= 150) return 'text-blue-400 border-blue-400/40 bg-blue-400/10';
  return 'text-dim border-s4 bg-s3';
}

// ── Components ────────────────────────────────────────────────────────────────

function SortIcon({ col, current, dir }: { col: SortKey; current: SortKey; dir: SortDir }) {
  if (col !== current) return <ChevronUp className="w-3 h-3 text-dim opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-amber" />
    : <ChevronDown className="w-3 h-3 text-amber" />;
}

function VisaFactsPanel() {
  return (
    <div className="border border-s4 bg-s1 rounded-sm mb-6">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-s4">
        <AlertCircle className="w-4 h-4 text-amber" />
        <span className="font-data text-xs text-amber tracking-widest uppercase">Student Visa — Quick Reference</span>
        <a
          href="https://www.gov.uk/student-visa"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-dim text-xs hover:text-amber transition-colors"
        >
          Gov.uk <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-s4 sm:divide-y-0 sm:divide-x sm:divide-s4">

        <div className="px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-amber" />
            <span className="font-data text-xs text-amber uppercase tracking-wider">Eligibility</span>
          </div>
          <ul className="space-y-1.5 font-data text-xs text-text-dim">
            <li className="flex gap-2"><span className="text-amber shrink-0">•</span>Unconditional offer from a licensed Student sponsor</li>
            <li className="flex gap-2"><span className="text-amber shrink-0">•</span>English language: B2 CEFR (IELTS 5.5–6.5 typical)</li>
            <li className="flex gap-2"><span className="text-amber shrink-0">•</span>Degree-level or above (RQF level 6+)</li>
            <li className="flex gap-2"><span className="text-amber shrink-0">•</span>CAS number from your university</li>
          </ul>
        </div>

        <div className="px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <PoundSterling className="w-3.5 h-3.5 text-green" />
            <span className="font-data text-xs text-green uppercase tracking-wider">Finances</span>
          </div>
          <ul className="space-y-1.5 font-data text-xs text-text-dim">
            <li className="flex gap-2"><span className="text-green shrink-0">•</span><span><span className="text-text font-medium">London:</span> £1,334/month (up to 9 months = £12,006)</span></li>
            <li className="flex gap-2"><span className="text-green shrink-0">•</span><span><span className="text-text font-medium">Outside London:</span> £1,023/month</span></li>
            <li className="flex gap-2"><span className="text-green shrink-0">•</span>Funds must be held for 28 days before applying</li>
            <li className="flex gap-2"><span className="text-green shrink-0">•</span>IHS surcharge: £776/year (students)</li>
          </ul>
        </div>

        <div className="px-4 py-4 space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-data text-xs text-blue-400 uppercase tracking-wider">Work Rights &amp; Post-Study</span>
          </div>
          <ul className="space-y-1.5 font-data text-xs text-text-dim">
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span><span><span className="text-text font-medium">Term time:</span> 20 hrs/week</span></li>
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span><span><span className="text-text font-medium">Holidays:</span> Full-time work permitted</span></li>
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span><span><span className="text-text font-medium">Graduate visa:</span> 2 yrs post-study (3 yrs for PhD)</span></li>
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span><span><span className="text-text font-medium">Switch to Skilled Worker:</span> £38,700 salary threshold</span></li>
          </ul>
        </div>

      </div>
      <div className="px-4 py-2.5 border-t border-s4 flex items-center gap-2 bg-s2/40">
        <Info className="w-3 h-3 text-dim shrink-0" />
        <span className="font-data text-xs text-dim">
          All UK universities below hold a{' '}
          <a
            href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-students"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber hover:underline"
          >
            Student sponsor licence
          </a>
          {' '}from the Home Office. Visa rules correct as of March 2026.
        </span>
      </div>
    </div>
  );
}

function UniversityCard({ uni }: { uni: University }) {
  return (
    <div className="border border-s4 bg-s1 rounded-sm hover:border-amber/40 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-s4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('font-data text-xs border px-1.5 py-0.5 rounded-sm', rankBadgeColor(uni.qsRank2025))}>
              QS #{uni.qsRank2025}
            </span>
            {uni.isRussellGroup && (
              <span className="font-data text-xs border border-purple-400/40 bg-purple-400/10 text-purple-400 px-1.5 py-0.5 rounded-sm">
                Russell Group
              </span>
            )}
            <span className="font-data text-xs border border-green/40 bg-green/10 text-green px-1.5 py-0.5 rounded-sm">
              Student Sponsor
            </span>
          </div>
          <h3 className="font-ui font-semibold text-sm text-text group-hover:text-amber transition-colors leading-tight">
            {uni.name}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-dim shrink-0" />
            <span className="font-data text-xs text-dim">{uni.city}, {uni.region}</span>
          </div>
        </div>
        <a
          href={uni.website}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-dim hover:text-amber transition-colors shrink-0 mt-1"
          aria-label={`Visit ${uni.name} website`}
        >
          <Globe className="w-4 h-4" />
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-s4">
        <div className="px-3 py-3 border-b border-s4">
          <div className="font-data text-[10px] text-dim uppercase tracking-wider mb-1">International %</div>
          <div className="font-data text-lg font-bold text-text">{uni.internationalPct}%</div>
          <div className="font-data text-[10px] text-dim">{fmt(uni.internationalStudents)} students</div>
        </div>
        <div className="px-3 py-3 border-b border-s4">
          <div className="font-data text-[10px] text-dim uppercase tracking-wider mb-1">Grad Employment</div>
          <div className={cn('font-data text-lg font-bold', uni.employmentRate >= 88 ? 'text-green' : uni.employmentRate >= 83 ? 'text-amber' : 'text-text')}>
            {uni.employmentRate}%
          </div>
          <div className="font-data text-[10px] text-dim">15 months post-grad</div>
        </div>
        <div className="px-3 py-3">
          <div className="font-data text-[10px] text-dim uppercase tracking-wider mb-1">UG Fees (Intl)</div>
          <div className="font-data text-sm font-bold text-text">{fmtFee(uni.ugFeeMin)}–{fmtFee(uni.ugFeeMax)}</div>
          <div className="font-data text-[10px] text-dim">per year</div>
        </div>
        <div className="px-3 py-3">
          <div className="font-data text-[10px] text-dim uppercase tracking-wider mb-1">PG Fees (Intl)</div>
          <div className="font-data text-sm font-bold text-text">{fmtFee(uni.pgFeeMin)}–{fmtFee(uni.pgFeeMax)}</div>
          <div className="font-data text-[10px] text-dim">per year</div>
        </div>
      </div>

      {/* Notable courses */}
      <div className="px-3 py-3 border-t border-s4">
        <div className="font-data text-[10px] text-dim uppercase tracking-wider mb-2">Notable Courses</div>
        <div className="flex flex-wrap gap-1">
          {uni.notableCourses.map(c => (
            <span key={c} className="font-data text-[10px] bg-s3 border border-s4 text-dim px-1.5 py-0.5 rounded-sm">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UniversitiesPage() {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [russellFilter, setRussellFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [rankRange, setRankRange] = useState<'all' | 'top10' | 'top50' | 'top100' | 'top200'>('all');
  const [feeRange, setFeeRange] = useState<'all' | 'under20' | '20to25' | 'over25'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('qsRank2025');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'qsRank2025' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...UNIVERSITIES];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.notableCourses.some(c => c.toLowerCase().includes(q))
      );
    }

    if (cityFilter) list = list.filter(u => u.city === cityFilter);

    if (russellFilter === 'yes') list = list.filter(u => u.isRussellGroup);
    if (russellFilter === 'no') list = list.filter(u => !u.isRussellGroup);

    if (rankRange === 'top10') list = list.filter(u => u.qsRank2025 <= 10);
    if (rankRange === 'top50') list = list.filter(u => u.qsRank2025 <= 50);
    if (rankRange === 'top100') list = list.filter(u => u.qsRank2025 <= 100);
    if (rankRange === 'top200') list = list.filter(u => u.qsRank2025 <= 200);

    if (feeRange === 'under20') list = list.filter(u => u.ugFeeMin < 20000);
    if (feeRange === '20to25') list = list.filter(u => u.ugFeeMin >= 20000 && u.ugFeeMin <= 25000);
    if (feeRange === 'over25') list = list.filter(u => u.ugFeeMin > 25000);

    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const mult = sortDir === 'asc' ? 1 : -1;
      return (av - bv) * mult;
    });

    return list;
  }, [search, cityFilter, russellFilter, rankRange, feeRange, sortKey, sortDir]);

  const totalIntl = UNIVERSITIES.reduce((s, u) => s + u.internationalStudents, 0);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-amber" />
              <h1 className="font-data text-lg font-bold text-text tracking-tight uppercase">
                UK Universities Hub
              </h1>
              <span className="font-data text-xs border border-amber/40 bg-amber/10 text-amber px-2 py-0.5 rounded-sm">
                Student Visa
              </span>
            </div>
            <p className="font-data text-xs text-dim">
              Top 30 UK universities · QS 2025 rankings · Real fee &amp; employment data
            </p>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-4 font-data text-xs text-dim">
            <div className="text-center">
              <div className="text-text font-bold text-sm">30</div>
              <div>Universities</div>
            </div>
            <div className="text-center">
              <div className="text-text font-bold text-sm">{fmt(totalIntl)}</div>
              <div>Intl Students</div>
            </div>
            <div className="text-center">
              <div className="text-text font-bold text-sm">24</div>
              <div>Russell Group</div>
            </div>
          </div>
        </div>

        {/* Visa quick facts */}
        <VisaFactsPanel />

        {/* Search + controls */}
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim pointer-events-none" />
              <input
                type="text"
                placeholder="Search university, city, or course…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-s1 border border-s4 rounded-sm pl-9 pr-8 py-2 font-data text-xs text-text placeholder:text-dim focus:outline-none focus:border-amber/60 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 border rounded-sm font-data text-xs transition-colors',
                showFilters
                  ? 'border-amber/60 bg-amber/10 text-amber'
                  : 'border-s4 bg-s1 text-dim hover:text-text hover:border-s5'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>

            {/* View toggle */}
            <div className="flex border border-s4 rounded-sm overflow-hidden">
              {(['cards', 'table'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    'px-3 py-2 font-data text-xs capitalize transition-colors',
                    viewMode === m ? 'bg-s3 text-amber' : 'bg-s1 text-dim hover:text-text'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={e => { setSortKey(e.target.value as SortKey); setSortDir(e.target.value === 'qsRank2025' ? 'asc' : 'desc'); }}
              className="bg-s1 border border-s4 rounded-sm px-3 py-2 font-data text-xs text-text focus:outline-none focus:border-amber/60"
            >
              <option value="qsRank2025">Sort: QS Rank</option>
              <option value="internationalPct">Sort: Intl %</option>
              <option value="employmentRate">Sort: Employment</option>
              <option value="ugFeeMin">Sort: UG Fee</option>
              <option value="pgFeeMin">Sort: PG Fee</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-s4 bg-s1 rounded-sm text-dim hover:text-text transition-colors"
              title="Toggle sort direction"
            >
              {sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="border border-s4 bg-s1 rounded-sm px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="font-data text-[10px] text-dim uppercase tracking-wider block mb-1.5">City</label>
                <select
                  value={cityFilter}
                  onChange={e => setCityFilter(e.target.value)}
                  className="w-full bg-s2 border border-s4 rounded-sm px-2 py-1.5 font-data text-xs text-text focus:outline-none focus:border-amber/60"
                >
                  <option value="">All cities</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="font-data text-[10px] text-dim uppercase tracking-wider block mb-1.5">Russell Group</label>
                <select
                  value={russellFilter}
                  onChange={e => setRussellFilter(e.target.value as 'all' | 'yes' | 'no')}
                  className="w-full bg-s2 border border-s4 rounded-sm px-2 py-1.5 font-data text-xs text-text focus:outline-none focus:border-amber/60"
                >
                  <option value="all">All</option>
                  <option value="yes">Russell Group only</option>
                  <option value="no">Non-Russell Group</option>
                </select>
              </div>
              <div>
                <label className="font-data text-[10px] text-dim uppercase tracking-wider block mb-1.5">QS Rank</label>
                <select
                  value={rankRange}
                  onChange={e => setRankRange(e.target.value as typeof rankRange)}
                  className="w-full bg-s2 border border-s4 rounded-sm px-2 py-1.5 font-data text-xs text-text focus:outline-none focus:border-amber/60"
                >
                  <option value="all">All rankings</option>
                  <option value="top10">Top 10</option>
                  <option value="top50">Top 50</option>
                  <option value="top100">Top 100</option>
                  <option value="top200">Top 200</option>
                </select>
              </div>
              <div>
                <label className="font-data text-[10px] text-dim uppercase tracking-wider block mb-1.5">UG Fee Range</label>
                <select
                  value={feeRange}
                  onChange={e => setFeeRange(e.target.value as typeof feeRange)}
                  className="w-full bg-s2 border border-s4 rounded-sm px-2 py-1.5 font-data text-xs text-text focus:outline-none focus:border-amber/60"
                >
                  <option value="all">All fees</option>
                  <option value="under20">Under £20k/yr</option>
                  <option value="20to25">£20k–£25k/yr</option>
                  <option value="over25">Over £25k/yr</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4 flex justify-end">
                <button
                  onClick={() => { setCityFilter(''); setRussellFilter('all'); setRankRange('all'); setFeeRange('all'); setSearch(''); }}
                  className="font-data text-xs text-dim hover:text-amber transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between">
          <span className="font-data text-xs text-dim">
            {filtered.length} universit{filtered.length === 1 ? 'y' : 'ies'} found
          </span>
          <a
            href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-students"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-data text-xs text-dim hover:text-amber transition-colors"
          >
            Home Office Student Sponsor Register <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Cards view */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(uni => (
              <UniversityCard key={uni.id} uni={uni} />
            ))}
          </div>
        )}

        {/* Table view */}
        {viewMode === 'table' && (
          <div className="border border-s4 rounded-sm overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-s4 bg-s2">
                  {(
                    [
                      { key: 'qsRank2025', label: 'QS Rank' },
                      { key: null, label: 'University' },
                      { key: null, label: 'City' },
                      { key: null, label: 'Russell' },
                      { key: 'internationalPct', label: 'Intl %' },
                      { key: 'ugFeeMin', label: 'UG Fee' },
                      { key: 'pgFeeMin', label: 'PG Fee' },
                      { key: 'employmentRate', label: 'Employment' },
                      { key: null, label: '' },
                    ] as { key: SortKey | null; label: string }[]
                  ).map(col => (
                    <th
                      key={col.label || Math.random()}
                      className={cn(
                        'px-3 py-2.5 font-data text-[10px] text-dim uppercase tracking-wider text-left',
                        col.key ? 'cursor-pointer hover:text-amber select-none' : ''
                      )}
                      onClick={col.key ? () => handleSort(col.key!) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && <SortIcon col={col.key} current={sortKey} dir={sortDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((uni, i) => (
                  <tr
                    key={uni.id}
                    className={cn(
                      'border-b border-s4 last:border-0 hover:bg-s2 transition-colors',
                      i % 2 === 0 ? 'bg-s1' : 'bg-s2/30'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span className={cn('font-data text-xs border px-1.5 py-0.5 rounded-sm', rankBadgeColor(uni.qsRank2025))}>
                        #{uni.qsRank2025}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-ui text-xs text-text font-medium max-w-[200px]">{uni.name}</td>
                    <td className="px-3 py-2.5 font-data text-xs text-dim">{uni.city}</td>
                    <td className="px-3 py-2.5">
                      {uni.isRussellGroup
                        ? <span className="font-data text-xs text-purple-400">RG</span>
                        : <span className="font-data text-xs text-dim">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 font-data text-xs text-text">{uni.internationalPct}%</td>
                    <td className="px-3 py-2.5 font-data text-xs text-text">{fmtFee(uni.ugFeeMin)}–{fmtFee(uni.ugFeeMax)}</td>
                    <td className="px-3 py-2.5 font-data text-xs text-text">{fmtFee(uni.pgFeeMin)}–{fmtFee(uni.pgFeeMax)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('font-data text-xs font-bold', uni.employmentRate >= 88 ? 'text-green' : uni.employmentRate >= 83 ? 'text-amber' : 'text-text')}>
                        {uni.employmentRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={uni.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-dim hover:text-amber transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="border border-s4 bg-s1 rounded-sm py-16 text-center">
            <GraduationCap className="w-8 h-8 text-dim mx-auto mb-3" />
            <div className="font-data text-xs text-dim">No universities match your filters.</div>
            <button
              onClick={() => { setSearch(''); setCityFilter(''); setRussellFilter('all'); setRankRange('all'); setFeeRange('all'); }}
              className="mt-3 font-data text-xs text-amber hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Footer note */}
        <div className="border-t border-s4 pt-4">
          <p className="font-data text-[10px] text-dim leading-relaxed">
            Data sources: QS World University Rankings 2025, HESA Student Record 2022/23, individual university fee schedules.
            International student % and graduate employment figures are approximate. Fees shown are indicative ranges for international students;
            actual fees vary by course and year of entry. All universities listed hold a Student sponsor licence from the Home Office (verified March 2026).
            Financial requirements for Student visa correct as of March 2026 per UKVI.
          </p>
        </div>

      </div>
    </div>
  );
}
