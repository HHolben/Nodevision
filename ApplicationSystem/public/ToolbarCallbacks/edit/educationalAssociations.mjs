// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/educationalAssociations.mjs
// This callback opens the native educational associations panel for the active HTML document. It delegates panel placement and workspace integration to the existing toolbar action system.
export default function(){const documentPath=window.__nvActiveHtmlEditorContext?.filePath;window.dispatchEvent(new CustomEvent('toolbarAction',{detail:{id:'EducationalLinksPanel',type:'InfoPanel',replaceActive:false,panelVars:{displayName:'Educational Associations',documentPath}}}));}
