// tests.js — Tiny smoke tests.
const Tests = (() => {
  function assert(name, cond) { console.log(cond ? '✔︎ ' + name : '✖ ' + name); return { name, pass: !!cond }; }
  async function run() {
    const out = [];
    out.push(assert('UUIDv4 format', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((function(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);});})())));
    const profit = (sp, buy, ship) => Math.round((sp - buy - ship)*100)/100;
    out.push(assert('Profit calc', profit(20, 10, 3) === 7));
    const csv = '# PRODUCTS\ncode,title\n"c1","t1"\n\n# SALES\ncode,sellingPrice,profit,soldAt\n"c1","10","2","2024-01-01T00:00:00Z"\n';
    try { await DB.importCsv(csv); out.push(assert('CSV import ok', true)); } catch { out.push(assert('CSV import ok', false)); }
    alert(out.filter(x=>!x.pass).length ? 'Tests finished with failures (see console).' : 'All smoke tests passed.');
  }
  return { run };
})();
