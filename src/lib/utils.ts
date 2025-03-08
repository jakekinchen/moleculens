import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HistoryEntry, VisualizationOutput } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Storage keys
const STORAGE_KEYS = {
  HISTORY: 'sciviz_history',
};

// Save visualization history to session storage
export function saveHistoryToSession(history: HistoryEntry[]): void {
  try {
    const serializedHistory = JSON.stringify(history, (key, value) => {
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
