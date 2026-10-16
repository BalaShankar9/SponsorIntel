import { BOARDS, SECTORS } from './job-sources.js';
import { currentJobs } from './current-jobs.js';

// Search results and private notifications must use exactly the same evidence
// and freshness rules. All values remain bound parameters, including keywords.
export function jobFilter(p, extraBoards, licensedBoards, now = Date.now(), alias = '') {
  const current = currentJobs(now, alias), prefix = alias ? alias + '.' : '';
  let where = current.sql;
  const values = [...current.values];
  for (const term of (p.get('q') || '').trim().slice(0,150).split(/\s+/).filter(Boolean).slice(0,5)) {
    where += ` AND (instr(lower(${prefix}title),lower(?))>0 OR instr(lower(${prefix}company),lower(?))>0 OR instr(lower(${prefix}description),lower(?))>0)`;
    values.push(term,term,term);
  }
  if (p.get('location')) {
    where += ` AND instr(lower(${prefix}location),lower(?))>0`;
    values.push(p.get('location').trim().slice(0,80));
  }
  if (['offered','conditional','not_stated','unavailable'].includes(p.get('sponsorship'))) {
    where += ` AND ${prefix}sponsorship=?`; values.push(p.get('sponsorship'));
  } else if (p.get('sponsorship') === 'mentioned') where += ` AND ${prefix}sponsorship IN ('offered','conditional')`;
  if (p.get('level') === 'early_career') where += ` AND ${prefix}level='early_career'`;
  if (p.get('salary') === 'listed') where += ` AND ${prefix}salary_excerpt<>''`;
  if (p.get('licence') === 'matched') {
    where += ` AND ${prefix}board_id IN (SELECT value FROM json_each(?))`;
    values.push(JSON.stringify([...licensedBoards]));
  }
  if (Object.hasOwn(SECTORS,p.get('sector') || '')) {
    const ids = [...BOARDS,...extraBoards].filter(b=>b.sector===p.get('sector')).map(b=>b.id);
    where += ` AND ${prefix}board_id IN (SELECT value FROM json_each(?))`;
    values.push(JSON.stringify(ids));
  }
  return {sql:where,values};
}
