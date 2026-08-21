(() => {
  const CONTRACT_STORAGE_KEY = 'fahrfolio-contracts-v1';
  let editSaleSnapshot = null;

  const style = document.createElement('style');
  style.textContent = `
    .sold-record{margin-top:16px;border:1px solid #cfe6ff;background:linear-gradient(135deg,#f4f9ff,#fbfdff);border-radius:14px;padding:15px}
    .sold-record-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}
    .sold-record-head strong{font-size:14px;color:var(--navy)}
    .sold-record-badge{font-size:10px;font-weight:850;color:#24734a;background:#e7f7ef;border-radius:999px;padding:5px 8px;white-space:nowrap}
    .sold-record-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .sold-record-item{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0}
    .sold-record-item span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
    .sold-record-item strong{display:block;font-size:12px;color:var(--text);word-break:break-word}
    .sold-record-empty{font-size:12px;color:var(--muted);line-height:1.5}
    @media(max-width:760px){.sold-record-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sold-record-head{align-items:flex-start}}
  `;
  document.head.appendChild(style);

  function loadContracts() {
    if (typeof window.getFahrfolioContracts === 'function') return window.getFahrfolioContracts();
    try {
      const saved = JSON.parse(localStorage.getItem(CONTRACT_STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function contractForVehicle(vehicle) {
    if (!vehicle) return null;
    const contracts = loadContracts();
    return contracts.find(contract => contract.id === vehicle.contractId)
      || contracts.find(contract => contract.vehicle?.id === vehicle.id)
      || null;
  }

  function buyerForVehicle(vehicle, contract) {
    return customers.find(customer => customer.id === vehicle?.buyerId)
      || contract?.customer
      || null;
  }

  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('de-DE').format(date);
  }

  function money(value) {
    return formatCurrency(Number(value || 0));
  }

  function openStoredContract(contract) {
    if (!contract) return showToast('Für dieses Fahrzeug ist kein Kaufvertrag hinterlegt.');
    if (typeof window.openFahrfolioSignedContract === 'function') {
      window.openFahrfolioSignedContract(contract);
      return;
    }

    const existing = document.querySelector('script[data-fahrfolio-signature-flow]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (typeof window.openFahrfolioSignedContract === 'function') window.openFahrfolioSignedContract(contract);
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'signature-flow.js';
    script.dataset.fahrfolioSignatureFlow = 'true';
    script.addEventListener('load', () => {
      if (typeof window.openFahrfolioSignedContract === 'function') window.openFahrfolioSignedContract(contract);
    }, { once: true });
    document.body.appendChild(script);
  }

  const originalOpenVehicleDetail = openVehicleDetail;
  openVehicleDetail = function(id) {
    originalOpenVehicleDetail(id);

    const vehicle = vehicles.find(item => item.id === id);
    if (!vehicle) return;

    const contract = contractForVehicle(vehicle);
    const buyer = buyerForVehicle(vehicle, contract);
    const detailContent = document.getElementById('vehicleDetailContent');
    const detailGrid = detailContent?.querySelector('.detail-grid');
    const contractButton = document.getElementById('detailContractBtn');

    if (vehicle.status === 'sold') {
      const soldDate = contract?.createdAt || vehicle.soldAt;
      const soldPrice = contract?.sale?.price ?? vehicle.price;
      const buyerName = buyer ? fullName(buyer) : 'Nicht hinterlegt';
      const contractNumber = contract?.number || 'Kein Fahrfolio-Vertrag';

      detailGrid?.insertAdjacentHTML('afterend', `
        <div class="sold-record">
          <div class="sold-record-head"><strong>Verkaufsabschluss</strong><span class="sold-record-badge">✓ Verkauft</span></div>
          ${contract ? `
            <div class="sold-record-grid">
              <div class="sold-record-item"><span>Verkauft an</span><strong>${escapeHtml(buyerName)}</strong></div>
              <div class="sold-record-item"><span>Verkauft am</span><strong>${escapeHtml(dateText(soldDate))}</strong></div>
              <div class="sold-record-item"><span>Verkaufspreis</span><strong>${escapeHtml(money(soldPrice))}</strong></div>
              <div class="sold-record-item"><span>Vertragsnummer</span><strong>${escapeHtml(contractNumber)}</strong></div>
            </div>` : `
            <div class="sold-record-empty">Dieses Fahrzeug ist als verkauft markiert, aber es wurde kein digitaler Fahrfolio-Kaufvertrag dazu gespeichert.</div>`}
        </div>`);

      if (contractButton) {
        contractButton.style.display = contract ? '' : 'none';
        contractButton.textContent = 'Kaufvertrag öffnen';
      }
    } else if (contractButton) {
      contractButton.style.display = '';
      contractButton.textContent = 'Kaufvertrag erstellen';
    }
  };

  const oldDetailContractButton = document.getElementById('detailContractBtn');
  if (oldDetailContractButton) {
    const detailContractButton = oldDetailContractButton.cloneNode(true);
    oldDetailContractButton.replaceWith(detailContractButton);
    detailContractButton.addEventListener('click', () => {
      const vehicle = vehicles.find(item => item.id === activeVehicleId);
      if (!vehicle) return;
      const contract = contractForVehicle(vehicle);
      closeModal(detailModal);
      if (vehicle.status === 'sold' && contract) openStoredContract(contract);
      else openContract(vehicle.id);
    });
  }

  const originalCreateVehicleCard = createVehicleCard;
  createVehicleCard = function(vehicle, compact = false) {
    const node = originalCreateVehicleCard(vehicle, compact);
    if (compact || vehicle.status !== 'sold') return node;

    const contract = contractForVehicle(vehicle);
    const oldButton = node.querySelector('.action-contract');
    if (!oldButton) return node;

    if (!contract) {
      oldButton.remove();
      return node;
    }

    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.textContent = 'Kaufvertrag';
    button.addEventListener('click', () => openStoredContract(contract));
    return node;
  };

  const originalOpenVehicleForm = openVehicleForm;
  openVehicleForm = function(vehicle = null) {
    editSaleSnapshot = vehicle ? {
      id: vehicle.id,
      soldAt: vehicle.soldAt,
      buyerId: vehicle.buyerId,
      contractId: vehicle.contractId
    } : null;
    originalOpenVehicleForm(vehicle);
  };

  vehicleForm.addEventListener('submit', () => {
    if (!editSaleSnapshot?.id) return;
    const vehicle = vehicles.find(item => item.id === editSaleSnapshot.id);
    if (!vehicle) return;

    if (editSaleSnapshot.soldAt !== undefined) vehicle.soldAt = editSaleSnapshot.soldAt;
    if (editSaleSnapshot.buyerId !== undefined) vehicle.buyerId = editSaleSnapshot.buyerId;
    if (editSaleSnapshot.contractId !== undefined) vehicle.contractId = editSaleSnapshot.contractId;
    saveVehicles();
    renderVehicles();
    editSaleSnapshot = null;
  });
})();
