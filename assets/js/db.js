// db.js — IndexedDB helpers (MIT).
// Note: placeholder Dexie js is vendored, but we use a custom minimal wrapper for simplicity/perf.

const DB_NAME = 'inventory-pwa';
const DB_VERSION = 3;

const DB = (() => {
  let db;
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (ev.oldVersion < 1) {
          const products = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          products.createIndex('code', 'code', { unique: true });
          products.createIndex('title', 'title');
          products.createIndex('category', 'category');
          products.createIndex('createdAt', 'createdAt');
          const sales = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          sales.createIndex('code', 'code');
          sales.createIndex('soldAt', 'soldAt');
        }
        if (ev.oldVersion < 2) {
          // v2: tags[] and photoBlob (no index). Defaults handled at read/write time.
        }
        if (ev.oldVersion < 3) {
          const expenses = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenses.createIndex('createdAt', 'createdAt');
          expenses.createIndex('category', 'category');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function getDb() { return db || (db = await openDb()); }
  function tx(store, mode='readonly') { return getDb().then(d => d.transaction(store, mode).objectStore(store)); }

  // products
  async function upsertProduct(p) {
    const now = (new Date()).toISOString();
    if (!p.createdAt) p.createdAt = now;
    p.updatedAt = now;
    const store = await tx('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = p.id ? store.put(p) : store.add(p);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function getProductByCode(code) {
    const store = await tx('products');
    return new Promise((resolve, reject) => {
      const idx = store.index('code').get(code);
      idx.onsuccess = () => resolve(idx.result || null);
      idx.onerror = () => reject(idx.error);
    });
  }
  async function listProducts({search='', status='available', category='', tag=''} = {}) {
    const store = await tx('products');
    const saleCodes = new Set((await listSales()).map(s => s.code));
    return new Promise((resolve, reject) => {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const p = cur.value;
          const text = (p.title||'') + ' ' + (p.code||'');
          const match = !search || text.toLowerCase().includes(search.toLowerCase());
          const catOk = !category || (p.category||'') === category;
          const tags = Array.isArray(p.tags) ? p.tags : [];
          const tagOk = !tag || tags.includes(tag);
          const sold = saleCodes.has(p.code);
          const statusOk = status==='all' || (status==='sold' ? sold : !sold);
          if (match && catOk && tagOk && statusOk) out.push(p);
          cur.continue();
        } else resolve(out.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')));
      };
      req.onerror = () => reject(req.error);
    });
  }
  async function deleteAll() {
    const d = await getDb();
    await Promise.all(['products','sales','expenses'].map(name => new Promise((res, rej) => {
      const r = d.transaction(name, 'readwrite').objectStore(name).clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    })));
  }

  // sales
  async function recordSale({code, sellingPrice}) {
    const product = await getProductByCode(code);
    if (!product) throw new Error('Product not found');
    const purchase = Number(product.purchasePrice||0);
    const ship = Number(product.shippingCost||0);
    const profit = Number(sellingPrice) - purchase - ship;
    const sale = { code, sellingPrice: Number(sellingPrice), profit: Math.round(profit*100)/100, soldAt: (new Date()).toISOString() };
    const store = await tx('sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(sale);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function listSales(range=null) {
    const store = await tx('sales');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const s = cur.value;
          if (!range || (s.soldAt >= range.start && s.soldAt <= range.end)) out.push(s);
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  }
  async function undoSale(id) {
    const store = await tx('sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // expenses
  async function addExpense({title, amount, category='', note=''}) {
    const store = await tx('expenses', 'readwrite');
    const exp = { title, amount: Number(amount)||0, category, note, createdAt:(new Date()).toISOString() };
    return new Promise((resolve, reject) => {
      const req = store.add(exp); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async function listExpenses(range=null, {category=''}={}) {
    const store = await tx('expenses');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const e = cur.value;
          const inRange = !range || (e.createdAt >= range.start && e.createdAt <= range.end);
          if (inRange && (!category || e.category===category)) out.push(e);
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // export/import helpers
  async function exportAllJson() {
    const products = await listProducts({status:'all'});
    const sales = await listSales();
    const expenses = await listExpenses();
    return { products, sales, expenses, exportedAt: (new Date()).toISOString(), db: DB_NAME, version: DB_VERSION };
  }
  async function exportCsv() {
    const products = await listProducts({status:'all'});
    const sales = await listSales();
    const expenses = await listExpenses();
    const esc = v => '"' + String(v).replaceAll('"','""') + '"';
    const prodHeaders = ['code','title','category','size','color','purchasePrice','shippingCost','listPrice','notes','tags','createdAt','updatedAt'];
    const saleHeaders = ['code','sellingPrice','profit','soldAt'];
    const expHeaders = ['title','amount','category','note','createdAt'];
    const prodCsv = ['# PRODUCTS', prodHeaders.join(','),
      ...products.map(p => prodHeaders.map(h => h==='tags' ? esc((p.tags||[]).join('|')) : esc(p[h]??'')).join(','))
    ].join('\n');
    const saleCsv = ['# SALES', saleHeaders.join(','),
      ...sales.map(s => saleHeaders.map(h => esc(s[h]??'')).join(','))
    ].join('\n');
    const expCsv = ['# EXPENSES', expHeaders.join(','),
      ...expenses.map(e => expHeaders.map(h => esc(e[h]??'')).join(','))
    ].join('\n');
    return prodCsv + '\n\n' + saleCsv + '\n\n' + expCsv + '\n';
  }
  async function importJson(obj) {
    if (!obj || !Array.isArray(obj.products) || !Array.isArray(obj.sales)) throw new Error('Invalid JSON');
    await deleteAll();
    const now = (new Date()).toISOString();
    const dbi = await getDb();
    await new Promise((resolve, reject) => {
      const tx = dbi.transaction(['products','sales','expenses'],'readwrite');
      const ps = tx.objectStore('products');
      obj.products.forEach(p => { p.createdAt ||= now; p.updatedAt ||= now; try { ps.add(p); } catch {} });
      const ss = tx.objectStore('sales'); obj.sales.forEach(s => ss.add(s));
      if (Array.isArray(obj.expenses)) {
        const es = tx.objectStore('expenses'); obj.expenses.forEach(e => es.add(e));
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  }
  async function importCsv(text) {
    const lines = text.split(/\r?\n/);
    const markers = lines.map(l => l.trim().toUpperCase());
    const idxProd = markers.findIndex(l => l.startsWith('# PRODUCTS'));
    const idxSales = markers.findIndex(l => l.startsWith('# SALES'));
    const idxExp = markers.findIndex(l => l.startsWith('# EXPENSES'));
    const hasAnyMarker = [idxProd, idxSales, idxExp].some(i => i !== -1);
    const parse = (startIdx, endIdx) => {
      const headers = lines[startIdx+1].split(',').map(h=>h.trim());
      const rows = [];
      for (let i=startIdx+2;i<endIdx;i++) {
        const raw = lines[i]; if (!raw) continue;
        const cols = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.replace(/^"|"$/g,'').replaceAll('""','"'));
        const obj = {}; headers.forEach((h,j)=> obj[h] = cols[j] ?? '');
        rows.push(obj);
      }
      return {headers, rows};
    };
    const now = new Date().toISOString();
    if (hasAnyMarker) {
      const prodEnd = (idxSales!==-1 ? idxSales : (idxExp!==-1 ? idxExp : lines.length)) - 1;
      const salesEnd = (idxExp!==-1 ? idxExp : lines.length) - 1;
      // import products
      if (idxProd!==-1) {
        const {headers, rows} = parse(idxProd, prodEnd);
        for (const r of rows) {
          const p = { code:r.code || crypto.randomUUID(), title:r.title||'(Untitled)', category:r.category||'', size:r.size||'', color:r.color||'',
            purchasePrice:+r.purchasePrice||0, shippingCost:+r.shippingCost||0, listPrice:+r.listPrice||0, notes:r.notes||'',
            tags:r.tags? r.tags.split('|'):[], createdAt:r.createdAt||now, updatedAt:r.updatedAt||now };
          await upsertProduct(p);
        }
      }
      if (idxSales!==-1) {
        const {headers, rows} = parse(idxSales, salesEnd);
        const dbi = await getDb(); const store = dbi.transaction('sales','readwrite').objectStore('sales');
        await new Promise((resolve, reject)=>{
          rows.forEach(r => store.add({code:r.code, sellingPrice:+r.sellingPrice||0, profit:+r.profit||0, soldAt:r.soldAt||now}));
          store.transaction.oncomplete = ()=>resolve(); store.transaction.onerror = ()=>reject(store.transaction.error);
        });
      }
      if (idxExp!==-1) {
        const {headers, rows} = parse(idxExp, lines.length);
        for (const r of rows) await addExpense({title:r.title||'(Untitled)', amount:+r.amount||0, category:r.category||'', note:r.note||''});
      }
    } else {
      // Simple product CSV (no markers). Expect at least 'title' header.
      const headers = lines[0].split(',').map(h=>h.trim());
      const idxTitle = headers.indexOf('title');
      if (idxTitle === -1) throw new Error('CSV must include a title column');
      for (let i=1;i<lines.length;i++) {
        const raw = lines[i]; if (!raw) continue;
        const cols = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.replace(/^"|"$/g,'').replaceAll('""','"'));
        const rec = {}; headers.forEach((h,j)=> rec[h]=cols[j]??'');
        const p = { code: rec.code || crypto.randomUUID(), title: rec.title, category: rec.category||'', size:rec.size||'', color: rec.color||'',
          purchasePrice:+rec.purchasePrice||0, shippingCost:+rec.shippingCost||0, listPrice:+rec.listPrice||0, notes:rec.notes||'',
          tags: rec.tags? rec.tags.split('|'):[], createdAt: now, updatedAt: now };
        await upsertProduct(p);
      }
    }
  }

  return { upsertProduct, getProductByCode, listProducts, recordSale, listSales, undoSale, exportAllJson, exportCsv, importJson, importCsv, deleteAll, addExpense, listExpenses };
})();
