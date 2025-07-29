import React, { useState } from 'react';
import { generateMoleculeDiagram } from '../../services/api';
import { DiagramPlan, DiagramPromptRequest } from '../../types';

interface DiagramInputPanelProps {
  onDiagramUpdate: (image: string, plan: DiagramPlan) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

const DiagramInputPanel: React.FC<DiagramInputPanelProps> = ({
  onDiagramUpdate,
  onLoadingChange,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    onLoadingChange?.(true);
    setError(null);
    const request: DiagramPromptRequest = { prompt };
    try {
      const response = await generateMoleculeDiagram(request);
      onDiagramUpdate(response.diagram_image, response.diagram_plan);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate diagram';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <textarea
        className="w-full p-2 rounded bg-gray-800 text-gray-100"
        rows={4}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe a molecular diagram..."
      />
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Submit'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default DiagramInputPanel;
