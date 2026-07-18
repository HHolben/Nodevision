// Nodevision/ApplicationSystem/routes/api/serialDependencies.mjs
// Optional serialport dependency loader shared by Arduino/serial routes.

const SERIAL_DEPENDENCY_MESSAGE =
  "Serial support is unavailable because serialport or @serialport/parser-readline could not be imported.";
const SERIAL_DEPENDENCY_INSTALL_HINT =
  "Run npm install from ApplicationSystem, or install serialport and @serialport/parser-readline to enable serial features.";

let serialDependenciesPromise = null;
let lastSerialDependencyError = null;

function wrapSerialDependencyError(err) {
  const wrapped = new Error(SERIAL_DEPENDENCY_MESSAGE);
  wrapped.code = "SERIALPORT_UNAVAILABLE";
  wrapped.cause = err;
  wrapped.detail = err?.message || String(err || "");
  return wrapped;
}

export async function loadSerialDependencies() {
  if (!serialDependenciesPromise) {
    serialDependenciesPromise = Promise.all([
      import("serialport"),
      import("@serialport/parser-readline"),
    ]).then(([serialportModule, readlineModule]) => {
      const SerialPort =
        serialportModule.SerialPort ||
        serialportModule.default?.SerialPort ||
        serialportModule.default;
      const ReadlineParser =
        readlineModule.ReadlineParser ||
        readlineModule.default?.ReadlineParser ||
        readlineModule.default;
      if (!SerialPort || !ReadlineParser) {
        throw new Error("serialport modules loaded, but required exports were not found.");
      }
      lastSerialDependencyError = null;
      return { SerialPort, ReadlineParser };
    }).catch((err) => {
      serialDependenciesPromise = null;
      lastSerialDependencyError = wrapSerialDependencyError(err);
      throw lastSerialDependencyError;
    });
  }
  return serialDependenciesPromise;
}

export function isSerialDependencyUnavailable(err) {
  return err?.code === "SERIALPORT_UNAVAILABLE";
}

export function serialUnavailablePayload(err = lastSerialDependencyError) {
  return {
    serialSupportAvailable: false,
    error: SERIAL_DEPENDENCY_MESSAGE,
    detail: err?.detail || err?.cause?.message || err?.message || "",
    installHint: SERIAL_DEPENDENCY_INSTALL_HINT,
  };
}
