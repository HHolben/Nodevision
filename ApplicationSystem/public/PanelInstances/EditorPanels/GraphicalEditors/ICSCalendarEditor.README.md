# ICSCalendarEditor Manual Test Notes

Run these checks inside Nodevision Graphical Editing on an `.ics` file mapped through `TextFamilyEditor.mjs`.

1. Simple one-time event
- Open an `.ics` with one VEVENT using DTSTART/DTEND.
- Verify it appears at the correct week/day/time block.
- Click event and confirm properties panel values match file fields.

2. Weekly recurring event
- Add RRULE:FREQ=WEEKLY to an event.
- Verify current-week occurrence renders.
- Move event to another day/time and confirm DTSTART/DTEND + RRULE day update after save/reload.

3. X-NODEVISION visual fields
- Set `X-NODEVISION-COLOR`, `X-NODEVISION-ICON`, and `X-NODEVISION-SYMBOL`.
- Verify color/icon/symbol render on event card.
- Save + reload and confirm fields persist.

4. Add Event flow
- Use Insert -> Add Event (or local fallback Add Event button if sub-toolbar is unavailable).
- Verify new block appears, default summary is `New Event`, and properties panel opens.

5. Drag and resize
- Drag event horizontally (day changes) and vertically (time changes).
- Resize top and bottom handles.
- Verify 15-minute snapping and minimum 15-minute duration.
- Verify dirty state appears and Save writes updated times.

6. Overlap behavior
- Create overlapping events in same day.
- Verify side-by-side layout and selected card visual prominence.

7. Time zone controls
- Switch display time zone among Local, America/*, and UTC.
- Verify event positions and current-time line update without mutating stored timestamps until edits.

8. Save and reload validity
- Save through Nodevision normal save.
- Confirm CRLF output, parsable calendar, and preserved unknown properties where possible.
