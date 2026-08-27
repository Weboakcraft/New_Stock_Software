/* Oakcraft Stock — bilingual labels (English / Hinglish) */
(function (w) {
  'use strict';
  const DICT = {
    en: {}, // English is the key itself
    hi: {
      'Dashboard': 'Dashboard', 'Party': 'Party', 'Stock': 'Stock', 'All Entry & Bills': 'Saare Entry & Bill',
      'Sale': 'Sale', 'Purchase': 'Purchase', 'Transaction': 'Lene-Den', 'Rate List': 'Rate List',
      'Barcode Generator': 'Barcode Banaye', 'All Reports': 'Saare Report', 'Settings': 'Setting',
      'Member management': 'Member Manage', 'Category management': 'Category Manage',
      'Store management': 'Store Manage', 'Bill / Invoice Setting': 'Bill / Invoice Setting',
      'Profile': 'Profile', 'Sync & Backup': 'Sync aur Backup',
      'Sale Invoice': 'Sale Bill', 'Quotation': 'Quotation', 'Sale Order': 'Sale Order',
      'Sales Return': 'Sale Wapsi', 'Purchase Invoice': 'Purchase Bill', 'Purchase Order': 'Purchase Order',
      'Purchase Return': 'Purchase Wapsi',
      'Total Product': 'Kul Product', 'Total Quantity': 'Kul Quantity', 'Total Low Stock': 'Kam Stock',
      'Total Expired': 'Expire Ho Gaya', 'Available Product': 'Available Product', 'Added Quantity': 'Judi Quantity',
      'Total Low Product': 'Kam Stock Wale Product', 'Total Expired Product': 'Expire Product',
      'Weekly Sale Qty': 'Hafte Ki Sale', 'Monthly Sale Qty': 'Mahine Ki Sale', 'All Item Stock details': 'Sabhi Item Ka Stock',
      'Product Name': 'Product Ka Naam', 'Opening Stock': 'Shuruati Stock', 'Total IN': 'Kul IN',
      'Total Out': 'Kul OUT', 'Available Stock': 'Available Stock', 'Action': 'Action',
      'Search product here!': 'Product yahan dhundein!', 'Search party here!': 'Party yahan dhundein!',
      'Add Product': 'Product Jode', 'Add Party': 'Party Jode', 'Category': 'Category', 'Filter By': 'Filter',
      'View Details': 'Poori Detail', 'Edit': 'Badle', 'Delete': 'Hataye', 'Save': 'Save Kare',
      'Cancel': 'Cancel', 'Close': 'Band Kare', 'Search': 'Dhundein', 'Report': 'Report',
      'Quantity': 'Quantity', 'Buy Rate': 'Kharid Rate', 'Sale Rate': 'Bikri Rate', 'Remark': 'Remark',
      'In Stock': 'Stock IN', 'Out Stock': 'Stock OUT', 'Receive': 'Lena', 'Pay': 'Dena',
      'Receive Amount': 'Paisa Mila', 'Pay Amount': 'Paisa Diya', 'Payment Mode': 'Payment Ka Tarika',
      'Balance': 'Baki', 'Balance Type': 'Baki Ka Type', 'Phone number': 'Phone Number',
      'Total Amount To Receive': 'Kul Lena Hai', 'Total Amount To Pay': 'Kul Dena Hai',
      'Party Name': 'Party Ka Naam', 'Party Type': 'Party Type', 'Customer': 'Customer', 'Supplier': 'Supplier',
      'Opening Balance': 'Shuruati Balance', 'Bank Account Details': 'Bank Ki Detail',
      'Create Sale / Bill': 'Sale / Bill Banaye', 'Total Sales': 'Kul Sale', 'Total Due Amount': 'Kul Udhaar',
      'Total Received Amount': 'Kul Mila', 'Bill Number': 'Bill Number', 'Billing Date/Time': 'Bill Ki Date/Time',
      'Sub total': 'Sub Total', 'Taxable Amount': 'Taxable Amount', 'Total Amount': 'Kul Amount',
      'Received Amount': 'Mila Amount', 'Due Amount': 'Baki Amount', 'Add Discount': 'Discount Jode',
      'Add Extra Charges': 'Extra Charge Jode', 'Term & Condition': 'Sharte',
      'Low Stock Item': 'Kam Stock Wale Item', 'Expired Stock Item': 'Expire Item',
      'Item Details': 'Item Ki Detail', 'Item Sale Price': 'Item Sale Price', 'Item Purchase Price': 'Item Kharid Price',
      'Item Wise Stock Summary': 'Item Wise Stock Summary', 'Party Wise Sales & Purchase': 'Party Wise Sale & Purchase',
      'No record found': 'Koi record nahi mila', 'Saved': 'Save ho gaya', 'Deleted': 'Hata diya',
      'Synced': 'Sync ho gaya', 'Offline': 'Offline', 'Syncing…': 'Sync ho raha hai…',
      'Store': 'Store', 'Member Type': 'Member Type', 'Staff Name': 'Staff Ka Naam',
      'Bulk Upload': 'Bulk Upload', 'Print': 'Print', 'Download PDF': 'PDF Download', 'Excel': 'Excel',
      'Today': 'Aaj', 'This Week': 'Is Hafte', 'This Month': 'Is Mahine', 'This Year': 'Is Saal',
      'Unit': 'Unit', 'HSN Code': 'HSN Code', 'GST Rate Type': 'GST Rate', 'Expiry Date': 'Expiry Date',
      'Low Stock Warning': 'Low Stock Warning', 'Barcode (Item Code)': 'Barcode (Item Code)',
      'Enter Quantity': 'Quantity Daale', 'Auto Barcode': 'Auto Barcode', 'Profit': 'Munafa'
    }
  };
  let lang = 'en';
  function t(s) {
    if (lang === 'en') return s;
    const d = DICT[lang] || {};
    return d[s] || s;
  }
  t.set = function (l) { lang = (l === 'hi' ? 'hi' : 'en'); try { localStorage.setItem('oc_lang', lang); } catch (e) { } };
  t.get = () => lang;
  t.init = function () { try { lang = localStorage.getItem('oc_lang') === 'hi' ? 'hi' : 'en'; } catch (e) { } return lang; };
  w.T = t;
})(window);
