// State management
let currentTheme = 'light';
let currentCategory = 'mobile';
let selectedDevices = [];
let searchQuery = '';
let allDevices = (typeof devices !== 'undefined') ? [...devices] : []; // Using static array from data.js

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
    // Shared Theme Switching initialized through AppUtils
    AppUtils.setupThemeSwitcher({
        light: 'btn-light',
        dark: 'btn-dark',
        vibrant: 'btn-vibrant'
    });

    setupCategorySwitcher();
    setupSearch();
    setupComparison();
    
    // Explicitly sync UI with default category
    const defaultBtn = document.querySelector(`.cat-btn[data-category="${currentCategory}"]`);
    if (defaultBtn) {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        defaultBtn.classList.add('active');
    }

    renderDevices();
});

// Category Switcher Logic
function setupCategorySwitcher() {
    const btns = document.querySelectorAll('.cat-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.getAttribute('data-category');
            
            // UI Update
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter and render
            renderDevices();
        });
    });
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

    // Safety guard for empty database
    if (allDevices.length === 0) {
        deviceGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">No device data found. Please ensure data.js is present.</div>';
        return;
    }

    // Filter by Category AND Search Query
    const filtered = allDevices.filter(d => {
        const matchesCategory = d.category === currentCategory;
        const matchesSearch = (d.name && d.name.toLowerCase().includes(searchQuery)) || 
                            (d.brand && d.brand.toLowerCase().includes(searchQuery));
        return matchesCategory && matchesSearch;
    });

    deviceGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        deviceGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">No ${currentCategory}s found matching your search.</div>`;
        return;
    }

    filtered.forEach((device, index) => {
        const isSelected = selectedDevices.some(sd => sd.id === device.id);
        
        const cardWrapper = document.createElement('div');
        // Use centralized rendering from utils.js
        cardWrapper.innerHTML = AppUtils.renderDeviceCard(device, isSelected, false);
        
        const card = cardWrapper.firstElementChild;
        card.style.transitionDelay = `${index * 50}ms`;
        deviceGrid.appendChild(card);
        
        // Trigger entry animation
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
        const values = selectedDevices.map(d => String((d.specs && d.specs[cat.key]) || ''));
        const bestIndex = findBestValue(cat.key, values);

        selectedDevices.forEach((d, i) => {
            const isBest = i === bestIndex;
            const val = (d.specs && d.specs[cat.key]) || 'N/A';
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
    } catch(e) {
        console.error("Comparison ranking error:", e);
    }
    return -1;
}
