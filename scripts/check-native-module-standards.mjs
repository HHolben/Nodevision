// Check the dirty native application modules against the documented header and line limits.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parse } from '@babel/parser';
// A supplied newline-delimited manifest allows audits of a fixed refactoring scope.
const manifestIndex = process.argv.indexOf('--files');
const candidates = manifestIndex >= 0
  ? readFileSync(process.argv[manifestIndex + 1], 'utf8').trim().split('\n')
  : ['diff', 'untracked'].flatMap(kind => execFileSync('git', kind === 'diff'
    ? ['diff', '--name-only', 'HEAD'] : ['ls-files', '--others', '--exclude-standard'],
    { encoding: 'utf8' }).trim().split('\n'));
const files = [...new Set(candidates)].filter(file => file.startsWith('ApplicationSystem/') && ['.js', '.mjs', '.css'].includes(extname(file)));
const results = files.map(file => {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const header = lines[0].includes('Nodevision/' + file);
  const description = /^(?:\/\/|\/\*) [A-Z].*\.(?: \*\/)?$/.test(lines[1] || '');
  const comments = file.endsWith('.css')
    ? [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map(match => ({ start: match.index, end: match.index + match[0].length }))
    : parse(source, { sourceType: 'module' }).comments;
  const characters = source.split('');
  for (const comment of comments) for (let i = comment.start; i < comment.end; i++) if (characters[i] !== '\n') characters[i] = ' ';
  const codeLines = characters.join('').split('\n').filter(line => line.trim()).length;
  return { file, codeLines, header, description, pass: codeLines < 200 && header && description };
});
const failed = results.filter(result => !result.pass);
console.log(JSON.stringify({ checked: results.length, maximumCodeLines: Math.max(...results.map(result => result.codeLines)), failed, files: process.argv.includes('--inventory') ? results : undefined }, null, 2));
process.exitCode = failed.length ? 1 : 0;
