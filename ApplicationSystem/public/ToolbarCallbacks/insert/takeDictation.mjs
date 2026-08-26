// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/takeDictation.mjs
// This callback starts and stops browser speech recognition and inserts final dictated text into the active Nodevision editor selection.

const DICTATION_CONFIRMATION_KEY = "nodevision.takeDictation.browserSpeechConfirmed";

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

// === Speech Recognition ===
function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function confirmBrowserDictation() {
  try {
    if (window.localStorage?.getItem(DICTATION_CONFIRMATION_KEY) === "true") return true;
  } catch {
    // Continue without persisted preference if storage is unavailable.
  }

  const ok = typeof window.confirm === "function"
    ? window.confirm("Take Dictation uses your browser's speech recognition and microphone permission. Continue?")
    : true;
  if (ok) {
    try {
      window.localStorage?.setItem(DICTATION_CONFIRMATION_KEY, "true");
    } catch {
      // Storage is optional.
    }
  }
  return ok;
}

function stopActiveSession() {
  const session = window.__nvTakeDictationSession;
  if (!session?.recognition) return false;
  session.stopping = true;
  try {
    session.recognition.stop();
  } catch {
    window.__nvTakeDictationSession = null;
  }
  return true;
}

function collectFinalTranscript(event) {
  let text = "";
  for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (result?.isFinal) text += result[0]?.transcript || "";
  }
  return text;
}

// === Toolbar Callback ===
export default function takeDictation() {
  if (stopActiveSession()) return;
  if (!confirmBrowserDictation()) return;

  const Recognition = speechRecognitionConstructor();
  if (!Recognition) {
    alert("Take Dictation is not available in this browser.");
    return;
  }

  const destination = captureDictationDestination();
  if (!destination) {
    alert("Select an editor or text field before taking dictation.");
    return;
  }

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.lang = navigator.language || "en-US";

  const session = { recognition, destination, stopping: false };
  window.__nvTakeDictationSession = session;

  recognition.onresult = (event) => {
    if (window.__nvTakeDictationSession !== session) return;
    insertDictatedText(destination, collectFinalTranscript(event));
  };
  recognition.onerror = (event) => {
    console.warn("takeDictation: speech recognition error.", event?.error || event);
  };
  recognition.onend = () => {
    if (window.__nvTakeDictationSession === session) window.__nvTakeDictationSession = null;
  };

  try {
    recognition.start();
  } catch (err) {
    window.__nvTakeDictationSession = null;
    console.warn("takeDictation: unable to start speech recognition.", err);
    alert(err?.message || "Take Dictation could not start.");
  }
}
