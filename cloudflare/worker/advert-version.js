import {sourceAdvert} from '../shared/advert-version.js';
import {digest} from './auth.js';

export async function advertSnapshot(job) {
  const advert = sourceAdvert(job);
  return {...advert, version:await digest(JSON.stringify(advert)), checkedAt:job.last_seen || ''};
}
