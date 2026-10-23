export const CV_TEXT_LIMIT = 30000;
export const CV_FILE_LIMIT = 5000000;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const value = v => typeof v === 'string' ? v.trim() : '';
const fieldLabels = Object.freeze({basics:'Profile',work:'Experience',volunteer:'Volunteering',education:'Education',certificates:'Certificates',awards:'Awards',publications:'Publications',languages:'Languages',interests:'Interests',references:'References',projects:'Projects',skills:'Skills',label:'Professional headline',studyType:'Qualification',url:'Link',image:'Image link'});
const fieldLabel = key => Object.hasOwn(fieldLabels,key) ? fieldLabels[key] : key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');

export function completeCVText(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (clean.length > CV_TEXT_LIMIT) throw Error('This CV contains more than 30,000 characters. Shorten it and import again; nothing has been replaced.');
  if (clean.length < 50) throw Error('There is not enough selectable text in this file. Paste your CV text instead; nothing has been replaced.');
  if (clean.includes('\u0000') || clean.includes('\uFFFD')) throw Error('Some text could not be read reliably. Save a fresh DOCX or UTF-8 text copy, or paste the text; nothing has been replaced.');
  return clean;
}

// Preserve all text-bearing resume fields, including extensions. Only document
// metadata is excluded. No dates, employment facts or qualifications are inferred.
export function readJSONResume(raw) {
  let resume;
  try { resume = JSON.parse(raw); } catch { throw Error('This JSON file could not be read. Choose a valid JSON Resume file.'); }
  if (!object(resume) || !object(resume.basics)) throw Error('Choose a JSON Resume file with a basics section.');
  let nodes = 0, length = 0, hasSourceText = false;
  const lines = [];
  const add = line => { length += line.length + 1; if (length > CV_TEXT_LIMIT + 1) throw Error('This CV contains more than 30,000 characters. Shorten it and import again; nothing has been replaced.'); lines.push(line); };
  function walk(v, label, depth) {
    if (++nodes > 2000 || depth > 12) throw Error('This JSON Resume is too complex to preview safely. Export a simpler copy or paste your CV text.');
    if (v == null || v === '') return;
    if (typeof v !== 'object') {
      const text = String(v).trim();
      if (text) { hasSourceText = true; add(label + ': ' + text); }
    } else if (Array.isArray(v)) {
      v.forEach((entry,i) => walk(entry, label + ' ' + (i + 1), depth + 1));
    } else {
      for (const [key,entry] of Object.entries(v)) walk(entry, label ? label + ' · ' + fieldLabel(key) : fieldLabel(key), depth + 1);
    }
  }
  for (const [key,entry] of Object.entries(resume)) if (!['$schema','meta'].includes(key)) walk(entry,fieldLabel(key),0);
  if (!hasSourceText) throw Error('This JSON Resume has no CV text to import.');
  const basics = resume.basics;
  const skills = (Array.isArray(resume.skills) ? resume.skills : []).filter(object).map(s => [value(s.name), ...(Array.isArray(s.keywords) ? s.keywords.map(value) : [])].filter(Boolean).join(', ')).filter(Boolean).join('\n');
  return {text:completeCVText(lines.join('\n')),profile:{name:value(basics.name),email:value(basics.email),phone:value(basics.phone),city:value(basics.location?.city),headline:value(basics.label),skills},warnings:['JSON field labels are retained so you can check every section. Document metadata ($schema and meta) is not included.']};
}

export function importProfileDetails(profile = {}) {
  const limits = {name:100,email:200,phone:80,city:120,headline:160,skills:2000};
  const details = {}, warnings = [];
  for (const [key,limit] of Object.entries(limits)) {
    const text = value(profile[key]);
    if (!text) continue;
    if (text.length > limit) warnings.push('The detected '+key+' is too long for its profile field. Its source text remains in the CV preview; update that field yourself.');
    else details[key] = text;
  }
  return {details,warnings};
}

export function profileSignature(profile) { return JSON.stringify(profile); }
export function applyCVPreview(data, baseline, parsed, useDetails) {
  if (profileSignature(data.profile) !== baseline) return data;
  return {...data, profile:{...data.profile, ...(useDetails ? importProfileDetails(parsed.profile).details : {}),cv:parsed.text}};
}
