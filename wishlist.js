// Wishlist functionality for GiftLens AI

(function() {
    'use strict';

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            mobileMenuToggle.setAttribute('aria-expanded', String(!isExpanded));
            navMenu.classList.toggle('active');
        });
    }

    // Session storage key (use sessionStorage per contract)
    const SESSION_KEY = 'giftlens:wishlist:v1';

    // Disabled flag if integrity checks fail
    let disabled = false;

    // Small selector map to hydrate canonical selectors
    const selectorMap = {
        '.qty-input': '.quantity-input',
        '.product-title': '.product-name',
        '.subtotal': '#subtotal'
    };

    function s(selector, root = document) {
        const mapped = selectorMap[selector] || selector;
        return root.querySelector(mapped);
    }
    function ss(selector, root = document) {
        const mapped = selectorMap[selector] || selector;
        return root.querySelectorAll(mapped);
    }

    // Initialize wishlist data from sessionStorage or defaults
    let wishlistData = {
        items: [],
        budget: 300,
        subtotal: 0
    };

    // Load wishlist from sessionStorage
    function loadWishlist() {
        try {
            const saved = sessionStorage.getItem(SESSION_KEY);
            if (saved) {
                wishlistData = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading wishlist:', e);
        }
    }

    // Save wishlist to sessionStorage
    function saveWishlist() {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(wishlistData));
        } catch (e) {
            console.error('Error saving wishlist:', e);
        }
    }

    // Calculate subtotal
    function calculateSubtotal() {
        wishlistData.subtotal = wishlistData.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        return wishlistData.subtotal;
    }

    // Show notification (and emit toast:show)
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            background: #1a1f36;
            color: #ffffff;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);

        // Emit toast:show event
        try {
            document.dispatchEvent(new CustomEvent('toast:show', { detail: { message } }));
        } catch (e) {
            // ignore
        }
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Update UI with current wishlist data
    function updateUI() {
        const subtotal = calculateSubtotal();
        const remaining = wishlistData.budget - subtotal;
        const percentage = Math.min(100, Math.round((subtotal / wishlistData.budget) * 100));

        // Update summary card
        const subtotalEl = s('.subtotal') || document.getElementById('subtotal');
        const remainingEl = document.getElementById('budget-remaining');
        const budgetFillEl = document.querySelector('.budget-fill');
        const budgetBarEl = document.querySelector('.budget-bar');

        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (remainingEl) remainingEl.textContent = `$${remaining.toFixed(2)}`;
        if (budgetFillEl) budgetFillEl.style.width = `${percentage}%`;
        if (budgetBarEl) {
            budgetBarEl.setAttribute('aria-valuenow', percentage);
            budgetBarEl.setAttribute('aria-label', `Budget used: ${percentage}%`);
        }
    }

    // Dispatch wl:updated event with current data
    function emitWishlistUpdated() {
        try {
            document.dispatchEvent(new CustomEvent('wl:updated', { detail: { wishlist: wishlistData } }));
        } catch (e) {}
    }

    // Quantity control handlers
    function handleQuantityChange(productId, action) {
        const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
        if (!card) return;

        const input = s('.quantity-input', card) || card.querySelector('.quantity-input');
        const decreaseBtn = card.querySelector('[data-action="decrease"]');
        
        let currentValue = parseInt(input.value) || 1;

        if (action === 'increase') {
            currentValue++;
        } else if (action === 'decrease' && currentValue > 1) {
            currentValue--;
        }

        input.value = currentValue;
        if (decreaseBtn) decreaseBtn.disabled = currentValue <= 1;

        // Update wishlist data
        const itemIndex = wishlistData.items.findIndex(item => item.id === productId);
        if (itemIndex !== -1) {
            wishlistData.items[itemIndex].quantity = currentValue;
        }

        saveWishlist();
        updateUI();
        emitWishlistUpdated();
    }

    // Initialize quantity controls
    function initQuantityControls() {
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const card = this.closest('.product-card');
                const productId = card.getAttribute('data-product-id');
                const action = this.getAttribute('data-action');
                handleQuantityChange(productId, action);
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', function(e) {
                const card = this.closest('.product-card');
                const productId = card.getAttribute('data-product-id');
                let value = parseInt(this.value) || 1;
                value = Math.max(1, value);
                this.value = value;

                const itemIndex = wishlistData.items.findIndex(item => item.id === productId);
                if (itemIndex !== -1) {
                    wishlistData.items[itemIndex].quantity = value;
                }

                const decreaseBtn = card.querySelector('[data-action="decrease"]');
                if (decreaseBtn) decreaseBtn.disabled = value <= 1;

                saveWishlist();
                updateUI();
                emitWishlistUpdated();
            });
        });
    }

    // Initialize wishlist add/remove buttons (manage aria and events)
    function initWishlistButtons() {
        document.querySelectorAll('.product-card').forEach(card => {
            card.setAttribute('role', 'article');
            const btn = card.querySelector('.wishlist-btn');
            if (!btn) return;
            // initialize aria
            const productId = card.getAttribute('data-product-id');
            const exists = wishlistData.items.some(i => i.id === productId);
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-pressed', exists ? 'true' : 'false');
            btn.setAttribute('aria-label', exists ? 'Remove from wishlist' : 'Add to wishlist');

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const pid = card.getAttribute('data-product-id');
                const isPressed = btn.getAttribute('aria-pressed') === 'true';
                if (isPressed) {
                    removeFromWishlist(pid);
                    btn.setAttribute('aria-pressed', 'false');
                    btn.setAttribute('aria-label', 'Add to wishlist');
                    try {
                        document.dispatchEvent(new CustomEvent('wl:remove', { detail: { productId: pid } }));
                    } catch (err) {}
                } else {
                    addToWishlist(pid);
                    btn.setAttribute('aria-pressed', 'true');
                    btn.setAttribute('aria-label', 'Remove from wishlist');
                    try {
                        document.dispatchEvent(new CustomEvent('wl:add', { detail: { productId: pid } }));
                    } catch (err) {}
                }
                emitWishlistUpdated();
            });
        });
    }

    // Share link functionality
    function shareLink() {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({
                title: 'My GiftLens Wishlist',
                text: 'Check out my wishlist!',
                url: url
            }).catch(err => console.log('Share cancelled'));
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                showNotification('Link copied to clipboard!');
            }).catch(err => {
                console.error('Could not copy link:', err);
            });
        } else {
            prompt('Copy this link:', url);
        }
    }

    // Export to CSV
    function exportCSV() {
        const headers = ['Product Name', 'Price', 'Quantity', 'Total', 'Source', 'Link'];
        const rows = [];

        document.querySelectorAll('.product-card').forEach(card => {
            const nameEl = s('.product-title', card) || card.querySelector('.product-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const priceEl = card.querySelector('.product-price');
            const price = priceEl ? priceEl.textContent.trim().replace('$', '') : '0';
            const quantityEl = s('.quantity-input', card) || card.querySelector('.quantity-input');
            const quantity = quantityEl ? quantityEl.value : '1';
            const sourceEl = card.querySelector('.product-source');
            const source = sourceEl ? (sourceEl.textContent || sourceEl.innerText).trim() : '';
            const link = sourceEl ? sourceEl.href : '';
            
            rows.push([name, price, quantity, (parseFloat(price) * parseInt(quantity || '1')).toFixed(2), source, link]);
        });

        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'giftlens_wishlist.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);

        // Emit csv:export event
        try {
            document.dispatchEvent(new CustomEvent('csv:export', { detail: { csv: csvContent } }));
        } catch (e) {}

        link.click();
        document.body.removeChild(link);

        showNotification('Wishlist exported successfully!');
    }

    // Copy list to clipboard
    function copyList() {
        let listText = 'My Wishlist:\n\n';
        
        document.querySelectorAll('.product-card').forEach(card => {
            const nameEl = s('.product-title', card) || card.querySelector('.product-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const priceEl = card.querySelector('.product-price');
            const price = priceEl ? priceEl.textContent.trim() : '';
            const quantityEl = s('.quantity-input', card) || card.querySelector('.quantity-input');
            const quantity = quantityEl ? quantityEl.value : '1';
            const sourceEl = card.querySelector('.product-source');
            const source = sourceEl ? (sourceEl.textContent || sourceEl.innerText).trim() : '';
            const link = sourceEl ? sourceEl.href : '';
            
            listText += `${name} - ${price} (Qty: ${quantity}) - ${source}\n${link}\n\n`;
        });

        listText += `Subtotal: $${wishlistData.subtotal.toFixed(2)}\n`;
        listText += `Budget Remaining: $${(wishlistData.budget - wishlistData.subtotal).toFixed(2)}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(listText).then(() => {
                showNotification('List copied to clipboard!');
                try {
                    document.dispatchEvent(new CustomEvent('clipboard:copy', { detail: { text: listText } }));
                } catch (e) {}
            }).catch(err => {
                console.error('Could not copy list:', err);
            });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = listText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showNotification('List copied to clipboard!');
            try {
                document.dispatchEvent(new CustomEvent('clipboard:copy', { detail: { text: listText } }));
            } catch (e) {}
        }
    }

    // alias export name for public API
    function copyToClipboard() {
        return copyList();
    }

    // Send to email
    function sendToEmail() {
        const subject = encodeURIComponent('My GiftLens Wishlist');
        let body = 'My Wishlist:%0D%0A%0D%0A';
        
        document.querySelectorAll('.product-card').forEach(card => {
            const nameEl = s('.product-title', card) || card.querySelector('.product-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const priceEl = card.querySelector('.product-price');
            const price = priceEl ? priceEl.textContent.trim() : '';
            const quantityEl = s('.quantity-input', card) || card.querySelector('.quantity-input');
            const quantity = quantityEl ? quantityEl.value : '1';
            const link = (card.querySelector('.product-source') || {}).href || '';
            
            body += `${name} - ${price} (Qty: ${quantity})%0D%0A${link}%0D%0A%0D%0A`;
        });

        body += `Subtotal: $${wishlistData.subtotal.toFixed(2)}%0D%0A`;
        body += `Budget Remaining: $${(wishlistData.budget - wishlistData.subtotal).toFixed(2)}`;

        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    // Initialize action buttons
    function initActionButtons() {
        const shareLinkBtn = document.getElementById('share-link-btn');
        const exportCSVBtn = document.getElementById('export-csv-btn');
        const copyListBtn = document.getElementById('copy-list-btn');
        const emailBtn = document.getElementById('email-btn');

        if (shareLinkBtn) shareLinkBtn.addEventListener('click', shareLink);
        if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportCSV);
        if (copyListBtn) copyListBtn.addEventListener('click', copyList);
        if (emailBtn) emailBtn.addEventListener('click', sendToEmail);
    }

    // Initialize product data from DOM
    function initializeProductData() {
        wishlistData.items = [];
        
        document.querySelectorAll('.product-card').forEach(card => {
            card.setAttribute('role', 'article');
            const id = card.getAttribute('data-product-id');
            const nameEl = s('.product-title', card) || card.querySelector('.product-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const priceTextEl = card.querySelector('.product-price');
            const priceText = priceTextEl ? priceTextEl.textContent.trim() : '$0';
            const price = parseFloat(priceText.replace('$', '')) || 0;
            const quantityEl = s('.quantity-input', card) || card.querySelector('.quantity-input');
            const quantity = parseInt(quantityEl ? quantityEl.value : '1') || 1;
            
            wishlistData.items.push({
                id: id,
                name: name,
                price: price,
                quantity: quantity
            });
        });

        saveWishlist();
        updateUI();
    }

    // Add to wishlist by productId
    function addToWishlist(productId) {
        if (!productId) return;
        const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
        if (!card) return;
        const exists = wishlistData.items.some(i => i.id === productId);
        if (exists) return;
        const nameEl = s('.product-title', card) || card.querySelector('.product-name');
        const priceEl = card.querySelector('.product-price');
        const quantityEl = s('.quantity-input', card) || card.querySelector('.quantity-input');
        const item = {
            id: productId,
            name: nameEl ? nameEl.textContent.trim() : '',
            price: priceEl ? parseFloat((priceEl.textContent || '').replace('$', '')) || 0 : 0,
            quantity: quantityEl ? parseInt(quantityEl.value) || 1 : 1
        };
        wishlistData.items.push(item);
        saveWishlist();
        updateUI();
        try {
            document.dispatchEvent(new CustomEvent('wl:add', { detail: { item } }));
            document.dispatchEvent(new CustomEvent('wl:updated', { detail: { wishlist: wishlistData } }));
        } catch (e) {}
    }

    // Remove from wishlist by productId
    function removeFromWishlist(productId) {
        if (!productId) return;
        const idx = wishlistData.items.findIndex(i => i.id === productId);
        if (idx === -1) return;
        const removed = wishlistData.items.splice(idx, 1)[0];
        saveWishlist();
        updateUI();
        try {
            document.dispatchEvent(new CustomEvent('wl:remove', { detail: { item: removed } }));
            document.dispatchEvent(new CustomEvent('wl:updated', { detail: { wishlist: wishlistData } }));
        } catch (e) {}
    }

    // Get wishlist items
    function getWishlist() {
        return wishlistData.items.slice();
    }

    // Start analysis stub (exposed)
    function startAnalysis() {
        // minimal stub: emit an event to indicate analysis requested
        try {
            document.dispatchEvent(new CustomEvent('startanalysis', { detail: { wishlist: wishlistData } }));
        } catch (e) {}
    }

    // Integrity checks per contract
    function initIntegrityChecks() {
        let ok = true;

        const navMain = document.getElementById('nav-main');
        if (!navMain) {
            console.error('#nav-main missing');
            ok = false;
        }

        const providerBar = document.querySelector('.provider-bar');
        const expectedProviderText = 'Searching: Amazon ? Shop ? Etsy ? Walmart ? More';
        if (!providerBar || providerBar.textContent.trim() !== expectedProviderText) {
            console.error('.provider-bar missing or text mismatch');
            ok = false;
        }

        const affiliateNote = document.querySelector('.affiliate-note');
        const expectedAffiliateText = 'All purchases may use affiliate links.';
        if (!affiliateNote || affiliateNote.textContent.trim() !== expectedAffiliateText) {
            console.error('.affiliate-note missing or text mismatch');
            ok = false;
        }

        const results = document.querySelectorAll('.results-grid .product-card');
        if (!results || results.length < 12 || results.length > 16) {
            console.error('.results-grid does not contain 12-16 .product-card elements');
            ok = false;
        }

        const wishlistList = document.querySelector('.wishlist-list');
        if (!wishlistList) {
            console.error('.wishlist-list missing');
            ok = false;
        }

        if (!ok) {
            console.error('Integrity checks failed. Disabling wishlist features.');
            showNotification('Feature unavailable');
            disabled = true;
        }
    }

    // Initialize on DOM ready
    function init() {
        // perform integrity checks first
        initIntegrityChecks();
        if (disabled) return;

        loadWishlist();
        
        // If no saved data, initialize from DOM
        if (!wishlistData.items || wishlistData.items.length === 0) {
            initializeProductData();
        }
        
        initQuantityControls();
        initActionButtons();
        initWishlistButtons();
        updateUI();

        // Set initial disabled state for decrease buttons
        document.querySelectorAll('.product-card').forEach(card => {
            const input = card.querySelector('.quantity-input');
            const decreaseBtn = card.querySelector('[data-action="decrease"]');
            if (input && decreaseBtn && parseInt(input.value) <= 1) {
                decreaseBtn.disabled = true;
            }
        });
    }

    // Public API exposure and event mapping
    window.giftlens = {
        init: init,
        addToWishlist: addToWishlist,
        removeFromWishlist: removeFromWishlist,
        getWishlist: getWishlist,
        startAnalysis: startAnalysis,
        exportCSV: exportCSV,
        copyToClipboard: copyToClipboard,
        showToast: showNotification
    };

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

})();
