// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/PitchDetector.mjs
// This file detects a single dominant pitch from microphone waveform samples.

const MIN_FREQUENCY = 80;
const MAX_FREQUENCY = 1100;
const RMS_THRESHOLD = 0.012;
const CLARITY_THRESHOLD = 0.72;

export function detectPitch(samples, sampleRate) {
  if (!samples || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { frequency: null, clarity: 0, rms: 0 };
  }

  let rms = 0;
  for (let i = 0; i < samples.length; i += 1) {
    rms += samples[i] * samples[i];
  }
  rms = Math.sqrt(rms / Math.max(1, samples.length));
  if (rms < RMS_THRESHOLD) return { frequency: null, clarity: 0, rms };

  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxTau = Math.min(Math.floor(samples.length / 2), Math.ceil(sampleRate / MIN_FREQUENCY));
  const cmnd = new Float32Array(maxTau + 1);
  let runningSum = 0;

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = samples.length - tau;
    for (let i = 0; i < limit; i += 1) {
      const delta = samples[i] - samples[i + tau];
      sum += delta * delta;
    }
    runningSum += sum;
    cmnd[tau] = runningSum > 0 ? sum * tau / runningSum : 1;
  }

  let bestTau = -1;
  let bestScore = Infinity;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    const score = cmnd[tau];
    if (score < bestScore) {
      bestScore = score;
      bestTau = tau;
    }
    if (score < 0.16) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      bestTau = tau;
      bestScore = cmnd[tau];
      break;
    }
  }

  const clarity = Math.max(0, Math.min(1, 1 - bestScore));
  if (bestTau <= 0 || clarity < CLARITY_THRESHOLD) {
    return { frequency: null, clarity, rms };
  }

  return {
    frequency: sampleRate / refineTau(cmnd, bestTau),
    clarity,
    rms,
  };
}

function refineTau(difference, tau) {
  const left = difference[tau - 1] ?? difference[tau];
  const center = difference[tau];
  const right = difference[tau + 1] ?? difference[tau];
  const denom = left - 2 * center + right;
  if (Math.abs(denom) < 0.000001) return tau;
  return tau + 0.5 * (left - right) / denom;
}
