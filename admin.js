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

const SCHEMA = {
    mobile: ["Display", "Processor", "RAM", "Storage", "Battery", "Camera", "Weight", "OS"],
    tablet: ["Display", "Processor", "Storage", "Battery", "Camera", "Weight", "OS"],
    laptop: ["Display", "Processor", "RAM", "Storage", "Graphics", "Battery", "Weight", "OS"]
};

// Persistence Keys
const STORAGE_KEY = 'specmatch_local_db';

/**
 * Loads the database from LocalStorage or falls back to global variables.
 */
function loadInitialDB() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse saved DB", e);
        }
    }
    return {
        mobile: (typeof MOBILES_DB !== 'undefined') ? [...MOBILES_DB] : [],
        tablet: (typeof TABLETS_DB !== 'undefined') ? [...TABLETS_DB] : [],
        laptop: (typeof LAPTOPS_DB !== 'undefined') ? [...LAPTOPS_DB] : []
    };
}

// State
let localDB = loadInitialDB();
let isEditMode = false;
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
    document.body.style.overflow = 'auto'; // Restore scrollbar
    
    // Integrated Navigation Logic
    AppUtils.initNavigation();

    // Integrated Category Management
    AppUtils.initCategorySwitcher(currentCategory, (newCat) => {
        currentCategory = newCat;
        if (!isEditMode) resetForm();
        renderCloudList();
        updateDropzoneUI();
    });
    
    renderCloudList();
    updatePreview();
    updateDropzoneUI();
    updateSaveBanner(); // Sync the loaded state (banner)
    resetForm();
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

// Navigation and Category logic removed (Consolidated in utils.js)

function updateDropzoneUI() {
    const filenameEl = document.getElementById('expected-filename');
    if (filenameEl) filenameEl.innerText = currentCategory + 's.xlsx';
    
    // Reset status
    const status = document.getElementById('dropzone-status');
    if (status) status.style.display = 'none';
}

// --- DATA MANAGEMENT ---

function saveToLocalState(deviceData) {
    const list = localDB[currentCategory];
    if (isEditMode) {
        const index = list.findIndex(d => d.id === deviceData.id);
        if (index > -1) list[index] = deviceData;
    } else {
        list.unshift({
            ...deviceData,
            id: AppUtils.generateUniqueId()
        });
    }
    
    updateSaveBanner();
    renderCloudList();
    resetForm();
    
    // Persist to browser storage
    syncState();
}

/**
 * Persists the current localDB state to the browser's LocalStorage.
 */
function syncState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localDB));
}

function deleteDevice(id) {
    if (!confirm("Remove this device from the active list?")) return;
    localDB[currentCategory] = localDB[currentCategory].filter(d => d.id !== id);
    updateSaveBanner();
    renderCloudList();
    syncState();
}

function editDevice(id) {
    const device = localDB[currentCategory].find(d => d.id === id);
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
    
    const fields = SCHEMA[currentCategory] || [];
    fields.forEach(f => addSpecRow(f, ''));
}

function addSpecRow(k = '', v = '') {
    const div = document.createElement('div');
    div.className = 'specs-grid';
    div.innerHTML = `<input type="text" placeholder="Spec Name" value="${k}" readonly style="background: rgba(255,255,255,0.03); opacity: 0.7; cursor: default;"><input type="text" placeholder="Value" value="${v}">`;
    document.getElementById('specs-container').appendChild(div);
}

function renderCloudList() {
    const list = document.getElementById('local-db-list');
    if (!list) return;

    const filtered = localDB[currentCategory];

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
    const varName = currentCategory.toUpperCase() + 'S_DB';
    
    // Create a deep copy and strip the 'category' property from each item
    const cleanData = localDB[currentCategory].map(item => {
        const { category, ...rest } = item;
        return rest;
    });

    const content = `/**
 * SpecMatch ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}s Database
 * Regenerated on ${new Date().toLocaleString()}
 */
const ${varName} = ${JSON.stringify(cleanData, null, 2)};`;
    
    const blob = new Blob([content], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentCategory + 's.js';
    a.click();
    
    updateSaveBanner();
}

function updateSaveBanner() {
    if (!saveBanner) return;

    const staticData = {
        mobile: (typeof MOBILES_DB !== 'undefined') ? MOBILES_DB : [],
        tablet: (typeof TABLETS_DB !== 'undefined') ? TABLETS_DB : [],
        laptop: (typeof LAPTOPS_DB !== 'undefined') ? LAPTOPS_DB : []
    };

    // Compare localDB in browser with variables loaded from .js files
    const isDirty = JSON.stringify(localDB) !== JSON.stringify(staticData);
    saveBanner.style.display = isDirty ? 'flex' : 'none';
}

document.getElementById('main-download-btn')?.addEventListener('click', generateDataJs);

function exportToExcel() {
    // Current category data
    const filtered = localDB[currentCategory];
    
    if (filtered.length === 0) {
        alert(`No devices in the ${currentCategory} category to export.`);
        return;
    }

    const rows = filtered.map(d => ({
        ID: d.id,
        Name: d.name,
        Brand: d.brand,
        Price: d.price || "",
        ImageURL: d.image || "",
        ...d.specs
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}s`);
    XLSX.writeFile(wb, `${currentCategory}s.xlsx`);
}

document.getElementById('export-excel-btn')?.addEventListener('click', exportToExcel);

function processExcelData(json) {
    const mode = confirm("DATABASE SYNC:\n\nClick OK to REPLACE the entire list.\nClick CANCEL to only APPEND new items.");
    
    const formatted = json.map(item => ({
        id: item.ID || AppUtils.generateUniqueId(),
        name: item.Name || item.Model || "Unknown",
        brand: item.Brand || item.Manufacturer || "Unknown",
        price: item.Price || item.price || "",
        image: item.ImageURL || item.Image || "",
        specs: Object.keys(item).reduce((acc, k) => { 
            if(!['ID','Category','category','Name','Model','Brand','Manufacturer','ImageURL','Image','Price','price'].includes(k)) acc[k] = String(item[k]); 
            return acc; 
        }, {})
    }));

    if (mode) localDB[currentCategory] = formatted;
    else localDB[currentCategory] = [...localDB[currentCategory], ...formatted];

    updateSaveBanner();
    renderCloudList();
    syncState();
    alert(`Category "${currentCategory.toUpperCase()}" updated in browser storage! If you see a warning banner, click "Download Updates" to save to your project files.`);
}

// --- INITIALIZATION ---

function setupExcelListeners() {
    const dropzone = document.getElementById('excel-dropzone');
    const input = document.getElementById('excel-input');

    if (!dropzone || !input) return;

    dropzone.addEventListener('click', async () => {
        // Modern File System Access API (Address Bottom Right Arrow)
        if (window.showOpenFilePicker) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: `SpecMatch ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}s (.xlsx, .xls, .csv)`,
                        accept: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                            'application/vnd.ms-excel': ['.xls'],
                            'text/csv': ['.csv']
                        }
                    }],
                    excludeAcceptAllOption: true,
                    multiple: false
                });
                const file = await fileHandle.getFile();
                handleExcelFile(file);
            } catch (err) {
                // User cancelled or error
                console.log('Picker cancelled or failed:', err);
            }
        } else {
            // Legacy Fallback
            input.click();
        }
    });

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleExcelFile(file);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--text-primary)';
        dropzone.style.background = 'var(--accent-glow)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--accent)';
        dropzone.style.background = 'var(--bg-secondary)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent)';
        dropzone.style.background = 'var(--bg-secondary)';
        const file = e.dataTransfer.files[0];
        if (file) handleExcelFile(file);
    });
}

function handleExcelFile(file) {
    const dropzone = document.getElementById('excel-dropzone');
    const status = document.getElementById('dropzone-status');
    const expectedPrefix = currentCategory + 's'; // mobiles
    
    if (!file.name.toLowerCase().startsWith(expectedPrefix)) {
        if (status) {
            status.innerText = `🛑 WRONG FILE: Please upload "${expectedPrefix}.xlsx"`;
            status.style.display = 'block';
            
            // Shake effect
            dropzone.classList.remove('shake');
            void dropzone.offsetWidth;
            dropzone.classList.add('shake');
        }
        return;
    }

    if (status) status.style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        processExcelData(json);
    };
    reader.readAsArrayBuffer(file);
}

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

cancelEditBtn?.addEventListener('click', resetForm);

function setupEventListeners() {
    document.querySelectorAll('#add-device-form input, #add-device-form select').forEach(i => i.oninput = updatePreview);
}

document.getElementById('copy-filename-badge')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = document.getElementById('expected-filename').innerText;
    navigator.clipboard.writeText(name).then(() => {
        const badge = document.getElementById('copy-filename-badge');
        badge.classList.add('copied');
        setTimeout(() => badge.classList.remove('copied'), 2000);
    });
});

window.editDevice = editDevice;
window.deleteDevice = deleteDevice;

document.addEventListener('DOMContentLoaded', () => {
    AppUtils.setupThemeSwitcher({ light: 'btn-light', dark: 'btn-dark', vibrant: 'btn-vibrant' });
    
    // Explicitly sync UI with default category on load (even before login)
    const allLinks = document.querySelectorAll('.nav-link, .menu-item');
    allLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-category') === currentCategory);
    });

    setupExcelListeners();

    if (sessionStorage.getItem('admin-active') === 'true') {
        onAuthSuccess();
    } else {
        document.body.style.overflow = 'hidden'; // Hide scrollbar for login
        resetForm();
    }
});
