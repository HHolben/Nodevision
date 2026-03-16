// Nodevision/ApplicationSystem/public/Graph/generateNodeIndex.mjs
// This file defines browser-side generate Node Index logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/Graph/generateNodeIndex.mjs
// Purpose: TODO: Add description of module purpose

export async function listDirectory(path) {
  const res = await fetch(`/api/list-directory?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch directory listing: ${res.statusText}`);
  }
  return res.json();
}
