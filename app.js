// app.js - GiftLens AI JavaScript behavior module
// Handles: active nav link highlighting, wishlist toggle, filter UI states, 
// analysis progress animation, and mock upload controls

(function() {
    'use strict';

    const STORAGE_KEY = 'giftlens:wishlist:v1';

    // Utility: Get current page pathname
    function getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path.endsWith('index.html')) return 'home';
        if (path.includes('analysis.html')) return 'analysis';
        if (path.includes('results.html')) return 'results';
        if (path.includes('wishlist.html')) return 'wishlist';
        return 'home';
    }

    // Utility: Set active nav link based on current page
    function highlightActiveNav() {
        const currentPage = getCurrentPage();
        const navMain = document.querySelector('#nav-main');
        if (!navMain) return;
        const navLinks = navMain.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            
            if (currentPage === 'home' && (href === '/' || href === 'index.html' || href === '#hero')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else if (currentPage === 'analysis' && href && href.includes('analysis.html')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else if (currentPage === 'results' && href && href.includes('results.html')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else if (currentPage === 'wishlist' && href && href.includes('wishlist.html')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    // Wishlist: Get wishlist items from sessionStorage
    function getWishlist() {
        const wishlistData = sessionStorage.getItem(STORAGE_KEY);
        try {
            return wishlistData ? JSON.parse(wishlistData) : [];
        } catch (e) {
            console.error('Failed to parse wishlist data', e);
            return [];
        }
    }

    // Wishlist: Save wishlist items to sessionStorage
    function saveWishlist(items) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            // Emit updated event
            const ev = new CustomEvent('wl:updated', { detail: { items: items.slice() } });
            window.dispatchEvent(ev);
        } catch (e) {
            console.error('Failed to save wishlist', e);
        }
    }

    // Wishlist: Toggle wishlist item
    function toggleWishlistItem(productId, productData) {
        let wishlist = getWishlist();
        const existingIndex = wishlist.findIndex(item => item.id === productId);
        
        if (existingIndex > -1) {
            const removed = wishlist.splice(existingIndex, 1)[0];
            saveWishlist(wishlist);
            const ev = new CustomEvent('wl:remove', { detail: { id: productId, item: removed } });
            window.dispatchEvent(ev);
            showToast('Removed from wishlist');
            return false; // Item removed
        } else {
            const item = {
                id: productId,
                name: productData.name,
                price: productData.price,
                image: productData.image,
                source: productData.source || '',
                addedAt: new Date().toISOString()
            };
            wishlist.push(item);
            saveWishlist(wishlist);
            const ev = new CustomEvent('wl:add', { detail: { item } });
            window.dispatchEvent(ev);
            showToast('Saved to wishlist');
            return true; // Item added
        }
    }

    // Wishlist: Update wishlist icon state (header/button)
    function updateWishlistIconState() {
        const wishlist = getWishlist();
        const wishlistBtn = document.querySelector('.wishlist-btn');
        const wishlistIcon = document.querySelector('.wishlist-icon');
        
        if (wishlistIcon && wishlist.length > 0) {
            wishlistIcon.style.fill = '#f5a94b';
        } else if (wishlistIcon) {
            wishlistIcon.style.fill = 'none';
        }
        
        // Update count badge if exists
        const globalCount = document.querySelector('.wishlist-count');
        if (globalCount) {
            globalCount.textContent = wishlist.length;
        }
    }

    // Wishlist: Setup product card wishlist buttons
    function setupProductWishlistButtons() {
        const productCards = document.querySelectorAll('.results-grid .product-card, .product-card');
        
        productCards.forEach((card, index) => {
            // ensure role=article for accessibility
            if (!card.getAttribute('role')) {
                card.setAttribute('role', 'article');
            }

            const productId = card.dataset.productId || `product-${index}`;
            const productName = card.querySelector('.product-title')?.textContent?.trim() || '';
            const productPrice = card.querySelector('.product-price')?.textContent?.trim() || '';
            const productImage = card.querySelector('.product-thumb')?.src || card.querySelector('.product-thumb')?.getAttribute('data-src') || '';
            const productSource = card.querySelector('.product-source')?.textContent?.trim() || '';

            // Create wishlist button if not exists
            let wishlistBtn = card.querySelector('.wishlist-btn');
            if (!wishlistBtn) {
                wishlistBtn = document.createElement('button');
                wishlistBtn.className = 'wishlist-btn';
                wishlistBtn.setAttribute('aria-label', 'Add to wishlist');
                wishlistBtn.setAttribute('aria-pressed', 'false');
                wishlistBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:32px;height:32px;background:#fff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:transform 0.2s;z-index:1;';
                wishlistBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" stroke="#000" fill="none" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
                
                card.style.position = card.style.position || 'relative';
                card.insertBefore(wishlistBtn, card.firstChild);
            }
            
            // Check if item is in wishlist
            const wishlist = getWishlist();
            const isInWishlist = wishlist.some(item => item.id === productId);
            const heartIcon = wishlistBtn.querySelector('svg');
            if (heartIcon) {
                heartIcon.style.fill = isInWishlist ? '#f5a94b' : 'none';
                heartIcon.style.stroke = isInWishlist ? '#f5a94b' : '#000';
            }
            if (isInWishlist) {
                wishlistBtn.classList.add('is-saved');
                wishlistBtn.setAttribute('aria-pressed', 'true');
            } else {
                wishlistBtn.classList.remove('is-saved');
                wishlistBtn.setAttribute('aria-pressed', 'false');
            }
            
            // Add click handler (ensure no duplicate handlers)
            if (!wishlistBtn._giftlensBound) {
                wishlistBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isAdded = toggleWishlistItem(productId, {
                        name: productName,
                        price: productPrice,
                        image: productImage,
                        source: productSource
                    });
                    
                    // Update button state
                    if (heartIcon) {
                        heartIcon.style.fill = isAdded ? '#f5a94b' : 'none';
                        heartIcon.style.stroke = isAdded ? '#f5a94b' : '#000';
                    }
                    if (isAdded) {
                        wishlistBtn.classList.add('is-saved');
                        wishlistBtn.setAttribute('aria-pressed', 'true');
                    } else {
                        wishlistBtn.classList.remove('is-saved');
                        wishlistBtn.setAttribute('aria-pressed', 'false');
                    }
                    
                    // Animation
                    wishlistBtn.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        wishlistBtn.style.transform = 'scale(1)';
                    }, 200);
                    
                    updateWishlistIconState();
                });
                wishlistBtn._giftlensBound = true;
            }
        });
    }

    // Toast notification
    function showToast(message, duration = 3000) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1f36;color:#fff;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600;z-index:1000;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:slideUp 0.3s ease;';
        
        document.body.appendChild(toast);
        // dispatch toast show event
        const tev = new CustomEvent('toast:show', { detail: { message } });
        window.dispatchEvent(tev);
        
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Analysis page: startAnalysis implementation (replaces older setup)
    function startAnalysis(config) {
        const progressEl = document.querySelector('.analysis-progress');
        const stepEl = document.querySelector('.analysis-step');
        // ensure accessibility attributes
        if (progressEl) {
            progressEl.setAttribute('role', 'status');
            progressEl.setAttribute('aria-live', 'polite');
        }
        const steps = [
            { percent: 20, text: 'Analyzing recipient profile...' },
            { percent: 40, text: 'Searching across retailers...' },
            { percent: 60, text: 'Filtering by preferences...' },
            { percent: 80, text: 'Ranking gift matches...' },
            { percent: 100, text: 'Finalizing recommendations...' }
        ];
        
        const startEv = new CustomEvent('analysis:start', { detail: { config: config || null } });
        window.dispatchEvent(startEv);

        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep >= steps.length) {
                clearInterval(interval);
                const completeEv = new CustomEvent('analysis:complete', { detail: {} });
                window.dispatchEvent(completeEv);
                // small delay before navigation
                setTimeout(() => {
                    window.location.href = 'results.html';
                }, 500);
                return;
            }
            
            const step = steps[currentStep];
            if (progressEl) {
                // update via CSS variable for progress
                progressEl.style.setProperty('--progress', step.percent + '%');
                // if there's an inner fill element try to update width for backward compat
                const inner = progressEl.querySelector('.analysis-progress-fill');
                if (inner) inner.style.width = step.percent + '%';
            }
            if (stepEl) {
                stepEl.textContent = step.text;
            }
            const progressEv = new CustomEvent('analysis:progress', { detail: { percent: step.percent, step: step.text } });
            window.dispatchEvent(progressEv);
            currentStep++;
        }, 1500);
    }

    // Backward-compatible wrapper used on DOMContentLoaded
    function setupAnalysisProgress() {
        // call new startAnalysis without config
        startAnalysis();
    }

    // Results page: Filter chip toggles
    function setupFilterChips() {
        const filterChips = document.querySelectorAll('.interest-chip, .filter-chip');
        
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                chip.setAttribute('aria-pressed', chip.classList.contains('active'));
                // emit small event for filters
                const ev = new CustomEvent('filter:toggle', { detail: { id: chip.dataset.filter || null, active: chip.classList.contains('active') }});
                window.dispatchEvent(ev);
            });
        });
    }

    // Results page: Site checkbox toggles
    function setupSiteCheckboxes() {
        const siteCheckboxes = document.querySelectorAll('.site-checkbox');
        
        siteCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const label = checkbox.parentElement;
                if (checkbox.checked) {
                    label.style.background = '#f5f5f7';
                    label.style.borderColor = '#f5a94b';
                } else {
                    label.style.background = '#fff';
                    label.style.borderColor = '#e8e8ea';
                }
            });
        });
    }

    // Results page: Sort dropdown
    function setupSortDropdown() {
        const sortSelect = document.querySelector('.sort-select');
        
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const selectedValue = sortSelect.value;
                console.log('Sort by:', selectedValue);
                // Visual feedback only
                showToast(`Sorting by ${sortSelect.options[sortSelect.selectedIndex].text}`);
            });
        }
    }

    // Results page: Price range slider
    function setupPriceRange() {
        const priceRangeInputs = document.querySelectorAll('.price-range-input');
        const priceDisplay = document.querySelector('.price-range-display');
        
        priceRangeInputs.forEach(input => {
            input.addEventListener('input', () => {
                const minPrice = document.querySelector('.price-min')?.value || 0;
                const maxPrice = document.querySelector('.price-max')?.value || 500;
                if (priceDisplay) {
                    priceDisplay.textContent = `$${minPrice} - $${maxPrice}`;
                }
            });
        });
    }

    // Results page: Compare checkbox toggles
    function setupCompareCheckboxes() {
        const compareCheckboxes = document.querySelectorAll('.compare-checkbox');
        let compareCount = 0;
        
        compareCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                compareCount = document.querySelectorAll('.compare-checkbox:checked').length;
                
                if (compareCount > 4) {
                    checkbox.checked = false;
                    showToast('Maximum 4 items can be compared');
                    return;
                }
                
                if (compareCount > 0) {
                    showCompareBar(compareCount);
                } else {
                    hideCompareBar();
                }
            });
        });
    }

    function showCompareBar(count) {
        let compareBar = document.querySelector('.compare-bar');
        
        if (!compareBar) {
            compareBar = document.createElement('div');
            compareBar.className = 'compare-bar';
            compareBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1f36;color:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;z-index:100;box-shadow:0 -4px 16px rgba(0,0,0,0.2);';
            compareBar.innerHTML = `
                <span class="compare-count">${count} items selected</span>
                <button class="compare-btn" style="background:#f5a94b;color:#000;font-weight:700;padding:12px 32px;border:none;border-radius:24px;cursor:pointer;">Compare Now</button>
            `;
            document.body.appendChild(compareBar);
            
            compareBar.querySelector('.compare-btn').addEventListener('click', () => {
                showToast('Compare feature coming soon!');
            });
        } else {
            compareBar.querySelector('.compare-count').textContent = `${count} items selected`;
        }
    }

    function hideCompareBar() {
        const compareBar = document.querySelector('.compare-bar');
        if (compareBar) compareBar.remove();
    }

    // Mock upload controls
    function setupUploadControls() {
        const uploadInput = document.querySelector('.hero-upload .upload-input, .upload-input');
        const uploadPreview = document.querySelector('.hero-upload .upload-preview, .upload-preview');
        const removeUploadBtn = document.querySelector('.hero-upload .remove-upload-btn, .remove-upload-btn');
        
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (uploadPreview) {
                            uploadPreview.src = event.target.result;
                            uploadPreview.alt = file.name;
                        }
                        showToast('Image uploaded successfully');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        if (removeUploadBtn && uploadPreview) {
            removeUploadBtn.addEventListener('click', () => {
                uploadPreview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f5f5f7" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ENo image%3C/text%3E%3C/svg%3E';
                uploadPreview.alt = 'No image selected';
                if (uploadInput) uploadInput.value = '';
                showToast('Image removed');
            });
        }
    }

    // Copy link functionality
    function setupCopyLink() {
        const copyLinkBtns = document.querySelectorAll('.copy-btn, .copy-link-btn');
        
        copyLinkBtns.forEach(btn => {
            if (btn._giftlensCopyBound) return;
            btn.addEventListener('click', () => {
                const url = window.location.href;
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(() => {
                        showToast('Link copied to clipboard');
                        const ev = new CustomEvent('clipboard:copy', { detail: { text: url }});
                        window.dispatchEvent(ev);
                    }).catch(() => {
                        fallbackCopyText(url);
                    });
                } else {
                    fallbackCopyText(url);
                }
            });
            btn._giftlensCopyBound = true;
        });
    }

    function fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Link copied to clipboard');
            const ev = new CustomEvent('clipboard:copy', { detail: { text }});
            window.dispatchEvent(ev);
        } catch (err) {
            showToast('Failed to copy link');
        }
        document.body.removeChild(textArea);
    }

    // Export CSV simulation
    function setupExportCSV() {
        const exportBtns = document.querySelectorAll('.export-csv, .export-csv-btn');
        
        exportBtns.forEach(btn => {
            if (btn._giftlensExportBound) return;
            btn.addEventListener('click', () => {
                const csvContent = 'data:text/csv;charset=utf-8,Product Name,Price,Site\nSmart Speaker,$19.50,Amazon\nCeramic Mug,$29.00,Etsy\n';
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'giftlens-results.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('CSV exported successfully');
                const ev = new CustomEvent('csv:export', { detail: { filename: 'giftlens-results.csv' }});
                window.dispatchEvent(ev);
            });
            btn._giftlensExportBound = true;
        });
    }

    // Add CSS animations
    function injectAnimations() {
        if (document.querySelector('#giftlens-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'giftlens-animations';
        style.textContent = `
            @keyframes slideUp {
                from { transform: translate(-50%, 20px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes slideDown {
                from { transform: translate(-50%, 0); opacity: 1; }
                to { transform: translate(-50%, 20px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Integrity checks per contract
    function runIntegrityChecks() {
        const navMain = document.querySelector('#nav-main');
        const providerBar = document.querySelector('.provider-bar');
        const affiliateNote = document.querySelector('.affiliate-note');
        const resultsGrid = document.querySelector('.results-grid');

        let criticalMissing = false;

        if (!navMain) {
            console.error('Critical: #nav-main not found');
            showToast('Navigation not found; some features disabled', 4000);
            criticalMissing = true;
        }
        if (!providerBar) {
            console.error('Critical: .provider-bar not found');
            showToast('Provider bar missing; some features disabled', 4000);
            criticalMissing = true;
        } else {
            const expected = 'Searching: Amazon ? Shop ? Etsy ? Walmart ? More';
            if (providerBar.textContent.trim() !== expected) {
                console.error('Provider bar content mismatch', providerBar.textContent.trim());
                showToast('Provider bar content unexpected', 4000);
            }
        }
        if (!affiliateNote) {
            console.error('Critical: .affiliate-note not found');
            showToast('Affiliate note missing; some features disabled', 4000);
            criticalMissing = true;
        } else {
            const expectedAff = 'All purchases may use affiliate links.';
            if (affiliateNote.textContent.trim() !== expectedAff) {
                console.error('Affiliate note content mismatch', affiliateNote.textContent.trim());
                showToast('Affiliate note content unexpected', 4000);
            }
        }

        if (resultsGrid) {
            const cards = resultsGrid.querySelectorAll('.product-card');
            if (cards.length < 12 || cards.length > 16) {
                console.warn('Results grid expected 12-16 .product-card items, found:', cards.length);
                showToast('Unexpected number of results found', 3000);
            }
        }

        return !criticalMissing;
    }

    // Initialize all features
    function init(appConfig) {
        injectAnimations();
        // run integrity checks
        const ok = runIntegrityChecks();

        highlightActiveNav();
        updateWishlistIconState();
        setupProductWishlistButtons();
        setupFilterChips();
        setupSiteCheckboxes();
        setupSortDropdown();
        setupPriceRange();
        setupCompareCheckboxes();
        setupUploadControls();
        setupCopyLink();
        setupExportCSV();

        // Page-specific initialization
        const currentPage = getCurrentPage();
        if (currentPage === 'analysis' && ok) {
            setupAnalysisProgress();
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }

    // Re-run setup when navigating back
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            init();
        }
    });

    // Public API exposure
    window.GiftLens = {
        init: function(appConfig) {
            init(appConfig);
        },
        addToWishlist: function(id, data) {
            const added = toggleWishlistItem(id, data || {});
            // ensure saved
            saveWishlist(getWishlist());
            return added;
        },
        removeFromWishlist: function(id) {
            const wishlist = getWishlist();
            const idx = wishlist.findIndex(i => i.id === id);
            if (idx > -1) {
                const removed = wishlist.splice(idx, 1)[0];
                saveWishlist(wishlist);
                const ev = new CustomEvent('wl:remove', { detail: { id: id, item: removed }});
                window.dispatchEvent(ev);
                const upd = new CustomEvent('wl:updated', { detail: { items: wishlist.slice() }});
                window.dispatchEvent(upd);
                return true;
            }
            return false;
        },
        getWishlist: function() {
            return getWishlist();
        },
        startAnalysis: function(config) {
            startAnalysis(config);
        },
        exportCSV: function(items) {
            // basic CSV export; items expected array of objects
            const header = 'data:text/csv;charset=utf-8,Product Name,Price,Site\n';
            const rows = (items || []).map(i => `${(i.name||'').replace(/,/g,'')},${(i.price||'')},${(i.source||'')}`).join('\n');
            const csvContent = header + rows;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'giftlens-export.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            const ev = new CustomEvent('csv:export', { detail: { filename: 'giftlens-export.csv', items: items || [] }});
            window.dispatchEvent(ev);
        },
        copyToClipboard: function(text) {
            if (!text) text = window.location.href;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Link copied to clipboard');
                    const ev = new CustomEvent('clipboard:copy', { detail: { text }});
                    window.dispatchEvent(ev);
                }).catch(() => {
                    fallbackCopyText(text);
                });
            } else {
                fallbackCopyText(text);
            }
        },
        showToast: function(message, options) {
            showToast(message, options && options.duration ? options.duration : 3000);
        }
    };

})();