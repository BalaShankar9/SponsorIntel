const toggle=document.getElementById('toggle'),message=document.getElementById('message');
async function currentTab(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return tab;}
async function isEnabled(tab){const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>Boolean(window.__sponsorIntelJobNotes_v020)});return Boolean(r[0]?.result);}
toggle.disabled=true;
try{const tab=await currentTab();if(tab?.id&&/^https?:\/\//.test(tab.url||'')){toggle.textContent=await isEnabled(tab)?'Turn off for this tab':'Turn on for this tab';}}catch{}finally{toggle.disabled=false;}
toggle.addEventListener('click',async()=>{
  toggle.disabled=true;
  try{
    const tab=await currentTab();
    if(!tab?.id||!/^https?:\/\//.test(tab.url||''))throw Error('Open an ordinary job webpage first. Browser and store pages cannot be enabled.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['companion.js']});
    const on=await isEnabled(tab);toggle.textContent=on?'Turn off for this tab':'Turn on for this tab';message.textContent=on?'Enabled. Close this popup and look for Sponsorship notes or the Job notes tab at the bottom of the page.':'Removed from this tab. Any files you downloaded remain on your device.';
  }catch(error){message.textContent=error.message.startsWith('Open ')?error.message:'This page could not be enabled. Open a normal job page and try again. No permission has been expanded.';}
  finally{toggle.disabled=false;}
});
