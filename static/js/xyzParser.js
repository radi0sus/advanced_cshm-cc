// xyzParser.js
// Robust single- and multi-XYZ parser.
// Non-module version for direct file:// usage via open index.html.
//
// Supported XYZ block:
//
//   5
//   title/comment
//   Fe1  0.000  0.000  0.000
//   N1   2.000  0.000  0.000
//   ...
//
// Also supported atom line formats:
//
//   Fe   0.000  0.000  0.000
//   Fe1  0.000  0.000  0.000
//   Fe1  Fe  0.000  0.000  0.000
//
// parseXYZ(text) returns an ARRAY of blocks, like parseCIF(text):
//
//   [
//     { title, atoms, cell: null, symops: null },
//     ...
//   ]

function parseXYZ(text) {
  if (!text || !text.trim()) {
    throw new Error('Empty XYZ input');
  }

  const rawLines = text
    .replace(/\r/g, '')
    .split('\n');

  const blocks = [];
  let i = 0;
  let blockNo = 1;

  while (i < rawLines.length) {
    // Skip blank lines between XYZ blocks
    while (i < rawLines.length && rawLines[i].trim() === '') {
      i++;
    }

    if (i >= rawLines.length) break;

    const countLine = rawLines[i].trim();
    const n = parseInt(countLine, 10);

    if (!Number.isFinite(n) || n <= 0 || String(n) !== countLine.match(/^\d+/)?.[0]) {
      throw new Error(`Invalid XYZ block ${blockNo}: atom count expected at line ${i + 1}`);
    }

    i++;

    if (i >= rawLines.length) {
      throw new Error(`Invalid XYZ block ${blockNo}: missing title/comment line`);
    }

    let title = rawLines[i].trim();
    if (!title) title = `XYZ block ${blockNo}`;
    i++;

    if (i + n > rawLines.length) {
      throw new Error(
        `Invalid XYZ block ${blockNo}: expected ${n} atom lines, found ${Math.max(0, rawLines.length - i)}`
      );
    }

    const atomLines = rawLines.slice(i, i + n);
    i += n;

    const atoms = parseXYZAtoms(atomLines, blockNo);

    if (!atoms.length) {
      throw new Error(`Invalid XYZ block ${blockNo}: no atoms parsed`);
    }

    blocks.push({
      title: uniqueXYZTitle(title, blockNo, blocks),
      atoms,
      cell: null,
      symops: null,
    });

    blockNo++;
  }

  if (!blocks.length) {
    throw new Error('Invalid XYZ: no blocks parsed');
  }

  return blocks;
}

function parseXYZAtoms(atomLines, blockNo) {
  const atoms = [];
  const labelCounts = {};

  for (let j = 0; j < atomLines.length; j++) {
    const lineNoInBlock = j + 1;
    const line = atomLines[j].trim();

    if (!line) {
      console.warn(`XYZ block ${blockNo}: skipping blank atom line ${lineNoInBlock}`);
      continue;
    }

    const p = line.split(/\s+/);
    const parsed = parseXYZAtomLine(p);

    if (!parsed) {
      console.warn(`XYZ block ${blockNo}: skipping invalid atom line ${lineNoInBlock}: ${line}`);
      continue;
    }

    let { element, label, x, y, z } = parsed;

    element = normalizeElementSymbol(element);

    if (!element) {
      console.warn(`XYZ block ${blockNo}: cannot determine element from line ${lineNoInBlock}: ${line}`);
      continue;
    }

    // If no explicit label is present, create labels Fe1, Fe2, N1, ...
    if (!label) {
      labelCounts[element] = (labelCounts[element] ?? 0) + 1;
      label = element + labelCounts[element];
    }

    atoms.push({
      element,
      label,
      x,
      y,
      z,
    });
  }

  return atoms;
}

function parseXYZAtomLine(p) {
  if (!p || p.length < 4) return null;

  // Case 1:
  //   Fe  0.0 0.0 0.0
  //   Fe1 0.0 0.0 0.0
  if (p.length >= 4 && areXYZNumbers(p[1], p[2], p[3])) {
    const token = p[0];

    return {
      element: elementFromXYZToken(token),
      label: looksLikePlainElement(token) ? null : token,
      x: parseFloat(p[1]),
      y: parseFloat(p[2]),
      z: parseFloat(p[3]),
    };
  }

  // Case 2:
  //   Fe1 Fe 0.0 0.0 0.0
  if (p.length >= 5 && areXYZNumbers(p[2], p[3], p[4])) {
    return {
      label: p[0],
      element: p[1],
      x: parseFloat(p[2]),
      y: parseFloat(p[3]),
      z: parseFloat(p[4]),
    };
  }

  return null;
}

function areXYZNumbers(a, b, c) {
  return Number.isFinite(parseFloat(a)) &&
         Number.isFinite(parseFloat(b)) &&
         Number.isFinite(parseFloat(c));
}

function looksLikePlainElement(token) {
  return /^[A-Z][a-z]?$/.test(String(token));
}

function elementFromXYZToken(token) {
  const s = String(token ?? '').trim();

  // Examples:
  //   Fe   -> Fe
  //   Fe1  -> Fe
  //   FE1  -> Fe
  //   C12  -> C
  //   Cl3  -> Cl
  const m = s.match(/^([A-Za-z]{1,2})/);

  if (!m) return '';

  return normalizeElementSymbol(m[1]);
}

function normalizeElementSymbol(s) {
  if (!s) return '';

  const raw = String(s).replace(/[^A-Za-z]/g, '');

  if (!raw) return '';

  if (raw.length === 1) {
    return raw[0].toUpperCase();
  }

  return raw[0].toUpperCase() + raw[1].toLowerCase();
}

function uniqueXYZTitle(title, blockNo, existingBlocks) {
  let t = String(title ?? '').trim();

  if (!t) {
    t = `XYZ block ${blockNo}`;
  }

  const existing = new Set(existingBlocks.map(b => b.title));

  if (!existing.has(t)) {
    return t;
  }

  let k = 2;
  while (existing.has(`${t} (${k})`)) {
    k++;
  }

  return `${t} (${k})`;
}