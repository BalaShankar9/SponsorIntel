import {contactFromText} from '../worker/career-quality.js';
import {completeCVText,CV_FILE_LIMIT,CV_TEXT_LIMIT,readJSONResume,importProfileDetails} from '../shared/cv-import.js';
export type CVImportResult = {text:string;profile?:Record<string,string>;warnings:string[];pages?:number};

export async function importCV(file:File):Promise<CVImportResult> {
  if (!file.size) throw Error('Choose a file containing your CV.');
  if (file.size > CV_FILE_LIMIT) throw Error('Choose a CV smaller than 5 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  let text = '',pages:number|undefined;
  const warnings:string[] = [];
  if (ext === 'json') {
    const result = readJSONResume(await file.text());
    const checked = importProfileDetails(result.profile);
    return {...result,profile:checked.details,warnings:[...result.warnings,...checked.warnings]};
  }
  if (ext === 'pdf') {
    const pdf = await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).href;
    const task = pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),stopAtErrors:true});
    try {
      const doc = await task.promise;
      pages = doc.numPages;
      if (pages > 15) throw Error('Please upload a CV of 15 pages or fewer.');
      const empty:number[] = [];
      for (let i=1;i<=pages;i++) {
        const page = await doc.getPage(i);
        try {
          const content = await page.getTextContent();
          const part = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
          if (!part.trim()) empty.push(i);
          text += part + '\n\n';
          if (text.trim().length > CV_TEXT_LIMIT) completeCVText(text);
        } finally { page.cleanup(); }
      }
      if (empty.length) warnings.push('No selectable text was found on PDF page'+(empty.length>1?'s ':' ')+empty.join(', ')+'. If these pages contain CV text, discard this preview and paste the complete CV instead.');
      warnings.push('PDF columns can read in a different order. Images and scanned text are not extracted; compare the preview with your file.');
    } catch (error) {
      if ((error as Error).name === 'PasswordException') throw Error('This PDF is password protected. Export an unlocked copy or paste your CV text.');
      throw error;
    } finally { await task.destroy(); }
  } else if (ext === 'docx') {
    const {extractRawText} = await import('mammoth');
    const result = await extractRawText({arrayBuffer:await file.arrayBuffer()});
    text = result.value;
    warnings.push('Word formatting and images are not imported. Check tables, text boxes and the end of the document in this preview.');
    if (result.messages.length) warnings.push('The Word reader reported '+result.messages.length+' document feature warning'+(result.messages.length>1?'s':'')+'. Compare the preview with your original, or paste any missing text.');
  } else if (ext === 'txt') text = await file.text();
  else throw Error('Choose a PDF, DOCX, TXT or JSON Resume file.');
  text = completeCVText(text);
  const checked = importProfileDetails(contactFromText(text));
  return {text,profile:checked.details,warnings:[...warnings,...checked.warnings],pages};
}
