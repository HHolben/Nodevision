# Tesseract language data (offline)

This folder contains local language data used by the Handwriting -> Text panel.

For the panel to run fully offline, keep language data files here, for example:

- `eng.traineddata.gz` (English)

The panel config uses:

- `langPath: "/Tesseract/lang-data"`

After adding the file(s), restart Nodevision and retry recognition.

