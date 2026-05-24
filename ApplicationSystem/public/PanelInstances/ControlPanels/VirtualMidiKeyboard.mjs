// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/VirtualMidiKeyboard.mjs
// This file renders a virtual MIDI keyboard control panel for sheet music entry.

const WHITE_PATTERN = new Set([0, 2, 4, 5, 7, 9, 11]);
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYBOARD_KEYS = new Map([
  ["a", 60], ["w", 61], ["s", 62], ["e", 63], ["d", 64], ["f", 65],
  ["t", 66], ["g", 67], ["y", 68], ["h", 69], ["u", 70], ["j", 71], ["k", 72],
]);
const MAX_WHITE_KEY_WIDTH_CM = 2.35;
const CSS_PX_PER_CM = 96 / 2.54;
const MIN_KEY_HEIGHT_PX = 120;
const KEYBOARD_VERTICAL_PADDING_PX = 16;

let audioContext = null;
let masterGain = null;

export async function setupPanel(panel, instanceVars = {}) {
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    overflow: "hidden",
    padding: "8px",
    gap: "8px",
  });

  const state = {
    baseMidi: Number(instanceVars.baseMidi) || 60,
    duration: "q",
    insertOnPress: true,
  };

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
  const title = document.createElement("strong");
  title.textContent = "MIDI Keyboard";
  header.appendChild(title);

  const octaveDown = button("Oct -");
  const octaveUp = button("Oct +");
  const duration = document.createElement("select");
  duration.innerHTML = "<option value='w'>Whole</option><option value='h'>Half</option><option value='q' selected>Quarter</option><option value='8'>Eighth</option>";
  duration.addEventListener("change", () => { state.duration = duration.value; });

  const insertLabel = document.createElement("label");
  insertLabel.style.cssText = "display:flex;align-items:center;gap:4px;font:12px sans-serif;";
  const insertToggle = document.createElement("input");
  insertToggle.type = "checkbox";
  insertToggle.checked = true;
  insertToggle.addEventListener("change", () => { state.insertOnPress = insertToggle.checked; });
  insertLabel.append(insertToggle, document.createTextNode("Insert"));

  header.append(octaveDown, octaveUp, duration, insertLabel);
  panel.appendChild(header);

  const status = document.createElement("div");
  status.style.cssText = "min-height:18px;font:12px monospace;color:#555;";
  panel.appendChild(status);

  const keyboard = document.createElement("div");
  keyboard.style.cssText = "position:relative;flex:1;min-height:118px;overflow:auto;border:1px solid #b8b8b8;background:#d9d9d9;padding:8px;";
  panel.appendChild(keyboard);
  let resizeFrame = null;

  function render() {
    keyboard.innerHTML = "";
    const whiteKeys = [];
    for (let midi = state.baseMidi; midi < state.baseMidi + 25; midi += 1) {
      if (WHITE_PATTERN.has(midi % 12)) whiteKeys.push(midi);
    }

    const whiteWidth = calculateWhiteKeyWidth(keyboard, whiteKeys.length);
    const keyHeight = calculateKeyHeight(keyboard);
    const blackHeight = Math.max(72, Math.floor(keyHeight * 0.62));
    const blackWidth = Math.max(14, whiteWidth * 0.62);
    const whiteRow = document.createElement("div");
    whiteRow.style.cssText = `display:flex;height:${keyHeight}px;position:relative;width:${whiteWidth * whiteKeys.length}px;`;
    keyboard.appendChild(whiteRow);

    whiteKeys.forEach((midi) => {
      const key = button(noteName(midi));
      key.dataset.midi = String(midi);
      key.style.cssText = `width:${whiteWidth}px;height:${keyHeight}px;border:1px solid #777;box-sizing:border-box;background:#fff;color:#111;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;font:12px sans-serif;flex:0 0 ${whiteWidth}px;`;
      key.addEventListener("pointerdown", () => pressMidi(midi));
      whiteRow.appendChild(key);
    });

    for (let midi = state.baseMidi; midi < state.baseMidi + 25; midi += 1) {
      if (WHITE_PATTERN.has(midi % 12)) continue;
      const previousWhite = whiteKeys.filter((keyMidi) => keyMidi < midi).length;
      if (!previousWhite) continue;
      const black = button(noteName(midi));
      black.dataset.midi = String(midi);
      black.style.cssText = `position:absolute;left:${previousWhite * whiteWidth - blackWidth / 2}px;top:8px;width:${blackWidth}px;height:${blackHeight}px;border:1px solid #111;box-sizing:border-box;background:#111;color:#fff;z-index:2;font:10px sans-serif;padding-top:${Math.max(32, blackHeight - 28)}px;`;
      black.addEventListener("pointerdown", () => pressMidi(midi));
      keyboard.appendChild(black);
    }
  }

  function pressMidi(midi) {
    playMidi(midi);
    const tools = window.NodevisionMIDITools;
    if (state.insertOnPress && typeof tools?.insertMidiNote === "function") {
      tools.insertMidiNote(midi, state.duration);
      status.textContent = `Inserted ${noteName(midi)} (${midi}).`;
    } else {
      status.textContent = `Played ${noteName(midi)} (${midi}).`;
    }
  }

  octaveDown.addEventListener("click", () => {
    state.baseMidi = Math.max(24, state.baseMidi - 12);
    render();
  });
  octaveUp.addEventListener("click", () => {
    state.baseMidi = Math.min(84, state.baseMidi + 12);
    render();
  });

  const keydown = (event) => {
    if (event.repeat || event.target?.matches?.("input, select, textarea")) return;
    const offset = KEYBOARD_KEYS.get(String(event.key || "").toLowerCase());
    if (!Number.isFinite(offset)) return;
    event.preventDefault();
    pressMidi(state.baseMidi + (offset - 60));
  };
  document.addEventListener("keydown", keydown);
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        render();
      });
    })
    : null;
  resizeObserver?.observe(keyboard);

  panel.cleanup = () => {
    document.removeEventListener("keydown", keydown);
    resizeObserver?.disconnect?.();
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  };

  render();
}

function calculateWhiteKeyWidth(keyboard, whiteKeyCount) {
  const styles = window.getComputedStyle?.(keyboard);
  const padding = (Number.parseFloat(styles?.paddingLeft) || 0) + (Number.parseFloat(styles?.paddingRight) || 0);
  const available = Math.max(0, (keyboard.clientWidth || 0) - padding);
  const maxWidth = MAX_WHITE_KEY_WIDTH_CM * CSS_PX_PER_CM;
  if (!whiteKeyCount || available <= 0) return maxWidth;
  return Math.min(maxWidth, available / whiteKeyCount);
}

function calculateKeyHeight(keyboard) {
  const styles = window.getComputedStyle?.(keyboard);
  const padding = (Number.parseFloat(styles?.paddingTop) || 0) + (Number.parseFloat(styles?.paddingBottom) || 0);
  const available = Math.max(0, (keyboard.clientHeight || 0) - padding);
  return Math.max(MIN_KEY_HEIGHT_PX, available || MIN_KEY_HEIGHT_PX) - KEYBOARD_VERTICAL_PADDING_PX;
}

function button(label) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  return el;
}

function noteName(midi) {
  const note = Math.max(0, Math.min(127, Math.round(Number(midi) || 60)));
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

function midiFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureAudio() {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio is not available.");
  audioContext = new Ctx();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.18;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

function playMidi(midi) {
  try {
    const ctx = ensureAudio();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = midiFrequency(midi);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.48);
  } catch (err) {
    console.warn("Virtual MIDI keyboard playback failed:", err);
  }
}
