// labels.js — Label preview drawing (text fallback). Hooks for QR/Barcode libs.
const Labels = (() => {
  function drawPreview(code) {
    const c = document.getElementById('labelPreview');
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0,0,c.width,c.height);
    cx.fillStyle = '#000'; cx.font = '14px system-ui, sans-serif';
    cx.fillText('Code:', 10, 18);
    cx.font = 'bold 16px system-ui, sans-serif';
    cx.fillText(code.slice(0,18), 10, 38);
    cx.font = '12px system-ui, sans-serif';
    cx.fillText('Label image will appear here', 10, 58);
    if (window.QRCode && QRCode.toCanvas) {
      const tmp = document.createElement('canvas');
      QRCode.toCanvas(tmp, code, {width:140, margin:1}, (err)=>{
        if (!err) cx.drawImage(tmp, 10, 70);
      });
    }
  }
  return { drawPreview };
})();
