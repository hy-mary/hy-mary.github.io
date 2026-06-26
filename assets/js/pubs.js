/* Minimal, dependency-free BibTeX renderer for the Publications section.
   Reads assets/publications.bib, renders into #pub-list, newest year first.
   Bolds the author whose name matches window.MY_NAME_KEYS. */
(function () {
  "use strict";

  var BIB_URL = "assets/publications.bib";
  var listEl = document.getElementById("pub-list");
  if (!listEl) return;

  fetch(BIB_URL)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) { render(parseBib(text)); })
    .catch(function (e) {
      listEl.innerHTML =
        '<li class="pub-loading">Could not load publications (' + e.message +
        '). Make sure the page is served over http(s), not opened as a file.</li>';
    });

  /* ---------- BibTeX parsing ---------- */
  function parseBib(src) {
    var entries = [];
    // strip % line comments (outside braces is fine for typical .bib)
    src = src.replace(/^[ \t]*%.*$/gm, "");
    var re = /@(\w+)\s*\{\s*([^,]*),([\s\S]*?)\n\}/g; // entry blocks
    var m;
    while ((m = re.exec(src))) {
      var type = m[1].toLowerCase();
      var fields = parseFields(m[3]);
      fields._type = type;
      entries.push(fields);
    }
    // newest first; entries without a year sink to bottom
    entries.sort(function (a, b) {
      return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
    });
    return entries;
  }

  function parseFields(body) {
    var fields = {};
    var re = /(\w+)\s*=\s*/g;
    var m;
    while ((m = re.exec(body))) {
      var key = m[1].toLowerCase();
      var i = re.lastIndex;
      var val = readValue(body, i);
      if (val === null) break;
      fields[key] = cleanup(val.text);
      re.lastIndex = val.end;
    }
    return fields;
  }

  // Reads a {braced}, "quoted", or bare value starting at index i.
  function readValue(s, i) {
    while (i < s.length && /\s/.test(s[i])) i++;
    var c = s[i];
    if (c === "{") {
      var depth = 0, start = i;
      for (; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") { depth--; if (depth === 0) { i++; break; } }
      }
      return { text: s.slice(start + 1, i - 1), end: i };
    } else if (c === '"') {
      var st = ++i;
      for (; i < s.length && s[i] !== '"'; i++) {}
      return { text: s.slice(st, i), end: i + 1 };
    } else {
      var b = i;
      for (; i < s.length && !/[,}\n]/.test(s[i]); i++) {}
      return { text: s.slice(b, i).trim(), end: i };
    }
  }

  function cleanup(t) {
    return t.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  }

  /* ---------- Rendering ---------- */
  var MY = (window.MY_NAME_KEYS || []).map(norm);

  function render(entries) {
    if (!entries.length) {
      listEl.innerHTML = '<li class="pub-loading">No entries in publications.bib yet.</li>';
      return;
    }
    listEl.innerHTML = "";
    entries.forEach(function (e) { listEl.appendChild(renderEntry(e)); });
  }

  function renderEntry(e) {
    var li = document.createElement("li");
    li.className = "pub";

    var thumb =
      '<div class="pub-thumb">' +
      (e.thumb
        ? '<img src="' + esc(e.thumb) + '" alt="" onerror="this.style.visibility=\'hidden\'" />'
        : "") +
      "</div>";

    var venue = e.venue || e.journal || e.booktitle || "";
    var venueLine = [venue ? "<em>" + esc(venue) + "</em>" : "", esc(e.note || ""), esc(e.year || "")]
      .filter(Boolean).join(" · ");

    var li_html =
      thumb +
      '<div class="pub-body">' +
      (e.award ? '<span class="pub-award">★ ' + esc(e.award) + "</span>" : "") +
      '<p class="pub-title">' + esc(e.title || "Untitled") + "</p>" +
      '<p class="pub-authors">' + authors(e.author) + "</p>" +
      (venueLine ? '<p class="pub-venue">' + venueLine + "</p>" : "") +
      links(e) +
      "</div>";

    li.innerHTML = li_html;
    return li;
  }

  function authors(raw) {
    if (!raw) return "";
    return raw.split(/\s+and\s+/).map(function (a) {
      var name = formatName(a);
      return MY.indexOf(norm(name)) !== -1 || matchesMe(name)
        ? "<u>" + esc(name) + "</u>"
        : esc(name);
    }).join(", ");
  }

  // "Last, First" -> "First Last"
  function formatName(a) {
    a = a.trim();
    if (a.indexOf(",") !== -1) {
      var p = a.split(",");
      return (p[1] || "").trim() + " " + (p[0] || "").trim();
    }
    return a;
  }

  function matchesMe(name) {
    var n = norm(name);
    return MY.some(function (k) { return n.indexOf(k) !== -1 || k.indexOf(n) !== -1; });
  }

  function links(e) {
    var defs = [
      ["pdf", "PDF"], ["url", "Link"], ["arxiv", "arXiv"],
      ["code", "Code"], ["slides", "Slides"]
    ];
    var out = defs
      .filter(function (d) { return e[d[0]] && e[d[0]] !== "#"; })
      .map(function (d) {
        return '<a href="' + esc(e[d[0]]) + '" target="_blank" rel="noopener">' + d[1] + "</a>";
      });
    return out.length ? '<p class="pub-links">' + out.join(" · ") + "</p>" : "";
  }

  function norm(s) { return (s || "").toLowerCase().replace(/[.\s]+/g, " ").trim(); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
