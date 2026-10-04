// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileView.mjs
// This module assembles the shared FileView features and preserves the public application interface.

import { FileViewModuleState } from "./FileViewParts/CancelScheduledSelectedFileViewRender.mjs";
import { readLiveFileViewerEnabled, isLiveFileViewerEnabled, setLiveFileViewerEnabled } from "./FileViewParts/RetainFileViewSelectionFollower.mjs";
import { updateViewPanel } from "./FileViewParts/UpdateViewPanel.mjs";
import { renderFile } from "./FileViewParts/RenderFile.mjs";
import { activateFileViewHost } from "./FileViewParts/ActivateFileViewPanel.mjs";
export { isLiveFileViewerEnabled } from './FileViewParts/RetainFileViewSelectionFollower.mjs';
export { setLiveFileViewerEnabled } from './FileViewParts/RetainFileViewSelectionFollower.mjs';
export { showGraphLinkInFileView } from './FileViewParts/ShowGraphLinkInFileView.mjs';
export { activeFileViewCanRefreshPath } from './FileViewParts/GetViewPanelElement.mjs';
export { setupPanel } from './FileViewParts/SetupPanel.mjs';
export { updateViewPanel } from './FileViewParts/UpdateViewPanel.mjs';

// Install the module-level integration hooks.
FileViewModuleState.lastRenderedPath = null;
FileViewModuleState.viewDivRef = null;
FileViewModuleState.liveFileViewerEnabled = readLiveFileViewerEnabled();
FileViewModuleState.liveFileViewRefreshTimer = null;
FileViewModuleState.pendingFileViewAnchor = null;
FileViewModuleState.pendingFileViewAnchorTimer = null;
FileViewModuleState.selectedFileViewRenderTimer = null;
FileViewModuleState.selectedFileViewRenderToken = 0;
FileViewModuleState.fileViewSelectionFollowerRefs = 0;
FileViewModuleState.fileViewSelectionFollowerInstalled = false;
FileViewModuleState.selectionFollowingFileViewRootRef = null;
FileViewModuleState.currentLinkViewSelection = null;
// Expose globally
window.updateViewPanel = updateViewPanel;
window.renderFile = renderFile;
window.isLiveFileViewerEnabled = isLiveFileViewerEnabled;
window.setLiveFileViewerEnabled = setLiveFileViewerEnabled;
window.__nvActivateFileViewHost = activateFileViewHost;
