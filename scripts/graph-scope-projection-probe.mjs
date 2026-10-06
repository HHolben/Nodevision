// Nodevision/scripts/graph-scope-projection-probe.mjs
// This investigation-only function measures a loaded-directory identity projection using immutable plain records. It does not register a scope capability, install proxy edges, alter application graph state, or claim to implement safe aggregation.
export function projectLoadedDirectories(nodes, records, selected = []) {
  const start = performance.now(), byId = new Map(nodes.map(node => [node.id,node]));
  const representatives = new Map(), counts = new Map(), selectedCounts = new Map();
  for (const node of nodes) {
    let representative = node.id;
    if (node.type === 'file') {
      let parent = byId.get(node.parent);
      while (parent && parent.type !== 'directory') parent = byId.get(parent.parent);
      if (parent) representative = parent.id;
    }
    representatives.set(node.id,representative);
    counts.set(representative,(counts.get(representative)||0)+(node.type==='file'?1:0));
  }
  for (const id of selected) {
    const representative = representatives.get(id);
    if (representative && representative !== id) selectedCounts.set(representative,(selectedCounts.get(representative)||0)+1);
  }
  const nodeMs = performance.now()-start, edgeStart = performance.now(), edges = new Map(), internalCounts = new Map();
  for (const record of records) {
    const source = representatives.get(record.sourcePath), target = representatives.get(record.targetPath);
    if (!source || !target) continue;
    if (source === target) { internalCounts.set(source,(internalCounts.get(source)||0)+1); continue; }
    const key = JSON.stringify([source,target]);
    if (!edges.has(key)) edges.set(key,{ source,target,recordIds:[] });
    edges.get(key).recordIds.push(record.id);
  }
  return { representatives, counts, selectedCounts, edges, internalCounts, nodeMs, edgeMs:performance.now()-edgeStart };
}
