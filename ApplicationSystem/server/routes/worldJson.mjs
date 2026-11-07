// Nodevision/ApplicationSystem/server/routes/worldJson.mjs
// This module parses saved world JSON without modifying string values, including encoded terrain caches. It retains support for legacy comments by recognizing them only outside quoted JSON strings.

// Valid JSON reaches the parser exactly as extracted from the HTML script.
export function parseWorldJson(source) {
  const text = String(source ?? '');
  try {
    return JSON.parse(text);
  } catch (originalError) {
    const uncommented = removeWorldComments(text);
    if (uncommented === text) throw originalError;
    return JSON.parse(uncommented);
  }
}

// Replace comment characters with spaces to preserve token boundaries and positions.
function removeWorldComments(text) {
  const output = [];
  let quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      output.push(character);
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
      output.push(character);
    } else if (character === '/' && text[i + 1] === '/') {
      while (i < text.length && !/[\r\n]/.test(text[i])) {
        output.push(' ');
        i++;
      }
      i--;
    } else if (character === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new SyntaxError('Unterminated world JSON comment');
      output.push(text.slice(i, end + 2).replace(/[^\r\n]/g, ' '));
      i = end + 1;
    } else output.push(character);
  }
  return output.join('');
}
