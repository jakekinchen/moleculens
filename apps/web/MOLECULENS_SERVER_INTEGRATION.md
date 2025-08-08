# MoleculeLens Server Integration Guide

This document provides comprehensive guidance on integrating the MoleculeLens server API (api.moleculens.com) into the MoleculeLens project for advanced molecular visualization, PyMOL rendering, and scientific diagram generation.

## 🎯 Overview

The MoleculeLens server provides four main capabilities:

1. **PyMOL 3D Rendering** - High-quality molecular structure rendering with ray tracing
2. **Scientific Diagram Generation** - AI-powered creation of molecular diagrams from natural language
3. **Protein Structure Database** - Access to RCSB PDB and AlphaFold structures
4. **Molecular Prompt Processing** - Natural language to molecular data conversion

## 🏗️ Architecture Decision

**MoleculeViewer Focus**: The MoleculeViewer component is optimized for real-time 3D molecular visualization using Three.js with PDB data. It does not include 2D PNG overlays to maintain performance and simplicity.

**Separate Graphics Page**: 2D molecular graphics, diagrams, and PNG generation will be handled on a dedicated graphics page using the MoleculeLens API service directly. This separation ensures:

- Clean component responsibilities
- Optimal performance for 3D visualization
- Flexible 2D graphics capabilities
- Better maintainability

## 📁 Project Structure

```
app/
├── services/
│   ├── moleculens-api.ts          # Main API integration service
│   ├── api.ts                     # Existing API service (enhanced)
│   └── pubchem.ts                 # Existing PubChem service
├── components/
│   └── panels/
│       └── MoleculeViewer.tsx     # Enhanced with PyMOL integration
└── types/
    └── index.ts                   # Type definitions
```

## 🚀 Quick Start

### 1. Basic 2D Transparent PNG Generation

Perfect for UI overlays, thumbnails, and diagram elements:

```typescript
import { safeGet2DTransparentPNG } from '@/services/moleculens-api';

// Generate a high-quality transparent PNG
const generateMoleculeThumbnail = async (moleculeName: string) => {
  try {
    const pngBlob = await safeGet2DTransparentPNG(moleculeName, {
      resolution: [512, 512],
      dpi: 150,
      quality: 'high',
    });

    const imageUrl = URL.createObjectURL(pngBlob);
    return imageUrl;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
};
```

### 2. 3D PDB Data for Three.js

Get PDB data optimized for Three.js reconstruction:

```typescript
import { safeGet3DPDBData } from '@/services/moleculens-api';
import { PDBLoader } from 'three/examples/jsm/loaders/PDBLoader.js';

const load3DMolecule = async (moleculeName: string, scene: THREE.Scene) => {
  try {
    const pdbData = await safeGet3DPDBData(moleculeName);
    const loader = new PDBLoader();
    const pdb = loader.parse(pdbData);

    scene.add(pdb);
    return pdb;
  } catch (error) {
    console.error('Failed to load 3D molecule:', error);
    return null;
  }
};
```

### 3. Enhanced MoleculeViewer

The enhanced MoleculeViewer focuses on 3D molecular visualization with performance optimizations:

```tsx
import MoleculeViewer from '@/components/panels/MoleculeViewer';

<MoleculeViewer
  pdbData={pdbData}
  title="Caffeine"
  showAnnotations={true}
  enableRibbonOverlay={false}
/>;
```

## 🔧 API Service Layer

### Core Functions

#### Rendering API

```typescript
// High-quality PyMOL rendering
const result = await renderMolecule({
  description: 'Show caffeine molecule with cartoon representation',
  format: 'image',
  transparent_background: true,
  ray_trace: true,
  resolution: [1920, 1080],
  dpi: 300,
  ray_trace_mode: 'poster',
});

// Get both 2D and 3D data in one request
const moleculeData = await safeGetMoleculeData({
  molecule_name: 'caffeine',
  render_type: 'both',
  size: 'medium',
  quality: 'high',
});
```

#### Scientific Diagrams

```typescript
// Generate diagrams from natural language
const diagram = await safeGenerateGraphic({
  brief: 'Show the glycolysis pathway with key enzymes',
  width: 1200,
  height: 800,
  theme: 'Clean scientific visualization',
});

// Generate molecule diagrams
const moleculeDiagram = await safeGenerateMoleculeDiagram({
  prompt: 'Show the reaction between glucose and ATP',
  canvas_width: 800,
  canvas_height: 600,
});
```

#### Protein Structures

```typescript
// Fetch protein structures
const proteinData = await fetchProteinStructure({
  identifier: '1ubq',
  format: 'pdb',
});

// Get AlphaFold models
const alphafoldModel = await fetchAlphaFoldModel('P12345', 'pdb');
```

### Error Handling

All API functions include comprehensive error handling:

```typescript
try {
  const result = await safeRenderMolecule(request);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout
  } else if (error.message.includes('404')) {
    // Handle not found
  } else if (error.message.includes('429')) {
    // Handle rate limiting
  }
}
```

## 🎨 Enhanced MoleculeViewer Features

### Performance Optimizations

The MoleculeViewer now includes intelligent performance scaling:

- **0-5k atoms**: Individual mesh rendering (existing)
- **5k-20k atoms**: GPU instanced rendering for better performance
- **>20k atoms**: Point cloud rendering for massive structures

### Core Features

#### 3D Molecular Visualization

- Real-time Three.js rendering with WebGL acceleration
- Interactive controls with orbit, zoom, and pan
- Automatic camera positioning and molecule centering
- Support for both PDB and SDF molecular formats

#### Performance Features

- GPU instanced rendering for medium-sized molecules
- Point cloud fallback for massive macromolecules
- Intelligent label management to prevent performance issues
- Memory cleanup and disposal management

#### Visual Enhancements

- PBR (Physically Based Rendering) materials
- Environment mapping for realistic reflections
- Post-processing effects with outline support
- Ribbon/cartoon overlay for protein structures

### Props Interface

```typescript
interface MoleculeViewerProps {
  isLoading?: boolean;
  pdbData: string;
  sdfData?: string;
  title: string;
  showAnnotations?: boolean;
  moleculeInfo?: MoleculeInfo | null;
  enableRibbonOverlay?: boolean;
}
```

## 📊 Performance Considerations

### Caching Strategy

```typescript
class MoleculeCache {
  private cache = new Map<string, any>();

  async getMolecule(name: string, type: 'both' | '2d' | '3d' = 'both') {
    const key = `${name}_${type}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const data = await safeGetMoleculeData({
      molecule_name: name,
      render_type: type,
    });

    this.cache.set(key, data);
    return data;
  }
}
```

### Batch Processing

For multiple molecules, use batch endpoints:

```typescript
const results = await getBatchMolecules(['caffeine', 'aspirin', 'glucose'], {
  render_type: '2d_transparent',
  size: 'small',
  quality: 'fast',
});
```

### Memory Management

- Automatic cleanup of blob URLs
- Texture disposal for Three.js objects
- Cache size limits with LRU eviction

## 🔄 Integration Patterns

### 1. Performance-Optimized Rendering

Use the MoleculeViewer for real-time 3D visualization:

```typescript
const OptimizedMoleculeViewer = ({ moleculeName, pdbData }) => {
  return (
    <MoleculeViewer
      pdbData={pdbData}
      title={moleculeName}
      showAnnotations={true}
      enableRibbonOverlay={false}
    />
  );
};
```

### 2. Separate Graphics Page

For 2D graphics and diagrams, use the API service directly on a separate page:

```typescript
const GraphicsPage = () => {
  const [diagram, setDiagram] = useState(null);

  const generateDiagram = async () => {
    const result = await safeGenerateGraphic({
      brief: "Show the glycolysis pathway",
      width: 1200,
      height: 800
    });
    setDiagram(result.svg_content);
  };

  return (
    <div>
      <button onClick={generateDiagram}>Generate Diagram</button>
      {diagram && <div dangerouslySetInnerHTML={{ __html: diagram }} />}
    </div>
  );
};
```

### 3. API Integration for External Data

Use the API service to fetch PDB data for the MoleculeViewer:

```typescript
const APIIntegratedViewer = ({ moleculeName }) => {
  const [pdbData, setPdbData] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMolecule = async () => {
      try {
        const data = await safeGet3DPDBData(moleculeName);
        setPdbData(data);
      } catch (error) {
        console.error('Failed to fetch PDB data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMolecule();
  }, [moleculeName]);

  if (loading) return <div>Loading...</div>;

  return (
    <MoleculeViewer
      pdbData={pdbData}
      title={moleculeName}
      isLoading={loading}
    />
  );
};
```

## 🎯 Use Cases

### 1. Educational Content

```typescript
// Generate educational diagrams
const educationalDiagram = await safeGenerateGraphic({
  brief: 'Explain photosynthesis with molecular detail',
  context: 'High school biology textbook',
  theme: 'Educational, clear labels',
  width: 1200,
  height: 800,
});
```

### 2. Research Publications

```typescript
// Publication-quality molecular renders
const publicationRender = await renderMolecule({
  description: 'Protein-ligand complex with binding site highlighted',
  format: 'image',
  ray_trace: true,
  ray_trace_mode: 'poster',
  resolution: [2400, 1800],
  dpi: 300,
  antialias: true,
});
```

### 3. Interactive Presentations

```typescript
// Animated molecular presentations
const animation = await createMoleculeAnimation('insulin', 'rotation', {
  duration: 10,
  fps: 30,
  resolution: [1920, 1080],
  format: 'mp4',
});
```

### 4. Comparative Analysis

```typescript
// Compare multiple structures
const structures = await Promise.all([
  fetchProteinStructure({ identifier: '1ubq', format: 'pdb' }),
  fetchProteinStructure({ identifier: '2ubq', format: 'pdb' }),
  fetchProteinStructure({ identifier: '3ubq', format: 'pdb' }),
]);
```

## 🛠️ Development Guidelines

### Environment Setup

1. **API Access**: The server is publicly accessible at `api.moleculens.com`
2. **Rate Limiting**: Implement client-side throttling for batch operations
3. **Error Handling**: Always use the safe wrapper functions
4. **Caching**: Implement appropriate caching for repeated requests

### Testing Strategy

```typescript
// Mock API responses for testing
jest.mock('@/services/moleculens-api', () => ({
  safeGet2DTransparentPNG: jest.fn().mockResolvedValue(new Blob()),
  safeGet3DPDBData: jest.fn().mockResolvedValue('MOCK_PDB_DATA'),
  safeGetMoleculeData: jest.fn().mockResolvedValue({
    name: 'Test Molecule',
    png: 'data:image/png;base64,mock',
    pdb_data: 'MOCK_PDB',
  }),
}));
```

### Performance Monitoring

```typescript
// Track API performance
const trackAPICall = async (operation: string, fn: () => Promise<any>) => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`${operation} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${operation} failed after ${duration}ms:`, error);
    throw error;
  }
};
```

## 🔮 Future Enhancements

### Planned Features

1. **WebGL Acceleration**: GPU-accelerated molecular dynamics
2. **VR/AR Support**: Immersive molecular visualization
3. **Collaborative Features**: Real-time shared molecular sessions
4. **Advanced Analytics**: Molecular property calculations
5. **Custom Shaders**: Specialized rendering techniques

### API Roadmap

1. **Streaming Animations**: Real-time molecular dynamics
2. **Interactive Diagrams**: Clickable molecular pathways
3. **Multi-format Export**: Support for more file formats
4. **Cloud Rendering**: Distributed rendering for complex scenes

## 📚 Additional Resources

- [MoleculeLens Server API Documentation](https://api.moleculens.com/docs)
- [PyMOL Documentation](https://pymol.org/documentation)
- [Three.js PDB Loader](https://threejs.org/examples/#webgl_loader_pdb)
- [RCSB PDB API](https://data.rcsb.org/)

## 🤝 Contributing

When contributing to the MoleculeLens server integration:

1. **Test API calls** with various molecule types
2. **Handle edge cases** (large molecules, network failures)
3. **Optimize performance** for batch operations
4. **Document new features** with examples
5. **Maintain backward compatibility** with existing code

## 📞 Support

For issues related to:

- **API Integration**: Check network connectivity and API status
- **Performance**: Review caching and batch processing strategies
- **Rendering Quality**: Adjust PyMOL options and resolution settings
- **Error Handling**: Implement proper fallback mechanisms

The integration provides a powerful foundation for advanced molecular visualization while maintaining the performance and usability of the existing MoleculeLens application.
