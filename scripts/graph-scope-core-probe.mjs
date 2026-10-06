// Nodevision/scripts/graph-scope-core-probe.mjs
// The investigation server appends this test-only seam to GraphManagerCore in memory. It exposes existing abstraction operations and cancels queued layout only when explicitly requested, without modifying application sources or replacing the probed function bodies.
export const scopeInvestigation = {
  attach(graph, records = []) {
    cy = graph;
    resetGraphAbstractionFilterState({ restoreParents: false });
    discoveredLinks.clear(); linkRecordsBySourceTarget.clear(); brokenLinksBySource.clear(); brokenLinkRecordsBySourceTarget.clear();
    for (const record of records) rememberLink(record.sourcePath, record.targetPath, record);
  },
  directoryIds: directoryScopeVisibleNodeIds,
  fileIds: fileScopeVisibleNodeIds,
  sourceRepresentative(path) { return getVisibleNodeId(cy, path); },
  targetRepresentative: resolveVisibleTargetNode,
  rebuild: rebuildVisibleEdges,
  apply(filter, options = { fit: false }) { graphAbstractionFilter = filter; return applyGraphAbstractionFilter(options); },
  clear: clearGraphAbstractionFilter,
  selectNode: selectSingleGraphNodeFile,
  actionPath: selectedPathForGraphRootAction,
  cancelQueuedLayout() {
    if (layoutDebounceTimer) window.clearTimeout(layoutDebounceTimer);
    layoutDebounceTimer = null; layoutPendingFit = false; layoutPendingReasons.clear();
  },
  detach() {
    this.cancelQueuedLayout(); resetGraphAbstractionFilterState();
    cy = null; discoveredLinks.clear(); linkRecordsBySourceTarget.clear(); brokenLinksBySource.clear(); brokenLinkRecordsBySourceTarget.clear();
  }
};
