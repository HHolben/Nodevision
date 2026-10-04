// Nodevision/ApplicationSystem/public/Equation/HtmlInlineEquation.mjs
// This module assembles the shared HtmlInlineEquation features and preserves the public application interface.

import { HtmlInlineEquationModuleState } from "./HtmlInlineEquationParts/EscapeHtml.mjs";
export { INLINE_EQUATION_SELECTOR } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { INLINE_EQUATION_ACTIVE_ATTR } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { DEFAULT_INLINE_EQUATION } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { INLINE_EQUATION_RENDERED_CLASS } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { INLINE_EQUATION_FALLBACK_CLASS } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { INLINE_EQUATION_BROWSER_SUPPORT_SELECTOR } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { normalizeInlineEquationFormat } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { stripInlineEquationDelimiters } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { formatInlineEquationDisplay } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { buildInlineEquationHtml } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { ensureInlineEquationMathJax } from './HtmlInlineEquationParts/EscapeHtml.mjs';
export { renderInlineEquationElement } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { renderInlineEquations } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { serializeInlineEquationsForSave } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { buildInlineEquationBrowserSupportHeadHtml } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { clearActiveInlineEquations } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { focusEquationEnd } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { readInlineEquationValue } from './HtmlInlineEquationParts/AppendInlineEquationFallback.mjs';
export { writeInlineEquationValue } from './HtmlInlineEquationParts/WriteInlineEquationValue.mjs';
export { insertInlineEquationAtCaret } from './HtmlInlineEquationParts/WriteInlineEquationValue.mjs';
export { findElementInSelection } from './HtmlInlineEquationParts/WriteInlineEquationValue.mjs';
export { findSelectedInlineEquationElement } from './HtmlInlineEquationParts/WriteInlineEquationValue.mjs';
export { findSingleInlineEquationElement } from './HtmlInlineEquationParts/WriteInlineEquationValue.mjs';

// Install the module-level integration hooks.
HtmlInlineEquationModuleState.mathJaxReady = null; // === Text Formatting ===
