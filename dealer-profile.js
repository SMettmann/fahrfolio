(() => {
  const DEALER_STORAGE_KEY = 'fahrfolio-dealer-profile-v1';

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
        <h2>Einmal eintragen. In Verträgen automatisch verwenden.</h2>
        <p>Diese Angaben werden später als Verkäuferdaten in Kaufverträge, Angebote und weitere Dokumente übernommen.</p>
      </div>
      <span class="dealer-local-badge">Prototyp · nur lokal gespeichert</span>
    </div>

    <form id="dealerForm" class="dealer-card">
      <div class="form-section-title"><strong>Unternehmen</strong><small>Die Angaben, die auf Dokumenten erscheinen sollen.</small></div>
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
        <span>Diese Daten bleiben aktuell ausschließlich in diesem Browser. Für echte Händlerdaten verwenden wir später das geschützte Fahrfolio-Backend.</span>
      </div>

      <div class="modal-actions dealer-actions">
        <button type="submit" class="primary-btn">Händlerdaten speichern</button>
      </div>
    </form>`;
  main.appendChild(dealerView);

  const dealerForm = document.getElementById('dealerForm');
  const topAction = document.getElementById('openVehicleModal');

  function fillDealerForm() {
    const profile = loadDealerProfile();
    Object.entries(profile).forEach(([key, value]) => {
      if (dealerForm.elements[key]) dealerForm.elements[key].value = value ?? '';
    });
  }

  dealerForm.addEventListener('submit', event => {
    event.preventDefault();
    const profile = Object.fromEntries(new FormData(dealerForm).entries());
    saveDealerProfile(profile);
    showToast('Händlerdaten wurden gespeichert.');
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
})();
