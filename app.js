const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
let listings = [];
let chatFilters = {};

const label = value => ({ buy: 'For sale', rent: 'For rent', commercial: 'Commercial', apartment: 'Apartment', villa: 'Villa', retail: 'Retail', office: 'Office', showroom: 'Showroom' }[value] || value);
const propertyUrl = id => `property.html?id=${encodeURIComponent(id)}`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderShell() {
  document.querySelector('#site-header').innerHTML = `
    <div class="announcement"><span>SSR REALTY / INTERACTIVE DRAFT</span><span>All property content is illustrative</span></div>
    <header class="site-header"><div class="container header-inner"><a class="brand" href="index.html" aria-label="SSR Realty home"><span class="brand-symbol">S<span>·</span></span><span class="brand-name">SSR <b>REALTY</b></span></a><nav id="main-nav" class="main-nav" aria-label="Primary navigation"><a href="index.html" ${page === 'home' ? 'aria-current="page"' : ''}>Home</a><a href="listings.html" ${page === 'listings' || page === 'property' ? 'aria-current="page"' : ''}>Properties</a><a href="about.html" ${page === 'about' ? 'aria-current="page"' : ''}>About</a><a href="contact.html" ${page === 'contact' ? 'aria-current="page"' : ''}>Enquire</a></nav><div class="header-actions"><button type="button" class="header-bot" data-open-chat>Ask SSR Bot <span>✦</span></button><button id="menu-toggle" class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Open menu"><span></span><span></span></button></div></div></header>`;
  document.querySelector('#site-footer').innerHTML = `<footer class="footer"><div class="container"><div class="footer-top"><div><a class="brand footer-brand" href="index.html"><span class="brand-symbol">S<span>·</span></span><span class="brand-name">SSR <b>REALTY</b></span></a><p>A clearer way to explore what comes next.</p></div><div class="footer-links"><div><strong>Explore</strong><a href="listings.html">Properties</a><a href="listings.html?intent=commercial">Commercial</a><a href="about.html">About SSR</a></div><div><strong>Connect</strong><a href="contact.html">Enquire</a><button type="button" data-open-chat>Ask SSR Bot</button></div></div></div><div class="footer-bottom"><span>© SSR Realty · Interactive concept</span><span>Listings, images and prices are illustrative. No enquiries are sent.</span></div></div></footer>`;
  document.querySelector('#chat-root').innerHTML = `<button id="chat-launcher" class="chat-launcher" type="button" aria-label="Open chat" aria-expanded="false"><img src="assets/bot-face.png" alt="Chat Bot" class="launcher-sticker-bot"></button><section id="chat-panel" class="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden><header class="chat-head"><div class="chat-avatar"><img src="assets/bot-face.png" alt="SSR Bot" class="chat-avatar-img"><span class="avatar-online-dot header-dot"></span></div><div><strong id="chat-title">SSR Bot</strong><span id="chat-mode">Checking connection…</span></div><button id="chat-close" type="button" aria-label="Close SSR Bot">×</button></header><div id="chat-messages" class="chat-messages" aria-live="polite"><div class="chat-message bot">Tell me the kind of space you need. I can search the illustrative SSR listings by location, type, size and budget.</div><div class="chat-suggestions"><button type="button">2 BHK in Whitefield under ₹2 Cr</button><button type="button">Office space in Bellandur</button><button type="button">Show rental apartments</button></div></div><form id="chat-form" class="chat-form"><label class="sr-only" for="chat-input">Message SSR Bot</label><input id="chat-input" name="message" maxlength="500" autocomplete="off" placeholder="Describe your property need…" required><button type="submit" aria-label="Send message">➤</button></form><p class="chat-disclaimer">Draft assistant · Demo listings only · No chat history is saved</p></section>`;
  const toggle = document.querySelector('#menu-toggle');
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); document.querySelector('#main-nav').classList.toggle('open', open); });
  document.querySelectorAll('[data-open-chat], #chat-launcher').forEach(button => button.addEventListener('click', () => setChatOpen(true)));
  document.querySelector('#chat-close').addEventListener('click', () => setChatOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setChatOpen(false); });
}

function setChatOpen(open) {
  const panel = document.querySelector('#chat-panel');
  panel.hidden = !open;
  document.querySelector('#chat-launcher').setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#chat-input').focus();
}

function card(item, small = false) {
  return `<article class="property-card ${small ? 'compact-card' : ''}"><a href="${propertyUrl(item.id)}" class="card-media"><img src="${item.image}" alt="Illustrative image for ${escapeHtml(item.title)}" loading="lazy"><span class="card-badge">Illustrative listing</span></a><div class="card-content"><div class="card-eyebrow"><span>${label(item.intent)}</span><span>${escapeHtml(item.locality)}</span></div><h3><a href="${propertyUrl(item.id)}">${escapeHtml(item.title)}</a></h3><p class="card-summary">${escapeHtml(item.config)} <span>·</span> ${item.areaSqft.toLocaleString('en-IN')} sq.ft <span>·</span> ${label(item.type)}</p><div class="card-bottom"><div><strong>${escapeHtml(item.priceLabel)}</strong><small>${escapeHtml(item.priceNote)}</small></div><a href="${propertyUrl(item.id)}" aria-label="View ${escapeHtml(item.title)}">↗</a></div></div></article>`;
}

function addOptions(select, values, placeholder, selected = '') {
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join('');
}

function setupHome() {
  document.querySelector('#featured-grid').innerHTML = listings.filter(item => item.featured).map(item => card(item)).join('');
  let intent = 'buy';
  const buttons = [...document.querySelectorAll('#home-search [data-intent]')];
  const typeSelect = document.querySelector('#home-type');
  const localitySelect = document.querySelector('#home-locality');
  const refresh = () => {
    buttons.forEach(button => button.classList.toggle('selected', button.dataset.intent === intent));
    const group = listings.filter(item => item.intent === intent);
    addOptions(localitySelect, [...new Set(group.map(item => item.locality))].sort(), 'All locations', localitySelect.value);
    addOptions(typeSelect, [...new Set(group.map(item => item.type))].sort(), 'All types', typeSelect.value);
  };
  buttons.forEach(button => button.addEventListener('click', () => { intent = button.dataset.intent; localitySelect.value = ''; typeSelect.value = ''; refresh(); }));
  document.querySelector('#home-search').addEventListener('submit', event => { event.preventDefault(); const query = new URLSearchParams({ intent }); if (localitySelect.value) query.set('locality', localitySelect.value); if (typeSelect.value) query.set('type', typeSelect.value); location.href = `listings.html?${query}`; });
  refresh();
}

function setupListings() {
  let intent = params.get('intent') || 'all';
  if (!['all', 'buy', 'rent', 'commercial'].includes(intent)) intent = 'all';
  const locality = document.querySelector('#filter-locality');
  const type = document.querySelector('#filter-type');
  const budget = document.querySelector('#filter-budget');
  const sort = document.querySelector('#filter-sort');
  const buttons = [...document.querySelectorAll('[data-filter-intent]')];
  const initialLocality = params.get('locality') || '';
  const initialType = params.get('type') || '';
  let pendingLocality = initialLocality;
  let pendingType = initialType;
  function renderOptions() {
    const group = listings.filter(item => intent === 'all' || item.intent === intent);
    addOptions(locality, [...new Set(group.map(item => item.locality))].sort(), 'All locations', pendingLocality ?? locality.value);
    addOptions(type, [...new Set(group.map(item => item.type))].sort(), 'All types', pendingType ?? type.value);
    pendingLocality = null; pendingType = null;
    const ranges = intent === 'all' ? [['', 'Any budget']] : intent === 'buy' ? [['', 'Any budget'], ['10000000', 'Up to ₹1 Cr'], ['20000000', 'Up to ₹2 Cr'], ['35000000', 'Up to ₹3.5 Cr']] : [['', 'Any budget'], ['50000', 'Up to ₹50,000 / mo'], ['100000', 'Up to ₹1 L / mo'], ['200000', 'Up to ₹2 L / mo'], ['300000', 'Up to ₹3 L / mo']];
    budget.innerHTML = ranges.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
    sort.innerHTML = intent === 'all' ? '<option value="default">Featured first</option>' : '<option value="default">Featured first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>';
    buttons.forEach(button => button.classList.toggle('selected', button.dataset.filterIntent === intent));
  }
  function update() {
    const maximum = Number(budget.value) || Infinity;
    let found = listings.filter(item => (intent === 'all' || item.intent === intent) && (!locality.value || item.locality === locality.value) && (!type.value || item.type === type.value) && item.price <= maximum);
    if (sort.value === 'price-asc') found.sort((a, b) => a.price - b.price);
    if (sort.value === 'price-desc') found.sort((a, b) => b.price - a.price);
    document.querySelector('#listing-grid').innerHTML = found.map(item => card(item)).join('');
    document.querySelector('#listing-empty').hidden = found.length > 0;
    document.querySelector('#results-count').textContent = `${found.length} illustrative ${found.length === 1 ? 'property' : 'properties'} found`;
    document.querySelector('#results-title').textContent = intent === 'all' ? 'Explore properties' : `${label(intent)} properties`;
  }
  function reset() { intent = 'all'; locality.value = ''; type.value = ''; budget.value = ''; sort.value = 'default'; renderOptions(); update(); history.replaceState(null, '', 'listings.html'); }
  buttons.forEach(button => button.addEventListener('click', () => { intent = button.dataset.filterIntent; locality.value = ''; type.value = ''; renderOptions(); update(); }));
  [locality, type, budget, sort].forEach(control => control.addEventListener('change', update));
  document.querySelector('#reset-filters').addEventListener('click', reset);
  document.querySelector('#empty-reset').addEventListener('click', reset);
  renderOptions(); update();
}

function setupProperty() {
  const item = listings.find(entry => entry.id === params.get('id'));
  const main = document.querySelector('#property-main');
  if (!item) { main.innerHTML = `<div class="not-found"><span class="eyebrow">Property not found</span><h1>Let's find another space.</h1><p>This demo listing may have moved.</p><a class="button button-dark" href="listings.html">Browse properties →</a></div>`; return; }
  document.title = `${item.title} — SSR Realty Draft`;
  main.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="listings.html">Properties</a><span>/</span><span>${escapeHtml(item.title)}</span></nav><div class="property-heading"><div><span class="eyebrow">${label(item.intent)} · ${escapeHtml(item.locality)}</span><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.city)} · ${escapeHtml(item.status)}</p></div><div class="property-price"><strong>${escapeHtml(item.priceLabel)}</strong><span>${escapeHtml(item.priceNote)}</span></div></div><div class="property-visual"><img src="${item.image}" alt="Illustrative view representing ${escapeHtml(item.title)}"><span>Illustrative property image</span></div><div class="property-layout"><div class="property-detail"><div class="fact-row"><div><small>Property type</small><strong>${label(item.type)}</strong></div><div><small>Configuration</small><strong>${escapeHtml(item.config)}</strong></div><div><small>Approx. area</small><strong>${item.areaSqft.toLocaleString('en-IN')} sq.ft</strong></div></div><span class="eyebrow">About this space</span><h2>Picture the possibilities.</h2><p class="lead">${escapeHtml(item.summary)}</p><h3>At a glance</h3><ul class="highlight-list">${item.highlights.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul><div class="property-honesty"><strong>About this draft</strong><p>This listing, image, price and availability are illustrative. SSR has not supplied or verified this property. RERA details will appear only after a real listing is reviewed.</p></div></div><aside class="property-side"><span class="eyebrow">Interested?</span><h2>Start with a question.</h2><p>Ask SSR Bot about this demo property or preview an enquiry.</p><button class="button button-dark" type="button" data-open-chat>Ask SSR Bot ✦</button><a class="button button-outline" href="contact.html?listing=${encodeURIComponent(item.id)}">Preview enquiry →</a></aside></div><div class="related-heading"><span class="eyebrow">Keep exploring</span><h2>More spaces to consider</h2></div><div class="card-grid related-grid">${listings.filter(entry => entry.id !== item.id).slice(0, 3).map(entry => card(entry)).join('')}</div>`;
  main.querySelector('[data-open-chat]').addEventListener('click', () => setChatOpen(true));
}

function setupContact() {
  const item = listings.find(entry => entry.id === params.get('listing'));
  if (item) document.querySelector('#enquiry-requirement').value = `I am interested in ${item.title} (${item.locality}).`;
  const form = document.querySelector('#enquiry-form');
  form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity()) return; form.hidden = true; document.querySelector('#enquiry-success').hidden = false; });
  document.querySelector('#enquiry-again').addEventListener('click', () => { form.reset(); form.hidden = false; document.querySelector('#enquiry-success').hidden = true; });
}

function addChatMessage(text, who) {
  const el = document.createElement('div'); el.className = `chat-message ${who}`; el.textContent = text;
  document.querySelector('#chat-messages').append(el);
  el.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return el;
}

function setupChat() {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');
  fetch('/api/status').then(response => response.json()).then(data => {
    document.querySelector('#chat-mode').textContent = data.geminiConfigured ? 'Gemini-powered demo search' : 'Local preview · Gemini key needed';
  }).catch(() => { document.querySelector('#chat-mode').textContent = 'Start the local server to chat'; });
  async function sendMessage(message) {
    const clean = message.trim(); if (!clean) return;
    addChatMessage(clean, 'user');
    input.value = ''; input.disabled = true; form.querySelector('button').disabled = true;
    const pending = addChatMessage('Searching the demo listings…', 'bot');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: clean, filters: chatFilters }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat is unavailable.');
      chatFilters = data.filters || {};
      pending.textContent = data.reply;
      const found = (data.listingIds || []).map(id => listings.find(item => item.id === id)).filter(Boolean).slice(0, 3);
      if (found.length) {
        const group = document.createElement('div'); group.className = 'chat-result-list';
        group.innerHTML = found.map(item => `<a href="${propertyUrl(item.id)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.locality)} · ${escapeHtml(item.priceLabel)}</span><i>↗</i></a>`).join('');
        document.querySelector('#chat-messages').append(group);
      }
      pending.scrollIntoView({ block: 'end', behavior: 'smooth' });
    } catch (error) { pending.textContent = error.message; }
    finally { input.disabled = false; form.querySelector('button').disabled = false; input.focus(); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
  document.querySelectorAll('.chat-suggestions button').forEach(button => button.addEventListener('click', () => sendMessage(button.textContent)));
}

async function init() {
  renderShell();
  try { const response = await fetch('data/listings.json'); if (!response.ok) throw new Error('Could not load demo inventory'); listings = await response.json(); }
  catch { document.querySelector('main').insertAdjacentHTML('afterbegin', '<p class="data-error">Demo listings could not load. Please run the local server.</p>'); }
  if (page === 'home') setupHome();
  if (page === 'listings') setupListings();
  if (page === 'property') setupProperty();
  if (page === 'contact') setupContact();
  setupChat();
}

init();
