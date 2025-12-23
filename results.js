// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    // Public namespace and utilities
    window.giftLens = window.giftLens || {};

    // Simple toast implementation used by integrity checks and other features
    function showToast(msg, opts = {}) {
        try {
            const existing = document.querySelector('.giftlens-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'giftlens-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(0,0,0,0.85)';
            toast.style.color = '#fff';
            toast.style.padding = '8px 12px';
            toast.style.borderRadius = '6px';
            toast.style.zIndex = 9999;
            toast.textContent = msg;
            document.body.appendChild(toast);
            const ttl = opts.duration || 4000;
            setTimeout(() => {
                toast.remove();
            }, ttl);
        } catch (e) {
            // Fallback
            try { alert(msg); } catch (err) { /* silent */ }
        }
    }

    // Session storage wishlist helpers
    const WISHLIST_KEY = 'giftlens:wishlist:v1';

    function _readWishlist() {
        try {
            const raw = sessionStorage.getItem(WISHLIST_KEY);
            if (!raw) return [];
            return JSON.parse(raw) || [];
        } catch (e) {
            return [];
        }
    }

    function _writeWishlist(arr) {
        try {
            sessionStorage.setItem(WISHLIST_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to persist wishlist', e);
        }
    }

    // Public methods (will be assigned to window.giftLens below)
    function addToWishlist(productId) {
        if (!productId) return false;
        const list = _readWishlist();
        if (!list.includes(productId)) {
            list.push(productId);
            _writeWishlist(list);
            // update DOM
            const btn = document.querySelector(`.product-card[data-product-id="${productId}"] .wishlist-btn`);
            if (btn) {
                btn.classList.add('is-saved');
                btn.setAttribute('aria-pressed', 'true');
            }
            document.dispatchEvent(new CustomEvent('wl:add', { detail: { id: productId } }));
            document.dispatchEvent(new CustomEvent('wl:updated', { detail: { list: list.slice() } }));
            return true;
        }
        return false;
    }

    function removeFromWishlist(productId) {
        if (!productId) return false;
        let list = _readWishlist();
        if (list.includes(productId)) {
            list = list.filter(id => id !== productId);
            _writeWishlist(list);
            // update DOM
            const btn = document.querySelector(`.product-card[data-product-id="${productId}"] .wishlist-btn`);
            if (btn) {
                btn.classList.remove('is-saved');
                btn.setAttribute('aria-pressed', 'false');
            }
            document.dispatchEvent(new CustomEvent('wl:remove', { detail: { id: productId } }));
            document.dispatchEvent(new CustomEvent('wl:updated', { detail: { list: list.slice() } }));
            return true;
        }
        return false;
    }

    function getWishlist() {
        return _readWishlist();
    }

    function exportCSV() {
        const list = getWishlist();
        if (!list.length) {
            showToast('No wishlist items to export');
            return;
        }
        const csvContent = 'Product ID\n' + list.map(id => `"${id}"`).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wishlist.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Wishlist exported');
    }

    function copyToClipboard(text) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard');
            }).catch(() => {
                showToast('Copy failed');
            });
        } else {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                showToast('Copied to clipboard');
            } catch (e) {
                showToast('Copy failed');
            }
            ta.remove();
        }
    }

    // Simple analysis runner with events
    function startAnalysis(items) {
        const el = document.querySelector('.analysis-progress');
        let ids = items || getWishlist();
        if (!ids || !ids.length) {
            showToast('No items to analyze');
            return;
        }
        if (el) {
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.textContent = 'Starting analysis...';
            el.dataset.progress = '0';
        }
        let progress = 0;
        const total = ids.length;
        const interval = setInterval(() => {
            progress += 1;
            const percent = Math.min(100, Math.round((progress / total) * 100));
            if (el) {
                el.textContent = `Analyzing (${percent}%)`;
                el.dataset.progress = String(percent);
            }
            document.dispatchEvent(new CustomEvent('analysis:progress', { detail: { progress: percent, processed: progress, total } }));
            if (progress >= total) {
                clearInterval(interval);
                if (el) {
                    el.textContent = 'Analysis complete';
                }
                document.dispatchEvent(new CustomEvent('analysis:complete', { detail: { total } }));
                showToast('Analysis complete');
            }
        }, 350);
    }

    // Attach public API
    window.giftLens.init = window.giftLens.init || function init() {
        // Integrity and content checks (I2)
        const navMain = document.querySelector('header nav.nav-right');
        const providerBar = document.querySelector('.secondary-nav');
        const affiliateNote = document.querySelector('.affiliate-notice');

        let integrityOk = true;
        const expectedProvider = 'Searching: Amazon ? Shop ? Etsy ? Walmart ? More';
        const expectedAffiliate = 'All purchases may use affiliate links.';

        if (!navMain || !providerBar || !affiliateNote) {
            console.error('giftLens: missing required DOM elements (header nav, .secondary-nav, .affiliate-notice)');
            showToast('Feature unavailable: required UI elements missing');
            integrityOk = false;
        } else {
            if ((providerBar.textContent || '').trim() !== expectedProvider) {
                console.error('giftLens: provider bar text mismatch');
                showToast('Feature unavailable: provider bar mismatch');
                integrityOk = false;
            }
            if ((affiliateNote.textContent || '').trim() !== expectedAffiliate) {
                console.error('giftLens: affiliate note text mismatch');
                showToast('Feature unavailable: affiliate note mismatch');
                integrityOk = false;
            }
        }

        window.giftLens._integrityOk = integrityOk;

        // Mobile menu toggle
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', function() {
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !isExpanded);
                if (navMenu) navMenu.classList.toggle('active');
            });
        }

        // Price range slider
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');
        const priceTrack = document.querySelector('.price-slider-track');

        function updatePriceTrack() {
            const minVal = parseInt(priceMin.value);
            const maxVal = parseInt(priceMax.value);
            const minPercent = (minVal / 100) * 100;
            const maxPercent = (maxVal / 100) * 100;

            if (priceTrack) {
                priceTrack.style.left = minPercent + '%';
                priceTrack.style.right = (100 - maxPercent) + '%';
            }
        }

        if (priceMin && priceMax) {
            priceMin.addEventListener('input', updatePriceTrack);
            priceMax.addEventListener('input', updatePriceTrack);
            updatePriceTrack();
        }

        // Price preset buttons
        const pricePresets = document.querySelectorAll('.price-preset');
        pricePresets.forEach(preset => {
            preset.addEventListener('click', function() {
                pricePresets.forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                const value = this.getAttribute('data-value');
                if (priceMax) {
                    priceMax.value = value;
                    updatePriceTrack();
                }
            });
        });

        // Star rating filter
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                stars.forEach((s, index) => {
                    if (index < rating) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
            });
        });

        // Category tags
        const categoryTags = document.querySelectorAll('.category-tag');
        categoryTags.forEach(tag => {
            tag.addEventListener('click', function() {
                this.classList.toggle('active');
            });
        });

        // Load product images (initial)
        const productImages = document.querySelectorAll('.product-image[data-bg]');
        productImages.forEach(imgContainer => {
            const bgUrl = imgContainer.getAttribute('data-bg');
            if (bgUrl) {
                const img = document.createElement('img');
                img.src = bgUrl;
                img.alt = 'Product image';
                img.onload = function() {
                    imgContainer.innerHTML = '';
                    imgContainer.appendChild(img);
                };
            }
        });

        // Ensure canonical selectors and ARIA (I5)
        document.querySelectorAll('.product-card').forEach(card => {
            if (!card.hasAttribute('role')) {
                card.setAttribute('role', 'article');
            }
        });
        const progressEl = document.querySelector('.analysis-progress');
        if (progressEl) {
            progressEl.setAttribute('role', 'status');
            progressEl.setAttribute('aria-live', 'polite');
        }

        // Initialize wishlist state from sessionStorage and wire up buttons (I3)
        function _applyWishlistStateToDOM() {
            const saved = _readWishlist();
            document.querySelectorAll('.product-card').forEach(card => {
                const pid = card.getAttribute('data-product-id');
                const btn = card.querySelector('.wishlist-btn');
                if (btn) {
                    if (pid && saved.includes(pid)) {
                        btn.classList.add('is-saved');
                        btn.setAttribute('aria-pressed', 'true');
                    } else {
                        btn.classList.remove('is-saved');
                        btn.setAttribute('aria-pressed', 'false');
                    }
                }
            });
        }
        _applyWishlistStateToDOM();

        // Product wishlist buttons
        const wishlistButtons = document.querySelectorAll('.wishlist-btn');
        wishlistButtons.forEach(btn => {
            const card = btn.closest('.product-card');
            if (card) {
                // product card wishlist
                const pid = card.getAttribute('data-product-id');
                if (!pid) {
                    // require product id for wishlist actions
                    btn.setAttribute('disabled', 'true');
                    btn.title = 'Missing product id';
                    return;
                }
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (!window.giftLens._integrityOk) {
                        showToast('Feature unavailable');
                        return;
                    }
                    const saved = _readWishlist();
                    if (saved.includes(pid)) {
                        const removed = removeFromWishlist(pid);
                        if (removed) {
                            showToast('Removed from wishlist');
                        }
                    } else {
                        const added = addToWishlist(pid);
                        if (added) {
                            showToast('Added to wishlist');
                            // flash animation preserved
                            const origBg = this.style.background;
                            const origColor = this.style.color;
                            const origBorder = this.style.borderColor;
                            this.style.background = '#f5a94b';
                            this.style.color = '#000000';
                            this.style.borderColor = '#f5a94b';
                            setTimeout(() => {
                                this.style.background = origBg || '';
                                this.style.color = origColor || '';
                                this.style.borderColor = origBorder || '';
                            }, 300);
                        }
                    }
                });
            } else {
                // header/global wishlist button behaviour (navigate)
                btn.addEventListener('click', function() {
                    window.location.href = 'wishlist.html';
                });
            }
        });

        // Compare buttons (keep existing behavior but refine selector)
        const compareButtons = document.querySelectorAll('.action-btn');
        compareButtons.forEach(btn => {
            if ((btn.textContent || '').includes('Compare')) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    alert('Product added to comparison list');
                });
            }
        });

        // Search functionality (canonical: search-input)
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const query = this.value.trim();
                    if (query) {
                        console.log('Searching for:', query);
                        // Implement search logic here
                    }
                }
            });
        }

        // Checkbox filters
        const checkboxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                console.log(`Filter ${this.id} ${this.checked ? 'enabled' : 'disabled'}`);
                // Implement filter logic here
            });
        });

        // Sort dropdown
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                const sortValue = this.value;
                console.log('Sorting by:', sortValue);
                // Implement sort logic here
            });
        }

        // Smooth scroll for skip link
        const skipLink = document.querySelector('.skip-link');
        if (skipLink) {
            skipLink.addEventListener('click', function(e) {
                e.preventDefault();
                const mainEl = document.getElementById('main');
                if (mainEl) {
                    mainEl.focus();
                    mainEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Lazy loading for images (basic implementation) - observe .product-image img
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const container = img.closest('.product-image');
                        const bgUrl = container ? container.getAttribute('data-bg') : null;
                        if (bgUrl && !img.src) {
                            img.src = bgUrl;
                        }
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('.product-image img').forEach(img => {
                imageObserver.observe(img);
            });
        }

        // Accessibility: Trap focus in mobile menu when open
        if (mobileMenuToggle && navMenu) {
            const focusableElements = navMenu.querySelectorAll('a, button');
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            navMenu.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstFocusable) {
                            lastFocusable.focus();
                            e.preventDefault();
                        }
                    } else {
                        if (document.activeElement === lastFocusable) {
                            firstFocusable.focus();
                            e.preventDefault();
                        }
                    }
                }

                if (e.key === 'Escape') {
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    navMenu.classList.remove('active');
                    mobileMenuToggle.focus();
                }
            });
        }

        // Performance: Debounce price slider updates
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        const debouncedPriceUpdate = debounce(function() {
            console.log('Price range updated');
            // Implement filter update logic here
        }, 300);

        if (priceMin && priceMax) {
            priceMin.addEventListener('input', debouncedPriceUpdate);
            priceMax.addEventListener('input', debouncedPriceUpdate);
        }

        // Nav links canonical handling and aria-current (I5)
        const navLinks = document.querySelectorAll('.nav-menu a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navLinks.forEach(l => l.removeAttribute('aria-current'));
                this.setAttribute('aria-current', 'page');
            });
            // Set aria-current based on presence of .active class initially
            if (link.classList.contains('active')) {
                link.setAttribute('aria-current', 'page');
            }
        });

        // Results grid validation (I4)
        const productCards = document.querySelectorAll('.results-grid .product-card');
        if (productCards && productCards.length) {
            productCards.forEach(pc => {
                if (!pc.getAttribute('data-product-id')) {
                    console.warn('product-card missing data-product-id', pc);
                }
            });
            if (productCards.length < 12 || productCards.length > 16) {
                console.warn(`results-grid has ${productCards.length} product-card elements (expected 12-16)`);
                showToast('Insufficient placeholder products for this layout');
            }
        }

        // Expose remaining API methods
        window.giftLens.addToWishlist = addToWishlist;
        window.giftLens.removeFromWishlist = removeFromWishlist;
        window.giftLens.getWishlist = getWishlist;
        window.giftLens.startAnalysis = startAnalysis;
        window.giftLens.exportCSV = exportCSV;
        window.giftLens.copyToClipboard = copyToClipboard;
        window.giftLens.showToast = showToast;

        // Emit a ready event
        document.dispatchEvent(new CustomEvent('giftlens:ready', { detail: { integrityOk: integrityOk } }));
    }; // end init

    // Call init immediately on DOMContentLoaded
    if (typeof window.giftLens.init === 'function') {
        window.giftLens.init();
    }
});
