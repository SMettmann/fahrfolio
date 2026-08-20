const STORAGE_KEY = 'fahrfolio-vehicles-v1';

const demoVehicles = [
  { id: crypto.randomUUID(), brand: 'Volkswagen', model: 'Golf 1.5 TSI', vin: 'WVWZZZCDZPW123456', plate: 'HDH-FF 101', firstRegistration: '2022-06', mileage: 48200, hp: 150, fuel: 'Benzin', transmission: 'Automatik', price: 19990, status: 'stock', color: 'Deep Black', notes: '' },
  { id: crypto.randomUUID(), brand: 'BMW', model: '320d Touring', vin: 'WBA6L71020G123456', plate: 'HDH-FF 202', firstRegistration: '2021-03', mileage: 87400, hp: 190, fuel: 'Diesel', transmission: 'Automatik', price: 24900, status: 'reserved', color: 'Mineralgrau', notes: '' },
  { id: crypto.randomUUID(), brand: 'Mercedes-Benz', model: 'A 200', vin: 'W1K1770871J123456', plate: 'HDH-FF 303', firstRegistration: '2023-01', mileage: 31000, hp: 163, fuel: 'Benzin', transmission: 'Automatik', price: 27500, status: 'sold', color: 'Digitalweiß', notes: '' }
];

let vehicles = loadVehicles();

const views = {
  dashboard: document.getElementById('dashboardView'),
  vehicles: document.getElementById('vehiclesView'),
  customers: document.getElementById('customersView'),
  documents: document.getElementById('documentsView')
};
const titles = { dashboard: 'Übersicht', vehicles: 'Fahrzeuge', customers: 'Kunden', documents: 'Dokumente' };
const modal = document.getElementById('vehicleModal');
const form = document.getElementById('vehicleForm');
const cardTemplate = document.getElementById('vehicleCardTemplate');

function loadVehicles() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.warn('Lokale Fahrfolio-Daten konnten nicht geladen werden.', error);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoVehicles));
  return [...demoVehicles];
}

function saveVehicles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(Number(value || 0));
}

function formatRegistration(value) {
  if (!value) return 'EZ offen';
  const [year, month] = value.split('-');
  return `EZ ${month}/${year}`;
}

function statusInfo(status) {
  return {
    stock: ['Im Bestand', 'status-stock'],
    reserved: ['Reserviert', 'status-reserved'],
    sold: ['Verkauft', 'status-sold']
  }[status] || ['Im Bestand', 'status-stock'];
}

function createVehicleCard(vehicle, compact = false) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const [statusText, statusClass] = statusInfo(vehicle.status);
  node.querySelector('.status-badge').textContent = statusText;
  node.querySelector('.status-badge').classList.add(statusClass);
  node.querySelector('.vehicle-brand').textContent = vehicle.brand;
  node.querySelector('.vehicle-model').textContent = vehicle.model;
  node.querySelector('.vehicle-price').textContent = formatCurrency(vehicle.price);

  const meta = [
    `${formatNumber(vehicle.mileage)} km`,
    vehicle.hp ? `${vehicle.hp} PS` : null,
    vehicle.fuel,
    formatRegistration(vehicle.firstRegistration)
  ].filter(Boolean);
  node.querySelector('.vehicle-meta').innerHTML = meta.map(item => `<span>${escapeHtml(item)}</span>`).join('');
  node.querySelector('.vehicle-id').textContent = `FIN: ${vehicle.vin || '—'} · ${vehicle.plate || 'kein Kennzeichen'}`;

  node.querySelector('.action-open').addEventListener('click', () => showToast(`${vehicle.brand} ${vehicle.model}: Fahrzeugakte folgt im nächsten Schritt.`));
  node.querySelector('.action-sign').addEventListener('click', () => showToast(`Verkaufsschild für ${vehicle.brand} ${vehicle.model} wird als nächstes umgesetzt.`));
  node.querySelector('.action-contract').addEventListener('click', () => showToast(`Kaufvertrag für ${vehicle.brand} ${vehicle.model} ist für V1 vorgesehen.`));

  if (compact) {
    node.querySelector('.vehicle-actions').remove();
    node.querySelector('.vehicle-visual').style.height = '105px';
  }
  return node;
}

function renderVehicles() {
  const query = document.getElementById('vehicleSearch').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const filtered = vehicles.filter(v => {
    const haystack = [v.brand, v.model, v.vin, v.plate].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (status === 'all' || v.status === status);
  });

  const grid = document.getElementById('vehicleGrid');
  grid.innerHTML = '';
  if (!filtered.length) {
    grid.innerHTML = '<div class="no-results"><strong>Kein Fahrzeug gefunden.</strong><br>Suchbegriff oder Filter ändern.</div>';
  } else {
    filtered.forEach(v => grid.appendChild(createVehicleCard(v)));
  }

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

function setView(name) {
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('active-view', key === name));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  document.getElementById('pageTitle').textContent = titles[name];
  if (name === 'vehicles') renderVehicles();
}

function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => form.elements.brand.focus(), 50);
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  form.reset();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const vehicle = {
    id: crypto.randomUUID(),
    ...data,
    mileage: Number(data.mileage || 0),
    hp: Number(data.hp || 0),
    price: Number(data.price || 0)
  };
  vehicles.unshift(vehicle);
  saveVehicles();
  renderVehicles();
  closeModal();
  setView('vehicles');
  showToast(`${vehicle.brand} ${vehicle.model} wurde gespeichert.`);
});

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.jump)));
document.getElementById('openVehicleModal').addEventListener('click', openModal);
document.getElementById('closeVehicleModal').addEventListener('click', closeModal);
document.getElementById('cancelVehicleModal').addEventListener('click', closeModal);
document.getElementById('vehicleSearch').addEventListener('input', renderVehicles);
document.getElementById('statusFilter').addEventListener('change', renderVehicles);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

renderVehicles();
