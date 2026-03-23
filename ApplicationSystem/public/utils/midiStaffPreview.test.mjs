import { buildPolyphonicStaffPlan, buildStaffEventsFromNoteRanges, quantizeDurationTicks } from "./midiStaffPreview.mjs";

function assertEquals(actual, expected, message = "Values differ") {
  if (actual !== expected) {
    throw new Error(`${message}\nactual:   ${actual}\nexpected: ${expected}`);
  }
}

Deno.test("quantizeDurationTicks maps common values", () => {
  const division = 480;
  assertEquals(quantizeDurationTicks(480, division), "q");
  assertEquals(quantizeDurationTicks(240, division), "8");
  assertEquals(quantizeDurationTicks(960, division), "h");
});

Deno.test("buildStaffEventsFromNoteRanges inserts rests and quantizes note durations", () => {
  const noteRanges = {
    division: 480,
    notes: [
      { track: 0, channel: 0, midi: 60, startTick: 0, durationTicks: 480 }, // quarter
      { track: 0, channel: 0, midi: 62, startTick: 960, durationTicks: 240 }, // eighth at tick 2q
    ],
  };

  const events = buildStaffEventsFromNoteRanges(noteRanges, { track: 0 });
  // chord(q), rest(q), chord(8)
  assertEquals(events[0].type, "chord");
  assertEquals(events[0].duration, "q");
  assertEquals(events[1].type, "rest");
  assertEquals(events[1].duration, "q");
  assertEquals(events[2].type, "chord");
  assertEquals(events[2].duration, "8");
});

Deno.test("buildPolyphonicStaffPlan splits overlaps into multiple voices and adds ties", () => {
  const noteRanges = {
    division: 480,
    notes: [
      // Long note held for a half note.
      { track: 0, channel: 0, midi: 60, startTick: 0, durationTicks: 960 },
      // Overlapping moving note starting at quarter.
      { track: 0, channel: 0, midi: 64, startTick: 480, durationTicks: 240 },
      // A 3/8 note to force tie splitting (8 + 16).
      { track: 0, channel: 0, midi: 67, startTick: 1200, durationTicks: 360 },
    ],
  };

  const plan = buildPolyphonicStaffPlan(noteRanges, { track: 0, maxVoices: 4 });
  if (plan.voices.length < 2) {
    throw new Error(`Expected at least 2 voices, got ${plan.voices.length}`);
  }

  const tiedVoice = plan.voices.find((v) => (v.ties || []).length > 0);
  if (!tiedVoice) {
    throw new Error("Expected at least one tie in plan");
  }
});
