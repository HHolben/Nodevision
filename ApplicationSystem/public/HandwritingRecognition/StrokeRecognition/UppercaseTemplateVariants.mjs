// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/UppercaseTemplateVariants.mjs
// This data module supplements the shared alphabet with ordinary joined-stroke and plain-stem capital forms, keeping editable examples separate from recognition algorithms.

const examples = [
  ["B", "joined-bowls", [[[0.2,0.1],[0.2,0.9]],[[0.2,0.1],[0.52,0.1],[0.7,0.16],[0.74,0.28],[0.68,0.4],[0.5,0.49],[0.2,0.49],[0.53,0.49],[0.74,0.56],[0.79,0.7],[0.73,0.83],[0.52,0.9],[0.2,0.9]]]],
  ["G", "continuous", [[[0.84,0.22],[0.67,0.1],[0.43,0.1],[0.24,0.23],[0.16,0.48],[0.21,0.73],[0.4,0.89],[0.67,0.9],[0.84,0.77],[0.84,0.54],[0.58,0.54]]]],
  ["A", "joined-legs", [[[0.1,0.9],[0.5,0.1],[0.9,0.9]],[[0.3,0.58],[0.7,0.58]]]],
  ["E", "joined-outline", [[[0.85,0.1],[0.2,0.1],[0.2,0.9],[0.85,0.9]],[[0.2,0.5],[0.7,0.5]]]],
  ["F", "joined-top", [[[0.2,0.9],[0.2,0.1],[0.85,0.1]],[[0.2,0.5],[0.7,0.5]]]],
  ["I", "plain-stem", [[[0.5,0.1],[0.5,0.9]]]],
  ["I", "slanted-stem", [[[0.48,0.1],[0.52,0.9]]]],
  ["J", "no-top-bar", [[[0.7,0.1],[0.7,0.7],[0.66,0.84],[0.55,0.9],[0.4,0.88],[0.3,0.78]]]],
  ["L", "joined", [[[0.2,0.1],[0.2,0.9],[0.85,0.9]]]],
  ["Z", "joined", [[[0.15,0.1],[0.85,0.1],[0.15,0.9],[0.85,0.9]]]],
];

export const UPPERCASE_TEMPLATE_VARIANTS = examples.map(([character, variant, strokes]) => ({
  character, id: `uppercase-${character.toLowerCase()}-${variant}`, strokes,
  metadata: { strokeOrderFlexible: true, strokeDirectionReversible: true, strokesMayBeJoined: true },
}));
