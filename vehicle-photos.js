(() => {
  const DB_NAME = 'fahrfolio-media-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'vehiclePhotos';
  const MAX_PHOTOS = 8;
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = request.transaction.objectStore(STORE_NAME);
        }
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
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).index('vehicleId').getAll(vehicleId);
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

  async function savePhoto(photo) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(photo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function deletePhoto(photoId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(photoId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function setCover(vehicleId, photoId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.index('vehicleId').getAll(vehicleId);
      request.onsuccess = () => {
        (request.result || []).forEach(photo => {
          photo.isCover = photo.id === photoId;
          store.put(photo);
        });
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function coverPhoto(vehicleId) {
    const photos = await listPhotos(vehicleId);
    return photos.find(photo => photo.isCover) || photos[0] || null;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Bildformat konnte nicht verarbeitet werden.'));
        image.onload = () => {
          const maxWidth = 1200;
          const maxHeight = 900;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, width, height);
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
        <div><p class="eyebrow">FAHRZEUGFOTOS</p><h2 id="vehiclePhotoModalTitle">Fotos verwalten</h2></div>
        <button class="icon-btn" id="closeVehiclePhotoModal" aria-label="Schließen">×</button>
      </div>
      <div class="vehicle-photo-upload">
        <div class="vehicle-photo-upload-text"><strong>Fotos hinzufügen</strong><span>Bis zu ${MAX_PHOTOS} Bilder pro Fahrzeug. Sie werden automatisch verkleinert.</span></div>
        <label class="primary-btn vehicle-photo-upload-btn">+ Fotos auswählen<input id="vehiclePhotoInput" type="file" accept="image/*" multiple /></label>
      </div>
      <div id="vehiclePhotoGrid" class="vehicle-photo-grid"></div>
      <p class="vehicle-photo-storage-note">Prototyp: Fahrzeugfotos bleiben aktuell nur in diesem Browser gespeichert. Im Produktivsystem kommen sie in den geschützten Fahrfolio-Speicher.</p>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="doneVehiclePhotosBtn">Fertig</button></div>
    </div>`;
  document.body.appendChild(modal);

  const photoInput = document.getElementById('vehiclePhotoInput');
  const photoGrid = document.getElementById('vehiclePhotoGrid');
  const photoTitle = document.getElementById('vehiclePhotoModalTitle');

  const formPhotoBar = document.createElement('div');
  formPhotoBar.className = 'vehicle-photo-form-bar';
  formPhotoBar.hidden = true;
  formPhotoBar.innerHTML = `<div><strong>Fahrzeugfotos</strong><span id="vehicleFormPhotoCount">Noch keine Fotos</span></div><button type="button" class="secondary-btn" id="manageVehiclePhotosBtn">Fotos verwalten</button>`;
  const vehicleIdField = vehicleForm.elements.id;
  vehicleIdField.insertAdjacentElement('afterend', formPhotoBar);
  const formPhotoCount = document.getElementById('vehicleFormPhotoCount');

  const detailPhotoButton = document.createElement('button');
  detailPhotoButton.type = 'button';
  detailPhotoButton.className = 'secondary-btn';
  detailPhotoButton.id = 'detailPhotosBtn';
  detailPhotoButton.textContent = 'Fotos';
  const detailActions = document.querySelector('.detail-actions');
  if (detailActions) detailActions.insertBefore(detailPhotoButton, detailActions.children[1] || null);

  async function updateFormPhotoBar(vehicleId) {
    if (!vehicleId) {
      formPhotoBar.hidden = true;
      return;
    }
    formPhotoBar.hidden = false;
    try {
      const photos = await listPhotos(vehicleId);
      formPhotoCount.textContent = photos.length ? `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'} gespeichert` : 'Noch keine Fotos';
    } catch (error) {
      formPhotoCount.textContent = 'Fotos konnten nicht geladen werden';
    }
  }

  async function renderPhotoManager() {
    if (!activePhotoVehicleId) return;
    const vehicle = vehicles.find(item => item.id === activePhotoVehicleId);
    if (vehicle) photoTitle.textContent = `Fotos · ${vehicle.brand} ${vehicle.model}`;

    try {
      const photos = await listPhotos(activePhotoVehicleId);
      if (!photos.length) {
        photoGrid.innerHTML = '<div class="vehicle-photo-empty"><strong>Noch keine Fahrzeugfotos.</strong><br>Oben einfach ein oder mehrere Bilder auswählen.</div>';
        return;
      }

      photoGrid.innerHTML = photos.map(photo => `
        <div class="vehicle-photo-card" data-photo-id="${photo.id}">
          ${photo.isCover ? '<span class="vehicle-photo-cover-badge">Titelbild</span>' : ''}
          <img src="${photo.dataUrl}" alt="Fahrzeugfoto" />
          <div class="vehicle-photo-card-actions">
            ${photo.isCover ? '' : '<button type="button" class="ghost-btn set-photo-cover">Als Titelbild</button>'}
            <button type="button" class="ghost-btn delete-vehicle-photo">Löschen</button>
          </div>
        </div>`).join('');

      photoGrid.querySelectorAll('.set-photo-cover').forEach(button => {
        button.addEventListener('click', async () => {
          const photoId = button.closest('[data-photo-id]').dataset.photoId;
          await setCover(activePhotoVehicleId, photoId);
          await refreshPhotoUi(activePhotoVehicleId);
          showToast('Titelbild wurde geändert.');
        });
      });

      photoGrid.querySelectorAll('.delete-vehicle-photo').forEach(button => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-photo-id]');
          const photoId = card.dataset.photoId;
          const wasCover = Boolean(card.querySelector('.vehicle-photo-cover-badge'));
          if (!window.confirm('Dieses Fahrzeugfoto wirklich löschen?')) return;
          await deletePhoto(photoId);
          const remaining = await listPhotos(activePhotoVehicleId);
          if (wasCover && remaining.length && !remaining.some(photo => photo.isCover)) await setCover(activePhotoVehicleId, remaining[0].id);
          await refreshPhotoUi(activePhotoVehicleId);
          showToast('Foto wurde gelöscht.');
        });
      });
    } catch (error) {
      console.error(error);
      photoGrid.innerHTML = '<div class="vehicle-photo-empty">Fotos konnten in diesem Browser nicht geladen werden.</div>';
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
      const photos = await listPhotos(vehicleId);
      if (!photos.length || activeVehicleId !== vehicleId) return;
      const cover = photos.find(photo => photo.isCover) || photos[0];
      const section = document.createElement('section');
      section.className = 'vehicle-photo-detail';
      section.innerHTML = `
        <div class="vehicle-photo-main"><img src="${cover.dataUrl}" alt="Fahrzeugfoto" /><span class="vehicle-photo-count">${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}</span></div>
        ${photos.length > 1 ? `<div class="vehicle-photo-thumbs">${photos.map(photo => `<button type="button" class="vehicle-photo-thumb ${photo.id === cover.id ? 'active' : ''}" data-photo-id="${photo.id}"><img src="${photo.dataUrl}" alt="Fahrzeugfoto" /></button>`).join('')}</div>` : ''}`;

      const hero = content.querySelector('.detail-hero');
      if (hero) hero.insertAdjacentElement('afterend', section); else content.prepend(section);

      const mainImage = section.querySelector('.vehicle-photo-main img');
      section.querySelectorAll('.vehicle-photo-thumb').forEach(button => {
        button.addEventListener('click', () => {
          const photo = photos.find(item => item.id === button.dataset.photoId);
          if (!photo) return;
          mainImage.src = photo.dataUrl;
          section.querySelectorAll('.vehicle-photo-thumb').forEach(item => item.classList.toggle('active', item === button));
        });
      });
    } catch (error) {
      console.warn('Fahrzeugfotos konnten nicht dargestellt werden.', error);
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
    const files = Array.from(photoInput.files || []).filter(file => file.type.startsWith('image/'));
    photoInput.value = '';
    if (!files.length || !activePhotoVehicleId) return;

    try {
      const existing = await listPhotos(activePhotoVehicleId);
      const freeSlots = Math.max(0, MAX_PHOTOS - existing.length);
      if (!freeSlots) {
        showToast(`Maximal ${MAX_PHOTOS} Fotos pro Fahrzeug.`);
        return;
      }

      const selected = files.slice(0, freeSlots);
      showToast(`${selected.length} ${selected.length === 1 ? 'Foto wird' : 'Fotos werden'} verarbeitet …`);
      for (let index = 0; index < selected.length; index += 1) {
        const dataUrl = await compressImage(selected[index]);
        await savePhoto({
          id: crypto.randomUUID(),
          vehicleId: activePhotoVehicleId,
          dataUrl,
          isCover: existing.length === 0 && index === 0,
          createdAt: Date.now() + index
        });
      }

      await refreshPhotoUi(activePhotoVehicleId);
      if (files.length > freeSlots) showToast(`${selected.length} Fotos gespeichert. Maximal ${MAX_PHOTOS} möglich.`);
      else showToast(`${selected.length} ${selected.length === 1 ? 'Foto' : 'Fotos'} gespeichert.`);
    } catch (error) {
      console.error(error);
      showToast('Mindestens ein Foto konnte nicht verarbeitet werden.');
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
