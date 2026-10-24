# Insert multiple media items

In Insert → Media, choose a media type and select multiple compatible files in the file chooser with Ctrl/Cmd or Shift. Review the selection list, uncheck any unwanted items, and press Insert. The current insertion settings apply to the selected items, in order.

For sources already in the Notebook or online, expand **Select multiple Notebook paths or URLs**, enter one source per line, and press **Select sources**. The model Notebook browser also supports selecting several assets before pressing **Use selected**.

HTML inserts each item at the insertion point. SVG images stay in the original layer and are offset so they can be selected individually. World images and sounds are spaced apart; models that require interactive placement wait for you to place each model before starting the next.

**Stop after current item** stops the queue. During model placement it cancels that placement. Failed or cancelled items remain selected for retry; completed items are removed from the queue. Each editor retains its existing format support and insertion history behavior.

Validation: `python3 scripts/test-media-batch-browser.py` exercises real HTML, SVG, and world insertion, model placement cancellation/retry, and duplicate-submit prevention in Chromium.
