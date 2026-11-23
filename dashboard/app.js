// Graduation Radar dashboard: renders window.RADAR (written by main.ts as data.js).
// No network, no fetch: everything on this page comes from that one script.
// Hash state drives the views, so a link can open a detail or a filtered board:
//   #detail=<slug>            one protocol's detail view
//   #tier=soon|watch|early    the board filtered to one tier
//   #q=<text>                 the board searched
//   #sort=prob|tvl|growth|age the board sorted another way
(function () {
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'No radar data (data.js missing).'; return; }
  var rows = D.rows.slice();
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(n) { return (n === null || n === undefined) ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tierLabel(t) { return t === 'soon' ? 'Graduating soon' : t === 'watch' ? 'On watch' : 'Early'; }

  // Header stats.
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
    '<div class="stat"><b>' + D.tier_counts.soon + '</b><span>graduating soon</span></div>' +
    '<div class="stat"><b>' + D.watchlist_size + '</b><span>watchlist covered</span></div>' +
    '<div class="stat"><b>' + D.early_size + '</b><span>early finds</span></div>';
  document.getElementById('asof').textContent = D.as_of;
  document.getElementById('modelv').textContent = D.model_version + ' (base ×' + D.model.base_multiple + ')';
  document.getElementById('src').textContent = D.source;

  // Category filter options, from the data.
  var cats = {};
  rows.forEach(function (r) { if (r.category) cats[r.category] = 1; });
  var catSel = document.getElementById('cat');
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
  });

  // Tier chips.
  var chips = document.getElementById('tierChips');
  [['soon', 'Graduating soon'], ['watch', 'On watch'], ['early', 'Early']].forEach(function (pair) {
    var b = document.createElement('button');
    b.className = 'chip'; b.textContent = pair[1] + ' (' + D.tier_counts[pair[0]] + ')';
    b.setAttribute('aria-pressed', 'false'); b.dataset.tier = pair[0];
    b.onclick = function () {
      var sel = document.getElementById('tier');
      sel.value = sel.value === pair[0] ? '' : pair[0];
      render();
    };
    chips.appendChild(b);
  });

  function readHash() {
    var h = {};
    location.hash.slice(1).split('&').forEach(function (kv) {
      var p = kv.split('='); if (p[0]) h[p[0]] = decodeURIComponent(p[1] || '');
    });
    return h;
  }
  var hash = readHash();
  if (hash.tier) document.getElementById('tier').value = hash.tier;
  if (hash.q) document.getElementById('q').value = hash.q;
  if (hash.sort) document.getElementById('sort').value = hash.sort;

  function filtered() {
    var q = document.getElementById('q').value.trim().toLowerCase();
    var tier = document.getElementById('tier').value;
    var cat = catSel.value;
    var sort = document.getElementById('sort').value;
    var list = rows.filter(function (r) {
      if (tier && r.graduation_tier !== tier) return false;
      if (cat && r.category !== cat) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      prob: function (a, b) { return b.graduation_probability - a.graduation_probability || a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0) || a.rank - b.rank; },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0) || a.rank - b.rank; },
    };
    list.sort(by[sort] || by.rank);
    return list;
  }

  function rowHtml(r) {
    var g = r.change_7d;
    var cls = g === null ? '' : g >= 0 ? 'up' : 'down';
    return '<tr data-slug="' + esc(r.slug) + '">' +
      '<td>' + r.rank + '</td>' +
      '<td><div class="name">' + esc(r.name) + '</div><div class="cat">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.slug) + '</div></td>' +
      '<td><span class="tier ' + r.graduation_tier + '">' + tierLabel(r.graduation_tier) + '</span>' +
      '<div class="prob"><span class="bar"><i style="width:' + Math.round(r.graduation_probability * 100) + '%"></i></span><b>' + Math.round(r.graduation_probability * 100) + '%</b></div></td>' +
      '<td>' + esc(r.graduation_window) + '</td>' +
      '<td class="num">' + money(r.implied_value_usd) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + cls + '">' + pct(g) + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td></tr>';
  }

  function render() {
    var list = filtered();
    var shown = list.slice(0, 60);
    document.getElementById('rows').innerHTML = shown.map(rowHtml).join('');
    document.getElementById('count').textContent =
      list.length + ' of ' + rows.length + ' protocols match' + (list.length > 60 ? ' — showing the first 60, narrow the filters to see more.' : '.');
    document.getElementById('more').textContent = '';
    chips.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.tier === document.getElementById('tier').value));
    });
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.onclick = function () { showDetail(tr.dataset.slug); };
    });
  }

  function sigRow(label, v) {
    return '<div><span>' + label + '</span><span class="bar"><i style="width:' + Math.round(v * 100) + '%"></i></span><b>' + v.toFixed(2) + '</b></div>';
  }

  function showDetail(slug) {
    var r = bySlug[slug];
    var box = document.getElementById('detail');
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    // Signal bars need the model's raw signals; data.js carries the compact
    // row, so scale/momentum/staying/breadth are re-derived here from the
    // same figures the model used (TVL, 7d change, age, chain count).
    var scale = Math.min(Math.max(Math.log10(Math.max(r.tvl_usd, 1) / Math.max(D.floor_usd, 1)) / 2, 0), 1);
    var momentum = Math.min(Math.max(((Math.min(Math.max(r.change_7d || 0, -50), 100)) + 50) / 150, 0), 1);
    var staying = Math.min(Math.max((r.age_days === null ? 365 : r.age_days), 0), 1095) / 1095;
    var breadth = Math.min(r.chains.length / 8, 1);
    box.hidden = false;
    box.innerHTML =
      '<button class="close" id="closeDetail">Close</button>' +
      '<h2>#' + r.rank + ' ' + esc(r.name) + ' <span class="tier ' + r.graduation_tier + '">' + tierLabel(r.graduation_tier) + '</span></h2>' +
      '<p class="muted">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') + ' · records no token.</p>' +
      '<div class="grid"><div>' +
      '<dl class="kv">' +
      '<dt>Graduation probability</dt><dd>' + Math.round(r.graduation_probability * 100) + '% — ' + tierLabel(r.graduation_tier).toLowerCase() + '</dd>' +
      '<dt>Estimated window</dt><dd>' + esc(r.graduation_window) + ' (a bucket of the probability, not a date)</dd>' +
      '<dt>Implied value</dt><dd>' + money(r.implied_value_usd) + ' if it graduates at today\u2019s record</dd>' +
      '<dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + pct(r.change_7d) + ' (growth ×' + r.growth_multiplier.toFixed(2) + ')</dd>' +
      '<dt>Age with no token</dt><dd>' + (r.age_days === null ? 'unknown — counted as 365 days' : r.age_days + ' days') + ' (maturity ×' + r.maturity_multiplier.toFixed(2) + ')</dd>' +
      '</dl>' +
      '<h2>Why this probability</h2><div class="sig">' +
      sigRow('Scale (TVL vs floor)', scale) + sigRow('Momentum (7d change)', momentum) +
      sigRow('Staying power (age)', staying) + sigRow('Breadth (chains)', breadth) +
      '</div><p class="muted">Implied = TVL × 0.30 × (0.50 + probability) × growth × maturity × breadth. Every input above comes from the snapshot.</p>' +
      '</div><div><h2>How to farm it</h2><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol></div></div>';
    document.getElementById('closeDetail').onclick = function () { box.hidden = true; box.innerHTML = ''; };
    box.scrollIntoView({ block: 'start' });
  }

  // Live-token reference table.
  document.getElementById('liveRows').innerHTML = D.live.map(function (p) {
    var g = p.change_7d;
    return '<tr><td><div class="name">' + esc(p.name) + '</div><div class="cat">' + esc(p.category || 'Uncategorised') + '</div></td>' +
      '<td class="num">' + (p.mcap_usd === null ? '—' : money(p.mcap_usd)) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num ' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + pct(g) + '</td></tr>';
  }).join('');

  ['q', 'tier', 'cat', 'sort'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });
  window.addEventListener('hashchange', function () { render(); });

  render();
  if (hash.detail) showDetail(hash.detail);
})();
