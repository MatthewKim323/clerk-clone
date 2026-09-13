type SerializedPage = { rows: Record<string, any>; modules: Record<string, { id: number; name: string }> };
export function nativeHeaderThemes(data: SerializedPage) {
  const found: any[] = []; let pageTheme: string | undefined;
  function dereference(value: any, depth = 0): any {
    if (depth > 70) return null;
    if (typeof value !== 'string' || !/^\$L?[a-f\d]+(?::|$)/.test(value)) return value;
    const [id, ...path] = value.replace(/^\$L?/, '').split(':');
    let resolved = data.rows[id];
    for (const key of path) { resolved = dereference(resolved, depth + 1); resolved = key === 'props' && Array.isArray(resolved) ? resolved[3] : resolved?.[key]; }
    return dereference(resolved, depth + 1);
  }
  function walk(value: any, depth = 0) {
    if (depth > 100) return;
    value = dereference(value); if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      if (value[0] === '$') {
        const kind = data.modules[String(value[1]).replace(/^\$L?/, '')]?.name, props = value[3] || {};
        if (kind === 'ThemeProvider' && ['dark', 'light', 'neutral'].includes(props.forcedTheme)) pageTheme = props.forcedTheme;
        if (kind === 'SectionTheme' && (props.className || props.id)) found.push({ theme: props.theme, match: { tag: props.as || 'div', className: props.className || '', ...(props.id ? { id: props.id } : {}), parent: 0, contains: false } });
        walk(props.children, depth + 1); return;
      }
      value.forEach(child => walk(child, depth + 1));
    } else for (const [key, child] of Object.entries(value)) if (!['notFound', 'forbidden', 'unauthorized'].includes(key)) walk(child, depth + 1);
  }
  walk(data.rows['0']);
  return { bindings: [...new Map(found.map(binding => [JSON.stringify(binding), binding])).values()], pageTheme };
}

export function nativeHeaderFallback(source: string, route: string) {
  const variable = source.match(/([\w$]+)\.some\([\w$]+=>[\w$]+\.startsWith\([\w$]+\)\)\?"dark":"light"/)?.[1];
  if (!variable) return undefined;
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const array = source.match(new RegExp(`\\b${escaped}=(\\[(?:"[^"]*",?)*\\])`))?.[1];
  if (!array) return undefined;
  const prefixes = JSON.parse(array) as string[];
  return prefixes.some(prefix => route.startsWith(prefix)) ? 'dark' : 'light';
}
