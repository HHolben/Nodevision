# Tesseract language data (offline)

This folder is intentionally empty in the repo.

For the **Handwriting → Text** panel to run fully offline, place language data files here, for example:

- `eng.traineddata.gz` (English)

The panel config uses:

- `langPath: "/Tesseract/lang-data"`

After adding the file(s), restart Nodevision and retry recognition.

