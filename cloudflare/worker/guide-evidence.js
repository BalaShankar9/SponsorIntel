// Read the same prerendered article the public route serves, from this deployed
// Worker's asset binding. Fetching our own routed hostname can fail in Workers.
// No cookies, arbitrary destinations or provider credentials are forwarded.
export function publishedGuideFetcher(env){
 return async(url,options={})=>{
  const source=new URL(url);
  if(source.origin!=='https://sponsorintel.london'||source.username||source.password||source.search||source.hash||!/^\/guides\/[a-z0-9-]+$/.test(source.pathname))throw Error('Unapproved guide source.');
  if(!env.ASSETS)throw Error('Published guide assets unavailable.');
  source.pathname+='/index.html';
  return env.ASSETS.fetch(new Request(source.href,{method:'GET',redirect:'manual',signal:options.signal}));
 };
}
