import React from 'react';
import {createRoot} from 'react-dom/client';
import {BusinessIdentityDesk} from '../../src/business-identity-desk';
import {BusinessIdentityCards} from '../../src/business-identities';
import '../../src/platform.css';
import '../../src/styles.css';
import '../../src/job-detail.css';
import '../../src/career.css';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:900,margin:'20px auto',fontFamily:'Arial,sans-serif'}}><h1>Fictional business review preview</h1><p>Local records only. No external services or customer data.</p><BusinessIdentityDesk/><div style={{width:390,maxWidth:'100%',boxSizing:'border-box',padding:12,border:'1px solid #999'}}><h2>390px public preview</h2><BusinessIdentityCards sponsorId={'a'.repeat(24)}/></div></main>);
