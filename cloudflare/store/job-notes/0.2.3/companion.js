"use strict";
(() => {
  // extension/analyse.js
  var MAX_TEXT = 1e5;
  var labels = {
    offered: "Sponsorship offered in this wording",
    conditional: "Sponsorship may be available",
    unavailable: "Sponsorship refused in this wording",
    unclear: "Sponsorship is unclear"
  };
  var normal = (value) => value.replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
  function analyseAdvert(text, confirmed = false) {
    const result = (status, reason, evidence2 = []) => ({ status, title: labels[status], reason, evidence: evidence2 });
    if (typeof text !== "string" || text.trim().length < 40)
      return result("unclear", "Add the complete advert, including its eligibility and sponsorship sections.");
    if (text.length > MAX_TEXT)
      return result("unclear", "This text is too long. Select one complete advert; no partial verdict has been made.");
    if (!confirmed)
      return result("unclear", "First check that this is one complete job advert, rather than a results page, form or general guide.");
    const evidence = [];
    let ambiguous = false;
    let previousStatement = false;
    const retain = (kind, quote) => {
      if (!evidence.some((e) => e.quote === quote)) evidence.push({ kind, quote });
    };
    const displayedEvidence = () => {
      const selected = /* @__PURE__ */ new Set();
      for (const kind of ["offered", "conditional", "unavailable", "unclear"]) {
        const first = evidence.findIndex((e) => e.kind === kind);
        if (first >= 0) selected.add(first);
      }
      for (let i = 0; i < evidence.length && selected.size < 6; i++) selected.add(i);
      return [...selected].sort((a, b) => a - b).map((i) => evidence[i]);
    };
    const sentences = text.split(/(?<=[.!?])\s+|[\r\n]+/).map((x) => x.trim()).filter(Boolean);
    for (const original of sentences) {
      const whole = normal(original).replace(/^[-•*]\s*/, "");
      const followsStatement = previousStatement;
      previousStatement = false;
      const heading = "(?:(?:UK |Skilled Worker )?(?:visa|immigration|work permit) )?sponsorship";
      if (new RegExp("^" + heading + ":?$", "i").test(whole)) {
        previousStatement = followsStatement;
        continue;
      }
      let s = whole.replace(new RegExp("^" + heading + ":\\s*", "i"), "");
      s = s.replace(/^unfortunately(?: at this time)?,?\s+(?=(?:we|the company|the employer) (?:(?:currently )?(?:cannot|can't|do not|don't|will not|won't)|are (?:(?:currently )?unable to|not (?:currently )?able to))\b)/i, "");
      if (!/sponsor/i.test(whole)) {
        if (followsStatement && /^(?:(?:however|unfortunately|please note)[,:]?\s+)?(?:this|that|it)(?:\s+(?:offer|support|assistance|policy|statement|information|arrangement|benefit))?\s+(?:does not apply\b|is (?:no longer|not (?:available|offered|provided|applicable|valid)|out of date|outdated|withdrawn)\b|has been (?:withdrawn|discontinued)\b|applies only\b|is only (?:available|offered|provided)\b)/i.test(s)) {
          ambiguous = true;
          if (s.length <= 650) retain("unclear", original);
        }
        continue;
      }
      if (whole.length > 650 || /\?/.test(s) || /^(?:if |unless |for example|example|ask |please ask|check whether|you should|"|'|“|‘)/i.test(s)) {
        ambiguous = true;
        if (whole.length <= 650) retain("unclear", original);
        continue;
      }
      const immigration = /visa|immigration|work permit|skilled worker|right to work|authori[sz]ed to work/i.test(whole);
      if (!immigration && /qualification|course|degree|training|conference|event|charit|sport/i.test(s)) continue;
      const employer = "(?:we|the company|the employer)";
      const sponsor = "(?:(?:UK |Skilled Worker )?(?:visa|immigration|work permit) sponsorship|(?:UK )?Skilled Worker sponsorship)";
      const no = new RegExp("^(?:please note[,:]? (?:that )?)?" + employer + " (?:currently )?(?:cannot|can't|do not|don't|will not|won't|are (?:currently )?unable to|are not (?:currently )?able to) (?:currently )?(?:offer|provide|support|arrange) " + sponsor + "\\b", "i").test(s) || new RegExp("^" + sponsor + " (?:is |will be )?(?:not (?:available|provided|offered|supported|possible)|unavailable)\\b", "i").test(s) || /^(?:this|the) (?:role|position|job|vacancy) (?:is not eligible for|does not (?:offer|provide|support)) (?:UK |Skilled Worker )?(?:visa )?sponsorship\b/i.test(s) || /^we are (?:currently not offering|not (?:currently )?offering|unable to offer|not (?:currently )?in a position to offer) sponsorship(?: to new candidates)? for (?:this|these) roles?\b/i.test(s) || /^(?:applicants|candidates) must (?:be (?:legally )?authori[sz]ed to work|have (?:the )?right to work).{0,100}\bwithout (?:employer |visa )?sponsorship\b/i.test(s) || /^no (?:UK |Skilled Worker )?(?:visa|immigration|work permit) sponsorship (?:is )?(?:available|provided|offered|supported)\b/i.test(s);
      const yes = new RegExp("^" + employer + " (?:(?:will|can|may|do|are able to|are happy to) )?(?:offer|provide|support|arrange) (?:(?:a|your|the) )?" + sponsor + "\\b", "i").test(s) || new RegExp("^" + sponsor + " (?:(?:is|will be|can be|may be) )?(?:available|provided|offered|supported)\\b", "i").test(s) || /^we (?:can|will|may|are able to) sponsor (?:your |a |the )?(?:UK |Skilled Worker )?(?:visa|work permit)\b/i.test(s) || /^skilled worker visas can be sponsored[.!]?$/i.test(s) || /^(?:this|the) (?:role|position|job|vacancy) is eligible for (?:UK |Skilled Worker )?(?:visa )?sponsorship\b/i.test(s) || /^(?:applicants|candidates) (?:requiring|who require) (?:UK |Skilled Worker )?(?:visa )?sponsorship are welcome to apply\b/i.test(s);
      if (!yes && !no) {
        ambiguous = true;
        retain("unclear", original);
        continue;
      }
      previousStatement = true;
      const conflictingClause = /\b(?:but|however|although|except|unless|not only|no longer|not for|previously|historically|last year|in the past)\b/i.test(s);
      const nonUK = /\b(?:H-?1B|United States|US visa|USA|Canada|Canadian|Australia|Australian)\b/i.test(s);
      if (conflictingClause || nonUK || yes && /\b(?:not|never|cannot|can't|don't|do not|won't|will not)\b/i.test(s)) {
        retain("unclear", original);
        ambiguous = true;
        continue;
      }
      const kind = no ? "unavailable" : /\b(?:can|may|eligible|eligibility|depending|depends|subject to|consider|certain|selected|some|only|limited|exceptional|welcome|where|if)\b|case.by.case/i.test(s) ? "conditional" : "offered";
      retain(kind, original);
    }
    const positive = evidence.some((e) => ["offered", "conditional"].includes(e.kind));
    const negative = evidence.some((e) => e.kind === "unavailable");
    if (positive && negative)
      return result("unclear", "The text contains both support and refusal wording. Check the exact role and all conditions with the employer.", displayedEvidence());
    if (ambiguous && (positive || negative))
      return result("unclear", "A caveat or other sponsorship wording needs interpretation. Read the quoted context and complete advert before relying on a matched sentence.", displayedEvidence());
    if (negative) return result("unavailable", "A direct refusal was found. This describes the supplied wording, not every role at this employer.", displayedEvidence());
    if (positive) {
      const status = evidence.some((e) => e.kind === "conditional") ? "conditional" : "offered";
      return result(status, "This is wording evidence, not a confirmed offer, current opening, licence match or personal eligibility decision.", displayedEvidence());
    }
    return result("unclear", "No clear role-specific commitment or refusal matched. Silence, a right-to-work question and a sponsor licence do not establish the answer.", displayedEvidence());
  }

  // extension/capture.js
  function captureAdvert() {
    const MAX = 1e5;
    const exclude = 'script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"]';
    if (!/^https?:$/.test(location.protocol)) return { error: "This page cannot be read. Paste the advert instead." };
    if (typeof document.documentElement.checkVisibility !== "function") return { error: "This browser cannot safely check page visibility. Paste the complete public advert instead." };
    const visible2 = (e) => e.checkVisibility({ opacityProperty: true, checkOpacity: true, visibilityProperty: true, checkVisibilityCSS: true });
    const closedSections = (e) => [...e.matches("details:not([open])") ? [e] : [], ...e.querySelectorAll("details:not([open])")].filter((d) => !d.closest(exclude) && visible2(d));
    const selection = window.getSelection();
    let root, mode;
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      const ancestor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (ancestor?.closest(exclude) || [...ancestor?.querySelectorAll("form,input,textarea,select,[contenteditable]") || []].some((e) => range.intersectsNode(e)))
        return { error: "Select advert text outside application fields, or paste the public advert instead." };
      if (!ancestor || closedSections(ancestor).some((e) => range.intersectsNode(e))) return { error: "Expand the collapsed advert sections before selecting, or paste the complete public advert." };
      const selectedNodes = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
      let selectedNode, selectedSeen = 0;
      while (selectedNode = selectedNodes.nextNode()) {
        if (++selectedSeen > 12e3) return { error: "The selection is too complex to read completely. Paste one complete public advert." };
        if (!selectedNode.textContent.trim() || !range.intersectsNode(selectedNode)) continue;
        const parent = selectedNode.parentElement;
        if (!parent || parent.closest(exclude) || !visible2(parent)) return { error: "Select visible advert text outside hidden or application regions, or paste the complete public advert." };
      }
      const text2 = selection.toString().trim();
      if (text2.length > MAX) return { error: "The selection is too long. Select one complete advert." };
      return { text: text2, mode: "Selected text \u2014 check that it includes the complete advert", source: location.origin };
    }
    const selectors = ["#jobDescriptionText", ".jobs-description__content", ".jobs-description-content__text", '[data-testid="job-description"]', "#job-description", ".job-description", '[itemprop="description"]'];
    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)].filter((e) => !e.closest(exclude) && visible2(e));
      if (candidates.length > 1) return { error: "Several advert sections were found. Select one complete advert, or paste it below." };
      if (candidates.length === 1) {
        root = candidates[0];
        mode = "Detected advert section";
        break;
      }
    }
    if (!root) {
      const mains = [...document.querySelectorAll('main,[role="main"]')].filter((e) => !e.closest(exclude) && visible2(e));
      if (mains.length !== 1) return { error: "One advert section could not be isolated. Select the complete advert on the page, then try again, or paste it below." };
      root = mains[0];
      mode = "Main page text \u2014 may include other roles; review before checking";
    }
    if (closedSections(root).length) return { error: "Expand the collapsed advert sections before reading, or paste the complete public advert." };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const chunks = [];
    let length = 0, seen = 0, node;
    while (node = walker.nextNode()) {
      if (++seen > 12e3) return { error: "The page is too complex to read completely. Select or paste one complete advert." };
      const parent = node.parentElement;
      if (!parent || parent.closest(exclude) || !visible2(parent)) continue;
      const text2 = node.textContent.replace(/\s+/g, " ");
      if (!text2.trim()) continue;
      length += text2.length + 1;
      if (length > MAX) return { error: "This section is too long. Select or paste one complete advert; no partial check was made." };
      chunks.push({ text: text2, parent });
    }
    const block = (e) => {
      while (e && e !== root && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement;
      return e;
    };
    let last = null, text = "";
    for (const chunk of chunks) {
      const current = block(chunk.parent);
      text += (last && last !== current ? "\n" : " ") + chunk.text;
      last = current;
    }
    if (text.trim().length < 40) return { error: "Too little readable text. Expand the full job description, or paste the advert." };
    return { text: text.replace(/[ \t]+/g, " ").trim(), mode, source: location.origin };
  }

  // extension-companion/lever.js
  function isLeverHost(host) {
    return host === "jobs.lever.co" || host === "jobs.eu.lever.co";
  }
  function leverAdvertURL(value, allowApplication = false) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || !isLeverHost(url.hostname)) return null;
    const match = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/apply)?\/?$/i);
    if (!match || match[3] && !allowApplication) return null;
    url.pathname = `/${match[1]}/${match[2].toLowerCase()}`;
    url.hash = "";
    return url.href;
  }

  // extension-companion/identity.js
  function jobIdentity(value, base) {
    let url;
    try {
      url = new URL(value, base);
    } catch {
      return null;
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
      const id2 = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1] || url.searchParams.get("currentJobId");
      return /^\d+$/.test(id2 || "") ? { provider: "linkedin", id: id2, key: `linkedin:${id2}`, url: `https://www.linkedin.com/jobs/view/${id2}/` } : null;
    }
    if (host === "indeed.com" || host.endsWith(".indeed.com")) {
      const id2 = url.searchParams.get("jk") || url.searchParams.get("vjk");
      return /^[a-zA-Z0-9_-]{4,80}$/.test(id2 || "") ? { provider: "indeed", id: id2, key: `indeed:${id2}`, url: `${url.origin}/viewjob?jk=${encodeURIComponent(id2)}` } : null;
    }
    if (isLeverHost(host)) {
      const advert = leverAdvertURL(url.href);
      if (!advert) return null;
      url = new URL(advert);
    } else if (!/\/(jobs?|careers?|positions?|opportunities)\/.+\w/i.test(url.pathname)) return null;
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (/token|session|password|secret|signature|auth/i.test(name)) return null;
      if (/^utm_|^(source|ref|referrer|trackingId|trk|lever-source|lever-origin)$/i.test(name)) url.searchParams.delete(name);
    }
    url.searchParams.sort();
    const id = url.pathname.replace(/\/$/, "") + url.search;
    return { provider: "original", id, key: url.origin + id, url: url.href };
  }
  function sameJob(a, b) {
    return !!a && !!b && a.key === b.key;
  }
  function nextStep(status) {
    return { offered: "Read the quoted conditions and confirm they apply to this vacancy before preparing an application.", conditional: "Check the conditions in the quote. An invitation to apply is not confirmation that you personally qualify.", unavailable: "This advert explicitly refuses sponsorship. Check the original if the wording may have changed.", unclear: "Look for the complete sponsorship section. Missing wording is not a refusal." }[status];
  }

  // extension-companion/read.js
  var excluded = 'script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,.postings-btn-wrapper a,.last-section-apply a,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"],[data-si-notes]';
  var excludedForIdentity = 'script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"],[data-si-notes]';
  var descriptionSelectors = '#jobDescriptionText,.jobs-description__content,.jobs-description-content__text,[data-testid="job-description"],#job-description,.job-description,[itemprop="description"]';
  function visible(element) {
    return typeof element?.checkVisibility === "function" && !element.closest(excluded) && element.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
  }
  function nearViewport(element) {
    const r = element.getBoundingClientRect();
    return r.bottom >= -innerHeight && r.top <= innerHeight * 2;
  }
  function readDescription(root) {
    if (!root || !visible(root)) return { error: "The complete description is not visible. Open it or paste its public text." };
    if ([...root.querySelectorAll("details:not([open])")].some(visible)) return { error: "Expand the closed sections before reading this advert." };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, count = 0, length = 0, last = null, text = "";
    while (node = walker.nextNode()) {
      if (++count > 12e3) return { error: "This description is too complex to read completely. Paste one complete advert." };
      if (!visible(node.parentElement)) continue;
      const part = node.textContent.replace(/\s+/g, " ");
      if (!part.trim()) continue;
      length += part.length + 1;
      if (length > 1e5) return { error: "This description is too long. No partial check was made." };
      let block = node.parentElement;
      while (block !== root && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
      if (last && block !== last) text += "\n";
      else text += " ";
      text += part;
      last = block;
    }
    if (text.trim().length < 40) return { error: "Too little description is visible. Open the complete advert first." };
    return { text: text.replace(/[ \t]+/g, " ").trim() };
  }
  function findLeverDescription(identity, pageURL) {
    const current = jobIdentity(pageURL);
    if (!leverAdvertURL(pageURL) || !current || identity && !sameJob(current, identity)) return null;
    const roots = [...document.querySelectorAll(".content-wrapper.posting-page > .content")].filter(visible);
    if (roots.length !== 1) return null;
    const root = roots[0], sections = [...root.children];
    if (sections.length !== 2 || !sections[0].matches(".section-wrapper.accent-section") || !sections[1].matches(".section-wrapper:not(.accent-section)") || !sections.every(visible)) return null;
    if (![...sections[1].querySelectorAll(".section")].some(visible)) return null;
    const titles = [...root.querySelectorAll(".posting-headline > h2")].filter(visible);
    if (titles.length !== 1 || titles[0].textContent.trim().length < 3 || [...root.querySelectorAll(".posting")].some(visible)) return null;
    const links = [...root.querySelectorAll(".postings-btn-wrapper a[href],.last-section-apply a[href]")].filter((a) => !a.closest(excludedForIdentity) && a.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true }));
    if (!links.length || links.some((a) => !sameJob(current, jobIdentity(leverAdvertURL(a.href, true))))) return null;
    return root;
  }
  function findDescription(identity, pageURL = location.href) {
    let host;
    try {
      host = new URL(pageURL).hostname;
    } catch {
      return null;
    }
    if (isLeverHost(host)) return findLeverDescription(identity, pageURL);
    const roots = [...document.querySelectorAll(descriptionSelectors)].filter(visible);
    const outer = roots.filter((r) => !roots.some((other) => other !== r && other.contains(r)));
    if (outer.length !== 1) return null;
    const root = outer[0];
    if (!identity) return root;
    const current = jobIdentity(pageURL);
    if (identity.provider === "original") return sameJob(current, identity) ? root : null;
    const enclosing = root.closest("[data-job-id],[data-jobkey],[data-jk]");
    if (enclosing) {
      const id = enclosing.getAttribute("data-job-id") || enclosing.getAttribute("data-jobkey") || enclosing.getAttribute("data-jk");
      if (id !== identity.id) return null;
      return root;
    }
    const pane = root.closest('.jobs-details,.jobs-search__job-details--container,.jobsearch-RightPane,[data-testid="jobsearch-RightPane"]');
    const links = pane ? [...pane.querySelectorAll("a[href]")].filter(visible).map((a) => jobIdentity(a.href)).filter(Boolean) : [];
    if (pane) return sameJob(current, identity) && links.length > 0 && links.every((link) => sameJob(link, identity)) ? root : null;
    const path = new URL(pageURL).pathname;
    const direct = identity.provider === "linkedin" ? /\/jobs\/view\//.test(path) : /\/viewjob\/?$/.test(path);
    return direct && sameJob(current, identity) ? root : null;
  }
  function discoverCards(limit = 100) {
    const found = [], seen = /* @__PURE__ */ new Set();
    const anchors = document.querySelectorAll('a[href*="/jobs/"],a[href*="/job/"],a[href*="/viewjob"],a[href*="jk="],a[href*="/careers/"],a[href*="/positions/"],a[href*="/opportunities/"],a.posting-title[href]');
    let inspected = 0;
    for (const anchor of anchors) {
      if (++inspected > 1500 || found.length >= limit) break;
      if (!visible(anchor) || !nearViewport(anchor)) continue;
      const identity = jobIdentity(anchor.href);
      if (!identity) continue;
      const lever = Boolean(leverAdvertURL(anchor.href));
      const card = anchor.parentElement?.closest(lever ? ".posting" : 'article,li,[data-job-id],[data-occludable-job-id],[data-jobkey],.job_seen_beacon,.job-card,.job-card-container,[data-testid="slider_item"]');
      if (!card || card.closest(excluded) || seen.has(card) || card.contains(document.querySelector(descriptionSelectors))) continue;
      const title = ((lever ? anchor.querySelector("h5")?.innerText : anchor.innerText) || "").trim().replace(/\s+/g, " ").slice(0, 160);
      if (title.length < 3) continue;
      seen.add(card);
      found.push({ card, anchor, identity, title });
    }
    return found;
  }

  // extension-companion/theme.css
  var theme_default = ':host{all:initial;color-scheme:light;font:14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#233e35}*{box-sizing:border-box}button,a,input,textarea{font:inherit}button,a,summary,input,textarea{outline-offset:4px}button:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #a75532}button{cursor:pointer}button:disabled{opacity:.55;cursor:wait}[hidden]{display:none!important}.marker{display:inline-flex;align-items:center;gap:7px;margin:10px 0 3px;border:1px solid #a9b9ad;border-radius:5px;padding:6px 10px;background:#f7f5ec;color:#254739;font-size:12px;font-weight:650;line-height:1.4}.marker:before{content:"";width:5px;height:15px;border-left:2px solid #a65f3f;border-right:2px solid #a65f3f;transform:skew(-12deg)}.dock{position:fixed;right:22px;bottom:20px;display:flex;gap:0;box-shadow:0 5px 24px #172f2520;border:1px solid #bbc4b6;border-radius:8px;overflow:hidden;background:#f7f5ec}.dock button{border:0;background:transparent;color:#254739;padding:11px 14px;font-weight:650;font-size:12px}.dock button+button{border-left:1px solid #d8dace;font-weight:400}.panel{position:fixed;right:18px;top:18px;bottom:18px;width:min(428px,calc(100vw - 24px));overflow-y:auto;background:#f8f6ed;border:1px solid #b7c1b4;border-radius:12px;box-shadow:0 14px 70px #17382b32;scrollbar-gutter:stable}.masthead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid #d7dbcf;background:#203d31;color:#fff}.wordmark{font-size:15px;font-weight:680;letter-spacing:.01em}.edition{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#dfd8b9;display:block;margin-top:2px}.close{border:1px solid #829585;background:transparent;color:#fff;border-radius:5px;padding:4px 9px;font-size:18px}.body{padding:22px}.kicker{font:600 10px/1.5 system-ui;letter-spacing:.16em;text-transform:uppercase;color:#995738;margin:0 0 7px}h1{font:400 29px/1.12 Georgia,"Times New Roman",serif;letter-spacing:-.7px;margin:0 0 12px;color:#203d31}h2{font:400 24px/1.15 Georgia,"Times New Roman",serif;margin:8px 0 10px;color:#203d31}h3{font-size:13px;margin:0 0 6px}p{margin:0 0 13px}.muted,.small{color:#627066;font-size:12px}.small{font-size:11px}.message{border-left:2px solid #ac6a48;padding:4px 0 4px 12px;font-size:13px;margin:16px 0}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}button.primary{color:#fff;background:#284d3b;border:1px solid #284d3b}.primary,.secondary{padding:10px 14px;border-radius:5px;font-weight:650;font-size:12px}.secondary{background:transparent;color:#294b3b;border:1px solid #a9b9ad}label{font-size:12px;font-weight:650;display:block}textarea{display:block;width:100%;min-height:136px;max-height:320px;resize:vertical;border:1px solid #b7bfae;border-radius:5px;padding:12px;background:#fffefa;color:#283e35;font-size:12px;line-height:1.6;margin-top:7px}.confirm{display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:14px 0}.confirm input{margin:3px 0 0;accent-color:#345e45}.result{border-top:1px solid #bfc8b9;margin-top:24px;padding-top:20px}.rule{display:grid;grid-template-columns:26px 1fr;gap:9px;border-top:1px solid #dedfd3;padding:15px 0}.number{font:italic 17px Georgia;color:#946044}.rule p{font-size:12px;margin:4px 0 0;color:#5d6b61}.quotes blockquote{margin:12px 0;border-left:2px solid #a36b49;padding:9px 0 9px 14px;font:400 16px/1.55 Georgia,serif;color:#263f32;white-space:pre-wrap;overflow-wrap:anywhere}.status{display:inline-block;font:650 10px system-ui;letter-spacing:.08em;text-transform:uppercase;padding:5px 7px;border:1px solid #bfccb9;border-radius:3px;color:#345b42;background:#edf1e5}.result[data-status="unavailable"] .status{color:#824736;background:#f3e9df;border-color:#d5b9a8}.result[data-status="unclear"] .status,.result[data-status="conditional"] .status{color:#7d5e32;background:#f4ecda;border-color:#d8c99e}.foot{border-top:1px solid #d7dbcf;margin-top:20px;padding-top:14px;font-size:11px;color:#667165}.foot a{color:#31533e}.foot details{margin-bottom:12px}.foot summary{cursor:pointer;font-weight:650}.foot p{margin-top:8px}.origin{overflow-wrap:anywhere}@media(max-width:600px){.panel{right:6px;top:6px;bottom:6px}.body{padding:19px}.dock{right:12px;bottom:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}\n.masthead{position:sticky;top:0;z-index:1}.editor{border-top:1px solid #d7dbcf;border-bottom:1px solid #d7dbcf;padding:12px 0}.editor summary{cursor:pointer;font-size:12px;font-weight:650;color:#34513f}.editor[open] summary{margin-bottom:13px}.editor .toolbar{margin-bottom:2px}\n.handoff{border-top:1px solid #d7dbcf;padding-top:16px;margin-top:12px}.handoff summary{font-size:13px;font-weight:650;cursor:pointer}.handoff p{margin-top:12px}.handoff label{margin:12px 0}.handoff input{display:block;width:100%;padding:9px;border:1px solid #b7bfae;border-radius:4px;background:#fffefa;color:#293e34}.handoff button{margin-top:4px}\n';

  // shared/job-note.js
  function publicJobURL(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw Error("Add the exact public HTTPS advert link.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2e3) throw Error("Use a public HTTPS advert link without credentials.");
    for (const key of [...url.searchParams.keys()]) {
      if (/token|session|password|secret|signature|auth/i.test(key)) throw Error("Remove private session links; use the public advert address.");
      if (/^utm_|^(trackingId|trk|referrer)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    url.searchParams.sort();
    return url.href;
  }
  var bounded = (value, max, name, required = false) => {
    if (typeof value !== "string" || value.length > max || required && !value.trim()) throw Error(`Review ${name}; its value is missing or too long.`);
    return value.trim();
  };
  var hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");
  async function createJobNote(input) {
    const text = bounded(input.text, 26e3, "the complete advert", true);
    if (text.length < 80) throw Error("Include the complete role description (at least 80 characters).");
    if (input.confirmed !== true) throw Error("Confirm the complete public advert before preparing a handoff.");
    const observedAt = input.observedAt || (/* @__PURE__ */ new Date()).toISOString();
    if (!Number.isFinite(Date.parse(observedAt))) throw Error("Invalid observation time.");
    const source = { url: publicJobURL(input.url), title: bounded(input.title, 240, "job title", true), company: bounded(input.company || "", 200, "employer"), location: bounded(input.location || "", 300, "location"), observedAt };
    const answer = analyseAdvert(text, true);
    return { schema: "sponsor-intel.job-note", version: 1, source, advert: { text, sha256: await hash(text) }, wording: { status: answer.status, evidence: answer.evidence, method: "Local phrase check; not independently verified" } };
  }

  // extension-companion/companion.js
  var slot = "__sponsorIntelJobNotes_v020";
  if (window[slot]) window[slot].stop();
  else if (/^https?:$/.test(location.protocol)) start();
  function start() {
    let stopped = false, timer = null, selected = null, snapshot = null, returnFocus = null, lastHref = location.href, generation = 0;
    const markers = /* @__PURE__ */ new Map(), hosts = /* @__PURE__ */ new Set();
    const host = document.createElement("div");
    host.dataset.siNotes = "panel";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("z-index", "2147483646", "important");
    host.style.setProperty("inset", "0", "important");
    host.style.setProperty("pointer-events", "none", "important");
    const shadow = host.attachShadow({ mode: "closed" }), style = document.createElement("style");
    style.textContent = theme_default + " .dock,.panel{pointer-events:auto}";
    shadow.append(style);
    const shell = document.createElement("div");
    shell.innerHTML = `<div class="dock"><button id="open" aria-label="Open Sponsor Intel job notes">Sponsor Intel \xB7 Job notes</button><button id="stop">Off</button></div>
  <section class="panel" id="panel" aria-label="Sponsor Intel job notes" hidden><header class="masthead"><div><span class="wordmark">Sponsor Intel</span><span class="edition">Job notes / browsing companion</span></div><button class="close" id="close" aria-label="Close job notes">\xD7</button></header><div class="body">
  <p class="kicker">A closer reading</p><h1 id="title" tabindex="-1">One advert. The useful details.</h1><p class="muted origin" id="origin"></p><p class="message" id="message" role="status"></p>
  <div class="toolbar"><button class="primary" id="read">Read full description</button><a class="secondary" id="original" target="_blank" rel="noopener noreferrer" hidden>Open this job \u2197</a></div>
  <details class="editor" id="editor" open><summary>Review the full advert</summary><label for="text">The advert you are checking</label><textarea id="text" rows="6" maxlength="100001" spellcheck="false" placeholder="Or paste the complete public advert here. Leave out CVs and application answers."></textarea><p class="small" id="provenance"></p>
  <label class="confirm"><input type="checkbox" id="confirm"><span>I have checked this is the complete advert for the role above, including its conditions.</span></label><div class="toolbar"><button class="primary" id="check">Read the wording</button><button class="secondary" id="clear">Clear</button></div></details>
  <section class="result" id="result" aria-live="polite" hidden><span class="status" id="status"></span><h2 id="verdict" tabindex="-1"></h2><p class="muted" id="reason"></p><div class="quotes" id="quotes"></div><div class="rule"><span class="number">01</span><div><h3>Your next check</h3><p id="next"></p></div></div></section>
  <div class="rule"><span class="number">02</span><div><h3>Sponsor licence</h3><p>Not checked here. The exact legal employer needs a current register match. A trading name or licence alone does not confirm sponsorship for this job.</p></div></div>
  <div class="rule"><span class="number">03</span><div><h3>Vacancy & personal eligibility</h3><p>Not verified. Check the employer\u2019s original advert, closing date and your circumstances before applying.</p></div></div>
  <details class="handoff"><summary>Take this role to your workspace</summary><p class="muted">Prepare a Job notes file with this public advert, original link and wording evidence. Import and review it in Sponsor Intel before creating documents. This does not save to your account or apply.</p><label for="job-title">Job title<input id="job-title" maxlength="240"></label><label for="company">Employer, if known<input id="company" maxlength="200"></label><label for="job-location">Location, if known<input id="job-location" maxlength="300"></label><label for="source-url">Public advert link<input id="source-url" type="url" maxlength="2000"></label><button class="secondary" id="export">Download job notes</button><p class="small" id="handoff-message" role="status">Workspace import is prepared for the next website release; it is not live yet. Keep the file until that release is verified.</p></details>
  <footer class="foot"><details><summary>How these notes work</summary><p>Only this tab is enabled. Small job markers appear as the page changes; descriptions are read when you ask. This is a local wording check, not a complete reading of every site.</p><p>No automatic upload or saving. Closing the notes clears the advert. Off removes the companion. Download job notes creates a file only when you choose it. Reloading or leaving the page requires enabling it again. Do not paste private information.</p></details><a href="https://sponsorintel.london/browser-extension" target="_blank" rel="noopener noreferrer">Sponsor Intel / help & current release \u2197</a></footer></div></section>`;
    shadow.append(shell);
    document.documentElement.append(host);
    hosts.add(host);
    const $ = (id) => shadow.getElementById(id), panel = $("panel");
    function clear(message = "Cleared from this panel. Any downloaded files are unchanged.") {
      generation++;
      snapshot = null;
      $("text").value = "";
      $("confirm").checked = false;
      $("result").hidden = true;
      $("quotes").replaceChildren();
      $("provenance").textContent = "";
      $("message").textContent = message;
      $("editor").open = true;
    }
    function close() {
      panel.hidden = true;
      clear();
      selected = null;
      returnFocus?.isConnected && returnFocus.focus();
    }
    function open(item = null, focusTarget = null) {
      selected = item;
      returnFocus = focusTarget;
      clear();
      panel.hidden = false;
      $("title").textContent = item?.title || "One advert. The useful details.";
      $("origin").textContent = location.hostname + " \xB7 enabled in this tab";
      $("original").hidden = !item;
      if (item) $("original").href = item.identity.url;
      else $("original").removeAttribute("href");
      $("job-title").value = item?.title || "";
      $("company").value = "";
      $("job-location").value = "";
      $("source-url").value = item?.identity.url || location.href;
      $("message").textContent = item ? "A card is a preview. Open its complete description, then read it here. We will check the job identity before using a split-view description." : "Read the complete advert on this page, or paste its public text. Nothing has been classified yet.";
      $("title").focus();
    }
    function selectionStillMatches() {
      return !selected || selected.card.isConnected && sameJob(jobIdentity(selected.anchor.href), selected.identity);
    }
    function invalidateSource() {
      clear("The page or selected job changed. Read the complete advert again before checking.");
    }
    function ensureFresh() {
      if (!selectionStillMatches() || location.href !== lastHref) {
        invalidateSource();
        return false;
      }
      if (snapshot) {
        const root = findDescription(selected?.identity);
        const current = root ? readDescription(root) : captureAdvert();
        if (root !== snapshot.root || current.error || current.text !== snapshot.text) {
          invalidateSource();
          return false;
        }
      }
      return true;
    }
    $("read").onclick = () => {
      clear();
      if (!selectionStillMatches()) {
        invalidateSource();
        return;
      }
      const root = findDescription(selected?.identity);
      if (selected && !root) {
        $("message").textContent = "This visible description cannot be matched to the selected job. Open that job\u2019s full page, enable Job notes there, or paste its complete advert. No other role was read.";
        return;
      }
      if (!root && isLeverHost(location.hostname) && (!window.getSelection() || window.getSelection().isCollapsed)) {
        $("message").textContent = "This employer page could not be matched to one complete advert. Open the exact job, select its complete public text, or paste it here. No application form or catalogue was read.";
        return;
      }
      const data = root ? readDescription(root) : captureAdvert();
      if (data.error) {
        $("message").textContent = data.error;
        return;
      }
      snapshot = { root, text: data.text, observedAt: (/* @__PURE__ */ new Date()).toISOString() };
      lastHref = location.href;
      $("text").value = data.text;
      $("provenance").textContent = location.hostname + " \xB7 read at " + (/* @__PURE__ */ new Date()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " \xB7 " + (selected ? "matching job description" : "page text; review its scope");
      $("message").textContent = "Read the text below. Expand any missing sections on the website before checking.";
    };
    $("text").oninput = () => {
      generation++;
      snapshot = null;
      $("result").hidden = true;
      $("confirm").checked = false;
      $("quotes").replaceChildren();
      $("provenance").textContent = "Pasted or edited text \xB7 its job identity has not been verified.";
    };
    $("confirm").onchange = () => {
      generation++;
      $("result").hidden = true;
    };
    $("check").onclick = () => {
      if (!ensureFresh()) return;
      const answer = analyseAdvert($("text").value, $("confirm").checked);
      $("result").dataset.status = answer.status;
      $("status").textContent = { offered: "Offered wording", conditional: "Conditions apply", unavailable: "Refused wording", unclear: "Not established" }[answer.status];
      $("verdict").textContent = answer.title;
      $("reason").textContent = answer.reason;
      $("quotes").replaceChildren(...answer.evidence.map((e) => {
        const q = document.createElement("blockquote");
        q.textContent = e.quote;
        return q;
      }));
      $("next").textContent = nextStep(answer.status);
      $("result").hidden = false;
      if ($("confirm").checked && $("text").value.trim().length >= 40) {
        $("editor").open = false;
        $("message").textContent = "Notes from the advert you reviewed. Expand Review the full advert to inspect or edit the source text.";
        $("verdict").focus();
        panel.scrollTop = 0;
      } else $("result").scrollIntoView({ block: "nearest", behavior: "auto" });
    };
    $("clear").onclick = () => {
      clear();
      $("text").focus();
    };
    $("close").onclick = close;
    $("open").onclick = () => open();
    $("stop").onclick = stop;
    for (const id of ["job-title", "company", "job-location", "source-url"]) $(id).addEventListener("input", () => generation++);
    $("export").onclick = async () => {
      if (!ensureFresh()) return;
      const token = generation;
      $("export").disabled = true;
      try {
        const packet = await createJobNote({ text: $("text").value, confirmed: $("confirm").checked, url: $("source-url").value, title: $("job-title").value, company: $("company").value, location: $("job-location").value, observedAt: snapshot?.observedAt });
        if (stopped || token !== generation || !ensureFresh()) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2) + "\n"], { type: "application/json" })), a = document.createElement("a");
        a.href = url;
        a.download = "sponsor-intel-job-notes.json";
        shadow.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1e3);
        $("handoff-message").textContent = "Download requested. Check your saved file. Nothing was sent to your profile or to an employer. Import it after the workspace-import release is available.";
      } catch (error) {
        $("handoff-message").textContent = error.message;
      } finally {
        $("export").disabled = false;
      }
    };
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        event.stopPropagation();
        close();
      }
    });
    function makeMarker(item) {
      const badge = document.createElement("span");
      badge.dataset.siNotes = "marker";
      const root = badge.attachShadow({ mode: "closed" }), s = document.createElement("style");
      s.textContent = theme_default;
      const button = document.createElement("button");
      button.className = "marker";
      button.type = "button";
      button.textContent = "Sponsorship notes";
      button.setAttribute("aria-label", `Sponsorship notes for ${item.title}`);
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        open(item, button);
      };
      root.append(s, button);
      item.card.append(badge);
      markers.set(item.card, { badge, item });
      hosts.add(badge);
    }
    function scan() {
      timer = null;
      if (stopped) return;
      if (location.href !== lastHref) {
        lastHref = location.href;
        if (!panel.hidden) invalidateSource();
      }
      if (!panel.hidden) ensureFresh();
      for (const [card, entry] of markers) {
        if (!card.isConnected || !nearViewport(card) || !sameJob(jobIdentity(entry.item.anchor.href), entry.item.identity)) {
          entry.badge.remove();
          hosts.delete(entry.badge);
          markers.delete(card);
        }
      }
      for (const item of discoverCards()) {
        if (markers.size >= 100) break;
        if (!markers.has(item.card)) makeMarker(item);
      }
    }
    function schedule(records) {
      if (records?.length && records.every((r) => r.target.nodeType === 1 && r.target.closest("[data-si-notes]"))) return;
      if (!timer && !stopped) timer = setTimeout(scan, 350);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "data-job-id", "data-jobkey", "data-jk", "open", "hidden", "aria-hidden", "class", "style"] });
    const onScroll = () => schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onScroll);
    window.addEventListener("pagehide", stop);
    function stop() {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onScroll);
      window.removeEventListener("pagehide", stop);
      clear();
      for (const node of hosts) node.remove();
      markers.clear();
      hosts.clear();
      delete window[slot];
    }
    window[slot] = { stop };
    scan();
  }
})();
