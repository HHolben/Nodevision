# Public

The `public` folder contains client-side code, assets, and styles that run in the browser.

## Contents
- **CSS files** (`LayoutStyles.css`, etc.): Define the grid layout, panel spacing, and UI look-and-feel.
- **JavaScript files** (`fileView.js`, `panelFactory.mjs`, etc.): Handle dynamic loading of panels, file views, and other front-end interactions.
- **Icons & images** (`icons/`): Default node images and toolbar icons.
- **HTML templates** (if any): Predefined layouts for panels and toolbars.

## Notes
- All files in `public/` are served directly to the client.
- Avoid putting sensitive or server-only code here.
- Styles should remain modular (per panel or per feature).
