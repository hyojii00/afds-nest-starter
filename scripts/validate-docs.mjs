import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: mermaid } = await import('mermaid');
mermaid.initialize({ securityLevel: 'loose' });

const root = process.cwd();
const requiredPaths = [
  'AGENTS.md',
  'MAP.md',
  'WORKFLOW.md',
  'CONTRIBUTING.md',
  'docs/specs',
  'docs/arch',
  'docs/adr',
  'docs/guidelines',
  'docs/runbooks',
];
const excluded = new Set(['.git', 'node_modules', 'dist', 'coverage', '.ephemeral']);
const failures = [];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) {
    failures.push(`missing AFDS owner path: ${path}`);
  }
}

const markdownFiles = walk(root).filter((path) => path.endsWith('.md'));
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
const mermaidPattern = /```mermaid\s*\n([\s\S]*?)```/g;

for (const file of markdownFiles) {
  const markdown = readFileSync(file, 'utf8');
  for (const match of markdown.matchAll(linkPattern)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget || rawTarget.startsWith('#') || /^(https?:|mailto:)/.test(rawTarget)) {
      continue;
    }
    const withoutTitle = rawTarget.startsWith('<')
      ? rawTarget.slice(1, rawTarget.indexOf('>'))
      : rawTarget.split(/\s+/)[0];
    const decoded = decodeURIComponent(withoutTitle.split('#')[0] ?? '');
    if (decoded && !existsSync(resolve(dirname(file), decoded))) {
      failures.push(`${relative(root, file)} has broken link: ${rawTarget}`);
    }
  }

  let diagramIndex = 0;
  for (const match of markdown.matchAll(mermaidPattern)) {
    diagramIndex += 1;
    const source = match[1]?.trim() ?? '';
    try {
      await mermaid.parse(source);
    } catch (error) {
      failures.push(
        `${relative(root, file)} Mermaid diagram ${diagramIndex}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

const adrIds = new Map();
for (const name of readdirSync(join(root, 'docs/adr'))) {
  const match = /^(\d{4})-.*\.md$/.exec(name);
  if (!match) {
    continue;
  }
  const id = match[1];
  const previous = adrIds.get(id);
  if (previous) {
    failures.push(`duplicate ADR id ${id}: ${previous}, ${name}`);
  }
  adrIds.set(id, name);
}

if (failures.length > 0) {
  console.error('Documentation validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Documentation validation passed (${markdownFiles.length} Markdown files, ${adrIds.size} ADRs)`,
);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (excluded.has(entry)) {
      continue;
    }
    const absolutePath = join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...walk(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }
  return files;
}
