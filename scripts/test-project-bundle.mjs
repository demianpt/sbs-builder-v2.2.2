import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectBundle } from '../src/utils/project-bundle.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (name) => path.join(root, 'tests', 'fixtures', 'wordpress', name);
const outputDir = path.join(root, 'test-results');
await fs.mkdir(outputDir, { recursive: true });
const [navigation, footer, page, websiteHtml] = await Promise.all([
  fs.readFile(fixture('navigation.json'), 'utf8').then(JSON.parse),
  fs.readFile(fixture('footer.json'), 'utf8').then(JSON.parse),
  fs.readFile(fixture('page.json'), 'utf8').then(JSON.parse),
  fs.readFile(fixture('website.html'), 'utf8'),
]);
const blob = await createProjectBundle({ navigation, footer, page, websiteHtml });
const output = path.join(outputDir, 'sbs-complete-project.zip');
await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
const report = {
  passed: blob.type === 'application/zip' && blob.size > 1000,
  output,
  bytes: blob.size,
  expectedEntries: ['navigation.json', 'footer.json', 'page.json', 'website.html'],
};
await fs.writeFile(path.join(outputDir, 'project-bundle-test.json'), JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
console.log(JSON.stringify(report, null, 2));
