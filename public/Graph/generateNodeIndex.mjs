// public/Graph/generateNodeIndex.mjs
// Purpose: TODO: Add description of module purpose

export async function listDirectory(path) {
  const res = await fetch(`/api/list-directory?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch directory listing: ${res.statusText}`);
  }
  return res.json();
}
