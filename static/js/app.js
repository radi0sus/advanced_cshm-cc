// app.js
// Non-module version for direct file:// usage via open index.html
// CIF and XYZ are both loaded as structure files via the dropzone/file picker.

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  blocks:         [],
  sourceType:     null,
  metals:         [],    // [{ atom, block, key, bondTol }]
  selectedMetals: new Set(),
  results:        [],
  includeH:       false,
  includeMM:      false,
  activeKey:      null,
};

// ── DOM ───────────────────────────────────────────────────────────────────────
const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const clearBtn     = document.getElementById('btn-clear');
const toggleH      = document.getElementById('toggle-hydrogen');
const toggleMM     = document.getElementById('toggle-metal-metal');
const exportMdBtn  = document.getElementById('btn-export-csv'); // button text should be "↓ MD"
const exportXyzBtn = document.getElementById('btn-export-xyz');
const resultsPanel = document.getElementById('results-content');
const tagList      = document.getElementById('metal-tag-list');
const statusText   = document.getElementById('status-text');
const statusDot    = document.getElementById('status-dot');

// ── Init ──────────────────────────────────────────────────────────────────────
// Viewer init must not prevent the rest of the app from working.
try {
  if (typeof initViewer === 'function') {
    initViewer('molviewer');
  } else {
    console.warn('initViewer not available');
  }
} catch (e) {
  console.warn('Viewer init failed:', e);
}

setStatus('Ready', 'idle');

// ── Drag & Drop / file picker ─────────────────────────────────────────────────
if (dropzone) {
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');

    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  });

  dropzone.addEventListener('click', () => {
    if (fileInput) fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadFile(file);
  });
}

// ── Controls ──────────────────────────────────────────────────────────────────
if (toggleH) {
  toggleH.addEventListener('change', () => {
    state.includeH = toggleH.checked;

    if (state.blocks.length) {
      runCalculation();
    }
  });
}

if (toggleMM) {
  toggleMM.addEventListener('change', () => {
    state.includeMM = toggleMM.checked;

    if (state.blocks.length) {
      runCalculation();
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', clearAll);
}

if (exportMdBtn) {
  exportMdBtn.addEventListener('click', () => {
    if (typeof exportMarkdown === 'function') {
      exportMarkdown(state.results);
    } else if (typeof exportCSV === 'function') {
      // Backward-compatible alias if export.js still exposes exportCSV().
      exportCSV(state.results);
    } else {
      setStatus('Markdown export not available', 'err');
    }
  });
}

if (exportXyzBtn) {
  exportXyzBtn.addEventListener('click', () => {
    if (typeof exportXYZ === 'function') {
      exportXYZ(state.results);
    } else {
      setStatus('XYZ export not available', 'err');
    }
  });
}

// ── File loading ──────────────────────────────────────────────────────────────
async function loadFile(file) {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();

  setStatus('Loading ' + file.name + '…', 'idle');

  try {
    const text = await file.text();

    if (ext === 'cif') {
      if (typeof parseCIF !== 'function') {
        setStatus('CIF parser not loaded', 'err');
        return;
      }

      state.blocks = parseCIF(text);
      state.sourceType = 'cif';
    }

    else if (ext === 'xyz') {
      if (typeof parseXYZ !== 'function') {
        setStatus('XYZ parser not loaded', 'err');
        return;
      }

      state.blocks = parseXYZ(text);
      state.sourceType = 'xyz';
    }

    else {
      setStatus('Unsupported file type: .' + ext, 'err');
      return;
    }

    await afterLoad();

    const atomCount = state.blocks.reduce((s, b) => s + (b.atoms?.length ?? 0), 0);
    const metalCount = state.metals.length;

    setStatus(
      `${file.name} loaded · ${atomCount} atoms · ${metalCount} metal site${metalCount !== 1 ? 's' : ''}`,
      metalCount ? 'ok' : 'err'
    );

  } catch (e) {
    setStatus('Parse error: ' + e.message, 'err');
    console.error(e);
  }
}

async function afterLoad() {
  detectMetals();
  await runCalculation();
}

// ── Metal detection ───────────────────────────────────────────────────────────
function detectMetals() {
  state.metals = [];
  state.selectedMetals.clear();
  state.activeKey = null;

  for (const block of state.blocks) {
    const seen = new Set();

    for (const atom of block.atoms ?? []) {
      const el = normaliseElementForDetection(atom.element, atom.label);

      // Update atom.element defensively.
      // This fixes XYZ cases like element = "Fe1".
      if (el) atom.element = el;

      if (TRANSITION_METALS.has(el) && !seen.has(atom.label)) {
        seen.add(atom.label);

        const key = `${block.title ?? ''}::${atom.label}`;

        state.metals.push({
          atom,
          block,
          key,
          bondTol: 1.10,
        });

        state.selectedMetals.add(key);
      }
    }
  }

  if (state.metals.length) {
    state.activeKey = state.metals[0].key;
  }

  console.log('Detected metals:', state.metals);

  renderMetalTags();
}

function normaliseElementForDetection(element, label) {
  let s = String(element ?? '').trim();

  // If element is missing or suspicious, use label.
  // Examples:
  //   element = "Fe1"  -> label fallback / normalization
  //   element = ""     -> label fallback
  //   element = "Iron" -> label fallback likely better
  if (!s || /\d/.test(s) || s.length > 2) {
    s = String(label ?? '').trim();
  }

  const m = s.match(/^([A-Za-z]{1,2})/);
  if (!m) return '';

  const raw = m[1];

  if (raw.length === 1) {
    return raw[0].toUpperCase();
  }

  return raw[0].toUpperCase() + raw[1].toLowerCase();
}

function renderMetalTags() {
  tagList.innerHTML = '';

  if (!state.metals.length) {
    tagList.innerHTML = '<span style="font-size:.73rem;color:var(--text3)">None detected</span>';
    return;
  }

  const multiBlock = state.blocks.length > 1;

  for (const m of state.metals) {
    const tag = document.createElement('span');

    tag.className = 'tag active';
    tag.dataset.key = m.key;
    tag.textContent = multiBlock ? `${m.block.title}: ${m.atom.label}` : m.atom.label;
    tag.title = `${m.atom.element} — click to toggle`;

    tag.addEventListener('click', () => {
      const was = state.selectedMetals.has(m.key);

      if (was) {
        state.selectedMetals.delete(m.key);
      } else {
        state.selectedMetals.add(m.key);
      }

      tag.classList.toggle('active', !was);

      state.activeKey = m.key;
      highlightActiveTag();
      runCalculation();
    });

    tagList.appendChild(tag);
  }

  highlightActiveTag();
}

function highlightActiveTag() {
  tagList.querySelectorAll('.tag').forEach(t => {
    t.classList.toggle('viewer-focus', t.dataset.key === state.activeKey);
  });
}

// ── Calculation ───────────────────────────────────────────────────────────────
async function runCalculation() {
  if (!state.blocks.length) return;

  setStatus('Calculating…', 'idle');

  // Let browser update status before potentially expensive calculation.
  await new Promise(r => setTimeout(r, 0));

  try {
    state.results = [];

    for (const m of state.metals) {
      if (!state.selectedMetals.has(m.key)) continue;

      if (typeof findNeighbors !== 'function') {
        throw new Error('Neighbor search not loaded');
      }

      if (typeof calcCShM !== 'function') {
        throw new Error('CShM calculation not loaded');
      }

      if (typeof calcGeometry !== 'function') {
        throw new Error('Geometry calculation not loaded');
      }

      const ligands = findNeighbors(m.block, m.atom, {
        includeH:       state.includeH,
        includeMetals:  state.includeMM,
        sourceType:     state.sourceType,
        bondTol:        m.bondTol,
      });

      const selectedLigandKeys = new Set(ligands.map(ligandKey));
      const activeLigands = ligands.filter(l => selectedLigandKeys.has(ligandKey(l)));

      state.results.push({
        metal:   m.atom,
        block:   m.block,
        key:     m.key,
        bondTol: m.bondTol,

        allLigands: ligands,
        selectedLigandKeys,
        ligands: activeLigands,

        cshm: activeLigands.length >= 2 ? calcCShM(m.atom, activeLigands) : {},
        geom: activeLigands.length >= 2 ? calcGeometry(m.atom, activeLigands) : {},
        cn:   activeLigands.length,
      });
    }

    renderResults(state.results, resultsPanel, onCardFocus, onTolChange, onLigandToggle);

    const first = state.results.find(r => r.key === state.activeKey) ?? state.results[0];

    if (first) {
      showInViewer(first);
      state.activeKey = first.key;
      highlightActiveTag();
    } else {
      hideViewer();
    }

    const n = state.results.length;
    const total = state.blocks.reduce((s, b) => s + (b.atoms?.length ?? 0), 0);

    setStatus(
      `${n} site${n !== 1 ? 's' : ''} · ${state.blocks.length} block${state.blocks.length !== 1 ? 's' : ''} · ${total} atoms`,
      n ? 'ok' : 'err'
    );

    if (exportMdBtn)  exportMdBtn.disabled = !n;
    if (exportXyzBtn) exportXyzBtn.disabled = !n;

  } catch (e) {
    setStatus('Error: ' + e.message, 'err');

    resultsPanel.innerHTML = `
      <div class="state-empty" style="color:var(--danger)">
        Error: ${escapeHTMLForStatus(e.message)}
      </div>
    `;

    console.error(e);
  }
}

// Per-card tolerance change: update that metal's bondTol, recalc only that site
let tolTimers = {};

function onTolChange(resultIdx, tol) {
  const r = state.results[resultIdx];
  if (!r) return;

  const m = state.metals.find(m => m.key === r.key);

  if (m) {
    m.bondTol = tol;
  }

  r.bondTol = tol;

  clearTimeout(tolTimers[resultIdx]);

  tolTimers[resultIdx] = setTimeout(async () => {
    const m2 = state.metals.find(m => m.key === r.key);
    if (!m2) return;

    const ligands = findNeighbors(m2.block, m2.atom, {
      includeH:       state.includeH,
      includeMetals:  state.includeMM,
      sourceType:     state.sourceType,
      bondTol:        tol,
    });

    const selectedLigandKeys = new Set(ligands.map(ligandKey));
    const activeLigands = ligands.filter(l => selectedLigandKeys.has(ligandKey(l)));

    r.allLigands = ligands;
    r.selectedLigandKeys = selectedLigandKeys;
    r.ligands = activeLigands;
    r.cn      = activeLigands.length;
    r.cshm    = activeLigands.length >= 2 ? calcCShM(m2.atom, activeLigands) : {};
    r.geom    = activeLigands.length >= 2 ? calcGeometry(m2.atom, activeLigands) : {};

    renderResults(state.results, resultsPanel, onCardFocus, onTolChange, onLigandToggle);

    if (r.key === state.activeKey) {
      showInViewer(r);
    }
    
    setStatus(
      `${m2.atom.label}: bond tolerance ${formatTolPercent(tol)} · CN ${activeLigands.length}`,
      activeLigands.length >= 2 ? 'ok' : 'err'
    );   
    
  }, 250);
}

function onLigandToggle(resultIdx, key) {
  const r = state.results[resultIdx];
  if (!r || !key) return;

  if (!r.allLigands) {
    r.allLigands = r.ligands ?? [];
  }

  if (!r.selectedLigandKeys) {
    r.selectedLigandKeys = new Set((r.ligands ?? []).map(ligandKey));
  }

  // Toggle ligand
  if (r.selectedLigandKeys.has(key)) {
    r.selectedLigandKeys.delete(key);
  } else {
    r.selectedLigandKeys.add(key);
  }

  const activeLigands = r.allLigands.filter(l => r.selectedLigandKeys.has(ligandKey(l)));

  r.ligands = activeLigands;
  r.cn      = activeLigands.length;
  r.cshm    = activeLigands.length >= 2 ? calcCShM(r.metal, activeLigands) : {};
  r.geom    = activeLigands.length >= 2 ? calcGeometry(r.metal, activeLigands) : {};

  state.activeKey = r.key;

  renderResults(state.results, resultsPanel, onCardFocus, onTolChange, onLigandToggle);

  const updated = state.results[resultIdx];
  if (updated) {
    showInViewer(updated);
  }

  highlightActiveTag();

  setStatus(
    `${r.metal.label}: ${activeLigands.length}/${r.allLigands.length} ligands active · CN ${r.cn}`,
    activeLigands.length >= 2 ? 'ok' : 'err'
  );
}

function onCardFocus(result) {
  state.activeKey = result.key;
  highlightActiveTag();
  showInViewer(result);
}

function showInViewer(result) {
  if (!result) return;

  const vp = document.getElementById('viewer-placeholder');
  const mv = document.getElementById('molviewer');

  if (vp) vp.style.display = 'none';
  if (mv) mv.style.display = 'block';

  if (typeof highlightSphere === 'function') {
    highlightSphere(result.metal, result.ligands);
  } else {
    console.warn('highlightSphere not available');
  }

  markActiveResultCard(result.key);
}

function hideViewer() {
  if (typeof clearViewer === 'function') {
    clearViewer();
  }

  const vp = document.getElementById('viewer-placeholder');
  const mv = document.getElementById('molviewer');

  if (vp) vp.style.display = '';
  if (mv) mv.style.display = 'none';
}

function markActiveResultCard(key) {
  if (!key || !resultsPanel) return;

  resultsPanel.querySelectorAll('.result-card').forEach(card => {
    const isActive = card.dataset.resultKey === key;
    card.classList.toggle('active-card', isActive);

    const btn = card.querySelector('.btn-view-sphere');
    if (btn) {
      btn.textContent = isActive ? '⬡' : '○';
      btn.classList.toggle('active', isActive);
    }
  });
}

// ── Clear ─────────────────────────────────────────────────────────────────────
function clearAll() {
  state.blocks = [];
  state.sourceType = null;
  state.metals = [];
  state.selectedMetals.clear();
  state.results = [];
  state.activeKey = null;

  state.includeH = false;
  state.includeMM = false;

  if (fileInput) fileInput.value = '';

  if (toggleH) toggleH.checked = false;
  if (toggleMM) toggleMM.checked = false;

  tagList.innerHTML = '';
  resultsPanel.innerHTML = '<div class="state-empty">No results yet.</div>';

  hideViewer();

  if (exportMdBtn)  exportMdBtn.disabled = true;
  if (exportXyzBtn) exportXyzBtn.disabled = true;

  setStatus('Ready', 'idle');
}
// ── Utilities ─────────────────────────────────────────────────────────────────

function ligandKey(l) {
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

function setStatus(msg, st) {
  if (statusText) statusText.textContent = msg;

  if (statusDot) {
    statusDot.className = 'status-dot' + (
      st === 'ok'  ? ' ok'  :
      st === 'err' ? ' err' :
      ''
    );
  }
}

function escapeHTMLForStatus(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTolPercent(tol) {
  const pct = tol * 100 - 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
}