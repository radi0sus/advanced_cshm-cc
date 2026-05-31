// export.js
// Pure Markdown and XYZ export.
// Non-module version for direct file:// usage via open index.html.

function exportMarkdown(results, baseName = 'cshm_results') {
  if (!results || !results.length) return;

  const parts = [];

  parts.push('# CShM results');
  parts.push('');
  parts.push('');

  for (const r of results) {
    parts.push(markdownSectionForResult(r));
    parts.push('');
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push('');
  }

  download(`${safeFilename(baseName)}.md`, parts.join('\n'), 'text/markdown');
}

// Backwards-compatible alias.
// app.js may still call exportCSV(state.results), but this writes Markdown.
function exportCSV(results) {
  exportMarkdown(results);
}

function markdownSectionForResult(r) {
  const lines = [];

  const title = r.block?.title
    ? `${r.metal.label} (${r.block.title})`
    : `${r.metal.label}`;

  const cshmEntries = Object.entries(r.cshm ?? {}).sort((a, b) => a[1] - b[1]);
  const best = cshmEntries[0];

  lines.push(`## ${escapeMarkdownText(title)}`);
  lines.push('');

  // ── Summary table ─────────────────────────────────────────────────────────

  const summaryRows = [];

  summaryRows.push(['CN', r.cn ?? '']);

  if (hasValue(r.geom?.['τ₄'])) {
    summaryRows.push(['τ₄', formatMDNumber(r.geom['τ₄'])]);
  }

  if (hasValue(r.geom?.["τ₄'"])) {
    summaryRows.push(["τ₄'", formatMDNumber(r.geom["τ₄'"])]);
  }

  if (hasValue(r.geom?.['τ₅'])) {
    summaryRows.push(['τ₅', formatMDNumber(r.geom['τ₅'])]);
  }

  if (hasValue(r.geom?.['O'])) {
    summaryRows.push(['O', formatMDNumber(r.geom['O'])]);
  }
  
  if (hasValue(r.geom?.['τ₆(largest)'])) {
    summaryRows.push(['τ₆(largest)', formatMDNumber(r.geom['τ₆(largest)'])]);
  }
  
  if (hasValue(r.geom?.['τ₆(smallest)'])) {
    summaryRows.push(['τ₆(smallest)', formatMDNumber(r.geom['τ₆(smallest)'])]);
  }
  
  if (hasValue(r.geom?.['θ₆(smallest) /°'])) {
    summaryRows.push(['θ₆(smallest) /°', formatMDNumber(r.geom['θ₆(smallest) /°'])]);
  }
  
  if (hasValue(r.geom?.['V /Å³'])) {
    summaryRows.push(['V /Å³', formatMDNumber(r.geom['V /Å³'])]);
  }

  if (best) {
    summaryRows.push(['best CShM', `${best[0]} (${formatMDNumber(best[1])})`]);
  }

  lines.push('### Summary');
  lines.push('');
  lines.push(markdownTable(
    ['property', 'value'],
    summaryRows,
    [false, true]
  ));
  lines.push('');
  lines.push('');

  // ── CShM table ────────────────────────────────────────────────────────────

  if (cshmEntries.length) {
    const cshmRows = cshmEntries.map(([shape, value]) => {
      const isBest = best && shape === best[0];

      return [
        isBest ? `**${shape}**` : shape,
        EXPORT_SHAPE_NAMES[shape] ?? '',
        isBest ? `**${formatMDNumber(value)}**` : formatMDNumber(value),
      ];
    });

    lines.push('### Continuous Shape Measures');
    lines.push('');
    lines.push(markdownTable(
      ['shape', 'geometry', 'CShM'],
      cshmRows,
      [false, false, true]
    ));
    lines.push('');
    lines.push('');
  }

  // ── Ligand table ──────────────────────────────────────────────────────────

  if (r.ligands && r.ligands.length) {
    const ligandRows = r.ligands.map(l => [
      l.label ?? '',
      l.element ?? '',
      formatMDNumber(l.distance),
      ligandSymmetryLabel(l),
    ]);

    lines.push('### Ligands');
    lines.push('');
    lines.push(markdownTable(
      ['ligand', 'element', 'distance /Å', 'sym'],
      ligandRows,
      [false, false, true, false]
    ));
    lines.push('');
  }

  return lines.join('\n');
}

function markdownTable(headers, rows, numericColumns = []) {
  const lines = [];

  lines.push('| ' + headers.map(escapeMarkdownCell).join(' | ') + ' |');

  lines.push(
    '| ' +
    headers.map((_, i) => numericColumns[i] ? '---:' : '---').join(' | ') +
    ' |'
  );

  for (const row of rows) {
    lines.push('| ' + row.map(escapeMarkdownCell).join(' | ') + ' |');
  }

  return lines.join('\n');
}

function exportXYZ(results, baseName = 'coordination_spheres', inputExt = null) {
  if (!results || !results.length) return;

  const blocks = results.map(r => {
    const metal = r.metal;
    const ligands = r.ligands ?? [];

    const atoms = [
      {
        element: metal.element ?? 'X',
        label: metal.label ?? metal.element ?? 'M',
        x: 0,
        y: 0,
        z: 0,
      },
      ...ligands.map(l => {
        const rel = relativeCoords(metal, l);

        return {
          element: l.element ?? 'X',
          label: l.label ?? l.element ?? 'L',
          x: rel.x,
          y: rel.y,
          z: rel.z,
        };
      }),
    ];

    const title = r.block?.title
      ? `${r.block.title}-${metal.label} CN=${r.cn}`
      : `${metal.label} CN=${r.cn}`;

    return [
      atoms.length,
      title,
      ...atoms.map(a =>
        `${String(a.element).padEnd(2, ' ')} ${formatXYZ(a.x)} ${formatXYZ(a.y)} ${formatXYZ(a.z)}`
      ),
    ].join('\n');
  });

  const safeBase = safeFilename(baseName);
  const filename = inputExt === 'xyz'
    ? `${safeBase}_spheres.xyz`
    : `${safeBase}.xyz`;
  
  download(filename, blocks.join('\n\n') + '\n', 'chemical/x-xyz');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeFilename(name) {
  return String(name || 'cshm_results')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .trim() || 'cshm_results';
}

function relativeCoords(metal, atom) {
  return {
    x: Number(atom.x) - Number(metal.x),
    y: Number(atom.y) - Number(metal.y),
    z: Number(atom.z) - Number(metal.z),
  };
}

function ligandSymmetryLabel(l) {
  const symop = l.symop && l.symop !== 'x,y,z'
    ? l.symop
    : '';

  const hasTranslation = Boolean(l.tx || l.ty || l.tz);

  if (symop && hasTranslation) {
    return `${symop} [${l.tx ?? 0},${l.ty ?? 0},${l.tz ?? 0}]`;
  }

  if (symop) {
    return symop;
  }

  if (hasTranslation) {
    return `[${l.tx ?? 0},${l.ty ?? 0},${l.tz ?? 0}]`;
  }

  return '.';
}

function hasValue(v) {
  return v !== null && v !== undefined && v !== '';
}

function formatMDNumber(v) {
  const n = Number(v);

  if (!Number.isFinite(n)) {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  // Avoid "-0.0000"
  if (Math.abs(n) < 0.00005) return '0.0000';

  return n.toFixed(4);
}

function formatXYZ(v) {
  const n = Number(v);

  if (!Number.isFinite(n)) {
    return '    0.000000';
  }

  const clean = Math.abs(n) < 0.0000005 ? 0 : n;

  return clean.toFixed(6).padStart(12, ' ');
}

function escapeMarkdownText(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replaceAll('\n', ' ')
    .trim();
}

function escapeMarkdownCell(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .trim();
}

function download(filename, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Local shape-name map for export.
// Does not depend on ui.js loading order.

const EXPORT_SHAPE_NAMES = {
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