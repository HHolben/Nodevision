// Nodevision/ApplicationSystem/native/speech/espeak_bridge.cpp
// This companion executable initializes libespeak-ng, speaks stdin text, and writes machine-readable speech events to stdout for Nodevision's trusted speech backend.

#include <csignal>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <sstream>
#include <string>

#if __has_include(<espeak-ng/speak_lib.h>)
#include <espeak-ng/speak_lib.h>
#elif __has_include(<espeak/speak_lib.h>)
#include <espeak/speak_lib.h>
#else
#error "Install the eSpeak NG development headers, such as espeak-ng-devel or libespeak-ng-dev."
#endif

static std::string g_utterance_id = "speech-native";
static bool g_terminal_emitted = false;

static std::string json_escape(const std::string &value) {
  std::ostringstream out;
  for (unsigned char c : value) {
    if (c == '"' || c == '\\') out << '\\' << c;
    else if (c == '\n') out << "\\n";
    else if (c == '\r') out << "\\r";
    else if (c == '\t') out << "\\t";
    else if (c < 0x20) {
      const char *hex = "0123456789abcdef";
      out << "\\u00" << hex[c >> 4] << hex[c & 0x0f];
    } else out << c;
  }
  return out.str();
}

static void emit_event(const std::map<std::string, std::string> &fields) {
  std::cout << "{";
  bool first = true;
  for (const auto &entry : fields) {
    if (!first) std::cout << ",";
    first = false;
    std::cout << "\"" << json_escape(entry.first) << "\":";
    const std::string &value = entry.second;
    if (!value.empty() && value[0] == '#') std::cout << value.substr(1);
    else std::cout << "\"" << json_escape(value) << "\"";
  }
  std::cout << "}" << std::endl;
}

static std::string number(int value) {
  return "#" + std::to_string(value);
}

static int synth_callback(short *, int, espeak_EVENT *events) {
  for (espeak_EVENT *event = events; event && event->type != espeakEVENT_LIST_TERMINATED; ++event) {
    if (event->type == espeakEVENT_WORD) {
      emit_event({
        {"type", "boundary"},
        {"boundaryType", "word"},
        {"utteranceId", g_utterance_id},
        {"nativeTextPosition", number(event->text_position)},
        {"nativeTextLength", number(event->length)},
        {"audioPositionMs", number(event->audio_position)},
        {"nativeUniqueIdentifier", number(static_cast<int>(event->unique_identifier))},
        {"nativeWordNumber", number(event->id.number)}
      });
    } else if (event->type == espeakEVENT_MSG_TERMINATED && !g_terminal_emitted) {
      g_terminal_emitted = true;
      emit_event({{"type", "finished"}, {"utteranceId", g_utterance_id}});
    }
  }
  return 0;
}

static std::string arg_value(int argc, char **argv, const std::string &name, const std::string &fallback = "") {
  for (int i = 1; i + 1 < argc; ++i) if (argv[i] == name) return argv[i + 1];
  return fallback;
}

static bool has_arg(int argc, char **argv, const std::string &name) {
  for (int i = 1; i < argc; ++i) if (argv[i] == name) return true;
  return false;
}

static std::string read_stdin() {
  std::ostringstream buffer;
  buffer << std::cin.rdbuf();
  return buffer.str();
}

static bool contains_greek_text(const std::string &text) {
  for (std::size_t i = 0; i < text.size();) {
    unsigned char c = static_cast<unsigned char>(text[i]);
    uint32_t codepoint = 0;
    std::size_t length = 1;
    if (c < 0x80) {
      codepoint = c;
    } else if ((c & 0xe0) == 0xc0 && i + 1 < text.size()) {
      codepoint = ((c & 0x1f) << 6) | (static_cast<unsigned char>(text[i + 1]) & 0x3f);
      length = 2;
    } else if ((c & 0xf0) == 0xe0 && i + 2 < text.size()) {
      codepoint = ((c & 0x0f) << 12) | ((static_cast<unsigned char>(text[i + 1]) & 0x3f) << 6) | (static_cast<unsigned char>(text[i + 2]) & 0x3f);
      length = 3;
    } else if ((c & 0xf8) == 0xf0 && i + 3 < text.size()) {
      codepoint = ((c & 0x07) << 18) | ((static_cast<unsigned char>(text[i + 1]) & 0x3f) << 12) | ((static_cast<unsigned char>(text[i + 2]) & 0x3f) << 6) | (static_cast<unsigned char>(text[i + 3]) & 0x3f);
      length = 4;
    }
    if ((codepoint >= 0x0370 && codepoint <= 0x03ff) || (codepoint >= 0x1f00 && codepoint <= 0x1fff)) return true;
    i += length;
  }
  return false;
}

static int clamp_rate(const std::string &raw) {
  int value = raw.empty() ? espeakRATE_NORMAL : std::atoi(raw.c_str());
  if (value < espeakRATE_MINIMUM) return espeakRATE_MINIMUM;
  if (value > espeakRATE_MAXIMUM) return espeakRATE_MAXIMUM;
  return value;
}

int main(int argc, char **argv) {
  g_utterance_id = arg_value(argc, argv, "--utterance-id", "speech-native");
  const int rate = clamp_rate(arg_value(argc, argv, "--rate", std::to_string(espeakRATE_NORMAL)));
  const std::string voice = arg_value(argc, argv, "--voice", "");
  espeak_SetSynthCallback(synth_callback);
  const int sample_rate = espeak_Initialize(AUDIO_OUTPUT_PLAYBACK, 0, nullptr, espeakINITIALIZE_DONT_EXIT);
  if (sample_rate < 0) {
    emit_event({{"type", "error"}, {"utteranceId", g_utterance_id}, {"error", "eSpeak NG failed to initialize."}});
    return 2;
  }
  espeak_SetParameter(espeakRATE, rate, 0);
  if (!voice.empty() && espeak_SetVoiceByName(voice.c_str()) != EE_OK) {
    emit_event({{"type", "error"}, {"utteranceId", g_utterance_id}, {"error", "Requested eSpeak voice is unavailable."}});
    return 3;
  }
  if (has_arg(argc, argv, "--probe")) {
    emit_event({{"type", "probe"}, {"ok", "#true"}, {"sampleRate", number(sample_rate)}});
    espeak_Terminate();
    return 0;
  }
  const std::string text = read_stdin();
  if (voice.empty() && contains_greek_text(text)) {
    espeak_SetVoiceByName("el");
  }
  unsigned int native_id = 0;
  emit_event({{"type", "started"}, {"utteranceId", g_utterance_id}, {"sampleRate", number(sample_rate)}});
  espeak_ERROR err = espeak_Synth(text.c_str(), text.size() + 1, 0, POS_CHARACTER, 0, espeakCHARS_UTF8 | espeakENDPAUSE, &native_id, nullptr);
  if (err != EE_OK) {
    emit_event({{"type", "error"}, {"utteranceId", g_utterance_id}, {"error", "eSpeak NG rejected the synthesis request."}});
    espeak_Terminate();
    return 4;
  }
  espeak_Synchronize();
  if (!g_terminal_emitted) emit_event({{"type", "finished"}, {"utteranceId", g_utterance_id}});
  espeak_Terminate();
  return 0;
}
