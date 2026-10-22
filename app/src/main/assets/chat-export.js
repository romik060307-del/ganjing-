/* WA Cloning RK v2.1 - export the open chat (text, or text + media) as WhatsApp-style files.
 *
 * Output (mode "media"): a .zip with
 *   - "Obrolan WhatsApp dengan <nama>.txt"   same line format as WhatsApp's own export (dd/mm/yyyy HH.mm - Nama: pesan)
 *   - "index.html"                           WhatsApp-looking replica with the photos/videos/voice notes in order
 *   - "media/..."                            the files, named like WhatsApp (IMG-20261020-WA0001.jpg ...)
 * Output (mode "text"): just the .txt.   Output (mode "copy"): the text goes to the clipboard.
 *
 * It reads what WhatsApp Web has on screen. It can only export history that this linked device holds,
 * and it never reads view-once media (those are listed as a placeholder only).
 *
 * Bridge (Java, window.WACloningApp): exportProgress(text,pct) exportShouldCancel() exportBegin(name,mime)
 * exportWrite(base64) exportEnd(ok) exportCopyText(text) exportFinished(json) exportFailed(msg)
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.__rkExport && W.__rkExport.version === 1) return 'already';

  var MONTHS = {
    januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, maret: 3, mar: 3, march: 3, april: 4, apr: 4,
    mei: 5, may: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7, agustus: 8, agu: 8, agt: 8, aug: 8, august: 8,
    september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, oct: 10, october: 10, november: 11, nov: 11, desember: 12, des: 12, dec: 12, december: 12
  };
  var WEEKDAYS = {
    minggu: 0, ahad: 0, sunday: 0, sun: 0, senin: 1, monday: 1, mon: 1, selasa: 2, tuesday: 2, tue: 2, rabu: 3, wednesday: 3, wed: 3,
    kamis: 4, thursday: 4, thu: 4, jumat: 5, "jum'at": 5, friday: 5, fri: 5, sabtu: 6, saturday: 6, sat: 6
  };

  function Cancelled() { this.message = 'Dibatalkan.'; }
  function bridge() { return W.WACloningApp || null; }
  function sleep(ms) { return new Promise(function (r) { W.setTimeout(r, ms); }); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function lc(v) { return (v === null || v === undefined ? '' : String(v)).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function clean(t) { return String(t || '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim(); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var ctrl = { cancelled: false, order: 'dmy' };

  function progress(text, pct) {
    try { var b = bridge(); if (b && b.exportProgress) b.exportProgress(String(text), Math.max(0, Math.min(100, Math.round(pct || 0)))); } catch (e) { }
  }
  function checkCancel() {
    try { var b = bridge(); if (b && b.exportShouldCancel && b.exportShouldCancel()) ctrl.cancelled = true; } catch (e) { }
    if (ctrl.cancelled) throw new Cancelled();
  }
  async function waitFor(fn, timeoutMs, stepMs) {
    var t0 = Date.now(), v;
    while (Date.now() - t0 < timeoutMs) {
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(stepMs || 120);
      checkCancel();
    }
    return null;
  }

  /* ------------------------------------------------------------------ text helpers */
  function textOf(node) {
    var out = '';
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out += c.nodeValue;
        else if (c.nodeType === 1) {
          var tag = c.tagName;
          if (tag === 'IMG') out += c.getAttribute('alt') || c.getAttribute('data-plain-text') || '';
          else if (tag === 'BR') out += '\n';
          else if (tag !== 'SCRIPT' && tag !== 'STYLE') walk(c);
        }
      }
    })(node);
    return clean(out);
  }

  /* ------------------------------------------------------------------ dates and times */
  function today() { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; }
  function addDays(dt, delta) {
    var x = new Date(dt.y, dt.m - 1, dt.d + delta);
    return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() };
  }
  function fixYear(y) { y = parseInt(y, 10); return y < 100 ? 2000 + y : y; }
  function fmtDate(dt) { return dt ? pad(dt.d) + '/' + pad(dt.m) + '/' + dt.y : '??/??/????'; }
  function fmtTime(t) { return t ? pad(t.h) + '.' + pad(t.mi) : '00.00'; }
  function dateKey(dt) { return dt ? '' + dt.y + pad(dt.m) + pad(dt.d) : '00000000'; }

  function parseDateText(raw) {
    var t = lc(raw).replace(/,/g, ' ').replace(/\s+/g, ' ').trim(), m;
    if (!t) return null;
    if (/^(hari ini|today)$/.test(t)) return today();
    if (/^(kemarin|yesterday)$/.test(t)) return addDays(today(), -1);
    if (WEEKDAYS.hasOwnProperty(t)) {
      var now = new Date(), diff = (now.getDay() - WEEKDAYS[t] + 7) % 7;
      return addDays(today(), -(diff === 0 ? 7 : diff));
    }
    m = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/.exec(t);
    if (m) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10);
      if (m[1].length === 4) return { y: a, m: b, d: c };
      if (ctrl.order === 'mdy') return { y: fixYear(c), m: a, d: b };
      return { y: fixYear(c), m: b, d: a };
    }
    m = /^(\d{1,2}) ([a-z']+)\.? (\d{4})$/.exec(t);
    if (m && MONTHS[m[2]]) return { y: parseInt(m[3], 10), m: MONTHS[m[2]], d: parseInt(m[1], 10) };
    m = /^([a-z]+)\.? (\d{1,2}) (\d{4})$/.exec(t);
    if (m && MONTHS[m[1]]) return { y: parseInt(m[3], 10), m: MONTHS[m[1]], d: parseInt(m[2], 10) };
    return null;
  }

  function parseTimeText(raw) {
    var m = /^\s*(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([APap])?\.?[Mm]?\.?\s*$/.exec(raw || '');
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (m[4]) { var pm = /p/i.test(m[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    if (h > 23 || mi > 59) return null;
    return { h: h, mi: mi };
  }

  // "[14.06, 20/10/2026] Nama: "
  function parsePre(pre) {
    var m = /^\s*\[\s*([^,\]]+?)\s*,\s*([^\]]+?)\s*\]\s*([\s\S]*?):\s*$/.exec(pre || '');
    if (!m) return null;
    var time = parseTimeText(m[1]), date = parseDateText(m[2]);
    if (!time) return null;
    return { time: time, date: date, sender: clean(m[3]) };
  }

  function detectDateOrder() {
    var nodes = D.querySelectorAll('[data-pre-plain-text]');
    for (var i = 0; i < nodes.length && i < 400; i++) {
      var m = /,\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-]\d{2,4}\s*\]/.exec(nodes[i].getAttribute('data-pre-plain-text') || '');
      if (!m) continue;
      if (parseInt(m[1], 10) > 12) { ctrl.order = 'dmy'; return; }
      if (parseInt(m[2], 10) > 12) { ctrl.order = 'mdy'; return; }
    }
    ctrl.order = 'dmy';
  }

  function findTime(row) {
    var spans = row.querySelectorAll('span,div');
    var best = null;
    for (var i = 0; i < spans.length && i < 120; i++) {
      var s = spans[i];
      if (s.children.length > 0 && !/^\s*\d/.test(s.textContent || '')) continue;
      var txt = (s.textContent || '').trim();
      if (txt.length > 9) continue;
      var t = parseTimeText(txt);
      if (t) best = t;
    }
    return best;
  }

  /* ------------------------------------------------------------------ one row -> one message */
  function iconsOf(row) {
    var out = [], nodes = row.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length && i < 30; i++) out.push(lc(nodes[i].getAttribute('data-icon')));
    return out.join(' ');
  }

  function mapsLink(row) {
    var a = row.querySelector('a[href*="maps"],a[href^="geo:"]');
    if (!a) return null;
    var href = a.getAttribute('href') || '';
    var m = /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i.exec(href) ||
      /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(href) || /geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(href);
    return m ? { lat: m[1], lng: m[2], href: href } : { lat: null, lng: null, href: href };
  }

  function stripTime(t) { return String(t || '').replace(/\s*\d{1,2}[.:]\d{2}(?:\s?[APap][Mm])?\s*$/, '').trim(); }

  function parseDivider(text) {
    var t = clean(text);
    if (!t || t.length > 40 || t.indexOf('\n') >= 0) return null;
    return parseDateText(t);
  }

  function parseRow(row, ctx) {
    var idEl = row.hasAttribute && row.hasAttribute('data-id') ? row : row.querySelector('[data-id]');
    var rawText = clean(row.innerText || row.textContent || '');
    if (!idEl) {
      var dv = parseDivider(rawText);
      if (dv) { ctx.date = dv; return null; }
      if (!rawText) return null;
      return { kind: 'system', id: null, date: ctx.date, time: ctx.lastTime, text: rawText.replace(/\n+/g, ' '), el: row };
    }
    var id = idEl.getAttribute('data-id') || '';
    var out = /^true_/.test(id) || !!(idEl.classList && idEl.classList.contains('message-out')) || !!row.querySelector('.message-out');
    var preEl = row.querySelector('[data-pre-plain-text]');
    var pre = preEl ? parsePre(preEl.getAttribute('data-pre-plain-text')) : null;
    var icons = iconsOf(row), low = lc(rawText);

    var texts = [], quote = '';
    var spans = row.querySelectorAll('span.selectable-text,span[data-testid="selectable-text"]');
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      if (sp.parentElement && sp.parentElement.closest('span.selectable-text,span[data-testid="selectable-text"]')) continue;
      var tx = textOf(sp);
      if (!tx) continue;
      if (sp.closest('[data-testid*="quoted"],[data-testid*="quote"]')) quote = quote ? quote + ' ' + tx : tx;
      else texts.push(tx);
    }
    var body = texts.join('\n');

    var kind = 'text';
    if (/view-?once|ephemeral/.test(icons) || /(sekali lihat|view once|sekali dilihat|dilihat satu kali)/.test(low)) kind = 'viewonce';
    else if (/(pesan ini dihapus|anda menghapus pesan|this message was deleted|you deleted this message)/.test(low) && !body) kind = 'deleted';
    else if (!body && (/(^|\s)(miss-call|voice-call|video-call|call-in|call-out|phone)(\s|$|-)/.test(icons) ||
             /^(panggilan|voice call|video call|missed (voice|video) call|tak terjawab)/.test(low))) kind = 'call';
    else if (mapsLink(row) || /(location|lokasi|map-pin)/.test(icons)) kind = 'location';
    else if (row.querySelector('[data-testid*="sticker"]') || /sticker/.test(icons)) kind = 'sticker';
    else if (row.querySelector('video') || /(media-play|msg-video|video-pip|(^|\s)video(\s|$))/.test(icons)) kind = 'video';
    else if (/(ptt|audio-play|audio-download|msg-ptt)/.test(icons) && /ptt/.test(icons)) kind = 'voice';
    else if (/audio|ptt/.test(icons) || row.querySelector('audio')) kind = row.querySelector('[data-testid*="ptt"]') ? 'voice' : 'audio';
    else if (/(document|doc-|msg-doc|(^|\s)file(\s|$))/.test(icons) || row.querySelector('[data-testid*="document"]')) kind = 'document';
    else if (hasImage(row)) kind = 'image';

    var time, date;
    if (pre) { time = pre.time; date = pre.date || ctx.date; if (pre.date) ctx.date = pre.date; }
    else { time = findTime(row) || ctx.lastTime; date = ctx.date; }
    if (time) ctx.lastTime = time;

    if (pre && pre.sender) { if (out) ctx.lastOut = pre.sender; else ctx.lastIn = pre.sender; }
    var sender = pre && pre.sender ? pre.sender : (out ? (ctx.lastOut || 'Anda') : (ctx.lastIn || ctx.title));
    var msg = { kind: kind, id: id, out: out, sender: sender, date: date, time: time, text: body, quote: quote, el: row };

    if (kind === 'location') {
      var loc = mapsLink(row);
      msg.lat = loc && loc.lat; msg.lng = loc && loc.lng; msg.href = loc && loc.href;
      if (!body) msg.text = '';
    } else if (kind === 'call' || kind === 'deleted') {
      msg.text = stripTime(rawText.replace(/\n+/g, ' '));
    } else if (kind === 'document') {
      var nameEl = row.querySelector('[title]:not([data-icon])');
      msg.fileName = (nameEl && nameEl.getAttribute('title')) || (rawText.split('\n')[0] || 'dokumen');
    }
    return msg;
  }

  function mediaImgs(row) {
    var list = [], imgs = row.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.classList.contains('emoji') || im.hasAttribute('data-plain-text') || im.closest('.selectable-text,[data-testid*="avatar"],[data-testid*="link-preview"]')) continue;
      var w = im.naturalWidth || im.clientWidth || im.width || 0;
      if (w < 64) continue;
      list.push(im);
    }
    list.sort(function (a, b) { return (b.naturalWidth || b.clientWidth) * (b.naturalHeight || b.clientHeight) - (a.naturalWidth || a.clientWidth) * (a.naturalHeight || a.clientHeight); });
    return list;
  }
  function hasImage(row) { return mediaImgs(row).length > 0; }

  /* ------------------------------------------------------------------ media capture */
  var MIME_EXT = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
    'audio/ogg': 'opus', 'audio/opus': 'opus', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/wav': 'wav'
  };
  function extFor(mime, kind) {
    var base = String(mime || '').split(';')[0].trim().toLowerCase();
    if (MIME_EXT[base]) return MIME_EXT[base];
    return kind === 'video' ? 'mp4' : (kind === 'voice' || kind === 'audio') ? 'opus' : kind === 'sticker' ? 'webp' : 'jpg';
  }

  async function blobFromUrl(url, maxBytes) {
    var res = await W.fetch(url);
    if (!res.ok) throw new Error('fetch ' + res.status);
    var blob = await res.blob();
    if (!blob.size) throw new Error('kosong');
    if (blob.size > maxBytes) throw new Error('terlalu besar');
    return blob;
  }

  function blobSrcSet() {
    var set = {}, nodes = D.querySelectorAll('video,audio,img');
    for (var i = 0; i < nodes.length; i++) {
      var s = nodes[i].currentSrc || nodes[i].src || '';
      if (s.indexOf('blob:') === 0) set[s] = true;
    }
    return set;
  }

  function pointerClick(el) {
    var target = el.closest ? (el.closest('button,[role="button"],a') || el) : el;
    var seq = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
    for (var i = 0; i < seq.length; i++) {
      try {
        var C = (seq[i].indexOf('pointer') === 0 && W.PointerEvent) ? W.PointerEvent : W.MouseEvent;
        el.dispatchEvent(new C(seq[i], { bubbles: true, cancelable: true, view: W, button: 0 }));
      } catch (e) { }
    }
    if (typeof target.click === 'function') target.click();
    else el.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, view: W }));
  }

  async function closeViewer(el) {
    var ev = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    D.dispatchEvent(new W.KeyboardEvent('keydown', ev));
    var btn = D.querySelector('[data-icon="x-viewer"],[data-icon="x"],[data-icon="close"],[aria-label="Tutup"],[aria-label="Close"]');
    if (btn && (!el || !btn.closest || !btn.closest('#main'))) { try { pointerClick(btn); } catch (e) { } }
    await waitFor(function () { return !el || !el.isConnected || el.offsetParent === null; }, 2500, 100);
  }

  // Open WhatsApp's own viewer on this row, wait for the full-size media element, read it, close the viewer.
  async function viewerCapture(row, tag, maxBytes) {
    var before = blobSrcSet();
    var trigger = row.querySelector('video,[data-icon*="media-play"],[data-icon*="video"],img[src^="blob:"],img[src^="data:"]') || row;
    pointerClick(trigger);
    var found = await waitFor(function () {
      var nodes = D.querySelectorAll(tag);
      for (var i = 0; i < nodes.length; i++) {
        var s = nodes[i].currentSrc || nodes[i].src || '';
        if (s.indexOf('blob:') === 0 && !before[s] && !row.contains(nodes[i])) return nodes[i];
      }
      return null;
    }, 9000, 150);
    if (!found) { await closeViewer(null); return null; }
    var blob = null;
    try { blob = await blobFromUrl(found.currentSrc || found.src, maxBytes); } catch (e) { blob = null; }
    await closeViewer(found);
    return blob;
  }

  async function captureMedia(msg, maxBytes) {
    var row = msg.el;
    if (msg.id) { var fresh = D.querySelector('#main [data-id="' + msg.id.replace(/"/g, '') + '"]'); if (fresh) row = fresh.closest('[role="row"]') || fresh; }
    try {
      if (msg.kind === 'image' || msg.kind === 'sticker') {
        var im = await waitFor(function () {
          var l = mediaImgs(row);
          for (var i = 0; i < l.length; i++) if ((l[i].currentSrc || l[i].src || '').indexOf('blob:') === 0) return l[i];
          return null;
        }, 2500, 150);
        if (im) return await blobFromUrl(im.currentSrc || im.src, maxBytes);
        return await viewerCapture(row, 'img', maxBytes);
      }
      if (msg.kind === 'video') {
        var v = row.querySelector('video');
        var vs = v && (v.currentSrc || v.src || '');
        if (vs && vs.indexOf('blob:') === 0) return await blobFromUrl(vs, maxBytes);
        return await viewerCapture(row, 'video', maxBytes);
      }
      if (msg.kind === 'voice' || msg.kind === 'audio') {
        var a = row.querySelector('audio');
        var as = a && (a.currentSrc || a.src || '');
        if (as && as.indexOf('blob:') === 0) return await blobFromUrl(as, maxBytes);
        var before = blobSrcSet();
        var play = row.querySelector('[data-icon*="audio-play"],[data-icon*="ptt-play"],[data-icon*="play"],[data-icon*="audio-download"]');
        if (!play) return null;
        pointerClick(play);
        var el = await waitFor(function () {
          var nodes = D.querySelectorAll('audio');
          for (var i = 0; i < nodes.length; i++) {
            var s = nodes[i].currentSrc || nodes[i].src || '';
            if (s.indexOf('blob:') === 0 && !before[s]) return nodes[i];
          }
          return null;
        }, 8000, 150);
        if (!el) return null;
        var ab = null;
        try { ab = await blobFromUrl(el.currentSrc || el.src, maxBytes); } catch (e) { ab = null; }
        try { el.pause(); } catch (e) { }
        var pause = row.querySelector('[data-icon*="audio-pause"],[data-icon*="ptt-pause"],[data-icon*="pause"]');
        if (pause) { try { pointerClick(pause); } catch (e) { } }
        return ab;
      }
    } catch (e) {
      if (e instanceof Cancelled) throw e;
      return null;
    }
    return null;
  }

  /* ------------------------------------------------------------------ loading the whole conversation */
  function chatTitle(main) {
    var h = main.querySelector('header');
    if (!h) return 'Chat';
    var t = h.querySelector('[title]:not([data-icon])');
    var name = t ? t.getAttribute('title') : (h.innerText || '').split('\n')[0];
    return clean(name) || 'Chat';
  }

  function rowsOf(main) {
    var rows = main.querySelectorAll('[role="row"]');
    if (rows.length) return rows;
    var ids = main.querySelectorAll('[data-id]'), out = [];
    for (var i = 0; i < ids.length; i++) out.push(ids[i]);
    return out;
  }

  function findScroller(main) {
    var first = main.querySelector('[data-id]') || main.querySelector('[role="row"]');
    var node = first ? first.parentElement : null, fallback = null;
    while (node && node !== main.parentElement) {
      var cs = W.getComputedStyle(node);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        if (node.scrollHeight > node.clientHeight + 10) return node;
        if (!fallback) fallback = node;   // a short chat does not overflow yet, but this is still the message list
      }
      node = node.parentElement;
    }
    return fallback || main.querySelector('[data-testid*="conversation-panel-messages"]') || (first ? main : null);
  }

  function clickLoadOlder(main) {
    var nodes = main.querySelectorAll('button,[role="button"],a,div[tabindex]');
    for (var i = 0; i < nodes.length && i < 80; i++) {
      var t = lc(nodes[i].textContent);
      if (t.length < 80 && /(pesan lama|older messages|load more messages|muat pesan|memuat pesan sebelumnya)/.test(t)) { pointerClick(nodes[i]); return true; }
    }
    return false;
  }

  async function loadHistory(main, scroller) {
    var last = -1, same = 0, steps = 0, t0 = Date.now();
    while (steps++ < 600 && Date.now() - t0 < 12 * 60 * 1000) {
      checkCancel();
      var h0 = scroller.scrollHeight, c0 = rowsOf(main).length;
      // Nudge down, then to the top: if the list is already at 0, setting 0 again fires no scroll event and nothing loads.
      scroller.scrollTop = Math.min(80, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      await sleep(120);
      scroller.scrollTop = 0;
      clickLoadOlder(main);
      await sleep(900);
      var c = rowsOf(main).length;
      progress('Memuat seluruh riwayat… ' + c + ' baris', Math.min(35, 3 + steps));
      var atStart = false;
      var rows = rowsOf(main);
      if (rows.length) atStart = /(dienkripsi secara end-to-end|end-to-end encrypted)/.test(lc(rows[0].textContent || '').slice(0, 200));
      if (c === last && scroller.scrollHeight === h0 && c === c0) { if (++same >= 4 || atStart) break; } else same = 0;
      last = c;
    }
  }

  /* ------------------------------------------------------------------ zip + html + txt */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crcUpdate(state, u8) { for (var i = 0; i < u8.length; i++) state = CRC_TABLE[(state ^ u8[i]) & 0xFF] ^ (state >>> 8); return state >>> 0; }
  async function crcOfBlob(blob) {
    var state = 0xFFFFFFFF, CH = 4 * 1024 * 1024;
    for (var off = 0; off < blob.size; off += CH) {
      state = crcUpdate(state, new Uint8Array(await blob.slice(off, off + CH).arrayBuffer()));
      checkCancel();
    }
    return (state ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) { return new W.TextEncoder().encode(s); }

  async function buildZip(entries) {
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var parts = [], central = [], offset = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], nameBytes = utf8(e.name), size = e.blob.size, crc = await crcOfBlob(e.blob);
      var lh = new Uint8Array(30 + nameBytes.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true); dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true); dv.setUint32(22, size, true); dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      parts.push(lh, e.blob);
      central.push({ nameBytes: nameBytes, crc: crc, size: size, offset: offset });
      offset += lh.length + size;
    }
    var cdStart = offset, cdSize = 0;
    for (var j = 0; j < central.length; j++) {
      var c = central[j], ch = new Uint8Array(46 + c.nameBytes.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, c.crc, true);
      cv.setUint32(20, c.size, true); cv.setUint32(24, c.size, true); cv.setUint16(28, c.nameBytes.length, true);
      cv.setUint32(42, c.offset, true); ch.set(c.nameBytes, 46);
      parts.push(ch); cdSize += ch.length;
    }
    var end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, cdStart, true);
    parts.push(end);
    return new Blob(parts, { type: 'application/zip' });
  }

  function toBase64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return W.btoa(s);
  }

  async function saveBlob(blob, fileName, mime, pct0, pct1) {
    var b = bridge();
    var r = String(b.exportBegin(fileName, mime));
    if (r.indexOf('OK') !== 0) throw new Error(r.replace(/^ERR:?/, '') || 'Tidak bisa membuat file.');
    var CH = 384 * 1024, off = 0;
    try {
      while (off < blob.size) {
        checkCancel();
        var u8 = new Uint8Array(await blob.slice(off, off + CH).arrayBuffer());
        var res = String(b.exportWrite(toBase64(u8)));
        if (res !== 'OK') throw new Error('Gagal menulis file: ' + res);
        off += CH;
        progress('Menyimpan ke HP… ' + Math.min(100, Math.round(off * 100 / blob.size)) + '%', pct0 + (pct1 - pct0) * Math.min(1, off / blob.size));
      }
    } catch (e) {
      try { b.exportEnd('false'); } catch (x) { }
      throw e;
    }
    return String(b.exportEnd('true'));
  }

  function waName(kind, date, counters, ext, fileName) {
    if (kind === 'document' && fileName) return fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
    var prefix = { image: 'IMG', video: 'VID', voice: 'PTT', audio: 'AUD', sticker: 'STK' }[kind] || 'FILE';
    var key = prefix + dateKey(date);
    counters[key] = (counters[key] || 0) + 1;
    return prefix + '-' + dateKey(date) + '-WA' + pad(counters[key], 4) + '.' + ext;
  }

  function fillDates(msgs) {
    var next = null, i;
    for (i = msgs.length - 1; i >= 0; i--) { if (msgs[i].date) next = msgs[i].date; else msgs[i].date = next; }
    var prev = null;
    for (i = 0; i < msgs.length; i++) { if (msgs[i].date) prev = msgs[i].date; else msgs[i].date = prev; }
    var lastT = null;
    for (i = 0; i < msgs.length; i++) { if (msgs[i].time) lastT = msgs[i].time; else if (lastT) msgs[i].time = lastT; }
    var nextT = null;
    for (i = msgs.length - 1; i >= 0; i--) { if (msgs[i].time) nextT = msgs[i].time; else if (nextT) msgs[i].time = nextT; }
  }

  function describeMedia(m) {
    return { image: 'Foto', video: 'Video', voice: 'Pesan suara', audio: 'Audio', sticker: 'Stiker', document: 'Dokumen' }[m.kind] || 'Media';
  }

  function buildTxt(msgs, title) {
    var lines = [];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i], head = fmtDate(m.date) + ' ' + fmtTime(m.time) + ' - ';
      if (m.kind === 'system' || m.kind === 'call') { lines.push(head + m.text); continue; }
      var body;
      if (m.kind === 'text') body = m.text;
      else if (m.kind === 'viewonce') body = '<Pesan sekali lihat: tidak disimpan>';
      else if (m.kind === 'deleted') body = m.text || 'Pesan ini dihapus';
      else if (m.kind === 'location') {
        body = 'location: ' + (m.lat ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : (m.href || '')) + (m.text ? '\n' + m.text : '');
      } else {
        body = (m.media ? m.media.name + ' (file terlampir)' : '<Media tidak disertakan>') + (m.kind === 'document' && !m.media && m.fileName ? ' [' + m.fileName + ']' : '') + (m.text ? '\n' + m.text : '');
      }
      lines.push(head + m.sender + ': ' + body);
    }
    return lines.join('\n') + '\n';
  }

  function buildHtml(msgs, title, stats) {
    var incoming = {}, nIn = 0;
    msgs.forEach(function (m) { if (!m.out && m.sender && m.kind !== 'system' && m.kind !== 'call' && !incoming[m.sender]) { incoming[m.sender] = 1; nIn++; } });
    var group = nIn > 1;
    var html = [];
    html.push('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>');
    html.push('body{margin:0;background:#efeae2;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111b21}');
    html.push('header{position:sticky;top:0;z-index:5;background:#075e54;color:#fff;padding:10px 16px}header b{font-size:17px}header div{font-size:12px;opacity:.85}');
    html.push('main{max-width:760px;margin:0 auto;padding:10px 8px 40px;display:flex;flex-direction:column;gap:3px}');
    html.push('.day{align-self:center;margin:10px 0 4px;background:#fff;color:#54656f;font-size:12.5px;padding:4px 12px;border-radius:8px;box-shadow:0 1px .5px rgba(11,20,26,.13)}');
    html.push('.sys{align-self:center;max-width:90%;margin:3px 0;background:#fff3c4;color:#54656f;font-size:12.5px;padding:5px 12px;border-radius:8px;text-align:center}');
    html.push('.msg{max-width:82%;padding:6px 8px 4px;border-radius:8px;box-shadow:0 1px .5px rgba(11,20,26,.13);font-size:14.5px;line-height:1.35;word-wrap:break-word;overflow-wrap:anywhere}');
    html.push('.in{align-self:flex-start;background:#fff;border-top-left-radius:0}.out{align-self:flex-end;background:#d9fdd3;border-top-right-radius:0}');
    html.push('.who{font-size:12.5px;font-weight:600;color:#06cf9c;margin-bottom:2px}.t{white-space:pre-wrap}.time{float:right;margin:6px 0 0 10px;font-size:11px;color:#667781}');
    html.push('.q{border-left:4px solid #06cf9c;background:rgba(0,0,0,.05);padding:4px 8px;margin-bottom:4px;border-radius:4px;font-size:13px;color:#54656f}');
    html.push('.msg img,.msg video{display:block;max-width:100%;max-height:420px;border-radius:6px;margin-bottom:4px}.msg audio{width:240px;max-width:100%;margin-bottom:4px}');
    html.push('.ph{display:inline-block;padding:8px 10px;background:rgba(0,0,0,.06);border-radius:6px;color:#54656f;font-size:13px;margin-bottom:4px}a{color:#027eb5}');
    html.push('</style></head><body><header><b>' + esc(title) + '</b><div>' + stats.total + ' pesan · diexport ' + esc(new Date().toLocaleString('id-ID')) + ' · WA Cloning</div></header><main>');
    var lastDay = null;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i], dk = dateKey(m.date);
      if (dk !== lastDay) { html.push('<div class="day">' + esc(fmtDate(m.date)) + '</div>'); lastDay = dk; }
      if (m.kind === 'system' || m.kind === 'call') { html.push('<div class="sys">' + (m.kind === 'call' ? '📞 ' : '') + esc(m.text) + (m.time ? ' · ' + fmtTime(m.time) : '') + '</div>'); continue; }
      var parts = [];
      if (group && !m.out) parts.push('<div class="who">' + esc(m.sender) + '</div>');
      if (m.quote) parts.push('<div class="q">' + esc(m.quote) + '</div>');
      if (m.kind === 'image' || m.kind === 'sticker') parts.push(m.media ? '<img loading="lazy" src="' + esc(m.media.path) + '" alt="">' : '<span class="ph">🖼️ ' + describeMedia(m) + ' (tidak disertakan)</span>');
      else if (m.kind === 'video') parts.push(m.media ? '<video controls preload="metadata" src="' + esc(m.media.path) + '"></video>' : '<span class="ph">🎬 Video (tidak disertakan)</span>');
      else if (m.kind === 'voice' || m.kind === 'audio') parts.push(m.media ? '<audio controls preload="none" src="' + esc(m.media.path) + '"></audio>' : '<span class="ph">🎤 ' + describeMedia(m) + ' (tidak disertakan)</span>');
      else if (m.kind === 'document') parts.push('<span class="ph">📎 ' + esc(m.fileName || 'Dokumen') + (m.media ? '' : ' (tidak disertakan)') + '</span>');
      else if (m.kind === 'viewonce') parts.push('<span class="ph">1️⃣ Pesan sekali lihat: tidak disimpan</span>');
      else if (m.kind === 'location') parts.push('<span class="ph">📍 <a href="' + esc(m.lat ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : (m.href || '#')) + '">' + (m.lat ? esc(m.lat + ', ' + m.lng) : 'Lokasi') + '</a></span>');
      if (m.text) parts.push('<div class="t">' + esc(m.text) + '</div>');
      html.push('<div class="msg ' + (m.out ? 'out' : 'in') + '">' + parts.join('') + '<span class="time">' + fmtTime(m.time) + '</span></div>');
    }
    html.push('</main></body></html>');
    return html.join('\n');
  }

  /* ------------------------------------------------------------------ main flow */
  async function run(opts) {
    var b = bridge();
    ctrl.cancelled = false;
    var main = D.querySelector('#main');
    if (!main || !main.querySelector('header')) throw new Error('Buka satu chat dulu, lalu coba export lagi.');
    var title = chatTitle(main), mode = opts.mode || 'text';
    var withMedia = mode === 'media';
    var maxBytes = (opts.maxMediaMB || 40) * 1024 * 1024, maxTotal = (opts.maxTotalMB || 400) * 1024 * 1024;
    detectDateOrder();

    var scroller = findScroller(main);
    if (!scroller) throw new Error('Daftar pesan tidak ditemukan. Tunggu chat selesai dimuat, lalu coba lagi.');
    progress('Memuat seluruh riwayat…', 2);
    await loadHistory(main, scroller);

    // Walk top -> bottom. Structure is read once per row; media is fetched while its row is on screen.
    var ctx = { date: null, lastTime: null, title: title }, msgs = [], seen = new WeakSet(), byKey = {}, totalBytes = 0, mediaOk = 0, mediaFail = 0, mediaSkipped = 0;
    function ingest() {
      var rows = rowsOf(main), added = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (seen.has(row)) continue;
        seen.add(row);
        var m = parseRow(row, ctx);
        if (!m) continue;
        var key = (m.id || ('sys:' + (msgs.length ? msgs[msgs.length - 1].id : '') + ':' + m.text));
        if (byKey[key]) continue;
        byKey[key] = true;
        msgs.push(m); added.push(m);
      }
      return added;
    }
    scroller.scrollTop = 0;
    await sleep(400);
    var step = Math.max(200, Math.floor(scroller.clientHeight * (withMedia ? 0.8 : 1.4))), guard = 0;
    var mediaKinds = { image: 1, video: 1, voice: 1, audio: 1, sticker: 1 };
    var pending = [];
    while (true) {
      checkCancel();
      ingest();
      if (withMedia) {
        // Everything not yet captured whose row is within one screen above/below the viewport.
        var sr = scroller.getBoundingClientRect();
        for (var i = 0; i < msgs.length; i++) {
          var m = msgs[i];
          if (!mediaKinds[m.kind] || m.mediaTried) continue;
          var rr = m.el.getBoundingClientRect();
          if (rr.bottom < sr.top - sr.height || rr.top > sr.bottom + sr.height) continue;
          m.mediaTried = true;
          progress('Mengambil media… ' + mediaOk + ' berhasil, ' + mediaFail + ' gagal', 35 + 45 * Math.min(1, scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)));
          if (totalBytes >= maxTotal) { mediaSkipped++; continue; }
          var blob = await captureMedia(m, maxBytes);
          if (blob) { m.blob = blob; totalBytes += blob.size; mediaOk++; } else mediaFail++;
        }
      } else {
        progress('Membaca pesan… ' + msgs.length, 35 + 45 * Math.min(1, scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)));
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) break;
      scroller.scrollTop += step;
      await sleep(withMedia ? 350 : 40);
      if (++guard > 20000) break;
    }
    ingest();
    fillDates(msgs);

    // names for media files
    var counters = {}, entries = [];
    for (var k = 0; k < msgs.length; k++) {
      var mm = msgs[k];
      if (mm.blob) {
        var name = waName(mm.kind, mm.date, counters, extFor(mm.blob.type, mm.kind), null);
        mm.media = { name: name, path: 'media/' + name, blob: mm.blob };
        entries.push({ name: 'media/' + name, blob: mm.blob });
      }
    }

    progress('Menyusun file…', 84);
    var safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 60);
    var txtName = 'Obrolan WhatsApp dengan ' + safeTitle + '.txt';
    var txt = buildTxt(msgs, title);
    var stats = { total: msgs.length, mediaOk: mediaOk, mediaFail: mediaFail, mediaSkipped: mediaSkipped, bytes: totalBytes };
    var summary, saved = '';

    if (mode === 'copy') {
      var cr = String(b.exportCopyText(txt));
      summary = { kind: 'copy', result: cr, chars: txt.length, name: txtName };
    } else if (mode === 'text') {
      saved = await saveBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), txtName, 'text/plain', 86, 99);
      summary = { kind: 'text', name: txtName, saved: saved };
    } else {
      var all = [{ name: txtName, blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }) },
                 { name: 'index.html', blob: new Blob([buildHtml(msgs, title, stats)], { type: 'text/html;charset=utf-8' }) }].concat(entries);
      progress('Membuat ZIP…', 88);
      var zip = await buildZip(all);
      var zipName = 'Obrolan WhatsApp dengan ' + safeTitle + '.zip';
      saved = await saveBlob(zip, zipName, 'application/zip', 92, 99);
      summary = { kind: 'media', name: zipName, saved: saved, size: zip.size };
    }
    summary.stats = stats;
    try { scroller.scrollTop = scroller.scrollHeight; } catch (e) { }
    progress('Selesai', 100);
    b.exportFinished(JSON.stringify(summary));
  }

  function start(optsJson) {
    var b = bridge();
    if (!b || !b.exportFinished) return 'NO_BRIDGE';
    var opts = {};
    try { opts = JSON.parse(optsJson || '{}'); } catch (e) { }
    run(opts).catch(function (e) {
      try {
        if (e instanceof Cancelled) b.exportFailed('CANCELLED');
        else b.exportFailed(String((e && e.message) || e));
      } catch (x) { }
    });
    return 'STARTED';
  }

  W.__rkExport = {
    version: 1, start: start,
    _t: { parseRow: parseRow, parseDateText: parseDateText, parsePre: parsePre, buildTxt: buildTxt, parseTimeText: parseTimeText, ctrl: ctrl }
  };
  return 'ok';
})();
