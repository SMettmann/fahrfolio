(() => {
  const DAMAGE_KEY = 'fahrfolio-damages-v1';
  const CONTRACT_DAMAGE_KEY = 'fahrfolio-contract-damages-v1';
  const DB_NAME = 'fahrfolio-damage-media-v1';
  const STORE = 'damagePhotos';
  const MAX_PHOTOS = 3;
  let activeVehicleIdForDamage = null;
  let contractSelection = [];
  let dbPromise = null;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'damage-documentation.css';
  document.head.appendChild(stylesheet);

  function readJson(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch (error) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function damages() { const value = readJson(DAMAGE_KEY, []); return Array.isArray(value) ? value : []; }
  function vehicleDamages(vehicleId) { return damages().filter(item => item.vehicleId === vehicleId).sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)); }
  function saveDamageList(list) { writeJson(DAMAGE_KEY, list); }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE) ? request.transaction.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: 'id' });
        if (!store.indexNames.contains('damageId')) store.createIndex('damageId', 'damageId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Schadensfotos konnten nicht geöffnet werden.'));
    });
    return dbPromise;
  }

  async function photoList(damageId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).index('damageId').getAll(damageId);
      request.onsuccess = () => resolve((request.result || []).sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)));
      request.onerror = () => reject(request.error);
    });
  }
  async function getPhoto(photoId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(photoId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  async function putPhoto(photo) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(photo);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function deleteDamagePhotos(damageId) {
    const photos = await photoList(damageId);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      photos.forEach(photo => store.delete(photo.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, 1200 / image.width, 900 / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .74));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'damageModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal damage-modal" role="dialog" aria-modal="true" aria-labelledby="damageModalTitle">
      <div class="modal-head"><div><p class="eyebrow">SCHÄDEN & MÄNGEL</p><h2 id="damageModalTitle">Schäden dokumentieren</h2></div><button class="icon-btn" id="closeDamageModal">×</button></div>
      <div class="damage-intro">Schäden einmal mit Beschreibung und optionalen Fotos dokumentieren. Beim Kaufvertrag entscheidest du später für jeden Schaden separat, ob er im Vertrag und ob die Fotos als Anlage erscheinen sollen.</div>
      <form id="damageForm" class="damage-form">
        <div class="damage-form-grid">
          <label>Kurze Bezeichnung*<input id="damageTitle" required placeholder="z. B. Felge vorne rechts" /></label>
          <label class="damage-upload-label"><strong>Fotos hinzufügen</strong><span>optional · max. ${MAX_PHOTOS}</span><input id="damagePhotos" type="file" accept="image/*" multiple /></label>
          <label class="full">Beschreibung*<textarea id="damageDescription" required rows="2" placeholder="z. B. Kratzer / Bordsteinschaden"></textarea></label>
        </div>
        <div class="modal-actions"><button type="submit" class="primary-btn">Schaden speichern</button></div>
      </form>
      <div id="damageList" class="damage-list"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="doneDamageBtn">Fertig</button></div>
    </div>`;
  document.body.appendChild(modal);

  const damageForm = document.getElementById('damageForm');
  const damageTitle = document.getElementById('damageTitle');
  const damageDescription = document.getElementById('damageDescription');
  const damagePhotos = document.getElementById('damagePhotos');
  const damageList = document.getElementById('damageList');

  const detailActions = document.querySelector('.detail-actions');
  const damageButton = document.createElement('button');
  damageButton.type = 'button';
  damageButton.className = 'secondary-btn';
  damageButton.textContent = 'Schäden';
  damageButton.id = 'detailDamageBtn';
  if (detailActions) detailActions.insertBefore(damageButton, detailActions.children[2] || null);

  async function renderDamageList() {
    if (!activeVehicleIdForDamage) return;
    const list = vehicleDamages(activeVehicleIdForDamage);
    if (!list.length) {
      damageList.innerHTML = '<div class="damage-empty"><strong>Noch keine Schäden dokumentiert.</strong><br>Nur echte bekannte Mängel oder Schäden eintragen.</div>';
      return;
    }
    const cards = [];
    for (const damage of list) {
      const photos = await photoList(damage.id);
      cards.push(`<article class="damage-card" data-damage-id="${damage.id}"><div class="damage-card-head"><div><h3>${escapeHtml(damage.title)}</h3><p>${escapeHtml(damage.description)}</p><div class="damage-card-meta">${photos.length ? `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}` : 'Keine Fotos'}</div></div><button type="button" class="ghost-btn delete-damage">Löschen</button></div>${photos.length ? `<div class="damage-thumbs">${photos.map(photo => `<img src="${photo.dataUrl}" alt="Schadensfoto">`).join('')}</div>` : ''}</article>`);
    }
    damageList.innerHTML = cards.join('');
    damageList.querySelectorAll('.delete-damage').forEach(button => button.addEventListener('click', async () => {
      const id = button.closest('[data-damage-id]').dataset.damageId;
      if (!window.confirm('Diesen dokumentierten Schaden wirklich löschen?')) return;
      saveDamageList(damages().filter(item => item.id !== id));
      await deleteDamagePhotos(id);
      await renderDamageList();
      await renderContractSelector();
      showToast('Schaden wurde gelöscht.');
    }));
  }

  function openDamageManager(vehicleId) {
    const vehicle = vehicles.find(item => item.id === vehicleId);
    if (!vehicle) return showToast('Bitte Fahrzeug zuerst speichern.');
    activeVehicleIdForDamage = vehicleId;
    document.getElementById('damageModalTitle').textContent = `Schäden · ${vehicle.brand} ${vehicle.model}`;
    damageForm.reset();
    openModal(modal);
    renderDamageList();
  }

  damageForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeVehicleIdForDamage) return;
    const title = damageTitle.value.trim();
    const description = damageDescription.value.trim();
    if (!title || !description) return;
    const selectedFiles = Array.from(damagePhotos.files || []).filter(file => file.type.startsWith('image/')).slice(0, MAX_PHOTOS);
    const damage = { id: crypto.randomUUID(), vehicleId: activeVehicleIdForDamage, title, description, createdAt: Date.now() };
    const list = damages();
    list.push(damage);
    saveDamageList(list);
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const dataUrl = await compressImage(selectedFiles[index]);
        await putPhoto({ id: crypto.randomUUID(), damageId: damage.id, dataUrl, createdAt: Date.now() + index });
      }
      damageForm.reset();
      await renderDamageList();
      await renderContractSelector();
      showToast('Schaden wurde dokumentiert.');
    } catch (error) {
      console.error(error);
      showToast('Schaden gespeichert, aber mindestens ein Foto konnte nicht verarbeitet werden.');
    }
  });

  damageButton.addEventListener('click', () => openDamageManager(activeVehicleId));
  document.getElementById('closeDamageModal').addEventListener('click', () => closeModal(modal));
  document.getElementById('doneDamageBtn').addEventListener('click', () => closeModal(modal));

  const defectsLabel = document.getElementById('contractDefects')?.closest('label');
  const selector = document.createElement('div');
  selector.className = 'contract-damage-box';
  selector.id = 'contractDamageSelector';
  selector.innerHTML = '<div class="contract-damage-title"><strong>Dokumentierte Schäden aus der Fahrzeugakte</strong><span>Für diesen Vertrag einzeln auswählen.</span></div><div id="contractDamageList" class="contract-damage-list"></div>';
  if (defectsLabel) defectsLabel.insertAdjacentElement('beforebegin', selector);
  const contractDamageList = document.getElementById('contractDamageList');

  async function renderContractSelector() {
    if (!contractDamageList) return;
    const vehicleId = document.getElementById('contractVehicle')?.value;
    const list = vehicleDamages(vehicleId);
    contractSelection = [];
    if (!list.length) {
      contractDamageList.innerHTML = '<span style="font-size:11px;color:var(--muted)">Keine dokumentierten Schäden vorhanden.</span>';
      if (typeof updateContractPreview === 'function') updateContractPreview();
      return;
    }
    const rows = [];
    for (const damage of list) {
      const photos = await photoList(damage.id);
      contractSelection.push({ id: damage.id, vehicleId, title: damage.title, description: damage.description, include: true, includePhotos: false, photoIds: photos.map(photo => photo.id) });
      rows.push(`<div class="contract-damage-row" data-damage-id="${damage.id}"><label class="contract-damage-main"><input class="damage-contract-toggle" type="checkbox" checked><span class="contract-damage-copy"><strong>${escapeHtml(damage.title)}</strong><span>${escapeHtml(damage.description)}</span></span></label>${photos.length ? `<label class="contract-damage-photo-toggle"><input class="damage-photo-toggle" type="checkbox"><span>Fotos als Anlage beifügen (${photos.length})</span></label>` : ''}</div>`);
    }
    contractDamageList.innerHTML = rows.join('');
    contractDamageList.querySelectorAll('.contract-damage-row').forEach(row => {
      const id = row.dataset.damageId;
      const include = row.querySelector('.damage-contract-toggle');
      const photo = row.querySelector('.damage-photo-toggle');
      include.addEventListener('change', () => {
        const item = contractSelection.find(entry => entry.id === id);
        if (!item) return;
        item.include = include.checked;
        if (photo) { photo.disabled = !include.checked; if (!include.checked) { photo.checked = false; item.includePhotos = false; } }
        if (typeof updateContractPreview === 'function') updateContractPreview();
      });
      photo?.addEventListener('change', () => {
        const item = contractSelection.find(entry => entry.id === id);
        if (item) item.includePhotos = photo.checked;
        if (typeof updateContractPreview === 'function') updateContractPreview();
      });
    });
    if (typeof updateContractPreview === 'function') updateContractPreview();
  }

  window.getFahrfolioContractDamageData = () => contractSelection.filter(item => item.include).map(item => ({
    id: item.id,
    vehicleId: item.vehicleId,
    title: item.title,
    description: item.description,
    photoIds: item.includePhotos ? [...item.photoIds] : []
  }));

  function appendDamagePreview() {
    const paper = document.querySelector('#contractPreview .contract-paper');
    if (!paper) return;
    paper.querySelector('.damage-preview-section')?.remove();
    const selected = window.getFahrfolioContractDamageData();
    if (!selected.length) return;
    const section = document.createElement('div');
    section.className = 'contract-section damage-preview-section';
    const photoCount = selected.reduce((sum, item) => sum + item.photoIds.length, 0);
    section.innerHTML = `<div class="contract-section-title">Dokumentierte Mängel / Schäden</div><div class="contract-note-box">${selected.map(item => `<strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description)}`).join('<br><br>')}${photoCount ? `<br><br><strong>Fotodokumentation:</strong> ${photoCount} ${photoCount === 1 ? 'Bild' : 'Bilder'} als Anlage ausgewählt.` : ''}</div>`;
    const manualDamageSection = Array.from(paper.querySelectorAll('.contract-section')).find(item => item.querySelector('.contract-section-title')?.textContent.trim() === 'Bekannte Mängel / Schäden');
    if (manualDamageSection) manualDamageSection.insertAdjacentElement('beforebegin', section); else paper.appendChild(section);
  }

  const previewObserver = new MutationObserver(() => {
    if (previewObserver.busy) return;
    previewObserver.busy = true;
    appendDamagePreview();
    previewObserver.busy = false;
  });
  const previewRoot = document.getElementById('contractPreview');
  if (previewRoot) previewObserver.observe(previewRoot, { childList: true });

  const contractVehicle = document.getElementById('contractVehicle');
  contractVehicle?.addEventListener('change', () => setTimeout(renderContractSelector, 0));
  const originalOpenContract = openContract;
  openContract = function(vehicleId = null, customerId = null) {
    originalOpenContract(vehicleId, customerId);
    setTimeout(renderContractSelector, 0);
  };

  function contractDamageLinks() { const value = readJson(CONTRACT_DAMAGE_KEY, {}); return value && typeof value === 'object' ? value : {}; }
  function saveContractDamageLink(contractId, data) { const links = contractDamageLinks(); links[contractId] = data; writeJson(CONTRACT_DAMAGE_KEY, links); }

  function hookSignatureFlow() {
    const finish = document.getElementById('finishSignatureBtn');
    const print = document.getElementById('printSignedContractBtn');
    if (!finish || !print || finish.dataset.damageHooked) return false;
    finish.dataset.damageHooked = 'true';
    finish.addEventListener('click', () => {
      const snapshot = window.getFahrfolioContractDamageData();
      if (!snapshot.length) return;
      setTimeout(() => {
        const contracts = readJson('fahrfolio-contracts-v1', []);
        const latest = Array.isArray(contracts) ? contracts[0] : null;
        if (latest?.id) saveContractDamageLink(latest.id, snapshot);
      }, 0);
    });
    print.addEventListener('click', event => {
      const contracts = readJson('fahrfolio-contracts-v1', []);
      const latest = Array.isArray(contracts) ? contracts[0] : null;
      if (!latest) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.openFahrfolioSignedContract(latest);
    }, true);
    return true;
  }

  const signatureHookTimer = setInterval(() => { if (hookSignatureFlow()) clearInterval(signatureHookTimer); }, 250);

  async function appendixHtml(contract) {
    const linked = contractDamageLinks()[contract.id] || [];
    const selected = linked.filter(item => Array.isArray(item.photoIds) && item.photoIds.length);
    if (!selected.length) return '';
    const items = [];
    for (const damage of selected) {
      const photos = (await Promise.all(damage.photoIds.map(getPhoto))).filter(Boolean);
      if (!photos.length) continue;
      items.push(`<section class="damage-appendix-item"><h3>${escapeHtml(damage.title)}</h3><p>${escapeHtml(damage.description)}</p><div class="damage-appendix-grid">${photos.map(photo => `<img src="${photo.dataUrl}" alt="Dokumentierter Schaden">`).join('')}</div></section>`);
    }
    if (!items.length) return '';
    return `<main class="page damage-appendix-page"><h2 class="damage-appendix-title">Anlage – Fotodokumentation</h2><div class="damage-appendix-sub">Vertrag ${escapeHtml(contract.number)} · ${escapeHtml(`${contract.vehicle.brand || ''} ${contract.vehicle.model || ''}`.trim())} · FIN ${escapeHtml(contract.vehicle.vin || '—')}</div>${items.join('')}</main>`;
  }

  async function enhancedSignedContract(contract) {
    if (!contract) return;
    const sellerName = contract.dealer.company || 'Verkäufer';
    const buyerName = `${contract.customer.firstName || ''} ${contract.customer.lastName || ''}`.trim() || 'Käufer';
    const finishedAt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(contract.createdAt));
    const appendix = await appendixHtml(contract);
    const win = window.open('', '_blank');
    if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups erlauben.');
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(contract.number)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b49;margin:0;background:#eef2f6;font-size:12px;line-height:1.45}.page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm 16mm;box-shadow:0 4px 22px rgba(20,43,73,.09)}.signed-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10px;color:#68788d;border-bottom:1px solid #dbe3ed;padding-bottom:8px;margin-bottom:16px}.signed-meta strong{color:#17345f}.contract-paper{border:0!important;box-shadow:none!important;padding:0!important;background:#fff!important}.contract-paper h3{font-size:22px;color:#17345f;margin:16px 0 18px}.contract-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1687ee;padding-bottom:10px}.dealer-contract-brand img,.contract-brand img{max-height:54px;max-width:190px;object-fit:contain}.contract-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.contract-columns>div{border:1px solid #dbe3ed;border-radius:8px;padding:11px 12px}.contract-columns>div>span,.contract-section-title{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1687ee;margin-bottom:4px}.contract-columns p{font-size:10px;color:#5f6f83;line-height:1.5;margin:5px 0 0}.contract-section{margin-top:15px;break-inside:avoid}.contract-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.contract-list>div{background:#f4f7fa;border-radius:7px;padding:8px 9px}.contract-list span{display:block;font-size:8px;color:#6d7b8d;text-transform:uppercase}.contract-list strong{font-size:10px}.contract-note-box{background:#f8fafc;border:1px solid #dbe3ed;border-radius:7px;padding:9px 10px;font-size:10px;line-height:1.5;color:#536176;white-space:pre-wrap}.contract-confirmation{margin-top:16px;background:#f5f8fc;border-left:3px solid #1687ee;padding:9px 10px;font-size:9px;color:#627086}.signature-preview{display:none!important}.signed-signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:30px;break-inside:avoid}.signed-signature img{display:block;width:100%;height:78px;object-fit:contain;border-bottom:1px solid #8996a7}.signed-signature strong{display:block;margin-top:5px;font-size:9px}.signed-footer{margin-top:22px;padding-top:8px;border-top:1px solid #dbe3ed;font-size:8px;color:#788696}.print-actions{width:210mm;margin:0 auto 24px}.print-actions button{padding:11px 16px;border:0;border-radius:8px;background:#17345f;color:white;font-weight:700}.damage-appendix-page{break-before:page}.damage-appendix-title{font-size:22px;margin:0 0 4px}.damage-appendix-sub{font-size:10px;color:#6f7f91;margin-bottom:16px}.damage-appendix-item{margin-bottom:18px;break-inside:avoid}.damage-appendix-item h3{font-size:14px;margin:0 0 4px}.damage-appendix-item p{font-size:11px;color:#536176;margin:0 0 9px}.damage-appendix-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.damage-appendix-grid img{width:100%;max-height:92mm;object-fit:contain;border:1px solid #dbe3ed;border-radius:6px}@page{size:A4;margin:8mm}@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.print-actions{display:none}.contract-columns,.contract-list,.signed-signatures{grid-template-columns:1fr 1fr!important}.damage-appendix-page{break-before:page}.contract-section,.signed-signatures,.contract-columns{break-inside:avoid}}@media screen and (max-width:760px){body{background:#fff}.page{width:100%;min-height:0;margin:0;padding:18px;box-shadow:none}.contract-columns,.contract-list,.signed-signatures,.damage-appendix-grid{grid-template-columns:1fr}.print-actions{width:auto;margin:12px 18px 24px}}
    </style></head><body><main class="page"><div class="signed-meta"><span><strong>Vertragsnummer:</strong> ${escapeHtml(contract.number)}</span><span><strong>Abgeschlossen:</strong> ${escapeHtml(finishedAt)}</span></div>${contract.contractHtml}<div class="signed-signatures"><div class="signed-signature"><img src="${contract.signatures.seller}" alt="Unterschrift Verkäufer"><strong>${escapeHtml(sellerName)} · Verkäufer</strong></div><div class="signed-signature"><img src="${contract.signatures.buyer}" alt="Unterschrift Käufer"><strong>${escapeHtml(buyerName)} · Käufer</strong></div></div><div class="signed-footer">Fahrfolio-Prototyp · Elektronisch erfasster Vertragsstand. Finale Vertragsbedingungen und der Produktivprozess werden vor Veröffentlichung rechtlich geprüft.</div></main>${appendix}<div class="print-actions"><button onclick="window.print()">Drucken / als PDF speichern</button></div></body></html>`);
    win.document.close();
  }

  window.openFahrfolioSignedContract = enhancedSignedContract;
  setTimeout(renderContractSelector, 0);
})();