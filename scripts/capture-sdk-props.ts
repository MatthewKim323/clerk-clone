import fs from 'node:fs';
import { readOrigin, scrubSource } from '../tooling/1to1/src/lib/anon.ts';
const origin = readOrigin('reference/site')!;
const clean = (text: string) => scrubSource(text, origin.tokens, origin.brand, origin.host).replace(/[\u2013\u2014]/g, '-');
for (const route of ['react-authentication', 'nextjs-authentication', 'expo-authentication']) {
  const response = await fetch(new URL('/' + route, origin.url));
  if (!response.ok) { console.log(route, response.status); continue; }
  const html = await response.text();
  const props = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.includes('__next_f.push'));
  const directory = 'reference/site-' + route + '/supplement';
  fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(directory + '/page-props.js', clean(props.join('\n')));
  const stream = [...props.join('\n').matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(match => JSON.parse(match[1])).join('');
  const rows: Record<string, unknown> = {}; let pos = 0;
  while (pos < stream.length) {
    const match = stream.slice(pos).match(/^([a-f\d]+):/);
    if (!match) { const end = stream.indexOf('\n', pos); if (end < 0) break; pos = end + 1; continue; }
    pos += match[0].length;
    if (stream[pos] === 'T') {
      const comma = stream.indexOf(',', pos), bytes = parseInt(stream.slice(pos + 1, comma), 16);
      const value = Buffer.from(stream.slice(comma + 1)).subarray(0, bytes).toString(); rows[match[1]] = value; pos = comma + 1 + value.length;
    } else {
      let end = stream.indexOf('\n', pos); if (end < 0) end = stream.length;
      const line = stream.slice(pos, end); try { rows[match[1]] = JSON.parse(line.replace(/^I/, '')); } catch { rows[match[1]] = line; } pos = end + 1;
    }
  }
  fs.writeFileSync(directory + '/rsc-rows.json', clean(JSON.stringify(rows)));
  console.log(route, 'props', props.join('\n').length, 'rows', Object.keys(rows).length);
}
