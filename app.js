const VEHICLE_STORAGE_KEY = 'fahrfolio-vehicles-v1';
const CUSTOMER_STORAGE_KEY = 'fahrfolio-customers-v1';

const demoVehicles = [
  { id: crypto.randomUUID(), brand: 'Volkswagen', model: 'Golf 1.5 TSI', vin: 'WVWZZZCDZPW123456', plate: 'HDH-FF 101', firstRegistration: '2022-06', mileage: 48200, hp: 150, kw: 110, fuel: 'Benzin', transmission: 'Automatik', inspection: '2028-06', owners: 2, price: 19990, purchasePrice: 16200, status: 'stock', color: 'Deep Black', equipment: 'Navigation, LED-Scheinwerfer, Sitzheizung, ACC, Einparkhilfe', notes: '' },
  { id: crypto.randomUUID(), brand: 'BMW', model: '320d Touring', vin: 'WBA6L71020G123456', plate: 'HDH-FF 202', firstRegistration: '2021-03', mileage: 87400, hp: 190, kw: 140, fuel: 'Diesel', transmission: 'Automatik', inspection: '2027-03', owners: 1, price: 24900, purchasePrice: 20800, status: 'reserved', color: 'Mineralgrau', equipment: 'Business Navigation, LED, Klimaautomatik, PDC, Tempomat', notes: 'Leichte Gebrauchsspuren an Felge vorne rechts.' },
  { id: crypto.randomUUID(), brand: 'Mercedes-Benz', model: 'A 200', vin: 'W1K1770871J123456', plate: 'HDH-FF 303', firstRegistration: '2023-01', mileage: 31000, hp: 163, kw: 120, fuel: 'Benzin', transmission: 'Automatik', inspection: '2028-01', owners: 1, price: 27500, purchasePrice: 23200, status: 'sold', color: 'Digitalweiß', equipment: 'MBUX, LED High Performance, Rückfahrkamera, Sitzheizung', notes: '' }
];

const demoCustomers = [
  { id: crypto.randomUUID(), firstName: 'Max', lastName: 'Mustermann', street: 'Musterstraße 12', zip: '89522', city: 'Heidenheim', phone: '0171 1234567', email: 'max@example.de', birthDate: '1988-05-14' },
  { id: crypto.randomUUID(), firstName: 'Anna', lastName: 'Beispiel', street: 'Brenzweg 4', zip: '89537', city: 'Giengen', phone: '0151 9876543', email: 'anna@example.de', birthDate: '1992-11-02' }
];

let vehicles = loadCollection(VEHICLE_STORAGE_KEY, demoVehicles);
let customers = loadCollection(CUSTOMER_STORAGE_KEY, demoCustomers);
let activeVehicleId = null;

const views = {
  dashboard: document.getElementById('dashboardView'),
  vehicles: document.getElementById('vehiclesView'),
  customers: document.getElementById('customersView'),
  documents: document.getElementById('documentsView')
};
const titles = { dashboard: 'Übersicht', vehicles: 'Fahrzeuge', customers: 'Kunden', documents: 'Dokumente' };
const vehicleModal = document.getElementById('vehicleModal');
const vehicleForm = document.getElementById('vehicleForm');
const customerModal = document.getElementById('customerModal');
const customerForm = document.getElementById('customerForm');
const detailModal = document.getElementById('vehicleDetailModal');
const contractModal = document.getElementById('contractModal');
const vehicleCardTemplate = document.getElementById('vehicleCardTemplate');
const customerCardTemplate = document.getElementById('customerCardTemplate');

function loadCollection(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.warn('Lokale Fahrfolio-Daten konnten nicht geladen werden.', error);
  }
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback.map(item => ({ ...item }));
}

function saveVehicles() { localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(vehicles)); }
function saveCustomers() { localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers)); }

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatNumber(value) { return new Intl.NumberFormat('de-DE').format(Number(value || 0)); }
function formatMonth(value) {
  if (!value) return '—';
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T12:00:00`));
}
function statusInfo(status) {
  return { stock: ['Im Bestand', 'status-stock'], reserved: ['Reserviert', 'status-reserved'], sold: ['Verkauft', 'status-sold'] }[status] || ['Im Bestand', 'status-stock'];
}
function fullName(customer) { return `${customer.firstName || ''} ${customer.lastName || ''}`.trim(); }

function createVehicleCard(vehicle, compact = false) {
  const node = vehicleCardTemplate.content.firstElementChild.cloneNode(true);
  const [statusText, statusClass] = statusInfo(vehicle.status);
  const badge = node.querySelector('.status-badge');
  badge.textContent = statusText;
  badge.classList.add(statusClass);
  node.querySelector('.vehicle-brand').textContent = vehicle.brand;
  node.querySelector('.vehicle-model').textContent = vehicle.model;
  node.querySelector('.vehicle-price').textContent = formatCurrency(vehicle.price);
  const meta = [`${formatNumber(vehicle.mileage)} km`, vehicle.hp ? `${vehicle.hp} PS` : null, vehicle.fuel, vehicle.firstRegistration ? `EZ ${formatMonth(vehicle.firstRegistration)}` : null].filter(Boolean);
  node.querySelector('.vehicle-meta').innerHTML = meta.map(item => `<span>${escapeHtml(item)}</span>`).join('');
  node.querySelector('.vehicle-id').textContent = `FIN: ${vehicle.vin || '—'} · ${vehicle.plate || 'kein Kennzeichen'}`;
  node.querySelector('.action-open').addEventListener('click', () => openVehicleDetail(vehicle.id));
  node.querySelector('.action-sign').addEventListener('click', () => printSalesSign(vehicle.id));
  node.querySelector('.action-contract').addEventListener('click', () => openContract(vehicle.id));
  if (compact) {
    node.querySelector('.vehicle-actions').remove();
    node.querySelector('.vehicle-visual').style.height = '105px';
    node.addEventListener('click', () => openVehicleDetail(vehicle.id));
    node.classList.add('clickable');
  }
  return node;
}

function renderVehicles() {
  const query = document.getElementById('vehicleSearch').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const filtered = vehicles.filter(v => {
    const haystack = [v.brand, v.model, v.vin, v.plate, v.color].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (status === 'all' || v.status === status);
  });
  const grid = document.getElementById('vehicleGrid');
  grid.innerHTML = '';
  if (!filtered.length) grid.innerHTML = '<div class="no-results"><strong>Kein Fahrzeug gefunden.</strong><br>Suchbegriff oder Filter ändern.</div>';
  else filtered.forEach(v => grid.appendChild(createVehicleCard(v)));

  const dashboardGrid = document.getElementById('dashboardVehicles');
  dashboardGrid.innerHTML = '';
  vehicles.slice(0, 3).forEach(v => dashboardGrid.appendChild(createVehicleCard(v, true)));
  renderStats();
}

function renderStats() {
  const stock = vehicles.filter(v => v.status === 'stock');
  document.getElementById('statStock').textContent = stock.length;
  document.getElementById('statReserved').textContent = vehicles.filter(v => v.status === 'reserved').length;
  document.getElementById('statSold').textContent = vehicles.filter(v => v.status === 'sold').length;
  document.getElementById('statValue').textContent = formatCurrency(stock.reduce((sum, v) => sum + Number(v.price || 0), 0));
}

function createCustomerCard(customer) {
  const node = customerCardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('.avatar').textContent = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase();
  node.querySelector('.customer-name').textContent = fullName(customer);
  node.querySelector('.customer-address').textContent = [customer.street, `${customer.zip || ''} ${customer.city || ''}`.trim()].filter(Boolean).join(' · ') || 'Adresse noch nicht hinterlegt';
  node.querySelector('.customer-contact').textContent = [customer.phone, customer.email].filter(Boolean).join(' · ') || 'Keine Kontaktdaten';
  node.querySelector('.customer-contract').addEventListener('click', () => openContract(null, customer.id));
  return node;
}

function renderCustomers() {
  const query = document.getElementById('customerSearch').value.trim().toLowerCase();
  const filtered = customers.filter(c => [c.firstName, c.lastName, c.email, c.city, c.phone].join(' ').toLowerCase().includes(query));
  const grid = document.getElementById('customerGrid');
  grid.innerHTML = '';
  if (!filtered.length) grid.innerHTML = '<div class="no-results"><strong>Kein Kunde gefunden.</strong><br>Neuen Kunden anlegen oder Suche ändern.</div>';
  else filtered.forEach(c => grid.appendChild(createCustomerCard(c)));
}

function setView(name) {
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('active-view', key === name));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  document.getElementById('pageTitle').textContent = titles[name];
  if (name === 'vehicles') renderVehicles();
  if (name === 'customers') renderCustomers();
}

function openModal(modal) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeModal(modal) {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openVehicleForm(vehicle = null) {
  vehicleForm.reset();
  document.getElementById('vehicleModalTitle').textContent = vehicle ? 'Fahrzeug bearbeiten' : 'Fahrzeug anlegen';
  if (vehicle) Object.entries(vehicle).forEach(([key, value]) => { if (vehicleForm.elements[key]) vehicleForm.elements[key].value = value ?? ''; });
  openModal(vehicleModal);
  setTimeout(() => vehicleForm.elements.brand.focus(), 50);
}

vehicleForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(vehicleForm).entries());
  const vehicle = {
    ...data,
    id: data.id || crypto.randomUUID(),
    mileage: Number(data.mileage || 0), hp: Number(data.hp || 0), kw: Number(data.kw || 0), owners: Number(data.owners || 0),
    purchasePrice: Number(data.purchasePrice || 0), price: Number(data.price || 0)
  };
  const index = vehicles.findIndex(v => v.id === vehicle.id);
  if (index >= 0) vehicles[index] = vehicle; else vehicles.unshift(vehicle);
  saveVehicles(); renderVehicles(); closeModal(vehicleModal); setView('vehicles');
  showToast(`${vehicle.brand} ${vehicle.model} wurde gespeichert.`);
});

function openVehicleDetail(id) {
  const vehicle = vehicles.find(v => v.id === id);
  if (!vehicle) return;
  activeVehicleId = id;
  document.getElementById('detailVehicleTitle').textContent = `${vehicle.brand} ${vehicle.model}`;
  const [statusText, statusClass] = statusInfo(vehicle.status);
  document.getElementById('vehicleDetailContent').innerHTML = `
    <div class="detail-hero">
      <div class="detail-car">🚘</div>
      <div><span class="status-badge ${statusClass}">${statusText}</span><div class="detail-price">${formatCurrency(vehicle.price)}</div><div class="detail-sub">${formatNumber(vehicle.mileage)} km · ${vehicle.hp || '—'} PS / ${vehicle.kw || '—'} kW</div></div>
    </div>
    <div class="detail-grid">
      ${detailItem('FIN', vehicle.vin)}${detailItem('Kennzeichen', vehicle.plate)}${detailItem('Erstzulassung', formatMonth(vehicle.firstRegistration))}${detailItem('HU bis', formatMonth(vehicle.inspection))}
      ${detailItem('Kraftstoff', vehicle.fuel)}${detailItem('Getriebe', vehicle.transmission)}${detailItem('Farbe', vehicle.color)}${detailItem('Halter', vehicle.owners || '—')}
      ${detailItem('Einkaufspreis', formatCurrency(vehicle.purchasePrice))}${detailItem('Verkaufspreis', formatCurrency(vehicle.price))}
    </div>
    <div class="detail-section"><h3>Ausstattung</h3><p>${escapeHtml(vehicle.equipment || 'Noch keine Ausstattung hinterlegt.')}</p></div>
    <div class="detail-section"><h3>Bekannte Mängel / Schäden</h3><p>${escapeHtml(vehicle.notes || 'Keine Angaben hinterlegt.')}</p></div>`;
  openModal(detailModal);
}

function detailItem(label, value) { return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`; }

document.getElementById('editVehicleBtn').addEventListener('click', () => {
  const vehicle = vehicles.find(v => v.id === activeVehicleId);
  closeModal(detailModal);
  if (vehicle) openVehicleForm(vehicle);
});
document.getElementById('detailSignBtn').addEventListener('click', () => printSalesSign(activeVehicleId));
document.getElementById('detailContractBtn').addEventListener('click', () => { closeModal(detailModal); openContract(activeVehicleId); });

customerForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(customerForm).entries());
  customers.unshift({ id: crypto.randomUUID(), ...data });
  saveCustomers(); renderCustomers(); closeModal(customerModal); customerForm.reset(); setView('customers');
  showToast(`${data.firstName} ${data.lastName} wurde gespeichert.`);
});

function fillContractSelects(selectedVehicleId = null, selectedCustomerId = null) {
  const vehicleSelect = document.getElementById('contractVehicle');
  const customerSelect = document.getElementById('contractCustomer');
  vehicleSelect.innerHTML = vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.brand)} ${escapeHtml(v.model)} · ${escapeHtml(v.vin || 'ohne FIN')}</option>`).join('');
  customerSelect.innerHTML = customers.length
    ? customers.map(c => `<option value="${c.id}">${escapeHtml(fullName(c))} · ${escapeHtml(c.city || '')}</option>`).join('')
    : '<option value="">Noch keinen Kunden angelegt</option>';
  if (selectedVehicleId) vehicleSelect.value = selectedVehicleId;
  if (selectedCustomerId) customerSelect.value = selectedCustomerId;
  updateContractPreview();
}

function openContract(vehicleId = null, customerId = null) {
  fillContractSelects(vehicleId, customerId);
  openModal(contractModal);
}

function updateContractPreview() {
  const vehicle = vehicles.find(v => v.id === document.getElementById('contractVehicle').value);
  const customer = customers.find(c => c.id === document.getElementById('contractCustomer').value);
  const preview = document.getElementById('contractPreview');
  if (!vehicle) { preview.innerHTML = '<p>Bitte zuerst ein Fahrzeug anlegen.</p>'; return; }
  preview.innerHTML = `
    <div class="contract-paper">
      <div class="contract-brand"><img src="assets/fahrfolio-logo.svg" alt="Fahrfolio"><span>Vorschau Kaufvertrag</span></div>
      <h3>Fahrzeug-Kaufvertrag</h3>
      <div class="contract-columns">
        <div><span>Käufer</span><strong>${escapeHtml(customer ? fullName(customer) : 'Kunde auswählen')}</strong><p>${escapeHtml(customer?.street || '')}<br>${escapeHtml(`${customer?.zip || ''} ${customer?.city || ''}`.trim())}</p></div>
        <div><span>Fahrzeug</span><strong>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</strong><p>FIN: ${escapeHtml(vehicle.vin || '—')}<br>EZ: ${escapeHtml(formatMonth(vehicle.firstRegistration))}</p></div>
      </div>
      <div class="contract-summary"><span>Kilometerstand <b>${formatNumber(vehicle.mileage)} km</b></span><span>Leistung <b>${vehicle.hp || '—'} PS</b></span><span>Kaufpreis <b>${formatCurrency(vehicle.price)}</b></span></div>
      <p class="contract-hint">Weitere Vertragsbedingungen, Gewährleistungsangaben, Mängel und Unterschriften werden im nächsten Ausbauschritt ergänzt.</p>
    </div>`;
}

document.getElementById('contractVehicle').addEventListener('change', updateContractPreview);
document.getElementById('contractCustomer').addEventListener('change', updateContractPreview);
document.getElementById('continueContractBtn').addEventListener('click', () => showToast('Nächster Schritt: vollständiger Vertrag + digitale Unterschrift.'));

function printSalesSign(id) {
  const vehicle = vehicles.find(v => v.id === id) || vehicles[0];
  if (!vehicle) return showToast('Bitte zuerst ein Fahrzeug anlegen.');
  const features = (vehicle.equipment || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
  const win = window.open('', '_blank');
  if (!win) return showToast('Pop-up wurde blockiert. Bitte Pop-ups für die Vorschau erlauben.');
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Verkaufsschild</title><style>
    body{font-family:Arial,sans-serif;margin:0;color:#102a50} .sheet{width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box} .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1687ee;padding-bottom:10mm}.brand b{font-size:26px}.tag{font-size:13px;color:#60738c}.model{font-size:42px;margin:20mm 0 3mm}.price{font-size:56px;font-weight:900;color:#0f2b5b;margin-bottom:13mm}.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin-bottom:12mm}.fact{background:#f2f6fb;padding:6mm;border-radius:4mm}.fact span{display:block;color:#6a7a90;font-size:13px}.fact b{font-size:22px}.features{display:grid;grid-template-columns:1fr 1fr;gap:3mm;font-size:17px}.features div:before{content:'✓ ';color:#1687ee;font-weight:bold}.footer{margin-top:18mm;border-top:1px solid #dbe3ed;padding-top:6mm;color:#6a7a90;font-size:12px}@media print{button{display:none}.sheet{padding:15mm}}
  </style></head><body><main class="sheet"><div class="brand"><b>Fahrfolio</b><span class="tag">Fahrzeugangebot</span></div><h1 class="model">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h1><div class="price">${formatCurrency(vehicle.price)}</div><div class="facts"><div class="fact"><span>Kilometerstand</span><b>${formatNumber(vehicle.mileage)} km</b></div><div class="fact"><span>Leistung</span><b>${vehicle.hp || '—'} PS / ${vehicle.kw || '—'} kW</b></div><div class="fact"><span>Erstzulassung</span><b>${formatMonth(vehicle.firstRegistration)}</b></div><div class="fact"><span>Kraftstoff / Getriebe</span><b>${escapeHtml(vehicle.fuel)} · ${escapeHtml(vehicle.transmission)}</b></div><div class="fact"><span>HU bis</span><b>${formatMonth(vehicle.inspection)}</b></div><div class="fact"><span>Farbe</span><b>${escapeHtml(vehicle.color || '—')}</b></div></div><h2>Ausstattung</h2><div class="features">${features.length ? features.map(f => `<div>${escapeHtml(f)}</div>`).join('') : '<div>Ausstattung auf Anfrage</div>'}</div><div class="footer">FIN: ${escapeHtml(vehicle.vin || '—')} · Angaben ohne Gewähr. Fahrfolio Verkaufsschild-Prototyp.</div><br><button onclick="window.print()">Drucken / als PDF speichern</button></main></body></html>`);
  win.document.close();
}

function handleDocumentAction(type) {
  if (type === 'sign') return printSalesSign(vehicles.find(v => v.status === 'stock')?.id);
  if (type === 'contract') return openContract();
  if (type === 'offer') return showToast('Angebots-PDF folgt direkt nach dem Kaufvertrag-Modul.');
}

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.jump)));
document.getElementById('openVehicleModal').addEventListener('click', () => openVehicleForm());
document.getElementById('openCustomerModal').addEventListener('click', () => { customerForm.reset(); openModal(customerModal); });
document.getElementById('vehicleSearch').addEventListener('input', renderVehicles);
document.getElementById('statusFilter').addEventListener('change', renderVehicles);
document.getElementById('customerSearch').addEventListener('input', renderCustomers);
document.querySelectorAll('.document-card').forEach(card => card.addEventListener('click', event => { if (event.target.closest('button') || event.currentTarget === event.target) handleDocumentAction(card.dataset.document); }));
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(document.getElementById(btn.dataset.close))));
document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(closeModal); });

function showToast(message) {
  const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

renderVehicles(); renderCustomers();
