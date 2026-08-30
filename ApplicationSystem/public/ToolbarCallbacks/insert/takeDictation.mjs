// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/takeDictation.mjs
// This callback toggles shared Nodevision speech recognition and inserts finalized dictation text into the active editor selection.

import { setStatus } from "/StatusBar.mjs";
import { getSpeechService } from "/Speech/SpeechService.mjs";

const DICTATION_SOURCE = "take-dictation-toolbar";

// === Destination Lookup ===
function textInputSelection(el) {
  const valueLength = String(el?.value || "").length;
  return {
    start: Number.isFinite(el?.selectionStart) ? el.selectionStart : valueLength,
    end: Number.isFinite(el?.selectionEnd) ? el.selectionEnd : valueLength,
  };
}

function captureDictationDestination() {
  const htmlTools = window.HTMLWysiwygTools || null;
  const htmlEditor = htmlTools?.getEditorElement?.();
  if (htmlEditor?.isConnected && htmlEditor?.isContentEditable) {
    htmlTools.saveCurrentSelection?.();
    return { type: "html", htmlTools };
  }

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return { type: "input", el: active, selection: textInputSelection(active) };
  }

  const monacoEditor = window.monacoEditor;
  if (monacoEditor?.getModel && monacoEditor?.getSelection) {
    return { type: "monaco", editor: monacoEditor };
  }

  return null;
}

// === Text Insertion ===
function normalizedDictationText(value = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? `${text} ` : "";
}

function insertIntoInput(destination, text) {
  const el = destination.el;
  const selection = destination.selection || textInputSelection(el);
  const start = Math.max(0, selection.start);
  const end = Math.max(start, selection.end);
  const value = String(el.value || "");
  el.value = value.slice(0, start) + text + value.slice(end);
  const next = start + text.length;
  destination.selection = { start: next, end: next };
  el.focus();
  el.setSelectionRange?.(next, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function insertIntoMonaco(destination, text) {
  const editor = destination.editor;
  if (!editor?.trigger) return false;
  editor.focus?.();
  editor.trigger("takeDictation", "type", { text });
  return true;
}

function insertDictatedText(destination, transcript) {
  const text = normalizedDictationText(transcript);
  if (!text || !destination) return false;
  if (destination.type === "html") {
    destination.htmlTools.restoreSavedSelection?.();
    const inserted = destination.htmlTools.insertTextAtSelection?.(text) !== false;
    destination.htmlTools.saveCurrentSelection?.();
    return inserted;
  }
  if (destination.type === "input") return insertIntoInput(destination, text);
  if (destination.type === "monaco") return insertIntoMonaco(destination, text);
  return false;
}

function shortStatusText(text = "") {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function reportDictationError(err) {
  const message = err?.message || String(err || "Take Dictation could not start.");
  setStatus("Dictation", "Unavailable");
  console.warn("takeDictation: speech recognition error.", err);
  alert(message);
}

// === Toolbar Callback ===
export default async function takeDictation() {
  const service = getSpeechService();
  if (service.isRecognitionActive?.()) {
    setStatus("Dictation", "Processing");
    try {
      await service.stopRecognition("command");
    } catch (err) {
      reportDictationError(err);
    }
    return;
  }

  const destination = captureDictationDestination();
  if (!destination) {
    alert("Select an editor or text field before taking dictation.");
    return;
  }

  try {
    await service.startRecognition({
      source: DICTATION_SOURCE,
      onPartialText: (text) => {
        const preview = shortStatusText(text);
        setStatus("Dictation", preview ? `Listening: ${preview}` : "Listening");
      },
      onFinalText: (text) => {
        if (insertDictatedText(destination, text)) setStatus("Dictation", "Inserted text");
      },
      onState: (state) => {
        if (state === "processing") setStatus("Dictation", "Processing");
      },
      onEvent: (eventName, detail) => {
        if (eventName === "speech.recognition.started") setStatus("Dictation", "Listening");
        if (eventName === "speech.recognition.finished") setStatus("Dictation", "Stopped");
        if (eventName === "speech.recognition.cancelled") setStatus("Dictation", "Stopped");
        if (eventName === "speech.recognition.error") {
          setStatus("Dictation", "Error");
          alert(detail?.error || "Take Dictation stopped.");
        }
      },
    });
  } catch (err) {
    reportDictationError(err);
  }
}
