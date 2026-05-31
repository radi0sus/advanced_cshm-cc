# advanced_cshm-cc

Browser-based CShM analyzer for coordination compounds.

This project is a web-app companion to the Python command-line tool
[`cshm-cc`](https://github.com/radi0sus/cshm-cc). It calculates Continuous Shape
Measures (CShM), selected geometry indices, polyhedral volumes, and coordination
spheres from CIF and XYZ structure files directly in the browser.

The app is designed to work without a local server:

```console
open index.html
```

It can also be hosted as a static web page, e.g. via GitHub Pages.  

[`https://radi0sus.github.io/advanced_cshm-cc/`](https://radi0sus.github.io/advanced_cshm-cc/)

---

## Relation to the Python CLI tool

The original Python tool is:

[`cshm-cc`](https://github.com/radi0sus/cshm-cc)

The Python version is a command-line program using `gemmi`, `numpy`, `scipy`,
`tabulate`, and related scientific Python libraries. It supports local CIF files
and can also retrieve CIF files directly from the COD by COD ID.

This browser version follows the same general purpose:

- automatic detection of central metal sites,
- coordination-sphere generation,
- CShM calculation for CN 2–6,
- τ₄, τ₄′, τ₅, octahedricity *O*, and two τ₆-type descriptors for CN = 6,
- polyhedral volume,
- XYZ export of coordination spheres with the metal atom at the origin.

However, the implementation and workflow differ.

---

## Main differences from `cshm-cc`

### 1. Browser-only, no Python dependencies

The web app uses plain JavaScript and bundled browser libraries.

### 2. No direct COD import

The Python CLI can download structures from the Crystallography Open Database
(COD) by COD ID.

The browser app cannot directly fetch CIF files from COD because of browser CORS
restrictions. For example, a request from GitHub Pages to:

```text
https://www.crystallography.net/cod/<COD-ID>.cif
```

is blocked by the browser unless COD allows that origin.

Recommended workflow for COD structures:

1. download the CIF manually from COD,
2. drop the CIF file into the web app.

### 3. CIF and XYZ files are loaded locally

The web app accepts:

```text
.cif
.xyz
```

via drag-and-drop or file picker.

Multi-block CIF files are supported. Multi-XYZ files are also supported.

### 4. Interactive coordination-sphere editing

Unlike the CLI tool, the web app allows interactive inspection and adjustment:

- select/deselect detected metal sites,
- change the bond-radius tolerance per site,
- include/exclude H atoms,
- include/exclude metal–metal contacts,
- manually toggle individual ligand atoms in a coordination sphere,
- immediately update CN, CShM, geometry indices, viewer and exports.

### 5. CShM optimization

The Python CLI has two modes:

- fast mode with a configurable number of random trials,
- exact mode using all permutations.

The browser version currently uses an exact permutation-based approach for
CN 2–6. Therefore, there is no "number of trials" setting in the web app.

For CN 2–6 this is feasible because the maximum number of points is 7
(central atom + 6 ligands):

| CN | points | permutations |
|---:|-------:|-------------:|
| 2 | 3 | 6 |
| 3 | 4 | 24 |
| 4 | 5 | 120 |
| 5 | 6 | 720 |
| 6 | 7 | 5040 |

This makes the browser result deterministic and closer to the exact mode of the
Python tool.

### 6. Symmetry handling

The Python version uses `gemmi` for crystallographic symmetry and periodic
boundary handling.

The browser version implements CIF symmetry operators and periodic-image
searching in JavaScript. It supports symmetry-equivalent and translated ligand
positions and stores symmetry information for each ligand.

Because this is not `gemmi`, small differences may occur for difficult CIFs,
unusual symmetry settings, disorder, or edge cases.

### 7. Polyhedral volume

The Python CLI uses SciPy/Qhull:

```python
scipy.spatial.ConvexHull
```

The browser version uses a small JavaScript convex-hull volume implementation.
For common CN 4–6 coordination polyhedra it should give useful values, but it
may not be as robust as Qhull for degenerate or nearly coplanar point sets.

---

## Features

- Load local `.cif` and `.xyz` files.
- Supports multi-block CIF files.
- Supports multi-XYZ files.
- Automatic central atom detection.
- Interactive selection of metal sites.
- Per-site bond-radius tolerance slider.
- Optional inclusion of hydrogen ligands.
- Optional inclusion of metal–metal contacts.
- Clickable ligand chips:
  - all ligands are active by default,
  - clicking a ligand toggles it on/off,
  - CShM, CN, geometry indices and viewer update immediately.
- 3Dmol.js viewer for coordination spheres.
- Export results as Markdown.
- Export coordination spheres as XYZ with the central atom at:

```text
0.000000  0.000000  0.000000
```

---

## Usage

Open the app locally:

```console
open index.html
```

or host the repository as a static website.

Then:

1. drop a CIF or XYZ file into the dropzone,
2. select/deselect metal sites if needed,
3. adjust options,
4. inspect the CShM and geometry results,
5. optionally export Markdown or XYZ.

---

## Input

### CIF

The app reads atom labels, atom types, fractional coordinates, unit-cell
parameters and symmetry operations from CIF files. It supports CIFs with single or multiple
structure entries.

### XYZ

Single XYZ:

```xyz
5
example
Fe1  0.000  0.000  0.000
N1   2.000  0.000  0.000
N2  -2.000  0.000  0.000
O1   0.000  2.000  0.000
O2   0.000 -2.000  0.000
```

Multi-XYZ:

```xyz
5
fragment 1
Fe1  0.000  0.000  0.000
N1   2.000  0.000  0.000
N2  -2.000  0.000  0.000
O1   0.000  2.000  0.000
O2   0.000 -2.000  0.000

5
fragment 2
Cu1  0.000  0.000  0.000
N1   2.000  0.000  0.000
N2  -2.000  0.000  0.000
Cl1  0.000  2.000  0.000
Cl2  0.000 -2.000  0.000
```

The parser accepts atom labels such as `Fe1`, `N2`, `Cl1` and normalizes the
element symbol internally.

---

## Output

### Markdown export

The Markdown export contains one section per metal site, including:

- CN,
- τ₄, τ₄′, τ₅, *O*, τ₆(largest), τ₆(smallest) where applicable,
- polyhedral volume,
- CShM table,
- ligand table with distances and symmetry information.

If the input file is:

```text
example.cif
```

the Markdown export should be named:

```text
example.md
```

If the input file is:

```text
example.xyz
```

the Markdown export should also be named:

```text
example.md
```

### XYZ export

The XYZ export contains the selected coordination spheres.

For CIF input:

```text
example.cif → example.xyz
```

For XYZ input, the export should avoid overwriting the original file, for
example:

```text
example.xyz → example_spheres.xyz
```

Each exported coordination sphere is centered on the metal atom:

```xyz
7
example-Fe1 CN=6
Fe     0.000000     0.000000     0.000000
O     -0.616592    -1.061741    -1.501215
O      0.959974     1.212008    -1.158622
O      0.571590     1.007982     1.743717
O     -1.724182     1.000584     0.126840
N     -0.704425    -1.596884     1.194038
N      1.895974    -0.970502     0.221754
```

---

## Geometry indices

The following indices are calculated where applicable.

### τ₄

For four-coordinate compounds:

```math
\tau_4 = \frac{360^\circ-(\alpha+\beta)}{141^\circ}
```

Square planar geometry:

```text
τ₄ = 0
```

Tetrahedral geometry:

```text
τ₄ = 1
```

Seesaw geometry:

```text
τ₄ ≈ 0.43
```

### τ₄′

Improved four-coordinate geometry index:

```math
\tau'_4 =
\frac{\beta-\alpha}{250.5^\circ}
+
\frac{180^\circ-\beta}{70.5^\circ}
```

Square planar geometry:

```text
τ₄′ = 0
```

Tetrahedral geometry:

```text
τ₄′ = 1
```

Seesaw geometry:

```text
τ₄′ ≈ 0.24
```

### τ₅

For five-coordinate compounds:

```math
\tau_5 = \frac{\beta-\alpha}{60^\circ}
```

Square pyramidal geometry:

```text
τ₅ = 0
```

Trigonal bipyramidal geometry:

```text
τ₅ = 1
```

Here, α and β are the two largest ligand-metal-ligand angles, with:

```text
β > α
```

### Octahedricity O

For six-coordinate compounds:

```math
O =
\sqrt{
\frac{1}{15}
\sum_{i=1}^{15}
(\hat{\theta_i}-\theta_i)^2
}
```

where:

```text
θ̂ᵢ = 180° for trans angles
θ̂ᵢ =  90° for cis angles
θᵢ  = experimental ligand-metal-ligand angle
```

*O* is close to zero for an almost ideal octahedron.

### τ₆ descriptors for six-coordinate compounds

For six-coordinate compounds, the web app reports two additional τ₆-type
descriptors:

```text
τ₆(largest)
τ₆(smallest)
```

They are intended as auxiliary descriptors for distinguishing octahedral,
trigonal-prismatic, and related six-coordinate environments.

#### τ₆(largest)

`τ₆(largest)` follows the six-coordinate geometry-index approach described by
Helen Stoeckli-Evans and co-workers for six-coordinate Cd(II) environments.

It is calculated from the three largest ligand-metal-ligand angles:

```math
\tau_6(\mathrm{largest}) =
\frac{540^\circ - (\alpha_1 + \alpha_2 + \alpha_3)}{180^\circ}
```

where:

```text
α₁, α₂, α₃ = the three largest L–M–L angles
```

For an ideal octahedron:

```text
α₁ = α₂ = α₃ = 180°
τ₆(largest) = 0
```

For increasingly trigonal-prismatic or distorted six-coordinate environments,
the three largest angles become smaller and `τ₆(largest)` increases.

This descriptor is based on the τ₆ formulation discussed in:

> Helen Stoeckli-Evans, M. G. Shankar, R. Kumaravel, A. Subashini,
> T. Sabari Girisun, K. Ramamurthi, Monika Kučeráková, Michal Dušek
> and Aurélien Crochet,  
> "Di-μ3-chlorido-1:2:3κ3Cl;2:3:4κ3Cl-di-μ2-chlorido-1:2κ2Cl;3:4κ2Cl-tetrakis[(4-amino-1,5-dimethyl-2-phenyl-2,3-dihydro-1H-pyrazol-3-one-κ2N4,O)chloridocadmium(II)] 1.7-hydrate:
> a new six-coordinate geometry index, τ6",  
> *Acta Crystallographica Section E: Crystallographic Communications*
> **2025**, *81*, 393–400.  
> DOI: https://doi.org/10.1107/S2056989025003123

#### τ₆(smallest)

`τ₆(smallest)` is an additional descriptor implemented in this web app. It is
based on the six smallest ligand-metal-ligand angles.

First, the mean of the six smallest L–M–L angles is calculated:

```math
\theta_6(\mathrm{smallest}) =
\frac{1}{6}\sum_{i=1}^{6}\theta_i
```

where:

```text
θᵢ = the six smallest L–M–L angles
```

Then:

```math
\tau_6(\mathrm{smallest}) =
\frac{90^\circ - \theta_6(\mathrm{smallest})}{19.47^\circ}
```

The value `19.47°` corresponds to:

```text
90.00° − 70.53°
```

so that:

```text
ideal octahedral limit:
θ₆(smallest) ≈ 90°
τ₆(smallest) ≈ 0
```

and for a trigonal-prismatic limiting case:

```text
θ₆(smallest) ≈ 70.53°
τ₆(smallest) ≈ 1
```

The app also reports:

```text
θ₆(smallest) /°
```

as the mean of the six smallest angles.

The two descriptors are reported separately because they are based on different
angle selections:

```text
τ₆(largest)   → three largest L–M–L angles
τ₆(smallest)  → six smallest L–M–L angles
```

---

## CShM reference shapes

The app currently supports CShM for CN 2–6.

### CN 2

```text
L-2
vT-2
vOC-2
```

### CN 3

```text
TP-3
vT-3
fvOC-3
mvOC-3
```

### CN 4

```text
SP-4
T-4
SS-4
vTBPY-4
```

### CN 5

```text
PP-5
vOC-5
TBPY-5
SPY-5
JTBPY-5
```

### CN 6

```text
HP-6
PPY-6
OC-6
TPR-6
JPPY-6
```

The reference coordinates are based on ideal structures used by `cosymlib` and
related Continuous Shape Measure tools.

---

## Bond detection

Possible coordinating atoms are detected using covalent radii.

The default radius table follows the "maximum radii" approach used in the
Python `cshm-cc` tool, based on tested values from Alvarez, SHELX and Jmol-style
radii. A default bond tolerance is applied to the sum of the central-atom and
ligand radii.

The per-card slider changes this tolerance interactively.

Hydrogen ligands are excluded by default unless enabled.

Metal–metal contacts are excluded by default unless enabled.

---

## Metal–metal contacts

By default, metal atoms are not considered as ligands. This avoids automatic
inclusion of metal-metal contacts or symmetry-equivalent metal atoms in the
coordination sphere.

The option:

```text
Include metal–metal bonds
```

allows metal atoms to be considered as ligands if they fall within the current
bond cutoff.

The exact same labelled atom as the central atom is always excluded.

---

## Limitations

- Direct COD loading is not available in the browser.
- The browser CIF handling is not `gemmi`; difficult CIFs may behave differently
  from the Python CLI.
- Symmetry and periodic boundary handling are implemented in JavaScript and may
  not cover all crystallographic edge cases.
- Polyhedral volume is calculated with a browser-side convex-hull routine and
  may differ from SciPy/Qhull in degenerate cases.
- Estimated standard deviations on bond lengths and angles are not calculated.
- CShM is currently implemented for CN 2–6.
- Very large CIFs or many metal sites may be slower in the browser.
- The two τ₆ descriptors are experimental/auxiliary CN = 6 descriptors and
  should be interpreted together with CShM values, octahedricity *O*, and visual
  inspection of the coordination sphere.

---

## Third-party software

### 3Dmol.js

The web app uses 3Dmol.js for molecular visualization.

Project:

```text
https://3dmol.csb.pitt.edu/
```

Reference:

> Nicholas Rego and David Koes,  
> "3Dmol.js: molecular visualization with WebGL",  
> *Bioinformatics* **2015**, *31*, 1322–1324.  
> DOI: https://doi.org/10.1093/bioinformatics/btu829

### CIF parser

The app uses a JavaScript CIF parser derived from `cif.js` by Gert-Jan Bekker.

Project/source:

```text
https://gitlab.com/pdbjapan/tools/cif-parsers
```

License:

```text
MIT
```

The license header in `static/js/cif.js` should be kept.

### Shape reference structures

Ideal reference structures are based on:

```text
https://github.com/GrupEstructuraElectronicaSimetria/cosymlib/blob/master/cosymlib/shape/ideal_structures_center.yaml
```

---

## References

If you use τ₄, τ₄′, τ₅, *O*, or CShM to describe coordination geometries,
please cite the relevant literature.

### τ₄

> Lei Yang, Douglas R. Powell, Robert P. Houser,  
> "Structural variation in copper(i) complexes with pyridylmethylamide ligands:
> structural analysis with a new four-coordinate geometry index, τ₄",  
> *Dalton Transactions* **2007**, 955–964.  
> DOI: https://doi.org/10.1039/B617136B

### τ₄′

> Andrzej Okuniewski, Damian Rosiak, Jarosław Chojnacki, Barbara Becker,  
> "Coordination polymers and molecular structures among complexes of
> mercury(II) halides with selected 1-benzoylthioureas",  
> *Polyhedron* **2015**, *90*, 47–57.  
> DOI: https://doi.org/10.1016/j.poly.2015.01.035

### τ₅

> Anthony W. Addison, T. Nageswara Rao, Jan Reedijk, Jacobus van Rijn,
> Gerrit C. Verschoor,  
> "Synthesis, structure, and spectroscopic properties of copper(II) compounds
> containing nitrogen–sulphur donor ligands; the crystal and molecular structure
> of aqua[1,7-bis(N-methylbenzimidazol-2′-yl)-2,6-dithiaheptane]copper(II)
> perchlorate",  
> *Journal of the Chemical Society, Dalton Transactions* **1984**, 1349–1356.  
> DOI: https://doi.org/10.1039/DT9840001349

### Octahedricity O

> Christopher M. Brown, Nicole E. Arsenault, Trevor N. K. Cross, Duane Hean,
> Zhen Xu, Michael O. Wolf,  
> "Structural, electrochemical and photophysical behavior of Ru(II) complexes
> with large bite angle sulfur-bridged terpyridyl ligands",  
> *Inorganic Chemistry Frontiers* **2020**, *7*, 117–127.  
> DOI: https://doi.org/10.1039/C9QI01009B

### τ₆

> Helen Stoeckli-Evans, M. G. Shankar, R. Kumaravel, A. Subashini,
> T. Sabari Girisun, K. Ramamurthi, Monika Kučeráková, Michal Dušek
> and Aurélien Crochet,  
> "Di-μ3-chlorido-1:2:3κ3Cl;2:3:4κ3Cl-di-μ2-chlorido-1:2κ2Cl;3:4κ2Cl-tetrakis[(4-amino-1,5-dimethyl-2-phenyl-2,3-dihydro-1H-pyrazol-3-one-κ2N4,O)chloridocadmium(II)] 1.7-hydrate:
> a new six-coordinate geometry index, τ6",  
> *Acta Crystallographica Section E: Crystallographic Communications*
> **2025**, *81*, 393–400.  
> DOI: https://doi.org/10.1107/S2056989025003123

### Continuous Shape Measures

> Mark Pinsky, David Avnir,  
> "Continuous Symmetry Measures. 5. The Classical Polyhedra",  
> *Inorganic Chemistry* **1998**, *37*, 5575–5582.  
> DOI: https://doi.org/10.1021/ic9804925

> Santiago Alvarez, Pere Alemany, David Casanova, Jordi Cirera, Miquel Llunell,
> David Avnir,  
> "Shape maps and polyhedral interconversion paths in transition metal chemistry",  
> *Coordination Chemistry Reviews* **2005**, *249*, 1693–1708.  
> DOI: https://doi.org/10.1016/j.ccr.2005.03.031

### Covalent radii

> Beatriz Cordero, Verónica Gómez, Ana E. Platero-Prats, Marc Revés,
> Jorge Echeverría, Eduard Cremades, Flavia Barragán, Santiago Alvarez,  
> "Covalent radii revisited",  
> *Dalton Transactions* **2008**, 2832–2838.  
> DOI: https://doi.org/10.1039/B801115J

### 3Dmol.js

> Nicholas Rego and David Koes,  
> "3Dmol.js: molecular visualization with WebGL",  
> *Bioinformatics* **2015**, *31*, 1322–1324.  
> DOI: https://doi.org/10.1093/bioinformatics/btu829

---

## Related projects

- Python CLI tool:  
  https://github.com/radi0sus/cshm-cc

- Manual atom-selection geometry tool:  
  https://github.com/radi0sus/tau-calc

- Continuous Symmetry Measure / Shape code:  
  https://github.com/continuous-symmetry-measure/shape

- SHAPE program:  
  https://www.ee.ub.edu/downloads/

- Online CSM calculator:  
  https://csm.ouproj.org.il/molecule

---

## Notes on licenses and attribution

This repository contains original project code and third-party JavaScript
libraries.

Keep license headers in bundled third-party files, especially:

```text
static/js/cif.js
static/vendor/3Dmol-min.js
```

If redistributing the app, include appropriate license information for all
third-party components.
