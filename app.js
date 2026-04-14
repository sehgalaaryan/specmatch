// State management
let currentTheme = 'light';
let selectedDevices = [];
let searchQuery = '';
let allDevices = [...devices]; // Start with public devices from data.js

// HIGHEST SECURITY: Try to load encrypted local devices if authenticated
async function loadEncryptedData() {
    const encrypted = localStorage.getItem('customDevicesEncrypted');
    const isAuthenticated = sessionStorage.getItem('admin-authenticated') === 'true';
    const sessionKey = sessionStorage.getItem('session-key-check');

    if (encrypted && isAuthenticated && sessionKey) {
        try {
            const password = atob(sessionKey);
            const decrypted = await decryptData(encrypted, password);
            if (decrypted) {
                allDevices = [...devices, ...decrypted];
                renderDevices(); // Re-render with new data
            }
        } catch (e) {
            console.warn("Failed to decrypt local data for main site view.");
        }
    }
}

// Minimal Decryption Logic (must match admin.js exactly)
async function decryptData(base64Data, password) {
    try {
        const salt = new TextEncoder().encode("SpecMatch_Static_Salt");
        const pwUtf8 = new TextEncoder().encode(password);
        const pwKey = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            pwKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (err) { return null; }
}

// DOM Elements
const deviceGrid = document.getElementById('device-grid');
const searchInput = document.getElementById('device-search');
const compareTray = document.getElementById('compare-tray');
const selectedItemsContainer = document.getElementById('selected-items');
const goCompareBtn = document.getElementById('go-compare');
const comparisonOverlay = document.getElementById('comparison-overlay');
const closeOverlayBtn = document.getElementById('close-overlay');
const comparisonTableContainer = document.getElementById('comparison-table-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderDevices();
    setupThemeSwitcher();
    setupSearch();
    setupComparison();
    loadEncryptedData(); // Try to fetch the "Secure" local draft
});

// Theme Switcher Logic
function setupThemeSwitcher() {
    const btns = {
        light: document.getElementById('btn-light'),
        dark: document.getElementById('btn-dark'),
        vibrant: document.getElementById('btn-vibrant')
    };

    if (!btns.light || !btns.dark || !btns.vibrant) return;

    Object.keys(btns).forEach(theme => {
        btns[theme].addEventListener('click', () => {
            document.body.setAttribute('data-theme', theme);
            Object.values(btns).forEach(b => b.classList.remove('active'));
            btns[theme].classList.add('active');
            currentTheme = theme;
            localStorage.setItem('preferred-theme', theme);
        });
    });

    const savedTheme = localStorage.getItem('preferred-theme');
    if (savedTheme && btns[savedTheme]) {
        btns[savedTheme].click();
    }
}

// Search Logic
function setupSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderDevices();
    });
}

// Render Device Cards
function renderDevices() {
    if (!deviceGrid) return;

    const filtered = allDevices.filter(d => 
        d.name.toLowerCase().includes(searchQuery) || 
        d.brand.toLowerCase().includes(searchQuery)
    );

    deviceGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        deviceGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">No devices found matching your search.</div>';
        return;
    }

    filtered.forEach((device, index) => {
        const isSelected = selectedDevices.some(sd => sd.id === device.id);
        const card = document.createElement('div');
        card.className = 'device-card';
        card.style.transitionDelay = `${index * 50}ms`;
        
        const battery = device.specs.Battery ? String(device.specs.Battery).split(' ')[0] : 'N/A';
        const display = device.specs.Display ? String(device.specs.Display).split(' ')[0] : 'N/A';
        const proc = device.specs.Processor ? String(device.specs.Processor).split(' ')[0] : 'N/A';
        
        card.innerHTML = `
            <div class="device-image-container">
                <img src="${device.image}" alt="${device.name}" class="device-image" onerror="this.src='https://placehold.co/400x600?text=${device.name.replace(/ /g, '+')}'">
            </div>
            <div class="device-info">
                <div class="device-brand">${device.brand}</div>
                <h3 class="device-name">${device.name}</h3>
                <div class="device-specs-preview">
                    <span class="spec-badge">${display} Display</span>
                    <span class="spec-badge">${proc}</span>
                    <span class="spec-badge">${battery} mAh</span>
                </div>
                <button class="compare-btn ${isSelected ? 'active' : ''}" onclick="toggleCompare('${device.id}')">
                    ${isSelected ? 'Selected' : 'Add to Compare'}
                </button>
            </div>
        `;
        
        deviceGrid.appendChild(card);
        setTimeout(() => card.classList.add('visible'), 10);
    });
}

// Compare Logic
window.toggleCompare = function(deviceId) {
    const device = allDevices.find(d => String(d.id) === String(deviceId));
    if (!device) return;
    
    const index = selectedDevices.findIndex(sd => String(sd.id) === String(deviceId));

    if (index > -1) {
        selectedDevices.splice(index, 1);
    } else {
        if (selectedDevices.length >= 3) {
            alert('You can compare up to 3 devices at a time.');
            return;
        }
        selectedDevices.push(device);
    }

    updateCompareTray();
    renderDevices();
};

function updateCompareTray() {
    if (!compareTray || !selectedItemsContainer) return;

    if (selectedDevices.length > 0) {
        compareTray.classList.add('visible');
    } else {
        compareTray.classList.remove('visible');
    }

    selectedItemsContainer.innerHTML = '';
    selectedDevices.forEach(device => {
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span style="font-weight: 600; font-size: 0.9rem;">${device.name}</span>
            <button class="remove-item" onclick="toggleCompare('${device.id}')">×</button>
        `;
        selectedItemsContainer.appendChild(item);
    });
}

// Comparison Detail Table
function setupComparison() {
    if (!goCompareBtn || !comparisonOverlay || !closeOverlayBtn) return;

    goCompareBtn.addEventListener('click', () => {
        if (selectedDevices.length < 2) {
            alert('Please select at least 2 devices to compare.');
            return;
        }
        generateComparisonTable();
        comparisonOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    closeOverlayBtn.addEventListener('click', () => {
        comparisonOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
}

function generateComparisonTable() {
    if (!comparisonTableContainer) return;

    const categories = [
        { name: "Display", key: "Display" },
        { name: "Processor", key: "Processor" },
        { name: "Memory", key: "RAM" },
        { name: "Storage", key: "Storage" },
        { name: "Battery", key: "Battery" },
        { name: "Camera", key: "Camera" },
        { name: "Weight", key: "Weight" },
        { name: "Operating System", key: "OS" }
    ];

    let html = `<table class="comparison-table"><thead><tr><th class="spec-name">Feature</th>`;
    
    selectedDevices.forEach(d => {
        html += `<th class="comparison-header-cell">
            <img src="${d.image}" alt="${d.name}" style="height: 100px; object-fit: contain;" onerror="this.src='https://placehold.co/200x300?text=Device'">
            <div style="font-weight: 800; font-size: 1.1rem; margin-top: 0.5rem;">${d.name}</div>
        </th>`;
    });
    
    html += `</tr></thead><tbody>`;

    categories.forEach(cat => {
        html += `<tr><td class="spec-name">${cat.name}</td>`;
        const values = selectedDevices.map(d => String(d.specs[cat.key] || ''));
        const bestIndex = findBestValue(cat.key, values);

        selectedDevices.forEach((d, i) => {
            const isBest = i === bestIndex;
            const val = d.specs[cat.key] || 'N/A';
            html += `<td class="spec-value ${isBest ? 'winner' : ''}">${val} ${isBest ? '✓' : ''}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    comparisonTableContainer.innerHTML = html;
}

function findBestValue(key, values) {
    try {
        if (key === 'Battery' || key === 'RAM') {
            const numbers = values.map(v => {
                const match = v.match(/\d+/);
                return match ? parseInt(match[0]) : 0;
            });
            const max = Math.max(...numbers);
            return max === 0 ? -1 : numbers.indexOf(max);
        }
        if (key === 'Weight') {
            const numbers = values.map(v => {
                const match = v.match(/\d+/);
                return match ? parseInt(match[0]) : Infinity;
            });
            const min = Math.min(...numbers);
            return min === Infinity ? -1 : numbers.indexOf(min);
        }
    } catch(e) {}
    return -1;
}
