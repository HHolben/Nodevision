// Nodevision/ApplicationSystem/public/utils/midiStaffPreview.mjs
// Helpers for building a simple staff preview from MIDI note ranges.

const QUARTERS_BY_DURATION = [
  ["w", 4],
  ["h", 2],
  ["q", 1],
  ["8", 0.5],
  ["16", 0.25],
  ["32", 0.125],
];

export function quantizeDurationTicks(durationTicks, division) {
  const div = Number(division) || 480;
  const ticks = Math.max(1, Math.floor(Number(durationTicks) || 1));
  const quarters = ticks / div;

  let best = "8";
  let bestDist = Infinity;
  for (const [dur, q] of QUARTERS_BY_DURATION) {
    const dist = Math.abs(quarters - q);
    if (dist < bestDist) {
      bestDist = dist;
      best = dur;
    }
  }
  return best;
}

export function splitTicksIntoDurations(totalTicks, division) {
  const div = Number(division) || 480;
  let remaining = Math.max(0, Math.floor(Number(totalTicks) || 0));
  const out = [];

  const durationsByTicks = QUARTERS_BY_DURATION.map(([dur, q]) => [dur, Math.max(1, Math.floor(q * div))]);
  for (const [dur, ticks] of durationsByTicks) {
    while (remaining >= ticks) {
      out.push({ duration: dur, ticks });
      remaining -= ticks;
    }
  }

  if (remaining > 0) {
    const dur = quantizeDurationTicks(remaining, div);
    const ticks = durationsByTicks.find(([d]) => d === dur)?.[1] ?? remaining;
    out.push({ duration: dur, ticks: Math.max(1, ticks) });
  }

  return out;
}

function groupNotesByStartTick(notes = []) {
  const byTick = new Map();
  for (const n of notes) {
    const tick = Number(n?.startTick);
    const midi = Number(n?.midi);
    if (!Number.isFinite(tick) || !Number.isFinite(midi)) continue;
    const list = byTick.get(tick) || [];
    list.push(n);
    byTick.set(tick, list);
  }
  return Array.from(byTick.entries()).sort((a, b) => a[0] - b[0]);
}

export function buildStaffEventsFromNoteRanges(noteRanges, { track = "all", maxEvents = 4000 } = {}) {
  const division = Number(noteRanges?.division) || 480;
  const allNotes = Array.isArray(noteRanges?.notes) ? noteRanges.notes : [];
  const notes =
    track === "all"
      ? allNotes
      : allNotes.filter((n) => String(n.track) === String(track));

  const grouped = groupNotesByStartTick(notes);
  if (!grouped.length) return [];

  const events = [];
  let lastTick = 0;

  for (let i = 0; i < grouped.length && events.length < maxEvents; i += 1) {
    const [tick, list] = grouped[i];
    const nextTick = grouped[i + 1]?.[0] ?? null;

    // Insert rests for gaps.
    const gap = tick - lastTick;
    if (gap > 0) {
      const rests = splitTicksIntoDurations(gap, division);
      for (const r of rests) {
        events.push({ type: "rest", duration: r.duration });
        if (events.length >= maxEvents) break;
      }
    }

    if (events.length >= maxEvents) break;

    // Determine chord pitch set.
    const midis = list.map((n) => Number(n.midi)).filter((m) => Number.isFinite(m));
    const uniq = Array.from(new Set(midis)).sort((a, b) => a - b);

    // Choose an event duration:
    // - take max duration among notes starting at this tick
    // - but clamp to next event start to avoid overlaps in a monophonic preview
    let durTicks = 1;
    for (const n of list) {
      const d = Math.max(1, Math.floor(Number(n?.durationTicks) || 1));
      durTicks = Math.max(durTicks, d);
    }
    if (Number.isFinite(nextTick)) {
      durTicks = Math.min(durTicks, Math.max(1, nextTick - tick));
    }

    const duration = quantizeDurationTicks(durTicks, division);
    events.push({ type: "chord", duration, midis: uniq });
    lastTick = tick + durTicks;
  }

  return events;
}

function groupNotesByStartAndDuration(notes = []) {
  const map = new Map(); // key -> { startTick, durationTicks, midis[] }
  for (const n of notes) {
    const startTick = Number(n?.startTick);
    const durationTicks = Math.max(1, Math.floor(Number(n?.durationTicks) || 1));
    const midi = Number(n?.midi);
    if (!Number.isFinite(startTick) || !Number.isFinite(midi)) continue;
    const key = `${startTick}:${durationTicks}`;
    const hit = map.get(key) || { startTick, durationTicks, midis: [] };
    hit.midis.push(midi);
    map.set(key, hit);
  }
  const out = Array.from(map.values()).map((g) => ({
    ...g,
    midis: Array.from(new Set(g.midis)).sort((a, b) => a - b),
    endTick: g.startTick + g.durationTicks,
  }));
  out.sort((a, b) => (a.startTick - b.startTick) || (a.durationTicks - b.durationTicks) || (a.midis[0] - b.midis[0]));
  return out;
}

export function buildPolyphonicStaffPlan(
  noteRanges,
  {
    track = "all",
    maxVoices = 4,
    maxItemsPerVoice = 4000,
  } = {},
) {
  const division = Number(noteRanges?.division) || 480;
  const allNotes = Array.isArray(noteRanges?.notes) ? noteRanges.notes : [];
  const notes =
    track === "all"
      ? allNotes
      : allNotes.filter((n) => String(n.track) === String(track));

  const groups = groupNotesByStartAndDuration(notes);
  if (!groups.length) return { division, voices: [], totalTicks: 0 };

  const voices = [];
  const voiceEndTicks = [];

  for (const g of groups) {
    let idx = voiceEndTicks.findIndex((end) => end <= g.startTick);
    if (idx === -1) {
      if (voices.length < maxVoices) {
        idx = voices.length;
        voices.push({ groups: [] });
        voiceEndTicks.push(0);
      } else {
        let best = 0;
        for (let i = 1; i < voiceEndTicks.length; i += 1) {
          if (voiceEndTicks[i] < voiceEndTicks[best]) best = i;
        }
        idx = best;
      }
    }

    voices[idx].groups.push(g);
    voiceEndTicks[idx] = Math.max(voiceEndTicks[idx] || 0, g.endTick);
  }

  const planned = voices.map((v) => {
    const items = [];
    const ties = [];
    let cursorTick = 0;

    v.groups.sort((a, b) => a.startTick - b.startTick);
    for (const g of v.groups) {
      if (items.length >= maxItemsPerVoice) break;
      const gap = g.startTick - cursorTick;
      if (gap > 0) {
        const rests = splitTicksIntoDurations(gap, division);
        for (const r of rests) {
          items.push({ type: "rest", duration: r.duration, ticks: r.ticks });
          if (items.length >= maxItemsPerVoice) break;
        }
      }
      if (items.length >= maxItemsPerVoice) break;

      const segments = splitTicksIntoDurations(g.durationTicks, division);
      let prevNoteItemIndex = null;
      for (const seg of segments) {
        const noteItemIndex = items.length;
        items.push({ type: "note", duration: seg.duration, ticks: seg.ticks, midis: g.midis.slice() });
        if (prevNoteItemIndex !== null) {
          ties.push({
            from: prevNoteItemIndex,
            to: noteItemIndex,
            keyCount: g.midis.length,
          });
        }
        prevNoteItemIndex = noteItemIndex;
        if (items.length >= maxItemsPerVoice) break;
      }

      cursorTick = Math.max(cursorTick, g.endTick);
    }

    return { items, ties };
  });

  const totalTicks = Math.max(...voiceEndTicks);
  return { division, voices: planned, totalTicks };
}
