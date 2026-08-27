/* Page — Party (customers & suppliers, ledger, receive / pay) */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App;
  const state = { q: '', filter: '0', page: 1, per: 25 };

  /* ---------------------------------------------------------------- party form */
  function partyModal(id, onSaved) {
    const p = id ? DB.get('parties', id) : null;
    const f = {};
    f.name = UI.input({ value: p ? p.name : '' });
    f.phone = UI.input({ type: 'tel', value: p ? p.phone : '' });
    f.ptype = UI.select(['Customer', 'Supplier'], p ? p.ptype : 'Customer');
    f.payType = UI.select([{ value: 'receive', label: 'To Receive' }, { value: 'pay', label: 'To Pay' }], p ? p.payType : 'receive');
    f.opening = UI.input({ type: 'number', step: '0.01', value: p ? p.opening : '' });
    f.gst = UI.input({ value: p ? p.gst : '' });
    f.pan = UI.input({ value: p ? p.pan : '' });
    f.billAddr = UI.textarea({ value: p ? p.billAddr : '' });
    f.pin = UI.input({ value: p ? p.pin : '' });
    f.state = UI.input({ value: p ? p.state : '' });
    f.shipAddr = UI.textarea({ value: p ? p.shipAddr : '' });
    f.shipPin = UI.input({ value: p ? p.shipPin : '' });
    f.shipState = UI.input({ value: p ? p.shipState : '' });
    f.acNo = UI.input({ value: p ? p.acNo : '' });
    f.acName = UI.input({ value: p ? p.acName : '' });
    f.ifsc = UI.input({ value: p ? p.ifsc : '' });
    f.bank = UI.input({ value: p ? p.bank : '' });
    f.branch = UI.input({ value: p ? p.branch : '' });
    const shipWrap = el('div');
    const same = UI.checkBox('Shipping address is same as billing address', p ? p.shipSame !== false : true, v => shipWrap.classList.toggle('hide', v));
    shipWrap.appendChild(UI.field('Shipping address', f.shipAddr));
    shipWrap.appendChild(UI.row(2, [UI.field('Shipping pin code', f.shipPin), UI.field('Shipping state', f.shipState)]));
    if (same.input.checked) shipWrap.classList.add('hide');

    const body = el('div', { class: 'frm' }, [
      UI.row(2, [UI.field(T('Party Name'), f.name, { req: true }), UI.field(T('Phone number'), f.phone)]),
      UI.row(3, [UI.field(T('Party Type'), f.ptype, { req: true }), UI.field('Payment type', f.payType, { req: true }), UI.field(T('Opening Balance'), f.opening)]),
      UI.sect('Additional information (optional)'),
      UI.row(2, [UI.field('GST number', f.gst), UI.field('PAN number', f.pan)]),
      UI.field('Billing address', f.billAddr),
      UI.row(2, [UI.field('Pin code', f.pin), UI.field('Billing state', f.state)]),
      same, shipWrap,
      UI.sect(T('Bank Account Details')),
      UI.row(2, [UI.field('Account number', f.acNo), UI.field('Account holder name', f.acName)]),
      UI.row(3, [UI.field('IFSC code', f.ifsc), UI.field('Bank name', f.bank), UI.field('Branch name', f.branch)])
    ]);

    const m = UI.modal({
      title: p ? 'Edit party' : 'Fill the party details', size: 'wide', body,
      buttons: [
        { label: T('Cancel'), cls: 'btn-ghost', onClick: () => m.close() },
        { label: T('Save'), cls: 'btn-p', onClick: save }
      ]
    });
    function save() {
      const name = f.name.value.trim();
      if (!name) { UI.toast('Party name is required', 'err'); f.name.focus(); return; }
      const rec = DB.put('parties', {
        id: p ? p.id : undefined, name, phone: f.phone.value.trim(), ptype: f.ptype.value,
        payType: f.payType.value, opening: U.n(f.opening.value), gst: f.gst.value.trim().toUpperCase(),
        pan: f.pan.value.trim().toUpperCase(), billAddr: f.billAddr.value.trim(), pin: f.pin.value.trim(),
        state: f.state.value.trim(), shipSame: same.input.checked,
        shipAddr: same.input.checked ? f.billAddr.value.trim() : f.shipAddr.value.trim(),
        shipPin: same.input.checked ? f.pin.value.trim() : f.shipPin.value.trim(),
        shipState: same.input.checked ? f.state.value.trim() : f.shipState.value.trim(),
        acNo: f.acNo.value.trim(), acName: f.acName.value.trim(), ifsc: f.ifsc.value.trim().toUpperCase(),
        bank: f.bank.value.trim(), branch: f.branch.value.trim(), storeId: M.currentStoreId()
      });
      m.close(); UI.toast(T('Saved'), 'ok');
      if (onSaved) onSaved(rec); else App.refresh();
    }
    return m;
  }

  /* ---------------------------------------------------------------- receive / pay */
  function payModal(kind, partyId) {
    const isRec = kind === 'RECEIVE';
    const dt = UI.input({ type: 'datetime-local', value: U.isoLocal() });
    const pick = UI.picker({
      placeholder: 'Select here!',
      items: M.parties().map(p => {
        const b = M.partyBalance(p.id);
        return { id: p.id, label: p.name, sub: p.ptype + (p.phone ? ' · ' + p.phone : ''), right: (b >= 0 ? '<span class="green">' : '<span class="red">') + U.money(Math.abs(b)) + '</span>' };
      })
    });
    if (partyId) { const p = DB.get('parties', partyId); if (p) pick.setValue({ id: p.id, label: p.name }); }
    const amt = UI.input({ type: 'number', step: '0.01', placeholder: 'Enter amount' });
    const mode = UI.select(M.PAY_MODES, 'Cash');
    const remark = UI.textarea({});
    const m = UI.modal({
      title: isRec ? T('Receive Amount') : T('Pay Amount'), size: 'narrow',
      headExtra: el('span', { class: 'small muted', text: U.fmtDate(new Date()) }),
      body: el('div', { class: 'frm' }, [
        UI.field(T('Party Name'), pick, { req: true }),
        UI.row(2, [UI.field(isRec ? T('Receive Amount') : T('Pay Amount'), el('div', { class: 'pfx' }, [el('span', { class: 'lab', text: '₹' }), amt]), { req: true }), UI.field(T('Payment Mode'), mode)]),
        UI.field(T('Remark'), remark),
        UI.field('Date & time', dt)
      ]),
      buttons: [{ label: T('Save'), cls: isRec ? 'btn-green' : 'btn-blue', onClick: save }]
    });
    function save() {
      const sel = pick.getValue();
      if (!sel) { UI.toast('Choose a party', 'err'); return; }
      if (U.n(amt.value) <= 0) { UI.toast('Enter an amount', 'err'); return; }
      M.addPayment({ at: new Date(dt.value || Date.now()).toISOString(), partyId: sel.id, kind, amount: U.n(amt.value), mode: mode.value, remark: remark.value.trim() });
      m.close(); UI.toast(isRec ? 'Amount received' : 'Amount paid', 'ok'); App.refresh();
    }
    return m;
  }

  /* ---------------------------------------------------------------- ledger */
  function ledgerModal(id) {
    const p = DB.get('parties', id); if (!p) return;
    const rows = [];
    if (U.n(p.opening)) rows.push({ at: p.createdAt, what: 'Opening balance', dr: p.payType === 'receive' ? U.n(p.opening) : 0, cr: p.payType === 'pay' ? U.n(p.opening) : 0, ref: '' });
    DB.all('docs').filter(d => d.partyId === id).forEach(d => {
      const t = U.n(d.total), cfg = M.DOC[d.dtype];
      if (!cfg || !cfg.pay) return;
      const dr = (d.dtype === 'SALE' || d.dtype === 'PURCHASE_RETURN') ? t : 0;
      const cr = (d.dtype === 'PURCHASE' || d.dtype === 'SALE_RETURN') ? t : 0;
      rows.push({ at: d.at, what: cfg.label + ' ' + d.number, dr, cr, ref: d.id, dtype: d.dtype });
    });
    DB.all('payments').filter(x => x.partyId === id).forEach(x => {
      rows.push({ at: x.at, what: (x.kind === 'RECEIVE' ? 'Received' : 'Paid') + ' (' + x.mode + ')' + (x.remark ? ' — ' + x.remark : ''), dr: x.kind === 'PAY' ? U.n(x.amount) : 0, cr: x.kind === 'RECEIVE' ? U.n(x.amount) : 0, ref: '' });
    });
    const sorted = U.sortBy(rows, r => r.at || '');
    let run = 0; sorted.forEach(r => { run += r.dr - r.cr; r.bal = U.round(run); });
    const bal = M.partyBalance(id);

    const info = el('div', { class: 'grid g3 mb16' }, [
      el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: 'Balance' }), el('div', { class: 'b ' + (bal >= 0 ? 'green' : 'red'), style: { fontSize: '21px' }, text: U.money(Math.abs(bal)) }), el('div', { class: 'small', text: bal >= 0 ? 'To receive' : 'To pay' })]),
      el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: 'Contact' }), el('div', { class: 'b', text: p.phone || '—' }), el('div', { class: 'small muted', text: p.ptype })]),
      el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: 'GST / PAN' }), el('div', { class: 'b', text: p.gst || '—' }), el('div', { class: 'small muted', text: p.pan || '' })])
    ]);
    const addr = el('div', { class: 'card card-pad mb16 small' }, [
      el('b', { text: 'Billing address' }), el('div', { class: 'muted', text: (p.billAddr || '—') + (p.pin ? ', ' + p.pin : '') + (p.state ? ', ' + p.state : '') }),
      p.acNo ? el('div', { class: 'mt8' }, [el('b', { text: 'Bank ' }), el('span', { class: 'muted', text: [p.bank, p.branch, p.acNo, p.ifsc].filter(Boolean).join(' · ') })]) : null
    ]);
    const tbl = UI.table([
      { h: 'Date', render: r => U.fmtDT(r.at) },
      { h: 'Particulars', render: r => U.esc(r.what) },
      { h: 'Debit', cls: 'num', render: r => r.dr ? U.money(r.dr) : '—' },
      { h: 'Credit', cls: 'num', render: r => r.cr ? U.money(r.cr) : '—' },
      { h: 'Balance', cls: 'num', render: r => '<b>' + U.money(Math.abs(r.bal)) + '</b> <span class="tiny muted">' + (r.bal >= 0 ? 'Dr' : 'Cr') + '</span>' }
    ], sorted, { dense: true, empty: 'No transactions with this party yet.' });

    UI.modal({
      title: p.name + ' — ledger', size: 'wide',
      body: el('div', {}, [info, addr, tbl]),
      buttons: [
        { label: '⬇ Excel', cls: 'btn-ghost', onClick: () => U.exportXLS('ledger-' + p.name, 'Ledger', ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'], sorted.map(r => [U.fmtDT(r.at), r.what, r.dr, r.cr, r.bal])) },
        { label: T('Receive'), cls: 'btn-green', onClick: mm => { mm.close(); payModal('RECEIVE', id); } },
        { label: T('Pay'), cls: 'btn-blue', onClick: mm => { mm.close(); payModal('PAY', id); } },
        { label: T('Close'), cls: 'btn-ghost', onClick: mm => mm.close() }
      ]
    });
  }

  /* ---------------------------------------------------------------- page */
  App.page('party', {
    title: 'Party Details', crumb: 'Pages / Party',
    render(c) {
      const tot = M.partyTotals();
      c.appendChild(el('div', { class: 'grid g2 mb16' }, [
        el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: T('Total Amount To Receive') }), el('div', { class: 'b green', style: { fontSize: '24px' }, text: U.money(tot.receive) })]),
        el('div', { class: 'card card-pad' }, [el('div', { class: 'small muted', text: T('Total Amount To Pay') }), el('div', { class: 'b red', style: { fontSize: '24px' }, text: U.money(tot.pay) })])
      ]));

      const search = UI.input({ placeholder: T('Search party here!') + ' 🔍', value: state.q });
      search.addEventListener('input', U.debounce(() => { state.q = search.value; state.page = 1; paint(); }, 200));
      const filt = UI.select([{ value: '0', label: 'All' }, { value: '1', label: 'To receive' }, { value: '2', label: 'To pay' }, { value: '3', label: 'Customers' }, { value: '4', label: 'Suppliers' }], state.filter);
      filt.addEventListener('change', () => { state.filter = filt.value; state.page = 1; paint(); });

      c.appendChild(el('div', { class: 'toolbar mb16' }, [
        el('div', { class: 'fld grow' }, [search]),
        el('button', { class: 'btn btn-blue', html: '＋ ' + T('Add Party').toUpperCase(), onclick: () => partyModal() }),
        el('button', { class: 'btn btn-green', text: T('Receive').toUpperCase(), onclick: () => payModal('RECEIVE') }),
        el('button', { class: 'btn btn-oak', text: T('Pay').toUpperCase(), onclick: () => payModal('PAY') }),
        el('div', { class: 'fld' }, [filt]),
        el('button', {
          class: 'btn btn-ghost', html: '⬇ ' + T('Report'), onclick: () => {
            const rows = M.parties().map(p => [p.name, p.ptype, p.phone || '', p.gst || '', M.partyBalance(p.id), M.partyBalance(p.id) >= 0 ? 'To receive' : 'To pay']);
            U.exportXLS('oakcraft-parties', 'Parties', ['Party', 'Type', 'Phone', 'GST', 'Balance', 'Balance type'], rows);
          }
        })
      ]));

      const host = el('div'); c.appendChild(host);
      state.rerender = paint; paint();

      function paint() {
        let rows = M.parties();
        if (state.q) { const q = U.deaccent(state.q); rows = rows.filter(p => U.deaccent(p.name).indexOf(q) >= 0 || U.deaccent(p.phone).indexOf(q) >= 0); }
        if (state.filter === '1') rows = rows.filter(p => M.partyBalance(p.id) > 0);
        if (state.filter === '2') rows = rows.filter(p => M.partyBalance(p.id) < 0);
        if (state.filter === '3') rows = rows.filter(p => p.ptype === 'Customer');
        if (state.filter === '4') rows = rows.filter(p => p.ptype === 'Supplier');
        rows = U.sortBy(rows, p => U.deaccent(p.name));
        host.innerHTML = '';
        host.appendChild(UI.paginate(rows, state, slice => UI.table([
          {
            h: T('Party Name'), render: p => el('div', { class: 'cellname' }, [
              el('div', { class: 'thumb', style: { background: U.colorFor(p.name) }, text: U.initials(p.name) }),
              el('div', {}, [el('b', { text: p.name }), el('small', { text: p.ptype })])
            ])
          },
          { h: T('Phone number'), render: p => U.esc(p.phone || '—') },
          { h: T('Balance'), cls: 'num', render: p => U.money(Math.abs(M.partyBalance(p.id))) },
          { h: T('Balance Type'), render: p => { const b = M.partyBalance(p.id); return b >= 0 ? '<span class="green b">Receivable</span>' : '<span class="red b">Payable</span>'; } },
          {
            h: 'Receive-In / Paid-Out', cls: 'center', render: p => el('div', { class: 'flex gap6 jc' }, [
              el('button', { class: 'btn btn-xs', style: { border: '1px solid var(--green)', color: 'var(--green)' }, text: T('Receive'), onclick: () => payModal('RECEIVE', p.id) }),
              el('button', { class: 'btn btn-xs', style: { border: '1px solid var(--red)', color: 'var(--red)' }, text: T('Pay'), onclick: () => payModal('PAY', p.id) })
            ])
          },
          {
            h: T('Action'), cls: 'center', render: p => UI.rowMenu([
              { label: 'Full details', icon: '👁', onClick: () => ledgerModal(p.id) },
              { label: T('Edit'), icon: '✏️', onClick: () => partyModal(p.id) },
              { label: 'New sale bill', icon: '🧾', onClick: () => App.go('doc', { id: 'new', type: 'SALE', party: p.id }) },
              {
                label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
                  if (await UI.confirm('Delete party “' + p.name + '”? Their bills stay, but the party record is removed.', { danger: true, ok: 'Delete' })) { DB.remove('parties', p.id); UI.toast(T('Deleted'), 'ok'); App.refresh(); }
                }
              }
            ])
          }
        ], slice, {
          empty: 'No parties yet — add your first customer or supplier.',
          emptyAction: el('button', { class: 'btn btn-p mt14', text: '＋ ' + T('Add Party'), onclick: () => partyModal() })
        })));
      }
    }
  });

  w.PartyPage = { partyModal, payModal, ledgerModal };
})(window);
