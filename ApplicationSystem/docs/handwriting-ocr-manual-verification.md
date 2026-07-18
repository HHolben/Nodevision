# Handwriting OCR Manual Verification

Use synthetic or throwaway handwriting for this checklist. Do not copy private handwriting samples into the repository.

1. Open an editable Nodevision document.
2. Select `Insert Text -> Insert Handwriting`.
3. Write isolated uppercase letters.
4. Write isolated lowercase letters.
5. Write digits `0` through `9`.
6. Test likely confusions: `O` and `0`, `I`, `l`, and `1`, `S` and `5`, `Z` and `2`, `c` and `e`, `u` and `v`.
7. Correct several deliberately misrecognized characters with correction mode or by fixing the main editor text and pressing `Correction`.
8. Confirm new samples are saved under the current user's private `UserData/HandwritingOcr/users/<user-id>/` directory.
9. Confirm new saved entries include `schema: "nodevision-handwriting-correction-sample/2"` and a `trajectory` object with `schema: "nodevision-handwriting-sample/2"`.
10. Enable `Debug` and confirm trajectory scoring, raster scoring, context adjustment, confusion adjustment, selected engine, alternatives, and latency are visible in the diagnostics JSON.
11. Confirm repeated corrections change future ranking for the same signed-in user.
12. Sign in as another user and confirm the personalization and confusion counts do not carry over.
13. Disable or simulate failure of `navigator.createHandwritingRecognizer`.
14. Confirm the Nodevision custom recognizer still works.
15. Temporarily force the custom recognizer to return no candidates in a local test branch.
16. Confirm Tesseract remains a manual `Recognize Text` fallback.
17. Write one glyph and immediately begin another.
18. Confirm stale results do not overwrite newer input.
19. Close the handwriting panel during recognition.
20. Confirm no result is inserted afterward.
21. Place an older raster-only correction sample in `training.json` and confirm it still loads and participates in ranking.
22. Confirm HenryScript is loaded only from `UserData/HandwritingOcr/fonts/manifest.csv` or the UserData fallback copy, not from application-system directories.
