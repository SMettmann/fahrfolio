(() => {
  const DEALER_STORAGE_KEY = 'fahrfolio-dealer-profile-v1';
  let currentLogoData = '';

  function loadDealerProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEALER_STORAGE_KEY));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) {
      console.warn('Händlerdaten konnten nicht geladen werden.', error);
      return {};
    }
  }

  function saveDealerProfile(profile) {
    localStorage.setItem(DEALER_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('fahrfolio:dealer-profile-changed', { detail: profile }));
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxWidth = 900;
          const maxHeight = 420;
          const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.getFahrfolioDealerProfile = loadDealerProfile;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'dealer-profile.css';
  document.head.appendChild(stylesheet);

  const nav = document.querySelector('.nav');
  const dealerButton = document.createElement('button');
  dealerButton.className = 'nav-item';
  dealerButton.dataset.view = 'dealer';
  dealerButton.innerHTML = '<span>🏢</span>Händlerdaten';
  nav.appendChild(dealerButton);

  const main = document.querySelector('.main');
  const dealerView = document.createElement('section');
  dealerView.id = 'dealerView';
  dealerView.className = 'view';
  dealerView.innerHTML = `
    <div class="dealer-intro">
      <div>
        <p class="eyebrow">HÄNDLERDATEN</p>
        <h2>Einmal eintragen. Überall verwenden.</h2>
        <p>Firmenangaben und Logo werden automatisch für Verkaufsschild, Kaufvertrag und spätere Dokumente übernommen.</p>
      </div>
      <span class="dealer-local-badge">Prototyp · nur lokal gespeichert</span>
    </div>

    <form id="dealerForm" class="dealer-card">
      <div class="form-section-title"><strong>Autohaus & Logo</strong><small>Das Logo erscheint später auf deinen Verkaufsunterlagen.</small></div>
      <div class="dealer-logo-row">
        <div class="dealer-logo-preview" id="dealerLogoPreview"><span>Noch kein Logo</span></div>
        <div class="dealer-logo-controls">
          <label class="dealer-logo-upload">Logo auswählen<input id="dealerLogoInput" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <button type="button" class="ghost-btn" id="removeDealerLogo">Logo entfernen</button>
          <small>PNG, JPG oder WebP. Das Bild wird automatisch verkleinert.</small>
        </div>
      </div>

      <div class="form-section-title"><strong>Unternehmen</strong><small>Die Angaben, die auf Unterlagen erscheinen sollen.</small></div>
      <div class="form-grid two-cols dealer-grid">
        <label>Firmenname*<input name="company" required placeholder="z. B. Muster Automobile" /></label>
        <label>Inhaber / Ansprechpartner<input name="contactName" placeholder="z. B. Max Mustermann" /></label>
        <label>Straße / Hausnummer<input name="street" placeholder="z. B. Hauptstraße 12" /></label>
        <label>PLZ<input name="zip" inputmode="numeric" placeholder="89522" /></label>
        <label>Ort<input name="city" placeholder="Heidenheim" /></label>
        <label>Telefon<input name="phone" type="tel" placeholder="07321 …" /></label>
        <label>E-Mail<input name="email" type="email" placeholder="verkauf@autohaus.de" /></label>
        <label>Website<input name="website" placeholder="www.autohaus.de" /></label>
      </div>

      <div class="form-section-title"><strong>Geschäftsangaben</strong><small>Optional – später z. B. für Rechnungen und Pflichtangaben.</small></div>
      <div class="form-grid two-cols dealer-grid">
        <label>USt-IdNr. (optional)<input name="vatId" placeholder="DE…" /></label>
        <label>Steuernummer (optional)<input name="taxNumber" placeholder="nur falls benötigt" /></label>
      </div>

      <div class="dealer-privacy-note">
        <strong>Datenschutz im Prototyp</strong>
        <span>Diese Daten und das Logo bleiben aktuell ausschließlich in diesem Browser. Echte Händler- und Kundendaten kommen später in das geschützte Fahrfolio-Backend.</span>
      </div>

      <div class="modal-actions dealer-actions">
        <button type="submit" class="primary-btn">Händlerdaten speichern</button>
      </div>
    </form>`;
  main.appendChild(dealerView);

  const dealerForm = document.getElementById('dealerForm');
  const logoInput = document.getElementById('dealerLogoInput');
  const logoPreview = document.getElementById('dealerLogoPreview');
  const removeLogoButton = document.getElementById('removeDealerLogo');
  const topAction = document.getElementById('openVehicleModal');

  function renderLogoPreview() {
    logoPreview.innerHTML = currentLogoData
      ? `<img src="${currentLogoData}" alt="Händlerlogo" />`
      : '<span>Noch kein Logo</span>';
    removeLogoButton.disabled = !currentLogoData;
  }

  function fillDealerForm() {
    const profile = loadDealerProfile();
    currentLogoData = profile.logoData || '';
    Object.entries(profile).forEach(([key, value]) => {
      if (key !== 'logoData' && dealerForm.elements[key]) dealerForm.elements[key].value = value ?? '';
    });
    renderLogoPreview();
  }

  logoInput.addEventListener('change', async () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Bitte eine Bilddatei auswählen.');
      logoInput.value = '';
      return;
    }
    try {
      currentLogoData = await compressImage(file);
      renderLogoPreview();
      showToast('Logo vorbereitet. Jetzt Händlerdaten speichern.');
    } catch (error) {
      console.error(error);
      showToast('Logo konnte nicht verarbeitet werden.');
    }
  });

  removeLogoButton.addEventListener('click', () => {
    currentLogoData = '';
    logoInput.value = '';
    renderLogoPreview();
  });

  dealerForm.addEventListener('submit', event => {
    event.preventDefault();
    const profile = Object.fromEntries(new FormData(dealerForm).entries());
    profile.logoData = currentLogoData;
    saveDealerProfile(profile);
    showToast('Händlerdaten und Logo wurden gespeichert.');
  });

  const originalSetView = setView;
  setView = function(name) {
    if (name === 'dealer') {
      Object.values(views).forEach(element => element.classList.remove('active-view'));
      dealerView.classList.add('active-view');
      document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'dealer'));
      document.getElementById('pageTitle').textContent = 'Händlerdaten';
      topAction.style.visibility = 'hidden';
      fillDealerForm();
      return;
    }

    dealerView.classList.remove('active-view');
    topAction.style.visibility = '';
    originalSetView(name);
  };

  dealerButton.addEventListener('click', () => setView('dealer'));
  fillDealerForm();

  // Fahrzeug bearbeiten darf nicht versehentlich durch Hintergrundklick oder Escape schließen.
  const vehicleEditModal = document.getElementById('vehicleModal');
  if (vehicleEditModal) {
    vehicleEditModal.addEventListener('click', event => {
      if (event.target === vehicleEditModal) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && vehicleEditModal.classList.contains('open')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  if (!document.querySelector('script[data-fahrfolio-offer-flow]')) {
    const script = document.createElement('script');
    script.src = 'offer-flow.js';
    script.dataset.fahrfolioOfferFlow = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-fahrfolio-sales-sign]')) {
    const script = document.createElement('script');
    script.src = 'sales-sign-enhancements.js';
    script.dataset.fahrfolioSalesSign = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-fahrfolio-purchase-flow]')) {
    const script = document.createElement('script');
    script.src = 'purchase-flow.js';
    script.dataset.fahrfolioPurchaseFlow = 'true';
    document.body.appendChild(script);
  }
})();
