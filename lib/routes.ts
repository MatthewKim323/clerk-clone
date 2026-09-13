import fs from 'node:fs';
import path from 'node:path';

export type RouteMarkup = {
  htmlClass: string;
  bodyClass: string;
  htmlStyle?: string;
  bodyStyle?: string;
  bodyHtml: string;
  mainHtml?: string;
};

export type CapturedRoute = RouteMarkup & {
  route: string;
  title: string;
  cssPath: string;
  variants?: Record<string,RouteMarkup>;
};

export function routeKey(slug: string[]) {
  if (slug.some(part => !/^[a-zA-Z0-9._-]+$/.test(part))) return null;
  return slug.join('--');
}

export function getRoute(slug: string[]): CapturedRoute | null {
  const key = routeKey(slug);
  if (!key) return null;
  const file = path.join(process.cwd(), 'content/routes', `${key}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CapturedRoute;
}
