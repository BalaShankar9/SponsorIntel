#!/usr/bin/env python3
"""Prepare a validated, versioned official register import. Existing snapshots remain intact."""
import argparse,csv,hashlib,json,pathlib,re,urllib.request,datetime,collections
p=argparse.ArgumentParser();p.add_argument('--csv');p.add_argument('--source-url');a=p.parse_args()
publication='https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'
if a.csv:
 source=a.source_url
 raw=pathlib.Path(a.csv).read_bytes()
else:
 html=urllib.request.urlopen(publication,timeout=30).read().decode()
 source=re.search(r'href="(https://assets.publishing.service.gov.uk/[^\"]+\.csv)"',html).group(1)
 raw=urllib.request.urlopen(source,timeout=60).read()
if len(raw)>25000000:raise ValueError('Oversized source')
date=re.search(r'20\d{2}-\d{2}-\d{2}',source).group();sha=hashlib.sha256(raw).hexdigest();snapshot=date+'-'+sha[:8]
clean=lambda s:re.sub(r'\s+',' ',s.strip())
data={};rows=0
for r in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
 name,city,county,rating,route=[clean(r[k]) for k in ['Organisation Name','Town/City','County','Type & Rating','Route']]
 if not name or not rating or not route:raise ValueError('Incomplete row')
 key='|'.join(x.lower() for x in [name,city,county]);ident=hashlib.sha256(key.encode()).hexdigest()[:24]
 if ident not in data:data[ident]={'name':name,'city':city,'county':county,'ratings':set(),'routes':set()}
 data[ident]['ratings'].add(rating);data[ident]['routes'].add(route);rows+=1
if not 100000<len(data)<300000:raise ValueError('Record count requires review')
now=datetime.datetime.now(datetime.timezone.utc).isoformat();routes=collections.Counter(t for r in data.values() for t in r['routes'])
meta={'snapshot':snapshot,'source_date':date,'source_url':source,'publication_url':publication,'checked_at':now,'imported_at':now,'employers':len(data),'source_rows':rows,'skilled_worker':sum('Skilled Worker' in r['routes'] for r in data.values()),'cities':len({r['city'].lower() for r in data.values() if r['city']}),'routes':[{'name':k,'count':v}for k,v in routes.most_common()],'sha256':sha,'refresh_error':None}
q=lambda s:"'"+str(s).replace("'","''")+"'"
out=pathlib.Path('data');out.mkdir(exist_ok=True)
with (out/'register.sql').open('w') as f:
 for ident,r in data.items():
  fields=[ident,snapshot,r['name'],r['city'],r['county'],json.dumps(sorted(r['ratings'])),json.dumps(sorted(r['routes'])),'1' if 'Skilled Worker' in r['routes'] else '0']
  f.write('INSERT OR REPLACE INTO sponsors(id,snapshot,name,city,county,ratings,routes,skilled) VALUES('+','.join(map(q,fields))+');\n')
# Activate only after verification against the staged snapshot count.
(out/'activate.sql').write_text("INSERT INTO metadata(key,value) SELECT 'register',"+q(json.dumps(meta))+" WHERE (SELECT COUNT(*) FROM sponsors WHERE snapshot="+q(snapshot)+")="+str(len(data))+" ON CONFLICT(key) DO UPDATE SET value=excluded.value;\n")
(out/'source.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2))
