// elements.js
// Element data for CShM analyzer.
// Non-module version for direct file:// usage via open index.html.
//
// COVALENT_RADII corresponds to covalent_radii_max from the Python reference:
// maximum values from Alvarez, SHELX and Jmol where available.
// Values in Ångström.
// Used for bond detection:
//
//   bond cutoff = (radius(center) + radius(ligand)) * bondTol
//
// Python reference default:
//   enlarge_bond = 10%
// Browser default:
//   bondTol = 1.10

const COVALENT_RADII = {
  H:  0.32,
  D:  0.32,
  He: 1.50,

  Li: 1.52,
  Be: 1.11,
  B:  0.84,
  C:  0.77,
  N:  0.71,
  O:  0.68,
  F:  0.64,
  Ne: 1.50,

  Na: 1.86,
  Mg: 1.60,
  Al: 1.35,
  Si: 1.20,
  P:  1.10,
  S:  1.05,
  Cl: 1.02,
  Ar: 1.57,

  K:  2.27,
  Ca: 1.97,
  Sc: 1.70,
  Ti: 1.60,
  V:  1.53,
  Cr: 1.39,
  Mn: 1.61,
  Fe: 1.52,
  Co: 1.50,
  Ni: 1.50,
  Cu: 1.52,
  Zn: 1.45,
  Ga: 1.26,
  Ge: 1.22,
  As: 1.21,
  Se: 1.22,
  Br: 1.21,
  Kr: 1.91,

  Rb: 2.48,
  Sr: 2.15,
  Y:  1.90,
  Zr: 1.75,
  Nb: 1.64,
  Mo: 1.54,
  Tc: 1.47,
  Ru: 1.46,
  Rh: 1.45,
  Pd: 1.50,
  Ag: 1.59,
  Cd: 1.69,
  In: 1.63,
  Sn: 1.46,
  Sb: 1.46,
  Te: 1.47,
  I:  1.40,
  Xe: 1.98,

  Cs: 2.65,
  Ba: 2.17,

  La: 2.07,
  Ce: 2.04,
  Pr: 2.03,
  Nd: 2.01,
  Pm: 1.99,
  Sm: 1.98,
  Eu: 2.00,
  Gd: 1.96,
  Tb: 1.94,
  Dy: 1.92,
  Ho: 1.92,
  Er: 1.89,
  Tm: 1.90,
  Yb: 1.94,
  Lu: 1.87,

  Hf: 1.75,
  Ta: 1.70,
  W:  1.62,
  Re: 1.51,
  Os: 1.44,
  Ir: 1.41,
  Pt: 1.50,
  Au: 1.50,
  Hg: 1.70,
  Tl: 1.64,
  Pb: 1.60,
  Bi: 1.60,
  Po: 1.68,
  At: 1.70,
  Rn: 2.40,

  Fr: 2.80,
  Ra: 2.21,
  Ac: 2.15,
  Th: 2.06,
  Pa: 2.00,
  U:  1.96,
  Np: 1.90,
  Pu: 1.87,
  Am: 1.80,
  Cm: 1.80,
  Bk: 1.80,
  Cf: 1.80,
};

// Central atoms for automatic recognition.
//
// Mirrors Python:
//
// tm = [
//   "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
//   "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd",
//   "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Mg"
// ]
//
// Lanthanides are included additionally because the previous browser version
// already supported them and the radii table contains them.

const TRANSITION_METALS = new Set([

  'Sc', 'Ti', 'V',  'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Y',  'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'Hf', 'Ta', 'W',  'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',

  // Lanthanides / rare earths
  'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy',
  'Ho', 'Er', 'Tm', 'Yb', 'Lu',
]);

// Broad metal set for excluding/including metal–metal contacts.
// Used for ligand filtering, not necessarily for automatic central-atom detection.
const METAL_ELEMENTS = new Set([
  // Alkali metals
  'Li', 'Na', 'K', 'Rb', 'Cs', 'Fr',

  // Alkaline earth metals
  'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra',

  // Transition metals
  'Sc', 'Ti', 'V',  'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Y',  'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'Hf', 'Ta', 'W',  'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',

  // Lanthanides
  'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy',
  'Ho', 'Er', 'Tm', 'Yb', 'Lu',

  // Actinides
  'Ac', 'Th', 'Pa', 'U',  'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf',

  // Post-transition metals
  'Al', 'Ga', 'In', 'Tl',
  'Sn', 'Pb',
  'Bi',
  'Po',
]);

// If you want to match the Python script strictly, use this instead:
//
// const TRANSITION_METALS = new Set([
//   'Sc', 'Ti', 'V',  'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
//   'Y',  'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
//   'Hf', 'Ta', 'W',  'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Mg',
// ]);

// CPK-like colors for the 3D viewer.
// 3Dmol also has its own defaults, but these are useful if custom coloring
// is used later.

const CPK_COLORS = {
  H:  0xffffff,
  D:  0xffffff,
  C:  0x404040,
  N:  0x4444ff,
  O:  0xff2200,
  F:  0x00ff00,
  Cl: 0x00cc00,
  Br: 0x882200,
  I:  0x660077,
  S:  0xddcc00,
  P:  0xff8800,

  Li: 0xcc80ff,
  Be: 0xc2ff00,
  B:  0xffb5b5,
  Na: 0xab5cf2,
  Mg: 0x8aff00,
  Al: 0xbfa6a6,
  Si: 0xf0c8a0,
  K:  0x8f40d4,
  Ca: 0x3dff00,

  Sc: 0xe6e6e6,
  Ti: 0xbfc2c7,
  V:  0xa6a6ab,
  Cr: 0x8a99c7,
  Mn: 0x9c7ac7,
  Fe: 0xe06010,
  Co: 0x0077bb,
  Ni: 0x55cc55,
  Cu: 0xcc7722,
  Zn: 0x8899bb,

  Ga: 0xc28f8f,
  Ge: 0x668f8f,
  As: 0xbd80e3,
  Se: 0xffa100,

  Y:  0x94ffff,
  Zr: 0x94e0e0,
  Nb: 0x73c2c9,
  Mo: 0x55aaaa,
  Tc: 0x3b9e9e,
  Ru: 0x248f8f,
  Rh: 0x0cb256,
  Pd: 0x006985,
  Ag: 0xc0c0c0,
  Cd: 0xffd98f,

  In: 0xa67573,
  Sn: 0x668080,
  Sb: 0x9e63b5,
  Te: 0xd47a00,

  La: 0x70d4ff,
  Ce: 0xffffc7,
  Pr: 0xd9ffc7,
  Nd: 0xc7ffc7,
  Pm: 0xa3ffc7,
  Sm: 0x8fffc7,
  Eu: 0x61ffc7,
  Gd: 0x45ffc7,
  Tb: 0x30ffc7,
  Dy: 0x1fffc7,
  Ho: 0x00ff9c,
  Er: 0x00e675,
  Tm: 0x00d452,
  Yb: 0x00bf38,
  Lu: 0x00ab24,

  Hf: 0x4dc2ff,
  Ta: 0x4da6ff,
  W:  0x2194d6,
  Re: 0x267dab,
  Os: 0x266696,
  Ir: 0x175487,
  Pt: 0xd0d0e0,
  Au: 0xffd123,
  Hg: 0xb8b8d0,

  Tl: 0xa6544d,
  Pb: 0x575961,
  Bi: 0x9e4fb5,
  Po: 0xab5c00,

  U:  0x008fff,
  Np: 0x0080ff,
  Pu: 0x006bff,
  Am: 0x545cf2,
  Cm: 0x785ce3,
};

function cpkColor(element) {
  return CPK_COLORS[element] ?? 0xaaaaaa;
}

function covalentRadius(element) {
  return COVALENT_RADII[element] ?? 1.50;
}