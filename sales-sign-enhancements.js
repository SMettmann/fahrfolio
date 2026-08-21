(() => {
  const DEALER_STORAGE_KEY = 'fahrfolio-dealer-profile-v1';
  let activeSalesSignVehicleId = null;

  const style = document.createElement('style');
  style.textContent = `
    .sales-sign-modal{width:min(620px,100%)}
    .sales-sign-note{background:var(--blue-soft);border:1px solid #cfe6ff;color:#345578;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.5}
    .sales-sign-phone-row{display:flex;align-items:center;gap:10px;margin:10px 0 4px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#fff}
    .sales-sign-phone-row input[type="checkbox"]{width:18px;height:18px;accent-color:var(--blue)}
    .sales-sign-phone-row label{margin:0;font-weight:750;color:var(--text);cursor:pointer}
    .sales-sign-phone-input[hidden]{display:none}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'salesSignModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal sales-sign-modal" role="dialog" aria-modal="true" aria-labelledby="salesSignModalTitle">
      <div class="modal-head">
        <div><p class="eyebrow">VERKAUFSSCHILD</p><h2 id="salesSignModalTitle">Verkaufsschild erstellen</h2></div>
        <button class="icon-btn" id="closeSalesSignModal" aria-label="Schließen">×</button>
      </div>
      <div class="sales-sign-note">Fahrzeugdaten, Autohaus und Logo werden automatisch übernommen. Du entscheidest nur, ob eine Telefonnummer auf dem Schild erscheinen soll.</div>
      <div class="sales-sign-phone-row">
        <input id="salesSignShowPhone" type="checkbox" />
        <label for="salesSignShowPhone">Telefonnummer auf dem Verkaufsschild anzeigen</label>
      </div>
      <label class="sales-sign-phone-input" id="salesSignPhoneWrap" hidden>Telefonnummer
        <input id="salesSignPhone" type="tel" placeholder="z. B. 07321 123456" />
      </label>
      <div class="modal-actions">
        <button type="button" class="secondary-btn" id="cancelSalesSignBtn">Abbrechen</button>
        <button type="button" class="primary-btn" id="openSalesSignBtn">Verkaufsschild öffnen / PDF</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const showPhone = document.getElementById('salesSignShowPhone');
  const phoneWrap = document.getElementById('salesSignPhoneWrap');
  const phoneInput = document.getElementById('salesSignPhone');

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try {
      const saved = JSON.parse(localStorage.getItem(DEALER_STORAGE_KEY));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function safe(value, fallback = '') {
    const text = String(value ?? '').trim();
    return escapeHtml(text || fallback);
  }

  function openConfigurator(vehicleId) {
    const vehicle = vehicles.find(item => item.id === vehicleId);
    if (!vehicle) return showToast('Fahrzeug wurde nicht gefunden.');
    activeSalesSignVehicleId = vehicle.id;
    const dealer = dealerProfile();
    showPhone.checked = false;
    phoneInput.value = dealer.phone || '';
    phoneWrap.hidden = true;
    openModal(modal);
  }

  function vehiclePower(vehicle) {
    const parts = [];
    if (Number(vehicle.hp) > 0) parts.push(`${formatNumber(vehicle.hp)} PS`);
    if (Number(vehicle.kw) > 0) parts.push(`${formatNumber(vehicle.kw)} kW`);
    return parts.join(' / ');
  }

  function buildFacts(vehicle) {
    const facts = [
      Number(vehicle.mileage) > 0 ? ['Kilometerstand', `${formatNumber(vehicle.mileage)} km`] : null,
      vehiclePower(vehicle) ? ['Leistung', vehiclePower(vehicle)] : null,
      vehicle.firstRegistration ? ['Erstzulassung', formatMonth(vehicle.firstRegistration)] : null,
      vehicle.fuel ? ['Kraftstoff', vehicle.fuel] : null,
      vehicle.transmission ? ['Getriebe', vehicle.transmission] : null,
      vehicle.inspection ? ['HU gültig bis', formatMonth(vehicle.inspection)] : null,
      vehicle.color ? ['Farbe', vehicle.color] : null,
      Number(vehicle.owners) > 0 ? ['Fahrzeughalter', formatNumber(vehicle.owners)] : null,
      vehicle.plate ? ['Kennzeichen', vehicle.plate] : null
    ].filter(Boolean);

    return facts;
  }

  function renderSalesSign(vehicle, dealer, phone) {
    const features = (vehicle.equipment || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 10);
    const facts = buildFacts(vehicle);
    const factClass = facts.length <= 4 ? 'facts facts-wide' : 'facts';
    const brand = dealer.logoData
      ? `<img class="dealer-logo" src="${dealer.logoData}" alt="${safe(dealer.company, 'Autohaus')}" />`
      : `<div class="dealer-name">${safe(dealer.company, 'Autohaus')}</div>`;
    const dealerAddress = [dealer.street, `${dealer.zip || ''} ${dealer.city || ''}`.trim()].filter(Boolean).map(item => safe(item)).join(' · ');
    const contact = phone ? `<div class="phone">☎ ${safe(phone)}</div>` : '';
    const vinLine = vehicle.vin ? `FIN: ${safe(vehicle.vin)}<br>` : '';

    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups für die Vorschau erlauben.');

    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verkaufsschild · ${safe(vehicle.brand)} ${safe(vehicle.model)}</title><style>
      *{box-sizing:border-box} @page{size:A4;margin:0} body{margin:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#12294a}
      .toolbar{width:210mm;margin:12px auto 0;display:flex;justify-content:flex-end}.toolbar button{border:0;border-radius:9px;padding:10px 15px;background:#1687ee;color:#fff;font-weight:700;cursor:pointer}
      .sheet{width:210mm;min-height:297mm;margin:10px auto 24px;background:#fff;padding:14mm 15mm 12mm;display:flex;flex-direction:column}
      .dealer{display:flex;justify-content:space-between;align-items:center;gap:12mm;border-bottom:3px solid #1687ee;padding-bottom:7mm}
      .dealer-logo{max-width:72mm;max-height:20mm;object-fit:contain;object-position:left center}.dealer-name{font-size:25px;font-weight:900;color:#102a50}.dealer-meta{text-align:right;font-size:11px;line-height:1.45;color:#617289;max-width:78mm}.phone{margin-top:3px;color:#102a50;font-weight:800;font-size:14px}
      .headline{margin:11mm 0 2mm;font-size:12px;letter-spacing:.13em;color:#1687ee;font-weight:800;text-transform:uppercase}.model{font-size:36px;line-height:1.06;margin:0 0 5mm;color:#102a50}.price{font-size:50px;line-height:1;font-weight:950;color:#102a50;margin-bottom:9mm}
      .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-bottom:9mm}.facts-wide{grid-template-columns:repeat(2,1fr)}.fact{background:#f3f6fa;border-radius:3mm;padding:5mm}.fact span{display:block;color:#6b7a8e;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1.5mm}.fact b{font-size:18px;line-height:1.25;color:#142c4d}
      .equipment-title{font-size:18px;margin:1mm 0 4mm}.features{display:grid;grid-template-columns:1fr 1fr;gap:2.4mm 7mm;font-size:15px;line-height:1.35}.features div:before{content:'✓';color:#1687ee;font-weight:900;margin-right:7px}.features .empty:before{content:'';margin:0}
      .bottom{margin-top:auto;padding-top:7mm;border-top:1px solid #dde5ee;display:grid;grid-template-columns:1fr auto;gap:4mm 8mm;color:#6a788b;font-size:10px;line-height:1.4}.bottom strong{color:#314762}.disclaimer{grid-column:1/-1;text-align:center;color:#7b8797;font-size:9px;padding-top:2mm}
      @media print{body{background:#fff}.toolbar{display:none}.sheet{margin:0;box-shadow:none;width:210mm;min-height:297mm;padding:12mm 14mm 10mm}}
      @media screen and (max-width:900px){.toolbar,.sheet{width:100%;margin-left:0;margin-right:0}.sheet{min-height:auto;padding:22px}.facts,.facts-wide{grid-template-columns:1fr 1fr}.model{font-size:30px}.price{font-size:42px}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Drucken / als PDF speichern</button></div><main class="sheet">
      <header class="dealer"><div>${brand}</div><div class="dealer-meta">${dealerAddress || ''}${dealer.email ? `<br>${safe(dealer.email)}` : ''}${dealer.website ? `<br>${safe(dealer.website)}` : ''}${contact}</div></header>
      <div class="headline">Fahrzeugangebot</div><h1 class="model">${safe(vehicle.brand)} ${safe(vehicle.model)}</h1><div class="price">${formatCurrency(vehicle.price)}</div>
      ${facts.length ? `<section class="${factClass}">${facts.map(([label, value]) => `<div class="fact"><span>${safe(label)}</span><b>${safe(value)}</b></div>`).join('')}</section>` : ''}
      <h2 class="equipment-title">Ausstattung</h2><section class="features">${features.length ? features.map(item => `<div>${safe(item)}</div>`).join('') : '<div class="empty">Ausstattung auf Anfrage</div>'}</section>
      <footer class="bottom"><div><strong>${safe(dealer.company, 'Autohaus')}</strong>${dealerAddress ? `<br>${dealerAddress}` : ''}</div><div>${vinLine}Stand: ${new Intl.DateTimeFormat('de-DE').format(new Date())}</div><div class="disclaimer">Irrtümer und Zwischenverkauf vorbehalten.</div></footer>
    </main></body></html>`);
    win.document.close();
  }

  showPhone.addEventListener('change', () => {
    phoneWrap.hidden = !showPhone.checked;
    if (showPhone.checked) phoneInput.focus();
  });

  document.getElementById('closeSalesSignModal').addEventListener('click', () => closeModal(modal));
  document.getElementById('cancelSalesSignBtn').addEventListener('click', () => closeModal(modal));
  document.getElementById('openSalesSignBtn').addEventListener('click', () => {
    const vehicle = vehicles.find(item => item.id === activeSalesSignVehicleId);
    if (!vehicle) return showToast('Fahrzeug wurde nicht gefunden.');
    const dealer = dealerProfile();
    const phone = showPhone.checked ? phoneInput.value.trim() : '';
    if (showPhone.checked && !phone) return showToast('Bitte Telefonnummer eintragen oder Anzeige deaktivieren.');
    closeModal(modal);
    renderSalesSign(vehicle, dealer, phone);
  });

  printSalesSign = function(vehicleId) {
    openConfigurator(vehicleId);
  };

  if (!document.querySelector('script[data-fahrfolio-vehicle-photos]')) {
    const script = document.createElement('script');
    script.src = 'vehicle-photos.js';
    script.dataset.fahrfolioVehiclePhotos = 'true';
    document.body.appendChild(script);
  }
})();
