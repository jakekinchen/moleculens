# Client-Side Molecular Processing

This document describes the new client-side molecular processing system that replaces PyMOL server API dependencies.

## 🎯 Overview

The MoleculeLens application now uses client-side molecular processing libraries to handle:

1. **Direct PubChem API Integration** - Fetch molecular data directly from PubChem
2. **2D Structure Generation** - Create molecular diagrams using OpenChemLib
3. **Format Conversion** - Convert between SDF, PDB, and other molecular formats
4. **RCSB PDB Access** - Direct access to protein structures
5. **AlphaFold Integration** - Fetch predicted protein structures

## 🏗️ Architecture

```
Client-Side Processing:
├── services/molecular.ts          # Main molecular processing service
├── components/panels/
│   ├── MoleculeViewer.tsx         # 3D molecular visualization (Three.js)
│   └── Molecule2DViewer.tsx       # 2D molecular structures (OpenChemLib)
├── lib/pubchem.ts                 # Enhanced PubChem integration
└── molecular-demo/                # Demo page showcasing capabilities
```

## 🚀 Key Features

### Direct API Integration

- **PubChem REST API** - Search molecules by name, get properties, SDF data
- **RCSB PDB API** - Fetch protein structures and metadata
- **AlphaFold Database** - Access predicted protein structures
- **No server dependencies** - All processing happens client-side

### 2D Structure Generation

```typescript
import { generate2DMoleculeImage } from '@/services/molecular';

const result = await generate2DMoleculeImage('CCO', {
  width: 300,
  height: 300,
  format: 'svg',
  transparent: true,
  atom_labels: true,
});
```

### 3D Structure Processing

```typescript
import { searchMoleculeByName, convertSDFToPDB } from '@/services/molecular';

const molecule = await searchMoleculeByName('caffeine');
if (molecule.sdf_data) {
  const pdbData = await convertSDFToPDB(molecule.sdf_data);
  // Use with MoleculeViewer component
}
```

### Enhanced PubChem Integration

```typescript
import { fetchMoleculeDataEnhanced } from '@/lib/pubchem';

const data = await fetchMoleculeDataEnhanced('aspirin', 'small molecule');
// Returns: { pdb_data, sdf, name, cid, formula, info }
```

## 📦 Dependencies

### Core Libraries

- **openchemlib** - 2D structure generation and molecular calculations
- **@rdkit/rdkit** - Advanced molecular processing (future enhancement)
- **sdf-parser** - SDF format parsing
- **three-sdf-loader** - 3D molecular visualization

### Existing Libraries (Enhanced)

- **three.js** - 3D visualization engine
- **PDBLoader** - Protein structure loading
- **CSS2DRenderer** - Molecular labels

## 🔄 Migration from PyMOL Server

### Before (PyMOL Server API)

```typescript
// Old approach - required server API
import { renderMolecule, get2DTransparentPNG } from '@/services/moleculens-api';

const pngBlob = await get2DTransparentPNG('caffeine');
const pdbData = await get3DPDBData('caffeine');
```

### After (Client-Side)

```typescript
// New approach - client-side processing
import { searchMoleculeByName, generate2DMoleculeImage } from '@/services/molecular';

const molecule = await searchMoleculeByName('caffeine');
const image = await generate2DMoleculeImage(molecule.smiles);
```

## 🎨 Components

### Molecule2DViewer

Renders 2D molecular structures using OpenChemLib:

```tsx
<Molecule2DViewer smiles="CCO" width={300} height={300} transparent={true} atomLabels={false} />
```

### MoleculeCard2D

Complete molecule card with 2D structure and properties:

```tsx
<MoleculeCard2D
  smiles="CCO"
  name="Ethanol"
  formula="C2H6O"
  molecularWeight={46.07}
  onViewDetails={() => showDetails()}
/>
```

### Enhanced MoleculeViewer

The existing 3D viewer now supports hover-to-pause rotation and improved performance.

## 🚀 Performance Benefits

### Client-Side Advantages

- **No Network Latency** - Instant 2D structure generation
- **No Server Costs** - Eliminate PyMOL server infrastructure
- **Better Reliability** - No external API dependencies for basic operations
- **Privacy** - Molecular data stays client-side
- **Scalability** - No server load concerns

### Optimizations

- **GPU Instancing** - Efficient rendering for large molecules
- **Points Cloud Fallback** - Handle massive macromolecules (>20k atoms)
- **Smart Caching** - Cache molecular data and images
- **Lazy Loading** - Load libraries only when needed

## 🧪 Demo Page

Visit `/molecular-demo` to see the new capabilities:

- **Real-time Search** - Search PubChem directly from the browser
- **2D/3D Toggle** - Switch between 2D diagrams and 3D structures
- **Interactive Examples** - Pre-loaded demo molecules
- **Performance Metrics** - See the speed improvements

## 🔧 API Reference

### Core Functions

#### `searchMoleculeByName(name: string)`

Search for molecules by name using PubChem API.

#### `getMoleculeDataByCID(cid: number)`

Get comprehensive molecule data by PubChem CID.

#### `generate2DMoleculeImage(smiles: string, options?)`

Generate 2D molecular structure images.

#### `convertSDFToPDB(sdfData: string)`

Convert SDF format to PDB format.

#### `fetchProteinStructure(pdbId: string)`

Fetch protein structures from RCSB PDB.

### Enhanced PubChem Functions

#### `fetchMoleculeDataEnhanced(query: string, type: 'small molecule' | 'macromolecule')`

Enhanced molecule fetching with fallback to original methods.

#### `getMoleculeDataByCIDEnhanced(cid: number)`

Enhanced CID-based molecule fetching.

## 🔮 Future Enhancements

### Planned Features

- **RDKit.js Integration** - Advanced molecular calculations
- **WebGL 2D Rendering** - Hardware-accelerated 2D structures
- **Molecular Similarity** - Compare molecular structures
- **Batch Processing** - Handle multiple molecules efficiently
- **Offline Support** - Cache molecular data for offline use

### Performance Improvements

- **Web Workers** - Offload heavy calculations
- **WASM Modules** - Native-speed molecular processing
- **IndexedDB Caching** - Persistent molecular data storage
- **Streaming APIs** - Handle large molecular datasets

## 📝 Migration Guide

### For Developers

1. **Replace API Calls**

   ```typescript
   // Old
   import { renderMolecule } from '@/services/moleculens-api';

   // New
   import { searchMoleculeByName } from '@/services/molecular';
   ```

2. **Update Components**

   ```tsx
   // Add 2D structure support
   import Molecule2DViewer from '@/components/panels/Molecule2DViewer';
   ```

3. **Enhanced Error Handling**
   ```typescript
   // New service includes fallback mechanisms
   const data = await fetchMoleculeDataEnhanced(query, type);
   ```

### For Users

- **Faster Loading** - 2D structures appear instantly
- **Better Reliability** - Less dependent on external services
- **Enhanced Features** - New 2D/3D toggle capabilities
- **Improved Performance** - Smoother 3D molecular visualization

## 🐛 Troubleshooting

### Common Issues

1. **OpenChemLib Loading** - Ensure proper async/await usage
2. **CORS Issues** - PubChem API calls are properly configured
3. **Large Molecules** - Automatic fallback to points cloud rendering
4. **Browser Compatibility** - Modern browsers required for WebGL

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging of molecular processing steps.

## 📊 Comparison

| Feature                 | PyMOL Server             | Client-Side         |
| ----------------------- | ------------------------ | ------------------- |
| 2D Structure Generation | ✅ Server                | ✅ Instant          |
| 3D Structure Loading    | ✅ Server                | ✅ Direct API       |
| Network Dependency      | ❌ High                  | ✅ Minimal          |
| Performance             | ❌ Network Limited       | ✅ Local Processing |
| Cost                    | ❌ Server Infrastructure | ✅ Free             |
| Reliability             | ❌ External Dependency   | ✅ Self-Contained   |
| Privacy                 | ❌ Data Sent to Server   | ✅ Client-Side Only |

The new client-side approach provides significant improvements in performance, reliability, and cost-effectiveness while maintaining all the functionality of the previous PyMOL server integration.
