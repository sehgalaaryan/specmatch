// --- HIGHEST SECURITY LAYER (AES-256-GCM) ---

const SALT = new TextEncoder().encode("SpecMatch_Static_Salt"); // Static salt for key derivation
const ADMIN_HASH = "240be518fabd2724ddb6f0403fed3d5a3c46a23a3d20e64f7ceec847d0e7e16a"; // Hash for "admin123"

async function deriveKey(password) {
    const pwUtf8 = new TextEncoder().encode(password);
    const pwKey = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
        pwKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(data, password) {
    const key = await deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    
    // Combine IV and ciphertext for storage
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Return as Base64 string
    return btoa(String.fromCharCode(...combined));
}

async function decryptData(base64Data, password) {
    try {
        const key = await deriveKey(password);
        const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (err) {
        console.error("Decryption failed:", err);
        return null; // Signals wrong password or corrupted data
    }
}

// UI Controllers
const loginForm = document.getElementById('login-form');
const loginOverlay = document.getElementById('login-overlay');
let sessionPassword = ""; // Kept in memory for encryption during the session

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-pass').value.trim();
    
    if (!password) return;

    // Check if we can derive a key (validates the browser's crypto stack)
    if (!window.crypto || !window.crypto.subtle) {
        alert("This browser doesn't support the 'Highest Security' features. Please use a modern browser like Chrome or Edge over HTTPS/localhost.");
        return;
    }

    // Verify password via decryption check (if data exists) or hash check (if first time)
    const encrypted = localStorage.getItem('customDevicesEncrypted');
    if (encrypted) {
        const decrypted = await decryptData(encrypted, password);
        if (decrypted) {
            sessionPassword = password;
            sessionStorage.setItem('admin-authenticated', 'true');
            sessionStorage.setItem('session-key-check', btoa(password)); // Obfuscated check for same session
            unlockDashboard();
        } else {
            showLoginError();
        }
    } else {
        // First-time setup or no data yet: use hash validation
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (hash === ADMIN_HASH) {
            sessionPassword = password;
            sessionStorage.setItem('admin-authenticated', 'true');
            sessionStorage.setItem('session-key-check', btoa(password));
            unlockDashboard();
        } else {
            showLoginError();
        }
    }
});

function showLoginError() {
    const err = document.getElementById('login-error');
    err.style.display = 'block';
    err.innerText = "Access Denied: Incorrect password or corrupted database.";
}

function unlockDashboard() {
    loginOverlay.style.display = 'none';
    renderLocalList();
    updatePreview();
}

// Persistence check (requires password, so we only auto-unlock if the key is still "hot" in session)
if (sessionStorage.getItem('admin-authenticated') === 'true' && sessionStorage.getItem('session-key-check')) {
    sessionPassword = atob(sessionStorage.getItem('session-key-check'));
    unlockDashboard();
}

// --- DATA MANAGEMENT WITH ENCRYPTION ---

async function saveDevices(newDevices) {
    if (!sessionPassword) {
        alert("Session lost. Please reload and login again.");
        return;
    }

    const encrypted = localStorage.getItem('customDevicesEncrypted');
    let current = [];
    if (encrypted) {
        current = await decryptData(encrypted, sessionPassword) || [];
    }

    const updated = [...current, ...newDevices];
    const newEncrypted = await encryptData(updated, sessionPassword);
    localStorage.setItem('customDevicesEncrypted', newEncrypted);
    renderLocalList();
}

async function renderLocalList() {
    const list = document.getElementById('local-db-list');
    if (!list) return;

    const encrypted = localStorage.getItem('customDevicesEncrypted');
    if (!encrypted) {
        list.innerHTML = '<p style="opacity: 0.5; font-size: 0.9rem; text-align: center; padding: 1rem;">No custom devices added yet.</p>';
        return;
    }

    const customDevices = await decryptData(encrypted, sessionPassword);
    if (!customDevices) {
        list.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; text-align: center; padding: 1rem;">Failed to decrypt database. Password issue?</p>';
        return;
    }

    list.innerHTML = customDevices.map(d => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--border); background: var(--surface);">
            <div>
                <div style="font-weight: 700; font-size: 0.9rem;">${d.name}</div>
                <div style="font-size: 0.7rem; color: var(--accent);">${d.brand}</div>
            </div>
        </div>
    `).join('');
}

// --- MANUAL FORM LOGIC ---
const addDeviceForm = document.getElementById('add-device-form');
if (addDeviceForm) {
    addDeviceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const specs = {};
        document.getElementById('specs-container').querySelectorAll('.specs-grid').forEach(row => {
            const inps = row.querySelectorAll('input');
            if (inps[0].value) specs[inps[0].value] = inps[1].value;
        });
        const device = {
            id: 'custom-' + Date.now(),
            name: document.getElementById('dev-name').value,
            brand: document.getElementById('dev-brand').value,
            image: document.getElementById('dev-image').value,
            specs
        };
        saveDevices([device]);
        addDeviceForm.reset();
        updatePreview();
        alert('Device securely encrypted and saved!');
    });
}

// (Rest of the UI logic: Theme Switcher, Preview, Excel remain similar but use saveDevices for encrypted storage)

function setupThemeSwitcher() {
    const btns = { light: document.getElementById('btn-light'), dark: document.getElementById('btn-dark') };
    Object.keys(btns).forEach(t => btns[t]?.addEventListener('click', () => {
        document.body.setAttribute('data-theme', t);
        Object.values(btns).forEach(b => b.classList.remove('active'));
        btns[t].classList.add('active');
        localStorage.setItem('preferred-theme', t);
    }));
    const saved = localStorage.getItem('preferred-theme');
    if (saved && btns[saved]) btns[saved].click();
}

function updatePreview() {
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) return;
    const name = document.getElementById('dev-name').value || 'Device Name';
    const brand = document.getElementById('dev-brand').value || 'Brand';
    const image = document.getElementById('dev-image').value || 'https://placehold.co/400x600?text=Preview';
    const specs = {};
    document.getElementById('specs-container')?.querySelectorAll('.specs-grid').forEach(row => {
        const inps = row.querySelectorAll('input');
        if (inps[0].value) specs[inps[0].value] = inps[1].value;
    });
    previewContainer.innerHTML = `
        <div class="device-card visible" style="pointer-events: none;">
            <div class="device-image-container"><img src="${image}" alt="${name}" class="device-image" onerror="this.src='https://placehold.co/400x600?text=${name.replace(/ /g, '+')}'"></div>
            <div class="device-info">
                <div class="device-brand">${brand}</div>
                <h3 class="device-name">${name}</h3>
                <div class="device-specs-preview">${Object.entries(specs).slice(0, 3).map(([k, v]) => `<span class="spec-badge">${v.split(' ')[0]} ${k}</span>`).join('')}</div>
            </div>
        </div>
    `;
}

// Specs Management
const addSpecBtn = document.getElementById('add-spec-field');
if (addSpecBtn) {
    addSpecBtn.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'specs-grid';
        div.innerHTML = `<input type="text" placeholder="Spec Name"><input type="text" placeholder="Value"><button type="button" class="remove-spec-btn">🗑️</button>`;
        document.getElementById('specs-container').appendChild(div);
        setupEventListeners();
    });
}

function setupEventListeners() {
    document.querySelectorAll('.remove-spec-btn').forEach(b => b.onclick = (e) => { e.target.closest('.specs-grid').remove(); updatePreview(); });
    document.querySelectorAll('#add-device-form input').forEach(i => i.oninput = updatePreview);
}

// Excel
const dropzone = document.getElementById('excel-dropzone');
if (dropzone) {
    const fileInput = document.getElementById('excel-input');
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFile(e.target.files[0]);
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--text-primary)'; };
    dropzone.ondragleave = () => { dropzone.style.borderColor = 'var(--accent)'; };
    dropzone.ondrop = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; handleFile(e.dataTransfer.files[0]); };
}

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            processExcelData(json);
        } catch (err) { alert("Excel Error: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
}

async function processExcelData(data) {
    const formatted = data.map(item => ({
        id: 'xl-' + Math.random().toString(36).substr(2, 9),
        name: item.Name || item.Model || "Unknown",
        brand: item.Brand || item.Manufacturer || "Unknown",
        image: item.ImageURL || item.Image || "",
        specs: Object.keys(item).reduce((acc, k) => { if(!['Name','Model','Brand','Manufacturer','ImageURL','Image'].includes(k)) acc[k] = String(item[k]); return acc; }, {})
    }));
    if (confirm(`Import ${formatted.length} devices?`)) {
        if (confirm('Click OK to ADD, Cancel to REFRESH (overwrite).')) {
            await saveDevices(formatted);
        } else {
            const encrypted = await encryptData(formatted, sessionPassword);
            localStorage.setItem('customDevicesEncrypted', encrypted);
            renderLocalList();
        }
        alert('Database Updated!');
    }
}

// Exports
document.getElementById('download-data')?.addEventListener('click', async () => {
    const encrypted = localStorage.getItem('customDevicesEncrypted');
    const custom = encrypted ? await decryptData(encrypted, sessionPassword) : [];
    const all = [...devices, ...custom];
    const content = `const devices = ${JSON.stringify(all, null, 2)};`;
    const blob = new Blob([content], { type: 'application/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    a.click();
});

document.getElementById('clear-local')?.addEventListener('click', () => {
    if (confirm('Clear encrypted records?')) {
        localStorage.removeItem('customDevicesEncrypted');
        renderLocalList();
    }
});

document.getElementById('template-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    const ws = XLSX.utils.aoa_to_sheet([["Name", "Brand", "ImageURL", "Display", "Processor", "Battery", "RAM", "Storage"],["iPhone 15", "Apple", "", "6.1inch", "A16 Bionic", "3349 mAh", "6GB", "128GB"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "SpecMatch_Template.xlsx");
});

setupThemeSwitcher();
setupEventListeners();
updatePreview();
