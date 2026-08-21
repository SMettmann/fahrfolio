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

  function fieldValue(id) {
    return document.getElementById(id)?.value || '';
  }

  function fieldChecked(id) {
    return Boolean(document.getElementById(id)?.checked);
  }

  function contractSaleData() {
    return {
      price: Number(fieldValue('contractPrice') || 0),
      mileage: Number(fieldValue('contractMileage') || 0),
      handoverDate: fieldValue('contractDate'),
      place: fieldValue('contractPlace'),
      payment: fieldValue('contractPayment'),
      paymentStatus: fieldValue('contractPaymentStatus'),
      keys: Number(fieldValue('contractKeys') || 0),
      accident: fieldValue('contractAccident'),
      documents: {
        registrationPartI: fieldChecked('contractDocPartI'),
        registrationPartII: fieldChecked('contractDocPartII'),
        huReport: fieldChecked('contractHuReport'),
        coc: fieldChecked('contractCoc')
      },
      defects: fieldValue('contractDefects'),
      accessories: fieldValue('contractAccessories'),
      agreements: fieldValue('contractAgreements')
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
    vehicle.soldAt = contract.createdAt;
    vehicle.buyerId = customer.id;
    vehicle.contractId = contract.id;
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
    const finishedAt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(contract.createdAt));
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');

    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(contract.number)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b49;margin:0;background:#eef2f6;font-size:12px;line-height:1.45}.page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm 16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}
      .signed-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10px;color:#68788d;border-bottom:1px solid #dbe3ed;padding-bottom:8px;margin-bottom:16px}.signed-meta strong{color:#17345f}.contract-paper{border:0!important;box-shadow:none!important;padding:0!important;background:#fff!important}.contract-paper h3{font-size:22px;color:#17345f;margin:16px 0 18px}.contract-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1687ee;padding-bottom:10px}.dealer-contract-brand{display:flex;align-items:center;min-height:42px}.dealer-contract-brand img,.contract-brand img{max-height:54px;max-width:190px;object-fit:contain}.dealer-contract-brand strong{font-size:18px;color:#17345f}.contract-brand>span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#68788d}
      .contract-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.contract-columns>div{border:1px solid #dbe3ed;border-radius:8px;padding:11px 12px;min-height:92px}.contract-columns>div>span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1687ee;margin-bottom:4px}.contract-columns strong{font-size:12px;color:#172b49}.contract-columns p{font-size:10px;color:#5f6f83;line-height:1.5;margin:5px 0 0}
      .contract-section{margin-top:15px;break-inside:avoid}.contract-section-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1687ee;margin-bottom:6px}.contract-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.contract-list>div{background:#f4f7fa;border-radius:7px;padding:8px 9px}.contract-list span{display:block;font-size:8px;color:#6d7b8d;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.contract-list strong{font-size:10px;color:#172b49}.contract-note-box{background:#f8fafc;border:1px solid #dbe3ed;border-radius:7px;padding:9px 10px;font-size:10px;line-height:1.5;color:#536176;white-space:pre-wrap}.contract-confirmation{margin-top:16px;background:#f5f8fc;border-left:3px solid #1687ee;padding:9px 10px;font-size:9px;line-height:1.5;color:#627086}.signature-preview{display:none!important}
      .signed-signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:30px;break-inside:avoid}.signed-signature img{display:block;width:100%;height:78px;object-fit:contain;border-bottom:1px solid #8996a7}.signed-signature strong{display:block;margin-top:5px;font-size:9px;color:#4f6074}.signed-footer{margin-top:22px;padding-top:8px;border-top:1px solid #dbe3ed;font-size:8px;color:#788696}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:white;font-weight:700;font-size:13px;cursor:pointer}
      @page{size:A4;margin:8mm}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.contract-columns,.contract-list,.signed-signatures{grid-template-columns:1fr 1fr!important}.contract-columns{gap:10px}.contract-columns>div{min-height:0;padding:9px 10px}.contract-section{margin-top:11px}.contract-list{gap:5px}.contract-list>div{padding:6px 8px}.contract-note-box{padding:7px 9px}.contract-confirmation{margin-top:11px;padding:7px 9px}.signed-signatures{margin-top:18px;gap:28px}.signed-signature img{height:62px}.contract-section,.signed-signatures,.contract-columns{break-inside:avoid}}
      @media screen and (max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.contract-columns,.contract-list,.signed-signatures{grid-template-columns:1fr}.print-actions{width:auto;margin:12px 18px 24px}}
    </style></head><body><main class="page"><div class="signed-meta"><span><strong>Vertragsnummer:</strong> ${escapeHtml(contract.number)}</span><span><strong>Abgeschlossen:</strong> ${escapeHtml(finishedAt)}</span></div>${contract.contractHtml}<div class="signed-signatures"><div class="signed-signature"><img src="${contract.signatures.seller}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signed-signature"><img src="${contract.signatures.buyer}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div><div class="signed-footer">Fahrfolio-Prototyp · Elektronisch erfasster Vertragsstand. Finale Vertragsbedingungen und der Produktivprozess werden vor Veröffentlichung rechtlich geprüft.</div></main><div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div></body></html>`);
    win.document.close();
  }

  window.openFahrfolioSignedContract = openSignedContract;
  printButton.addEventListener('click', () => openSignedContract(lastSavedContract));

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