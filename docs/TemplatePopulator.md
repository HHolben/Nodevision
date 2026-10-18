# Template Populator — Phase 1

Open **Template Populator** from Sessions. A personal copy is installed in `UserData/Sessions/TemplatePopulator.NodevisionSession.js` in this workspace; a bundled wrapper is also provided for other installations. Both invoke the registered, Session-safe `templatePopulator.open` command and finish through `session.templatePopulator.finished`.

Select an ODP from Notebook or a local file. Put each image placeholder in its own unrotated slide text box, for example `{{Microchip_1}}`. Names are case-sensitive and contain letters, digits, or underscores. Formatting spans may split a name. The interface lists unique names with every slide occurrence. Repeated names share one image assignment and one embedded package resource.

Assign a PNG or JPEG from Notebook or a local file, and fill the discovered named text boxes. Thumbnails, filenames, missing assignments, and errors appear next to the controls. Replace or clear any assignment. Assignments and destination fields survive closing and reopening the Session in the same browser page; refreshing the page clears them. Selecting a different valid template starts a fresh assignment set. Failed selections and failed saves preserve existing assignments.

Choose an output filename and Notebook folder, then generate. Generation is disabled until all image placeholders have readable images and text placeholders have nonblank values and there are no unsupported placeholder contexts. Saving creates a new file exclusively: collisions, including the original template path, are rejected. The File Manager is refreshed after saving. Existing files are never overwritten.

## Architecture

The existing `public/TemplateSystem/Population/TemplatePopulation.mjs` service exports `discoverPlaceholders`, `validateAssignments`, `populateTemplate`, and `savePopulatedDocument`, with registered format adapters. The Session depends on generic placeholder names, occurrences, assignments, and result objects; it does not manipulate ODP XML. The first adapter is `adapters/OdpAdapter.mjs`, with namespace-aware XML helpers in `OdpXml.mjs`.

Notebook asset selection uses existing `/api/files` and `/api/file-binary` endpoints. The authenticated `/api/templates/populate-save` route uses the existing template registry's Notebook containment and symlink checks with exclusive filesystem creation. No secondary report storage or document identity system is introduced: templates, source images, and generated documents remain ordinary files. Image references inside the generated package point to embedded resources.

The adapter reads detached XML and copies unrelated package resources byte-for-byte. It replaces only supported placeholder text boxes, adds image resources and manifest entries, and creates a graphic style without clipping, mirroring, fill, or outline. Contain fitting centers the complete image within the original rectangle while preserving its aspect ratio. The explicit `fit: 'contain'` property reserves an extension point for other fit modes. Unsupported fit modes are rejected.

Packaging follows the [ODF 1.3 package specification](https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part2-packages.html): `mimetype` is first and uncompressed. Namespace-aware frame, image, geometry, and manifest handling follows the [ODF document schema](https://docs.oasis-open.org/office/OpenDocument/v1.3/cs02/part3-schema/OpenDocument-v1.3-cs02-part3-schema.html). Content and manifest XML are reserialized; ZIP compression metadata and XML formatting need not remain identical. Unrelated styles, master pages, backgrounds, settings, text, and embedded resources are retained. Templates are never inserted into the live page or opened in an executable document viewer; scripts, macros, and external links are not executed or fetched during processing. Existing active content is preserved in the output, not sanitized.

## Limits

- ODP only; no batch processing, image analysis, automatic name matching, OCR, or conversion.
- Image placeholders require standalone slide text frames with absolute rectangular geometry. Inline placeholders, table cells, notes, master slides, lists, rotated/transformed frames or groups, and frames containing additional objects report errors and block generation.
- Encrypted and signed presentations are rejected. XML document types and entity declarations are rejected.
- Templates are limited to 50 MB compressed, 200 MB expanded, 5,000 ZIP entries, and 10 MB per parsed XML file. Images are limited to 20 MB and 50 megapixels.
- Images are embedded as their original PNG/JPEG bytes; browser decoding supplies dimensions. EXIF orientation and color rendering can differ between browser and office applications.
- State survives Session reopen only within the same browser page. It is not persisted across reloads or shared with other tabs.
- Closing during computation cancels subsequent saving. A save already accepted by the server may complete even if the Session is then closed; inspect the destination before retrying.
- Nodevision currently displays ODP as an archive. Inspect slide rendering in LibreOffice Impress. LibreOffice is available for the named-text extension tests; ODP/PPTX opening and conversion passed. Pixel-perfect visual comparison is not performed.

## Tests

Run:

```sh
node --test ApplicationSystem/Templates/TemplatePopulation.test.mjs ApplicationSystem/Sessions/SessionRegistry.test.mjs ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs
python3 scripts/test-template-populator-browser.py
node scripts/test-template-populator-api.mjs
```

The browser runner uses Chromium and the production modules, including real Session DOM file controls. It starts from an actual LibreOffice-generated ODP, adds controlled placeholder frames using DOM operations, and checks single/multiple/repeated/split-run placeholders, PNG/JPEG embedding, missing and corrupt assignments, aspect ratios, unsupported contexts, resource preservation, package headers, corrupt templates, Session reopen, failed replacements, save collisions, Notebook selection, and File Manager refresh. The server test covers exclusive creation, collision preservation, bad extensions, empty content, traversal, and symlink escape rejection.

When `libreoffice` or `soffice` is installed, the runner also opens the generated presentation headlessly and renders it to PDF using an isolated temporary profile. Otherwise it prints an explicit skip. PDF conversion is a readability smoke test, not a pixel-perfect visual comparison.

The source fixture and provenance are recorded in `scripts/fixtures/template-populator/README.md`.

## Named text boxes

Name a slide text box in Impress (object `draw:name`), for example `ComponentName1`, `BoardID`, or `ReportDate`. Object names use letters, numbers, and underscores and are case-sensitive. Every named slide text box is treated as a text placeholder, regardless of its visible text. Leave unrelated text boxes unnamed. A visible `{{Name}}` image marker takes precedence over the frame's object name, preserving existing image templates.

Text fields show existing text and slide occurrences and accept typing, pasting, and multiline values. Repeated names share one value. Equal defaults prefill the field; differing defaults are displayed for review and leave the field empty until a value is supplied. Blank text and cross-type name collisions block generation. Duplicate names are intentionally shared; differing defaults are the signal to review whether a duplicate was intended. Rename objects in the source document to resolve type conflicts or invalid names. Image and text controls share the same list and state; optional component grouping is not implemented.

Text replacement leaves frame attributes, dimensions, rotation, style references, borders, and backgrounds unchanged. For changed text, all old paragraphs/runs are replaced using the first paragraph's attributes and the first span chain's character formatting. Every input newline creates a paragraph with that formatting; spaces and tabs use ODF text elements. Rich-run variations beyond the first span are intentionally not retained. Unchanged default values preserve the original rich text exactly. No automatic font resizing is performed: long text can overflow its original frame. Named lists, fields, links, notes, master-slide boxes, and non-text-box shapes are reported as unsupported. Unlike image placeholders, rotated text placeholders are supported because their geometry is not recomputed.

The generated ODP remains editable. To convert it using the available LibreOffice workflow, open it in Impress and use **Save As → PowerPoint 2007–365 (.pptx)**, or run:

```sh
libreoffice --headless --convert-to 'pptx:Impress MS PowerPoint 2007 XML' --outdir /path/to/output /path/to/populated.odp
```

The regression runner now verifies mixed named-text/image slides, U1 and L74 values, repeated names across slides, whitespace/XML character handling, missing text, conflicting types, unchanged frame attributes and styles, default text, and Session retention. When LibreOffice is available, it renders the ODP to PDF, converts to PPTX, verifies editable text, slide count, image objects and layout transforms, and renders the PPTX back to PDF. This checks interoperability but does not guarantee identical typography or pixel-perfect layout across office applications.
