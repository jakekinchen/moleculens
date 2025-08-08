import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HistoryEntry } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Storage keys
const STORAGE_KEYS = {
  HISTORY: 'moleculens_history',
};

// Save visualization history to session storage (excluding heavy molecular data)
export function saveHistoryToSession(history: HistoryEntry[]): void {
  try {
    // Create lightweight history entries that exclude molecular data
    const lightweightHistory = history.map(entry => ({
      prompt: entry.prompt,
      timestamp: entry.timestamp,
      title: entry.title,
      apiParams: entry.apiParams,
      moleculeType: entry.moleculeType,
      name: entry.name,
      cid: entry.cid,
      pdbId: entry.pdbId,
      info: entry.info,
      // Store only metadata from visualization, not the actual molecular data
      visualization: entry.visualization
        ? {
            title: entry.visualization.title,
            timecode_markers: entry.visualization.timecode_markers,
            total_elements: entry.visualization.total_elements,
            html:
              entry.visualization.html.length > 10000
                ? '[Large HTML excluded]'
                : entry.visualization.html,
            // Exclude pdb_data and sdf entirely - these will be refetched using apiParams
          }
        : undefined,
    }));

    const serializedHistory = JSON.stringify(lightweightHistory, (key, value) => {
      // Handle Date serialization
      if (key === 'timestamp' && value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    });

    sessionStorage.setItem(STORAGE_KEYS.HISTORY, serializedHistory);
  } catch (error) {
    console.error('Error saving history to session storage:', error);
  }
}

// Load visualization history from session storage
export function loadHistoryFromSession(): HistoryEntry[] {
  try {
    const serializedHistory = sessionStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!serializedHistory) return [];

    return JSON.parse(serializedHistory, (key, value) => {
      // Handle Date deserialization
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
  } catch (error) {
    console.error('Error loading history from session storage:', error);
    return [];
  }
}

// Clear visualization history from session storage
export function clearHistoryFromSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.HISTORY);
  } catch (error) {
    console.error('Error clearing history from session storage:', error);
  }
}

// Helper function to recreate visualization from API parameters
export async function recreateVisualizationFromHistory(
  entry: HistoryEntry
): Promise<HistoryEntry | null> {
  try {
    // Prefer refetch by stable identifiers if available
    if (entry.cid) {
      // Call internal CID endpoint to get fresh data
      const r = await fetch('/api/pubchem/search/cid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: entry.cid }),
      });
      if (r.ok) {
        const data = await r.json();
        const visualization = {
          pdb_data: data.pdb_data || '',
          sdf: data.sdf_data || data.sdf || '',
          html: '',
          title: entry.name || data.name,
        } as any;
        return { ...entry, visualization };
      }
    }

    if (entry.pdbId) {
      // Fetch PDB text directly from RCSB
      const url = `https://files.rcsb.org/download/${entry.pdbId}.pdb`;
      const r = await fetch(url);
      if (r.ok) {
        const pdbText = await r.text();
        const visualization = {
          pdb_data: pdbText,
          html: '',
          title: entry.name || entry.title,
        } as any;
        return { ...entry, visualization };
      }
    }

    // Fallback: replay the original endpoint if present
    if (entry.apiParams) {
      const response = await fetch(entry.apiParams.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: entry.apiParams.query,
          model: entry.apiParams.model,
          interactive: entry.apiParams.interactive,
          pubchem: entry.apiParams.pubchem,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const visualization = await response.json();
      return { ...entry, visualization };
    }

    return null;
  } catch (error) {
    console.error('Error recreating visualization from history:', error);
    return null;
  }
}
