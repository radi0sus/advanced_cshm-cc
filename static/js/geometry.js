// geometry.js
// Geometry indices for coordination polyhedra.
// Non-module version for direct file:// usage via open index.html.
//
// Matches the Python reference more closely:
//   CN4: τ₄, τ₄'
//   CN5: τ₅
//   CN6: O = octahedricity as RMS angular deviation
//   Volume: convex-hull volume of central atom + ligand positions

function calcGeometry(centralAtom, ligands) {
  const cn = ligands.length;
  const result = {};

  const angles = allAngles(centralAtom, ligands);
  const sorted = [...angles].sort((a, b) => b - a);

  if (sorted.length >= 2) {
    const beta = sorted[0];
    const alpha = sorted[1];

    if (cn === 4 && angles.length === 6) {
      // Python:
      // τ₄ = (360 - (alpha + beta)) / (360 - 2*109.5)
      result['τ₄'] = (360.0 - (alpha + beta)) / (360.0 - 2.0 * 109.5);

      // Python:
      // τ₄' = (beta - alpha)/(360 - 109.5) + (180 - beta)/(180 - 109.5)
      result["τ₄'"] =
        (beta - alpha) / (360.0 - 109.5) +
        (180.0 - beta) / (180.0 - 109.5);
    }

    if (cn === 5 && angles.length === 10) {
      // Python:
      // τ₅ = (beta - alpha) / 60
      result['τ₅'] = (beta - alpha) / 60.0;
    }

    if (cn === 6 && angles.length === 15) {
      const O = calcOctahedricity(angles);
      if (O !== null) result['O'] = O;
    
      const tau6Largest = calcTau6StoeckliEvans(angles);
      if (tau6Largest !== null) {
        result['τ₆(largest)'] = tau6Largest;
      }
    
      const tau6Smallest = calcTau6Intra(angles);
      if (tau6Smallest !== null) {
        result['τ₆(smallest)'] = tau6Smallest.tau;
        result['θ₆(smallest) /°'] = tau6Smallest.thetaIntra;
      }
    }
  }

  const volume = calcPolyhedralVolume(centralAtom, ligands);

  if (volume !== null && volume !== undefined && Number.isFinite(volume)) {
    result['V /Å³'] = volume;
  }

  return result;
}

// ── Angles ───────────────────────────────────────────────────────────────────

function allAngles(center, ligands) {
  const angles = [];

  for (let i = 0; i < ligands.length; i++) {
    for (let j = i + 1; j < ligands.length; j++) {
      angles.push(angle3(center, ligands[i], ligands[j]));
    }
  }

  return angles;
}

function angle3(center, a, b) {
  const va = [
    Number(a.x) - Number(center.x),
    Number(a.y) - Number(center.y),
    Number(a.z) - Number(center.z),
  ];

  const vb = [
    Number(b.x) - Number(center.x),
    Number(b.y) - Number(center.y),
    Number(b.z) - Number(center.z),
  ];

  const na = Math.sqrt(geomDot(va, va));
  const nb = Math.sqrt(geomDot(vb, vb));

  if (na < 1e-14 || nb < 1e-14) return 0;

  const cos = geomDot(va, vb) / (na * nb);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180.0 / Math.PI;
}

// ── Octahedricity O ──────────────────────────────────────────────────────────
//
// Python reference:
//   cis_ang = count(angle < 135)
//   trans_ang = count(angle > 135)
//   require cis_ang == 12 and trans_ang == 3
//   ideal = 90 if angle <= 135 else 180
//   O = sqrt(sum((ideal - measured)^2) / 15)

function calcOctahedricity(measuredAngles) {
  const cis = measuredAngles.filter(a => a < 135.0).length;
  const trans = measuredAngles.filter(a => a > 135.0).length;

  if (cis !== 12 || trans !== 3) {
    return null;
  }

  let sumSq = 0.0;

  for (const a of measuredAngles) {
    const ideal = a <= 135.0 ? 90.0 : 180.0;
    const d = ideal - a;
    sumSq += d * d;
  }

  return Math.sqrt(sumSq / measuredAngles.length);
}

function calcTau6StoeckliEvans(measuredAngles) {
  if (!measuredAngles || measuredAngles.length !== 15) return null;

  // Literature τ6 approach:
  // Use the three largest L–M–L angles.
  //
  // τ6 = [540° − (α1 + α2 + α3)] / 180°
  //
  // Ideal octahedron:
  //   α1 + α2 + α3 = 180 + 180 + 180 = 540
  //   τ6 = 0
  //
  // Ideal trigonal prism:
  //   τ6 approaches 1 depending on the limiting reference geometry.
  const threeLargest = [...measuredAngles]
    .sort((a, b) => b - a)
    .slice(0, 3);

  if (threeLargest.length !== 3) return null;

  const sum = threeLargest.reduce((s, a) => s + a, 0);

  return (540.0 - sum) / 180.0;
}

function calcTau6Intra(measuredAngles) {
  if (!measuredAngles || measuredAngles.length !== 15) return null;

  // User-defined intra-layer τ6 descriptor:
  //
  // θ_intra = mean of the six smallest L–M–L angles
  // τ6(intra) = (90° − θ_intra) / 19.47°
  //
  // Ideal octahedron:
  //   six smallest angles ≈ 90°
  //   τ6(intra) ≈ 0
  //
  // Ideal trigonal prism:
  //   intra-layer angles approach ca. 70.53°
  //   90 − 70.53 = 19.47
  //   τ6(intra) ≈ 1
  const sixSmallest = [...measuredAngles]
    .sort((a, b) => a - b)
    .slice(0, 6);

  if (sixSmallest.length !== 6) return null;

  const thetaIntra = sixSmallest.reduce((s, a) => s + a, 0) / 6.0;
  const tau = (90.0 - thetaIntra) / 19.47;

  return {
    tau,
    thetaIntra,
  };
}

// ── Convex hull volume for small point sets ───────────────────────────────────
//
// This is a small browser-side replacement for scipy.spatial.ConvexHull.volume.
// It is intended for small coordination polyhedra, typically CN 4–6.
//
// Input includes central atom + ligands as relative coordinates.
// The central atom is normally inside the hull and therefore does not affect
// the hull volume, but including it mirrors the Python input.

function calcPolyhedralVolume(centralAtom, ligands) {
  if (!ligands || ligands.length < 3) return null;

  const points = [];

  // central atom at relative origin
  points.push([0.0, 0.0, 0.0]);

  for (const l of ligands) {
    const p = [
      Number(l.x) - Number(centralAtom.x),
      Number(l.y) - Number(centralAtom.y),
      Number(l.z) - Number(centralAtom.z),
    ];

    if (p.every(Number.isFinite)) {
      points.push(p);
    }
  }

  if (points.length < 4) return null;

  try {
    return convexHullVolume(points);
  } catch (e) {
    console.warn('Convex hull volume failed:', e);
    return null;
  }
}

function convexHullVolume(points) {
  const n = points.length;
  const eps = 1e-9;

  const centroid = geomCentroid(points);
  const planes = new Map();

  // Find hull planes from all point triples.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = points[i];
        const b = points[j];
        const c = points[k];

        let normal = geomCross(
          geomSub(b, a),
          geomSub(c, a)
        );

        const norm = geomNorm(normal);
        if (norm < eps) continue;

        normal = geomScale(normal, 1.0 / norm);
        let d = -geomDot(normal, a);

        let pos = 0;
        let neg = 0;

        for (let m = 0; m < n; m++) {
          const s = geomDot(normal, points[m]) + d;
          if (s > 1e-7) pos++;
          else if (s < -1e-7) neg++;
        }

        // Not a hull plane if points exist on both sides.
        if (pos > 0 && neg > 0) continue;

        // Orient outward: centroid should be on negative side.
        if (geomDot(normal, centroid) + d > 0) {
          normal = geomScale(normal, -1);
          d = -d;
        }

        const key = planeKey(normal, d);

        if (!planes.has(key)) {
          planes.set(key, {
            normal,
            d,
            indices: new Set(),
          });
        }

        const plane = planes.get(key);

        for (let m = 0; m < n; m++) {
          const s = Math.abs(geomDot(normal, points[m]) + d);
          if (s < 1e-6) plane.indices.add(m);
        }
      }
    }
  }

  let volume = 0.0;

  for (const plane of planes.values()) {
    const ids = Array.from(plane.indices);

    if (ids.length < 3) continue;

    const facetPoints = ids.map(i => points[i]);
    const ordered = orderFacetVertices(facetPoints, plane.normal);

    if (ordered.length < 3) continue;

    const p0 = ordered[0];

    for (let i = 1; i < ordered.length - 1; i++) {
      const p1 = ordered[i];
      const p2 = ordered[i + 1];

      // Signed tetrahedron volume from origin.
      volume += geomDot(p0, geomCross(p1, p2)) / 6.0;
    }
  }

  return Math.abs(volume);
}

function planeKey(normal, d) {
  return [
    normal[0].toFixed(6),
    normal[1].toFixed(6),
    normal[2].toFixed(6),
    d.toFixed(6),
  ].join(',');
}

function orderFacetVertices(points, normal) {
  const c = geomCentroid(points);

  let u = geomSub(points[0], c);
  u = geomNormalize(u);

  if (geomNorm(u) < 1e-12) {
    u = arbitraryFacetAxis(normal);
  }

  let v = geomCross(normal, u);
  v = geomNormalize(v);

  return [...points].sort((pA, pB) => {
    const a = geomSub(pA, c);
    const b = geomSub(pB, c);

    const angA = Math.atan2(geomDot(a, v), geomDot(a, u));
    const angB = Math.atan2(geomDot(b, v), geomDot(b, u));

    return angA - angB;
  });
}

function arbitraryFacetAxis(normal) {
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);

  let basis;

  if (ax <= ay && ax <= az) basis = [1, 0, 0];
  else if (ay <= ax && ay <= az) basis = [0, 1, 0];
  else basis = [0, 0, 1];

  return geomNormalize(
    geomSub(
      basis,
      geomScale(normal, geomDot(basis, normal))
    )
  );
}

// ── Vector helpers with geometry-specific names to avoid global conflicts ────

function geomDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function geomCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function geomSub(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ];
}

function geomScale(a, s) {
  return [
    a[0] * s,
    a[1] * s,
    a[2] * s,
  ];
}

function geomNorm(a) {
  return Math.sqrt(geomDot(a, a));
}

function geomNormalize(a) {
  const n = geomNorm(a);
  if (n < 1e-14) return [0, 0, 0];
  return geomScale(a, 1.0 / n);
}

function geomCentroid(points) {
  const c = [0, 0, 0];

  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }

  c[0] /= points.length;
  c[1] /= points.length;
  c[2] /= points.length;

  return c;
}