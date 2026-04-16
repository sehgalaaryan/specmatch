// State management
let currentTheme = 'light';
let currentCategory = 'mobile';
let selectedDevices = [];
let searchQuery = '';
// Helper to get all devices across categories
const getAllDevices = () => {
    return [
        ...(typeof MOBILES_DB !== 'undefined' ? MOBILES_DB : []),
        ...(typeof TABLETS_DB !== 'undefined' ? TABLETS_DB : []),
        ...(typeof LAPTOPS_DB !== 'undefined' ? LAPTOPS_DB : [])
    ];
};

const getCategoryDevices = (cat) => {
    if (cat === 'mobile') return (typeof MOBILES_DB !== 'undefined' ? MOBILES_DB : []);
    if (cat === 'tablet') return (typeof TABLETS_DB !== 'undefined' ? TABLETS_DB : []);
    if (cat === 'laptop') return (typeof LAPTOPS_DB !== 'undefined' ? LAPTOPS_DB : []);
    return [];
};

// DOM Elements
const deviceGrid = document.getElementById('device-grid');
const searchInput = document.getElementById('device-search');
const compareTray = document.getElementById('compare-tray');
const selectedItemsContainer = document.getElementById('selected-items');
const goCompareBtn = document.getElementById('go-compare');
const comparisonOverlay = document.getElementById('comparison-overlay');
const closeOverlayBtn = document.getElementById('close-overlay');
const comparisonTableContainer = document.getElementById('comparison-table-container');

// Observer for scroll-in animations
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    AppUtils.setupThemeSwitcher({
        light: 'btn-light',
        dark: 'btn-dark',
        vibrant: 'btn-vibrant'
    });

    // Integrated Navigation Logic
    AppUtils.initNavigation();

    // Integrated Category Management
    AppUtils.initCategorySwitcher(currentCategory, (newCat) => {
        currentCategory = newCat;
        
        // Animated transition for grid
        deviceGrid.style.opacity = '0';
        deviceGrid.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            renderDevices();
            deviceGrid.style.opacity = '1';
            deviceGrid.style.transform = 'translateY(0)';
            setupRevealObserver();
        }, 300);
    });

    setupSearch();
    setupComparison();
    setupRevealObserver();
    
    // Initial render
    renderDevices();
});

// Reveal Observer for scroll-in animations
function setupRevealObserver() {
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// Search Logic
function setupSearch() {
    if (!searchInput) return;
    const debouncedRender = AppUtils.debounce(() => renderDevices(), 250);
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        debouncedRender();
    });
}

// Render Device Cards
function renderDevices() {
    if (!deviceGrid) return;

    const devices = getCategoryDevices(currentCategory);
    
    if (devices.length === 0) {
        deviceGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">No device data found for this category.</div>';
        return;
    }

    const filtered = devices.filter(d => {
        const matchesSearch = (d.name && d.name.toLowerCase().includes(searchQuery)) || 
                            (d.brand && d.brand.toLowerCase().includes(searchQuery));
        return matchesSearch;
    });

    deviceGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        deviceGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">No ${currentCategory}s found matching your search.</div>`;
        return;
    }

    filtered.forEach((device, index) => {
        const isSelected = selectedDevices.some(sd => sd.id === device.id);
        const cardWrapper = document.createElement('div');
        cardWrapper.innerHTML = AppUtils.renderDeviceCard(device, isSelected, false);
        
        const card = cardWrapper.firstElementChild;
        // Staggered delay for the reveal animation
        card.style.transitionDelay = `${(index % 10) * 100}ms`;
        deviceGrid.appendChild(card);
        
        // Observe for animation
        revealObserver.observe(card);
    });
}

// Compare Logic
window.toggleCompare = function(deviceId) {
    const device = getAllDevices().find(d => String(d.id) === String(deviceId));
    if (!device) return;
    
    const index = selectedDevices.findIndex(sd => String(sd.id) === String(deviceId));

    if (index > -1) {
        selectedDevices.splice(index, 1);
    } else {
        if (selectedDevices.length >= 3) {
            alert('Limit reached: You can compare up to 3 devices.');
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
        item.className = 'selected-item reveal visible';
        item.innerHTML = `
            <span style="font-weight: 700; font-size: 0.85rem;">${device.name}</span>
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

    let html = `<table class="comparison-table fadeInUp"><thead><tr><th class="spec-name">Feature</th>`;
    
    selectedDevices.forEach(d => {
        html += `<th class="comparison-header-cell text-center">
            <img src="${d.image}" alt="${d.name}" style="height: 120px; object-fit: contain; margin-bottom: 1rem;" onerror="this.src='https://placehold.co/200x300?text=Device'">
            <div style="font-weight: 800; font-size: 1.25rem;">${d.name}</div>
            <div style="color: var(--accent); font-weight: 700; font-size: 0.9rem;">₹${Number(d.price).toLocaleString('en-IN')}</div>
        </th>`;
    });
    
    html += `</tr></thead><tbody>`;

    categories.forEach(cat => {
        html += `<tr><td class="spec-name">${cat.name}</td>`;
        const values = selectedDevices.map(d => String((d.specs && d.specs[cat.key]) || ''));
        const bestIndex = findBestValue(cat.key, values);

        selectedDevices.forEach((d, i) => {
            const isBest = i === bestIndex;
            const val = (d.specs && d.specs[cat.key]) || '—';
            html += `<td class="spec-value ${isBest ? 'winner' : ''}">${val} ${isBest ? '<span>★</span>' : ''}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    comparisonTableContainer.innerHTML = html;
}

/**
 * Intelligent comparison ranking for tech specs.
 */
function findBestValue(key, values) {
    try {
        const numericValues = values.map(v => {
            if (!v || v === '—') return null;
            // Extract first number found in string
            const match = v.replace(/,/g, '').match(/(\d+\.?\d*)/);
            return match ? parseFloat(match[1]) : null;
        });

        const isNotEmpty = numericValues.some(v => v !== null);
        if (!isNotEmpty) return -1;

        if (key === 'Battery' || key === 'RAM' || key === 'Storage') {
            // Higher is better
            const max = Math.max(...numericValues.filter(v => v !== null));
            return numericValues.indexOf(max);
        }
        
        if (key === 'Weight') {
            // Lower is better (handling g and kg)
            const normalized = values.map(v => {
                const numMatch = v.match(/(\d+\.?\d*)/);
                if (!numMatch) return Infinity;
                let num = parseFloat(numMatch[1]);
                if (v.toLowerCase().includes('kg')) num *= 1000;
                return num;
            });
            const min = Math.min(...normalized);
            return min === Infinity ? -1 : normalized.indexOf(min);
        }

        if (key === 'Display') {
            // Assuming larger screen is 'better' for comparison though subjective
            const max = Math.max(...numericValues.filter(v => v !== null));
            return numericValues.indexOf(max);
        }
    } catch(e) {
        console.error("Comparison ranking error:", e);
    }
    return -1;
}
