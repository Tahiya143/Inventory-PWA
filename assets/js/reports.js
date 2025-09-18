// reports.js — Date presets, KPIs, charts (canvas), and modes: Sales / Expenses / P&L / By Category.

const Reports = (() => {
  const rangeSel = document.getElementById('reportRange');
  const modeSel = document.getElementById('reportMode');
  const startEl = document.getElementById('customStart');
  const endEl = document.getElementById('customEnd');

  function getRange(kind) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toISO = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
    let start, end;
    switch(kind) {
      case 'today': start = todayStart; end = new Date(); break;
      case 'yesterday': start = new Date(todayStart); start.setDate(start.getDate()-1); end = new Date(todayStart); break;
      case 'last7': start = new Date(todayStart); start.setDate(start.getDate()-6); end = new Date(); break;
      case 'thisMonth': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(); break;
      case 'lastMonth': start = new Date(now.getFullYear(), now.getMonth()-1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'custom': start = new Date(startEl.value); end = new Date(endEl.value||Date.now()); break;
      default: start = new Date(todayStart); end = new Date();
    }
    return { start: toISO(start), end: toISO(end) };
  }

  async function render() {
    const kind = rangeSel.value;
    const mode = modeSel.value;
    startEl.classList.toggle('hide', kind!=='custom');
    endEl.classList.toggle('hide', kind!=='custom');
    const range = getRange(kind);
    const sales = (await DB.listSales(range)).sort((a,b)=>a.soldAt.localeCompare(b.soldAt));
    const expenses = await DB.listExpenses(range);
    const items = sales.length;
    const gross = sales.reduce((a,s)=>a+parseFloat(s.sellingPrice||0),0);
    const profit = sales.reduce((a,s)=>a+parseFloat(s.profit||0),0);
    const avg = items ? gross/items : 0;
    const totalExpense = expenses.reduce((a,e)=>a+parseFloat(e.amount||0),0);

    const k = document.getElementById('reportKpis');
    if (mode==='expenses') {
      // KPIs + detailed table of expenses
      k.innerHTML = [
        ['Entries', expenses.length],
        ['Total Expenses', App.fmtCurrency(totalExpense)]
      ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
      // Charts: daily sum
      const buckets = new Map();
      expenses.forEach(e=>{ const d=new Date(e.createdAt).toLocaleDateString(); if(!buckets.has(d)) buckets.set(d,{amount:0,count:0}); const b=buckets.get(d); b.amount+=Number(e.amount||0); b.count++; });
      const labels = Array.from(buckets.keys());
      const amt = Array.from(buckets.values()).map(b=>Math.round(b.amount*100)/100);
      drawBarChart(salesChart, labels, amt, 'Expenses Over Time');
      drawLineChart(profitChart, labels, amt, 'Expense Amount');
      // Detailed list
      const rows = expenses.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(e => `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${(e.title||'').replace(/</g,'&lt;')}</td><td>${(e.category||'')}</td><td>${App.fmtCurrency(Number(e.amount||0))}</td><td>${(e.note||'')}</td></tr>`).join('');
      tbl.innerHTML = '<table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+ rows +'</tbody></table>';
    } else if (mode==='pnl') {
      const net = profit - totalExpense;
      k.innerHTML = [
        ['Gross Revenue', App.fmtCurrency(gross)],
        ['Total Profit', App.fmtCurrency(profit)],
        ['Expenses', App.fmtCurrency(totalExpense)],
        ['Net Profit', App.fmtCurrency(net)]
      ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
    } else if (mode==='category') {
      // KPIs: totals by product category & expense category counts
      k.innerHTML = [
        ['Items Sold', items],
        ['Total Profit', App.fmtCurrency(profit)],
        ['Expenses', App.fmtCurrency(totalExpense)]
      ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
    } else {
      k.innerHTML = [
        ['Items Sold', items],
        ['Gross Revenue', App.fmtCurrency(gross)],
        ['Total Profit', App.fmtCurrency(profit)],
        ['Avg Selling Price', App.fmtCurrency(avg)]
      ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
    }

    const salesChart = document.getElementById('salesChart');
    const profitChart = document.getElementById('profitChart');
    const tbl = document.getElementById('reportTable');

    // Clear canvases
    [salesChart, profitChart].forEach(c => c.getContext('2d').clearRect(0,0,c.width,c.height));

    if (mode==='expenses') {
      // KPIs + detailed table of expenses
      k.innerHTML = [
        ['Entries', expenses.length],
        ['Total Expenses', App.fmtCurrency(totalExpense)]
      ].map(([t,v]) => `<div class="kpi"><div class="muted small">${t}</div><div class="val">${v}</div></div>`).join('');
      // Charts: daily sum
      const buckets = new Map();
      expenses.forEach(e=>{ const d=new Date(e.createdAt).toLocaleDateString(); if(!buckets.has(d)) buckets.set(d,{amount:0,count:0}); const b=buckets.get(d); b.amount+=Number(e.amount||0); b.count++; });
      const labels = Array.from(buckets.keys());
      const amt = Array.from(buckets.values()).map(b=>Math.round(b.amount*100)/100);
      drawBarChart(salesChart, labels, amt, 'Expenses Over Time');
      drawLineChart(profitChart, labels, amt, 'Expense Amount');
      // Detailed list
      const rows = expenses.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(e => `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${(e.title||'').replace(/</g,'&lt;')}</td><td>${(e.category||'')}</td><td>${App.fmtCurrency(Number(e.amount||0))}</td><td>${(e.note||'')}</td></tr>`).join('');
      tbl.innerHTML = '<table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+ rows +'</tbody></table>';
    } else if (mode==='pnl') {
      const buckets = new Map(); // date -> {gross, profit, expense}
      sales.forEach(s=>{ const d=new Date(s.soldAt).toLocaleDateString(); if(!buckets.has(d)) buckets.set(d,{gross:0,profit:0,expense:0}); const b=buckets.get(d); b.gross+=Number(s.sellingPrice||0); b.profit+=Number(s.profit||0); });
      expenses.forEach(e=>{ const d=new Date(e.createdAt).toLocaleDateString(); if(!buckets.has(d)) buckets.set(d,{gross:0,profit:0,expense:0}); const b=buckets.get(d); b.expense+=Number(e.amount||0); });
      const labels = Array.from(buckets.keys());
      const net = labels.map((d,i)=> Math.round((buckets.get(labels[i]).profit - buckets.get(labels[i]).expense)*100)/100 );
      drawBarChart(salesChart, labels, net, 'Net Profit Over Time');
      drawLineChart(profitChart, labels, labels.map(d=>buckets.get(d).expense), 'Expenses');
      tbl.innerHTML = '<table><thead><tr><th>Date</th><th>Gross</th><th>Profit</th><th>Expense</th><th>Net</th></tr></thead><tbody>' +
        labels.map(d=>{ const b=buckets.get(d); const n = b.profit - b.expense; return `<tr><td>${d}</td><td>${App.fmtCurrency(b.gross)}</td><td>${App.fmtCurrency(b.profit)}</td><td>${App.fmtCurrency(b.expense)}</td><td>${App.fmtCurrency(n)}</td></tr>`; }).join('') +
        '</tbody></table>';
    } else if (mode==='category') {
      const allProd = await DB.listProducts({status:'all'});
      const prodMap = new Map(allProd.map(p => [p.code, p]));
      const soldByCat = new Map(); // category -> {count, profit}
      sales.forEach(s=>{ const cat = (prodMap.get(s.code)?.category)||'Uncategorized'; if(!soldByCat.has(cat)) soldByCat.set(cat,{count:0, profit:0}); const b=soldByCat.get(cat); b.count++; b.profit+=Number(s.profit||0); });
      const expByCat = new Map(); expenses.forEach(e=>{ const cat=e.category||'Uncategorized'; if(!expByCat.has(cat)) expByCat.set(cat,0); expByCat.set(cat, expByCat.get(cat)+Number(e.amount||0)); });
      const labels = Array.from(new Set([...soldByCat.keys(), ...expByCat.keys()]));
      const profs = labels.map(c => Math.round((soldByCat.get(c)?.profit||0)*100)/100);
      const exps = labels.map(c => Math.round((expByCat.get(c)||0)*100)/100);
      drawBarChart(salesChart, labels, profs, 'Profit by Product Category');
      drawBarChart(profitChart, labels, exps, 'Expenses by Category');
      tbl.innerHTML = '<table><thead><tr><th>Category</th><th>Sold Count</th><th>Profit</th><th>Expenses</th></tr></thead><tbody>' +
        labels.map(c => `<tr><td>${c}</td><td>${soldByCat.get(c)?.count||0}</td><td>${App.fmtCurrency(profs[labels.indexOf(c)])}</td><td>${App.fmtCurrency(exps[labels.indexOf(c)])}</td></tr>`).join('') +
        '</tbody></table>';
    } else {
      // Sales mode (default)
      const spanDays = (new Date(range.end) - new Date(range.start)) / 86400000;
      const groupBy = spanDays <= 2 ? 'hour' : 'day';
      const buckets = new Map();
      sales.forEach(s => {
        const d = new Date(s.soldAt);
        const key = groupBy==='hour'
          ? d.toLocaleString([], {hour:'2-digit', minute:'2-digit'})
          : d.toLocaleDateString();
        if (!buckets.has(key)) buckets.set(key, {count:0, profit:0, gross:0});
        const b = buckets.get(key); b.count++; b.profit += Number(s.profit||0); b.gross += Number(s.sellingPrice||0);
      });
      const labels = Array.from(buckets.keys());
      const counts = Array.from(buckets.values()).map(b => b.count);
      const profits = Array.from(buckets.values()).map(b => Math.round(b.profit*100)/100);
      drawBarChart(salesChart, labels, counts, 'Sales Count');
      drawLineChart(profitChart, labels, profits, 'Profit');
      tbl.innerHTML = '<table><thead><tr><th>'+groupBy.toUpperCase()+'</th><th>Count</th><th>Gross</th><th>Profit</th></tr></thead><tbody>' +
        labels.map((k,i)=> `<tr><td>${k}</td><td>${counts[i]}</td><td>${App.fmtCurrency(Array.from(buckets.values())[i].gross)}</td><td>${App.fmtCurrency(profits[i])}</td></tr>`).join('') +
        '</tbody></table>';
    }
  }

  function drawBarChart(canvas, labels, data, title) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height; c.clearRect(0,0,W,H);
    c.fillStyle = '#fff'; c.font = '12px system-ui, sans-serif'; c.fillText(title, 8, 16);
    const max = Math.max(1, ...data);
    const pad = 28, gap = 10;
    const bw = (W - pad*2 - gap*(data.length-1)) / Math.max(1,data.length);
    data.forEach((v,i) => {
      const h = (H - pad*2) * (v/max);
      const x = pad + i*(bw+gap), y = H - pad - h;
      c.fillStyle = ['#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899'][i%5]; c.fillRect(x,y,bw,h);
      c.fillStyle = '#bbb'; c.fillText(labels[i]||'', x, H-8);
    });
  }
  function drawLineChart(canvas, labels, data, title) {
    const c = canvas.getContext('2d'); const W=canvas.width, H=canvas.height; c.clearRect(0,0,W,H);
    c.fillStyle='#fff'; c.font='12px system-ui, sans-serif'; c.fillText(title, 8, 16);
    const max = Math.max(1, ...data); const pad=28;
    c.strokeStyle='#22c55e'; c.lineWidth=2; c.beginPath();
    data.forEach((v,i) => {
      const x = pad + i*( (W-pad*2) / Math.max(1,data.length-1) );
      const y = H - pad - (H-pad*2)*(v/max);
      if (i===0) c.moveTo(x,y); else c.lineTo(x,y);
      c.fillStyle='#999'; c.fillText(labels[i]||'', x-10, H-8);
    });
    c.stroke();
  }

  document.getElementById('exportReportCsv').onclick = async () => {
    const kind = rangeSel.value; const mode = modeSel.value; const range = getRange(kind);
    let csv = '';
    if (mode==='expenses') {
      const exps = await DB.listExpenses(range); const headers=['title','amount','category','note','createdAt'];
      const rows = exps.map(e => headers.map(h => '"'+(e[h]??'').toString().replaceAll('"','""')+'"').join(','));
      csv = headers.join(',')+'\n'+rows.join('\n');
    } else if (mode==='category') {
      const allProducts = await DB.listProducts({status:'all'});
      const prodMap = new Map(allProducts.map(p => [p.code, p]));
      const sales = await DB.listSales(range);
      const expenses = await DB.listExpenses(range);
      const soldByCat = new Map(); sales.forEach(s=>{ const cat=(prodMap.get(s.code)?.category)||'Uncategorized'; if(!soldByCat.has(cat)) soldByCat.set(cat,{count:0,profit:0}); const b=soldByCat.get(cat); b.count++; b.profit+=Number(s.profit||0); });
      const expByCat = new Map(); expenses.forEach(e=>{ const cat=e.category||'Uncategorized'; expByCat.set(cat,(expByCat.get(cat)||0)+Number(e.amount||0)); });
      const labels = Array.from(new Set([...soldByCat.keys(), ...expByCat.keys()]));
      const headers=['category','soldCount','profit','expenses'];
      const rows = labels.map(cat => [cat, soldByCat.get(cat)?.count||0, soldByCat.get(cat)?.profit||0, expByCat.get(cat)||0].map(v => '"'+String(v).replaceAll('"','""')+'"').join(','));
      csv = headers.join(',')+'\n'+rows.join('\n');
    } else {
      const sales = (await DB.listSales(range)).sort((a,b)=>a.soldAt.localeCompare(b.soldAt));
      const headers = ['code','sellingPrice','profit','soldAt'];
      const rows = sales.map(s => headers.map(h => '"'+(s[h]??'').toString().replaceAll('"','""')+'"').join(','));
      csv = headers.join(',') + '\n' + rows.join('\n');
    }
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download='report.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
  };
  document.getElementById('printReportBtn').onclick = () => window.print();

  rangeSel.onchange = render; modeSel.onchange = render;
  document.getElementById('customStart').onchange = render;
  document.getElementById('customEnd').onchange = render;

  return { render };
})();
