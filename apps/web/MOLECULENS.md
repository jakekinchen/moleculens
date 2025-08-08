# MolecuLens: Molecular Visualization AI Client

MolecuLens is a sophisticated web application that provides interactive 3D molecular visualization powered by AI. It combines advanced molecular data retrieval, intelligent prompt processing, and high-performance 3D rendering to create an educational and research tool for exploring molecular structures.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Data Sources & Integration](#data-sources--integration)
- [Visualization Engine](#visualization-engine)
- [AI & Language Processing](#ai--language-processing)
- [User Interface](#user-interface)
- [API Endpoints](#api-endpoints)
- [Performance Optimizations](#performance-optimizations)
- [Technical Stack](#technical-stack)
- [Development & Deployment](#development--deployment)

## Overview

MolecuLens transforms natural language queries about molecular structures into interactive 3D visualizations. Users can ask questions like "Show me caffeine" or "What does insulin look like?" and receive detailed molecular models with educational information, presentation scripts, and downloadable content.

### Key Capabilities

- **Natural Language Processing**: Converts user queries into specific molecular searches
- **Dual Database Support**: Searches both PubChem (small molecules) and RCSB PDB (macromolecules)
- **High-Performance 3D Rendering**: Optimized for molecules ranging from simple compounds to massive proteins
- **Voice Input**: Speech-to-text transcription with chemistry-specific vocabulary
- **Interactive Presentations**: AI-generated educational scripts with timed molecular highlights
- **History & Time Machine**: Session persistence and visualization history
- **Export Capabilities**: Download standalone HTML presentations

## Core Features

### 1. Intelligent Molecule Classification

- **AI-Powered Classification**: Uses OpenAI's models to determine if a query refers to small molecules or macromolecules
- **Fallback Mechanisms**: Multiple search strategies for robust molecule identification
- **Name Sanitization**: Handles Unicode characters, special symbols, and formatting inconsistencies

### 2. Multi-Source Data Retrieval

- **PubChem Integration**: Comprehensive small molecule database with 3D conformers
- **RCSB PDB Integration**: Protein and macromolecule structures with metadata
- **3D Structure Prioritization**: Attempts multiple sources (PubChem 3D, NIST, CACTUS) for optimal geometry
- **Fallback to 2D**: Graceful degradation when 3D structures aren't available

### 3. Advanced 3D Visualization

- **Performance Scaling**: Adaptive rendering based on molecular size
  - 0-5k atoms: Individual mesh rendering
  - 5k-20k atoms: GPU instanced rendering
  - 20k+ atoms: Point cloud visualization
- **Real-time Animation**: Smooth molecular rotation with pause/play controls
- **Interactive Controls**: Orbit controls, zoom, and fullscreen mode
- **Atom Labeling**: CSS2D labels with intelligent visibility management

### 4. Voice Interface

- **Speech Recognition**: WebRTC-based audio capture with Whisper transcription
- **Chemistry-Optimized**: Custom prompts for accurate chemical terminology recognition
- **Real-time Visualization**: Audio waveform display during recording
- **Seamless Integration**: Voice input directly populates text prompts

### 5. Educational Features

- **AI-Generated Presentations**: Contextual scripts highlighting molecular features
- **Molecular Information Panels**: Comprehensive metadata display
- **Interactive Timelines**: Timed presentation steps with atom highlighting
- **Export Functionality**: Standalone HTML files for offline use

## Architecture

### Application Structure

```
app/
├── api/                    # Next.js API routes
│   ├── prompt/            # Core molecular processing endpoints
│   └── transcribe/        # Voice processing
├── components/            # React components
│   ├── layout/           # Header, footer, layout wrappers
│   ├── modals/           # Settings, help modals
│   ├── panels/           # Main UI panels (input, viewer, time machine)
│   └── ui/               # Reusable UI components
├── lib/                  # Core business logic
│   ├── pubchem.ts        # Molecular data retrieval
│   ├── llm.ts            # AI processing
│   ├── diagram.ts        # Diagram generation
│   └── utils.ts          # Utilities
├── services/             # API service layer
├── types/                # TypeScript definitions
└── styles/               # CSS and styling
```

### Data Flow

1. **User Input** → Natural language query or voice input
2. **AI Classification** → Determine molecule type and extract name
3. **Data Retrieval** → Fetch from appropriate database (PubChem/RCSB)
4. **3D Processing** → Parse molecular data and optimize for rendering
5. **Visualization** → Render with Three.js using performance-appropriate method
6. **Enhancement** → Generate educational content and metadata

## Data Sources & Integration

### PubChem (Small Molecules)

- **Primary Database**: 100M+ chemical compounds
- **3D Structure Sources**:
  - PubChem computed conformers
  - NIST WebBook (via CAS numbers)
  - NCI/CACTUS chemical identifier resolver
- **Metadata**: Formula, molecular weight, SMILES, synonyms, properties
- **Search Methods**: Exact name, autocomplete, class-based search

### RCSB Protein Data Bank (Macromolecules)

- **Protein Structures**: 200k+ experimentally determined structures
- **Search Capabilities**:
  - Keyboard autocomplete
  - Full-text search
  - Structured attribute queries
  - Fallback suggestion system
- **Rich Metadata**: Resolution, experimental method, organism, publication data
- **File Formats**: PDB format with comprehensive structural data

### External Services

- **OpenAI API**: GPT models for classification and content generation
- **Whisper API**: Speech-to-text transcription
- **HDRI Environment Maps**: Realistic molecular rendering

## Visualization Engine

### Three.js Implementation

- **WebGL Rendering**: Hardware-accelerated 3D graphics
- **Post-processing**: Outline effects and visual enhancements
- **Environment Mapping**: HDRI-based realistic lighting
- **Responsive Design**: Dynamic resizing and mobile optimization

### Performance Optimization Strategies

#### Atom Count-Based Rendering

```typescript
// Performance thresholds
const ATOMS_INSTANCED_THRESHOLD = 5000;
const POINTS_THRESHOLD = 20000;

if (atomCount <= ATOMS_INSTANCED_THRESHOLD) {
  // Individual mesh rendering for small molecules
  renderIndividualAtoms();
} else if (atomCount <= POINTS_THRESHOLD) {
  // GPU instanced rendering for medium molecules
  renderInstancedAtoms();
} else {
  // Point cloud for massive structures
  renderPointCloud();
}
```

#### Memory Management

- **Geometry Disposal**: Automatic cleanup of Three.js resources
- **Texture Management**: Efficient material reuse
- **Scene Graph Optimization**: Minimal object hierarchy

#### Visual Quality Scaling

- **Adaptive LOD**: Level-of-detail based on molecular size
- **Selective Labeling**: Atom labels disabled for large structures
- **Bond Rendering**: Omitted for point cloud representations

## AI & Language Processing

### Prompt Classification

```typescript
interface PromptClassification {
  type: 'small molecule' | 'macromolecule' | 'unknown';
  name: string | null;
}
```

The AI system analyzes user queries to:

- Determine molecular category
- Extract specific molecule names
- Handle complex queries with context
- Provide fallback suggestions

### Content Generation

- **Presentation Scripts**: Educational timelines with molecular highlights
- **Contextual Information**: Relevant facts and applications
- **Interactive Captions**: Timed educational content

### Voice Processing

- **Chemistry-Specific Prompts**: Optimized for chemical terminology
- **Real-time Transcription**: Streaming audio processing
- **Error Handling**: Robust fallback mechanisms

## User Interface

### Design Philosophy

- **Mobile-First**: Responsive design for all screen sizes
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Performance**: Smooth animations and interactions
- **Educational Focus**: Clear information hierarchy

### Key Components

#### Input Panel (`InputPanel.tsx`)

- **Multi-modal Input**: Text and voice input support
- **Smart Suggestions**: Random chemistry topic suggestions
- **Real-time Feedback**: Loading states and error handling
- **Audio Visualization**: Waveform display during recording

#### Molecule Viewer (`MoleculeViewer.tsx`)

- **3D Rendering**: Primary visualization component
- **Interactive Controls**: Pause/play, fullscreen, info panels
- **Performance Monitoring**: Adaptive rendering based on molecule size
- **Information Display**: Comprehensive molecular metadata

#### Time Machine (`TimeMachinePanel.tsx`)

- **History Management**: Session-persistent visualization history
- **Quick Restore**: One-click restoration of previous visualizations
- **Metadata Display**: Timestamps and visualization status

### State Management

- **React Hooks**: Local state management with useEffect/useState
- **Session Storage**: Persistent history across browser sessions
- **Real-time Updates**: Responsive UI state synchronization

## API Endpoints

### Core Molecular Processing

- **`POST /api/prompt/fetch-molecule-data`**: Main molecule retrieval endpoint
- **`POST /api/prompt/generate-molecule-html`**: Presentation HTML generation
- **`POST /api/prompt/generate-presentation-script`**: AI-generated educational content
- **`GET /api/prompt/models`**: Available AI model listing

### Utility Endpoints

- **`POST /api/transcribe`**: Voice-to-text conversion
- **`GET /api/prompt/process/[jobId]`**: Job status tracking
- **`POST /api/prompt/generate-molecule-diagram`**: Diagram generation

### Error Handling

- **Structured Responses**: Consistent error format across endpoints
- **Fallback Mechanisms**: Multiple data source attempts
- **User-Friendly Messages**: Clear error communication

## Performance Optimizations

### Rendering Performance

1. **GPU Instancing**: Single draw call for thousands of atoms
2. **Point Cloud Fallback**: Minimal geometry for massive molecules
3. **Selective Features**: Disable expensive features for large structures
4. **Memory Management**: Automatic resource cleanup

### Network Optimization

1. **Concurrent Requests**: Parallel API calls where possible
2. **Caching**: Session-based result caching
3. **Compression**: Efficient data transfer
4. **Fallback Sources**: Multiple data retrieval strategies

### User Experience

1. **Progressive Loading**: Immediate feedback with loading states
2. **Smooth Animations**: 60fps molecular rotation
3. **Responsive Design**: Optimized for all device sizes
4. **Offline Capability**: Downloadable standalone presentations

## Technical Stack

### Frontend

- **Next.js 15**: React framework with App Router
- **React 19**: Latest React features and optimizations
- **TypeScript**: Type-safe development
- **Three.js**: 3D graphics and WebGL rendering
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives

### Backend & APIs

- **Next.js API Routes**: Serverless API endpoints
- **OpenAI API**: GPT models and Whisper transcription
- **External APIs**: PubChem, RCSB PDB, NIST, CACTUS

### Development Tools

- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Zod**: Runtime type validation

### Deployment

- **Vercel**: Optimized Next.js hosting
- **Edge Functions**: Global API distribution
- **CDN**: Static asset optimization

## Development & Deployment

### Environment Setup

```bash
npm install
npm run dev
```

### Required Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key
```

### Build Process

```bash
npm run build
npm run start
```

### Key Scripts

- `npm run dev`: Development server
- `npm run build`: Production build
- `npm run lint`: Code linting
- `npm run format`: Code formatting

### Performance Monitoring

- **Real-time Metrics**: Molecule size and rendering performance
- **Error Tracking**: Comprehensive error logging
- **User Analytics**: Usage patterns and optimization opportunities

---

MolecuLens represents a sophisticated integration of AI, molecular databases, and high-performance 3D rendering to create an educational tool that makes molecular science accessible and engaging. Its architecture supports both simple educational queries and complex research applications, with performance optimizations that scale from small organic molecules to massive protein complexes.
