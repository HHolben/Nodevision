<!-- Nodevision/ApplicationSystem/docs/semantic-xml-viewer.md -->
<!-- This file documents the semantic XML viewer architecture, including handler registration, MathML rendering, UnitsML detection, reusable unit parsing, and the intended Notebook pattern for user-owned UnitsML files. -->

# Semantic XML Viewer

Nodevision treats `.xml` as a generic container format. `ModuleMap.csv` still routes ordinary `.xml` files to `ViewXML.mjs`; semantic detection happens only after the source text is fetched and parsed with the browser XML parser.

The viewer always offers these conceptual panes: Rendered, Structure, and Source. Rendered shows known vocabularies, Structure shows a safe generic tree, and Source shows the unchanged XML text with `textContent`.

## Handler Registry

Semantic handlers live under `ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/handlers/`. A handler exposes `id`, `matches(document)`, optional `parse(document)`, and `render(document, context)`. Register future vocabularies by adding the handler to `createDefaultSemanticXmlRegistry()`.

## MathML

MathML is detected from the W3C namespace `http://www.w3.org/1998/Math/MathML`. Rendering uses browser-native MathML elements created with `createElementNS`. The clone step only copies allowed MathML elements and safe presentation attributes, skipping scripts, annotations, event handlers, style, and external-resource attributes.

## UnitsML

UnitsML is detected from XML structure and the current official namespace `https://schema.unitsml.org/unitsml/1.0`, not from filenames. The parser also keeps a short list of historical UnitsML namespaces for backward compatibility, but fixtures and new Notebook examples should use the current namespace and schema location `https://schema.unitsml.org/unitsml/unitsml-v1.0.xsd`.

`UnitsMLParser.mjs` returns a reusable model with `units`, `dimensions`, `quantities`, and `prefixes`. Other Nodevision components can import `parseUnitsMLDocument()` directly instead of scraping rendered HTML.

## Notebook Pattern

A Notebook may keep one unit per file, such as `Notebook/Units/meter.xml` or `Notebook/Units/newton.xml`. The XML viewer does not hard-code that path; any `.xml` file containing UnitsML markup renders semantically wherever it lives in the Notebook.
