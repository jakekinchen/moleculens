import { useState, useEffect } from 'react';
import { ModelInfo } from '../types';
import { getModels } from '../services/api';

export const useModels = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const modelList = await getModels();
        setModels(modelList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  return { models, loading, error };
}; 