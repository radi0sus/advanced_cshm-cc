// cifParser.js
// Normalises CIF parser output to:
// { title, atoms[], cell{}, symops[], M }
//
// This file expects a global parse(text) function loaded before it.
// In index.html, parse(text) is provided by:
//   static/js/cif.js
//
// parseCIF(text) returns an array of blocks — one per data_ section.
// Each block: { title, atoms[], cell{}, symops[], M }
function parseCIF(text) {
  const raw = parse(text);
  const blockKeys = Object.keys(raw).filter(k => k.startsWith('data_'));
  if (!blockKeys.length) throw new Error('No data block found in CIF');
  return blockKeys.map(k => parseBlock(raw[k], k.replace('data_', '')));
}

function parseBlock(blk, title) {
  const get    = (key) => blk[key]?.[0] ?? null;
  const getArr = (key) => blk[key] ?? [];

  // ── Unit cell ────────────────────────────────────────────────────────────
  const cell = {
    a:     parseFloat(stripSU(get('cell_length_a')    ?? '1')),
    b:     parseFloat(stripSU(get('cell_length_b')    ?? '1')),
    c:     parseFloat(stripSU(get('cell_length_c')    ?? '1')),
    alpha: parseFloat(stripSU(get('cell_angle_alpha') ?? '90')),
    beta:  parseFloat(stripSU(get('cell_angle_beta')  ?? '90')),
    gamma: parseFloat(stripSU(get('cell_angle_gamma') ?? '90')),
  };
  const M = orthMatrix(cell);

  // ── Symmetry operators ───────────────────────────────────────────────────
  const symops = (
    getArr('symmetry_equiv_pos_as_xyz').length
      ? getArr('symmetry_equiv_pos_as_xyz')
      : getArr('space_group_symop_operation_xyz').length
        ? getArr('space_group_symop_operation_xyz')
        : ['x,y,z']
  ).map(s => s.trim().toLowerCase().replace(/\s+/g, ''));

  // ── Atoms ────────────────────────────────────────────────────────────────
  const labels   = getArr('atom_site_label');
  const typeSyms = getArr('atom_site_type_symbol');
  const fx       = getArr('atom_site_fract_x');
  const fy       = getArr('atom_site_fract_y');
  const fz       = getArr('atom_site_fract_z');
  const disOrd   = getArr('atom_site_disorder_group');

  const atoms = [];
  for (let i = 0; i < labels.length; i++) {
    const label   = labels[i];
    const element = typeSyms[i]
      ? typeSyms[i].replace(/[^A-Za-z]/g, '')
      : elementFromLabel(label);

    const fxv = parseFloat(stripSU(fx[i] ?? '0'));
    const fyv = parseFloat(stripSU(fy[i] ?? '0'));
    const fzv = parseFloat(stripSU(fz[i] ?? '0'));

    if (isNaN(fxv) || isNaN(fyv) || isNaN(fzv)) continue;
    const dg = disOrd[i];
    if (dg && dg !== '.' && dg !== '?' && dg !== '1') continue;

    const [cx, cy, cz] = fracToCart(M, fxv, fyv, fzv);
    atoms.push({ label, element, fract_x: fxv, fract_y: fyv, fract_z: fzv, x: cx, y: cy, z: cz });
  }

  return { title, atoms, cell, M, symops };
}

// ── Utilities (also used by crystalNeighbors) ─────────────────────────────────

// Strip standard uncertainty: "10.523(4)" → "10.523"
function stripSU(s) {
  return String(s).replace(/\([^)]*\)/, '').trim();
}

// Element symbol from label like "Fe1", "O2A", "C12"
function elementFromLabel(label) {
  const m = String(label).match(/^([A-Z][a-z]?)/);
  return m ? m[1] : label;
}

// Orthogonalisation matrix (Rollett convention)
// Maps fractional [fx,fy,fz] → Cartesian [x,y,z]
function orthMatrix(cell) {
  const { a, b, c } = cell;
  const al = cell.alpha * Math.PI / 180;
  const be = cell.beta  * Math.PI / 180;
  const ga = cell.gamma * Math.PI / 180;
  const cosA = Math.cos(al), cosB = Math.cos(be), cosG = Math.cos(ga);
  const sinG = Math.sin(ga);
  const V = Math.sqrt(1 - cosA*cosA - cosB*cosB - cosG*cosG + 2*cosA*cosB*cosG);
  return [
    [a,  b*cosG,  c*cosB              ],
    [0,  b*sinG,  c*(cosA-cosB*cosG)/sinG ],
    [0,  0,       c*V/sinG             ],
  ];
}

function fracToCart(M, fx, fy, fz) {
  return [
    M[0][0]*fx + M[0][1]*fy + M[0][2]*fz,
    M[1][0]*fx + M[1][1]*fy + M[1][2]*fz,
    M[2][0]*fx + M[2][1]*fy + M[2][2]*fz,
  ];
}
