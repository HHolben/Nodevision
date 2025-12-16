// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditor.mjs
// Purpose: Provide a graphical interface for editing MIDI files, 
// using VexFlow for score visualization.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { VexFlow as VF } from '/lib/vexflow/build/esm/entry/vexflow.js';
// We would ideally import a more sophisticated MIDI parser/editor module here

// --- Internal State and Storage ---
let currentMidiBuffer = null;
let currentFilePath = null;
let currentNotesData = []; // VexFlow-compatible notes array

// --------------------------------------------------
// Fallback Hotkeys (self-contained)
// --------------------------------------------------
// Note: MIDI editing hotkeys would be highly domain-specific (e.g., Q for quantize, M for measure insert)
function registerMIDIFallbackHotkeys(filePath) {
  const handlers = {
    "Control+s": (e) => {
      e.preventDefault();
      if (window.saveMIDIFile) {
        window.saveMIDIFile(filePath);
      }
      console.log("🔧 Fallback hotkey: Save MIDI");
    },
    // Add other relevant MIDI editor hotkeys later
  };

  document.addEventListener("keydown", (e) => {
    const key =
      (e.ctrlKey ? "Control+" : "") +
      (e.shiftKey ? "Shift+" : "") +
      e.key;

    if (handlers[key]) {
      handlers[key](e);
    }
  });

  console.log("🔧 MIDI Fallback Hotkeys Loaded");
}

// --------------------------------------------------
// Mock MIDI Parsing (Simplified for Editor)
// --------------------------------------------------
// In a real editor, this would be a full-fledged MIDI parser/serializer.
// We reuse the basic note extraction for visualization.

function midiToVexKey(n) {
  const names = [
    'c','c#','d','d#','e','f','f#','g','g#','a','a#','b'
  ];
  const oct = Math.floor(n / 12) - 1;
  return `${names[n % 12]}/${oct}`;
}

function extractNotesForEditor(buffer) {
  const view = new DataView(buffer);
  let pos = 14; 
  const notes = [];
  
  // NOTE: This is a highly simplified mock based on ViewMIDI.mjs
  // It only handles the first track's notes at the start of the file.
  try {
    while (pos < buffer.byteLength - 3) {
      const status = view.getUint8(pos++);
      
      if ((status & 0xf0) === 0x90) { // Note On message
        const note = view.getUint8(pos++);
        const vel = view.getUint8(pos++);
        if (vel > 0)
          notes.push({ keys: [midiToVexKey(note)], duration: 'q' }); // quarter note mock
      } else {
        pos++; // Skip other message types for simplicity
      }
      
      if (status === 0xff || notes.length >= 40) break; // Stop after 40 notes or End of Track
    }
  } catch (err) {
    console.warn('extractNotesForEditor error:', err);
  }

  return notes.length ? notes : [{ keys: ['c/4'], duration: 'q' }];
}


// --------------------------------------------------
// Sheet Music Renderer (VexFlow)
// --------------------------------------------------

function renderSheetMusic(container) {
  const rendererDiv = document.getElementById('vf-renderer');
  if (!rendererDiv || !currentNotesData.length) return;

  // Clear existing rendering
  rendererDiv.innerHTML = ''; 

  const width = container.clientWidth || 800;
  const height = 180;

  const renderer = new VF.Renderer(rendererDiv, VF.Renderer.Backends.SVG);
  renderer.resize(width - 20, height);
  const ctx = renderer.getContext();
  ctx.setFont('Arial', 10);

  const stave = new VF.Stave(10, 10, width - 40);
  stave.addClef('treble').setContext(ctx).draw();

  const vfNotes = currentNotesData.map(n =>
    new VF.StaveNote({
      clef: 'treble',
      keys: n.keys,
      duration: n.duration // This should come from a proper parser
    })
  );
  
  // Display up to 32 notes
  const notesToRender = vfNotes.slice(0, 32); 

  // Mock voice settings
  const voice = new VF.Voice({ num_beats: notesToRender.length, beat_value: 4 })
    .setStrict(false)
    .addTickables(notesToRender);

  new VF.Formatter().joinVoices([voice]).format([voice], width - 60);
  voice.draw(ctx, stave);
}

// --------------------------------------------------
// Global Editor API (Saving and Manipulating)
// --------------------------------------------------

window.getEditorMIDI = () => {
    // In a real editor, this function would serialize currentNotesData 
    // and other track data back into a valid MIDI ArrayBuffer or Blob.
    console.log("TODO: Implement MIDI serialization.");
    return currentMidiBuffer; // Placeholder: return the original buffer
};

window.saveMIDIFile = async (path) => {
    const midiContent = window.getEditorMIDI();
    
    // In a real application, you would need to convert the ArrayBuffer to a Blob 
    // or send it as raw binary data, NOT JSON.
    // For this example, we assume the server can handle ArrayBuffer/Blob POST.
    
    const res = await fetch("/api/save-binary", { // Using a different endpoint for binary save
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: midiContent,
    });
    
    if (!res.ok) throw new Error("Failed to save MIDI file.");
    
    console.log("Saved MIDI file:", path || currentFilePath);
};


// --------------------------------------------------
// Main MIDI Editor Rendering
// --------------------------------------------------

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";
  currentFilePath = filePath;

  // Set mode
  window.NodevisionState.currentMode = "MIDIediting";
  updateToolbarState({ currentMode: "MIDIediting" });

  // Root container
  const wrapper = document.createElement("div");
  wrapper.id = "midi-editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  container.appendChild(wrapper);

  // 1. Controls/Timeline area (Placeholder)
  const controls = document.createElement("div");
  controls.style.height = '50px';
  controls.style.borderBottom = '1px solid #ccc';
  controls.innerHTML = '<p style="padding: 10px;">MIDI Editor Controls (Tempo, Playback, Tools)</p>';
  wrapper.appendChild(controls);

  // 2. Main Editing Area (e.g., Piano Roll or VexFlow-based Score View)
  const editorArea = document.createElement("div");
  editorArea.id = "midi-editing-area";
  editorArea.style.flex = "1";
  editorArea.style.overflow = "auto";
  editorArea.style.padding = "12px";
  wrapper.appendChild(editorArea);
  
  // VexFlow Renderer Container
  const rendererDiv = document.createElement('div');
  rendererDiv.id = 'vf-renderer';
  editorArea.appendChild(rendererDiv);
  
  // Status/Error Area
  const statusDiv = document.createElement('div');
  statusDiv.id = 'midi-status';
  statusDiv.style.marginTop = '1em';
  editorArea.appendChild(statusDiv);


  try {
    // ----------------- Load and Parse -----------------
    const serverBase = '/Notebook';
    const res = await fetch(`${serverBase}/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    
    currentMidiBuffer = await res.arrayBuffer(); // Store the raw buffer
    
    // Extract notes for the visual preview
    currentNotesData = extractNotesForEditor(currentMidiBuffer); 

    // Render the score preview
    renderSheetMusic(container);

    statusDiv.innerHTML = '<p style="color:green;">MIDI file loaded successfully. Score preview displayed.</p>';

  } catch (err) {
    wrapper.innerHTML =
      `<div style="color:red;padding:12px">Failed to load MIDI file: ${err.message}</div>`;
    console.error(err);
  }

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  registerMIDIFallbackHotkeys(filePath);

  // Optional: Listen for resize events to redraw VexFlow
  window.addEventListener('resize', () => renderSheetMusic(container));
}