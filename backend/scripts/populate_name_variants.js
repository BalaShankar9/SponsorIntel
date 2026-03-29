/**
 * Populate name_variants in company_profiles for all sponsors.
 *
 * Extracts trading names from sponsor register format (T/A, TRADING AS patterns),
 * generates normalized variants, and stores them for job matching.
 *
 * Usage: node scripts/populate_name_variants.js [--limit 5000]
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sbjbqjuzjjjpdilmpzkb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamJxanV6ampqcGRpbG1wemtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDQ5MCwiZXhwIjoyMDg5NzYwNDkwfQ.A6rN5bAEoSJAoYOM3Du7IYhZAxGnzFeawd0asJljUwM';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 999999;

function normalize(name) {
  let n = name.toUpperCase().trim();
  // Split on trading-as
  n = n.split(/\s+T\/A\s+|\s+TRADING AS\s+|\.T\/A[- ]/i)[0];
  // Remove trailing company numbers
  n = n.replace(/-\d{6,}$/, '');
  // Remove legal suffixes
  for (const suffix of [' LIMITED', ' LTD', ' LTD.', ' PLC', ' LLP', ' LP', ' INC',
    ' CORPORATION', ' CORP', ' CO.', ' CO', ' CIC', ' C.I.C', ' C.I.C.',
    ' UK', ' (UK)', ' GROUP', ' HOLDINGS', ' INTERNATIONAL']) {
    n = n.replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'), '');
  }
  // Remove punctuation except spaces
  n = n.replace(/[^A-Z0-9 ]/g, '');
  // Collapse whitespace
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

function extractTradingNames(rawName) {
  const names = [];

  // Check T/A pattern (can have multiple: "COMPANY T/A NAME1 T/A NAME2")
  const taMatches = rawName.matchAll(/(?:T\/A|TRADING AS)\s+([^,]+?)(?=\s+T\/A\s+|\s+TRADING AS\s+|$)/gi);
  for (const m of taMatches) {
    const name = m[1].trim().replace(/\s*(?:LIMITED|LTD\.?|PLC|LLP)\s*$/i, '').trim();
    if (name && name.length > 1) names.push(name);
  }

  // Check parenthetical patterns: (TRADING AS X), (T/A X), (DBA X)
  const parenMatches = rawName.matchAll(/\((?:TRADING AS|T\/A|DBA)\s+([^)]+)\)/gi);
  for (const m of parenMatches) {
    const name = m[1].trim();
    if (name && name.length > 1 && !names.includes(name)) names.push(name);
  }

  // Check "- T/A" pattern at the start
  const dashMatch = rawName.match(/\.T\/A[- ](.+?)(?:\s+LIMITED|\s+LTD\.?|\s+PLC|\s+LLP|$)/i);
  if (dashMatch) {
    const name = dashMatch[1].trim();
    if (name && name.length > 1 && !names.includes(name)) names.push(name);
  }

  return names.length > 0 ? names : [];
}

function extractTradingName(rawName) {
  const names = extractTradingNames(rawName);
  return names.length > 0 ? names[0] : null;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    let d = u.hostname.toLowerCase();
    if (d.startsWith('www.')) d = d.slice(4);
    return d || null;
  } catch {
    return null;
  }
}

function generateVariants(orgName) {
  const variants = new Set();
  const normalized = normalize(orgName);
  if (normalized) variants.add(normalized);

  // Extract trading name
  const trading = extractTradingName(orgName);
  if (trading) {
    variants.add(trading.toUpperCase().trim());
    variants.add(normalize(trading));
  }

  // Generate common abbreviation variants
  // e.g., "INTERNATIONAL" -> "INTL", "MANAGEMENT" -> "MGMT"
  const abbrevMap = {
    'INTERNATIONAL': 'INTL',
    'MANAGEMENT': 'MGMT',
    'SERVICES': 'SVCS',
    'SOLUTIONS': 'SOLNS',
    'TECHNOLOGY': 'TECH',
    'TECHNOLOGIES': 'TECH',
    'ENGINEERING': 'ENG',
    'CONSULTING': 'CONSULT',
    'DEVELOPMENT': 'DEV',
    'EDUCATION': 'EDU',
    'HEALTHCARE': 'HEALTH',
    'CONSTRUCTION': 'CONST',
    'RECRUITMENT': 'RECRUIT',
  };

  for (const [full, abbrev] of Object.entries(abbrevMap)) {
    if (normalized.includes(full)) {
      variants.add(normalized.replace(full, abbrev));
    }
  }

  // Add the raw name cleaned up (just strip LTD etc but keep case structure)
  const cleaned = orgName.replace(/\s+(LIMITED|LTD\.?|PLC|LLP|LP|INC|CORPORATION|CORP)\s*$/i, '').trim();
  if (cleaned !== orgName && cleaned.length > 2) {
    variants.add(cleaned.toUpperCase());
  }

  // Remove the original normalized form if it's the only one — not useful
  return Array.from(variants).filter(v => v.length > 1);
}

async function run() {
  console.log('Starting name variant population...');
  console.log(`Limit: ${LIMIT}`);

  let processed = 0;
  let updated = 0;
  let withTrading = 0;
  let errors = 0;
  const startTime = Date.now();

  let page = 0;
  const batchSize = 500;

  while (processed < LIMIT) {
    // Fetch sponsors with their profiles (only those without name_variants)
    const { data: sponsors, error } = await sb
      .from('sponsors')
      .select('id, organisation_name, company_profiles!inner(id, website_url)')
      .is('company_profiles.name_variants', null)
      .range(page * batchSize, (page + 1) * batchSize - 1);

    if (error) {
      // Fallback: fetch without inner join filter
      console.log('Join query failed, using fallback...');
      const { data: fallbackSponsors, error: fbErr } = await sb
        .from('sponsors')
        .select('id, organisation_name')
        .range(page * batchSize, (page + 1) * batchSize - 1);

      if (fbErr || !fallbackSponsors || fallbackSponsors.length === 0) break;

      for (const sponsor of fallbackSponsors) {
        if (processed >= LIMIT) break;

        const orgName = sponsor.organisation_name;
        const variants = generateVariants(orgName);
        const tradingName = extractTradingName(orgName);

        if (variants.length === 0) {
          processed++;
          continue;
        }

        // Get profile for this sponsor
        const { data: profile } = await sb
          .from('company_profiles')
          .select('id, website_url, name_variants')
          .eq('sponsor_id', sponsor.id)
          .limit(1)
          .single();

        if (!profile) {
          processed++;
          continue;
        }

        // Skip if already populated
        if (profile.name_variants && Array.isArray(profile.name_variants) && profile.name_variants.length > 0) {
          processed++;
          continue;
        }

        const domain = extractDomain(profile.website_url);
        const allTradingNames = extractTradingNames(orgName);

        // Build the name_variants object
        const nameVariantsObj = {
          normalized: normalize(orgName),
          trading_name: tradingName,
          trading_names: allTradingNames.length > 0 ? allTradingNames : null,
          domain: domain,
          search_names: variants,
        };

        try {
          const { error: updateErr } = await sb
            .from('company_profiles')
            .update({ name_variants: nameVariantsObj })
            .eq('id', profile.id);

          if (updateErr) {
            errors++;
            if (errors <= 3) console.log(`Update error for ${orgName}: ${updateErr.message}`);
          } else {
            updated++;
            if (tradingName) withTrading++;
          }
        } catch (e) {
          errors++;
        }

        processed++;
      }

      page++;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      if (page % 5 === 0) {
        console.log(`Progress: ${processed} processed, ${updated} updated, ${withTrading} with trading name, ${errors} errors (${rate.toFixed(1)}/sec)`);
      }
      continue;
    }

    if (!sponsors || sponsors.length === 0) break;

    for (const sponsor of sponsors) {
      if (processed >= LIMIT) break;

      const orgName = sponsor.organisation_name;
      const variants = generateVariants(orgName);
      const tradingName = extractTradingName(orgName);
      const profile = Array.isArray(sponsor.company_profiles)
        ? sponsor.company_profiles[0]
        : sponsor.company_profiles;

      if (!profile || variants.length === 0) {
        processed++;
        continue;
      }

      const domain = extractDomain(profile.website_url);

      const nameVariantsObj = {
        normalized: normalize(orgName),
        trading_name: tradingName,
        domain: domain,
        search_names: variants,
      };

      try {
        const { error: updateErr } = await sb
          .from('company_profiles')
          .update({ name_variants: nameVariantsObj })
          .eq('id', profile.id);

        if (updateErr) {
          errors++;
          if (errors <= 3) console.log(`Update error: ${updateErr.message}`);
        } else {
          updated++;
          if (tradingName) withTrading++;
        }
      } catch (e) {
        errors++;
      }

      processed++;
    }

    page++;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    console.log(`Progress: ${processed} processed, ${updated} updated, ${withTrading} with trading name, ${errors} errors (${rate.toFixed(1)}/sec)`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n=== COMPLETE ===');
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`With trading name: ${withTrading}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${elapsed.toFixed(1)}s`);
}

run().catch(console.error);
