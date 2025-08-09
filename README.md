Welcome to MolecuLens!

## Research (Deterministic FigureSpec)

- New page: `/research` lets you submit a FigureSpec v1 to generate deterministic, content-addressed figures.
- After submit, you are redirected to `/f/[spec_id]` to view status and assets.

### FigureSpec v1 shape
- Required keys: `version`, `input`, `render`, `style_preset`, `annotations`, `"3d"`.
- `spec_id` is computed deterministically (sha256 over canonical JSON).

### API
- The web app proxies to your backend at `https://api.moleculens.com` via:
  - `POST /api/figure` → `POST https://api.moleculens.com/v1/figure`
  - `GET  /api/figure/{spec_id}` → `GET https://api.moleculens.com/v1/figure/{spec_id}`
- Set environment variable `PYMOL_SERVER_BASE_URL=https://api.moleculens.com`.

### Quick start
1. Install deps: `pnpm install`
2. Run dev: `pnpm dev:web`
3. Open `http://localhost:3000/research` and submit a molecule.

### Sample spec
```
{
  "version": 1,
  "input": { "kind": "smiles", "value": "CC(=O)Oc1ccccc1C(=O)O", "protonation_pH": 7.4, "conformer_method": "none" },
  "render": { "modes": ["2d","3d"], "outputs": ["svg","png"], "width": 1024, "height": 768, "transparent": true, "dpi": 300 },
  "style_preset": "nature-2025",
  "annotations": { "functional_groups": true, "charge_labels": "minimal", "atom_numbering": false, "scale_bar": true, "legend": "auto" },
  "3d": { "representation": "cartoon+licorice", "bg": "transparent", "camera": { "target": "auto", "distance": "auto", "azimuth": 30, "elevation": 15 }, "lighting": "three_point_soft", "quality": "raytrace_high" }
}
```
