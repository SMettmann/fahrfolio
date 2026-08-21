(() => {
  function injectContractExtras() {
    const detailsGrid = document.querySelector('.contract-details-grid');
    if (detailsGrid && !document.getElementById('contractPlace')) {
      detailsGrid.insertAdjacentHTML('beforeend', `
        <label>Vertragsort<input id="contractPlace" placeholder="z. B. Heidenheim" /></label>
        <label>Zahlungsstatus<select id="contractPaymentStatus"><option value="open">Noch offen</option><option value="deposit">Anzahlung erhalten</option><option value="paid">Vollständig bezahlt</option></select></label>`);
    }

    const defectsLabel = document.getElementById('contractDefects')?.closest('label');
    if (defectsLabel && !document.getElementById('contractHandoverDocs')) {
      defectsLabel.insertAdjacentHTML('beforebegin', `
        <div class="contract-handover-box" id="contractHandoverDocs">
          <div class="contract-handover-title"><strong>Unterlagen bei Übergabe</strong><span>Nur markieren, was tatsächlich übergeben wird.</span></div>
          <div class="contract-check-grid">
            <label><input type="checkbox" id="contractDocPartI" /> Zulassungsbescheinigung Teil I</label>
            <label><input type="checkbox" id="contractDocPartII" /> Zulassungsbescheinigung Teil II</label>
            <label><input type="checkbox" id="contractHuReport" /> HU-Bericht</label>
            <label><input type="checkbox" id="contractCoc" /> COC / Übereinstimmungsbescheinigung</label>
          </div>
        </div>`);
    }
  }

  injectContractExtras();

  const ids = [
    'contractPrice','contractMileage','contractDate','contractPayment','contractKeys','contractAccident',
    'contractPlace','contractPaymentStatus','contractDocPartI','contractDocPartII','contractHuReport','contractCoc',
    'contractDefects','contractAccessories','contractAgreements'
  ];
  const fields = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

  function selectedVehicle() {
    return vehicles.find(v => v.id === document.getElementById('contractVehicle').value);
  }
  function selectedCustomer() {
    return customers.find(c => c.id === document.getElementById('contractCustomer').value);
  }
  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try {
      const saved = JSON.parse(localStorage.getItem('fahrfolio-dealer-profile-v1'));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      return {};
    }
  }
  function localToday() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }
  function seedContractFields(vehicle) {
    if (!vehicle) return;
    const dealer = dealerProfile();
    fields.contractPrice.value = Number(vehicle.price || 0);
    fields.contractMileage.value = Number(vehicle.mileage || 0);
    fields.contractDate.value = localToday();
    fields.contractPayment.value = 'Überweisung';
    fields.contractKeys.value = 2;
    fields.contractAccident.value = 'unknown';
    fields.contractPlace.value = dealer.city || '';
    fields.contractPaymentStatus.value = 'open';
    fields.contractDocPartI.checked = false;
    fields.contractDocPartII.checked = false;
    fields.contractHuReport.checked = false;
    fields.contractCoc.checked = false;
    fields.contractDefects.value = vehicle.notes || '';
    fields.contractAccessories.value = '';
    fields.contractAgreements.value = '';
  }
  function accidentText(value) {
    return {
      unknown: 'Keine Angabe hinterlegt',
      'accident-free': 'Laut Angaben unfallfrei',
      accident: 'Unfallschaden bekannt'
    }[value] || 'Keine Angabe hinterlegt';
  }
  function paymentStatusText(value) {
    return {
      open: 'Noch offen',
      deposit: 'Anzahlung erhalten',
      paid: 'Vollständig bezahlt'
    }[value] || 'Noch offen';
  }
  function handoverDocuments() {
    return [
      fields.contractDocPartI.checked ? 'Zulassungsbescheinigung Teil I' : null,
      fields.contractDocPartII.checked ? 'Zulassungsbescheinigung Teil II' : null,
      fields.contractHuReport.checked ? 'HU-Bericht' : null,
      fields.contractCoc.checked ? 'COC / Übereinstimmungsbescheinigung' : null
    ].filter(Boolean);
  }
  function plain(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return escapeHtml(text || fallback);
  }
  function dealerLines(dealer) {
    const address = [dealer.street, `${dealer.zip || ''} ${dealer.city || ''}`.trim()]
      .filter(Boolean)
      .map(value => plain(value, ''))
      .join('<br>');
    const contact = [dealer.contactName, dealer.phone, dealer.email]
      .filter(Boolean)
      .map(value => plain(value, ''))
      .join('<br>');
    return [address, contact].filter(Boolean).join('<br>');
  }
  function customerLines(customer) {
    if (!customer) return '';
    const address = [customer.street, `${customer.zip || ''} ${customer.city || ''}`.trim()].filter(Boolean);
    const details = [
      customer.birthDate ? `Geburtsdatum: ${formatDate(customer.birthDate)}` : '',
      customer.phone ? `Telefon: ${customer.phone}` : '',
      customer.email ? `E-Mail: ${customer.email}` : ''
    ].filter(Boolean);
    return [...address, ...details].map(value => plain(value, '')).join('<br>');
  }
  function dealerBrand(dealer) {
    if (dealer.logoData) return `<img src="${dealer.logoData}" alt="${plain(dealer.company, 'Händlerlogo')}">`;
    return `<strong>${plain(dealer.company, 'Fahrfolio')}</strong>`;
  }

  const originalOpenContract = openContract;

  updateContractPreview = function () {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    const preview = document.getElementById('contractPreview');
    if (!vehicle) {
      preview.innerHTML = '<div class="contract-paper"><strong>Bitte zuerst ein Fahrzeug anlegen.</strong></div>';
      return;
    }

    const price = Number(fields.contractPrice.value || vehicle.price || 0);
    const mileage = Number(fields.contractMileage.value || vehicle.mileage || 0);
    const contractDate = fields.contractDate.value ? formatDate(fields.contractDate.value) : '—';
    const sellerDetails = dealerLines(dealer);
    const buyerDetails = customerLines(customer);
    const documents = handoverDocuments();

    preview.innerHTML = `
      <div class="contract-paper">
        <div class="contract-brand"><div class="dealer-contract-brand">${dealerBrand(dealer)}</div><span>Kaufvertrag · Vorschau</span></div>
        <h3>Fahrzeug-Kaufvertrag</h3>
        <div class="contract-columns">
          <div><span>Verkäufer</span><strong class="${dealer.company ? '' : 'seller-missing'}">${plain(dealer.company, 'Händlerdaten noch nicht hinterlegt')}</strong><p>${sellerDetails || 'Unter „Händlerdaten“ einmalig eintragen.'}</p></div>
          <div><span>Käufer</span><strong>${plain(customer ? fullName(customer) : 'Kunde auswählen')}</strong><p>${buyerDetails || 'Käuferdaten auswählen.'}</p></div>
        </div>

        <div class="contract-section">
          <div class="contract-section-title">Fahrzeug</div>
          <div class="contract-list">
            <div><span>Fahrzeug</span><strong>${plain(`${vehicle.brand} ${vehicle.model}`)}</strong></div>
            <div><span>FIN (Fahrgestellnummer)</span><strong>${plain(vehicle.vin)}</strong></div>
            <div><span>Erstzulassung</span><strong>${plain(formatMonth(vehicle.firstRegistration))}</strong></div>
            <div><span>Kennzeichen</span><strong>${plain(vehicle.plate)}</strong></div>
            <div><span>Kilometerstand bei Übergabe</span><strong>${formatNumber(mileage)} km</strong></div>
            <div><span>Leistung</span><strong>${plain(vehicle.hp || '—')} PS / ${plain(vehicle.kw || '—')} kW</strong></div>
            <div><span>Kraftstoff</span><strong>${plain(vehicle.fuel)}</strong></div>
            <div><span>Getriebe</span><strong>${plain(vehicle.transmission)}</strong></div>
          </div>
        </div>

        <div class="contract-section">
          <div class="contract-section-title">Verkauf & Übergabe</div>
          <div class="contract-list">
            <div><span>Kaufpreis</span><strong>${formatCurrency(price)}</strong></div>
            <div><span>Übergabedatum</span><strong>${plain(contractDate)}</strong></div>
            <div><span>Vertragsort</span><strong>${plain(fields.contractPlace.value)}</strong></div>
            <div><span>Zahlungsart</span><strong>${plain(fields.contractPayment.value)}</strong></div>
            <div><span>Zahlungsstatus</span><strong>${plain(paymentStatusText(fields.contractPaymentStatus.value))}</strong></div>
            <div><span>Anzahl Schlüssel</span><strong>${plain(fields.contractKeys.value)}</strong></div>
            <div><span>Unfallangabe</span><strong>${plain(accidentText(fields.contractAccident.value))}</strong></div>
            <div><span>HU gültig bis</span><strong>${plain(formatMonth(vehicle.inspection))}</strong></div>
          </div>
        </div>

        <div class="contract-section">
          <div class="contract-section-title">Übergebene Unterlagen</div>
          <div class="contract-note-box">${documents.length ? documents.map(item => `✓ ${plain(item)}`).join('<br>') : 'Noch keine Unterlagen als übergeben markiert.'}</div>
        </div>
        <div class="contract-section">
          <div class="contract-section-title">Bekannte Mängel / Schäden</div>
          <div class="contract-note-box">${plain(fields.contractDefects.value, 'Keine Angaben hinterlegt.')}</div>
        </div>
        <div class="contract-section">
          <div class="contract-section-title">Mitverkauftes Zubehör</div>
          <div class="contract-note-box">${plain(fields.contractAccessories.value, 'Kein zusätzliches Zubehör eingetragen.')}</div>
        </div>
        <div class="contract-section">
          <div class="contract-section-title">Weitere Vereinbarungen</div>
          <div class="contract-note-box">${plain(fields.contractAgreements.value, 'Keine zusätzlichen Vereinbarungen eingetragen.')}</div>
        </div>

        <div class="contract-confirmation">Die oben erfassten Angaben bilden den dokumentierten Stand des Verkaufs im Fahrfolio-Prototyp. Finale Vertragsbedingungen und gesetzlich erforderliche Klauseln werden vor dem Produktivbetrieb rechtlich geprüft.</div>
        <div class="signature-preview"><div class="signature-line">Ort, Datum · Verkäufer</div><div class="signature-line">Ort, Datum · Käufer</div></div>
      </div>`;
  };

  openContract = function (vehicleId = null, customerId = null) {
    originalOpenContract(vehicleId, customerId);
    seedContractFields(selectedVehicle());
    updateContractPreview();
  };

  document.getElementById('contractVehicle').addEventListener('change', () => {
    seedContractFields(selectedVehicle());
    updateContractPreview();
  });
  document.getElementById('contractCustomer').addEventListener('change', updateContractPreview);
  Object.values(fields).filter(Boolean).forEach(field => {
    field.addEventListener('input', updateContractPreview);
    field.addEventListener('change', updateContractPreview);
  });
  window.addEventListener('fahrfolio:dealer-profile-changed', updateContractPreview);

  function ensureSignatureFlow(callback) {
    if (typeof window.openFahrfolioSignatureFlow === 'function') return callback();
    const existing = document.querySelector('script[data-fahrfolio-signature-flow]');
    if (existing) {
      existing.addEventListener('load', callback, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'signature-flow.js';
    script.dataset.fahrfolioSignatureFlow = 'true';
    script.addEventListener('load', callback, { once: true });
    document.body.appendChild(script);
  }

  const oldContinue = document.getElementById('continueContractBtn');
  const continueButton = oldContinue.cloneNode(true);
  oldContinue.replaceWith(continueButton);
  continueButton.addEventListener('click', () => {
    ensureSignatureFlow(() => window.openFahrfolioSignatureFlow());
  });

  const documentsNav = document.querySelector('.nav-item[data-view="documents"]');
  if (documentsNav) documentsNav.remove();
  const documentsView = document.getElementById('documentsView');
  if (documentsView) documentsView.remove();

  if (!document.querySelector('script[data-fahrfolio-dealer-profile]')) {
    const script = document.createElement('script');
    script.src = 'dealer-profile.js';
    script.dataset.fahrfolioDealerProfile = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-fahrfolio-signature-flow]')) {
    const script = document.createElement('script');
    script.src = 'signature-flow.js';
    script.dataset.fahrfolioSignatureFlow = 'true';
    document.body.appendChild(script);
  }
})();
