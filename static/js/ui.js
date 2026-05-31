// ui.js — renders result cards with per-card tolerance slider
// Non-module version for direct file:// usage via open index.html

function renderResults(results, container, onFocus, onTolChange, onLigandToggle) {
  if (!results.length) {
    container.innerHTML = '<div class="state-empty">No results.</div>';
    return;
  }

  container.innerHTML = results.map((r, idx) => resultCard(r, idx)).join('');

  // View buttons
  container.querySelectorAll('.btn-view-sphere').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();

      const r = results[parseInt(btn.dataset.idx, 10)];
      if (!r) return;

      const card = btn.closest('.result-card');
      activateCardUI(container, card);

      if (onFocus) onFocus(r);
    });
  });
  
  // Click anywhere on a result card to focus/show this metal site
  container.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', e => {
      // Range slider should keep its own interaction, but focusing is harmless.
      const idx = parseInt(card.dataset.resultIdx, 10);
      const r = results[idx];
      if (!r) return;

      activateCardUI(container, card);

      if (onFocus) onFocus(r);
    });
  });  

  // Per-card tolerance sliders
  container.querySelectorAll('.card-tol-slider').forEach(slider => {
    const idx = parseInt(slider.dataset.idx, 10);
    const label = slider.closest('.result-card')?.querySelector('.card-tol-value');

    slider.addEventListener('input', () => {
      const tol = parseFloat(slider.value);
      const pct = tol * 100 - 100;

      if (label) {
        label.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
      }

      if (onTolChange) onTolChange(idx, tol);
    });
  });

  // Clickable ligand chips
  container.querySelectorAll('.ligand-chip[data-ligand-key]').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();

      const idx = parseInt(chip.dataset.idx, 10);
      const key = chip.dataset.ligandKey;

      if (onLigandToggle) {
        onLigandToggle(idx, key);
      }
    });
  });

  // Pre-activate first card
  const firstCard = container.querySelector('.result-card');
  if (firstCard) firstCard.classList.add('active-card');

  const firstBtn = container.querySelector('.btn-view-sphere');
  if (firstBtn) {
    firstBtn.textContent = '⬡';
    firstBtn.classList.add('active');
  }
}

function activateCardUI(container, card) {
  if (!container || !card) return;

  container.querySelectorAll('.result-card').forEach(c => {
    c.classList.remove('active-card');
  });

  container.querySelectorAll('.btn-view-sphere').forEach(b => {
    b.textContent = '○';
    b.classList.remove('active');
  });

  card.classList.add('active-card');

  const btn = card.querySelector('.btn-view-sphere');
  if (btn) {
    btn.textContent = '⬡';
    btn.classList.add('active');
  }
}

function resultCard(r, idx) {
  const cshmEntries = Object.entries(r.cshm ?? {}).sort((a, b) => a[1] - b[1]);
  const best = cshmEntries[0];

  const blockLabel = r.block
    ? `<span style="font-size:.72rem;color:var(--text3);font-family:var(--mono)">${escapeHTML(r.block.title ?? '')}</span>`
    : '';

  const tolRawPct = ((r.bondTol ?? 1.10) * 100 - 100);
  const tolPct = (tolRawPct >= 0 ? '+' : '') + tolRawPct.toFixed(0) + '%';

  return `
<div class="result-card" data-result-idx="${idx}" data-result-key="${escapeHTML(r.key ?? '')}">
  <div class="result-card-header">
    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
      ${blockLabel}
      <span class="result-atom-label">${escapeHTML(r.metal?.label ?? '')}</span>
      <span class="result-cn-badge">CN ${r.cn}</span>
      ${best ? `
        <span class="geom-badge highlight" title="${escapeHTML(shapeNames[best[0]] ?? '')}">
          ≈ ${escapeHTML(best[0])} (${formatNumber(best[1], 2)})
        </span>` : ''}
    </div>
    <button class="btn-view-sphere" data-idx="${idx}" title="Show in 3D viewer">○</button>
  </div>

  ${cshmEntries.length ? `
  <table class="cshm-table">
    <thead>
      <tr>
        <th>Shape</th>
        <th>Name</th>
        <th>CShM</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${cshmEntries.map(([label, val]) => {
        const cls = valueClass(val);
        const pct = Math.min(100, Math.max(0, val * 5)).toFixed(1);
        const isBest = best && label === best[0];
      
        return `
        <tr title="${escapeHTML(shapeDescriptions[label] ?? shapeNames[label] ?? '')}">
          <td style="color:var(--text)">
            ${isBest ? `<strong>${escapeHTML(label)}</strong>` : escapeHTML(label)}
          </td>
          <td style="color:var(--text2)">
            ${isBest ? `<strong>${escapeHTML(shapeNames[label] ?? '')}</strong>` : escapeHTML(shapeNames[label] ?? '')}
          </td>
          <td class="${cls}">
            ${isBest ? `<strong>${formatNumber(val, 4)}</strong>` : formatNumber(val, 4)}
          </td>
          <td class="bar-cell">
            <div class="cshm-bar-bg">
              <div class="cshm-bar-fill" style="width:${pct}%"></div>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : `
  <div class="state-empty" style="padding:1rem">CShM not available for CN ${r.cn}</div>`}

  ${geometryBadgesHTML(r)}

  <div class="ligand-list">
    <span style="color:var(--text3)">Ligands:</span>
    ${(r.allLigands ?? r.ligands ?? []).map(l => ligandChip(l, r, idx)).join('')}
  </div>

  <div class="card-tol-row">
    <span class="card-tol-label">Bond tol.</span>
    <input type="range" class="card-tol-slider" data-idx="${idx}"
      min="0.50" max="1.80" step="0.01" value="${r.bondTol ?? 1.10}">
    <span class="card-tol-value">${tolPct}</span>
  </div>
</div>`;
}

function geometryBadgesHTML(r) {
  const geom = r.geom ?? {};
  const items = [];

  if (hasGeomValue(geom['τ₄'])) {
    items.push(['τ₄', geom['τ₄']]);
  }

  if (hasGeomValue(geom["τ₄'"])) {
    items.push(["τ₄'", geom["τ₄'"]]);
  }

  if (hasGeomValue(geom['τ₅'])) {
    items.push(['τ₅', geom['τ₅']]);
  }

  if (hasGeomValue(geom['O'])) {
    items.push(['O', geom['O']]);
  }
  
  if (hasGeomValue(geom['τ₆(largest)'])) {
    items.push(['τ₆(largest)', geom['τ₆(largest)']]);
  }
  
  if (hasGeomValue(geom['τ₆(smallest)'])) {
    items.push(['τ₆(smallest)', geom['τ₆(smallest)']]);
  }
  
  if (hasGeomValue(geom['θ₆(smallest) /°'])) {
    items.push(['θ₆(smallest) /°', geom['θ₆(smallest) /°']]);
  }
  
  if (hasGeomValue(geom['V /Å³'])) {
    items.push(['V /Å³', geom['V /Å³']]);
  }

  if (!items.length) return '';

  return `
  <div class="geom-badges">
    ${items.map(([k, v]) => `
      <span class="geom-badge">
        <span class="geom-key">${escapeHTML(k)}</span>
        <span class="geom-eq">=</span>
        <span class="geom-val">${formatGeomValue(v)}</span>
      </span>
    `).join('')}
  </div>`;
}

function hasGeomValue(v) {
  return v !== null && v !== undefined && v !== '';
}

function ligandChip(l, r, idx) {
  const label = escapeHTML(l.label ?? '');
  const dist = Number.isFinite(l.distance) ? ` · ${l.distance.toFixed(3)} Å` : '';

  const keyRaw = typeof ligandKey === 'function'
    ? ligandKey(l)
    : fallbackLigandKey(l);

  const isActive = r.selectedLigandKeys
    ? r.selectedLigandKeys.has(keyRaw)
    : true;

  const isSymOp = l.symop && l.symop !== 'x,y,z';
  const isTransl = !isSymOp && (l.tx || l.ty || l.tz);

  const badge = isSymOp
    ? `<span class="symop-tag" title="${escapeHTML(l.symop)} [${l.tx ?? 0},${l.ty ?? 0},${l.tz ?? 0}]">sym</span>`
    : isTransl
      ? `<span class="symop-tag" title="[${l.tx ?? 0},${l.ty ?? 0},${l.tz ?? 0}]">+T</span>`
      : '';

  return `<span class="ligand-chip ${isActive ? 'active' : 'inactive'}"
      data-idx="${idx}"
      data-ligand-key="${escapeHTML(keyRaw)}"
      title="${label}${escapeHTML(dist)} · click to toggle">
      ${label}${badge}
    </span>`;
}

function fallbackLigandKey(l) {
  return [
    l.label ?? '',
    l.element ?? '',
    l.symopIdx ?? 0,
    l.symop ?? 'x,y,z',
    l.tx ?? 0,
    l.ty ?? 0,
    l.tz ?? 0,
    Number(l.x).toFixed(4),
    Number(l.y).toFixed(4),
    Number(l.z).toFixed(4),
  ].join('|');
}

function valueClass(val) {
  if (val < 1) return 'val-good';
  if (val < 3) return 'val-mid';
  return 'val-poor';
}

function formatNumber(v, digits) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(digits);
}

function formatGeomValue(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(4);
  if (v === null || v === undefined) return '';
  return escapeHTML(String(v));
}

function escapeHTML(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Shape names matching Python labels/order:
//
// CN2:
//   L-2, vT-2, vOC-2
// CN3:
//   TP-3, vT-3, fvOC-3, mvOC-3
// CN4:
//   SP-4, T-4, SS-4, vTBPY-4
// CN5:
//   PP-5, vOC-5, TBPY-5, SPY-5, JTBPY-5
// CN6:
//   HP-6, PPY-6, OC-6, TPR-6, JPPY-6

const shapeNames = {
  // CN 2
  'L-2':       'Linear',
  'vT-2':      'V-shape, 109.47°',
  'vOC-2':     'L-shape, 90°',

  // CN 3
  'TP-3':      'Trigonal planar',
  'vT-3':      'Trigonal pyramidal',
  'fvOC-3':    'fac-trivacant octahedron',
  'mvOC-3':    'T-shape',

  // CN 4
  'SP-4':      'Square planar',
  'T-4':       'Tetrahedron',
  'SS-4':      'Seesaw',
  'vTBPY-4':   'Trigonal pyramidal',

  // CN 5
  'PP-5':      'Pentagon',
  'vOC-5':     'Vacant octahedron',
  'TBPY-5':    'Trigonal bipyramidal',
  'SPY-5':     'Square pyramidal',
  'JTBPY-5':   'Johnson trigonal bipyramid',

  // CN 6
  'HP-6':      'Hexagon',
  'PPY-6':     'Pentagonal pyramid',
  'OC-6':      'Octahedron',
  'TPR-6':     'Trigonal prism',
  'JPPY-6':    'Johnson pentagonal pyramid',
};

const shapeDescriptions = {
  // CN 2
  'L-2':       'Linear coordination',
  'vT-2':      'Divacant tetrahedron, V-shape, ideal angle ca. 109.47°',
  'vOC-2':     'Tetravacant octahedron, L-shape, ideal angle ca. 90°',

  // CN 3
  'TP-3':      'Trigonal planar coordination',
  'vT-3':      'Vacant tetrahedron, trigonal pyramidal coordination',
  'fvOC-3':    'fac-trivacant octahedron',
  'mvOC-3':    'mer-trivacant octahedron, T-shaped coordination',

  // CN 4
  'SP-4':      'Square planar coordination',
  'T-4':       'Tetrahedral coordination',
  'SS-4':      'Seesaw coordination',
  'vTBPY-4':   'Axially vacant trigonal bipyramid, trigonal pyramidal',

  // CN 5
  'PP-5':      'Pentagonal planar coordination',
  'vOC-5':     'Vacant octahedron, Johnson square pyramid J1',
  'TBPY-5':    'Trigonal bipyramidal coordination',
  'SPY-5':     'Square pyramidal coordination',
  'JTBPY-5':   'Johnson trigonal bipyramid J12',

  // CN 6
  'HP-6':      'Hexagonal planar coordination',
  'PPY-6':     'Pentagonal pyramidal coordination',
  'OC-6':      'Octahedral coordination',
  'TPR-6':     'Trigonal prismatic coordination',
  'JPPY-6':    'Johnson pentagonal pyramid J2',
};