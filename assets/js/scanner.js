// scanner.js — Live Scan & Sell using BarcodeDetector (QR + some 1D). Torch/camera switch when supported.
const Scanner = (() => {
  let stream = null;
  let currentDeviceId = null;
  let detector = null;
  let scanning = false;
  let undoTimer = null;
  let lastSaleId = null;

  const video = document.getElementById('scanVideo');
  const statusEl = document.getElementById('scanStatus');
  const torchBtn = document.getElementById('torchBtn');
  const camBtn = document.getElementById('cameraSwitchBtn');
  const uploadBtn = document.getElementById('uploadScanBtn');

  async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  async function start() {
    if (scanning) return;
    if (!('BarcodeDetector' in window)) {
      status('BarcodeDetector not supported. Try image upload.', true);
    } else {
      const types = ['qr_code','code_128','ean_13','ean_8','upc_a','itf'];
      detector = new BarcodeDetector({formats: types});
    }
    const cams = await getCameras();
    const backCam = cams.find(c => /back|rear|environment/i.test(c.label)) || cams[0];
    currentDeviceId = backCam ? backCam.deviceId : undefined;
    await startStream();
    scanning = true;
    loop();
    bindUi();
  }

  async function startStream() {
    if (stream) stop();
    const constraints = {
      video: { deviceId: currentDeviceId ? {exact: currentDeviceId} : undefined, facingMode: currentDeviceId ? undefined : 'environment' },
      audio: false
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();
    status('Scanning…');
  }

  function stop() {
    scanning = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    status('');
  }

  function status(msg, warn=false) { statusEl.textContent = msg; statusEl.style.color = warn ? '#f59e0b' : ''; }

  async function loop() {
    if (!scanning) return;
    try {
      if (detector) {
        const barcodes = await detector.detect(video);
        if (barcodes && barcodes.length) {
          const val = barcodes[0].rawValue;
          handleCode(val);
        }
      }
    } catch {}
    requestAnimationFrame(loop);
  }

  function bindUi() {
    camBtn.onclick = async () => {
      const cams = await getCameras();
      if (!cams.length) return;
      const idx = cams.findIndex(c => c.deviceId === currentDeviceId);
      const next = cams[(idx+1) % cams.length];
      currentDeviceId = next.deviceId;
      await startStream();
      App.toast('Switched camera');
    };
    torchBtn.onclick = async () => {
      try {
        const track = stream.getVideoTracks()[0];
        const cap = track.getCapabilities();
        if (!cap.torch) { App.toast('Torch not supported'); return; }
        const settings = track.getSettings();
        await track.applyConstraints({ advanced: [{ torch: !(settings.torch) }] });
      } catch { App.toast('Torch toggle failed'); }
    };
    uploadBtn.onclick = async () => {
      const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
      inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        const img = new Image();
        img.onload = async () => {
          const c = document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
          c.getContext('2d').drawImage(img,0,0);
          if (detector) {
            try {
              const found = await detector.detect(c);
              if (found && found.length) handleCode(found[0].rawValue);
              else App.toast('No code found');
            } catch { App.toast('Decode failed'); }
          } else {
            App.toast('No detector available');
          }
        };
        img.src = URL.createObjectURL(file);
      };
      inp.click();
    };
  }

  async function handleCode(code) {
    status('Found: '+code);
    const p = await DB.getProductByCode(code);
    const res = document.getElementById('scanResult');
    res.innerHTML = '';
    if (!p) {
      res.innerHTML = `<div class="card"><div><strong>Not found</strong><div class="meta">Code ${code}</div></div>
        <div><button class="btn" id="createFromScan">Create Product</button></div></div>`;
      document.getElementById('createFromScan').onclick = () => {
        App.switchTab('add');
        document.getElementById('code').value = code;
        Labels.drawPreview(code);
      };
      return;
    }
    const photoUrl = p.photoBlob ? URL.createObjectURL(p.photoBlob) : '';
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <img class="thumb" src="${photoUrl}" alt="">
      <div>
        <div><strong>${p.title||'(Untitled)'}</strong></div>
        <div class="meta">${p.code} • ${p.size||''} ${p.color||''}</div>
        <div class="meta">Buy ${App.fmtCurrency(p.purchasePrice)} + Ship ${App.fmtCurrency(p.shippingCost)}</div>
        <label>Selling Price <input id="sellPrice" class="input" inputmode="decimal" step="0.01" min="0"></label>
        <div id="profitPreview" class="meta"></div>
        <div class="row" style="margin-top:8px;">
          <button id="sellBtn" class="btn primary">Sold</button>
          <button id="undoBtn" class="btn">Undo</button>
          <button id="backScanBtn" class="btn">Back to Scanner</button>
        </div>
      </div>`;
    res.append(card);
    const sellEl = card.querySelector('#sellPrice');
    const profitEl = card.querySelector('#profitPreview');
    sellEl.addEventListener('input', () => {
      const sp = +sellEl.value||0;
      const pf = sp - (Number(p.purchasePrice||0)) - (Number(p.shippingCost||0));
      profitEl.textContent = 'Profit: ' + App.fmtCurrency(Math.max(0, Math.round(pf*100)/100));
    });
    card.querySelector('#sellBtn').onclick = async () => {
      const sp = +sellEl.value||0;
      if (sp <= 0) { App.toast('Enter a valid selling price'); return; }
      try {
        const id = await DB.recordSale({code:p.code, sellingPrice: sp});
        lastSaleId = id;
        App.toast('Sale recorded. Undo within 5s.');
        clearTimeout(undoTimer);
        undoTimer = setTimeout(()=>{ lastSaleId=null; }, 5000);
      } catch(err) { App.toast('Sale failed: '+err.message); }
    };
    card.querySelector('#undoBtn').onclick = async () => {
      if (!lastSaleId) { App.toast('Nothing to undo'); return; }
      await DB.undoSale(lastSaleId); lastSaleId=null; App.toast('Undone');
    };
    card.querySelector('#backScanBtn').onclick = () => { res.innerHTML=''; };
  }

  return { start, stop };
})();
