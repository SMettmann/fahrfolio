(() => {
  const CONTRACT_STORAGE_KEY = 'fahrfolio-contracts-v1';
  let lastSavedContract = null;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'signature-flow.css';
  document.head.appendChild(stylesheet);

  const signatureModal = document.createElement('div');
  signatureModal.className = 'modal-backdrop';
  signatureModal.id = 'signatureModal';
  signatureModal.setAttribute('aria-hidden', 'true');
  signatureModal.innerHTML = `
    <div class="modal signature-modal" role="dialog" aria-modal="true" aria-labelledby="signatureModalTitle">
      <div class="modal-head">
        <div><p class="eyebrow">KAUFVERTRAG · SCHRITT 4</p><h2 id="signatureModalTitle">Digital unterschreiben</h2></div>
        <button class="icon-btn" id="closeSignatureModal" aria-label="Schließen">×</button>
      </div>
      <div class="signature-intro"><strong>Vertrag geprüft?</strong>Beide Parteien unterschreiben direkt auf dem Display. Nach dem Abschluss wird genau dieser Vertragsstand im Prototyp lokal gespeichert.</div>
      <div class="signature-contract-summary" id="signatureContractSummary"></div>
      <div class="signature-pads">
        <div class="signature-pad-card">
          <div class="signature-pad-head"><strong>Verkäufer unterschreibt</strong><button type="button" data-clear-signature="seller">Neu unterschreiben</button></div>
          <div class="signature-canvas-wrap"><canvas class="signature-canvas" id="sellerSignatureCanvas"></canvas><div class="signature-canvas-hint">Hier mit Finger oder Maus unterschreiben</div></div>
          <div class="signature-status" id="sellerSignatureStatus"><span class="signature-status-dot"></span><span>Noch nicht unterschrieben</span></div>
        </div>
        <div class="signature-pad-card">
          <div class="signature-pad-head"><strong>Käufer unterschreibt</strong><button type="button" data-clear-signature="buyer">Neu unterschreiben</button></div>
          <div class="signature-canvas-wrap"><canvas class="signature-canvas" id="buyerSignatureCanvas"></canvas><div class="signature-canvas-hint">Hier mit Finger oder Maus unterschreiben</div></div>
          <div class="signature-status" id="buyerSignatureStatus"><span class="signature-status-dot"></span><span>Noch nicht unterschrieben</span></div>
        </div>
      </div>
      <p class="signature-legal-note">Prototyp-Hinweis: Die gezeichnete Unterschrift ist eine einfache elektronische Signatur. Vor dem Produktivbetrieb werden Vertragsbedingungen, Nachweisführung und der endgültige Signaturprozess rechtlich geprüft.</p>
      <div class="signature-success" id="signatureSuccess">Vertrag wurde abgeschlossen, lokal gespeichert und das Fahrzeug auf „Verkauft“ gesetzt.</div>
      <div class="modal-actions">
        <button type="button" class="secondary-btn" id="printSignedContractBtn" disabled>Vertrag öffnen / PDF</button>
        <button type="button" class="primary-btn signature-finish" id="finishSignatureBtn" disabled>Vertrag abschließen</button>
      </div>
    </div>`;
  document.body.appendChild(signatureModal);

  const sellerCanvas = document.getElementById('sellerSignatureCanvas');
  const buyerCanvas = document.getElementById('buyerSignatureCanvas');
  const sellerStatus = document.getElementById('sellerSignatureStatus');
  const buyerStatus = document.getElementById('buyerSignatureStatus');
  const finishButton = document.getElementById('finishSignatureBtn');
  const printButton = document.getElementById('printSignedContractBtn');
  const successBox = document.getElementById('signatureSuccess');
  const summary = document.getElementById('signatureContractSummary');

  function loadContracts() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONTRACT_STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveContract(contract) {
    const contracts = loadContracts();
    contracts.unshift(contract);
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(contracts));
  }

  window.getFahrfolioContracts = loadContracts;

  function makePad(canvas, statusElement) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasInk = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#13294a';
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function updateStatus() {
      statusElement.classList.toggle('is-signed', hasInk);
      statusElement.querySelector('span:last-child').textContent = hasInk ? 'Unterschrift erfasst' : 'Noch nicht unterschrieben';
      finishButton.disabled = !(sellerPad?.signed() && buyerPad?.signed());
    }

    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      drawing = true;
      canvas.setPointerCapture?.(event.pointerId);
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drawing) return;
      event.preventDefault();
      const p = point(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasInk = true;
      updateStatus();
    });
    const stop = event => {
      if (!drawing) return;
      drawing = false;
      canvas.releasePointerCapture?.(event.pointerId);
      updateStatus();
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    return {
      reset() {
        resize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
        updateStatus();
      },
      signed() { return hasInk; },
      image() { return hasInk ? canvas.toDataURL('image/png') : ''; }
    };
  }

  let sellerPad = null;
  let buyerPad = null;
  sellerPad = makePad(sellerCanvas, sellerStatus);
  buyerPad = makePad(buyerCanvas, buyerStatus);

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try {
      return JSON.parse(localStorage.getItem('fahrfolio-dealer-profile-v1')) || {};
    } catch (error) {
      return {};
    }
  }

  function selectedVehicle() {
    return vehicles.find(v => v.id === document.getElementById('contractVehicle').value);
  }

  function selectedCustomer() {
    return customers.find(c => c.id === document.getElementById('contractCustomer').value);
  }

  function contractSaleData() {
    return {
      price: Number(document.getElementById('contractPrice').value || 0),
      mileage: Number(document.getElementById('contractMileage').value || 0),
      handoverDate: document.getElementById('contractDate').value || '',
      payment: document.getElementById('contractPayment').value || '',
      keys: Number(document.getElementById('contractKeys').value || 0),
      accident: document.getElementById('contractAccident').value || '',
      defects: document.getElementById('contractDefects').value || '',
      accessories: document.getElementById('contractAccessories').value || '',
      agreements: document.getElementById('contractAgreements').value || ''
    };
  }

  function contractNumber() {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    const suffix = String(now.getTime()).slice(-5);
    return `FF-${stamp}-${suffix}`;
  }

  function openSignatureFlow() {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    if (!vehicle) return showToast('Bitte zuerst ein Fahrzeug auswählen.');
    if (!customer) return showToast('Bitte zuerst einen Käufer auswählen.');
    if (!dealer.company) return showToast('Bitte zuerst die Händlerdaten speichern.');

    const sale = contractSaleData();
    summary.innerHTML = `
      <div><span>Fahrzeug</span><strong>${escapeHtml(`${vehicle.brand} ${vehicle.model}`)}</strong></div>
      <div><span>Käufer</span><strong>${escapeHtml(fullName(customer))}</strong></div>
      <div><span>Kaufpreis</span><strong>${formatCurrency(sale.price)}</strong></div>`;
    successBox.classList.remove('show');
    finishButton.disabled = true;
    finishButton.style.display = '';
    printButton.disabled = true;
    lastSavedContract = null;
    openModal(signatureModal);
    setTimeout(() => {
      sellerPad.reset();
      buyerPad.reset();
    }, 40);
  }

  window.openFahrfolioSignatureFlow = openSignatureFlow;

  document.querySelectorAll('[data-clear-signature]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.clearSignature === 'seller') sellerPad.reset();
      else buyerPad.reset();
    });
  });

  document.getElementById('closeSignatureModal').addEventListener('click', () => closeModal(signatureModal));
  signatureModal.addEventListener('click', event => { if (event.target === signatureModal) closeModal(signatureModal); });

  finishButton.addEventListener('click', () => {
    if (!sellerPad.signed() || !buyerPad.signed()) return showToast('Es fehlen noch beide Unterschriften.');
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    if (!vehicle || !customer || !dealer.company) return;

    const previewPaper = document.querySelector('#contractPreview .contract-paper');
    const contract = {
      id: crypto.randomUUID(),
      number: contractNumber(),
      createdAt: new Date().toISOString(),
      vehicle: { ...vehicle },
      customer: { ...customer },
      dealer: { ...dealer },
      sale: contractSaleData(),
      signatures: {
        seller: sellerPad.image(),
        buyer: buyerPad.image(),
        signedAt: new Date().toISOString()
      },
      contractHtml: previewPaper ? previewPaper.outerHTML : ''
    };

    try {
      saveContract(contract);
    } catch (error) {
      console.error(error);
      showToast('Vertrag konnte lokal nicht gespeichert werden.');
      return;
    }

    vehicle.status = 'sold';
    saveVehicles();
    renderVehicles();
    lastSavedContract = contract;
    successBox.textContent = `Vertrag ${contract.number} wurde lokal gespeichert. Das Fahrzeug steht jetzt auf „Verkauft“.`;
    successBox.classList.add('show');
    finishButton.style.display = 'none';
    printButton.disabled = false;
    closeModal(contractModal);
    showToast('Vertrag abgeschlossen und Fahrzeug verkauft.');
  });

  function openSignedContract(contract) {
    if (!contract) return;
    const sellerName = contract.dealer.company || 'Verkäufer';
    const buyerName = `${contract.customer.firstName || ''} ${contract.customer.lastName || ''}`.trim() || 'Käufer';
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(contract.number)}</title><style>
      body{font-family:Arial,sans-serif;color:#172b49;margin:0;background:#fff}.page{max-width:850px;margin:0 auto;padding:34px;box-sizing:border-box}.contract-paper{border:0!important;box-shadow:none!important;padding:0!important}.contract-brand img{max-height:48px;max-width:180px}.signed-meta{font-size:11px;color:#68788d;margin:12px 0 20px}.signed-signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:28px}.signed-signature img{width:100%;height:90px;object-fit:contain;border-bottom:1px solid #8996a7}.signed-signature strong{display:block;margin-top:5px;font-size:11px}.print-actions{margin:22px 0}.print-actions button{padding:10px 15px;border:0;border-radius:8px;background:#17345f;color:white;font-weight:700}@media print{.print-actions{display:none}.page{padding:12mm}}@media(max-width:650px){.signed-signatures{grid-template-columns:1fr}}
    </style></head><body><main class="page"><div class="signed-meta">Vertragsnummer: ${escapeHtml(contract.number)} · abgeschlossen am ${escapeHtml(new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(contract.createdAt)))}</div>${contract.contractHtml}<div class="signed-signatures"><div class="signed-signature"><img src="${contract.signatures.seller}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signed-signature"><img src="${contract.signatures.buyer}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div><div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div></main></body></html>`);
    win.document.close();
  }

  printButton.addEventListener('click', () => openSignedContract(lastSavedContract));

  // Verkaufsschild mit Händlerbranding: Logo, falls vorhanden, sonst Firmenname.
  printSalesSign = function(id) {
    const vehicle = vehicles.find(v => v.id === id) || vehicles[0];
    if (!vehicle) return showToast('Bitte zuerst ein Fahrzeug anlegen.');
    const dealer = dealerProfile();
    const features = (vehicle.equipment || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
    const logo = dealer.logoData
      ? `<img src="${dealer.logoData}" alt="${escapeHtml(dealer.company || 'Autohaus')}" style="max-width:210px;max-height:68px;object-fit:contain">`
      : `<b>${escapeHtml(dealer.company || 'Fahrzeugangebot')}</b>`;
    const contact = [dealer.phone, dealer.email, dealer.website].filter(Boolean).map(escapeHtml).join(' · ');
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups für die Vorschau erlauben.');
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Verkaufsschild</title><style>
      body{font-family:Arial,sans-serif;margin:0;color:#102a50}.sheet{width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1687ee;padding-bottom:9mm}.brand b{font-size:26px}.tag{text-align:right;font-size:13px;color:#60738c}.model{font-size:42px;margin:20mm 0 3mm}.price{font-size:56px;font-weight:900;color:#0f2b5b;margin-bottom:13mm}.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin-bottom:12mm}.fact{background:#f2f6fb;padding:6mm;border-radius:4mm}.fact span{display:block;color:#6a7a90;font-size:13px}.fact b{font-size:22px}.features{display:grid;grid-template-columns:1fr 1fr;gap:3mm;font-size:17px}.features div:before{content:'✓ ';color:#1687ee;font-weight:bold}.footer{margin-top:18mm;border-top:1px solid #dbe3ed;padding-top:6mm;color:#6a7a90;font-size:12px;line-height:1.5}@media print{button{display:none}.sheet{padding:15mm}}
    </style></head><body><main class="sheet"><div class="brand"><div>${logo}</div><div class="tag">${escapeHtml(dealer.company || 'Fahrzeugangebot')}<br>${escapeHtml(dealer.city || '')}</div></div><h1 class="model">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h1><div class="price">${formatCurrency(vehicle.price)}</div><div class="facts"><div class="fact"><span>Kilometerstand</span><b>${formatNumber(vehicle.mileage)} km</b></div><div class="fact"><span>Leistung</span><b>${vehicle.hp || '—'} PS / ${vehicle.kw || '—'} kW</b></div><div class="fact"><span>Erstzulassung</span><b>${formatMonth(vehicle.firstRegistration)}</b></div><div class="fact"><span>Kraftstoff / Getriebe</span><b>${escapeHtml(vehicle.fuel)} · ${escapeHtml(vehicle.transmission)}</b></div><div class="fact"><span>HU bis</span><b>${formatMonth(vehicle.inspection)}</b></div><div class="fact"><span>Farbe</span><b>${escapeHtml(vehicle.color || '—')}</b></div></div><h2>Ausstattung</h2><div class="features">${features.length ? features.map(f => `<div>${escapeHtml(f)}</div>`).join('') : '<div>Ausstattung auf Anfrage</div>'}</div><div class="footer">${contact ? `${contact}<br>` : ''}FIN: ${escapeHtml(vehicle.vin || '—')} · Angaben ohne Gewähr.</div><br><button onclick="window.print()">Drucken / als PDF speichern</button></main></body></html>`);
    win.document.close();
  };
})();
