// Only explicit source deadlines are accepted. A publication/edit date or an
// inferred advert lifetime is not a closing date.
export function parseJobDeadline(value) {
  if (value == null || value === '') return { application_deadline: null, closes_at: null };
  if (typeof value !== 'string') throw Error('Invalid vacancy deadline');
  const match = value.match(/^(20\d{2})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/);
  if (!match || match[0] !== value) throw Error('Invalid vacancy deadline');
  const [, y, m, d, h, min, sec, fraction, zone] = match;
  const midnight = Date.UTC(+y, +m - 1, +d);
  if (new Date(midnight).toISOString().slice(0, 10) !== value.slice(0, 10))
    throw Error('Invalid vacancy deadline');
  if (h !== undefined) {
    if (+h > 23 || +min > 59 || +(sec || 0) > 59 || zone === '-00:00' ||
        (zone !== 'Z' && (+zone.slice(1, 3) > 14 || +zone.slice(4) > 59 ||
          (+zone.slice(1, 3) === 14 && +zone.slice(4) !== 0))))
      throw Error('Invalid vacancy deadline');
    const time = Date.parse(`${value.slice(0, 10)}T${h}:${min}:${sec || '00'}${fraction || ''}${zone}`);
    if (!Number.isFinite(time)) throw Error('Invalid vacancy deadline');
    return { application_deadline: value, closes_at: new Date(time).toISOString() };
  }
  // Date-only source: hide at the start of the following UK calendar day.
  // Solve London midnight using timezone data, including both DST changes.
  const target = midnight + 86400000;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let time = target;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(format.formatToParts(time).map(p => [p.type, p.value]));
    time += target - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  }
  return { application_deadline: value, closes_at: new Date(time).toISOString() };
}

export function universityClosingDate(description) {
  const lines = [...description.matchAll(/Closing Date:[^\r\n]*/g)];
  // A new time or qualifier must be reviewed, never silently discarded.
  const date = lines.length === 1 && lines[0][0].trim().match(/^Closing Date:\s*(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (20\d{2})$/);
  if (!date) throw Error('University vacancy has no single recognised closing date');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  try {
    return parseJobDeadline(`${date[3]}-${String(months.indexOf(date[2]) + 1).padStart(2, '0')}-${date[1].padStart(2, '0')}`);
  } catch { throw Error('Invalid university closing date'); }
}
