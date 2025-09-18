// app.js — Bootstrap, routing, toasts, settings, install prompt, UUID, currency.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

const App = (() => {
  const q = sel => document.querySelector(sel);
  const qa = sel => Array.from(document.querySelectorAll(sel));
  const toastEl = q('#toast');

  function toast(msg, ms=2200) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Settings
  const defaults = { brand:'Umme’s Fashion', currency:'$', labelCodeType:'qr', note:'' };
  function loadSettings() { try { return {...defaults, ...JSON.parse(localStorage.getItem('settings')||'{}')}; } catch { return {...defaults}; } }
  function saveSettings(s) { localStorage.setItem('settings', JSON.stringify(s)); }
  function fmtCurrency(n) { const s = (loadSettings().currency || '$'); return s + (Number(n||0).toFixed(2)); }

  function switchTab(id) {
    qa('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab===id));
    qa('.panel').forEach(p => p.classList.toggle('active', p.id===('panel-'+id)));
    if (id === 'inventory') Inventory.render();
    if (id === 'reports') Reports.render();
    if (id === 'scan') Scanner.start();
    if (id !== 'scan') Scanner.stop();
    if (id === 'dashboard') renderDashboard();
    if (id === 'expenses') renderExpenses();
  }

  // Install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; q('#installState').textContent='Installable'; });
  q('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) { toast('Already installed or not installable yet'); return; }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    q('#installState').textContent = (choice.outcome === 'accepted') ? 'Installed' : 'Install dismissed';
    deferredPrompt = null;
  });

  // Tabs
  qa('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  qa('[data-nav]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.nav)));

  // Settings bind
  function bindSettings() {
    const s = loadSettings();
    q('#brandInput').value = s.brand; q('#brandTitle').textContent = s.brand;
    q('#currencyInput').value = s.currency;
    q('#labelCodeType').value = s.labelCodeType;
    q('#noteInput').value = s.note || '';
    qa('#panel-settings input, #panel-settings select').forEach(el => el.addEventListener('change', () => {
      const ns = {
        brand: q('#brandInput').value.trim() || 'Umme’s Fashion',
        currency: q('#currencyInput').value.trim() || '$',
        labelCodeType: q('#labelCodeType').value,
        note: q('#noteInput').value.trim()
      };
      saveSettings(ns); q('#brandTitle').textContent = ns.brand; toast('Settings saved');
    }));
    q('#exportJsonBtn').onclick = async () => {
      const blob = new Blob([JSON.stringify(await DB.exportAllJson(), null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob); download(url, 'inventory-export.json');
    };
    q('#exportCsvBtn').onclick = async () => {
      const blob = new Blob([await DB.exportCsv()], {type:'text/csv'});
      const url = URL.createObjectURL(blob); download(url, 'inventory-export.csv');
    };
    q('#importJson').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { await DB.importJson(JSON.parse(await file.text())); toast('Imported JSON'); Inventory.render(); Reports.render(); }
      catch (err) { toast('Import failed: '+err.message); }
      e.target.value='';
    });
    q('#importCsv').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { await DB.importCsv(await file.text()); toast('Imported CSV'); Inventory.render(); Reports.render(); }
      catch (err) { toast('Import failed: '+err.message); }
      e.target.value='';
    });
    q('#seedBtn').onclick = async () => {
      if (!confirm('Load 10 sample products?')) return;
      const csv = await fetch('sample-data/sample.csv').then(r=>r.text());
      await DB.importCsv(csv); toast('Sample data loaded'); Inventory.render();
    };
    q('#runTestsBtn').onclick = () => Tests.run();
    q('#clearDbBtn').onclick = async () => {
      if (!confirm('Erase ALL data?')) return;
      if (!confirm('Really erase ALL data?')) return;
      await DB.deleteAll(); toast('Database cleared'); Inventory.render(); Reports.render();
    };
    q('#versionInfo').textContent = 'Version 1.1.0 — ' + new Date().toISOString();
  }

  // Add form
  function bindAddForm() {
    const codeEl = q('#code'); const form = q('#addForm'); const photoEl = q('#photo');
    function resetCode() { codeEl.value = uuidv4(); Labels.drawPreview(codeEl.value); }
    resetCode();
    q('#resetAddForm').onclick = () => { form.reset(); resetCode(); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const tags = (data.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
      let photoBlob = null;
      if (photoEl.files && photoEl.files[0]) photoBlob = await compressImage(photoEl.files[0], 1024, 1024, 0.8);
      const p = {
        code: data.code, title: data.title, category: data.category, size: data.size, color: data.color,
        purchasePrice: +data.purchasePrice || 0, shippingCost: +data.shippingCost || 0, listPrice: +data.listPrice || 0,
        notes: data.notes||'', tags, photoBlob
      };
      try { await DB.upsertProduct(p); toast('Saved'); form.reset(); resetCode(); Inventory.render(); }
      catch (err) { toast('Save failed: '+err.message); }
    });
    q('#addImportCsv').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await DB.importCsv(await f.text()); toast('Imported products from CSV'); Inventory.render(); }
      catch (err) { toast('CSV import failed: '+err.message); }
      e.target.value='';
    });
  }

  function download(url, filename) { const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 500); }

  // Image compression
  function compressImage(file, maxW, maxH, quality=0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w=img.width, h=img.height; const ratio=Math.min(maxW/w, maxH/h, 1);
        const cw=Math.round(w*ratio), ch=Math.round(h*ratio);
        const c=document.createElement('canvas'); c.width=cw; c.height=ch;
        const cx=c.getContext('2d'); cx.drawImage(img,0,0,cw,ch);
        c.toBlob(b=>resolve(b),'image/jpeg',quality);
      };
      img.onerror = reject; img.src = URL.createObjectURL(file);
    });
  }

  // Inventory view
  const Inventory = {
    async render() {
      const search = q('#invSearch').value.trim();
      const status = q('#invStatus').value;
      const category = q('#invCategory').value;
      const tag = q('#invTag').value.trim();
      const items = await DB.listProducts({search, status, category, tag});
      const all = await DB.listProducts({status:'all'});
      const cats = Array.from(new Set(all.map(p => p.category).filter(Boolean))).sort();
      const catSel = q('#invCategory'); catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c=>`<option ${c===category?'selected':''}>${c}</option>`).join('');
      const list = q('#inventoryList'); list.innerHTML = '';
      items.forEach(p => {
        const card = document.createElement('div'); card.className='card';
        const img = document.createElement('img'); img.className='thumb'; if (p.photoBlob) img.src = URL.createObjectURL(p.photoBlob);
        const meta = document.createElement('div');
        const title = document.createElement('div'); title.innerHTML = `<strong>${p.title||'(No title)'}</strong>`;
        const info = document.createElement('div'); info.className='meta'; info.textContent = `${p.code} • ${p.size||''} ${p.color||''}`.trim();
        const costs = document.createElement('div'); costs.className='meta'; costs.textContent = `Buy ${fmtCurrency(p.purchasePrice)} + Ship ${fmtCurrency(p.shippingCost)} • List ${fmtCurrency(p.listPrice||0)}`;
        const chk = document.createElement('input'); chk.type='checkbox'; chk.className='bulk'; chk.dataset.code = p.code;
        meta.append(title, info, costs, chk); card.append(img, meta); list.append(card);
      });
    }
  };

  // Dashboard KPIs
  async function renderDashboard() {
    const sales = await DB.listSales();
    const gross = sales.reduce((a,s)=>a+parseFloat(s.sellingPrice||0),0);
    const profit = sales.reduce((a,s)=>a+parseFloat(s.profit||0),0);
    const k = q('#dashboardKpis');
    k.innerHTML = [
      ['Items Sold', sales.length],
      ['Gross Revenue', fmtCurrency(gross)],
      ['Total Profit', fmtCurrency(profit)]
    ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
  }

  // Inventory filters
  ['#invSearch','#invStatus','#invCategory','#invTag'].forEach(sel => {
    document.addEventListener('input', (e) => { if (e.target.matches(sel)) Inventory.render(); }, true);
  });
  
  // Select All in inventory
  const selectAllBtn = q('#selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.onclick = async () => {
      const checks = Array.from(document.querySelectorAll('.bulk'));
      const allChecked = checks.every(c => c.checked);
      checks.forEach(c => c.checked = !allChecked);
      App.toast(!allChecked ? 'Selected all' : 'Deselected all');
    };
  }

  // Bulk Print fallback: if none selected, use ALL products
  q('#bulkPrintBtn').onclick = async () => {
    let codes = Array.from(document.querySelectorAll('.bulk:checked')).map(i=>i.dataset.code);
    if (!codes.length) {
      const all = await DB.listProducts({status:'all'});
      codes = all.map(p => p.code);
    }
    if (!codes.length) { toast('No items to print'); return; }
    localStorage.setItem('bulkPrintCodes', JSON.stringify(codes));
    window.open('print/label-templates.html', '_blank');
  };

  // Inventory camera scan one-shot
  
  // Expenses page
  async function renderExpenses(){
    const list = q('#expenseList');
    const exps = (await DB.listExpenses()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    list.innerHTML='';
    exps.forEach(e => {
      const card = document.createElement('div'); card.className='card';
      const meta = document.createElement('div');
      meta.innerHTML = `<strong>${e.title}</strong><div class="meta">${new Date(e.createdAt).toLocaleString()} • ${e.category||'Uncategorized'}</div><div class="meta">Amount ${fmtCurrency(e.amount)}</div><div class="meta">${e.note||''}</div>`;
      card.append(meta); list.append(card);
    });
  }
  (function bindExpenses(){
    const form = q('#expenseForm');
    if (!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const title = q('#expTitle').value.trim();
      const amt = +q('#expAmount').value || 0;
      const cat = q('#expCategory').value.trim();
      const note = q('#expNote').value.trim();
      if (!title || !(amt>0)) { toast('Enter title and amount'); return; }
      await DB.addExpense({title, amount:amt, category:cat, note});
      toast('Expense added'); form.reset(); renderExpenses();
    });
    q('#exportExpensesCsvBtn').onclick = async () => {
      const exps = await DB.listExpenses();
      const headers = ['title','amount','category','note','createdAt'];
      const rows = exps.map(e => headers.map(h => '"'+(e[h]??'').toString().replaceAll('"','""')+'"').join(','));
      const csv = headers.join(',')+'\n'+rows.join('\n');
      const url = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); download(url, 'expenses.csv');
    };
    q('#printExpensesBtn').onclick = () => window.print();
  })();

  return { toast, uuidv4, loadSettings, saveSettings, fmtCurrency, switchTab, Inventory, renderDashboard };
})();

// Init
window.addEventListener('DOMContentLoaded', () => {
  App.switchTab('dashboard');
  App.renderDashboard?.();
});
window.addEventListener('load', () => {
  // Settings + Add binds
  (function(){ const s = App.loadSettings(); document.getElementById('brandInput').value=s.brand; document.getElementById('brandTitle').textContent=s.brand; document.getElementById('currencyInput').value=s.currency; document.getElementById('labelCodeType').value=s.labelCodeType; document.getElementById('noteInput').value=s.note||''; })();
  document.querySelectorAll('#panel-settings input, #panel-settings select').forEach(el => el.addEventListener('change', () => {
    const ns = { brand: document.getElementById('brandInput').value.trim() || 'Umme’s Fashion', currency: document.getElementById('currencyInput').value.trim() || '$', labelCodeType: document.getElementById('labelCodeType').value, note: document.getElementById('noteInput').value.trim() };
    App.saveSettings(ns); document.getElementById('brandTitle').textContent = ns.brand; App.toast('Settings saved');
  }));
  document.getElementById('exportJsonBtn').onclick = async () => { const blob = new Blob([JSON.stringify(await DB.exportAllJson(), null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='inventory-export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); };
  document.getElementById('exportCsvBtn').onclick = async () => { const blob = new Blob([await DB.exportCsv()], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='inventory-export.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); };
  document.getElementById('importJson').addEventListener('change', async (e) => { const f=e.target.files[0]; if(!f) return; try{ await DB.importJson(JSON.parse(await f.text())); App.toast('Imported JSON'); App.Inventory.render(); Reports.render(); }catch(err){ App.toast('Import failed: '+err.message);} e.target.value=''; });
  document.getElementById('importCsv').addEventListener('change', async (e) => { const f=e.target.files[0]; if(!f) return; try{ await DB.importCsv(await f.text()); App.toast('Imported CSV'); App.Inventory.render(); Reports.render(); }catch(err){ App.toast('Import failed: '+err.message);} e.target.value=''; });
  document.getElementById('seedBtn').onclick = async () => { if(!confirm('Load 10 sample products?')) return; const csv = await fetch('sample-data/sample.csv').then(r=>r.text()); await DB.importCsv(csv); App.toast('Sample data loaded'); App.Inventory.render(); };
  document.getElementById('runTestsBtn').onclick = () => Tests.run();
  document.getElementById('clearDbBtn').onclick = async () => { if(!confirm('Erase ALL data?')) return; if(!confirm('Really erase ALL data?')) return; await DB.deleteAll(); App.toast('Database cleared'); App.Inventory.render(); Reports.render(); };

  // Add form
  (function bindAddForm(){
    const codeEl = document.getElementById('code'); const form = document.getElementById('addForm'); const photoEl = document.getElementById('photo');
    function resetCode(){ codeEl.value = App.uuidv4(); Labels.drawPreview(codeEl.value); } resetCode();
    document.getElementById('resetAddForm').onclick = () => { form.reset(); resetCode(); };
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const tags = (data.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
      let photoBlob = null;
      if (photoEl.files && photoEl.files[0]) {
        photoBlob = await (async function compressImage(file, maxW, maxH, quality=0.8){
          return new Promise((resolve,reject)=>{
            const img = new Image();
            img.onload = ()=>{ let w=img.width, h=img.height; const ratio=Math.min(maxW/w, maxH/h, 1);
              const cw=Math.round(w*ratio), ch=Math.round(h*ratio);
              const c=document.createElement('canvas'); c.width=cw; c.height=ch;
              const cx=c.getContext('2d'); cx.drawImage(img,0,0,cw,ch);
              c.toBlob(b=>resolve(b),'image/jpeg',quality);
            };
            img.onerror=reject; img.src=URL.createObjectURL(file);
          });
        })(photoEl.files[0],1024,1024,0.8);
      }
      const p = { code:data.code, title:data.title, category:data.category, size:data.size, color:data.color,
        purchasePrice:+data.purchasePrice||0, shippingCost:+data.shippingCost||0, listPrice:+data.listPrice||0, notes:data.notes||'', tags, photoBlob };
      try{ await DB.upsertProduct(p); App.toast('Saved'); form.reset(); resetCode(); App.Inventory.render(); } catch(err){ App.toast('Save failed: '+err.message); }
    });
    document.getElementById('addImportCsv').addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return;
      try{ await DB.importCsv(await f.text()); App.toast('Imported products from CSV'); App.Inventory.render(); } catch(err){ App.toast('CSV import failed: '+err.message); }
      e.target.value='';
    });
  })();

  // Inventory initial
  App.Inventory.render();
});


// --- v1.2.0 enhancements ---
// Force update button: clears caches + unregisters SW, then reloads
(function(){ 
  const btn = document.getElementById('forceUpdateBtn'); if (!btn) return;
  btn.onclick = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { console.warn(e); }
    location.reload(true);
  };
})();

// Listen for SW activation and prompt
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SW_ACTIVATED') { App.toast('Updated to v' + e.data.version + ' — reloaded cache'); }
  });
}



// --- v1.2.1 fix: robust close for Inventory scanner modal
(function(){ 
  const modal = document.getElementById('invScanModal');
  const video = document.getElementById('invScanVideo');
  const closeBtn = document.getElementById('invScanClose');
  let _streamRef = null;

  // Hook into existing start function by wrapping getUserMedia to capture stream
  const _gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    const s = await _gum(constraints);
    _streamRef = s;
    return s;
  };

  function hideModal() {
    try {
      if (_streamRef) {
        _streamRef.getTracks().forEach(t=>t.stop());
        _streamRef = null;
      }
    } catch {};
    if (video) { try { video.pause(); video.srcObject = null; } catch {} }
    if (modal) modal.classList.add('hide');
  }

  if (closeBtn) closeBtn.onclick = hideModal;
  if (modal) modal.addEventListener('click', (e)=>{ if (e.target === modal) hideModal(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && modal && !modal.classList.contains('hide')) hideModal(); });

  // Also ensure leaving Inventory tab closes it
  const oldSwitch = App.switchTab;
  App.switchTab = function(id){ if (id !== 'inventory') hideModal(); return oldSwitch(id); };
})();


// --- v1.2.2 Inventory camera: dynamic modal only when clicking the camera icon
(function(){
  const btn = document.getElementById('invScanBtn');
  if (!btn) return;
  let stream = null, detector = null, modal = null, video = null;

  function createModal(){
    modal = document.createElement('div');
    modal.className = 'modal'; // hidden by not attached yet
    modal.innerHTML = '<div class="modal-content"><video id="invScanVideo" playsinline muted class="scan-video"></video><div class="row" style="margin-top:8px;"><button id="invScanClose" class="btn">Close</button></div></div>';
    document.body.appendChild(modal);
    video = modal.querySelector('video');
    modal.addEventListener('click', (e)=>{ if (e.target === modal) stop(); });
    modal.querySelector('#invScanClose').onclick = stop;
    document.addEventListener('keydown', escClose);
  }
  function escClose(e){ if (e.key==='Escape' && modal) stop(); }
  async function start(){
    if (!('BarcodeDetector' in window)) { App.toast('Scanner not supported on this browser'); return; }
    if (!modal) createModal();
    modal.style.display = 'flex';
    detector = new BarcodeDetector({formats:['qr_code','code_128','ean_13','ean_8','upc_a','itf']});
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    video.srcObject = stream; await video.play();
    requestAnimationFrame(loop);
  }
  async function loop(){
    if (!modal) return;
    try { const out = await detector.detect(video); if (out && out.length) { const code = out[0].rawValue; onCode(code); return; } } catch { }
    if (modal) requestAnimationFrame(loop);
  }
  async function onCode(code){
    stop();
    const search = document.getElementById('invSearch'); const statusSel = document.getElementById('invStatus');
    statusSel.value = 'all'; search.value = code; await App.Inventory.render(); App.toast('Found: '+code);
  }
  function stop(){
    try { if (stream) stream.getTracks().forEach(t=>t.stop()); } catch {} stream=null;
    try { if (video) { video.pause(); video.srcObject=null; } } catch {};
    if (modal) { modal.style.display = 'none'; document.removeEventListener('keydown', escClose); }
  }
  btn.addEventListener('click', start);
  // Also close if user leaves Inventory tab
  const oldSwitch = App.switchTab;
  App.switchTab = function(id){ if (id!=='inventory') stop(); return oldSwitch(id); };
})();

