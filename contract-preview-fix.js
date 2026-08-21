(() => {
  const DAMAGE_DB_NAME = 'fahrfolio-damage-media-v1';
  const DAMAGE_STORE = 'damagePhotos';

  function selectedVehicle() {
    return vehicles.find(vehicle => vehicle.id === document.getElementById('contractVehicle')?.value);
  }

  function selectedCustomer() {
    return customers.find(customer => customer.id === document.getElementById('contractCustomer')?.value);
  }

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    try {
      return JSON.parse(localStorage.getItem('fahrfolio-dealer-profile-v1')) || {};
    } catch (error) {
      return {};
    }
  }

  function storedContracts() {
    if (typeof window.getFahrfolioContracts === 'function') return window.getFahrfolioContracts();
    try {
      const value = JSON.parse(localStorage.getItem('fahrfolio-contracts-v1'));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function currentSavedContract() {
    const vehicle = selectedVehicle();
    if (!vehicle?.contractId) return null;
    return storedContracts().find(contract => contract.id === vehicle.contractId) || null;
  }

  function signaturesComplete() {
    return Boolean(
      document.getElementById('sellerSignatureStatus')?.classList.contains('is-signed') &&
      document.getElementById('buyerSignatureStatus')?.classList.contains('is-signed')
    );
  }

  function currentDamageSelection() {
    if (typeof window.getFahrfolioContractDamageData !== 'function') return [];
    const value = window.getFahrfolioContractDamageData();
    return Array.isArray(value) ? value : [];
  }

  function loadDamagePhoto(photoId) {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      const request = indexedDB.open(DAMAGE_DB_NAME, 1);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DAMAGE_STORE)) db.createObjectStore(DAMAGE_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(DAMAGE_STORE, 'readonly');
        const getRequest = transaction.objectStore(DAMAGE_STORE).get(photoId);
        getRequest.onsuccess = () => {
          const result = getRequest.result || null;
          db.close();
          resolve(result);
        };
        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  }

  async function damageAppendixHtml(selection, vehicle) {
    const withPhotos = selection.filter(item => Array.isArray(item.photoIds) && item.photoIds.length);
    if (!withPhotos.length) return '';

    const items = [];
    for (const damage of withPhotos) {
      const photos = (await Promise.all(damage.photoIds.map(loadDamagePhoto))).filter(Boolean);
      if (!photos.length) continue;
      items.push(`
        <section class="damage-item">
          <h3>${escapeHtml(damage.title || 'Dokumentierter Schaden')}</h3>
          <p>${escapeHtml(damage.description || '')}</p>
          <div class="damage-grid">${photos.map(photo => `<img src="${photo.dataUrl}" alt="Dokumentierter Schaden">`).join('')}</div>
        </section>`);
    }

    if (!items.length) return '';
    return `
      <main class="page damage-page">
        <h2>Anlage – Fotodokumentation</h2>
        <div class="damage-sub">Vertragsvorschau · ${escapeHtml(`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim())}${vehicle?.vin ? ` · FIN ${escapeHtml(vehicle.vin)}` : ''}</div>
        ${items.join('')}
      </main>`;
  }

  async function openCurrentPreview() {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    const paper = document.querySelector('#contractPreview .contract-paper');
    const sellerCanvas = document.getElementById('sellerSignatureCanvas');
    const buyerCanvas = document.getElementById('buyerSignatureCanvas');

    if (!vehicle || !customer || !dealer.company || !paper || !signaturesComplete()) {
      showToast('Bitte Vertrag prüfen und beide Unterschriften erfassen.');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');
      return;
    }

    win.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px">Vertragsvorschau wird erstellt …</body></html>');
    win.document.close();

    const appendix = await damageAppendixHtml(currentDamageSelection(), vehicle);
    const sellerName = dealer.company || 'Verkäufer';
    const buyerName = fullName(customer) || 'Käufer';
    const sellerSignature = sellerCanvas.toDataURL('image/png');
    const buyerSignature = buyerCanvas.toDataURL('image/png');

    win.document.open();
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vertragsvorschau</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b49;margin:0;background:#eef2f6;font-size:12px;line-height:1.45}.page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm 16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}
      .preview-meta{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:#68788d;border-bottom:1px solid #dbe3ed;padding-bottom:8px;margin-bottom:16px}.preview-meta strong{color:#17345f}.contract-paper{border:0!important;box-shadow:none!important;padding:0!important;background:#fff!important}.contract-paper h3{font-size:22px;color:#17345f;margin:16px 0 18px}.contract-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1687ee;padding-bottom:10px}.dealer-contract-brand{display:flex;align-items:center;min-height:42px}.dealer-contract-brand img,.contract-brand img{max-height:54px;max-width:190px;object-fit:contain}.dealer-contract-brand strong{font-size:18px;color:#17345f}.contract-brand>span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#68788d}
      .contract-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.contract-columns>div{border:1px solid #dbe3ed;border-radius:8px;padding:11px 12px;min-height:92px}.contract-columns>div>span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1687ee;margin-bottom:4px}.contract-columns strong{font-size:12px;color:#172b49}.contract-columns p{font-size:10px;color:#5f6f83;line-height:1.5;margin:5px 0 0}
      .contract-section{margin-top:15px;break-inside:avoid}.contract-section-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1687ee;margin-bottom:6px}.contract-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.contract-list>div{background:#f4f7fa;border-radius:7px;padding:8px 9px}.contract-list span{display:block;font-size:8px;color:#6d7b8d;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.contract-list strong{font-size:10px;color:#172b49}.contract-note-box{background:#f8fafc;border:1px solid #dbe3ed;border-radius:7px;padding:9px 10px;font-size:10px;line-height:1.5;color:#536176;white-space:pre-wrap}.contract-confirmation{margin-top:16px;background:#f5f8fc;border-left:3px solid #1687ee;padding:9px 10px;font-size:9px;line-height:1.5;color:#627086}.signature-preview{display:none!important}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:30px;break-inside:avoid}.signature img{display:block;width:100%;height:78px;object-fit:contain;border-bottom:1px solid #8996a7}.signature strong{display:block;margin-top:5px;font-size:9px;color:#4f6074}.preview-note{margin-top:22px;padding:9px 10px;background:#fff7df;border:1px solid #f1dfaa;border-radius:7px;font-size:9px;color:#75612d}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:white;font-weight:700;font-size:13px;cursor:pointer}
      .damage-page{break-before:page}.damage-page h2{font-size:22px;margin:0 0 4px}.damage-sub{font-size:10px;color:#6f7f91;margin-bottom:16px}.damage-item{margin-bottom:18px;break-inside:avoid}.damage-item h3{font-size:14px;margin:0 0 4px}.damage-item p{font-size:11px;color:#536176;margin:0 0 9px}.damage-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.damage-grid img{width:100%;max-height:92mm;object-fit:contain;border:1px solid #dbe3ed;border-radius:6px;background:#fafbfd}
      @page{size:A4;margin:8mm}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.contract-columns,.contract-list,.signatures{grid-template-columns:1fr 1fr!important}.contract-section,.signatures,.contract-columns,.damage-item{break-inside:avoid}.damage-page{break-before:page}}
      @media screen and (max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.contract-columns,.contract-list,.signatures,.damage-grid{grid-template-columns:1fr}.print-actions{width:auto;margin:12px 18px 24px}}
    </style></head><body>
      <main class="page">
        <div class="preview-meta"><span><strong>Vertragsvorschau</strong></span><span>Noch nicht abgeschlossen</span></div>
        ${paper.outerHTML}
        <div class="signatures"><div class="signature"><img src="${sellerSignature}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signature"><img src="${buyerSignature}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div>
        <div class="preview-note"><strong>Vorschau:</strong> Dieser Vertragsstand ist noch nicht abgeschlossen oder gespeichert. Erst „Vertrag abschließen“ erstellt den endgültigen Vertragsdatensatz.</div>
      </main>
      ${appendix}
      <div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div>
    </body></html>`);
    win.document.close();
  }

  function install() {
    const originalButton = document.getElementById('printSignedContractBtn');
    const sellerStatus = document.getElementById('sellerSignatureStatus');
    const buyerStatus = document.getElementById('buyerSignatureStatus');
    const finishButton = document.getElementById('finishSignatureBtn');
    if (!originalButton || !sellerStatus || !buyerStatus || !finishButton) return false;
    if (originalButton.dataset.previewFixInstalled) return true;

    const button = originalButton.cloneNode(true);
    button.dataset.previewFixInstalled = 'true';
    originalButton.replaceWith(button);

    function updateButton() {
      const saved = currentSavedContract();
      const signed = signaturesComplete();
      button.disabled = !(saved || signed);
      button.textContent = saved ? 'Vertrag öffnen / PDF' : 'Vertrag prüfen / PDF';
    }

    button.addEventListener('click', () => {
      const saved = currentSavedContract();
      if (saved) {
        if (typeof window.openFahrfolioSignedContract === 'function') window.openFahrfolioSignedContract(saved);
        else showToast('Gespeicherter Vertrag konnte nicht geöffnet werden.');
        return;
      }
      openCurrentPreview();
    });

    const observer = new MutationObserver(updateButton);
    observer.observe(sellerStatus, { attributes: true, attributeFilter: ['class'] });
    observer.observe(buyerStatus, { attributes: true, attributeFilter: ['class'] });
    finishButton.addEventListener('click', () => setTimeout(updateButton, 80));
    document.getElementById('signatureModal')?.addEventListener('transitionend', updateButton);
    updateButton();
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 100);
})();
