import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import media from '../shared/marketing-media.json' with {type:'json'};
for(const asset of media){
 const url=new URL(asset.url);
 if(url.origin!=='https://sponsorintel.london'||!/^\/social\/[a-z0-9-]+\.png$/.test(url.pathname)||url.search||url.hash)throw Error('Unexpected marketing asset path.');
 const data=await readFile(new URL('../public'+url.pathname,import.meta.url));
 const hash=createHash('sha256').update(data).digest('hex');
 if(hash!==asset.sha256||!url.pathname.includes(hash.slice(0,16)))throw Error('Marketing image changed; use a new content-addressed asset and review.');
 if(data.length>2_000_000||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.readUInt32BE(16)!==asset.width||data.readUInt32BE(20)!==asset.height)throw Error('Unexpected marketing image size or format.');
}
console.log(`Verified ${media.length} registered marketing image(s).`);
