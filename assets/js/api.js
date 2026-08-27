/* Oakcraft Stock — Google Apps Script (Google Sheets) API client */
(function (w) {
  'use strict';
  const API = {
    get url() { return (w.DB && DB.getMeta('gasUrl', '')) || ''; },
    get token() { return (w.DB && DB.getMeta('gasToken', '')) || ''; },
    configured() { return !!API.url; },

    /**
     * Apps Script web apps 302-redirect to googleusercontent.com.
     * A "simple request" (text/plain body, no custom headers) avoids the CORS
     * preflight that would otherwise fail on that redirect. This is the
     * supported way to talk to a /exec endpoint from a browser.
     */
    async call(action, payload, opts) {
      opts = opts || {};
      if (!API.url) throw new Error('Google Sheet is not connected yet');
      const body = JSON.stringify(Object.assign({ action, token: API.token }, payload || {}));
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), opts.timeout || 45000);
      let res;
      try {
        res = await fetch(API.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
          signal: ctl.signal,
          redirect: 'follow',
          cache: 'no-store'
        });
      } catch (e) {
        clearTimeout(timer);
        throw new Error(e.name === 'AbortError' ? 'Request timed out' : 'Cannot reach the Google Script (check the URL / your internet)');
      }
      clearTimeout(timer);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch (e) {
        if (/Google Drive|Sign in|accounts\.google/i.test(text))
          throw new Error('The Web App is not public. Re-deploy with “Who has access = Anyone”.');
        throw new Error('Unexpected reply from the Google Script');
      }
      if (json && json.ok === false) throw new Error(json.error || 'Google Script error');
      return json;
    },

    ping() { return API.call('ping', {}, { timeout: 20000 }); },
    setup() { return API.call('setup', {}, { timeout: 90000 }); },
    bootstrap() { return API.call('bootstrap', {}, { timeout: 90000 }); },
    pull(since) { return API.call('pull', { since: since || '' }); },
    push(changes) { return API.call('push', { changes }, { timeout: 90000 }); },
    sheetInfo() { return API.call('info'); }
  };
  w.API = API;
})(window);
