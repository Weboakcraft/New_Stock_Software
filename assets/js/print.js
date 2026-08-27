/* Oakcraft Stock — bill / invoice rendering, preview, print and share */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, DB = w.DB, M = w.M, UI = w.UI;

  const THEMES = [
    { key: 'modern', label: 'Modern' }, { key: 'billbook', label: 'Bill Book' }, { key: 'stylish', label: 'Stylish' },
    { key: 'gst', label: 'GST Theme' }, { key: 'basic', label: 'Basic Theme' }, { key: 'modern2', label: 'Modern-2' },
    { key: 'elite', label: 'Modern Elite' }, { key: 'tally', label: 'Tally Theme' }, { key: 'divine', label: 'Double Devine' }
  ];

  function esc(s) { return U.esc(s); }

  function css(colour, theme) {
    const c = colour || '#a4801d';
    const boxed = ['billbook', 'gst', 'tally', 'divine'].indexOf(theme) >= 0;
    return `
    .ocbill{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#111;background:#fff;font-size:12px;max-width:800px;margin:0 auto;padding:14px}
    .ocbill *{box-sizing:border-box}
    .ocbill .hd{display:flex;gap:12px;align-items:flex-start;border-bottom:2px solid ${c};padding-bottom:10px;margin-bottom:10px}
    .ocbill .hd img{height:56px;width:auto;max-width:120px;object-fit:contain}
    .ocbill .biz{flex:1}
    .ocbill .biz h1{margin:0;font-size:19px;letter-spacing:.4px;color:${c}}
    .ocbill .biz .l{font-size:11px;line-height:1.45;color:#333}
    .ocbill .title{text-align:center;font-weight:800;letter-spacing:2px;font-size:13px;margin:6px 0 10px;color:${c}}
    ${theme === 'divine' ? `.ocbill .slogan{text-align:center;font-size:11px;color:${c};margin-bottom:4px;font-style:italic}` : '.ocbill .slogan{text-align:center;font-size:10.5px;color:#666;margin-bottom:4px}'}
    .ocbill .meta{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}
    .ocbill .meta>div{flex:1;min-width:210px;border:1px solid #ddd;border-radius:${boxed ? '0' : '7px'};padding:8px 10px;font-size:11px;line-height:1.55}
    .ocbill .meta b{color:${c}}
    .ocbill table{width:100%;border-collapse:collapse;font-size:11px}
    .ocbill thead th{background:${theme === 'basic' ? '#f2f2f2' : c};color:${theme === 'basic' ? '#222' : '#fff'};padding:7px 6px;text-align:left;font-size:10.5px;letter-spacing:.4px;border:${boxed ? '1px solid #999' : '0'}}
    .ocbill tbody td{padding:6px;border-bottom:1px solid #e3e3e3;vertical-align:top;${boxed ? 'border:1px solid #ccc;' : ''}}
    .ocbill tbody tr:nth-child(even) td{background:${theme === 'stylish' || theme === 'elite' ? '#faf7ef' : '#fff'}}
    .ocbill .num{text-align:right;white-space:nowrap}
    .ocbill .sub{font-size:9.5px;color:#666}
    .ocbill .bot{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap}
    .ocbill .bot .left{flex:1.15;min-width:230px;font-size:10.5px}
    .ocbill .bot .right{flex:1;min-width:230px}
    .ocbill .tot{width:100%;font-size:11.5px}
    .ocbill .tot td{padding:4px 6px;border-bottom:1px dotted #ddd}
    .ocbill .tot .g td{font-weight:800;font-size:14px;background:${c}18;border-top:2px solid ${c};border-bottom:2px solid ${c}}
    .ocbill .words{font-size:10.5px;margin-top:6px;padding:5px 7px;background:#f7f4ee;border-left:3px solid ${c}}
    .ocbill .bank{border:1px dashed ${c};padding:7px 9px;border-radius:${boxed ? '0' : '6px'};font-size:10.5px;line-height:1.55;margin-top:6px}
    .ocbill .terms{white-space:pre-wrap;font-size:9.8px;color:#444;line-height:1.5;margin-top:6px}
    .ocbill .signs{display:flex;justify-content:space-between;gap:14px;margin-top:16px;font-size:10.5px}
    .ocbill .signs div{text-align:center;min-width:150px;border-top:1px solid #999;padding-top:4px}
    .ocbill .sig img{height:38px;display:block;margin:0 auto 2px}
    .ocbill .qr{text-align:center;font-size:9.5px}
    .ocbill .qr img,.ocbill .qr svg{width:92px;height:92px}
    .ocbill .ft{text-align:center;font-size:9.5px;color:#777;margin-top:10px;border-top:1px solid #ddd;padding-top:6px}
    /* thermal */
    .octhermal{font-family:'Courier New',monospace;color:#000;background:#fff;font-size:11px;line-height:1.35}
    .octhermal .c{text-align:center}.octhermal .r{text-align:right}
    .octhermal hr{border:0;border-top:1px dashed #000;margin:4px 0}
    .octhermal table{width:100%;border-collapse:collapse;font-size:10.5px}
    .octhermal td{padding:1px 0;vertical-align:top}
    .octhermal .big{font-size:13px;font-weight:800}
    @media print{ .ocbill{padding:0} @page{margin:8mm} }
    `;
  }

  function html(docId, opts) {
    opts = opts || {};
    const d = M.doc(docId); if (!d) return '';
    const items = U.sortBy(M.docItems(docId), i => i.seq || 0);
    const s = M.settings();
    const cfg = M.DOC[d.dtype];
    const theme = opts.theme || s.billTheme || 'modern';
    const colour = opts.colour || s.billColour || '#a4801d';
    if (s.thermal && !opts.forceA4) return thermal(d, items, s, cfg);

    const extra = (s.extraCols || []).map(k => (w.DocPages.EXTRA_COLS.find(x => x.key === k) || null)).filter(Boolean);
    const heads = ['#', 'Items / Qty'].concat(s.showMRP ? ['MRP'] : []).concat(['Price', 'Amount']);

    const rows = items.map((it, ix) => {
      const gross = U.n(it.qty) * U.n(it.price);
      const bits = [];
      if (it.gstRate) bits.push('GST ' + it.gstRate + '%');
      if (it.hsn) bits.push('HSN: ' + esc(it.hsn));
      extra.forEach(x => { if (it[x.key]) bits.push(esc(x.label) + ': ' + esc(it[x.key])); });
      if (s.showDesc && it.desc) bits.push(esc(it.desc));
      return '<tr>' +
        '<td>' + (ix + 1) + '</td>' +
        '<td>' + (s.showImage && it._img ? '<img src="' + it._img + '" style="height:26px;float:left;margin-right:5px">' : '') +
        '<b>' + esc(it.name) + '</b><div class="sub">' + bits.join(' &nbsp;·&nbsp; ') + '</div>' +
        '<div class="sub">' + U.qty(it.qty, it.unit) + '</div></td>' +
        (s.showMRP ? '<td class="num">' + (it.mrp ? U.money(it.mrp) : '—') + '</td>' : '') +
        '<td class="num">' + U.money(it.price) + '</td>' +
        '<td class="num">' + U.money(gross) + '</td></tr>';
    }).join('');

    const upiStr = s.upi ? w.QR.upi(s.upi, s.bizName, d.total, d.number) : '';
    const qr = (s.showUpiQr && s.upi) ? '<div class="qr">' + w.QR.svg(upiStr, { scale: 3, ec: 'M' }) + '<div>Scan &amp; pay · ' + esc(s.upi) + '</div></div>' : '';

    const totRows = []
      .concat(['<tr><td>Sub total</td><td class="num">' + U.money(d.subTotal) + '</td></tr>'])
      .concat((d.charges || []).map(ch => '<tr><td>' + esc(ch.name) + (ch.gst ? ' (ex ' + ch.gst + '% GST)' : '') + '</td><td class="num">' + U.money(ch.amount) + '</td></tr>'))
      .concat(U.n(d.discount) ? ['<tr><td>Discount</td><td class="num">- ' + U.money(d.discount) + '</td></tr>'] : [])
      .concat(['<tr><td>Taxable amount</td><td class="num">' + U.money(d.taxable) + '</td></tr>'])
      .concat(U.n(d.igst) ? ['<tr><td>IGST</td><td class="num">' + U.money(d.igst) + '</td></tr>']
        : [U.n(d.cgst) ? '<tr><td>CGST</td><td class="num">' + U.money(d.cgst) + '</td></tr>' : '',
        U.n(d.sgst) ? '<tr><td>SGST</td><td class="num">' + U.money(d.sgst) + '</td></tr>' : ''])
      .concat(U.n(d.roundOff) ? ['<tr><td>Round off</td><td class="num">' + U.money(d.roundOff) + '</td></tr>'] : [])
      .concat(['<tr class="g"><td>Total amount</td><td class="num">' + U.money(d.total) + '</td></tr>'])
      .concat(cfg.pay ? ['<tr><td>' + (d.dtype === 'PURCHASE' ? 'Paid' : 'Received') + ' (' + esc(d.payMode || 'Cash') + ')</td><td class="num">' + U.money(d.received) + '</td></tr>',
        '<tr><td><b>Due amount</b></td><td class="num"><b>' + U.money(d.due) + '</b></td></tr>'] : [])
      .join('');

    const bank = s.showBank && (s.bankAc || s.upi) ? '<div class="bank"><b>Bank details</b><br>' +
      [s.bankHolder && ('A/c holder: ' + esc(s.bankHolder)), s.bankName && ('Bank: ' + esc(s.bankName)),
      s.bankAc && ('A/c no: ' + esc(s.bankAc)), s.bankIfsc && ('IFSC: ' + esc(s.bankIfsc)),
      s.bankBranch && ('Branch: ' + esc(s.bankBranch)), s.upi && ('UPI: ' + esc(s.upi))].filter(Boolean).join('<br>') + '</div>' : '';

    return '<style>' + css(colour, theme) + '</style><div class="ocbill theme-' + theme + '">' +
      (s.slogan ? '<div class="slogan">' + esc(s.slogan) + '</div>' : '') +
      '<div class="hd">' +
      (s.logo ? '<img src="' + s.logo + '" alt="">' : '') +
      '<div class="biz"><h1>' + esc(s.bizName || 'OAKCRAFT') + '</h1><div class="l">' +
      esc(s.address || '') + '<br>' +
      [s.phone && ('📞 ' + esc(s.phone)), s.email && ('✉ ' + esc(s.email)), s.website && ('🌐 ' + esc(s.website))].filter(Boolean).join(' &nbsp; ') + '<br>' +
      [s.gstin && ('<b>GSTIN:</b> ' + esc(s.gstin)), s.pan && ('<b>PAN:</b> ' + esc(s.pan)), s.udyam && ('<b>Udyam:</b> ' + esc(s.udyam))].filter(Boolean).join(' &nbsp; ') +
      '</div></div></div>' +
      '<div class="title">' + esc(cfg.key === 'SALE' ? (s.billTitle || 'TAX INVOICE') : cfg.label.toUpperCase()) + '</div>' +
      '<div class="meta"><div>' +
      '<b>' + esc(cfg.short) + ' no:</b> ' + esc(d.number) + '<br>' +
      '<b>Date:</b> ' + U.fmtDT(d.at) + '<br>' +
      '<b>Place of supply:</b> ' + esc(d.partyState || s.state || '—') +
      '</div><div>' +
      '<b>' + (cfg.party === 'Supplier' ? 'Purchased from' : 'Bill to') + ':</b> ' + esc(d.partyName || 'Cash / Walk-in') + '<br>' +
      (d.partyAddr ? esc(d.partyAddr) + '<br>' : '') +
      (d.partyPhone ? 'Phone: ' + esc(d.partyPhone) + '<br>' : '') +
      (d.partyGst ? 'GSTIN: ' + esc(d.partyGst) : '') +
      '</div></div>' +
      '<table><thead><tr>' + heads.map((h, i) => '<th' + (i >= heads.length - 2 ? ' class="num"' : '') + '>' + h + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="6">No items</td></tr>') + '</tbody></table>' +
      '<div class="bot"><div class="left">' +
      '<div class="words"><b>Amount in words:</b> ' + U.numToWords(d.total) + ' Rupees Only</div>' +
      (d.remark ? '<div class="terms"><b>Remark:</b> ' + esc(d.remark) + '</div>' : '') +
      bank +
      (d.terms ? '<div class="terms"><b>Terms &amp; conditions</b>\n' + esc(d.terms) + '</div>' : '') +
      '</div><div class="right"><table class="tot">' + totRows + '</table>' + qr + '</div></div>' +
      '<div class="signs">' +
      (s.showCustomerSign ? '<div>Customer signature</div>' : '<div></div>') +
      (s.showSign ? '<div class="sig">' + (s.signature ? '<img src="' + s.signature + '">' : '<div style="height:38px"></div>') + 'For ' + esc(s.bizName || 'OAKCRAFT') + '</div>' : '') +
      '</div>' +
      '<div class="ft">This is a computer generated ' + esc(cfg.label.toLowerCase()) + '. Thank you for your business!</div>' +
      '</div>';
  }

  function thermal(d, items, s, cfg) {
    const width = { '2': '58mm', '3': '80mm', '4': '104mm' }[s.thermalWidth || '3'];
    const line = '<hr>';
    const rows = items.map((it, i) =>
      '<tr><td colspan="3">' + (i + 1) + '. ' + esc(it.name) + '</td></tr>' +
      '<tr><td>' + U.qty(it.qty, it.unit) + ' × ' + U.money(it.price, true) + '</td><td class="r" colspan="2">' + U.money(U.n(it.qty) * U.n(it.price), true) + '</td></tr>'
    ).join('');
    const upiStr = s.upi ? w.QR.upi(s.upi, s.bizName, d.total, d.number) : '';
    return '<style>' + css(s.billColour, 'basic') + '.octhermal{width:' + width + ';margin:0 auto;padding:3mm}@page{size:' + width + ' auto;margin:2mm}</style>' +
      '<div class="octhermal">' +
      (s.logo ? '<div class="c"><img src="' + s.logo + '" style="height:34px"></div>' : '') +
      '<div class="c big">' + esc(s.bizName || 'OAKCRAFT') + '</div>' +
      '<div class="c">' + esc(s.address || '') + '</div>' +
      '<div class="c">' + esc(s.phone || '') + (s.gstin ? ' · GSTIN ' + esc(s.gstin) : '') + '</div>' + line +
      '<div class="c big">' + esc(cfg.label.toUpperCase()) + '</div>' +
      '<div>No: ' + esc(d.number) + '</div><div>Date: ' + U.fmtDT(d.at) + '</div>' +
      '<div>To: ' + esc(d.partyName || 'Cash') + '</div>' + line +
      '<table>' + rows + '</table>' + line +
      '<table>' +
      '<tr><td>Sub total</td><td class="r">' + U.money(d.subTotal, true) + '</td></tr>' +
      (U.n(d.discount) ? '<tr><td>Discount</td><td class="r">-' + U.money(d.discount, true) + '</td></tr>' : '') +
      (U.n(d.cgst) ? '<tr><td>CGST</td><td class="r">' + U.money(d.cgst, true) + '</td></tr>' : '') +
      (U.n(d.sgst) ? '<tr><td>SGST</td><td class="r">' + U.money(d.sgst, true) + '</td></tr>' : '') +
      (U.n(d.igst) ? '<tr><td>IGST</td><td class="r">' + U.money(d.igst, true) + '</td></tr>' : '') +
      '<tr><td class="big">TOTAL</td><td class="r big">' + U.money(d.total, true) + '</td></tr>' +
      (cfg.pay ? '<tr><td>Paid</td><td class="r">' + U.money(d.received, true) + '</td></tr><tr><td>Due</td><td class="r">' + U.money(d.due, true) + '</td></tr>' : '') +
      '</table>' + line +
      (s.showUpiQr && s.upi ? '<div class="c">' + w.QR.svg(upiStr, { scale: 2, ec: 'M' }) + '<div>' + esc(s.upi) + '</div></div>' + line : '') +
      (d.terms ? '<div style="white-space:pre-wrap;font-size:9px">' + esc(d.terms) + '</div>' + line : '') +
      '<div class="c">Thank you for your business!</div></div>';
  }

  /* ---------------- preview modal ---------------- */
  function preview(docId) {
    const d = M.doc(docId); if (!d) { UI.toast('Bill not found', 'err'); return; }
    const s = M.settings();
    const frameHost = el('div', { style: { background: '#fff', borderRadius: '10px', overflow: 'auto', maxHeight: '62vh', border: '1px solid var(--border)' } });
    function paint(force) { frameHost.innerHTML = html(docId, { forceA4: force }); }
    paint(false);
    const m = UI.modal({
      title: M.DOC[d.dtype].label + ' ' + d.number, size: 'wide',
      body: frameHost,
      buttons: [
        { label: '⬇ Save as PDF', cls: 'btn-ghost', onClick: () => UI.print(html(docId, {})) },
        { label: '📤 Share', cls: 'btn-ghost', onClick: () => share(docId) },
        { label: '🖨 Print', cls: 'btn-p', onClick: () => UI.print(html(docId, {})) },
        { label: 'Close', cls: 'btn-ghost', onClick: () => m.close() }
      ]
    });
  }

  function textSummary(docId) {
    const d = M.doc(docId), s = M.settings(), items = M.docItems(docId), cfg = M.DOC[d.dtype];
    const lines = [
      '*' + (s.bizName || 'OAKCRAFT') + '*',
      cfg.label + ' ' + d.number + ' · ' + U.fmtDate(d.at),
      'To: ' + (d.partyName || 'Cash'), ''
    ];
    items.forEach((it, i) => lines.push((i + 1) + '. ' + it.name + ' — ' + U.qty(it.qty, it.unit) + ' × ' + U.money(it.price, true) + ' = ' + U.money(U.n(it.qty) * U.n(it.price), true)));
    lines.push('', 'Total: ' + U.money(d.total, true));
    if (cfg.pay) { lines.push('Received: ' + U.money(d.received, true)); lines.push('Due: ' + U.money(d.due, true)); }
    if (s.upi) lines.push('', 'Pay by UPI: ' + s.upi);
    lines.push('', s.phone || '', s.website || '');
    return lines.filter(x => x !== undefined).join('\n');
  }

  async function share(docId) {
    const d = M.doc(docId);
    const text = textSummary(docId);
    if (navigator.share) {
      try { await navigator.share({ title: M.DOC[d.dtype].label + ' ' + d.number, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); UI.toast('Bill copied — paste it into WhatsApp', 'ok', 3200); }
    catch (e) {
      UI.modal({ title: 'Share bill', size: 'narrow', body: el('textarea', { class: 'inp', style: { minHeight: '240px' }, text }) });
    }
  }

  w.BillPrint = { html, preview, share, textSummary, THEMES, css };
})(window);
