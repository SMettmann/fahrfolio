(() => {
  const DB_NAME = 'fahrfolio-media-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'vehiclePhotos';
  let activePhotoVehicleId = null;
  let dbPromise = null;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'vehicle-photos.css';
  document.head.appendChild(stylesheet);

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB wird von diesem Browser nicht unterstützt.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        let store;
        if (!db.objectStoreNames.contains(STORE_NAME)) store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        else store = request.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains('vehicleId')) store.createIndex('vehicleId', 'vehicleId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Bildspeicher konnte nicht geöffnet werden.'));
    });
    return dbPromise;
  }

  async function listPhotos(vehicleId) {
    if (!vehicleId) return [];
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).index('vehicleId').getAll(vehicleId);
      request.onsuccess = () => {
        const photos = request.result || [];
        photos.sort((a, b) => {
          if (Boolean(a.isCover) !== Boolean(b.isCover)) return a.isCover ? -1 : 1;
          return Number(a.createdAt || 0) - Number(b.createdAt || 0);
        });
        resolve(photos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function coverPhoto(vehicleId) {
    const photos = await listPhotos(vehicleId);
    return photos.find(photo => photo.isCover) || photos[0] || null;
  }

  async function savePhoto(photo) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(photo);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deletePhotosForVehicle(vehicleId) {
    const existing = await listPhotos(vehicleId);
    if (!existing.length) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      existing.forEach(photo => store.delete(photo.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Bildformat konnte nicht verarbeitet werden.'));
        image.onload = () => {
          const scale = Math.min(1, 1200 / image.width, 900 / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.76));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vehiclePhotoModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal vehicle-photo-modal" role="dialog" aria-modal="true" aria-labelledby="vehiclePhotoModalTitle">
      <div class="modal-head">
        <div><p class="eyebrow">TITELBILD</p><h2 id="vehiclePhotoModalTitle">Fahrzeugbild</h2></div>
        <button class="icon-btn" id="closeVehiclePhotoModal" aria-label="Schließen">×</button>
      </div>
      <div class="vehicle-photo-upload">
        <div class="vehicle-photo-upload-text"><strong>Ein Titelbild pro Fahrzeug</strong><span>Nur zur schnellen Wiedererkennung in Fahrfolio. Schadensfotos werden separat beim jeweiligen Schaden dokumentiert.</span></div>
        <label class="primary-btn vehicle-photo-upload-btn">Titelbild auswählen<input id="vehiclePhotoInput" type="file" accept="image/*" /></label>
      </div>
      <div id="vehiclePhotoGrid" class="vehicle-photo-grid"></div>
      <p class="vehicle-photo-storage-note">Prototyp: Das Titelbild bleibt aktuell nur in diesem Browser gespeichert.</p>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="doneVehiclePhotosBtn">Fertig</button></div>
    </div>`;
  document.body.appendChild(modal);

  const photoInput = document.getElementById('vehiclePhotoInput');
  const photoGrid = document.getElementById('vehiclePhotoGrid');
  const photoTitle = document.getElementById('vehiclePhotoModalTitle');

  const formPhotoBar = document.createElement('div');
  formPhotoBar.className = 'vehicle-photo-form-bar';
  formPhotoBar.hidden = true;
  formPhotoBar.innerHTML = `<div><strong>Titelbild</strong><span id="vehicleFormPhotoCount">Noch kein Titelbild</span></div><button type="button" class="secondary-btn" id="manageVehiclePhotosBtn">Titelbild verwalten</button>`;
  const vehicleIdField = vehicleForm.elements.id;
  vehicleIdField.insertAdjacentElement('afterend', formPhotoBar);
  const formPhotoCount = document.getElementById('vehicleFormPhotoCount');

  const detailPhotoButton = document.createElement('button');
  detailPhotoButton.type = 'button';
  detailPhotoButton.className = 'secondary-btn';
  detailPhotoButton.id = 'detailPhotosBtn';
  detailPhotoButton.textContent = 'Titelbild';
  const detailActions = document.querySelector('.detail-actions');
  if (detailActions) detailActions.insertBefore(detailPhotoButton, detailActions.children[1] || null);

  async function updateFormPhotoBar(vehicleId) {
    if (!vehicleId) {
      formPhotoBar.hidden = true;
      return;
    }
    formPhotoBar.hidden = false;
    try {
      formPhotoCount.textContent = await coverPhoto(vehicleId) ? 'Titelbild gespeichert' : 'Noch kein Titelbild';
    } catch (error) {
      formPhotoCount.textContent = 'Titelbild konnte nicht geladen werden';
    }
  }

  async function renderPhotoManager() {
    if (!activePhotoVehicleId) return;
    const vehicle = vehicles.find(item => item.id === activePhotoVehicleId);
    if (vehicle) photoTitle.textContent = `Titelbild · ${vehicle.brand} ${vehicle.model}`;
    try {
      const photos = await listPhotos(activePhotoVehicleId);
      const photo = photos.find(item => item.isCover) || photos[0] || null;
      if (!photo) {
        photoGrid.innerHTML = '<div class="vehicle-photo-empty"><strong>Noch kein Titelbild.</strong><br>Oben ein Fahrzeugbild auswählen.</div>';
        return;
      }
      photoGrid.innerHTML = `
        <div class="vehicle-photo-card" data-photo-id="${photo.id}">
          <span class="vehicle-photo-cover-badge">Titelbild</span>
          <img src="${photo.dataUrl}" alt="Titelbild des Fahrzeugs" />
          <div class="vehicle-photo-card-actions"><button type="button" class="ghost-btn delete-vehicle-photo">Titelbild löschen</button></div>
        </div>`;
      photoGrid.querySelector('.delete-vehicle-photo').addEventListener('click', async () => {
        if (!window.confirm('Titelbild wirklich löschen?')) return;
        await deletePhotosForVehicle(activePhotoVehicleId);
        await refreshPhotoUi(activePhotoVehicleId);
        showToast('Titelbild wurde gelöscht.');
      });
    } catch (error) {
      console.error(error);
      photoGrid.innerHTML = '<div class="vehicle-photo-empty">Titelbild konnte in diesem Browser nicht geladen werden.</div>';
    }
  }

  async function decorateVehicleCard(node, vehicleId) {
    try {
      const photo = await coverPhoto(vehicleId);
      if (!photo) return;
      const visual = node.querySelector('.vehicle-visual');
      if (!visual || visual.querySelector('.vehicle-cover-photo')) return;
      const image = document.createElement('img');
      image.className = 'vehicle-cover-photo';
      image.src = photo.dataUrl;
      image.alt = 'Titelbild des Fahrzeugs';
      visual.prepend(image);
      visual.classList.add('has-photo');
    } catch (error) {
      console.warn('Titelbild konnte nicht geladen werden.', error);
    }
  }

  async function decorateVehicleDetail(vehicleId) {
    const content = document.getElementById('vehicleDetailContent');
    if (!content) return;
    content.querySelector('.vehicle-photo-detail')?.remove();
    try {
      const photo = await coverPhoto(vehicleId);
      if (!photo || activeVehicleId !== vehicleId) return;
      const section = document.createElement('section');
      section.className = 'vehicle-photo-detail';
      section.innerHTML = `<div class="vehicle-photo-main"><img src="${photo.dataUrl}" alt="Titelbild des Fahrzeugs" /></div>`;
      const hero = content.querySelector('.detail-hero');
      if (hero) hero.insertAdjacentElement('afterend', section); else content.prepend(section);
    } catch (error) {
      console.warn('Titelbild konnte nicht dargestellt werden.', error);
    }
  }

  async function refreshPhotoUi(vehicleId) {
    await renderPhotoManager();
    await updateFormPhotoBar(vehicleIdField.value);
    renderVehicles();
    if (detailModal.classList.contains('open') && activeVehicleId === vehicleId) await decorateVehicleDetail(vehicleId);
  }

  async function openPhotoManager(vehicleId) {
    const vehicle = vehicles.find(item => item.id === vehicleId);
    if (!vehicle) return showToast('Bitte das Fahrzeug zuerst speichern.');
    activePhotoVehicleId = vehicleId;
    openModal(modal);
    await renderPhotoManager();
  }

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    photoInput.value = '';
    if (!file || !file.type.startsWith('image/') || !activePhotoVehicleId) return;
    try {
      showToast('Titelbild wird verarbeitet …');
      const dataUrl = await compressImage(file);
      await deletePhotosForVehicle(activePhotoVehicleId);
      await savePhoto({ id: crypto.randomUUID(), vehicleId: activePhotoVehicleId, dataUrl, isCover: true, createdAt: Date.now() });
      await refreshPhotoUi(activePhotoVehicleId);
      showToast('Titelbild wurde gespeichert.');
    } catch (error) {
      console.error(error);
      showToast('Titelbild konnte nicht verarbeitet werden.');
    }
  });

  document.getElementById('closeVehiclePhotoModal').addEventListener('click', () => closeModal(modal));
  document.getElementById('doneVehiclePhotosBtn').addEventListener('click', () => closeModal(modal));
  document.getElementById('manageVehiclePhotosBtn').addEventListener('click', () => openPhotoManager(vehicleIdField.value));
  detailPhotoButton.addEventListener('click', () => openPhotoManager(activeVehicleId));

  const originalCreateVehicleCard = createVehicleCard;
  createVehicleCard = function(vehicle, compact = false) {
    const node = originalCreateVehicleCard(vehicle, compact);
    decorateVehicleCard(node, vehicle.id);
    return node;
  };

  const originalOpenVehicleDetail = openVehicleDetail;
  openVehicleDetail = function(vehicleId) {
    originalOpenVehicleDetail(vehicleId);
    decorateVehicleDetail(vehicleId);
  };

  const originalOpenVehicleForm = openVehicleForm;
  openVehicleForm = function(vehicle = null) {
    originalOpenVehicleForm(vehicle);
    updateFormPhotoBar(vehicle?.id || '');
  };

  renderVehicles();
})();