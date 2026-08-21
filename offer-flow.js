(() => {
  const OFFER_STORAGE_KEY = 'fahrfolio-offers-v1';
  let activeOfferVehicleId = null;

  const style = document.createElement('style');
  style.textContent = `
    .offer-modal{width:min(900px,100%)}
    .offer-note{background:var(--blue-soft);border:1px solid #cfe6ff;color:#345578;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13px}
    .offer-preview{margin-top:18px;background:#eef2f7;border-radius:16px;padding:14px}
    .offer-preview-card{background:#fff;border-radius:12px;padding:18px;box-shadow:0 8px 22px rgba(24,42,66,.05)}
    .offer-preview-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:2px solid var(--blue);padding-bottom:11px;margin-bottom:14px}
    .offer-preview-head strong{font-size:18px;color:var(--navy)}
    .offer-preview-head span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
    .offer-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .offer-preview-grid>div{background:#f5f7fa;border-radius:9px;padding:10px}
    .offer-preview-grid span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:3px}
    .offer-preview-grid strong{font-size:12px;color:var(--text)}
    .offer-preview-price{font-size:28px;font-weight:900;color:var(--navy);margin:16px 0 4px}
    .offer-preview-valid{font-size:11px;color:var(--muted)}
    @media(max-width:760px){.offer-preview-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'offerModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal offer-modal" role="dialog" aria-modal="true" aria-labelledby="offerModalTitle">
      <div class="modal-head">
        <div><p class="eyebrow">ANGEBOT</p><h2 id="offerModalTitle">Angebot erstellen</h2></div>
        <button class="icon-btn" id="closeOfferModal" aria-label="Schließen">×</button>
      </div>
      <div class="offer-note"><strong>Einfacher Ablauf:</strong> Käufer auswählen, Preis und Gültigkeit prüfen, Angebot als PDF oder Ausdruck öffnen.</div>
      <div class="form-grid two-cols">
        <label>Fahrzeug<input id="offerVehicleLabel" disabled /></label>
        <label>Kunde<select id="offerCustomer"></select></label>
        <label>Angebotspreis (€)<input id="offerPrice" type="number" min="0" step="100" /></label>
        <label>Angebotsdatum<input id="offerDate" type="date" /></label>
        <label>Gültig bis<input id="offerValidUntil" type="date" /></label>
        <label>Telefon im Angebot<input id="offerPhone" type="tel" placeholder="optional" /></label>
      </div>
      <label class="full-field">Zusätzlicher Hinweis<textarea id="offerNote" rows="2" placeholder="z. B. Winterräder inklusive, Finanzierung auf Anfrage …"></textarea></label>
      <div class="offer-preview"><div class="offer-preview-card" id="offerPreview"></div></div>
      <div class="modal-actions">
        <button type="button" class="secondary-btn" id="cancelOfferBtn">Abbrechen</button>
        <button type="button" class="primary-btn" id="createOfferBtn">Angebot öffnen / PDF</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const customerSelect = document.getElementById('offerCustomer');
  const vehicleLabel = document.getElementById('offerVehicleLabel');
  const priceInput = document.getElementById('offerPrice');
  const dateInput = document.getElementById('offerDate');
  const validUntilInput = document.getElementById('offerValidUntil');
  const phoneInput = document.getElementById('offerPhone');
  const noteInput = document.getElementById('offerNote');
  const preview = document.getElementById('offerPreview');

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try { return JSON.parse(localStorage.getItem('fahrfolio-dealer-profile-v1')) || {}; }
    catch (error) { return {}; }
  }

  function localDate(days = 0) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function loadOffers() {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFER_STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveOffer(offer) {
    const offers = loadOffers();
    offers.unshift(offer);
    localStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(offers));
  }

  function offerNumber() {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    return `ANG-${stamp}-${String(now.getTime()).slice(-5)}`;
  }

  function selectedVehicle() {
    return vehicles.find(vehicle => vehicle.id === activeOfferVehicleId);
  }

  function selectedCustomer() {
    return customers.find(customer => customer.id === customerSelect.value);
  }

  function dateText(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T12:00:00`));
  }

  function updatePreview() {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    if (!vehicle) return;
    preview.innerHTML = `
      <div class="offer-preview-head"><strong>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</strong><span>Angebot · Vorschau</span></div>
      <div class="offer-preview-grid">
        <div><span>Kunde</span><strong>${escapeHtml(customer ? fullName(customer) : 'Kunde auswählen')}</strong></div>
        <div><span>FIN</span><strong>${escapeHtml(vehicle.vin || '—')}</strong></div>
        <div><span>Kilometerstand</span><strong>${formatNumber(vehicle.mileage)} km</strong></div>
        <div><span>Erstzulassung</span><strong>${escapeHtml(formatMonth(vehicle.firstRegistration))}</strong></div>
      </div>
      <div class="offer-preview-price">${formatCurrency(priceInput.value || vehicle.price)}</div>
      <div class="offer-preview-valid">Angebot gültig bis ${escapeHtml(dateText(validUntilInput.value))}</div>`;
  }

  function fillCustomers() {
    customerSelect.innerHTML = customers.length
      ? customers.map(customer => `<option value="${customer.id}">${escapeHtml(fullName(customer))} · ${escapeHtml(customer.city || '')}</option>`).join('')
      : '<option value="">Noch keinen Kunden angelegt</option>';
  }

  function openOffer(vehicleId) {
    const vehicle = vehicles.find(item => item.id === vehicleId);
    if (!vehicle) return showToast('Fahrzeug nicht gefunden.');
    if (vehicle.status === 'sold') return showToast('Für ein verkauftes Fahrzeug wird kein neues Angebot erstellt.');
    const dealer = dealerProfile();
    if (!dealer.company) return showToast('Bitte zuerst die Händlerdaten speichern.');
    if (!customers.length) return showToast('Bitte zuerst einen Kunden anlegen.');

    activeOfferVehicleId = vehicleId;
    fillCustomers();
    vehicleLabel.value = `${vehicle.brand} ${vehicle.model}`;
    priceInput.value = Number(vehicle.price || 0);
    dateInput.value = localDate(0);
    validUntilInput.value = localDate(7);
    phoneInput.value = dealer.phone || '';
    noteInput.value = '';
    updatePreview();
    openModal(modal);
  }

  function dealerBrand(dealer) {
    return dealer.logoData
      ? `<img src="${dealer.logoData}" alt="${escapeHtml(dealer.company || 'Autohaus')}" style="max-width:190px;max-height:58px;object-fit:contain">`
      : `<strong>${escapeHtml(dealer.company || 'Autohaus')}</strong>`;
  }

  function customerAddress(customer) {
    return [customer.street, `${customer.zip || ''} ${customer.city || ''}`.trim()].filter(Boolean).map(escapeHtml).join('<br>');
  }

  function openOfferDocument(offer) {
    const vehicle = offer.vehicle;
    const customer = offer.customer;
    const dealer = offer.dealer;
    const features = String(vehicle.equipment || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 10);
    const dealerContact = [offer.phone, dealer.email, dealer.website].filter(Boolean).map(escapeHtml).join(' · ');
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');

    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(offer.number)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#eef2f6;color:#172b49;font-size:12px}.page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:3px solid #1687ee;padding-bottom:10mm}.brand strong{font-size:22px}.meta{text-align:right;font-size:10px;color:#68788d;line-height:1.6}.meta strong{color:#17345f}.title{margin:12mm 0 7mm}.title h1{font-size:30px;margin:0 0 3mm}.title p{margin:0;color:#68788d}.parties{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:8mm}.box{border:1px solid #dbe3ed;border-radius:4mm;padding:5mm}.box span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#1687ee;margin-bottom:2mm}.box strong{font-size:14px}.box p{margin:2mm 0 0;color:#5f6f83;line-height:1.55}.vehicle{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.fact{background:#f4f7fa;border-radius:3mm;padding:4mm}.fact span{display:block;font-size:9px;text-transform:uppercase;color:#6d7b8d;margin-bottom:1mm}.fact strong{font-size:13px}.price{margin:9mm 0;background:#f4f9ff;border:1px solid #cfe6ff;border-radius:4mm;padding:6mm;display:flex;align-items:center;justify-content:space-between;gap:10mm}.price span{color:#5f6f83}.price strong{font-size:30px;color:#17345f}.section{margin-top:7mm}.section h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#1687ee;margin:0 0 3mm}.features{display:grid;grid-template-columns:1fr 1fr;gap:2mm}.features div{background:#f8fafc;border-radius:2mm;padding:2.5mm}.note{border:1px solid #dbe3ed;border-radius:3mm;padding:4mm;line-height:1.55;color:#536176;white-space:pre-wrap}.valid{margin-top:8mm;border-left:3px solid #1687ee;background:#f5f8fc;padding:4mm;line-height:1.55}.footer{margin-top:10mm;padding-top:4mm;border-top:1px solid #dbe3ed;color:#788696;font-size:9px;line-height:1.5}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:#fff;font-weight:700;cursor:pointer}
      @page{size:A4;margin:10mm}@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.parties,.vehicle,.features{grid-template-columns:1fr 1fr}}@media screen and (max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.parties,.vehicle,.features{grid-template-columns:1fr}.head{display:block}.meta{text-align:left;margin-top:12px}.price{align-items:flex-start;flex-direction:column}.print-actions{width:auto;margin:12px 18px 24px}}
    </style></head><body><main class="page"><div class="head"><div class="brand">${dealerBrand(dealer)}</div><div class="meta"><strong>Angebotsnummer:</strong> ${escapeHtml(offer.number)}<br><strong>Datum:</strong> ${escapeHtml(dateText(offer.date))}</div></div><div class="title"><h1>Fahrzeugangebot</h1><p>${escapeHtml(`${vehicle.brand} ${vehicle.model}`)}</p></div><div class="parties"><div class="box"><span>Anbieter</span><strong>${escapeHtml(dealer.company || '')}</strong><p>${[dealer.street, `${dealer.zip || ''} ${dealer.city || ''}`.trim(), dealerContact].filter(Boolean).map(escapeHtml).join('<br>')}</p></div><div class="box"><span>Für</span><strong>${escapeHtml(fullName(customer))}</strong><p>${customerAddress(customer)}${customer.email ? `<br>${escapeHtml(customer.email)}` : ''}</p></div></div><div class="vehicle"><div class="fact"><span>FIN</span><strong>${escapeHtml(vehicle.vin || '—')}</strong></div><div class="fact"><span>Erstzulassung</span><strong>${escapeHtml(formatMonth(vehicle.firstRegistration))}</strong></div><div class="fact"><span>Kilometerstand</span><strong>${formatNumber(vehicle.mileage)} km</strong></div><div class="fact"><span>Leistung</span><strong>${vehicle.hp || '—'} PS / ${vehicle.kw || '—'} kW</strong></div><div class="fact"><span>Kraftstoff</span><strong>${escapeHtml(vehicle.fuel || '—')}</strong></div><div class="fact"><span>Getriebe</span><strong>${escapeHtml(vehicle.transmission || '—')}</strong></div></div><div class="price"><span>Angebotspreis</span><strong>${formatCurrency(offer.price)}</strong></div><div class="section"><h2>Ausstattung</h2><div class="features">${features.length ? features.map(item => `<div>✓ ${escapeHtml(item)}</div>`).join('') : '<div>Ausstattung auf Anfrage</div>'}</div></div>${vehicle.notes ? `<div class="section"><h2>Hinweise zum Fahrzeugzustand</h2><div class="note">${escapeHtml(vehicle.notes)}</div></div>` : ''}${offer.note ? `<div class="section"><h2>Zusätzlicher Hinweis</h2><div class="note">${escapeHtml(offer.note)}</div></div>` : ''}<div class="valid"><strong>Gültig bis ${escapeHtml(dateText(offer.validUntil))}</strong><br>Dieses Dokument ist ein Fahrzeugangebot. Ein Kaufvertrag wird separat abgeschlossen.</div><div class="footer">${dealerContact || escapeHtml(dealer.company || '')}</div></main><div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div></body></html>`);
    win.document.close();
  }

  function createOffer() {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    if (!vehicle || !customer || !dealer.company) return;

    const offer = {
      id: crypto.randomUUID(),
      number: offerNumber(),
      createdAt: new Date().toISOString(),
      date: dateInput.value,
      validUntil: validUntilInput.value,
      price: Number(priceInput.value || vehicle.price || 0),
      phone: phoneInput.value.trim(),
      note: noteInput.value.trim(),
      vehicle: { ...vehicle },
      customer: { ...customer },
      dealer: { ...dealer }
    };

    try {
      saveOffer(offer);
      vehicle.lastOfferId = offer.id;
      saveVehicles();
    } catch (error) {
      console.error(error);
      return showToast('Angebot konnte lokal nicht gespeichert werden.');
    }

    closeModal(modal);
    openOfferDocument(offer);
    showToast(`Angebot ${offer.number} wurde erstellt.`);
  }

  function ensureDetailButton() {
    const actions = document.querySelector('.detail-actions');
    const contractButton = document.getElementById('detailContractBtn');
    if (!actions || document.getElementById('detailOfferBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-btn';
    button.id = 'detailOfferBtn';
    button.textContent = 'Angebot erstellen';
    button.addEventListener('click', () => openOffer(activeVehicleId));
    actions.insertBefore(button, contractButton || null);
  }

  function syncDetailButton() {
    ensureDetailButton();
    const button = document.getElementById('detailOfferBtn');
    const vehicle = vehicles.find(item => item.id === activeVehicleId);
    if (button) button.style.display = vehicle?.status === 'sold' ? 'none' : '';
  }

  ensureDetailButton();
  const detailObserver = new MutationObserver(syncDetailButton);
  detailObserver.observe(document.getElementById('vehicleDetailModal'), { attributes: true, attributeFilter: ['class'] });

  [customerSelect, priceInput, dateInput, validUntilInput, phoneInput, noteInput].forEach(field => {
    field.addEventListener('input', updatePreview);
    field.addEventListener('change', updatePreview);
  });

  document.getElementById('closeOfferModal').addEventListener('click', () => closeModal(modal));
  document.getElementById('cancelOfferBtn').addEventListener('click', () => closeModal(modal));
  document.getElementById('createOfferBtn').addEventListener('click', createOffer);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); });

  window.getFahrfolioOffers = loadOffers;
  window.openFahrfolioOffer = openOffer;
  window.openFahrfolioOfferDocument = openOfferDocument;
})();