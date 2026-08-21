(() => {
  const DAMAGE_DB_NAME = 'fahrfolio-damage-media-v1';
  const DAMAGE_STORE = 'damagePhotos';
  const DAMAGE_KEY = 'fahrfolio-damages-v1';
  const CONTRACT_DAMAGE_KEY = 'fahrfolio-contract-damages-v1';
  let pendingDamageState = [];
  let damageDbPromise = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function selectedVehicle() {
    return vehicles.find(vehicle => vehicle.id === document.getElementById('contractVehicle')?.value);
  }

  function selectedCustomer() {
    return customers.find(customer => customer.id === document.getElementById('contractCustomer')?.value);
  }

  function dealerProfile() {
    if (typeof window.getFahrfolioDealerProfile === 'function') return window.getFahrfolioDealerProfile();
    return readJson('fahrfolio-dealer-profile-v1', {});
  }

  function storedContracts() {
    if (typeof window.getFahrfolioContracts === 'function') return window.getFahrfolioContracts();
    const value = readJson('fahrfolio-contracts-v1', []);
    return Array.isArray(value) ? value : [];
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

  function damageStateFromUi() {
    const damages = readJson(DAMAGE_KEY, []);
    const damageMap = new Map((Array.isArray(damages) ? damages : []).map(item => [item.id, item]));
    return Array.from(document.querySelectorAll('#contractDamageList .contract-damage-row')).flatMap(row => {
      const include = row.querySelector('.damage-contract-toggle');
      if (!include?.checked) return [];
      const damage = damageMap.get(row.dataset.damageId);
      if (!damage) return [];
      const photoToggle = row.querySelector('.damage-photo-toggle');
      const countText = row.querySelector('.contract-damage-photo-toggle span')?.textContent || '';
      const photoCount = Number(countText.match(/\((\d+)\)/)?.[1] || 0);
      return [{
        id: damage.id,
        vehicleId: damage.vehicleId,
        title: damage.title,
        description: damage.description,
        includePhotos: Boolean(photoToggle?.checked),
        photoCount
      }];
    });
  }

  function openDamageDb() {
    if (damageDbPromise) return damageDbPromise;
    damageDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Kein Bildspeicher verfügbar.'));
      const request = indexedDB.open(DAMAGE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(DAMAGE_STORE)
          ? request.transaction.objectStore(DAMAGE_STORE)
          : db.createObjectStore(DAMAGE_STORE, { keyPath: 'id' });
        if (!store.indexNames.contains('damageId')) store.createIndex('damageId', 'damageId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Schadensfotos konnten nicht geöffnet werden.'));
    });
    return damageDbPromise;
  }

  async function photosForDamage(damageId) {
    try {
      const db = await openDamageDb();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DAMAGE_STORE, 'readonly').objectStore(DAMAGE_STORE).index('damageId').getAll(damageId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Schadensfotos konnten nicht geladen werden.', error);
      return [];
    }
  }

  async function photoById(photoId) {
    try {
      const db = await openDamageDb();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DAMAGE_STORE, 'readonly').objectStore(DAMAGE_STORE).get(photoId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return null;
    }
  }

  async function resolveDamageState(state) {
    const resolved = [];
    for (const item of state) {
      const photos = item.includePhotos ? await photosForDamage(item.id) : [];
      resolved.push({
        ...item,
        photoCount: photos.length || item.photoCount || 0,
        photoIds: photos.map(photo => photo.id),
        photos
      });
    }
    return resolved;
  }

  function damageReferenceHtml(state) {
    if (!state.length) return '';
    const descriptions = state.map(item => `<strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description)}`).join('<br><br>');
    const photoCount = state.filter(item => item.includePhotos).reduce((sum, item) => sum + Number(item.photoCount || item.photos?.length || 0), 0);
    const reference = photoCount
      ? `<br><br><strong>Fotodokumentation:</strong> siehe <strong>Anlage 1 – Fotodokumentation</strong> (${photoCount} ${photoCount === 1 ? 'Bild' : 'Bilder'}).`
      : '';
    return `${descriptions}${reference}`;
  }

  function syncDamageReference(root, state) {
    if (!root) return;
    let section = root.querySelector('.damage-preview-section');
    if (!state.length) {
      section?.remove();
      return;
    }
    if (!section) {
      section = document.createElement('div');
      section.className = 'contract-section damage-preview-section';
      const manual = Array.from(root.querySelectorAll('.contract-section')).find(item => item.querySelector('.contract-section-title')?.textContent.trim() === 'Bekannte Mängel / Schäden');
      if (manual) manual.insertAdjacentElement('beforebegin', section); else root.appendChild(section);
    }
    section.innerHTML = `<div class="contract-section-title">Dokumentierte Mängel / Schäden</div><div class="contract-note-box">${damageReferenceHtml(state)}</div>`;
  }

  function patchedContractHtml(html, state) {
    if (!html) return '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const paper = wrapper.querySelector('.contract-paper') || wrapper;
    syncDamageReference(paper, state);
    return wrapper.innerHTML;
  }

  async function appendixHtml(state, vehicle, label = '') {
    const withPhotos = state.filter(item => item.includePhotos && Array.isArray(item.photos) && item.photos.length);
    if (!withPhotos.length) return '';
    const items = withPhotos.map(item => `
      <section class="damage-item">
        <h3>${escapeHtml(item.title || 'Dokumentierter Schaden')}</h3>
        <p>${escapeHtml(item.description || '')}</p>
        <div class="damage-grid">${item.photos.map(photo => `<img src="${photo.dataUrl}" alt="Dokumentierter Schaden">`).join('')}</div>
      </section>`).join('');
    const vehicleText = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim();
    return `
      <main class="page damage-page">
        <h2>Anlage 1 – Fotodokumentation</h2>
        <div class="damage-sub">${escapeHtml(label)}${label && vehicleText ? ' · ' : ''}${escapeHtml(vehicleText)}${vehicle?.vin ? ` · FIN ${escapeHtml(vehicle.vin)}` : ''}</div>
        ${items}
      </main>`;
  }

  function documentStyles() {
    return `
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b49;margin:0;background:#eef2f6;font-size:12px;line-height:1.45}.page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm 16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}
      .doc-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10px;color:#68788d;border-bottom:1px solid #dbe3ed;padding-bottom:8px;margin-bottom:16px}.doc-meta strong{color:#17345f}.contract-paper{border:0!important;box-shadow:none!important;padding:0!important;background:#fff!important}.contract-paper h3{font-size:22px;color:#17345f;margin:16px 0 18px}.contract-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1687ee;padding-bottom:10px}.dealer-contract-brand{display:flex;align-items:center;min-height:42px}.dealer-contract-brand img,.contract-brand img{max-height:54px;max-width:190px;object-fit:contain}.dealer-contract-brand strong{font-size:18px;color:#17345f}.contract-brand>span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#68788d}
      .contract-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.contract-columns>div{border:1px solid #dbe3ed;border-radius:8px;padding:11px 12px;min-height:92px}.contract-columns>div>span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1687ee;margin-bottom:4px}.contract-columns strong{font-size:12px;color:#172b49}.contract-columns p{font-size:10px;color:#5f6f83;line-height:1.5;margin:5px 0 0}.contract-section{margin-top:15px;break-inside:avoid}.contract-section-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1687ee;margin-bottom:6px}.contract-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.contract-list>div{background:#f4f7fa;border-radius:7px;padding:8px 9px}.contract-list span{display:block;font-size:8px;color:#6d7b8d;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.contract-list strong{font-size:10px;color:#172b49}.contract-note-box{background:#f8fafc;border:1px solid #dbe3ed;border-radius:7px;padding:9px 10px;font-size:10px;line-height:1.5;color:#536176;white-space:pre-wrap}.contract-confirmation{margin-top:16px;background:#f5f8fc;border-left:3px solid #1687ee;padding:9px 10px;font-size:9px;line-height:1.5;color:#627086}.signature-preview{display:none!important}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:30px;break-inside:avoid}.signature img{display:block;width:100%;height:78px;object-fit:contain;border-bottom:1px solid #8996a7}.signature strong{display:block;margin-top:5px;font-size:9px;color:#4f6074}.doc-note{margin-top:22px;padding:9px 10px;background:#fff7df;border:1px solid #f1dfaa;border-radius:7px;font-size:9px;color:#75612d}.doc-footer{margin-top:22px;padding-top:8px;border-top:1px solid #dbe3ed;font-size:8px;color:#788696}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:white;font-weight:700;font-size:13px;cursor:pointer}
      .damage-page{break-before:page}.damage-page h2{font-size:22px;margin:0 0 4px}.damage-sub{font-size:10px;color:#6f7f91;margin-bottom:16px}.damage-item{margin-bottom:18px;break-inside:avoid}.damage-item h3{font-size:14px;margin:0 0 4px}.damage-item p{font-size:11px;color:#536176;margin:0 0 9px}.damage-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.damage-grid img{width:100%;max-height:92mm;object-fit:contain;border:1px solid #dbe3ed;border-radius:6px;background:#fafbfd}
      @page{size:A4;margin:8mm}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.contract-columns,.contract-list,.signatures{grid-template-columns:1fr 1fr!important}.contract-section,.signatures,.contract-columns,.damage-item{break-inside:avoid}.damage-page{break-before:page}}@media screen and (max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.contract-columns,.contract-list,.signatures,.damage-grid{grid-template-columns:1fr}.print-actions{width:auto;margin:12px 18px 24px}}`;
  }

  function openWindow() {
    const win = window.open('', '_blank');
    if (!win) showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');
    return win;
  }

  async function openCurrentPreview() {
    const vehicle = selectedVehicle();
    const customer = selectedCustomer();
    const dealer = dealerProfile();
    const paper = document.querySelector('#contractPreview .contract-paper');
    const sellerCanvas = document.getElementById('sellerSignatureCanvas');
    const buyerCanvas = document.getElementById('buyerSignatureCanvas');
    if (!vehicle || !customer || !dealer.company || !paper || !signaturesComplete()) return showToast('Bitte Vertrag prüfen und beide Unterschriften erfassen.');

    const win = openWindow();
    if (!win) return;
    win.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px">Vertragsvorschau wird erstellt …</body></html>');
    win.document.close();

    const state = pendingDamageState.length ? pendingDamageState : damageStateFromUi();
    const resolved = await resolveDamageState(state);
    const paperHtml = patchedContractHtml(paper.outerHTML, resolved);
    const appendix = await appendixHtml(resolved, vehicle, 'Vertragsvorschau');
    const sellerName = dealer.company || 'Verkäufer';
    const buyerName = fullName(customer) || 'Käufer';

    win.document.open();
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vertragsvorschau</title><style>${documentStyles()}</style></head><body>
      <main class="page"><div class="doc-meta"><span><strong>Vertragsvorschau</strong></span><span>Noch nicht abgeschlossen</span></div>${paperHtml}<div class="signatures"><div class="signature"><img src="${sellerCanvas.toDataURL('image/png')}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signature"><img src="${buyerCanvas.toDataURL('image/png')}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div><div class="doc-note"><strong>Vorschau:</strong> Dieser Vertragsstand ist noch nicht abgeschlossen oder gespeichert. Erst „Vertrag abschließen“ erstellt den endgültigen Vertragsdatensatz.</div></main>${appendix}<div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div>
    </body></html>`);
    win.document.close();
  }

  async function resolvedStateForContract(contract) {
    const links = readJson(CONTRACT_DAMAGE_KEY, {});
    const linked = Array.isArray(links?.[contract.id]) ? links[contract.id] : [];
    if (!linked.length && selectedVehicle()?.contractId === contract.id && pendingDamageState.length) return resolveDamageState(pendingDamageState);
    const resolved = [];
    for (const item of linked) {
      const photos = Array.isArray(item.photoIds) ? (await Promise.all(item.photoIds.map(photoById))).filter(Boolean) : [];
      resolved.push({ ...item, includePhotos: photos.length > 0, photoCount: photos.length, photos });
    }
    return resolved;
  }

  async function openFinalContract(contract) {
    if (!contract) return;
    const win = openWindow();
    if (!win) return;
    win.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px">Vertrag wird erstellt …</body></html>');
    win.document.close();

    const state = await resolvedStateForContract(contract);
    const contractHtml = patchedContractHtml(contract.contractHtml || '', state);
    const appendix = await appendixHtml(state, contract.vehicle, `Vertrag ${contract.number}`);
    const sellerName = contract.dealer?.company || 'Verkäufer';
    const buyerName = `${contract.customer?.firstName || ''} ${contract.customer?.lastName || ''}`.trim() || 'Käufer';
    const finishedAt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(contract.createdAt));

    win.document.open();
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(contract.number)}</title><style>${documentStyles()}</style></head><body>
      <main class="page"><div class="doc-meta"><span><strong>Vertragsnummer:</strong> ${escapeHtml(contract.number)}</span><span><strong>Abgeschlossen:</strong> ${escapeHtml(finishedAt)}</span></div>${contractHtml}<div class="signatures"><div class="signature"><img src="${contract.signatures?.seller || ''}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signature"><img src="${contract.signatures?.buyer || ''}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div><div class="doc-footer">Fahrfolio-Prototyp · Elektronisch erfasster Vertragsstand. Finale Vertragsbedingungen und der Produktivprozess werden vor Veröffentlichung rechtlich geprüft.</div></main>${appendix}<div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div>
    </body></html>`);
    win.document.close();
  }

  function saveDamageLinksForContract(contractId, state) {
    if (!contractId) return;
    const links = readJson(CONTRACT_DAMAGE_KEY, {});
    links[contractId] = state.map(item => ({
      id: item.id,
      vehicleId: item.vehicleId,
      title: item.title,
      description: item.description,
      photoIds: item.includePhotos ? [...(item.photoIds || [])] : []
    }));
    writeJson(CONTRACT_DAMAGE_KEY, links);
  }

  function captureDamageState() {
    pendingDamageState = damageStateFromUi();
    syncDamageReference(document.querySelector('#contractPreview .contract-paper'), pendingDamageState);
    return pendingDamageState;
  }

  function install() {
    const originalButton = document.getElementById('printSignedContractBtn');
    const sellerStatus = document.getElementById('sellerSignatureStatus');
    const buyerStatus = document.getElementById('buyerSignatureStatus');
    const finishButton = document.getElementById('finishSignatureBtn');
    const continueButton = document.getElementById('continueContractBtn');
    if (!originalButton || !sellerStatus || !buyerStatus || !finishButton || !continueButton) return false;
    if (originalButton.dataset.damageAppendixFixInstalled) return true;

    continueButton.addEventListener('click', captureDamageState, true);
    document.getElementById('contractDamageList')?.addEventListener('change', () => setTimeout(() => syncDamageReference(document.querySelector('#contractPreview .contract-paper'), damageStateFromUi()), 0));

    const button = originalButton.cloneNode(true);
    button.dataset.damageAppendixFixInstalled = 'true';
    originalButton.replaceWith(button);

    function updateButton() {
      const saved = currentSavedContract();
      button.disabled = !(saved || signaturesComplete());
      button.textContent = saved ? 'Vertrag öffnen / PDF' : 'Vertrag prüfen / PDF';
    }

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const saved = currentSavedContract();
      if (saved) openFinalContract(saved);
      else openCurrentPreview();
    }, true);

    finishButton.addEventListener('click', () => {
      const state = pendingDamageState.length ? pendingDamageState : captureDamageState();
      syncDamageReference(document.querySelector('#contractPreview .contract-paper'), state);
      resolveDamageState(state).then(resolved => {
        let attempts = 0;
        const saveWhenReady = () => {
          const vehicle = selectedVehicle();
          if (vehicle?.contractId) {
            saveDamageLinksForContract(vehicle.contractId, resolved);
            return;
          }
          attempts += 1;
          if (attempts < 8) setTimeout(saveWhenReady, 80);
        };
        setTimeout(saveWhenReady, 0);
      });
      setTimeout(updateButton, 120);
    }, true);

    const observer = new MutationObserver(updateButton);
    observer.observe(sellerStatus, { attributes: true, attributeFilter: ['class'] });
    observer.observe(buyerStatus, { attributes: true, attributeFilter: ['class'] });
    updateButton();

    window.openFahrfolioSignedContract = openFinalContract;
    setTimeout(() => { window.openFahrfolioSignedContract = openFinalContract; }, 500);
    setTimeout(() => { window.openFahrfolioSignedContract = openFinalContract; }, 1200);
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 100);
})();
