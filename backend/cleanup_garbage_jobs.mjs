/**
 * Cleanup script: removes garbage job entries from the Supabase `jobs` table
 * where source='career_page' and title_raw matches known junk patterns.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sbjbqjuzjjjpdilmpzkb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamJxanV6ampqcGRpbG1wemtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDQ5MCwiZXhwIjoyMDg5NzYwNDkwfQ.A6rN5bAEoSJAoYOM3Du7IYhZAxGnzFeawd0asJljUwM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- helpers ----------

function isGarbage(title) {
  if (!title || typeof title !== 'string') return true;

  const t = title.trim();
  if (t.length === 0) return true;

  // 1. Titles shorter than 10 characters
  if (t.length < 10) return true;

  // 2. Starts with junk prefixes
  if (/^[#.]/.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t)) return true;
  if (/^mailto:/i.test(t)) return true;

  const lower = t.toLowerCase();

  // 3. Exact / substring spam phrases
  const spamPhrases = [
    'we hire people who think big',
    'international coverage',
    'explore open positions',
    'case studies',
    'united arab emirates',
    'cookie',
    'privacy',
    'terms',
    'about us',
    'contact',
    'login',
    'sign in',
    'newsletter',
    'subscribe',
    'accept all',
    'checkout ltd',
  ];
  for (const phrase of spamPhrases) {
    if (lower.includes(phrase)) return true;
  }

  // 4. Navigation-like text
  const navPhrases = [
    'read more',
    'learn more',
    'click here',
    'view all',
    'back to',
    'skip to',
    'get in touch',
    'find us',
  ];
  for (const phrase of navPhrases) {
    if (lower.includes(phrase)) return true;
  }

  // 5. All-uppercase, < 30 chars, 2 or fewer words
  if (t === t.toUpperCase() && t.length < 30) {
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 2) return true;
  }

  return false;
}

// ---------- main ----------

async function main() {
  console.log('Fetching career_page jobs from Supabase...');

  // Supabase limits rows per request; paginate with 1000-row pages.
  const PAGE_SIZE = 1000;
  let allIds = [];
  let from = 0;
  let fetchedTotal = 0;

  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title_raw')
      .eq('source', 'career_page')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching jobs:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    fetchedTotal += data.length;
    const garbageIds = data.filter((row) => isGarbage(row.title_raw)).map((r) => r.id);
    allIds.push(...garbageIds);

    console.log(
      `  page ${Math.floor(from / PAGE_SIZE) + 1}: fetched ${data.length}, garbage ${garbageIds.length}`
    );

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  console.log(`\nTotal career_page rows scanned: ${fetchedTotal}`);
  console.log(`Garbage rows identified: ${allIds.length}`);

  if (allIds.length === 0) {
    console.log('Nothing to delete. Done.');
    return;
  }

  // Delete in batches of 200 (Supabase .in() has a practical limit)
  const BATCH = 200;
  let deletedTotal = 0;

  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from('jobs')
      .delete({ count: 'exact' })
      .in('id', batch);

    if (error) {
      console.error(`Error deleting batch starting at index ${i}:`, error.message);
    } else {
      deletedTotal += count ?? batch.length;
      console.log(`  deleted batch ${Math.floor(i / BATCH) + 1}: ${count ?? batch.length} rows`);
    }
  }

  console.log(`\nDone. Total rows deleted: ${deletedTotal}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
