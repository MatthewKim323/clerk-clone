import fs from 'node:fs';
import path from 'node:path';

const allowed = new Set(['announcement', 'hero', 'customers', 'components', 'authentication', 'notch-auth', 'organizations', 'billing', 'integrations', 'notch-integrations', 'testimonials', 'header', 'footer', 'overlays']);

export function Section({ name }: { name: string }) {
  if (!allowed.has(name)) return null;
  const html = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'components/sections/markup', `${name}.json`), 'utf8'));
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
