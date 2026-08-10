// Nodevision/NativeComponents/HandwritingRecognizer/src/HandwritingProtocol.cpp
// This file implements the native handwriting JSON protocol parser and response serializer without relying on runtime-downloaded dependencies.
#include "HandwritingProtocol.hpp"

#include <cctype>
#include <cmath>
#include <algorithm>
#include <iomanip>
#include <limits>
#include <map>
#include <sstream>
#include <variant>

namespace nodevision::handwriting {
namespace {

struct JsonValue {
  using Object = std::map<std::string, JsonValue>;
  using Array = std::vector<JsonValue>;
  std::variant<std::nullptr_t, bool, double, std::string, Array, Object> value = nullptr;
};

class JsonParser {
 public:
  explicit JsonParser(const std::string& input) : input_(input) {}

  bool parse(JsonValue& out, ProtocolError& error) {
    skipSpace();
    if (!parseValue(out)) return fail(error, "INVALID_JSON", "The request body is not valid JSON.");
    skipSpace();
    if (pos_ != input_.size()) return fail(error, "INVALID_JSON", "The request contains extra data after the JSON value.");
    return true;
  }

 private:
  const std::string& input_;
  std::size_t pos_ = 0;

  bool fail(ProtocolError& error, const std::string& code, const std::string& message) {
    error = {code, message};
    return false;
  }

  void skipSpace() {
    while (pos_ < input_.size() && std::isspace(static_cast<unsigned char>(input_[pos_]))) pos_ += 1;
  }

  bool consume(char ch) {
    skipSpace();
    if (pos_ >= input_.size() || input_[pos_] != ch) return false;
    pos_ += 1;
    return true;
  }

  bool parseValue(JsonValue& out) {
    skipSpace();
    if (pos_ >= input_.size()) return false;
    const char ch = input_[pos_];
    if (ch == '{') return parseObject(out);
    if (ch == '[') return parseArray(out);
    if (ch == '"') {
      std::string s;
      if (!parseString(s)) return false;
      out.value = s;
      return true;
    }
    if (ch == 't' && input_.compare(pos_, 4, "true") == 0) {
      pos_ += 4;
      out.value = true;
      return true;
    }
    if (ch == 'f' && input_.compare(pos_, 5, "false") == 0) {
      pos_ += 5;
      out.value = false;
      return true;
    }
    if (ch == 'n' && input_.compare(pos_, 4, "null") == 0) {
      pos_ += 4;
      out.value = nullptr;
      return true;
    }
    return parseNumber(out);
  }

  bool parseObject(JsonValue& out) {
    if (!consume('{')) return false;
    JsonValue::Object obj;
    skipSpace();
    if (consume('}')) {
      out.value = obj;
      return true;
    }
    while (true) {
      std::string key;
      if (!parseString(key)) return false;
      if (!consume(':')) return false;
      JsonValue value;
      if (!parseValue(value)) return false;
      obj[key] = value;
      if (consume('}')) break;
      if (!consume(',')) return false;
    }
    out.value = obj;
    return true;
  }

  bool parseArray(JsonValue& out) {
    if (!consume('[')) return false;
    JsonValue::Array arr;
    skipSpace();
    if (consume(']')) {
      out.value = arr;
      return true;
    }
    while (true) {
      JsonValue value;
      if (!parseValue(value)) return false;
      arr.push_back(value);
      if (consume(']')) break;
      if (!consume(',')) return false;
    }
    out.value = arr;
    return true;
  }

  bool parseString(std::string& out) {
    skipSpace();
    if (pos_ >= input_.size() || input_[pos_] != '"') return false;
    pos_ += 1;
    std::ostringstream result;
    while (pos_ < input_.size()) {
      const char ch = input_[pos_++];
      if (ch == '"') {
        out = result.str();
        return true;
      }
      if (static_cast<unsigned char>(ch) < 0x20) return false;
      if (ch != '\\') {
        result << ch;
        continue;
      }
      if (pos_ >= input_.size()) return false;
      const char esc = input_[pos_++];
      switch (esc) {
        case '"': result << '"'; break;
        case '\\': result << '\\'; break;
        case '/': result << '/'; break;
        case 'b': result << '\b'; break;
        case 'f': result << '\f'; break;
        case 'n': result << '\n'; break;
        case 'r': result << '\r'; break;
        case 't': result << '\t'; break;
        case 'u':
          if (pos_ + 4 > input_.size()) return false;
          result << '?';
          pos_ += 4;
          break;
        default:
          return false;
      }
    }
    return false;
  }

  bool parseNumber(JsonValue& out) {
    skipSpace();
    const std::size_t start = pos_;
    if (pos_ < input_.size() && input_[pos_] == '-') pos_ += 1;
    while (pos_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) pos_ += 1;
    if (pos_ < input_.size() && input_[pos_] == '.') {
      pos_ += 1;
      while (pos_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) pos_ += 1;
    }
    if (pos_ < input_.size() && (input_[pos_] == 'e' || input_[pos_] == 'E')) {
      pos_ += 1;
      if (pos_ < input_.size() && (input_[pos_] == '+' || input_[pos_] == '-')) pos_ += 1;
      while (pos_ < input_.size() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) pos_ += 1;
    }
    if (start == pos_) return false;
    try {
      out.value = std::stod(input_.substr(start, pos_ - start));
      return true;
    } catch (...) {
      return false;
    }
  }
};

const JsonValue::Object* asObject(const JsonValue& v) {
  return std::get_if<JsonValue::Object>(&v.value);
}

const JsonValue::Array* asArray(const JsonValue& v) {
  return std::get_if<JsonValue::Array>(&v.value);
}

const JsonValue* child(const JsonValue::Object& obj, const std::string& key) {
  auto it = obj.find(key);
  return it == obj.end() ? nullptr : &it->second;
}

std::string stringValue(const JsonValue::Object& obj, const std::string& key, const std::string& fallback = "") {
  const JsonValue* v = child(obj, key);
  const auto* s = v ? std::get_if<std::string>(&v->value) : nullptr;
  return s ? *s : fallback;
}

double numberValue(const JsonValue::Object& obj, const std::string& key, double fallback = 0.0) {
  const JsonValue* v = child(obj, key);
  const auto* n = v ? std::get_if<double>(&v->value) : nullptr;
  return n ? *n : fallback;
}

bool boolValue(const JsonValue::Object& obj, const std::string& key, bool fallback = false) {
  const JsonValue* v = child(obj, key);
  const auto* b = v ? std::get_if<bool>(&v->value) : nullptr;
  return b ? *b : fallback;
}

bool finite(double value) {
  return std::isfinite(value);
}

std::string confidenceJson(double value) {
  const double clamped = std::max(0.0, std::min(1.0, finite(value) ? value : 0.0));
  std::ostringstream out;
  out << std::fixed << std::setprecision(6) << clamped;
  return out.str();
}

bool parseStroke(const JsonValue& value, Stroke& stroke) {
  const auto* obj = asObject(value);
  if (!obj) return false;
  stroke.pointerType = stringValue(*obj, "pointerType", "unknown").substr(0, 32);
  const JsonValue* pointsValue = child(*obj, "points");
  const auto* points = pointsValue ? asArray(*pointsValue) : nullptr;
  if (!points) return false;
  for (const JsonValue& pointValue : *points) {
    const auto* pointObj = asObject(pointValue);
    if (!pointObj) return false;
    Point point;
    point.x = numberValue(*pointObj, "x", std::numeric_limits<double>::quiet_NaN());
    point.y = numberValue(*pointObj, "y", std::numeric_limits<double>::quiet_NaN());
    point.time = numberValue(*pointObj, "time", numberValue(*pointObj, "t", 0.0));
    point.pressure = numberValue(*pointObj, "pressure", 0.5);
    stroke.points.push_back(point);
  }
  return true;
}

}  // namespace

std::string escapeJsonString(const std::string& value) {
  std::ostringstream out;
  for (unsigned char ch : value) {
    switch (ch) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (ch < 0x20) out << "\\u00" << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(ch) << std::dec;
        else out << ch;
        break;
    }
  }
  return out.str();
}

bool parseRecognitionRequest(const std::string& input, RecognitionRequest& request, ProtocolError& error) {
  JsonValue root;
  JsonParser parser(input);
  if (!parser.parse(root, error)) return false;
  const auto* obj = asObject(root);
  if (!obj) {
    error = {"INVALID_JSON", "The request root must be a JSON object."};
    return false;
  }

  request.protocolVersion = static_cast<int>(numberValue(*obj, "protocolVersion", 0));
  request.requestId = stringValue(*obj, "requestId", "").substr(0, 128);
  request.operation = stringValue(*obj, "operation", "");
  request.mode = stringValue(*obj, "mode", "single-character");

  const JsonValue* canvasValue = child(*obj, "canvas");
  const auto* canvas = canvasValue ? asObject(*canvasValue) : nullptr;
  if (canvas) {
    request.canvas.width = numberValue(*canvas, "width", 0.0);
    request.canvas.height = numberValue(*canvas, "height", 0.0);
  }

  const JsonValue* optionsValue = child(*obj, "options");
  const auto* options = optionsValue ? asObject(*optionsValue) : nullptr;
  if (options) {
    request.options.candidateLimit = static_cast<int>(numberValue(*options, "candidateLimit", 5));
    request.options.characterSet = stringValue(*options, "characterSet", "latin-alphanumeric").substr(0, 64);
    request.options.preserveStrokeOrder = boolValue(*options, "preserveStrokeOrder", true);
    request.options.usePressure = boolValue(*options, "usePressure", false);
  }

  const JsonValue* strokesValue = child(*obj, "strokes");
  const auto* strokes = strokesValue ? asArray(*strokesValue) : nullptr;
  if (!strokes) {
    error = {"INVALID_STROKES", "The request must include a strokes array."};
    return false;
  }
  for (const JsonValue& strokeValue : *strokes) {
    Stroke stroke;
    if (!parseStroke(strokeValue, stroke)) {
      error = {"INVALID_STROKES", "Every stroke must include a points array."};
      return false;
    }
    request.strokes.push_back(stroke);
  }
  return true;
}

std::string serializeSuccess(const RecognitionResponse& response) {
  std::ostringstream out;
  out << "{\"protocolVersion\":" << kProtocolVersion
      << ",\"requestId\":\"" << escapeJsonString(response.requestId)
      << "\",\"ok\":true,\"engine\":{\"name\":\"" << kEngineName
      << "\",\"version\":\"" << kEngineVersion << "\"},\"result\":{";
  out << "\"text\":\"" << escapeJsonString(response.text) << "\",";
  out << "\"confidence\":" << confidenceJson(response.confidence) << ",\"candidates\":[";
  for (std::size_t i = 0; i < response.candidates.size(); ++i) {
    const Candidate& c = response.candidates[i];
    if (i) out << ",";
    out << "{\"text\":\"" << escapeJsonString(c.text)
        << "\",\"confidence\":" << confidenceJson(c.confidence)
        << ",\"templateId\":\"" << escapeJsonString(c.templateId) << "\"}";
  }
  out << "],\"normalizedBounds\":{\"x\":" << confidenceJson(response.bounds.x)
      << ",\"y\":" << confidenceJson(response.bounds.y)
      << ",\"width\":" << confidenceJson(response.bounds.width)
      << ",\"height\":" << confidenceJson(response.bounds.height) << "}}";
  out << ",\"warnings\":[";
  for (std::size_t i = 0; i < response.warnings.size(); ++i) {
    if (i) out << ",";
    out << "\"" << escapeJsonString(response.warnings[i]) << "\"";
  }
  out << "]}";
  return out.str();
}

std::string serializeFailure(const std::string& requestId, const ProtocolError& error) {
  std::ostringstream out;
  out << "{\"protocolVersion\":" << kProtocolVersion
      << ",\"requestId\":\"" << escapeJsonString(requestId)
      << "\",\"ok\":false,\"error\":{\"code\":\"" << escapeJsonString(error.code)
      << "\",\"message\":\"" << escapeJsonString(error.message) << "\"}}";
  return out.str();
}

std::string serializeCapabilities() {
  std::ostringstream out;
  out << "{\"name\":\"" << kEngineName << "\",\"version\":\"" << kEngineVersion
      << "\",\"protocolVersion\":" << kProtocolVersion
      << ",\"operations\":[\"recognize\"],\"modes\":[\"single-character\"],"
      << "\"characterSets\":[\"latin-alphanumeric\"],\"requestFormat\":\"single-json-stdin\"}";
  return out.str();
}

std::string serializeVersion() {
  std::ostringstream out;
  out << "{\"name\":\"" << kEngineName << "\",\"version\":\"" << kEngineVersion
      << "\",\"protocolVersion\":" << kProtocolVersion << "}";
  return out.str();
}

}  // namespace nodevision::handwriting
