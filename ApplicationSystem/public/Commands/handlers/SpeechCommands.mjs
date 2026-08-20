// Nodevision/ApplicationSystem/public/Commands/handlers/SpeechCommands.mjs
// This module exposes provider-independent speech commands through the shared Nodevision SpeechService.

import { getSpeechService } from "../../Speech/SpeechService.mjs";

export function speakCommand([text], context = {}) {
  return getSpeechService().speak(text, context);
}

export function stopSpeechCommand() {
  return getSpeechService().cancelActive("command");
}

export function pauseSpeechCommand() {
  return getSpeechService().pause();
}

export function resumeSpeechCommand() {
  return getSpeechService().resume();
}

export function setSpeechRateCommand([rate]) {
  return getSpeechService().setRate(rate);
}
