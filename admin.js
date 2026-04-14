/**
 * SpecMatch Offline Admin Logic
 * Managed local state and regenerates data.js files.
 */

// Configuration & Security Constants
const CONFIG = {
    SALT: "SpecMatch_Admin_Salt",
    ITERATIONS: 100000,
    // PBKDF2 Hash of the master password "Tb5&F1yp*c1W"
    KNOWN_HASH: "8c66ae34e062bb20d65e2361099bce8669527e57c8bfbc6484e27f4955c47761"
};

// State
let localDevices = (typeof devices !== 'undefined') ? [...devices] : []; // From data.js
let isEditMode = false;
let hasUnsavedChanges = false;
let currentCategory = 'mobile';

// UI Elements
const authCard = document.getElementById('auth-card');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginOverlay = document.getElementById('login-overlay');
const loginError = document.getElementById('login-error');

const addDeviceForm = document.getElementById('add-device-form');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const editIdInput = document.getElementById('edit-id');
const formTitle = document.getElementById('form-title');
const saveBanner = document.getElementById('save-banner');

/**
 * Verifies the admin password against the known hash.
 */
async function verifyPassword(input) {
    const inputHash = await AppUtils.hashPassword(input);
    return (input === "Tb5&F1yp*c1W" || inputHash === CONFIG.KNOWN_HASH);
}

// --- AUTHENTICATION ---

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    const isValid = await verifyPassword(pass);

    if (isValid) {
        sessionStorage.setItem('admin-active', 'true');
        onAuthSuccess();
    } else {
        loginError.style.display = 'block';
        handleFailedAttempt();
    }
});

function onAuthSuccess() {
    loginOverlay.style.display = 'none';
    setupCategorySwitcher();
    
    // Explicitly sync UI with default category
    const defaultBtn = document.querySelector(`.cat-btn[data-category="${currentCategory}"]`);
    if (defaultBtn) {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        defaultBtn.classList.add('active');
    }

    renderCloudList();
    updatePreview();
}

function handleFailedAttempt() {
    authCard.classList.remove('shake');
    void authCard.offsetWidth;
    authCard.classList.add('shake');
}

logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('admin-active');
    location.reload();
});

function setupCategorySwitcher() {
    const btns = document.querySelectorAll('.cat-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.getAttribute('data-category');
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (!isEditMode) resetForm();
            renderCloudList();
        });
    });
}

// --- DATA MANAGEMENT ---

function saveToLocalState(deviceData) {
    if (isEditMode) {
        const index = localDevices.findIndex(d => d.id === deviceData.id);
        if (index > -1) localDevices[index] = deviceData;
    } else {
        localDevices.unshift({
            ...deviceData,
            category: currentCategory,
            id: 'dev-' + Date.now()
        });
    }
    
    hasUnsavedChanges = true;
    updateSaveBanner();
    renderCloudList();
    resetForm();
}

function deleteDevice(id) {
    if (!confirm("Remove this device from the active list?")) return;
    localDevices = localDevices.filter(d => d.id !== id);
    hasUnsavedChanges = true;
    updateSaveBanner();
    renderCloudList();
}

function editDevice(id) {
    const device = localDevices.find(d => d.id === id);
    if (!device) return;

    editIdInput.value = device.id;
    document.getElementById('dev-name').value = device.name;
    document.getElementById('dev-brand').value = device.brand;
    document.getElementById('dev-image').value = device.image || "";
    document.getElementById('dev-price').value = device.price || "";
    
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    Object.entries(device.specs || {}).forEach(([k, v]) => addSpecRow(k, v));

    isEditMode = true;
    formTitle.innerText = `Edit ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}`;
    submitBtn.innerText = "Apply Changes";
    cancelEditBtn.style.display = 'block';
    setupEventListeners();
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    addDeviceForm.reset();
    editIdInput.value = '';
    isEditMode = false;
    formTitle.innerText = `Edit ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)} Dataset`;
    submitBtn.innerText = "Apply to List";
    cancelEditBtn.style.display = 'none';
    updateDefaultSpecs();
    setupEventListeners();
    updatePreview();
}

function updateDefaultSpecs() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    
    // Find all unique keys currently used in this category across ALL devices
    const uniqueKeys = new Set();
    
    localDevices
        .filter(d => d.category === currentCategory)
        .forEach(d => {
            if (d.specs) {
                Object.keys(d.specs).forEach(key => uniqueKeys.add(key));
            }
        });

    if (uniqueKeys.size > 0) {
        // Use the headers found in the database
        uniqueKeys.forEach(key => addSpecRow(key, ''));
    } else {
        // Fallback to sensible defaults if the category is empty
        const defaults = {
            mobile: [['Display', ''], ['Processor', ''], ['Battery', '']],
            tablet: [['Display', ''], ['Processor', ''], ['Battery', '']],
            laptop: [['Processor', ''], ['Graphics', ''], ['RAM', '']]
        };
        (defaults[currentCategory] || []).forEach(([k, v]) => addSpecRow(k, v));
    }
}

function addSpecRow(k = '', v = '') {
    const div = document.createElement('div');
    div.className = 'specs-grid';
    div.innerHTML = `<input type="text" placeholder="Spec Name" value="${k}"><input type="text" placeholder="Value" value="${v}"><button type="button" class="remove-spec-btn">🗑️</button>`;
    document.getElementById('specs-container').appendChild(div);
}

function renderCloudList() {
    const list = document.getElementById('local-db-list');
    if (!list) return;

    const filtered = localDevices.filter(d => d.category === currentCategory);

    if (filtered.length === 0) {
        list.innerHTML = `<p style="opacity: 0.5; font-size: 0.9rem; text-align: center; padding: 2rem;">No items in ${currentCategory} category.</p>`;
        return;
    }

    list.innerHTML = filtered.map(d => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--border); background: var(--surface);">
            <div>
                <div style="font-weight: 700; font-size: 0.9rem;">${d.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">${d.brand}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="editDevice('${d.id}')" style="background: transparent; border: none; color: var(--accent); cursor: pointer; padding: 0.5rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button onclick="deleteDevice('${d.id}')" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 0.5rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>
    `).join('');
}

// --- SAVE & EXCEL ---

function generateDataJs() {
    const content = `/**
 * SpecMatch Static Database
 * Regenerated on ${new Date().toLocaleString()}
 */
const devices = ${JSON.stringify(localDevices, null, 2)};`;
    
    const blob = new Blob([content], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    a.click();
    
    hasUnsavedChanges = false;
    updateSaveBanner();
}

function updateSaveBanner() {
    if (saveBanner) saveBanner.style.display = hasUnsavedChanges ? 'flex' : 'none';
}

document.getElementById('main-download-btn')?.addEventListener('click', generateDataJs);

async function exportToExcel() {
    // Filter by current category first
    const filtered = localDevices.filter(d => d.category === currentCategory);
    
    if (filtered.length === 0) {
        alert(`No devices in the ${currentCategory} category to export.`);
        return;
    }

    const rows = filtered.map(d => ({
        ID: d.id,
        Category: d.category || currentCategory,
        Name: d.name,
        Brand: d.brand,
        Price: d.price || "",
        ImageURL: d.image || "",
        ...d.specs
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}s`);
    XLSX.writeFile(wb, `SpecMatch_${currentCategory}_Export.xlsx`);
}

document.getElementById('export-excel-btn')?.addEventListener('click', exportToExcel);

function processExcelData(json) {
    const mode = confirm("DATABASE SYNC:\n\nClick OK to REPLACE the entire list.\nClick CANCEL to only APPEND new items.");
    
    const formatted = json.map(item => ({
        id: item.ID || 'dev-' + Math.random().toString(36).substr(2, 9),
        category: item.Category || item.category || 'mobile',
        name: item.Name || item.Model || "Unknown",
        brand: item.Brand || item.Manufacturer || "Unknown",
        price: item.Price || item.price || "",
        image: item.ImageURL || item.Image || "",
        specs: Object.keys(item).reduce((acc, k) => { 
            if(!['ID','Category','category','Name','Model','Brand','Manufacturer','ImageURL','Image','Price','price'].includes(k)) acc[k] = String(item[k]); 
            return acc; 
        }, {})
    }));

    if (mode) localDevices = formatted;
    else localDevices = [...localDevices, ...formatted];

    hasUnsavedChanges = true;
    updateSaveBanner();
    renderCloudList();
    alert('Changes applied! Download the updated data.js to complete the sync.');
}

// --- INITIALIZATION ---

if (addDeviceForm) {
    addDeviceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const specs = {};
        document.getElementById('specs-container').querySelectorAll('.specs-grid').forEach(row => {
            const inps = row.querySelectorAll('input');
            if (inps[0].value) specs[inps[0].value] = inps[1].value;
        });
        saveToLocalState({
            id: editIdInput.value || '',
            category: currentCategory,
            name: document.getElementById('dev-name').value,
            brand: document.getElementById('dev-brand').value,
            image: document.getElementById('dev-image').value,
            price: document.getElementById('dev-price').value,
            specs
        });
    });
}

function updatePreview() {
    const container = document.getElementById('preview-container');
    if (!container) return;

    const device = {
        name: document.getElementById('dev-name').value || 'Device Name',
        brand: document.getElementById('dev-brand').value || 'Brand',
        image: document.getElementById('dev-image').value,
        price: document.getElementById('dev-price').value,
        category: currentCategory,
        specs: {}
    };

    document.getElementById('specs-container')?.querySelectorAll('.specs-grid').forEach(row => {
        const inps = row.querySelectorAll('input');
        if (inps[0].value) device.specs[inps[0].value] = inps[1].value;
    });

    // Use centralized rendering
    container.innerHTML = AppUtils.renderDeviceCard(device, false, true);
}

document.getElementById('add-spec-field')?.addEventListener('click', () => addSpecRow());
cancelEditBtn?.addEventListener('click', resetForm);

function setupEventListeners() {
    document.querySelectorAll('.remove-spec-btn').forEach(b => b.onclick = (e) => { e.target.closest('.specs-grid').remove(); updatePreview(); });
    document.querySelectorAll('#add-device-form input, #add-device-form select').forEach(i => i.oninput = updatePreview);
}

window.editDevice = editDevice;
window.deleteDevice = deleteDevice;

document.addEventListener('DOMContentLoaded', () => {
    AppUtils.setupThemeSwitcher({ light: 'btn-light', dark: 'btn-dark', vibrant: 'btn-vibrant' });
    
    // Explicitly sync UI with default category on load (even before login)
    const defaultBtn = document.querySelector(`.cat-btn[data-category="${currentCategory}"]`);
    if (defaultBtn) {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        defaultBtn.classList.add('active');
    }

    if (sessionStorage.getItem('admin-active') === 'true') onAuthSuccess();
    else resetForm();
});
