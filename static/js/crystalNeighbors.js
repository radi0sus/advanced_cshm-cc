// crystalNeighbors.js
// Finds coordination sphere of a central atom, including symmetry-equivalent
// and PBC images — approximate browser-side equivalent of
// gemmi NeighborSearch + find_nearest_pbc_images.
//
// Non-module version for direct file:// usage via open index.html.
//
// Exports globally:
//   parseSymop(str)
//   findNeighbors(data, centralAtom, opts)
//
// Returned ligand atoms have the same shape as cifParser atoms plus:
//   { ...atom, symop, symopIdx, tx, ty, tz, distance }
//
// Important Python-equivalent exclusion:
//   In the reference Python script, possible ligands are accepted only if
//     label != central_label
//     element != central_element
//   This excludes symmetry-equivalent metal atoms and same-element metal sites
//   from the coordination sphere.

// ── Symop string parser ───────────────────────────────────────────────────────
// Parses "x,y,z", "-x+1/2,y,-z+1/3", "x+1,-y+1/2,z" etc.
// Returns { R: 3×3, t: [tx,ty,tz] } in fractional coordinates.

function parseSymop(str) {
  const R = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  const t = [0, 0, 0];

  const exprs = String(str)
    .toLowerCase()
    .replace(/\s/g, '')
    .split(',');

  if (exprs.length !== 3) {
    throw new Error(`Bad symop: ${str}`);
  }

  exprs.forEach((expr, row) => {
    // Tokenise:
    //   +x, -y, +1/2, -1/3, +1, -1, +0.25, ...
    const tokens = expr.match(/[+-]?(?:[xyz]|[0-9]*\.?[0-9]+\/[0-9]+|[0-9]*\.?[0-9]+)/g) ?? [];

    for (const tok of tokens) {
      if (tok.includes('x')) {
        R[row][0] += tok.startsWith('-') ? -1 : 1;
      } else if (tok.includes('y')) {
        R[row][1] += tok.startsWith('-') ? -1 : 1;
      } else if (tok.includes('z')) {
        R[row][2] += tok.startsWith('-') ? -1 : 1;
      } else if (tok.includes('/')) {
        const [num, den] = tok.split('/').map(Number);
        if (den) t[row] += num / den;
      } else {
        const v = parseFloat(tok);
        if (!Number.isNaN(v)) t[row] += v;
      }
    }
  });

  return { R, t };
}

function applySymop(op, frac) {
  const { R, t } = op;

  return [
    R[0][0] * frac[0] + R[0][1] * frac[1] + R[0][2] * frac[2] + t[0],
    R[1][0] * frac[0] + R[1][1] * frac[1] + R[1][2] * frac[2] + t[1],
    R[2][0] * frac[0] + R[2][1] * frac[1] + R[2][2] * frac[2] + t[2],
  ];
}

// ── Distance ─────────────────────────────────────────────────────────────────

function dist3(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ── Main neighbour search ────────────────────────────────────────────────────

function findNeighbors(data, centralAtom, opts = {}) {
  const {
    includeH = false,
    includeMetals = false,
    sourceType = 'xyz',
    bondTol = 1.10,
    absoluteCutoff = null,
  } = opts;

  if (sourceType === 'xyz' || !data.cell || !data.symops) {
    return findNeighborsXYZ(data.atoms ?? [], centralAtom, {
      includeH,
      includeMetals,
      bondTol,
      absoluteCutoff,
    });
  }

  return findNeighborsCIF(data, centralAtom, {
    includeH,
    includeMetals,
    bondTol,
    absoluteCutoff,
  });
}

// ── Python-equivalent exclusion ───────────────────────────────────────────────
//
// Reference Python condition:
//
//   if label != site.label and site.element != mark.to_site(st).element:
//
// Meaning:
//   - reject same label as central atom
//   - reject same element as central atom
//
// This intentionally removes symmetry-equivalent central atoms and other
// same-element metal atoms from the ligand list.

function isExcludedLigandAtom(atom, center, includeMetals) {
  if (!atom || !center) return true;

  const atomLabel = String(atom.label ?? '');
  const ctrLabel  = String(center.label ?? '');

  const atomEl = normaliseElementSymbolForNeighbor(atom.element);

  // Always exclude the exact same labelled atom.
  // This prevents symmetry/self hits such as Fe1 around Fe1.
  if (atomLabel && ctrLabel && atomLabel === ctrLabel) {
    return true;
  }

  // Default: exclude all metal atoms as ligands.
  // This removes all M–M contacts from the coordination sphere.
  const metalSet = typeof METAL_ELEMENTS !== 'undefined'
    ? METAL_ELEMENTS
    : TRANSITION_METALS;
  
  if (!includeMetals && metalSet.has(atomEl)) {
    return true;
  }

  return false;
}

function normaliseElementSymbolForNeighbor(el) {
  const raw = String(el ?? '').replace(/[^A-Za-z]/g, '');
  if (!raw) return '';

  if (raw.length === 1) {
    return raw[0].toUpperCase();
  }

  return raw[0].toUpperCase() + raw[1].toLowerCase();
}

// ── Radius-based cutoff ──────────────────────────────────────────────────────

function bondCutoff(center, atom, bondTol, absoluteCutoff) {
  if (absoluteCutoff && Number.isFinite(absoluteCutoff) && absoluteCutoff > 0) {
    return absoluteCutoff;
  }

  const rCenter = COVALENT_RADII[center.element] ?? 1.5;
  const rAtom   = COVALENT_RADII[atom.element] ?? 1.5;

  return (rCenter + rAtom) * bondTol;
}

// ── XYZ neighbour search ─────────────────────────────────────────────────────

function findNeighborsXYZ(atoms, center, { includeH, includeMetals, bondTol, absoluteCutoff }) {
  const result = [];

  const centerCart = [
    Number(center.x),
    Number(center.y),
    Number(center.z),
  ];

  for (const atom of atoms) {
    if (!atom) continue;

    // Python-equivalent central/same-element exclusion
    if (isExcludedLigandAtom(atom, center, includeMetals)) continue;

    if (!includeH && atom.element === 'H') continue;

    const maxD = bondCutoff(center, atom, bondTol, absoluteCutoff);

    const atomCart = [
      Number(atom.x),
      Number(atom.y),
      Number(atom.z),
    ];

    const d = dist3(centerCart, atomCart);

    if (d > 0.0 && d < maxD) {
      result.push({
        ...atom,
        distance: d,
        symop: 'x,y,z',
        symopIdx: 0,
        tx: 0,
        ty: 0,
        tz: 0,
      });
    }
  }

  result.sort((a, b) => a.distance - b.distance);
  return result;
}

// ── CIF neighbour search with symops + PBC ───────────────────────────────────

function findNeighborsCIF(data, center, { includeH, includeMetals, bondTol, absoluteCutoff }) {
  const atoms  = data.atoms ?? [];
  const cell   = data.cell;
  const symops = data.symops?.length ? data.symops : ['x,y,z'];
  const M      = data.M ?? orthMatrix(cell);

  const centerCart = [
    Number(center.x),
    Number(center.y),
    Number(center.z),
  ];

  // Search range.
  //
  // Python/Gemmi uses NeighborSearch and then find_nearest_pbc_images().
  // Browser approximation: apply all symops and translations around the
  // central unit cell. ±2 is safe for normal coordination bonds.
  const TR = [-2, -1, 0, 1, 2];

  const result = [];
  const seen = new Set();

  const parsedOps = symops.map(parseSymop);

  for (const atom of atoms) {
    if (!atom) continue;

    // Python-equivalent central/same-element exclusion.
    //
    // This is the key missing logic:
    //   - excludes Fe1 symmetry equivalents around Fe1
    //   - excludes other Fe atoms around Fe1
    //   - mirrors "label != site.label and site.element != mark.to_site(st).element"
    if (isExcludedLigandAtom(atom, center, includeMetals)) continue;

    if (!includeH && atom.element === 'H') continue;

    const maxD = bondCutoff(center, atom, bondTol, absoluteCutoff);

    const frac0 = [
      Number(atom.fract_x),
      Number(atom.fract_y),
      Number(atom.fract_z),
    ];

    if (!frac0.every(Number.isFinite)) continue;

    for (let si = 0; si < parsedOps.length; si++) {
      const fSym = applySymop(parsedOps[si], frac0);

      for (const tx of TR) {
        for (const ty of TR) {
          for (const tz of TR) {
            const fp = [
              fSym[0] + tx,
              fSym[1] + ty,
              fSym[2] + tz,
            ];

            const cart = fracToCart(M, fp[0], fp[1], fp[2]);

            const d = dist3(centerCart, cart);

            if (d <= 0.0 || d >= maxD) continue;

            // Deduplicate identical Cartesian positions.
            //
            // Gemmi handles this internally. Here we approximate with rounded
            // coordinates plus atom label/symmetry information.
            const posKey = [
              cart[0].toFixed(4),
              cart[1].toFixed(4),
              cart[2].toFixed(4),
            ].join(',');

            const key = `${atom.label}|${atom.element}|${posKey}`;

            if (seen.has(key)) continue;
            seen.add(key);

            result.push({
              ...atom,

              x: cart[0],
              y: cart[1],
              z: cart[2],

              fract_x: fp[0],
              fract_y: fp[1],
              fract_z: fp[2],

              symopIdx: si,
              symop: symops[si],

              tx,
              ty,
              tz,

              distance: d,
            });
          }
        }
      }
    }
  }

  result.sort((a, b) => a.distance - b.distance);

  return result;
}