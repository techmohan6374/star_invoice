new Vue({
    el: '#app',
    data() {
        const today = new Date().toISOString().split('T')[0];
        return {
            // Theme
            theme: 'light',
            // Company
            company: null,
            form: { name: '', phone: '', email: '', address: '', gst: '', currency: '₹' },
            eform: {},
            // Tabs
            tab: 'dashboard',
            // UI state
            globalLoading: false,
            loadingText: 'Loading...',
            formLoading: false,
            pdfLoading: false,
            // Toast
            toasts: [],
            // Inventory
            inventory: [],
            invSearch: '',
            pform: { name: '', sku: '', category: '', rate: 0, unit: 'Nos', qty: 0, lowAt: 5, gst: 0 },
            editingProduct: null,
            adjustingProduct: null,
            stockAdj: { type: 'add', qty: 0, reason: '' },
            modals: {
                product: false,
                stock: false,
                stockPicker: false,
                invPreview: false,
                editCompany: false,
                confirm: false,
            },
            confirmData: { title: '', msg: '', action: '', cb: () => { } },
            // Invoice builder
            invMode: 'dynamic',
            inv: { customer: '', customerPhone: '', customerAddress: '', date: today, notes: '', items: [] },
            invTemplate: 1,
            // Paper sizes
            paperSizes: [
                { id: 'a4', label: 'A4', w: 210, h: 297 },
                { id: 'a3', label: 'A3', w: 297, h: 420 },
                { id: 'a5', label: 'A5', w: 148, h: 210 },
                { id: 'letter', label: 'Letter', w: 216, h: 279 },
                { id: 'half', label: 'Half A4', w: 148, h: 210 },
            ],
            paperSize: 'a4',
            customW: 210,
            customH: 297,
            // Preview
            previewInv: { items: [], number: '', date: today, customer: '', customerPhone: '', customerAddress: '', notes: '', saved: false },
            // History
            invoices: [],
            invHistSearch: '',
            // Stock picker
            pickerSearch: '',
            pickerQtys: {},
            // Invoice counter
            invCounter: 1,
        };
    },
    computed: {
        // Inventory filters
        filteredInventory() {
            const q = this.invSearch.toLowerCase();
            return this.inventory.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q)
            );
        },
        lowStockItems() { return this.inventory.filter(p => p.qty <= (p.lowAt || 5) && p.qty >= 0); },
        lowStockCount() { return this.lowStockItems.length; },
        totalBilled() { return this.invoices.reduce((s, i) => s + i.total, 0); },
        recentInvoices() { return [...this.invoices].reverse().slice(0, 5); },
        filteredInvoiceHistory() {
            const q = this.invHistSearch.toLowerCase();
            return [...this.invoices].reverse().filter(i =>
                (i.customer || '').toLowerCase().includes(q) ||
                String(i.number).includes(q)
            );
        },
        // Invoice builder calcs
        invSubtotal() {
            return this.inv.items.reduce((s, item) => s + (item.qty || 0) * (item.rate || 0), 0);
        },
        invDiscount() {
            return this.inv.items.reduce((s, item) => {
                const base = (item.qty || 0) * (item.rate || 0);
                return s + base * (item.disc || 0) / 100;
            }, 0);
        },
        invGst() {
            return this.inv.items.reduce((s, item) => {
                const base = (item.qty || 0) * (item.rate || 0);
                const afterDisc = base - base * (item.disc || 0) / 100;
                return s + afterDisc * (item.gst || 0) / 100;
            }, 0);
        },
        invTotal() { return this.invSubtotal - this.invDiscount + this.invGst; },
        // Preview calcs
        previewSubtotal() {
            return this.previewInv.items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0);
        },
        previewDiscount() {
            return this.previewInv.items.reduce((s, i) => {
                const base = (i.qty || 0) * (i.rate || 0);
                return s + base * (i.disc || 0) / 100;
            }, 0);
        },
        previewGst() {
            return this.previewInv.items.reduce((s, i) => {
                const base = (i.qty || 0) * (i.rate || 0);
                const aD = base - base * (i.disc || 0) / 100;
                return s + aD * (i.gst || 0) / 100;
            }, 0);
        },
        previewTotal() { return this.previewSubtotal - this.previewDiscount + this.previewGst; },
        // Picker
        filteredPicker() {
            const q = this.pickerSearch.toLowerCase();
            return this.inventory.filter(p =>
                p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
            );
        },
    },
    methods: {
        // ── THEME ──
        toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; this.saveTheme(); },
        setTheme(t) { this.theme = t; this.saveTheme(); },
        saveTheme() { localStorage.setItem('ix_theme', this.theme); },

        // ── TOAST ──
        toast(msg, type = 'info', icon = 'ℹ️') {
            const id = Date.now();
            this.toasts.push({ id, msg, type, icon });
            setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 3000);
        },

        // ── COMPANY ──
        createCompany() {
            if (!this.form.name.trim()) return this.toast('Shop name is required', 'error', '❌');
            if (!this.form.phone.trim()) return this.toast('Phone is required', 'error', '❌');
            if (!this.form.address.trim()) return this.toast('Address is required', 'error', '❌');
            this.formLoading = true;
            setTimeout(() => {
                this.company = { ...this.form, createdAt: Date.now() };
                this.saveCompany();
                this.formLoading = false;
                this.toast('Company created! Welcome to Star Invoice 🎉', 'success', '★');
            }, 800);
        },
        saveCompany() { localStorage.setItem('ix_company', JSON.stringify(this.company)); },
        confirmDeleteCompany() {
            this.confirmData = {
                title: '⚠️ Delete Company',
                msg: 'This will permanently delete your company, all inventory, and all invoices. This action cannot be undone.',
                action: '🗑 Delete Everything',
                cb: this.deleteCompany
            };
            this.modals.confirm = true;
        },
        deleteCompany() {
            localStorage.removeItem('ix_company');
            localStorage.removeItem('ix_inventory');
            localStorage.removeItem('ix_invoices');
            localStorage.removeItem('ix_counter');
            this.company = null;
            this.inventory = [];
            this.invoices = [];
            this.invCounter = 1;
            this.form = { name: '', phone: '', email: '', address: '', gst: '', currency: '₹' };
            this.tab = 'dashboard';
            this.toast('Company deleted. You can create a new one.', 'info', '🗑');
        },
        openEditCompany() {
            this.eform = { ...this.company };
            this.modals.editCompany = true;
        },
        saveEditCompany() {
            if (!this.eform.name.trim()) return this.toast('Name required', 'error', '❌');
            this.company = { ...this.company, ...this.eform };
            this.saveCompany();
            this.modals.editCompany = false;
            this.toast('Company updated', 'success', '✅');
        },

        // ── PRODUCT ──
        openAddProduct() {
            this.editingProduct = null;
            this.pform = { name: '', sku: '', category: '', rate: 0, unit: 'Nos', qty: 0, lowAt: 5, gst: 0 };
            this.modals.product = true;
        },
        editProduct(p) {
            this.editingProduct = p;
            this.pform = { ...p };
            this.modals.product = true;
        },
        saveProduct() {
            if (!this.pform.name.trim()) return this.toast('Product name required', 'error', '❌');
            if (this.pform.rate < 0) return this.toast('Rate cannot be negative', 'error', '❌');
            this.formLoading = true;
            setTimeout(() => {
                if (this.editingProduct) {
                    const idx = this.inventory.findIndex(p => p.id === this.editingProduct.id);
                    if (idx > -1) this.inventory.splice(idx, 1, { ...this.editingProduct, ...this.pform });
                    this.toast('Product updated', 'success', '✅');
                } else {
                    this.inventory.push({ ...this.pform, id: Date.now() });
                    this.toast('Product added', 'success', '✅');
                }
                this.saveInventory();
                this.modals.product = false;
                this.formLoading = false;
            }, 400);
        },
        deleteProduct(p) {
            this.confirmData = {
                title: '🗑 Delete Product',
                msg: `Delete "${p.name}" from inventory?`,
                action: 'Delete',
                cb: () => {
                    this.inventory = this.inventory.filter(x => x.id !== p.id);
                    this.saveInventory();
                    this.toast('Product deleted', 'info', '🗑');
                }
            };
            this.modals.confirm = true;
        },
        saveInventory() { localStorage.setItem('ix_inventory', JSON.stringify(this.inventory)); },

        // Stock
        adjustStock(p) {
            this.adjustingProduct = p;
            this.stockAdj = { type: 'add', qty: 0, reason: '' };
            this.modals.stock = true;
        },
        saveStockAdjust() {
            const p = this.adjustingProduct;
            const idx = this.inventory.findIndex(x => x.id === p.id);
            if (idx < 0) return;
            const q = Number(this.stockAdj.qty) || 0;
            let newQty = p.qty;
            if (this.stockAdj.type === 'add') newQty += q;
            else if (this.stockAdj.type === 'remove') newQty = Math.max(0, newQty - q);
            else if (this.stockAdj.type === 'set') newQty = q;
            this.inventory[idx].qty = newQty;
            this.$set(this.inventory, idx, { ...this.inventory[idx], qty: newQty });
            this.saveInventory();
            this.modals.stock = false;
            this.toast(`Stock updated: ${p.name} → ${newQty}`, 'success', '📦');
        },

        // Stock helpers
        stockPct(p) {
            const max = Math.max(p.qty, (p.lowAt || 5) * 3, 10);
            return Math.min(100, (p.qty / max) * 100);
        },
        stockColor(p) {
            if (p.qty <= 0) return '#ef4444';
            if (p.qty <= (p.lowAt || 5)) return '#f59e0b';
            return '#10b981';
        },
        stockBadge(p) {
            if (p.qty <= 0) return 'badge-danger';
            if (p.qty <= (p.lowAt || 5)) return 'badge-warn';
            return 'badge-success';
        },
        stockLabel(p) {
            if (p.qty <= 0) return 'Out of Stock';
            if (p.qty <= (p.lowAt || 5)) return 'Low Stock';
            return 'In Stock';
        },

        // ── INVOICE BUILDER ──
        addInvItem() {
            this.inv.items.push({ _id: Date.now(), name: '', qty: 1, rate: 0, disc: 0, gst: 0 });
        },
        removeInvItem(i) { this.inv.items.splice(i, 1); },
        calcItemTotal(item) {
            const base = (item.qty || 0) * (item.rate || 0);
            const afterDisc = base - base * (item.disc || 0) / 100;
            return afterDisc + afterDisc * (item.gst || 0) / 100;
        },
        resetInvoice() {
            this.inv = { customer: '', customerPhone: '', customerAddress: '', date: new Date().toISOString().split('T')[0], notes: '', items: [] };
        },
        previewInvoice() {
            this.previewInv = {
                ...this.inv,
                number: String(this.invCounter).padStart(4, '0'),
                total: this.invTotal,
                saved: false,
            };
            this.modals.invPreview = true;
        },
        viewInvoice(inv) {
            this.previewInv = { ...inv, saved: true };
            this.modals.invPreview = true;
        },
        saveInvoice() {
            const invToSave = {
                ...this.previewInv,
                id: Date.now(),
                number: String(this.invCounter).padStart(4, '0'),
                total: this.previewTotal,
                saved: true,
                savedAt: Date.now(),
            };
            this.invoices.push(invToSave);
            this.invCounter++;
            // Deduct stock if stock mode
            if (this.invMode === 'stock') {
                invToSave.items.forEach(item => {
                    if (item._stockId) {
                        const idx = this.inventory.findIndex(p => p.id === item._stockId);
                        if (idx > -1) {
                            const newQty = Math.max(0, this.inventory[idx].qty - (item.qty || 0));
                            this.$set(this.inventory, idx, { ...this.inventory[idx], qty: newQty });
                        }
                    }
                });
                this.saveInventory();
            }
            localStorage.setItem('ix_invoices', JSON.stringify(this.invoices));
            localStorage.setItem('ix_counter', this.invCounter);
            this.previewInv.saved = true;
            this.toast('Invoice saved!', 'success', '💾');
            this.modals.invPreview = false;
            this.resetInvoice();
            this.tab = 'invoices';
        },
        deleteInvoice(inv) {
            this.confirmData = {
                title: '🗑 Delete Invoice',
                msg: `Delete invoice #${inv.number}? This cannot be undone.`,
                action: 'Delete',
                cb: () => {
                    this.invoices = this.invoices.filter(i => i.id !== inv.id);
                    localStorage.setItem('ix_invoices', JSON.stringify(this.invoices));
                    this.toast('Invoice deleted', 'info', '🗑');
                }
            };
            this.modals.confirm = true;
        },
        clearAllInvoices() {
            this.confirmData = {
                title: '🗑 Clear All Invoices',
                msg: 'Delete ALL invoice records permanently?',
                action: 'Clear All',
                cb: () => {
                    this.invoices = [];
                    this.invCounter = 1;
                    localStorage.setItem('ix_invoices', JSON.stringify([]));
                    localStorage.setItem('ix_counter', 1);
                    this.toast('All invoices cleared', 'info', '🗑');
                }
            };
            this.modals.confirm = true;
        },

        // ── PDF ──
        setPaperSize(id) { this.paperSize = id; },
        getCurrentPaperDims() {
            if (this.paperSize === 'custom') return { w: this.customW || 210, h: this.customH || 297 };
            const s = this.paperSizes.find(p => p.id === this.paperSize);
            return s ? { w: s.w, h: s.h } : { w: 210, h: 297 };
        },
        async saveAndDownload() {
            this.pdfLoading = true;
            await this.$nextTick();
            const el = document.getElementById('invoice-render');
            const dims = this.getCurrentPaperDims();
            const opt = {
                margin: 0,
                filename: `invoice-${this.previewInv.number || 'draft'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true },
                jsPDF: { unit: 'mm', format: [dims.w, dims.h], orientation: dims.w > dims.h ? 'landscape' : 'portrait' }
            };
            try {
                await html2pdf().set(opt).from(el).save();
                this.toast('PDF downloaded!', 'success', '📄');
            } catch (e) {
                this.toast('PDF generation failed', 'error', '❌');
                console.error(e);
            }
            this.pdfLoading = false;
        },

        // ── STOCK PICKER ──
        openStockPicker() {
            this.pickerSearch = '';
            this.pickerQtys = {};
            this.inventory.forEach(p => { this.$set(this.pickerQtys, p.id, 1); });
            this.modals.stockPicker = true;
        },
        incPickerQty(p) {
            const cur = this.pickerQtys[p.id] || 1;
            if (cur < p.qty) this.$set(this.pickerQtys, p.id, cur + 1);
        },
        decPickerQty(p) {
            const cur = this.pickerQtys[p.id] || 1;
            if (cur > 0) this.$set(this.pickerQtys, p.id, cur - 1);
        },
        addFromPicker(p) {
            const qty = this.pickerQtys[p.id] || 1;
            if (qty < 1) return;
            if (qty > p.qty) return this.toast(`Only ${p.qty} in stock`, 'error', '⚠️');
            const existing = this.inv.items.find(i => i._stockId === p.id);
            if (existing) {
                existing.qty += qty;
            } else {
                this.inv.items.push({ _id: Date.now(), _stockId: p.id, name: p.name, qty, rate: p.rate, disc: 0, gst: p.gst || 0 });
            }
            this.toast(`${p.name} (×${qty}) added to invoice`, 'success', '✅');
        },

        // ── UTILS ──
        formatDate(d) {
            if (!d) return '';
            try {
                const dt = new Date(d);
                return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch { return d; }
        },

        // ── LOAD FROM STORAGE ──
        loadAll() {
            // Theme
            const t = localStorage.getItem('ix_theme');
            if (t) this.theme = t;
            // Company
            const c = localStorage.getItem('ix_company');
            if (c) this.company = JSON.parse(c);
            // Inventory
            const inv = localStorage.getItem('ix_inventory');
            if (inv) this.inventory = JSON.parse(inv);
            // Invoices
            const invs = localStorage.getItem('ix_invoices');
            if (invs) this.invoices = JSON.parse(invs);
            // Counter
            const cnt = localStorage.getItem('ix_counter');
            if (cnt) this.invCounter = Number(cnt);
        }
    },
    created() {
        this.loadAll();
    }
});
