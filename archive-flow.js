(() => {
  const KEYS = {
    contracts: 'fahrfolio-contracts-v1',
    offers: 'fahrfolio-offers-v1',
    purchases: 'fahrfolio-purchases-v1',
    damages: 'fahrfolio-damages-v1'
  };

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'archive-flow.css';
  document.head.appendChild(stylesheet);

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function contracts() {
    return typeof window.getFahrfolioContracts === 'function' ? window.getFahrfolioContracts() : readList(KEYS.contracts);
  }
  function offers() {
    return typeof window.getFahrfolioOffers === 'function' ? window.getFahrfolioOffers() : readList(KEYS.offers);
  }
  function purchases() {
    return typeof window.getFahrfolioPurchases === 'function' ? window.getFahrfolioPurchases() : readList(KEYS.purchases);
  }
  function damages() { return readList(KEYS.damages); }

  function dateMs(value) {
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function dateText(value) {
    const ms = dateMs(value);
    if (!ms) return 'Datum unbekannt';
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
  }

  function personName(person) {
    if (!person) return '';
    if (person.name) return person.name;
    return `${person.firstName || ''} ${person.lastName || ''}`.trim();
  }

  function vehicleLabel(vehicle) {
    return vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Fahrzeug' : 'Fahrzeug';
  }

  function sameVehicle(snapshot, vehicle) {
    if (!snapshot || !vehicle) return false;
    if (snapshot.id && snapshot.id === vehicle.id) return true;
    const a = String(snapshot.vin || '').trim().toUpperCase();
    const b = String(vehicle.vin || '').trim().toUpperCase();
    return Boolean(a && b && a === b);
  }

  function archiveEntries() {
    const items = [];
    contracts().forEach(item => items.push({
      id: item.id, type: 'contract', typeLabel: 'Kaufvertrag', number: item.number || 'Kaufvertrag', createdAt: item.createdAt,
      vehicle: item.vehicle, party: personName(item.customer), amount: item.sale?.price, source: item
    }));
    offers().forEach(item => items.push({
      id: item.id, type: 'offer', typeLabel: 'Angebot', number: item.number || 'Angebot', createdAt: item.createdAt,
      vehicle: item.vehicle, party: personName(item.customer), amount: item.price, source: item
    }));
    purchases().forEach(item => items.push({
      id: item.id, type: 'purchase', typeLabel: 'Ankaufsvertrag', number: item.number || 'Ankauf', createdAt: item.createdAt,
      vehicle: item.vehicle, party: personName(item.seller), amount: item.purchase?.price, source: item
    }));
    return items.sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt));
  }

  const nav = document.querySelector('.nav');
  const archiveNav = document.createElement('button');
  archiveNav.className = 'nav-item';
  archiveNav.dataset.view = 'archive';
  archiveNav.innerHTML = '<span>🗂</span>Archiv';
  const dealerNav = nav?.querySelector('[data-view="dealer"]');
  if (nav) nav.insertBefore(archiveNav, dealerNav || null);

  const archiveView = document.createElement('section');
  archiveView.id = 'archiveView';
  archiveView.className = 'view';
  archiveView.innerHTML = `
    <div class="archive-hero">
      <div><p class="eyebrow">ARCHIV</p><h2>Alle erstellten Vorgänge an einem Ort.</h2><p>Angebote, Kaufverträge und Ankaufsverträge werden hier aus den bereits gespeicherten Vorgängen zusammengeführt.</p></div>
    </div>
    <div class="archive-toolbar">
      <div class="search-wrap"><span>⌕</span><input id="archiveSearch" type="search" placeholder="Fahrzeug, Person oder Nummer suchen …"></div>
      <select id="archiveType" aria-label="Vorgang filtern"><option value="all">Alle Vorgänge</option><option value="contract">Kaufverträge</option><option value="offer">Angebote</option><option value="purchase">Ankaufsverträge</option></select>
    </div>
    <div id="archiveList" class="archive-list"></div>`;

  const main = document.querySelector('.main');
  if (main) main.appendChild(archiveView);
  if (typeof views === 'object' && views) views.archive = archiveView;
  if (typeof titles === 'object' && titles) titles.archive = 'Archiv';

  const searchInput = document.getElementById('archiveSearch');
  const typeSelect = document.getElementById('archiveType');
  const archiveList = document.getElementById('archiveList');

  function openEntry(type, id) {
    if (type === 'contract') {
      const item = contracts().find(entry => entry.id === id);
      if (item && typeof window.openFahrfolioSignedContract === 'function') return window.openFahrfolioSignedContract(item);
    }
    if (type === 'offer') {
      const item = offers().find(entry => entry.id === id);
      if (item && typeof window.openFahrfolioOfferDocument === 'function') return window.openFahrfolioOfferDocument(item);
    }
    if (type === 'purchase') {
      const item = purchases().find(entry => entry.id === id);
      if (item && typeof window.openFahrfolioPurchaseDocument === 'function') return window.openFahrfolioPurchaseDocument(item);
    }
    showToast('Dieser Vorgang kann gerade nicht geöffnet werden.');
  }

  function renderArchive() {
    if (!archiveList) return;
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const type = typeSelect?.value || 'all';
    const filtered = archiveEntries().filter(item => {
      if (type !== 'all' && item.type !== type) return false;
      const haystack = [item.number, item.typeLabel, vehicleLabel(item.vehicle), item.vehicle?.vin, item.party].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });

    if (!filtered.length) {
      archiveList.innerHTML = '<div class="archive-empty"><strong>Noch keine passenden Vorgänge.</strong><br>Erstellte Angebote und abgeschlossene Verträge erscheinen automatisch hier.</div>';
      return;
    }

    archiveList.innerHTML = filtered.map(item => `
      <article class="archive-card" data-archive-type="${item.type}" data-archive-id="${item.id}">
        <div class="archive-card-main"><div class="archive-card-top"><span class="archive-type">${escapeHtml(item.typeLabel)}</span><span class="archive-number">${escapeHtml(item.number)}</span></div><h3>${escapeHtml(vehicleLabel(item.vehicle))}</h3><p>${escapeHtml(item.party || 'Keine Person hinterlegt')} · ${escapeHtml(dateText(item.createdAt))}${item.vehicle?.vin ? ` · FIN ${escapeHtml(item.vehicle.vin)}` : ''}</p></div>
        <div class="archive-card-side">${Number(item.amount || 0) ? `<strong>${formatCurrency(item.amount)}</strong>` : '<span></span>'}<button type="button" class="secondary-btn archive-open">Öffnen</button></div>
      </article>`).join('');
  }

  archiveList?.addEventListener('click', event => {
    const button = event.target.closest('.archive-open');
    if (!button) return;
    const card = button.closest('[data-archive-id]');
    openEntry(card.dataset.archiveType, card.dataset.archiveId);
  });
  searchInput?.addEventListener('input', renderArchive);
  typeSelect?.addEventListener('change', renderArchive);

  archiveNav.addEventListener('click', () => {
    setView('archive');
    renderArchive();
    const topAction = document.getElementById('openVehicleModal');
    if (topAction) topAction.hidden = true;
  });

  document.querySelectorAll('.nav-item:not([data-view="archive"]):not([data-view="purchase"])').forEach(button => button.addEventListener('click', () => {
    const topAction = document.getElementById('openVehicleModal');
    if (topAction && button.dataset.view !== 'dealer') topAction.hidden = false;
  }));

  function vehicleEvents(vehicle) {
    const items = [];
    purchases().filter(item => sameVehicle(item.vehicle, vehicle)).forEach(item => items.push({
      type: 'purchase', id: item.id, createdAt: item.createdAt, title: 'Fahrzeug angekauft',
      detail: `${item.number || 'Ankauf'} · ${personName(item.seller) || 'Verkäufer'} · ${formatCurrency(item.purchase?.price || 0)}`,
      action: 'Vertrag öffnen'
    }));
    offers().filter(item => sameVehicle(item.vehicle, vehicle)).forEach(item => items.push({
      type: 'offer', id: item.id, createdAt: item.createdAt, title: 'Angebot erstellt',
      detail: `${item.number || 'Angebot'} · ${personName(item.customer) || 'Kunde'} · ${formatCurrency(item.price || 0)}`,
      action: 'Angebot öffnen'
    }));
    damages().filter(item => item.vehicleId === vehicle.id).forEach(item => items.push({
      type: 'damage', id: item.id, createdAt: item.createdAt, title: 'Schaden dokumentiert',
      detail: `${item.title || 'Schaden'} · ${item.description || 'Keine Beschreibung'}`,
      action: 'Schäden öffnen'
    }));
    contracts().filter(item => sameVehicle(item.vehicle, vehicle)).forEach(item => items.push({
      type: 'contract', id: item.id, createdAt: item.createdAt, title: 'Fahrzeug verkauft',
      detail: `${item.number || 'Kaufvertrag'} · ${personName(item.customer) || 'Käufer'} · ${formatCurrency(item.sale?.price || 0)}`,
      action: 'Vertrag öffnen'
    }));
    return items.sort((a, b) => dateMs(a.createdAt) - dateMs(b.createdAt));
  }

  function renderVehicleHistory(vehicleId) {
    const content = document.getElementById('vehicleDetailContent');
    const vehicle = vehicles.find(item => item.id === vehicleId);
    if (!content || !vehicle) return;
    content.querySelector('.archive-history-section')?.remove();
    content.querySelector('.purchase-detail-section')?.remove();
    const events = vehicleEvents(vehicle);
    const section = document.createElement('div');
    section.className = 'detail-section history-section archive-history-section';
    section.innerHTML = `<div class="history-head"><h3>Verlauf</h3><span>${events.length} ${events.length === 1 ? 'Vorgang' : 'Vorgänge'}</span></div>${events.length ? `<div class="history-list">${events.map(item => `<div class="history-item" data-history-type="${item.type}" data-history-id="${item.id}"><div class="history-dot"></div><div class="history-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)} · ${escapeHtml(dateText(item.createdAt))}</span></div><button type="button" class="ghost-btn history-action">${escapeHtml(item.action)}</button></div>`).join('')}</div>` : '<div class="history-empty">Noch keine gespeicherten Vorgänge zu diesem Fahrzeug.</div>'}`;
    section.addEventListener('click', event => {
      const button = event.target.closest('.history-action');
      if (!button) return;
      const row = button.closest('[data-history-type]');
      if (row.dataset.historyType === 'damage') return document.getElementById('detailDamageBtn')?.click();
      openEntry(row.dataset.historyType, row.dataset.historyId);
    });
    content.appendChild(section);
  }

  window.renderFahrfolioVehicleHistory = renderVehicleHistory;

  const detailModal = document.getElementById('vehicleDetailModal');
  if (detailModal) {
    new MutationObserver(() => {
      if (!detailModal.classList.contains('open')) return;
      setTimeout(() => renderVehicleHistory(activeVehicleId), 0);
    }).observe(detailModal, { attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('storage', renderArchive);
  renderArchive();
})();