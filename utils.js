/**
 * SpecMatch Shared Utilities
 * Consolidated logic for theme switching, local security, and UI rendering.
 */

const Utils = {
    /**
     * Set up theme switching for a page.
     * @param {Object} buttonIds Map of theme names to their button element IDs.
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

        Object.keys(btns).forEach(theme => {
            btns[theme]?.addEventListener('click', () => applyTheme(theme));
        });

        // Initialize from storage or default
        const savedTheme = localStorage.getItem('preferred-theme') || 'light';
        if (btns[savedTheme]) {
            applyTheme(savedTheme);
        } else {
            document.body.setAttribute('data-theme', savedTheme);
        }
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
     * Generate HTML for a device card.
     * @param {Object} device The device data object.
     * @param {Boolean} isSelected Whether the device is currently in the comparison tray.
     * @param {Boolean} isAdminView Whether to render the admin-specific version.
     */
    renderDeviceCard(device, isSelected = false, isAdminView = false) {
        const name = device.name || 'Unknown Device';
        const brand = device.brand || 'Brand';
        const image = device.image || `https://placehold.co/400x600?text=${name.replace(/ /g, '+')}`;
        const specs = device.specs || {};

        // Extract key specs for the preview badges
        const specSummary = Object.entries(specs).slice(0, 3).map(([key, value]) => {
            const shortVal = String(value).split(' ')[0];
            return `<span class="spec-badge">${shortVal} ${key}</span>`;
        }).join('');

        let actionButton = '';
        if (!isAdminView) {
            actionButton = `
                <button class="compare-btn ${isSelected ? 'active' : ''}" onclick="toggleCompare('${device.id}')">
                    ${isSelected ? 'Selected' : 'Add to Compare'}
                </button>`;
        } else {
            actionButton = `
                <div style="font-size: 0.75rem; text-align: center; color: var(--text-secondary); opacity: 0.7; font-weight: 600;">
                    LIVE PREVIEW MODE
                </div>`;
        }

        return `
            <div class="device-card visible" style="pointer-events: ${isAdminView ? 'none' : 'auto'};">
                <div class="device-image-container">
                    <img src="${image}" alt="${name}" class="device-image" onerror="this.src='https://placehold.co/400x600?text=${name.replace(/ /g, '+')}'">
                </div>
                <div class="device-info">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <div class="device-brand">${brand}</div>
                        ${isAdminView ? `<span style="font-size: 0.6rem; background: var(--accent-glow); color: var(--accent); padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 800; text-transform: uppercase;">${device.category}</span>` : ''}
                    </div>
                    <h3 class="device-name">${name}</h3>
                    <div class="device-price">
                        <span style="font-size: 0.9rem; opacity: 0.8;">₹</span>
                        ${device.price ? Number(device.price).toLocaleString('en-IN') : 'TBA'}
                    </div>
                    <div class="device-specs-preview">
                        ${specSummary || '<span class="spec-badge">No specs added</span>'}
                    </div>
                    ${actionButton}
                </div>
            </div>
        `;
    }
};

// Export to window for global access
window.AppUtils = Utils;
