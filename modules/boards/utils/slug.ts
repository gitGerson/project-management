/**
 * Utilities for URL slug generation and parsing for Boards
 */

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric except whitespace and hyphens
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores into a single hyphen
    .replace(/^-+|-+$/g, ''); // trim leading and trailing hyphens
}

export function generateBoardSlug(id: number, name: string): string {
  const clean = slugify(name);
  return clean ? `${id}-${clean}` : String(id);
}

export function parseBoardSlug(slug: string): { id?: number; slugText: string } {
  const decoded = decodeURIComponent(slug).trim().toLowerCase();

  // Check if starts with ID or is pure numeric ID (e.g. "1-tong-tji" or "1")
  const idMatch = decoded.match(/^(\d+)(?:-.*)?$/);
  if (idMatch) {
    return {
      id: parseInt(idMatch[1], 10),
      slugText: decoded,
    };
  }

  return {
    slugText: decoded,
  };
}
