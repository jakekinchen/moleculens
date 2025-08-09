/**
 * Normalize chemical names to ASCII for consistent external service queries.
 * Handles soft-hyphens, fancy dashes, accents, and other Unicode artifacts.
 */
export function sanitizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u00AD\u2010-\u2015\u202F]/g, '-')
    .replace(/[^\u0020-\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


