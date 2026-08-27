/* Oakcraft Stock — first-run seed (categories + store + company profile) */
(function (w) {
  'use strict';
  const DB = w.DB, M = w.M, U = w.U;
  const CATEGORIES = ['Recliner', 'KBC', 'Chair', 'Barstool', 'Assistant Chair', 'Bedroom Chair',
    'Highback', 'Vanity Chair', 'Visitor Chairs', 'Low Back', 'Mid Back', 'Sofa', 'Table', 'Return'];

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  const Seed = {
    ensure() {
      if (DB.getMeta('seeded')) return;
      if (!DB.all('stores').length) {
        DB.put('stores', { id: 'store_main', name: 'Oakcraft Main Store', address: M.DEFAULTS.address, createdBy: 'Admin' });
        DB.setMeta('storeId', 'store_main');
      }
      if (!DB.all('categories').length) {
        /* Deterministic ids so two devices that both seed themselves end up with
           the SAME category rows once they sync, instead of duplicates. */
        CATEGORIES.forEach(name => DB.put('categories', { id: 'cat_' + slug(name), name }));
      }
      if (!DB.all('settings').length) M.saveSettings({});
      DB.setMeta('seeded', 1);
    },
    CATEGORIES
  };
  w.Seed = Seed;
})(window);
