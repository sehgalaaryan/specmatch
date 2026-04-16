/**
 * SpecMatch Shared Utilities
 * Consolidated logic for theme switching, local security, and UI rendering.
 */

const Utils = {
    /**
     * Set up theme switching for a page.
     */
    setupThemeSwitcher(buttonIds) {
        const btns = {};
        for (const [theme, id] of Object.entries(buttonIds)) {
            btns[theme] = document.getElementById(id);
        }

        const applyTheme = (theme) => {
            document.body.setAttribute('data-theme', theme);
            Object.values(btns).forEach(b => b?.classList.remove('active'));
            btns[theme]?.classList.add('active');
            localStorage.setItem('preferred-theme', theme);
        };

        const savedTheme = localStorage.getItem('preferred-theme') || 'light';
        applyTheme(savedTheme);

        Object.keys(btns).forEach(theme => {
            btns[theme]?.addEventListener('click', () => applyTheme(theme));
        });
    },

    /**
     * Consolidated Navigation Controller.
     * Handles coordinated triggers (header/drawer) and synchronized "Red Mode" state.
     */
    initNavigation() {
        const mainToggle = document.getElementById('menu-toggle');
        const drawerToggle = document.getElementById('menu-toggle-drawer');
        const drawer = document.getElementById('nav-drawer');
        const overlay = document.getElementById('drawer-overlay');
        
        if (!drawer || !overlay) return;

        const setDRAWERState = (isActive) => {
            drawer.classList.toggle('active', isActive);
            overlay.classList.toggle('active', isActive);
            
            // Sync all icon triggers to 'is-active' (Red Mode)
            if (mainToggle) mainToggle.classList.toggle('is-active', isActive);
            if (drawerToggle) drawerToggle.classList.toggle('is-active', isActive);
            
            document.body.style.overflow = isActive ? 'hidden' : 'auto';
        };

        mainToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentlyActive = drawer.classList.contains('active');
            setDRAWERState(!currentlyActive);
        });

        drawerToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            setDRAWERState(false);
        });

        overlay.addEventListener('click', () => setDRAWERState(false));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setDRAWERState(false);
        });
    },

    /**
     * Unified Category Management.
     * @param {string} initialCat The starting category.
     * @param {function} onSwitch Callback executed when a new category is selected.
     */
    initCategorySwitcher(initialCat, onSwitch) {
        const allLinks = document.querySelectorAll('.menu-item, .nav-link');
        let currentCat = initialCat;

        const updateUI = (cat) => {
            allLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-category') === cat);
            });
        };

        // Set initial UI state
        updateUI(initialCat);

        allLinks.forEach(link => {
            link.addEventListener('click', () => {
                const cat = link.getAttribute('data-category');
                if (currentCat === cat) return;
                
                currentCat = cat;
                updateUI(cat);

                // Auto-close navigation on selection
                const drawer = document.getElementById('nav-drawer');
                const overlay = document.getElementById('drawer-overlay');
                const mainToggle = document.getElementById('menu-toggle');

                drawer?.classList.remove('active');
                overlay?.classList.remove('active');
                mainToggle?.classList.remove('is-active');
                document.body.style.overflow = 'auto';

                if (onSwitch) onSwitch(cat);
            });
        });
    },

    /**
     * Collision-resistant ID generator for device records.
     */
    generateUniqueId() {
        return `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * PBKDF2 Password Hashing for local authentication.
     */
    async hashPassword(password) {
        const salt = new TextEncoder().encode("SpecMatch_Admin_Salt");
        const iterations = 100000;
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            "raw", 
            encoder.encode(password), 
            "PBKDF2", 
            false, 
            ["deriveBits", "deriveKey"]
        );
        const derivedKey = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: iterations,
                hash: "SHA-256"
            },
            passwordKey,
            256
        );
        return Array.from(new Uint8Array(derivedKey))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    /**
     * Debounce helper for search and re-renders.
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Generate HTML for a device card.
     */
    renderDeviceCard(device, isSelected = false, isAdminView = false) {
        const name = device.name || 'Unknown Device';
        const brand = device.brand || 'Brand';
        const image = device.image || `https://placehold.co/400x600?text=${name.replace(/ /g, '+')}`;
        const specs = device.specs || {};

        const specSummary = Object.entries(specs).slice(0, 3).map(([key, value]) => {
            const shortVal = String(value).split(' ')[0];
            return `<span class="spec-badge">${shortVal} ${key}</span>`;
        }).join('');

        let actionButton = '';
        if (!isAdminView) {
            actionButton = `
                <button class="compare-btn ${isSelected ? 'active' : ''}" onclick="toggleCompare('${device.id}')">
                    ${isSelected ? 'Selected ✓' : 'Add to Compare'}
                </button>`;
        } else {
            actionButton = `
                <div style="font-size: 0.7rem; text-align: center; color: var(--accent); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                    LIVE PREVIEW MODE
                </div>`;
        }

        return `
            <div class="device-card ${isAdminView ? '' : 'reveal'}" style="pointer-events: ${isAdminView ? 'none' : 'auto'};">
                <div class="device-image-container">
                    <img src="${image}" alt="${name}" class="device-image" onerror="this.src='https://placehold.co/400x600?text=${name.replace(/ /g, '+')}'">
                </div>
                <div class="device-info">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div class="device-brand">${brand}</div>
                        ${isAdminView ? `<span style="font-size: 0.6rem; background: var(--accent-glow); color: var(--accent); padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 800; text-transform: uppercase;">${device.category}</span>` : ''}
                    </div>
                    <h3 class="device-name">${name}</h3>
                    <div class="device-price">
                        <span style="font-size: 1rem; opacity: 0.8; font-weight: 600;">₹</span>
                        ${device.price ? Number(device.price).toLocaleString('en-IN') : 'TBA'}
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem;">
                        ${specSummary || '<span class="spec-badge">No specs added</span>'}
                    </div>
                    ${actionButton}
                </div>
            </div>
        `;
    }
};

window.AppUtils = Utils;
