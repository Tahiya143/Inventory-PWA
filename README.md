# Inventory PWA (Offline, Privacy-First) — v1.1

**Quick Start:** Serve the folder over HTTPS (or `http://localhost`) — e.g., VS Code **Live Server**. Open on your phone, **Settings → Install App**, add a product (or **Upload from CSV** in Add), print labels (Inventory → Bulk Print → opens `/print/label-templates.html`), then **Scan & Sell**. Search in Inventory using the new **camera button**. Track **Expenses** and view **Reports** (Sales / Expenses / P&L / By Category). Export/import JSON/CSV any time.

## Notes
- Only **Title** is required when adding a product; others optional. Code auto-generates.
- CSV import supports: (a) simple product CSV with headers like `title,category,size,color,purchasePrice,shippingCost,listPrice,notes,tags[,code]`; or (b) the multi-section format used by `sample-data/sample.csv` with `# PRODUCTS`, `# SALES`, and optional `# EXPENSES`.
- Inventory default filter is **All** — you’ll see every product you add. Use Category/Tag to narrow.
- The camera scanning uses the native **BarcodeDetector** (QR + popular 1D). Torch & camera switch are shown when supported.
- Label images (QR/Barcode) can be enabled by dropping **qrcode** or **JsBarcode** into `/assets/lib` (placeholders included).
- App shell is cached for offline use; to fully reset, use **Clear / Reset Database** and clear site storage.

**Licenses:** App code MIT. Placeholders for: html5-qrcode (MIT), Dexie (Apache-2.0), JsBarcode (MIT), qrcode (MIT).


## Update 1.2.0
- **Colorful UI** fully applied (animated gradient header, colorful KPIs).
- **Expenses** tab visible with **Add Expense** button.
- Inventory search now has a **camera icon** to scan and jump.
- **Cache-busting & Force Update**: versioned assets + a **Force Update** button in the header to clear old service worker caches if you still see the old UI.
- After **Save** or **CSV import**, app auto-switches to **Inventory → All** so new items are visible immediately.


## Update 1.2.2
- Inventory camera **only appears after tapping the camera icon** and closes cleanly with **Close**, **outside tap**, **Esc**, or when leaving the tab.
- Reports → **Expenses** now shows a **detailed table** of all expenses in the selected range, plus daily charts.
- KPI robustness: Gross/Profit calculations hardened to avoid blank values; dashboard/report numbers now always appear when sales exist.


## Update 1.2.3
- Reports → **Expenses** totals and details fixed; robust date filtering.
- **Add Product** no longer auto-navigates; you stay on the Add tab after saving/importing.
- **Bulk Print** shows labels even if nothing is selected (prints **all** products). Added **Select All** button.


## Git / GitHub Pages (ready to push)
1. `git init && git add . && git commit -m "Initial commit"`  
2. `git branch -M main && git remote add origin <your-repo-url> && git push -u origin main`  
3. In GitHub **Settings → Pages**, choose **GitHub Actions**. The included `.github/workflows/pages.yml` auto-deploys your site.  
   - If you prefer the classic Pages setup, you can also choose **Deploy from a branch** → `main` → `/ (root)`; the included `.nojekyll` avoids Jekyll issues.
