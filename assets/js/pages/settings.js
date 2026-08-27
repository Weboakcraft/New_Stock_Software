/* Pages — Members, Categories, Stores, Bill setting, Profile, Sync & backup */
(function (w) {
  'use strict';
  const U = w.U, el = U.el, T = w.T, DB = w.DB, M = w.M, UI = w.UI, App = w.App, API = w.API, Sync = w.Sync;

  /* ================================================================ members */
  const ROLES = [
    { value: 'admin', label: 'Store Admin', perms: ['Full access to every screen', 'Add / edit / delete products and parties', 'Create and delete bills', 'See profit, reports and settings'] },
    { value: 'operator', label: 'Sale & Purchase Operator', perms: ['View opening stock and remaining stock of all items', 'Add sale entry and stock-out entry', 'Add a new party', 'View added sale bills and share them to the party'] },
    { value: 'viewer', label: 'View only', perms: ['See stock, bills and reports', 'Cannot add, edit or delete anything'] }
  ];
  App.page('members', {
    title: 'Member All Management', crumb: 'Pages / Member Management',
    render(c) {
      const search = UI.input({ placeholder: 'Search members here! 🔍' });
      const host = el('div');
      c.appendChild(el('div', { class: 'toolbar mb16' }, [
        el('div', { class: 'fld grow' }, [search]),
        el('button', { class: 'btn btn-blue', text: '＋ ADD MEMBER', onclick: () => memberModal() })
      ]));
      c.appendChild(host);
      search.addEventListener('input', U.debounce(paint, 200));
      paint();
      function paint() {
        const q = U.deaccent(search.value);
        const rows = DB.all('members').filter(m => !q || U.deaccent(m.name).indexOf(q) >= 0 || U.deaccent(m.email).indexOf(q) >= 0);
        host.innerHTML = '';
        host.appendChild(UI.table([
          {
            h: 'Member', render: m => el('div', { class: 'cellname' }, [
              el('div', { class: 'thumb', style: { background: U.colorFor(m.name) }, text: U.initials(m.name) }),
              el('div', {}, [el('b', { text: m.name }), el('small', { text: m.email || '' })])
            ])
          },
          { h: 'Phone', render: m => U.esc(m.phone || '—') },
          { h: 'Store', render: m => U.esc((DB.get('stores', m.storeId) || {}).name || '—') },
          { h: 'Member type', render: m => '<span class="badge b-blue">' + U.esc((ROLES.find(r => r.value === m.role) || {}).label || m.role) + '</span>' },
          {
            h: T('Action'), cls: 'center', render: m => UI.rowMenu([
              { label: T('Edit'), icon: '✏️', onClick: () => memberModal(m.id) },
              { label: T('Delete'), icon: '🗑', danger: true, onClick: async () => { if (await UI.confirm('Remove ' + m.name + '?', { danger: true, ok: 'Remove' })) { DB.remove('members', m.id); App.refresh(); } } }
            ])
          }
        ], rows, { empty: 'No staff members added yet.', emptyAction: el('button', { class: 'btn btn-p mt14', text: '＋ Add member', onclick: () => memberModal() }) }));
      }
      function memberModal(id) {
        const m0 = id ? DB.get('members', id) : null;
        const name = UI.input({ value: m0 ? m0.name : '', placeholder: 'Enter name' });
        const email = UI.input({ type: 'email', value: m0 ? m0.email : '', placeholder: 'Enter email' });
        const phone = UI.input({ type: 'tel', value: m0 ? m0.phone : '', placeholder: 'Enter phone number' });
        const store = UI.select(M.stores().map(s => ({ value: s.id, label: s.name })), m0 ? m0.storeId : M.currentStoreId());
        const role = UI.select(ROLES.map(r => ({ value: r.value, label: r.label })), m0 ? m0.role : 'operator');
        const perms = el('div', { class: 'card card-pad', style: { background: 'var(--sunk)' } });
        function paintPerms() {
          const r = ROLES.find(x => x.value === role.value);
          perms.innerHTML = '<b class="green">' + U.esc(r.label) + ' permissions</b><ul style="margin:8px 0 0 18px;padding:0;font-size:13px;line-height:1.7">' +
            r.perms.map(p => '<li>' + U.esc(p) + '</li>').join('') + '</ul>';
        }
        role.addEventListener('change', paintPerms); paintPerms();
        const mm = UI.modal({
          title: 'Fill the member details', size: 'wide',
          body: el('div', { class: 'grid g2' }, [
            el('div', { class: 'frm' }, [
              UI.field('Staff name', name, { req: true }),
              UI.row(2, [UI.field('Email', email, { req: true }), UI.field('Phone', phone, { req: true })]),
              UI.row(2, [UI.field('Select store', store, { req: true }), UI.field('Member type', role, { req: true })])
            ]), perms
          ]),
          buttons: [
            { label: T('Cancel'), cls: 'btn-ghost', onClick: () => mm.close() },
            {
              label: T('Save'), cls: 'btn-p', onClick: () => {
                if (!name.value.trim()) { UI.toast('Name is required', 'err'); return; }
                DB.put('members', { id: m0 ? m0.id : undefined, name: name.value.trim(), email: email.value.trim(), phone: phone.value.trim(), storeId: store.value, role: role.value });
                mm.close(); UI.toast(T('Saved'), 'ok'); App.refresh();
              }
            }
          ]
        });
      }
    }
  });

  /* ================================================================ simple list pages */
  function simpleList(route, opts) {
    App.page(route, {
      title: opts.title, crumb: opts.crumb,
      render(c) {
        const search = UI.input({ placeholder: opts.searchPh });
        const host = el('div');
        c.appendChild(el('div', { class: 'toolbar mb16' }, [
          el('div', { class: 'fld grow' }, [search]),
          el('button', { class: 'btn btn-blue', text: '＋ ' + opts.addLabel, onclick: () => form() })
        ]));
        c.appendChild(host);
        search.addEventListener('input', U.debounce(paint, 200)); paint();
        function paint() {
          const q = U.deaccent(search.value);
          const rows = U.sortBy(DB.all(opts.table).filter(r => !q || U.deaccent(r.name).indexOf(q) >= 0), r => U.deaccent(r.name));
          host.innerHTML = '';
          host.appendChild(UI.table(opts.cols(form), rows, { empty: opts.empty, emptyAction: el('button', { class: 'btn btn-p mt14', text: '＋ ' + opts.addLabel, onclick: () => form() }) }));
        }
        function form(id) { opts.form(id, () => { App.refresh(); }); }
      }
    });
  }

  simpleList('categories', {
    title: 'Management All Category', crumb: 'Pages / Category Management', table: 'categories',
    searchPh: 'Search category here! 🔍', addLabel: 'ADD CATEGORY', empty: 'No categories yet.',
    cols: form => [
      { h: 'Category name', render: r => '<b>' + U.esc(r.name) + '</b>' },
      { h: 'Products', cls: 'num', render: r => String(M.products().filter(p => p.categoryId === r.id).length) },
      {
        h: T('Action'), cls: 'center', render: r => UI.rowMenu([
          { label: T('Edit'), icon: '✏️', onClick: () => form(r.id) },
          {
            label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
              const n = M.products().filter(p => p.categoryId === r.id).length;
              if (await UI.confirm('Delete category “' + r.name + '”?' + (n ? ' ' + n + ' product(s) will lose their category.' : ''), { danger: true, ok: 'Delete' })) { DB.remove('categories', r.id); App.refresh(); }
            }
          }
        ])
      }
    ],
    form: async (id, done) => {
      const cur = id ? DB.get('categories', id) : null;
      const v = await UI.prompt('Category name', cur ? cur.name : '', { title: cur ? 'Edit category' : 'Add category' });
      if (!v) return;
      DB.put('categories', { id: cur ? cur.id : undefined, name: v });
      UI.toast(T('Saved'), 'ok'); done();
    }
  });

  simpleList('stores', {
    title: 'Management All Store', crumb: 'Pages / Store Management', table: 'stores',
    searchPh: 'Search store here! 🔍', addLabel: 'ADD STORE', empty: 'No stores yet.',
    cols: form => [
      { h: 'Store name', render: r => '<b>' + U.esc(r.name) + '</b>' },
      { h: 'Address', render: r => U.esc(r.address || '—') },
      { h: 'Created by', render: r => U.esc(r.createdBy || 'Admin') },
      { h: 'Products', cls: 'num', render: r => String(DB.all('products').filter(p => p.storeId === r.id).length) },
      {
        h: T('Action'), cls: 'center', render: r => UI.rowMenu([
          { label: T('Edit'), icon: '✏️', onClick: () => form(r.id) },
          { label: 'Switch to this store', icon: '🔀', onClick: () => { M.setStore(r.id); UI.toast('Switched to ' + r.name, 'ok'); App.refresh(); } },
          {
            label: T('Delete'), icon: '🗑', danger: true, onClick: async () => {
              if (M.stores().length < 2) { UI.toast('You need at least one store', 'err'); return; }
              if (await UI.confirm('Delete store “' + r.name + '”? Its products stay but become unassigned.', { danger: true, ok: 'Delete' })) { DB.remove('stores', r.id); M.currentStoreId(); App.refresh(); }
            }
          }
        ])
      }
    ],
    form: (id, done) => {
      const cur = id ? DB.get('stores', id) : null;
      const name = UI.input({ value: cur ? cur.name : '' });
      const addr = UI.textarea({ value: cur ? cur.address : '' });
      const m = UI.modal({
        title: cur ? 'Edit store' : 'Add store', size: 'narrow',
        body: el('div', { class: 'frm' }, [UI.field('Store name', name, { req: true }), UI.field('Address', addr)]),
        buttons: [
          { label: T('Cancel'), cls: 'btn-ghost', onClick: () => m.close() },
          { label: T('Save'), cls: 'btn-p', onClick: () => { if (!name.value.trim()) return; DB.put('stores', { id: cur ? cur.id : undefined, name: name.value.trim(), address: addr.value.trim(), createdBy: M.settings().ownerName }); m.close(); UI.toast(T('Saved'), 'ok'); done(); } }
        ]
      });
    }
  });

  /* ================================================================ bill / invoice setting */
  App.page('billsetting', {
    title: 'Bill / Invoice Setting', crumb: 'Pages / Settings',
    render(c) {
      const s = M.settings();
      const draft = Object.assign({}, s);
      const preview = el('div', { style: { background: '#fff', borderRadius: '12px', padding: '10px', overflow: 'auto', maxHeight: '78vh', border: '1px solid var(--border)' } });

      function repaint() {
        const sample = sampleDoc();
        preview.innerHTML = w.BillPrint.html(sample, { theme: draft.billTheme, colour: draft.billColour });
      }
      function sampleDoc() {
        /* build a throw-away in-memory doc for the live preview */
        const id = '__preview__';
        const items = M.products().slice(0, 3);
        const rows = (items.length ? items : [{ name: 'OC-511 High Back Chair', hsn: '9403', saleRate: 4250, unit: 'Piece', gstRate: 18, mrp: 4999, colour: 'Black' },
        { name: 'OC-208 Visitor Chair', hsn: '9403', saleRate: 2100, unit: 'Piece', gstRate: 18, mrp: 2600, colour: 'Grey' }])
          .map((p, i) => ({ id: 'pi' + i, docId: id, seq: i + 1, productId: p.id || '', name: p.name, hsn: p.hsn || '9403', qty: i + 2, unit: p.unit || 'Piece', price: U.n(p.saleRate) || 2500, gstMode: 'ex', gstRate: U.n(p.gstRate) || 18, mrp: U.n(p.mrp), colour: p.colour || '', brand: 'OAKCRAFT', size: '' }));
        const d = {
          id, dtype: 'SALE', number: 'INV-0001', at: U.now(), partyId: '', partyName: 'Rajesh Kumar',
          partyAddr: '520, 2nd floor, Main Street, Vijay Nagar, Delhi', partyPhone: '99810 28177', partyGst: '07AAAAA0000A1Z5',
          partyState: 'Delhi', charges: [{ name: 'Freight', amount: 900, gst: 18 }], discountMode: 'flat', discountValue: 500,
          received: 5000, payMode: 'Cash', terms: draft.terms, remark: '', storeId: M.currentStoreId(), interState: false
        };
        Object.assign(d, M.calcDoc(d, rows));
        /* temporarily register so BillPrint can read it */
        DB.data.docs.push(d); rows.forEach(r => DB.data.docitems.push(r));
        setTimeout(() => {
          DB.data.docs = DB.data.docs.filter(x => x.id !== id);
          DB.data.docitems = DB.data.docitems.filter(x => x.docId !== id);
        }, 0);
        const old = M.doc; M.doc = x => x === id ? d : old(x);
        const oldI = M.docItems; M.docItems = x => x === id ? rows : oldI(x);
        setTimeout(() => { M.doc = old; M.docItems = oldI; }, 0);
        return id;
      }

      /* ---- controls ---- */
      const COLOURS = ['#111111', '#1e8e5a', '#e07b18', '#2f6fed', '#d6455f', '#e3b418', '#8a9a1f', '#2ecc71', '#3f7fb5', '#6b4ce6', '#6b6b6b', '#e02020'];
      const swatches = el('div', { class: 'flex gap10 wrap jc' });
      COLOURS.forEach(col => swatches.appendChild(el('button', {
        style: { width: '30px', height: '30px', borderRadius: '50%', border: '2px solid var(--border)', background: col, cursor: 'pointer' },
        onclick: () => { draft.billColour = col; custom.value = col; repaint(); }
      })));
      const custom = el('input', { type: 'color', value: draft.billColour, class: 'inp', style: { height: '38px', padding: '3px' } });
      custom.addEventListener('input', () => { draft.billColour = custom.value; repaint(); });

      const themeSel = UI.select(w.BillPrint.THEMES.map(t => ({ value: t.key, label: t.label })), draft.billTheme);
      themeSel.addEventListener('change', () => { draft.billTheme = themeSel.value; repaint(); });

      const thermalSw = UI.switchBox('Thermal bill print', draft.thermal, v => { draft.thermal = v; thermalW.style.display = v ? '' : 'none'; repaint(); });
      const thermalW = el('div', { class: 'radio-grp mt8' });
      ['2', '3', '4'].forEach(x => {
        const r = el('input', { type: 'radio', name: 'thw' }); r.checked = draft.thermalWidth === x;
        r.addEventListener('change', () => { draft.thermalWidth = x; repaint(); });
        thermalW.appendChild(el('label', { class: 'check' }, [r, el('span', { text: x + ' inch' })]));
      });
      thermalW.style.display = draft.thermal ? '' : 'none';

      function imgPicker(key, label) {
        const box = el('div', { style: { width: '92px', height: '62px', border: '1px dashed var(--border-2)', borderRadius: '10px', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', background: 'var(--sunk)' } });
        const f = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        function paint() { box.innerHTML = draft[key] ? '<img src="' + draft[key] + '" style="max-width:100%;max-height:100%;object-fit:contain">' : '<span style="opacity:.5">＋</span>'; }
        paint();
        box.addEventListener('click', () => f.click());
        f.addEventListener('change', async () => { if (f.files[0]) { draft[key] = await U.shrinkImage(f.files[0], 320, .9); paint(); repaint(); } });
        return el('div', {}, [
          el('div', { class: 'small muted mb10', text: label }),
          el('div', { class: 'flex gap10 ac' }, [box, f, el('button', { class: 'btn btn-xs btn-ghost', text: '✕ Remove', onclick: () => { draft[key] = ''; paint(); repaint(); } })])
        ]);
      }

      const colToggles = el('div', { class: 'flex gap10 wrap' });
      w.DocPages.EXTRA_COLS.forEach(x => {
        const on = (draft.extraCols || []).indexOf(x.key) >= 0;
        const b = el('button', { class: 'chip' + (on ? ' on' : ''), text: x.label });
        b.addEventListener('click', () => {
          draft.extraCols = draft.extraCols || [];
          const i = draft.extraCols.indexOf(x.key);
          if (i >= 0) draft.extraCols.splice(i, 1); else draft.extraCols.push(x.key);
          b.classList.toggle('on'); repaint();
        });
        colToggles.appendChild(b);
      });
      const customColIn = UI.input({ placeholder: 'Custom column name' });
      const customColList = el('div', { class: 'flex gap6 wrap mt8' });
      function paintCustom() {
        customColList.innerHTML = '';
        (draft.customCols || []).forEach((n, i) => customColList.appendChild(el('span', { class: 'badge b-grey' }, [n + ' ', el('button', { style: { border: 0, background: 'none', cursor: 'pointer' }, text: '✕', onclick: () => { draft.customCols.splice(i, 1); paintCustom(); repaint(); } })])));
      }
      paintCustom();

      const F = {};
      ['bizName', 'gstin', 'pan', 'udyam', 'address', 'state', 'phone', 'email', 'website', 'billTitle', 'slogan',
        'bankHolder', 'bankAc', 'bankName', 'bankBranch', 'bankIfsc', 'upi', 'defHsn'].forEach(k => {
          F[k] = UI.input({ value: draft[k] || '' });
          F[k].addEventListener('input', U.debounce(() => { draft[k] = F[k].value; repaint(); }, 250));
        });
      F.terms = UI.textarea({ value: draft.terms || '', style: { minHeight: '110px' } });
      F.terms.addEventListener('input', U.debounce(() => { draft.terms = F.terms.value; repaint(); }, 300));

      const left = el('div', { class: 'card', style: { maxHeight: '78vh', overflowY: 'auto' } }, [
        el('div', { class: 'card-h', style: { position: 'sticky', top: 0, background: 'var(--oak-700)', color: '#fff', zIndex: 3 } }, [el('h3', { text: 'Customize your bill / invoice' })]),
        el('div', { class: 'card-pad frm' }, [
          UI.sect('Bill colour'), swatches, UI.field('Custom colour', custom),
          UI.sect('Bill format'), UI.field('Theme', themeSel), thermalSw, thermalW,
          UI.sect('Logo & signature'),
          el('div', { class: 'flex gap14 wrap' }, [imgPicker('logo', 'Upload your logo'), imgPicker('signature', 'Upload your signature')]),
          UI.sect('Business details'),
          UI.row(2, [UI.field('Business name', F.bizName), UI.field('Invoice title', F.billTitle)]),
          UI.field('Address', el('div', {}, [F.address])),
          UI.row(3, [UI.field('GSTIN', F.gstin), UI.field('PAN', F.pan), UI.field('Udyam / MSME', F.udyam)]),
          UI.row(3, [UI.field('Phone', F.phone), UI.field('Email', F.email), UI.field('Website', F.website)]),
          UI.row(2, [UI.field('State (place of supply)', F.state), UI.field('Default HSN', F.defHsn)]),
          UI.field('Slogan on bill', F.slogan),
          UI.sect('Bank details & UPI'),
          UI.switchBox('Show bank details on bill', draft.showBank, v => { draft.showBank = v; repaint(); }),
          UI.row(2, [UI.field('Account holder', F.bankHolder), UI.field('Account number', F.bankAc)]),
          UI.row(3, [UI.field('Bank name', F.bankName), UI.field('Branch', F.bankBranch), UI.field('IFSC', F.bankIfsc)]),
          UI.field('UPI ID', F.upi),
          UI.switchBox('Show UPI QR on bill', draft.showUpiQr, v => { draft.showUpiQr = v; repaint(); }),
          UI.sect('Signatures'),
          UI.switchBox('Show business signature', draft.showSign, v => { draft.showSign = v; repaint(); }),
          UI.switchBox('Show customer signature', draft.showCustomerSign, v => { draft.showCustomerSign = v; repaint(); }),
          UI.sect('Billing — customize product table'),
          UI.switchBox('Show MRP column on bill', draft.showMRP, v => { draft.showMRP = v; repaint(); }),
          UI.switchBox('Show product image on bill 🖼️', draft.showImage, v => { draft.showImage = v; repaint(); }),
          UI.switchBox('Show product description on bill', draft.showDesc, v => { draft.showDesc = v; repaint(); }),
          el('div', { class: 'small muted' }, ['Extra columns that appear on the bill and in the bill builder:']),
          colToggles,
          el('div', { class: 'flex gap6' }, [customColIn, el('button', { class: 'btn btn-sm btn-ghost', text: 'Add column', onclick: () => { const v = customColIn.value.trim(); if (!v) return; draft.customCols = (draft.customCols || []).concat([v]); customColIn.value = ''; paintCustom(); repaint(); } })]),
          customColList,
          UI.sect('Terms & conditions'), F.terms,
          el('div', { class: 'flex gap10 mt14' }, [
            el('button', { class: 'btn btn-ghost btn-block', text: 'Reset to defaults', onclick: async () => { if (await UI.confirm('Reset all bill settings to the Oakcraft defaults?')) { M.saveSettings(M.DEFAULTS); UI.toast('Reset', 'ok'); App.refresh(); } } }),
            el('button', { class: 'btn btn-p btn-block', text: 'SAVE CHANGES', onclick: () => { M.saveSettings(draft); UI.toast('Bill settings saved', 'ok'); App.refresh(); } })
          ])
        ])
      ]);

      c.appendChild(el('div', { class: 'split-wide' }, [left, preview]));
      repaint();
    }
  });

  /* ================================================================ profile */
  App.page('profile', {
    title: 'Manage Your Profile', crumb: 'Pages / Profile',
    render(c) {
      const s = M.settings();
      const F = {};
      ['ownerName', 'phone', 'email', 'bizName', 'legalName', 'bizType', 'bizCategory', 'gstin', 'pan', 'udyam', 'address', 'state', 'website'].forEach(k => F[k] = UI.input({ value: s[k] || '' }));
      c.appendChild(el('div', { class: 'card', style: { overflow: 'hidden' } }, [
        el('div', { style: { height: '150px', background: 'linear-gradient(120deg,var(--oak-600),var(--oak-800) 60%,var(--gold-600))' } }),
        el('div', { class: 'card-pad', style: { marginTop: '-46px' } }, [
          el('div', { class: 'flex ac gap14 wrap' }, [
            el('div', { class: 'thumb', style: { width: '76px', height: '76px', fontSize: '26px', border: '4px solid var(--card)', background: '#fff' }, html: s.logo ? '<img src="' + s.logo + '">' : U.initials(s.bizName) }),
            el('div', { class: 'sp' }, [el('h2', { text: s.ownerName || 'Admin' }), el('div', { class: 'small muted', text: s.ownerRole })]),
            el('button', { class: 'btn btn-p', text: 'Save profile', onclick: save })
          ])
        ])
      ]));
      c.appendChild(el('div', { class: 'grid g2 mt14' }, [
        el('div', { class: 'card card-pad frm' }, [
          UI.sect('Profile information'),
          UI.field('Full name', F.ownerName), UI.row(2, [UI.field('Mobile', F.phone), UI.field('Email', F.email)]),
          UI.field('Website', F.website)
        ]),
        el('div', { class: 'card card-pad frm' }, [
          UI.sect('Business details'),
          UI.field('Business name', F.bizName), UI.field('Legal name', F.legalName),
          UI.row(2, [UI.field('Business type', F.bizType), UI.field('Business category', F.bizCategory)]),
          UI.row(3, [UI.field('GSTIN', F.gstin), UI.field('PAN', F.pan), UI.field('Udyam', F.udyam)]),
          UI.field('Address', F.address), UI.field('State', F.state)
        ])
      ]));
      function save() {
        const patch = {}; Object.keys(F).forEach(k => patch[k] = F[k].value.trim());
        M.saveSettings(patch); UI.toast('Profile saved', 'ok'); App.refresh();
      }
    }
  });

  /* ================================================================ sync & backup */
  App.page('sync', {
    title: 'Sync & Backup', crumb: 'Pages / Settings',
    render(c) {
      const url = UI.input({ value: DB.getMeta('gasUrl', ''), placeholder: 'https://script.google.com/macros/s/AKfycb.../exec' });
      const token = UI.input({ value: DB.getMeta('gasToken', ''), placeholder: 'A secret word you choose (same as in the script)' });
      const status = el('div', { class: 'small muted' });

      function paintStatus() {
        const last = DB.getMeta('lastSyncAt', '');
        status.innerHTML = API.configured()
          ? 'Connected · last sync ' + (last ? U.ago(last) : 'never') + ' · <b>' + Sync.pendingCount() + '</b> record(s) waiting to upload' +
          (Sync.lastError ? '<br><span class="red">' + U.esc(Sync.lastError) + '</span>' : '')
          : 'Not connected — data is saved on this device only.';
      }
      paintStatus(); Sync.on(paintStatus);

      const steps = el('ol', { style: { margin: '0 0 0 18px', padding: 0, lineHeight: '1.85', fontSize: '13.5px' } });
      [
        'Open <b>sheets.google.com</b> and create a new blank spreadsheet. Name it <b>Oakcraft Stock Data</b>.',
        'In that sheet choose <b>Extensions → Apps Script</b>.',
        'Delete whatever code is there, then paste the Oakcraft script (button below) and press <b>Save</b>.',
        'Near the top of the script set <code>TOKEN</code> to a secret word of your choice.',
        'Click <b>Deploy → New deployment → Web app</b>. Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>. Click Deploy and allow the permissions.',
        'Copy the <b>Web app URL</b> (it ends in <code>/exec</code>) and paste it below with the same secret word, then press <b>Connect</b>.'
      ].forEach(t => steps.appendChild(el('li', { html: t })));

      async function copyScript() {
        try {
          const code = w.__OC_GAS_CODE__ || await (await fetch('./gas/Code.gs', { cache: 'no-store' })).text();
          try { await navigator.clipboard.writeText(code); UI.toast('Script copied — paste it into Apps Script', 'ok', 3400); }
          catch (e) {
            UI.modal({ title: 'Apps Script code — select all and copy', size: 'wide', body: el('textarea', { class: 'inp', style: { minHeight: '58vh', fontFamily: 'var(--mono)', fontSize: '11px' }, text: code }) });
          }
        } catch (e) { UI.toast('Could not load the script file (are you offline?)', 'err'); }
      }

      if (w.__OC_PREVIEW__) {
        c.appendChild(el('div', {
          class: 'card card-pad mb16',
          style: { borderLeft: '4px solid var(--amber)', background: 'var(--amber-bg)' }
        }, [
          el('b', { text: 'Google Sheet sync is switched off in this preview copy' }),
          el('div', { class: 'small mt8', html: 'This page is a shared preview, and the browser blocks it from calling Google. Everything else works, and what you type is saved in this browser. Publish the app to GitHub Pages (or install the APK) and the sync below connects normally.' })
        ]));
      }
      c.appendChild(el('div', { class: 'grid g2' }, [
        el('div', { class: 'card card-pad frm' }, [
          UI.sect('Google Sheet backend'),
          el('p', { class: 'small muted', html: 'Your data lives in <b>your own Google Sheet</b>. Nothing is sent anywhere else. Every device that has this same URL and secret word stays in sync.' }),
          steps,
          el('div', { class: 'flex gap10 wrap mt8' }, [
            el('button', { class: 'btn btn-ghost', html: '📋 Copy the Apps Script code', onclick: copyScript }),
            el('a', { class: 'btn btn-ghost', href: 'https://sheets.new', target: '_blank', rel: 'noopener', html: '↗ New Google Sheet' })
          ]),
          UI.field('Web app URL', url, { req: true }),
          UI.field('Secret word (TOKEN)', token),
          el('div', { class: 'flex gap10 wrap' }, [
            el('button', {
              class: 'btn btn-p', text: 'Connect & test', onclick: async e => {
                const b = e.target; b.disabled = true; b.textContent = 'Testing…';
                await DB.setMeta('gasUrl', url.value.trim()); await DB.setMeta('gasToken', token.value.trim());
                try {
                  await API.ping();
                  await API.setup();
                  UI.toast('Connected — sheet structure ready', 'ok');
                  await Sync.pullAll(); await Sync.run({ loud: true });
                } catch (err) { UI.toast(err.message, 'err', 5200); }
                b.disabled = false; b.textContent = 'Connect & test'; paintStatus();
              }
            }),
            el('button', { class: 'btn btn-ghost', text: '⟳ Sync now', onclick: () => Sync.run({ loud: true }).then(paintStatus) }),
            el('button', { class: 'btn btn-ghost', text: '⬇ Re-download everything', onclick: async () => { try { await Sync.pullAll(); UI.toast('Downloaded from the sheet', 'ok'); } catch (e2) { UI.toast(e2.message, 'err'); } } }),
            el('button', { class: 'btn btn-ghost', text: '✕ Disconnect', onclick: async () => { if (await UI.confirm('Disconnect the Google Sheet? Local data stays on this device.')) { await DB.setMeta('gasUrl', ''); await DB.setMeta('gasToken', ''); App.refresh(); } } })
          ]),
          status
        ]),
        el('div', {}, [
          el('div', { class: 'card card-pad frm mb16' }, [
            UI.sect('Backup file'),
            el('p', { class: 'small muted', text: 'A single .json file with everything — products, parties, bills, stock history and settings. Keep one before big changes.' }),
            el('div', { class: 'flex gap10 wrap' }, [
              el('button', { class: 'btn btn-oak', html: '⬇ Download backup', onclick: () => U.download('oakcraft-stock-backup-' + U.isoDate(new Date()) + '.json', JSON.stringify(DB.exportAll()), 'application/json') }),
              el('button', { class: 'btn btn-ghost', html: '⬆ Restore from backup', onclick: restore })
            ])
          ]),
          el('div', { class: 'card card-pad frm mb16' }, [
            UI.sect('Export data'),
            el('div', { class: 'flex gap10 wrap' }, [
              el('button', { class: 'btn btn-ghost btn-sm', text: 'Products → Excel', onclick: () => U.exportXLS('oakcraft-products', 'Products', ['Name', 'Category', 'Unit', 'Buy rate', 'Sale rate', 'MRP', 'HSN', 'GST %', 'Barcode', 'Available'], M.products().map(p => [p.name, M.categoryName(p.categoryId), p.unit, U.n(p.buyRate), U.n(p.saleRate), U.n(p.mrp), p.hsn, U.n(p.gstRate), p.barcode, M.available(p.id)])) }),
              el('button', { class: 'btn btn-ghost btn-sm', text: 'Parties → Excel', onclick: () => U.exportXLS('oakcraft-parties', 'Parties', ['Name', 'Type', 'Phone', 'GST', 'Balance'], M.parties().map(p => [p.name, p.ptype, p.phone, p.gst, M.partyBalance(p.id)])) }),
              el('button', { class: 'btn btn-ghost btn-sm', text: 'Bills → Excel', onclick: () => U.exportXLS('oakcraft-bills', 'Bills', ['Date', 'Type', 'Number', 'Party', 'Total', 'Received', 'Due', 'Status'], M.docs().map(d => [U.fmtDT(d.at), M.DOC[d.dtype].short, d.number, d.partyName, U.n(d.total), U.n(d.received), U.n(d.due), d.status])) })
            ])
          ]),
          el('div', { class: 'card card-pad frm' }, [
            UI.sect('App'),
            el('div', { class: 'small muted', html: 'Version 1.0 · ' + (navigator.onLine ? '<span class="green">online</span>' : '<span class="red">offline</span>') + ' · ' + DB.all('products').length + ' products, ' + DB.all('docs').length + ' bills, ' + DB.all('moves').length + ' stock entries' }),
            el('div', { class: 'flex gap10 wrap mt8' }, [
              el('button', { class: 'btn btn-ghost btn-sm', text: '⟳ Check for update', onclick: async () => { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.update())); } UI.toast('Reloading with the newest version…', 'ok'); setTimeout(() => location.reload(true), 700); } }),
              el('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--red)' }, text: '⚠ Erase all data on this device', onclick: async () => { if (await UI.confirm('This erases every product, party and bill stored on THIS device. If a Google Sheet is connected the data there is untouched and will download again. Continue?', { danger: true, ok: 'Erase' })) { await DB.wipe(); await DB.setMeta('seeded', 0); location.reload(); } } })
            ])
          ])
        ])
      ]));

      function restore() {
        const f = el('input', { type: 'file', accept: '.json,application/json' });
        const mode = UI.select([{ value: 'merge', label: 'Merge with what is here' }, { value: 'replace', label: 'Replace everything' }], 'merge');
        const m = UI.modal({
          title: 'Restore from backup', size: 'narrow',
          body: el('div', { class: 'frm' }, [UI.field('Backup file (.json)', f), UI.field('How', mode)]),
          buttons: [
            { label: 'Cancel', cls: 'btn-ghost', onClick: () => m.close() },
            {
              label: 'Restore', cls: 'btn-p', onClick: async () => {
                if (!f.files[0]) { UI.toast('Choose a file', 'err'); return; }
                try {
                  const obj = JSON.parse(await U.readFile(f.files[0]));
                  await DB.importAll(obj, mode.value);
                  m.close(); UI.toast('Backup restored', 'ok'); setTimeout(() => location.reload(), 800);
                } catch (e) { UI.toast(e.message || 'That file could not be read', 'err'); }
              }
            }
          ]
        });
      }
    }
  });
})(window);
