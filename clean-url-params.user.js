// ==UserScript==
// @name            Clean URL Params
// @name:ko         Clean URL Params (추적 파라미터 제거)
// @namespace       https://github.com/msjang
// @version         1.2
// @description     Silently strips tracking parameters (fbclid, utm_*, gclid, etc.) and empty parameters from the address bar, without reloading the page.
// @description:ko  페이지를 열 때 URL에 붙은 fbclid, utm_*, gclid 같은 추적 파라미터와 값이 빈 파라미터를 주소창에서 조용히 제거합니다. 새로고침 없음.
// @author          Minseok Jang
// @license         MIT
// @homepageURL     https://github.com/msjang/userscripts
// @supportURL      https://github.com/msjang/userscripts/issues
// @match           *://*/*
// @run-at          document-start
// @grant           none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // 정확히 일치하면 제거할 파라미터
  const EXACT = new Set([
    'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'gclsrc',
    'msclkid', 'twclid', 'ttclid', 'igshid', 'igsh', 'li_fat_id',
    'mc_cid', 'mc_eid', 'mkt_tok', 'vero_id', 'vero_conv',
    '_hsenc', '_hsmi', 'hsCtaTracking', '_openstat', 'yclid',
    'oly_anon_id', 'oly_enc_id', 'rb_clickid', 's_cid', 'wickedid',
    'ref_src', 'ref_url', 'spm', 'scm', 'share_source',
    'si',          // YouTube/Spotify 공유 링크
    'trk', 'trkCampaign',
  ]);

  // 접두사가 일치하면 제거할 파라미터
  const PREFIXES = ['utm_', 'pk_', 'piwik_', 'matomo_', 'ga_', 'hsa_', 'at_', 'icid', 'ncid'];

  // 건드리면 안 되는 사이트 (로그인/결제 등 파라미터가 기능적인 곳)
  const SKIP_HOSTS = [
    /(^|\.)accounts\.google\.com$/,
    /(^|\.)login\./,
    /(^|\.)auth\./,
    /(^|\.)paypal\.com$/,
  ];

  // 값이 빈 파라미터(?a=&b=)도 제거할지
  const DROP_EMPTY = true;

  function shouldDrop(key) {
    const k = key.toLowerCase();
    if (EXACT.has(k)) return true;
    return PREFIXES.some((p) => k.startsWith(p));
  }

  // 같은 키의 값이 전부 비어 있을 때만 빈 파라미터로 간주
  function isEmpty(sp, key) {
    return DROP_EMPTY && sp.getAll(key).every((v) => v === '');
  }

  function clean() {
    try {
      if (SKIP_HOSTS.some((re) => re.test(location.hostname))) return;

      const url = new URL(location.href);
      if (!url.search && !url.hash.includes('?')) return;

      let changed = false;

      // 쿼리스트링 정리
      const params = url.searchParams;
      for (const key of new Set(params.keys())) {
        if (shouldDrop(key) || isEmpty(params, key)) {
          params.delete(key);
          changed = true;
        }
      }

      // 해시 라우팅(#/path?fbclid=...) 안쪽도 정리
      const hashQ = url.hash.indexOf('?');
      if (hashQ !== -1) {
        const hashPath = url.hash.slice(0, hashQ);
        const hp = new URLSearchParams(url.hash.slice(hashQ + 1));
        for (const key of new Set(hp.keys())) {
          if (shouldDrop(key) || isEmpty(hp, key)) {
            hp.delete(key);
            changed = true;
          }
        }
        const rest = hp.toString();
        url.hash = rest ? `${hashPath}?${rest}` : hashPath;
      }

      if (!changed) return;

      // 파라미터가 전부 사라지면 '?'도 같이 제거
      let next = url.toString();
      next = next.replace(/\?(?=#|$)/, '');

      history.replaceState(history.state, '', next);
    } catch (e) {
      /* 조용히 무시 */
    }
  }

  clean();

  // SPA 대응: pushState/replaceState/뒤로가기 이후에도 다시 정리
  const wrap = (fn) =>
    function () {
      const r = fn.apply(this, arguments);
      queueMicrotask(clean);
      return r;
    };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', clean);
})();
