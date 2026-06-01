// viewer.js
// 3Dmol.js wrapper — 3Dmol is loaded as a global <script> in index.html
// Non-module version for direct file:// usage via open index.html

let viewer = null;
let currentScene = null;
let themeListenerInstalled = false;

// ── Init ─────────────────────────────────────────────────────────────────────

function initViewer(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof $3Dmol === 'undefined') return;

  viewer = $3Dmol.createViewer(el, {
    antialias: true,
  });

  applyViewerBackground();
  installThemeListener();
}

// ── Theme handling ───────────────────────────────────────────────────────────

function installThemeListener() {
  if (themeListenerInstalled) return;
  themeListenerInstalled = true;

  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return;

  const onChange = () => {
    applyViewerBackground();

    // Rebuild labels/colors after system theme change
    if (currentScene) {
      if (currentScene.type === 'structure') {
        renderStructure(currentScene.data, currentScene.sourceType);
      } else if (currentScene.type === 'sphere') {
        renderSphere(currentScene.centralAtom, currentScene.ligands);
      }
    } else if (viewer) {
      viewer.render();
    }
  };

  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

function getThemeColors() {
  const css = getComputedStyle(document.documentElement);

  const bg       = cssColorToNumber(css.getPropertyValue('--bg2'), 0xffffff);
  const labelBg  = cssColorToNumber(css.getPropertyValue('--bg2'), 0xffffff);
  const labelTxt = cssColorToNumber(css.getPropertyValue('--text'), 0x111827);
  const border   = cssColorToNumber(css.getPropertyValue('--border'), 0xd8dce6);
  const accent   = cssColorToNumber(css.getPropertyValue('--accent'), 0x2563eb);

  const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return {
    background: bg,
    labelBackground: labelBg,
    labelText: labelTxt,
    labelBorder: border,
    central: accent,
    bond: isDark ? 0xa0a7b5 : 0x666666,
  };
}

function applyViewerBackground() {
  if (!viewer) return;
  const colors = getThemeColors();

  // Important: do not use "transparent" as string; 3Dmol does not accept it.
  viewer.setBackgroundColor(colors.background);
}

function cssColorToNumber(value, fallback) {
  if (!value) return fallback;

  const s = String(value).trim();

  // #fff
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1] + s[1];
    const g = s[2] + s[2];
    const b = s[3] + s[3];
    return parseInt(r + g + b, 16);
  }

  // #ffffff
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {
    return parseInt(s.slice(1), 16);
  }

  // rgb(255, 255, 255) or rgba(...)
  const m = s.match(/rgba?\s*$\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (m) {
    const r = Math.max(0, Math.min(255, Math.round(parseFloat(m[1]))));
    const g = Math.max(0, Math.min(255, Math.round(parseFloat(m[2]))));
    const b = Math.max(0, Math.min(255, Math.round(parseFloat(m[3]))));
    return (r << 16) + (g << 8) + b;
  }

  return fallback;
}

// ── Public viewer functions ──────────────────────────────────────────────────

// Show full structure
function showStructure(data, sourceType) {
  currentScene = { type: 'structure', data, sourceType };
  renderStructure(data, sourceType);
}

// Highlight a coordination sphere
function highlightSphere(centralAtom, ligands) {
  currentScene = { type: 'sphere', centralAtom, ligands };
  renderSphere(centralAtom, ligands);
}

function clearViewer() {
  if (!viewer) return;

  currentScene = null;
  removeLabelsSafe();
  viewer.clear();
  applyViewerBackground();
  viewer.render();
}

// ── Rendering internals ──────────────────────────────────────────────────────

function renderStructure(data, sourceType) {
  if (!viewer) return;

  removeLabelsSafe();
  viewer.clear();
  applyViewerBackground();

  const atoms = data.atoms ?? [];
  if (!atoms.length) {
    viewer.render();
    return;
  }

  const xyz = atomsToXYZ(atoms, data.title ?? '');

  viewer.addModel(xyz, 'xyz');
  viewer.setStyle({}, {
    sphere: { radius: 0.25 },
    stick:  { radius: 0.08 },
  });

  // Full-structure labels can become unreadable for large structures.
  // Therefore labels are shown only for reasonably small structures.
  if (atoms.length <= 80) {
    for (let i = 0; i < atoms.length; i++) {
      addAtomLabel(atoms[i], false);
    }
  }

  viewer.zoomTo();
  viewer.render();
}

function renderSphere(centralAtom, ligands) {
  if (!viewer) return;

  removeLabelsSafe();
  viewer.clear();
  applyViewerBackground();

  const colors = getThemeColors();
  const all = [centralAtom, ...ligands];

  if (!all.length) {
    viewer.render();
    return;
  }

  const xyz = atomsToXYZ(all, `${centralAtom.label} CN=${ligands.length}`);

  viewer.addModel(xyz, 'xyz');

  // Central atom
  viewer.setStyle({ index: 0 }, {
    sphere: {
      radius: 0.45,
      color: colors.central,
    },
  });

  // Ligands
  for (let i = 1; i < all.length; i++) {
    viewer.setStyle({ index: i }, {
      sphere: { radius: 0.27 },
    });
  }

  // Bonds from central atom to all ligands
  for (let i = 1; i < all.length; i++) {
    viewer.addCylinder({
      start: {
        x: centralAtom.x,
        y: centralAtom.y,
        z: centralAtom.z,
      },
      end: {
        x: all[i].x,
        y: all[i].y,
        z: all[i].z,
      },
      radius: 0.07,
      color: colors.bond,
    });
  }

  // Distance labels at bond midpoints
  for (const ligand of ligands) {
    addDistanceLabel(centralAtom, ligand);
  }

  // Labels
  addAtomLabel(centralAtom, true);
  for (const ligand of ligands) {
    addAtomLabel(ligand, false);
  }

  viewer.zoomTo();
  viewer.render();
}

function atomsToXYZ(atoms, title) {
  const lines = [atoms.length, title ?? ''];

  for (const a of atoms) {
    lines.push(
      `${a.element ?? 'X'}  ${Number(a.x).toFixed(6)}  ${Number(a.y).toFixed(6)}  ${Number(a.z).toFixed(6)}`
    );
  }

  return lines.join('\n');
}

// ── Labels ───────────────────────────────────────────────────────────────────

function addAtomLabel(atom, isCentral) {
  if (!viewer || !atom) return;

  const colors = getThemeColors();

  const text = atom.label ?? atom.element ?? '';

  viewer.addLabel(text, {
    position: {
      x: atom.x + (isCentral ? 0.22 : 0.16),
      y: atom.y + (isCentral ? 0.22 : 0.16),
      z: atom.z + (isCentral ? 0.22 : 0.16),
    },

    fontColor: colors.labelText,
    backgroundColor: colors.labelBackground,
    backgroundOpacity: isCentral ? 0.92 : 0.82,

    borderColor: colors.labelBorder,
    borderThickness: isCentral ? 1.0 : 0.6,

    fontSize: isCentral ? 16 : 12,
    fontFamily: 'Arial',
    inFront: true,
  });
}

function addDistanceLabel(center, ligand) {
  if (!viewer || !center || !ligand) return;

  const colors = getThemeColors();

  const d = Number.isFinite(ligand.distance)
    ? ligand.distance
    : distance3D(center, ligand);

  if (!Number.isFinite(d)) return;

  const mid = {
    x: (Number(center.x) + Number(ligand.x)) / 2,
    y: (Number(center.y) + Number(ligand.y)) / 2,
    z: (Number(center.z) + Number(ligand.z)) / 2,
  };

  viewer.addLabel(`${d.toFixed(3)} Å`, {
    position: mid,

    fontColor: colors.labelText,
    backgroundColor: colors.labelBackground,
    backgroundOpacity: 0.65,

    borderColor: colors.labelBorder,
    borderThickness: 0.4,

    fontSize: 10,
    fontFamily: 'Arial',
    inFront: false,
  });
}

function distance3D(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  const dz = Number(a.z) - Number(b.z);

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function removeLabelsSafe() {
  if (!viewer) return;

  // Different 3Dmol builds expose slightly different label-removal APIs.
  if (typeof viewer.removeAllLabels === 'function') {
    viewer.removeAllLabels();
  }

  // viewer.clear() normally also removes labels/shapes/models.
  // This helper is intentionally defensive.
}

function resizeViewer() {
  if (!viewer) return;

  if (typeof viewer.resize === 'function') {
    viewer.resize();
  }

  viewer.render();
}