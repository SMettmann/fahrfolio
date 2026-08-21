(() => {
  const PURCHASE_STORAGE_KEY = 'fahrfolio-purchases-v1';
  let lastPurchase = null;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'purchase-flow.css';
  document.head.appendChild(stylesheet);

  function readPurchases() {
    try {
      const value = JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function savePurchases(list) {
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(list));
  }

  window.getFahrfolioPurchases = readPurchases;

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try {
      return JSON.parse(localStorage.getItem('fahrfolio-dealer-profile-v1')) || {};
    } catch (error) {
      return {};
    }
  }

  function today() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function purchaseNumber() {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    return `ANK-${stamp}-${String(now.getTime()).slice(-5)}`;
  }

  function dealerName(dealer) {
    return dealer.company || 'Händlerdaten fehlen';
  }

  function dealerAddress(dealer) {
    return [dealer.street, `${dealer.zip || ''} ${dealer.city || ''}`.trim()].filter(Boolean).join(', ');
  }

  const navReference = document.querySelector('.nav-item[data-view="vehicles"]');
  const purchaseNav = document.createElement('button');
  purchaseNav.className = 'nav-item';
  purchaseNav.dataset.view = 'purchase';
  purchaseNav.innerHTML = '<span>↙</span>Ankauf';
  if (navReference) navReference.insertAdjacentElement('afterend', purchaseNav);

  const purchaseView = document.createElement('section');
  purchaseView.id = 'purchaseView';
  purchaseView.className = 'view';
  purchaseView.innerHTML = `
    <div class="purchase-hero">
      <div>
        <p class="eyebrow">ANKAUF</p>
        <h2>Fahrzeug ankaufen und direkt übernehmen.</h2>
        <p>Verkäufer und Fahrzeug einmal erfassen, Vertrag unterschreiben und danach steht das Fahrzeug sofort im Bestand.</p>
      </div>
      <button class="primary-btn" id="startPurchaseBtn">+ Ankauf starten</button>
    </div>
    <div class="section-head purchase-list-head"><div><p class="eyebrow">ABGESCHLOSSEN</p><h2>Letzte Ankäufe</h2></div></div>
    <div id="purchaseList" class="purchase-list"></div>`;

  const main = document.querySelector('.main');
  const customerView = document.getElementById('customersView');
  if (main) {
    if (customerView) main.insertBefore(purchaseView, customerView);
    else main.appendChild(purchaseView);
  }

  if (typeof views === 'object' && views) views.purchase = purchaseView;
  if (typeof titles === 'object' && titles) titles.purchase = 'Ankauf';

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'purchaseModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchaseModalTitle">
      <div class="modal-head">
        <div><p class="eyebrow">ANKAUF</p><h2 id="purchaseModalTitle">Fahrzeug ankaufen</h2></div>
        <button class="icon-btn" type="button" id="closePurchaseModal" aria-label="Schließen">×</button>
      </div>
      <div class="workflow-note"><strong>Einfacher Ablauf:</strong> Verkäufer → Fahrzeug → Übergabe → unterschreiben → automatisch in den Bestand.</div>
      <form id="purchaseForm">
        <div class="contract-step-title"><span>1</span><div><strong>Verkäufer</strong><small>Von wem wird das Fahrzeug angekauft?</small></div></div>
        <div class="form-grid two-cols">
          <label>Name / Firma*<input name="sellerName" required placeholder="z. B. Max Mustermann" /></label>
          <label>Telefon<input name="sellerPhone" type="tel" /></label>
          <label>Straße / Hausnummer<input name="sellerStreet" /></label>
          <label>PLZ / Ort<div class="purchase-inline-fields"><input name="sellerZip" placeholder="89522" /><input name="sellerCity" placeholder="Heidenheim" /></div></label>
          <label>E-Mail<input name="sellerEmail" type="email" /></label>
        </div>

        <div class="contract-step-title"><span>2</span><div><strong>Fahrzeug</strong><small>Nur die Daten, die beim Ankauf schon bekannt sind.</small></div></div>
        <div class="form-grid">
          <label>Marke*<input name="brand" required placeholder="z. B. Volkswagen" /></label>
          <label>Modell*<input name="model" required placeholder="z. B. Golf 1.5 TSI" /></label>
          <label>FIN (Fahrgestellnummer)<input name="vin" maxlength="17" /></label>
          <label>Kennzeichen<input name="plate" /></label>
          <label>Erstzulassung<input name="firstRegistration" type="month" /></label>
          <label>Kilometerstand*<input name="mileage" type="number" min="0" required /></label>
          <label>Leistung in PS<input name="hp" type="number" min="0" /></label>
          <label>Leistung in kW<input name="kw" type="number" min="0" /></label>
          <label>Kraftstoff<select name="fuel"><option>Benzin</option><option>Diesel</option><option>Hybrid</option><option>Elektro</option><option>LPG</option><option>Sonstige</option></select></label>
          <label>Getriebe<select name="transmission"><option>Automatik</option><option>Schaltgetriebe</option></select></label>
          <label>HU gültig bis<input name="inspection" type="month" /></label>
          <label>Anzahl Fahrzeughalter<input name="owners" type="number" min="0" /></label>
          <label>Farbe<input name="color" /></label>
        </div>

        <div class="contract-step-title"><span>3</span><div><strong>Ankauf & Übergabe</strong><small>Preis, Unterlagen und bekannte Schäden festhalten.</small></div></div>
        <div class="form-grid">
          <label>Ankaufspreis (€)*<input name="purchasePrice" type="number" min="1" step="50" required /></label>
          <label>Geplanter Verkaufspreis (€)<input name="price" type="number" min="0" step="50" placeholder="optional" /></label>
          <label>Übergabedatum*<input name="handoverDate" type="date" required /></label>
          <label>Zahlungsart<select name="payment"><option>Überweisung</option><option>Barzahlung</option><option>Sonstige</option></select></label>
          <label>Anzahl Schlüssel<input name="keys" type="number" min="0" value="2" /></label>
        </div>
        <div class="purchase-docs">
          <strong>Übergebene Unterlagen</strong>
          <div class="contract-check-grid">
            <label><input type="checkbox" name="docPartI" /> Zulassungsbescheinigung Teil I</label>
            <label><input type="checkbox" name="docPartII" /> Zulassungsbescheinigung Teil II</label>
            <label><input type="checkbox" name="huReport" /> HU-Bericht</label>
            <label><input type="checkbox" name="coc" /> COC / Übereinstimmungsbescheinigung</label>
          </div>
        </div>
        <label class="full-field">Bekannte Mängel / Schäden<textarea name="defects" rows="3" placeholder="z. B. Kratzer Stoßfänger hinten rechts …"></textarea></label>
        <label class="full-field">Weitere Vereinbarungen<textarea name="agreements" rows="2" placeholder="Nur falls etwas zusätzlich vereinbart wurde."></textarea></label>

        <div class="contract-step-title"><span>4</span><div><strong>Prüfen & unterschreiben</strong><small>Beide Parteien unterschreiben direkt auf dem Display.</small></div></div>
        <div id="purchasePreview" class="purchase-preview"></div>
        <div class="purchase-signatures">
          <div class="signature-pad-card">
            <div class="signature-pad-head"><strong>Händler unterschreibt</strong><button type="button" data-purchase-clear="dealer">Neu unterschreiben</button></div>
            <div class="signature-canvas-wrap"><canvas class="signature-canvas" id="purchaseDealerSignature"></canvas><div class="signature-canvas-hint">Hier mit Finger oder Maus unterschreiben</div></div>
            <div class="signature-status" id="purchaseDealerStatus"><span class="signature-status-dot"></span><span>Noch nicht unterschrieben</span></div>
          </div>
          <div class="signature-pad-card">
            <div class="signature-pad-head"><strong>Verkäufer unterschreibt</strong><button type="button" data-purchase-clear="seller">Neu unterschreiben</button></div>
            <div class="signature-canvas-wrap"><canvas class="signature-canvas" id="purchaseSellerSignature"></canvas><div class="signature-canvas-hint">Hier mit Finger oder Maus unterschreiben</div></div>
            <div class="signature-status" id="purchaseSellerStatus"><span class="signature-status-dot"></span><span>Noch nicht unterschrieben</span></div>
          </div>
        </div>
        <p class="signature-legal-note">Prototyp-Hinweis: Vertragsbedingungen, gesetzliche Pflichtangaben und der endgültige Signaturprozess werden vor dem Produktivbetrieb rechtlich geprüft.</p>
        <div class="signature-success" id="purchaseSuccess"></div>
        <div class="modal-actions purchase-actions">
          <button type="button" class="secondary-btn" id="purchasePreviewBtn" disabled>Vertrag prüfen / PDF</button>
          <button type="button" class="secondary-btn" id="purchaseDoneBtn" hidden>Fertig</button>
          <button type="submit" class="primary-btn" id="finishPurchaseBtn" disabled>Ankauf abschließen & in Bestand</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const form = document.getElementById('purchaseForm');
  const preview = document.getElementById('purchasePreview');
  const finishButton = document.getElementById('finishPurchaseBtn');
  const previewButton = document.getElementById('purchasePreviewBtn');
  const doneButton = document.getElementById('purchaseDoneBtn');
  const successBox = document.getElementById('purchaseSuccess');
  const dealerCanvas = document.getElementById('purchaseDealerSignature');
  const sellerCanvas = document.getElementById('purchaseSellerSignature');
  const dealerStatus = document.getElementById('purchaseDealerStatus');
  const sellerStatus = document.getElementById('purchaseSellerStatus');

  function field(name) {
    return form.elements[name];
  }

  function formData() {
    return {
      seller: {
        name: field('sellerName').value.trim(),
        street: field('sellerStreet').value.trim(),
        zip: field('sellerZip').value.trim(),
        city: field('sellerCity').value.trim(),
        phone: field('sellerPhone').value.trim(),
        email: field('sellerEmail').value.trim()
      },
      vehicle: {
        brand: field('brand').value.trim(),
        model: field('model').value.trim(),
        vin: field('vin').value.trim().toUpperCase(),
        plate: field('plate').value.trim().toUpperCase(),
        firstRegistration: field('firstRegistration').value,
        mileage: Number(field('mileage').value || 0),
        hp: Number(field('hp').value || 0),
        kw: Number(field('kw').value || 0),
        fuel: field('fuel').value,
        transmission: field('transmission').value,
        inspection: field('inspection').value,
        owners: Number(field('owners').value || 0),
        color: field('color').value.trim()
      },
      purchase: {
        price: Number(field('purchasePrice').value || 0),
        plannedSalePrice: Number(field('price').value || 0),
        handoverDate: field('handoverDate').value,
        payment: field('payment').value,
        keys: Number(field('keys').value || 0),
        documents: {
          registrationPartI: field('docPartI').checked,
          registrationPartII: field('docPartII').checked,
          huReport: field('huReport').checked,
          coc: field('coc').checked
        },
        defects: field('defects').value.trim(),
        agreements: field('agreements').value.trim()
      }
    };
  }

  function documentLabels(documents) {
    return [
      documents.registrationPartI ? 'Zulassungsbescheinigung Teil I' : null,
      documents.registrationPartII ? 'Zulassungsbescheinigung Teil II' : null,
      documents.huReport ? 'HU-Bericht' : null,
      documents.coc ? 'COC / Übereinstimmungsbescheinigung' : null
    ].filter(Boolean);
  }

  function updatePreview() {
    const data = formData();
    const dealer = dealerProfile();
    const documents = documentLabels(data.purchase.documents);
    preview.innerHTML = `
      <div class="purchase-preview-head"><span>Ankaufsvertrag · Vorschau</span><strong>${escapeHtml(data.vehicle.brand || 'Fahrzeug')} ${escapeHtml(data.vehicle.model || '')}</strong></div>
      <div class="purchase-preview-grid">
        <div><span>Händler / Käufer</span><strong>${escapeHtml(dealerName(dealer))}</strong><small>${escapeHtml(dealerAddress(dealer) || 'Händleradresse nicht hinterlegt')}</small></div>
        <div><span>Verkäufer</span><strong>${escapeHtml(data.seller.name || 'Noch nicht eingetragen')}</strong><small>${escapeHtml([data.seller.street, `${data.seller.zip} ${data.seller.city}`.trim()].filter(Boolean).join(', ') || 'Adresse noch nicht eingetragen')}</small></div>
        <div><span>Ankaufspreis</span><strong>${formatCurrency(data.purchase.price)}</strong><small>Übergabe ${formatDate(data.purchase.handoverDate)}</small></div>
        <div><span>Fahrzeug</span><strong>${escapeHtml(`${data.vehicle.brand || '—'} ${data.vehicle.model || ''}`.trim())}</strong><small>${formatNumber(data.vehicle.mileage)} km · FIN ${escapeHtml(data.vehicle.vin || '—')}</small></div>
      </div>
      <div class="purchase-preview-note"><strong>Bekannte Mängel / Schäden:</strong> ${escapeHtml(data.purchase.defects || 'Keine Angaben hinterlegt.')}</div>
      <div class="purchase-preview-note"><strong>Übergebene Unterlagen:</strong> ${documents.length ? documents.map(escapeHtml).join(', ') : 'Noch keine markiert.'}</div>`;
  }

  function makePad(canvas, statusElement) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let signed = false;

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

    function update() {
      statusElement.classList.toggle('is-signed', signed);
      statusElement.querySelector('span:last-child').textContent = signed ? 'Unterschrift erfasst' : 'Noch nicht unterschrieben';
      updateActions();
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
      signed = true;
      update();
    });
    const stop = event => {
      if (!drawing) return;
      drawing = false;
      canvas.releasePointerCapture?.(event.pointerId);
      update();
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    return {
      reset() {
        resize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        signed = false;
        update();
      },
      signed() { return signed; },
      image() { return signed ? canvas.toDataURL('image/png') : ''; }
    };
  }

  let dealerPad = null;
  let sellerPad = null;

  function updateActions() {
    const complete = Boolean(dealerPad?.signed() && sellerPad?.signed());
    previewButton.disabled = !complete;
    finishButton.disabled = !complete;
  }

  dealerPad = makePad(dealerCanvas, dealerStatus);
  sellerPad = makePad(sellerCanvas, sellerStatus);

  function buildContractHtml(purchase, previewMode = false) {
    const dealer = purchase.dealer;
    const seller = purchase.seller;
    const vehicle = purchase.vehicle;
    const p = purchase.purchase;
    const documents = documentLabels(p.documents);
    const sellerAddress = [seller.street, `${seller.zip || ''} ${seller.city || ''}`.trim()].filter(Boolean).map(escapeHtml).join('<br>');
    const dealerAddressText = [dealer.street, `${dealer.zip || ''} ${dealer.city || ''}`.trim()].filter(Boolean).map(escapeHtml).join('<br>');
    const meta = previewMode
      ? '<span><strong>Vorschau</strong> · noch nicht abgeschlossen</span>'
      : `<span><strong>Vertragsnummer:</strong> ${escapeHtml(purchase.number)}</span><span><strong>Abgeschlossen:</strong> ${escapeHtml(new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(purchase.createdAt)))}</span>`;
    return `
      <div class="purchase-document">
        <div class="purchase-doc-meta">${meta}</div>
        <div class="purchase-doc-brand">${dealer.logoData ? `<img src="${dealer.logoData}" alt="Händlerlogo">` : `<strong>${escapeHtml(dealerName(dealer))}</strong>`}<span>Ankaufsvertrag</span></div>
        <h1>Fahrzeug-Ankaufsvertrag</h1>
        <div class="purchase-doc-columns">
          <div><span>Käufer / Händler</span><strong>${escapeHtml(dealerName(dealer))}</strong><p>${dealerAddressText || '—'}${dealer.contactName ? `<br>${escapeHtml(dealer.contactName)}` : ''}</p></div>
          <div><span>Verkäufer</span><strong>${escapeHtml(seller.name)}</strong><p>${sellerAddress || '—'}${seller.phone ? `<br>Tel.: ${escapeHtml(seller.phone)}` : ''}${seller.email ? `<br>${escapeHtml(seller.email)}` : ''}</p></div>
        </div>
        <div class="purchase-doc-section"><h2>Fahrzeug</h2><div class="purchase-doc-grid">
          <div><span>Fahrzeug</span><strong>${escapeHtml(`${vehicle.brand} ${vehicle.model}`)}</strong></div>
          <div><span>FIN</span><strong>${escapeHtml(vehicle.vin || '—')}</strong></div>
          <div><span>Kennzeichen</span><strong>${escapeHtml(vehicle.plate || '—')}</strong></div>
          <div><span>Erstzulassung</span><strong>${escapeHtml(formatMonth(vehicle.firstRegistration))}</strong></div>
          <div><span>Kilometerstand</span><strong>${formatNumber(vehicle.mileage)} km</strong></div>
          <div><span>Leistung</span><strong>${vehicle.hp || '—'} PS / ${vehicle.kw || '—'} kW</strong></div>
          <div><span>Kraftstoff</span><strong>${escapeHtml(vehicle.fuel || '—')}</strong></div>
          <div><span>Getriebe</span><strong>${escapeHtml(vehicle.transmission || '—')}</strong></div>
          <div><span>HU bis</span><strong>${escapeHtml(formatMonth(vehicle.inspection))}</strong></div>
          <div><span>Farbe</span><strong>${escapeHtml(vehicle.color || '—')}</strong></div>
        </div></div>
        <div class="purchase-doc-section"><h2>Ankauf & Übergabe</h2><div class="purchase-doc-grid">
          <div><span>Ankaufspreis</span><strong>${formatCurrency(p.price)}</strong></div>
          <div><span>Übergabedatum</span><strong>${escapeHtml(formatDate(p.handoverDate))}</strong></div>
          <div><span>Zahlungsart</span><strong>${escapeHtml(p.payment)}</strong></div>
          <div><span>Anzahl Schlüssel</span><strong>${p.keys}</strong></div>
        </div></div>
        <div class="purchase-doc-section"><h2>Übergebene Unterlagen</h2><div class="purchase-doc-note">${documents.length ? documents.map(item => `✓ ${escapeHtml(item)}`).join('<br>') : 'Keine Unterlagen als übergeben markiert.'}</div></div>
        <div class="purchase-doc-section"><h2>Bekannte Mängel / Schäden</h2><div class="purchase-doc-note">${escapeHtml(p.defects || 'Keine Angaben hinterlegt.')}</div></div>
        <div class="purchase-doc-section"><h2>Weitere Vereinbarungen</h2><div class="purchase-doc-note">${escapeHtml(p.agreements || 'Keine zusätzlichen Vereinbarungen eingetragen.')}</div></div>
        <div class="purchase-doc-legal">Prototyp: Finale Vertragsbedingungen, gesetzlich erforderliche Angaben und der Signaturprozess werden vor dem Produktivbetrieb rechtlich geprüft.</div>
        <div class="purchase-doc-signatures">
          <div><img src="${purchase.signatures.dealer}" alt="Unterschrift Händler"><strong>${escapeHtml(dealerName(dealer))} · Käufer/Händler</strong></div>
          <div><img src="${purchase.signatures.seller}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(seller.name)} · Verkäufer</strong></div>
        </div>
      </div>`;
  }

  function openPurchaseDocument(purchase, previewMode = false) {
    if (!purchase) return;
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');
    const html = buildContractHtml(purchase, previewMode);
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${previewMode ? 'Ankaufsvertrag Vorschau' : escapeHtml(purchase.number)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172b49;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45}.page{width:210mm;min-height:297mm;background:#fff;margin:18px auto;padding:15mm 16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}.purchase-doc-meta{display:flex;justify-content:space-between;gap:12px;color:#68788d;font-size:10px;border-bottom:1px solid #dbe3ed;padding-bottom:8px;margin-bottom:14px}.purchase-doc-brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1687ee;padding-bottom:10px}.purchase-doc-brand img{max-height:54px;max-width:190px;object-fit:contain}.purchase-doc-brand>strong{font-size:18px}.purchase-doc-brand>span{text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#68788d}.purchase-document h1{font-size:22px;margin:16px 0 18px}.purchase-doc-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.purchase-doc-columns>div{border:1px solid #dbe3ed;border-radius:8px;padding:11px 12px}.purchase-doc-columns span,.purchase-doc-section h2,.purchase-doc-grid span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1687ee;margin:0 0 4px}.purchase-doc-columns p{font-size:10px;color:#5f6f83;margin:5px 0 0}.purchase-doc-section{margin-top:15px;break-inside:avoid}.purchase-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.purchase-doc-grid>div{background:#f4f7fa;border-radius:7px;padding:8px 9px}.purchase-doc-grid strong{font-size:10px}.purchase-doc-note{background:#f8fafc;border:1px solid #dbe3ed;border-radius:7px;padding:9px 10px;font-size:10px;white-space:pre-wrap}.purchase-doc-legal{margin-top:16px;background:#f5f8fc;border-left:3px solid #1687ee;padding:9px 10px;font-size:9px;color:#627086}.purchase-doc-signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:28px;break-inside:avoid}.purchase-doc-signatures img{display:block;width:100%;height:72px;object-fit:contain;border-bottom:1px solid #8996a7}.purchase-doc-signatures strong{display:block;margin-top:5px;font-size:9px}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:#fff;font-weight:700;cursor:pointer}@page{size:A4;margin:8mm}@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.purchase-doc-columns,.purchase-doc-grid,.purchase-doc-signatures{grid-template-columns:1fr 1fr!important}.purchase-doc-section,.purchase-doc-signatures{break-inside:avoid}}@media(max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.purchase-doc-columns,.purchase-doc-grid,.purchase-doc-signatures{grid-template-columns:1fr}.print-actions{width:auto;margin:12px 18px 24px}}
    </style></head><body><main class="page">${html}</main><div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div></body></html>`);
    win.document.close();
  }

  function currentDraftPurchase() {
    const data = formData();
    return {
      id: '',
      number: 'VORSCHAU',
      createdAt: new Date().toISOString(),
      dealer: { ...dealerProfile() },
      seller: { ...data.seller },
      vehicle: { ...data.vehicle },
      purchase: { ...data.purchase, documents: { ...data.purchase.documents } },
      signatures: { dealer: dealerPad.image(), seller: sellerPad.image() }
    };
  }

  function validatePurchase() {
    if (!form.reportValidity()) return false;
    const data = formData();
    if (data.purchase.price <= 0) {
      showToast('Bitte einen Ankaufspreis eintragen.');
      return false;
    }
    if (data.vehicle.vin && vehicles.some(vehicle => String(vehicle.vin || '').toUpperCase() === data.vehicle.vin.toUpperCase())) {
      showToast('Ein Fahrzeug mit dieser FIN ist bereits im Bestand.');
      return false;
    }
    if (!dealerPad.signed() || !sellerPad.signed()) {
      showToast('Es fehlen noch beide Unterschriften.');
      return false;
    }
    return true;
  }

  function completePurchase() {
    if (!validatePurchase()) return;
    const data = formData();
    const dealer = dealerProfile();
    const vehicleId = crypto.randomUUID();
    const purchase = {
      id: crypto.randomUUID(),
      number: purchaseNumber(),
      createdAt: new Date().toISOString(),
      dealer: { ...dealer },
      seller: { ...data.seller },
      vehicle: { ...data.vehicle, id: vehicleId },
      purchase: { ...data.purchase, documents: { ...data.purchase.documents } },
      signatures: {
        dealer: dealerPad.image(),
        seller: sellerPad.image(),
        signedAt: new Date().toISOString()
      }
    };

    const purchasedVehicle = {
      id: vehicleId,
      brand: data.vehicle.brand,
      model: data.vehicle.model,
      vin: data.vehicle.vin,
      plate: data.vehicle.plate,
      firstRegistration: data.vehicle.firstRegistration,
      mileage: data.vehicle.mileage,
      hp: data.vehicle.hp,
      kw: data.vehicle.kw,
      fuel: data.vehicle.fuel,
      transmission: data.vehicle.transmission,
      inspection: data.vehicle.inspection,
      owners: data.vehicle.owners,
      price: data.purchase.plannedSalePrice,
      purchasePrice: data.purchase.price,
      status: 'stock',
      color: data.vehicle.color,
      equipment: '',
      notes: data.purchase.defects,
      acquiredAt: purchase.createdAt,
      purchaseContractId: purchase.id
    };

    const purchases = readPurchases();
    purchases.unshift(purchase);
    try {
      savePurchases(purchases);
      vehicles.unshift(purchasedVehicle);
      saveVehicles();
    } catch (error) {
      console.error(error);
      showToast('Ankauf konnte lokal nicht gespeichert werden.');
      return;
    }

    renderVehicles();
    renderPurchases();
    lastPurchase = purchase;
    successBox.textContent = `${purchase.number} gespeichert. ${purchasedVehicle.brand} ${purchasedVehicle.model} wurde in den Bestand übernommen.`;
    successBox.classList.add('show');
    finishButton.hidden = true;
    previewButton.textContent = 'Ankaufsvertrag öffnen / PDF';
    doneButton.hidden = false;
    showToast('Ankauf abgeschlossen und Fahrzeug übernommen.');
  }

  function renderPurchases() {
    const list = document.getElementById('purchaseList');
    if (!list) return;
    const purchases = readPurchases();
    if (!purchases.length) {
      list.innerHTML = '<div class="no-results"><strong>Noch kein Ankauf abgeschlossen.</strong><br>Mit „Ankauf starten“ wird der erste Ankaufsvertrag erstellt.</div>';
      return;
    }
    list.innerHTML = purchases.slice(0, 8).map(purchase => `
      <article class="purchase-card" data-purchase-id="${purchase.id}">
        <div><span>${escapeHtml(purchase.number)}</span><h3>${escapeHtml(`${purchase.vehicle.brand} ${purchase.vehicle.model}`)}</h3><p>${escapeHtml(purchase.seller.name)} · ${formatDate(purchase.purchase.handoverDate)}</p></div>
        <div class="purchase-card-price"><strong>${formatCurrency(purchase.purchase.price)}</strong><button class="secondary-btn purchase-open-contract" type="button">Vertrag öffnen</button></div>
      </article>`).join('');
    list.querySelectorAll('.purchase-open-contract').forEach(button => button.addEventListener('click', () => {
      const id = button.closest('[data-purchase-id]').dataset.purchaseId;
      openPurchaseDocument(purchases.find(item => item.id === id));
    }));
  }

  function openPurchase() {
    const dealer = dealerProfile();
    if (!dealer.company) {
      showToast('Bitte zuerst die Händlerdaten speichern.');
      return;
    }
    form.reset();
    field('handoverDate').value = today();
    field('keys').value = 2;
    field('payment').value = 'Überweisung';
    successBox.classList.remove('show');
    successBox.textContent = '';
    finishButton.hidden = false;
    doneButton.hidden = true;
    previewButton.textContent = 'Vertrag prüfen / PDF';
    lastPurchase = null;
    updatePreview();
    openModal(modal);
    setTimeout(() => {
      dealerPad.reset();
      sellerPad.reset();
      field('sellerName').focus();
    }, 50);
  }

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    completePurchase();
  });

  previewButton.addEventListener('click', () => {
    if (lastPurchase) return openPurchaseDocument(lastPurchase);
    if (!validatePurchase()) return;
    openPurchaseDocument(currentDraftPurchase(), true);
  });

  doneButton.addEventListener('click', () => {
    closeModal(modal);
    setView('vehicles');
    document.getElementById('openVehicleModal').hidden = false;
  });

  document.getElementById('closePurchaseModal').addEventListener('click', () => closeModal(modal));
  document.querySelectorAll('[data-purchase-clear]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.purchaseClear === 'dealer') dealerPad.reset();
    else sellerPad.reset();
  }));
  document.getElementById('startPurchaseBtn').addEventListener('click', openPurchase);

  purchaseNav.addEventListener('click', () => {
    setView('purchase');
    renderPurchases();
    document.getElementById('openVehicleModal').hidden = true;
  });
  document.querySelectorAll('.nav-item:not([data-view="purchase"])').forEach(button => button.addEventListener('click', () => {
    document.getElementById('openVehicleModal').hidden = false;
  }));

  const originalOpenVehicleDetail = openVehicleDetail;
  openVehicleDetail = function(id) {
    originalOpenVehicleDetail(id);
    const vehicle = vehicles.find(item => item.id === id);
    if (!vehicle?.purchaseContractId) return;
    const purchase = readPurchases().find(item => item.id === vehicle.purchaseContractId);
    if (!purchase) return;
    const content = document.getElementById('vehicleDetailContent');
    if (!content || content.querySelector('.purchase-detail-section')) return;
    const section = document.createElement('div');
    section.className = 'detail-section purchase-detail-section';
    section.innerHTML = `<div class="purchase-detail-head"><div><h3>Ankauf</h3><p>${escapeHtml(purchase.number)} · von ${escapeHtml(purchase.seller.name)} · ${formatCurrency(purchase.purchase.price)}</p></div><button type="button" class="secondary-btn">Ankaufsvertrag öffnen</button></div>`;
    section.querySelector('button').addEventListener('click', () => openPurchaseDocument(purchase));
    content.appendChild(section);
  };

  renderPurchases();
})();
