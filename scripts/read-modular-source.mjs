// Read a facade and its feature modules as one source unit for existing source-level regressions.
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
const generate = generateModule.default || generateModule;

export async function readModularSource(url) {
  const parts = new URL(url.href.replace(/\.mjs$/, 'Parts/'));
  const seen = new Set(), declarations = [], imports = new Map();
  async function visit(current) {
    if (seen.has(current.href)) return;
    seen.add(current.href);
    const source = await readFile(current, 'utf8');
    const tree = parse(source, { sourceType: 'module' });
    for (const node of tree.program.body) {
      if (node.type !== 'ImportDeclaration' && !(node.type === 'ExportNamedDeclaration' && node.source)) continue;
      const target = node.source.value.startsWith('.') ? new URL(node.source.value, current) : null;
      if (target?.href.startsWith(parts.href)) await visit(target);
      else if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) {
          if (!imports.has(specifier.local.name)) imports.set(specifier.local.name, { ...node, specifiers: [specifier] });
        }
      }
    }
    declarations.push(...tree.program.body.filter(node => node.type !== 'ImportDeclaration' && !(node.type === 'ExportNamedDeclaration' && node.source)));
  }
  await visit(url);
  return [...imports.values(), ...declarations].map(node => generate(node).code).join('\n');
}

// Static feature assertions ignore dependency-access syntax, but inspect the current bodies.
// This representation is never evaluated or used by the application.
export async function readEditorFeatureSource(url) {
  const { default: traverseModule } = await import('@babel/traverse');
  const traverse = traverseModule.default || traverseModule;
  const types = await import('@babel/types');
  const tree = parse(await readModularSource(url), { sourceType: 'module' });
  traverse(tree, { noScope: true, MemberExpression: { exit(path) {
    if (!path.node.computed && types.isIdentifier(path.node.object) && /^(owner|scope|_editorState\d*|svgSession|htmlSession|keyCommandState|pointerStartState|pointerMoveState|imageDialogState|inlineImageState|imageToolsState|layoutToolsState|panelState|hostState|layerState)$/.test(path.node.object.name)) path.replaceWith(path.node.property);
  } } });
  traverse(tree, { noScope: true, FunctionDeclaration(path) {
    const match = /^create(.+)Handler\d*$/.exec(path.node.id?.name || '');
    if (!match) return;
    const returned = path.node.body.body.find(node => types.isReturnStatement(node))?.argument;
    if (types.isFunctionExpression(returned)) returned.id = types.identifier(match[1][0].toLowerCase() + match[1].slice(1));
    if (types.isArrowFunctionExpression(returned) && types.isBlockStatement(returned.body)) {
      path.node.body.body.find(node => types.isReturnStatement(node)).argument = types.functionExpression(types.identifier(match[1][0].toLowerCase() + match[1].slice(1)), returned.params, returned.body, false, returned.async);
    }
  }, ExpressionStatement(path) {
    const expression = path.node.expression;
    if (!types.isAssignmentExpression(expression) || !types.isIdentifier(expression.left) || !types.isFunctionExpression(expression.right)) return;
    const fn = expression.right;
    path.replaceWith(types.functionDeclaration(expression.left, fn.params, fn.body, fn.generator, fn.async));
  } });
  return generate(tree).code;
}
