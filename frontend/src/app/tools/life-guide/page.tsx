'use client';

import { useState } from 'react';
import Link from 'next/link';

interface GuideCategory {
  name: string;
  icon: string;
  color: string;
  sections: { title: string; content: string; links?: { text: string; url: string }[] }[];
}

const CATEGORIES: GuideCategory[] = [
  {
    name: 'Banking & Finance',
    icon: '🏦',
    color: 'text-amber',
    sections: [
      {
        title: 'Opening a UK Bank Account',
        content: 'You need a bank account within your first week. Most banks require proof of address, but some accept your visa and employer letter. Start with Monzo or Starling — they require NO proof of address, just your passport and BRP.',
        links: [
          { text: 'Monzo — open in 10 mins', url: 'https://monzo.com' },
          { text: 'Starling Bank', url: 'https://starlingbank.com' },
          { text: 'Revolut (good for transfers home)', url: 'https://revolut.com' },
          { text: 'Wise (cheapest international transfers)', url: 'https://wise.com' },
        ],
      },
      {
        title: 'Building Credit History',
        content: 'Your home country credit score does NOT transfer. Start building UK credit immediately: get a credit builder card (Aqua, Capital One), register on the electoral roll (if eligible), and always pay bills on time. After 6 months you can get better cards and loans.',
        links: [
          { text: 'ClearScore — free credit check', url: 'https://clearscore.com' },
          { text: 'Experian — credit report', url: 'https://experian.co.uk' },
        ],
      },
      {
        title: 'Tax & National Insurance',
        content: 'You need a National Insurance (NI) number to work. Apply online within 2 weeks of starting work — you CAN start working before you get it. Your employer will deduct PAYE tax automatically. Register for self-assessment only if you have additional income.',
        links: [
          { text: 'Apply for NI number', url: 'https://www.gov.uk/apply-national-insurance-number' },
          { text: 'HMRC tax calculator', url: 'https://www.tax.service.gov.uk/estimate-paye-take-home-pay' },
        ],
      },
    ],
  },
  {
    name: 'Housing',
    icon: '🏠',
    color: 'text-cyan',
    sections: [
      {
        title: 'Finding Your First Home',
        content: 'Expect to pay 1 month rent + 5 weeks deposit (capped by law). Rightmove and Zoopla are the main platforms. SpareRoom is best for house shares. Avoid agents that charge "referencing fees" upfront — this is a red flag. Most landlords accept BRP as ID.',
        links: [
          { text: 'Rightmove', url: 'https://rightmove.co.uk' },
          { text: 'Zoopla', url: 'https://zoopla.co.uk' },
          { text: 'SpareRoom (house shares)', url: 'https://spareroom.co.uk' },
          { text: 'OpenRent (no agent fees)', url: 'https://openrent.com' },
        ],
      },
      {
        title: 'Council Tax',
        content: 'You MUST register for council tax at your local council within 2 weeks of moving in. Full-time students are exempt. Single occupants get 25% discount. Band A-H based on property value. Budget £100-250/month.',
      },
      {
        title: 'Utilities & Bills',
        content: 'Compare energy suppliers on Uswitch. Get broadband sorted within the first week — average £25-35/month. Water is usually not metered (flat rate). TV Licence is £169.50/year if you watch live TV or BBC iPlayer.',
        links: [
          { text: 'Uswitch — compare bills', url: 'https://uswitch.com' },
        ],
      },
    ],
  },
  {
    name: 'Transport',
    icon: '🚗',
    color: 'text-green',
    sections: [
      {
        title: 'Driving in the UK',
        content: 'You can drive on your home country licence for 12 months. After that you MUST get a UK licence. Some countries have exchange agreements (no test needed) — check GOV.UK. Car insurance is expensive for new UK residents — expect £1,500-3,000/year initially.',
        links: [
          { text: 'Check licence exchange', url: 'https://www.gov.uk/exchange-foreign-driving-licence' },
          { text: 'Compare car insurance', url: 'https://comparethemarket.com/car-insurance' },
          { text: 'AutoTrader — buy cars', url: 'https://autotrader.co.uk' },
        ],
      },
      {
        title: 'Public Transport',
        content: 'Get an Oyster card or use contactless in London. Outside London, get a railcard (£30/year for 1/3 off trains). National Express coaches are cheapest for long distance. Uber and Bolt work everywhere.',
        links: [
          { text: 'Trainline — cheapest tickets', url: 'https://thetrainline.com' },
          { text: 'Railcard — 1/3 off trains', url: 'https://railcard.co.uk' },
          { text: 'TfL — London transport', url: 'https://tfl.gov.uk' },
        ],
      },
      {
        title: 'Buying a Car',
        content: 'Budget cars start from £3,000-5,000. MOT history check is FREE on GOV.UK. Always do an HPI check (£20) before buying. Facebook Marketplace and Gumtree have private sales. Dealer finance is available but interest rates are high for newcomers.',
        links: [
          { text: 'Free MOT history check', url: 'https://www.gov.uk/check-mot-history' },
          { text: 'HPI check', url: 'https://hpicheck.com' },
        ],
      },
    ],
  },
  {
    name: 'Healthcare (NHS)',
    icon: '🏥',
    color: 'text-red',
    sections: [
      {
        title: 'Registering with a GP',
        content: 'Register with a GP (family doctor) in your first week. It is FREE. Find your nearest GP on NHS.uk. You do NOT need proof of address or immigration status to register — GPs cannot refuse you. Bring your passport and BRP.',
        links: [
          { text: 'Find a GP near you', url: 'https://www.nhs.uk/service-search/find-a-gp' },
        ],
      },
      {
        title: 'Emergency Services',
        content: '999 for life-threatening emergencies. 111 for non-emergency medical advice (24/7). A&E (Accident & Emergency) for serious injuries. Walk-in centres for minor injuries without appointment. Pharmacies can treat many common illnesses.',
      },
      {
        title: 'Dental & Optical',
        content: 'NHS dentists are hard to find — many areas have waiting lists. Private dentists cost £50-100 for a checkup. Eye tests are FREE at most opticians (Specsavers, Vision Express). NHS prescriptions cost £9.90 per item.',
        links: [
          { text: 'Find NHS dentist', url: 'https://www.nhs.uk/service-search/find-a-dentist' },
        ],
      },
    ],
  },
  {
    name: 'Part-Time Work',
    icon: '⏰',
    color: 'text-purple',
    sections: [
      {
        title: 'Visa Restrictions',
        content: 'Skilled Worker visa: you can do a SECOND job in the same SOC code for up to 20 hours/week. Student visa: 20 hours/week during term, full-time during holidays. Graduate visa: NO restrictions on hours or job type. Always check your visa conditions on your BRP.',
      },
      {
        title: 'Best Part-Time Platforms',
        content: 'Deliveroo, Uber Eats (if you have right to work). Indeed and Reed for part-time roles. Tutoring: Tutorful, MyTutor (£15-40/hour). Freelancing: Fiverr, Upwork, PeoplePerHour. Care work: Care.com, Cera.',
        links: [
          { text: 'Indeed — part-time jobs', url: 'https://indeed.co.uk/Part-Time-jobs' },
          { text: 'Tutorful — tutoring', url: 'https://tutorful.co.uk' },
          { text: 'PeoplePerHour — freelance', url: 'https://peopleperhour.com' },
        ],
      },
    ],
  },
  {
    name: 'Legal & Immigration',
    icon: '⚖️',
    color: 'text-amber',
    sections: [
      {
        title: 'Finding an Immigration Lawyer',
        content: 'Only use OISC-registered advisers or solicitors regulated by the SRA. Check the OISC register before paying anyone. Free advice available from Citizens Advice and OISC Level 1 advisers. Never pay anyone who contacts YOU offering visa help.',
        links: [
          { text: 'OISC register — verify adviser', url: 'https://home.oisc.gov.uk/adviser_finder/finder.aspx' },
          { text: 'SRA — check solicitor', url: 'https://www.sra.org.uk/consumers/register/' },
          { text: 'Citizens Advice — free help', url: 'https://www.citizensadvice.org.uk/immigration/' },
          { text: 'SponsorIntel Lawyer Finder', url: '/intel/lawyers' },
        ],
      },
      {
        title: 'Key Documents to Keep',
        content: 'BRP (Biometric Residence Permit) — carry it when travelling. Passport — keep original safe, carry a copy. Visa decision letter — keep the email/letter forever. Share code — prove your right to work at gov.uk/prove-right-to-work. Employment contract — keep every version.',
        links: [
          { text: 'Generate share code', url: 'https://www.gov.uk/prove-right-to-work' },
        ],
      },
      {
        title: 'Post Offices & Government Services',
        content: 'Post Office does passport verification, BRP collection, and financial services. Register at your local Post Office for BRP collection. Council offices handle council tax, electoral roll, and local services.',
        links: [
          { text: 'Find Post Office', url: 'https://www.postoffice.co.uk/branch-finder' },
          { text: 'Find your local council', url: 'https://www.gov.uk/find-local-council' },
        ],
      },
    ],
  },
  {
    name: 'Food & Groceries',
    icon: '🛒',
    color: 'text-green',
    sections: [
      {
        title: 'Budget Supermarkets',
        content: 'Aldi and Lidl are the cheapest (30-40% less than Tesco). Asda is next best value. Tesco Clubcard gives good discounts. For Asian/Indian groceries: look for local ethnic shops — much cheaper than supermarkets. TooGoodToGo app sells surplus food for £3-4.',
        links: [
          { text: 'TooGoodToGo — discount food', url: 'https://toogoodtogo.com/en-gb' },
          { text: 'OLIO — free surplus food', url: 'https://olioapp.com' },
        ],
      },
      {
        title: 'Eating Out Affordably',
        content: 'Meal deals at supermarkets (£3-4 for sandwich + drink + snack). Wetherspoons pubs serve cheap meals (£5-8). Use the Too Good To Go app for restaurant surplus. Student discount cards (even if not a student) at some chains.',
      },
    ],
  },
  {
    name: 'Insurance',
    icon: '🛡️',
    color: 'text-cyan',
    sections: [
      {
        title: 'Essential Insurance',
        content: 'Car insurance is MANDATORY if you drive. Contents insurance protects your belongings (£5-15/month). Travel insurance for trips home. Life insurance if you have dependants. Pet insurance if applicable.',
        links: [
          { text: 'CompareTheMarket', url: 'https://comparethemarket.com' },
          { text: 'MoneySupermarket', url: 'https://moneysupermarket.com' },
          { text: 'GoCompare', url: 'https://gocompare.com' },
        ],
      },
    ],
  },
];

export default function LifeGuidePage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].name);
  const category = CATEGORIES.find(c => c.name === activeCategory) || CATEGORIES[0];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">UK Life Guide for Immigrants</h1>
        <p className="text-xs text-dim mt-1">Everything you need to know about living in the UK — banking, housing, transport, healthcare, work, legal, food, insurance. Practical advice from real experience.</p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name)}
            className={`px-3 py-2 rounded text-xs transition-all ${
              activeCategory === cat.name
                ? 'bg-amber text-bg font-semibold'
                : 'border border-border hover:border-amber/30'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Category Content */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{category.icon}</span>
          <h2 className={`text-base font-semibold ${category.color}`}>{category.name}</h2>
        </div>

        {category.sections.map((section, i) => (
          <div key={i} className="border border-border bg-s1 rounded p-5">
            <h3 className="text-sm font-semibold mb-2">{section.title}</h3>
            <p className="text-xs text-dim leading-relaxed mb-3">{section.content}</p>
            {section.links && (
              <div className="flex flex-wrap gap-2">
                {section.links.map((link, j) => (
                  <a
                    key={j}
                    href={link.url}
                    target={link.url.startsWith('/') ? undefined : '_blank'}
                    rel={link.url.startsWith('/') ? undefined : 'noopener noreferrer'}
                    className="text-[10px] font-data bg-cyan/10 text-cyan px-3 py-1 rounded hover:bg-cyan/20 transition-colors"
                  >
                    {link.text} →
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 border border-amber/30 bg-amber/5 rounded p-4 text-center">
        <div className="text-sm font-semibold mb-1">Need more help?</div>
        <p className="text-xs text-dim mb-3">Check our other tools for visa-specific guidance</p>
        <div className="flex justify-center gap-3">
          <Link href="/tools/visa-guide" className="text-xs bg-amber text-bg px-4 py-2 rounded font-semibold hover:bg-amber/90">Visa Routes Guide</Link>
          <Link href="/tools/sponsor-check" className="text-xs border border-border px-4 py-2 rounded hover:border-amber/30">Sponsor Check</Link>
          <Link href="/intel/lawyers" className="text-xs border border-border px-4 py-2 rounded hover:border-amber/30">Find a Lawyer</Link>
        </div>
      </div>
    </div>
  );
}
