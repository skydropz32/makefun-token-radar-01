// Token Radar radar-3 dashboard. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail drawer with the model's own inputs, its nearest peers
// and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the fitted
  // line and the priors and checks the number board.json carries, so the
  // page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var fit = DATA.fit;
    var p = DATA.priors;
    var growth = Math.min(p.growthCap, Math.max(p.growthFloor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var tilt = 1 + (growth / 100) * p.growthTilt;
    var age = row.age_days === null || row.age_days === undefined ? p.unknownAgeDays : row.age_days;
    var maturity = p.maturityFloor + (Math.log(1 + Math.min(Math.max(age, 0), p.maturityDays)) / Math.log(1 + p.maturityDays)) * p.maturityRange;
    var chainMult = 1 + p.chainStep * Math.min(Math.max((row.chains || []).length - 1, 0), p.chainMaxExtra);
    var c = (row.category || '').toLowerCase();
    var sector = (c.indexOf('lend') >= 0 || c.indexOf('dex') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('yield') >= 0) ? 1.05
      : (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('rwa') >= 0) ? 1.02 : 1.0;
    var logValue = fit ? fit.intercept + fit.slope * Math.log(Math.max(row.tvl_usd, 1))
      : Math.log(Math.max(Math.pow(Math.max(row.tvl_usd, 1), 0.92) * 0.62, 1));
    return Math.max(1, Math.round(Math.exp(logValue) * tilt * maturity * chainMult * sector));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and implied value decide the action, the capital,
  // the hold, the cadence and the totals step. No name is special-cased.
  function chainOf(p) {
    if (!p.chains || p.chains.length === 0) return 'ethereum';
    var eth = p.chains.filter(function (c) { return c.toLowerCase().indexOf('ethereum') >= 0; })[0];
    return eth ? 'ethereum' : p.chains[0].toLowerCase();
  }
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('solana') >= 0) return '$0.10';
    if (c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('unichain') >= 0) return '$0.50';
    if (c.indexOf('ethereum') >= 0) return '$4.00';
    return '$2.00';
  }
  function gasDollarsFor(chain) { return parseFloat(gasFor(chain).replace('$', '')); }
  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return '$10,000';
    if (p.tvl_usd >= 1e8) return '$5,000';
    return '$1,000';
  }
  function holdDaysFor(p) {
    if (p.tvl_usd >= 1e9) return 60;
    if (p.tvl_usd >= 1e8) return 30;
    return 14;
  }
  function tvlTier(p) {
    if (p.tvl_usd >= 1e9) return 'large';
    if (p.tvl_usd >= 1e8) return 'mid';
    return 'small';
  }
  function cadenceFor(tier) {
    if (tier === 'large') return { every: 'every week', days: 7 };
    if (tier === 'mid') return { every: 'every two weeks', days: 14 };
    return { every: 'once a month', days: 30 };
  }
  function actionFor(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var cap = capitalFor(p);
    if (/lend|borrow|yield|vault|allocator|curator|restaking|restake/i.test(c)) return 'deposit ' + cap + ' of stables as a lender';
    if (/dex|perp|deriv|options/i.test(c)) return 'open one small hedged trade in the app';
    if (/bridge/i.test(c)) return 'move ' + cap + ' across one supported chain';
    if (/rwa/i.test(c)) return 'subscribe ' + cap + ' to the product on the app';
    if (/stablecoin|stable/i.test(c)) return 'mint ' + cap + ' of the stablecoin and hold it';
    return 'use the ' + name + ' app at least once';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var gas = gasFor(chain);
    var gasN = gasDollarsFor(chain);
    var capital = capitalFor(p);
    var holdDays = holdDaysFor(p);
    var tier = tvlTier(p);
    var cadence = cadenceFor(tier);
    var secondAction = actionFor(p);
    var cadenceActions = Math.max(1, Math.round(holdDays / cadence.days));
    var gasTx = 1 + 1 + cadenceActions + 2;
    var gasTotal = gasTx * gasN;
    var totalDays = holdDays + 14;
    var cadenceNote = tier === 'small' ? 'never leave it idle for two months' : 'never leave it idle for a whole month';
    return [
      { text: 'Create a fresh wallet for this airdrop and never reuse it for another protocol\'s farm.', cost: '$0.00', time: '10 minutes' },
      { text: 'Connect that wallet to ' + p.name + ' on ' + chain + ' and deposit ' + capital + ' of stablecoins.', cost: gas + ' of gas', time: '20 minutes' },
      { text: 'Then ' + secondAction + ' on ' + chain + ' so the wallet shows more than a deposit alone.', cost: gas + ' of gas', time: '20 minutes' },
      { text: 'Make one qualifying action ' + cadence.every + ' - a deposit, a borrow, a swap or a vote - so the wallet shows steady activity across snapshots; ' + cadenceNote + '.', cost: gas + ' of gas per action', time: holdDays + ' days' },
      { text: 'Keep ' + capital + ' in the protocol for ' + holdDays + ' days and do not withdraw early, because early exits usually reset points.', cost: '$0.00', time: holdDays + ' days' },
      { text: 'Before you withdraw, open ' + p.name + '\'s own points or rewards page from its app ' + cadence.every + ' and claim only from the link it publishes; never pay anyone to claim for you.', cost: '$0.00', time: '10 minutes' },
      { text: 'Write down every transaction hash, the dates, and the balances, because airdrop support asks for proof.', cost: '$0.00', time: '5 minutes' },
      { text: 'Total for this plan: about $' + gasTotal.toFixed(2) + ' of gas across ' + gasTx + ' transactions, ' + capital + ' of capital held for ' + holdDays + ' days, plus 2 weeks to unwind. The position is worth farming while the implied value is $' + p.implied_value_usd.toLocaleString('en-US') + '.', cost: '$' + gasTotal.toFixed(2) + ' of gas across the whole plan', time: totalDays + ' days from first deposit to unwound' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('mintvl')) state.minTvl = Number(params.get('mintvl')) || 0;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.minTvl) params.set('mintvl', String(state.minTvl));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function hero() {
    var top = DATA.rows.slice(0, 3);
    var total = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var cards = top.map(function (r) {
      var card = el('div', { class: 'spot-card', tabindex: '0' });
      card.addEventListener('click', function () { openDetail(r.slug); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDetail(r.slug); });
      card.appendChild(el('span', { class: 'rank', text: '#' + r.rank }));
      var mid = el('div', null, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' - ' + fmtUsd(r.tvl_usd) + ' TVL - ' + fmtPct(r.change_7d) + ' in 7d' }));
      card.appendChild(mid);
      card.appendChild(el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) }));
      return card;
    });
    var intro = el('div', null,
      el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
      el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor - ' + DATA.board_size + ' rows in all, worth ' + fmtUsd(total) + ' of implied value. Implied value is a model, not a promise.' }),
      el('p', { class: 'note', text: '"No token" means the protocol records no token in DefiLlama - not that it has none. Wrapped, staked, bridged and exchange products are excluded from the ranking.' })
    );
    var spot = el('div', { class: 'spot' });
    cards.forEach(function (c) { spot.appendChild(c); });
    return el('section', { class: 'hero' }, intro, spot);
  }

  function facts() {
    var med = DATA.rows.slice().sort(function (a, b) { return a.implied_value_usd - b.implied_value_usd; })[Math.floor(DATA.rows.length / 2)];
    return el('div', { class: 'facts' },
      el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
      el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
      el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
      el('div', { class: 'fact' }, el('span', { text: 'Median implied value' }), el('b', { text: med ? fmtUsd(med.implied_value_usd) : 'n/a' }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var tvl = el('select', { id: 'mintvl', 'aria-label': 'Minimum TVL' },
      el('option', { value: '0', text: 'Any TVL' }),
      [['50000000', '$50M+'], ['100000000', '$100M+'], ['500000000', '$500M+'], ['1000000000', '$1B+']].map(function (o) { return el('option', { value: o[0], text: o[1], selected: String(state.minTvl) === o[0] ? 'selected' : null }); })
    );
    tvl.addEventListener('change', function () { state.minTvl = Number(tvl.value) || 0; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chain),
      el('div', { class: 'field' }, el('label', { for: 'mintvl', text: 'Min TVL' }), tvl),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var f = DATA.fit;
    var p = DATA.priors;
    var fitLine = f
      ? 'log(market cap) = ' + f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) + ' x log(TVL), fit by least squares on ' + f.nComps + ' live-token peers from the same snapshot.'
      : 'No fit: fewer than 10 live-token peers carry a recorded market cap, so the board falls back to the radar-2 base.';
    var validLine = f
      ? 'Validation on the peers: R-squared ' + f.r2.toFixed(2) + '; rank correlation held out 5-fold ' + f.cvSpearman.toFixed(2) + ', 80/20 split ' + f.holdoutSpearman.toFixed(2) + ', walk-forward ' + (f.walkForwardSpearman === null ? 'n/a' : f.walkForwardSpearman.toFixed(2)) + '. Market-cap levels are not predictable from these figures, so the model is judged on ranking, which is what a board is.'
      : '';
    var ratioLine = f
      ? 'The peers\' market cap is ' + f.medianRatio.toFixed(2) + 'x their TVL at the median (25th ' + f.ratioP25.toFixed(2) + 'x, 75th ' + f.ratioP75.toFixed(2) + 'x).'
      : '';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed — model ' + DATA.model_version }),
      el('p', { class: 'sub', text: 'The value line is fitted, not hand-tuned. Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        el('b', { text: 'implied = round( exp( ' + (f ? f.intercept.toFixed(2) + ' + ' + f.slope.toFixed(2) + ' x log(TVL)' : 'log(TVL) x 0.92 + log(0.62)') + ' ) x growth tilt x maturity x chain x sector )' }),
        el('div', { text: 'growth tilt = 1 + clamp(change_7d, ' + p.growthFloor + ', ' + p.growthCap + ') / 100 x ' + p.growthTilt + '; maturity = ' + p.maturityFloor + ' + ' + p.maturityRange + ' x ln(1 + age) / ln(1 + ' + p.maturityDays + '); chain = 1 + 0.04 per extra chain (max 4); sector 1.05 for Lending, Dexs, Derivatives and Yield, 1.02 for curators, allocators and RWA, else 1.00' }),
        el('div', { text: fitLine }),
        el('div', { text: validLine }),
        el('div', { text: ratioLine })
      ),
      el('p', { class: 'sub', text: 'Growth, age, chain count and sector enter as small bounded priors the bounty names: their fitted coefficients on the peers come out negative and unstable, and fitting them makes held-out ranking worse, so the model does not pretend to fit them. TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + p.unknownAgeDays + ' days. Excluded from the ranking: centralised exchanges, bridges, liquid staking and restaking, wrapped or staked products, versioned pools and exchange-branded products — the same rule the watchlist uses. This is an estimate, not a price, and it never predicts whether or when a token is issued.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Fitted value at this TVL' }), el('b', { class: 'num', text: fmtUsd(Math.round(Math.exp(row.log_value))) })),
        el('div', null, el('span', { text: 'Growth tilt' }), el('b', { class: 'num', text: String(row.growth_tilt) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Sector multiplier' }), el('b', { class: 'num', text: String(row.sector_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row)) + (impliedOf(row) === row.implied_value_usd ? ', the same number board.json carries.' : ' — the page and the board differ by the tie-break of 1, so the board value stands.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 8 steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (row.peers && row.peers.length) {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Nearest live-token peers' }),
        el('div', { class: 'equation' }, row.peers.map(function (peer) {
          return el('div', null, el('span', { text: peer.name }), el('b', { class: 'num', text: fmtUsd(peer.mcap_usd) + ' on ' + fmtUsd(peer.tvl_usd) + ' TVL' }));
        })),
        el('p', { class: 'sub', text: 'The three live-token protocols closest to this one by TVL, age, chain count and sector. Their actual market caps are what the fitted line is built from, so they anchor this row.' })
      ));
    }
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(facts());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
