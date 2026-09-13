import { animate } from 'motion';
import scores from '../content/leaderboard-data.json';

type Score = { label: string; framework: string; category: string; provider: string; value: number; mcpScore?: number; skillsScore?: number; improvement?: number; skillsImprovement?: number; updatedAt: string };
type Mode = 'base' | 'mcp' | 'skills';
const scoreData = scores as Score[];
const percent = (value: number) => value.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 0 });
const categoryOrder = ['Authentication', 'Users', 'Organizations', 'Billing', 'Webhooks', 'API Routes', 'Checkout Flow'];
const providerLabels: Record<string, string> = { all: 'All Providers', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', vercel: 'Vercel', other: 'Other' };
const checkIcon = '<svg class="size-4 flex-none text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.25 4.75L6 12L2.75 8.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const frameworkIcons: Record<string, string> = {
  React: '<svg class="size-4 flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" stroke-width="1.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" stroke-width="1.5" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  Android: '<svg class="size-4 flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M17.523 15.342a1.032 1.032 0 0 0 1.032-1.032 1.032 1.032 0 0 0-2.064 0c0 .57.462 1.032 1.032 1.032m-11.046 0a1.032 1.032 0 0 0 1.032-1.032 1.032 1.032 0 0 0-2.064 0c0 .57.462 1.032 1.032 1.032M17.8 8.112l1.947-3.373a.405.405 0 0 0-.149-.553.405.405 0 0 0-.553.149l-1.972 3.414a12.044 12.044 0 0 0-5.07-1.1 12.044 12.044 0 0 0-5.073 1.1L4.958 4.335a.405.405 0 0 0-.553-.149.405.405 0 0 0-.149.553l1.947 3.373C2.705 10.14.285 13.665.007 17.809h23.986c-.278-4.144-2.698-7.669-6.193-9.697"/></svg>',
  iOS: '<svg class="size-4 flex-none" viewBox="35 0 34 42" fill="none" aria-hidden="true"><path fill="currentColor" d="M67.527 14.637c-.232.18-4.329 2.488-4.329 7.621 0 5.937 5.213 8.037 5.369 8.089-.024.128-.828 2.876-2.748 5.677-1.713 2.464-3.5 4.924-6.22 4.924s-3.42-1.58-6.561-1.58c-3.06 0-4.148 1.632-6.637 1.632s-4.224-2.28-6.22-5.081c-2.313-3.288-4.181-8.397-4.181-13.245 0-7.777 5.056-11.901 10.033-11.901 2.644 0 4.848 1.736 6.509 1.736 1.58 0 4.044-1.84 7.052-1.84 1.14 0 5.237.104 7.933 3.968Zm-9.361-7.261c1.244-1.476 2.124-3.524 2.124-5.573 0-.284-.024-.572-.076-.804-2.024.076-4.432 1.348-5.885 3.032-1.14 1.297-2.204 3.345-2.204 5.421 0 .312.052.624.076.724.128.024.336.052.544.052 1.816 0 4.1-1.216 5.421-2.852Z"/></svg>',
};

// LeaderboardTable, native filters, colors and score rules: module-d808049658380bab.js.
export function bindLeaderboard(main: HTMLElement) {
  const abort = new AbortController(), signal = abort.signal, cleanups: (() => void)[] = [];
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const table = main.querySelector<HTMLTableElement>('table');
  const frameworkButton = main.querySelector<HTMLButtonElement>('button[aria-label="Filter by framework"]');
  const providerButton = main.querySelector<HTMLButtonElement>('button[aria-label="Filter by provider"]');
  const radios = [...main.querySelectorAll<HTMLButtonElement>('[aria-label="Score mode"] button[role="radio"]')];
  if (!table || !frameworkButton || !providerButton || !radios.length) return () => {};
  const initialRows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const rowTemplate = initialRows[0].cloneNode(true) as HTMLTableRowElement;
  const modelTemplates = new Map(initialRows.map(row => [row.querySelector('.truncate')?.textContent || '', row.cloneNode(true) as HTMLTableRowElement]));
  const icons: Record<string, string> = {};
  initialRows.forEach(row => { const svg = row.querySelector('svg'), title = svg?.querySelector('title')?.textContent?.toLowerCase(); if (svg && title) icons[title] = svg.outerHTML; });
  icons.all = providerButton.querySelector('svg')?.outerHTML || '';
  frameworkIcons['Next.js'] = frameworkButton.querySelector('svg')?.outerHTML || '';
  const indicator = radios[0].querySelector<HTMLElement>(':scope > div')!;
  const selectedClass = radios[0].className, unselectedClass = radios[1].className;
  const firstHeading = table.querySelector('thead th')!.cloneNode(true), columnHeading = table.querySelector('thead th:nth-child(2)')!.cloneNode(true) as HTMLElement;
  const firstColumn = table.querySelector('col')!.cloneNode(true), columnTemplate = table.querySelector('col:nth-child(2)')!.cloneNode(true);
  const summary = frameworkButton.closest('section')?.querySelector<HTMLElement>(':scope > div:first-child > div:last-child');
  const scroll = table.parentElement?.parentElement;
  const radioGroup = radios[0].parentElement!, modeWrapper = radioGroup.parentElement!;
  let framework = 'Next.js', provider = 'all', mode: Mode = 'base', closeMenu = () => {};
  let tooltip: HTMLElement | null = null;
  const updateFade = () => {
    if (!scroll) return;
    scroll.style.setProperty('--fade-left-opacity', scroll.scrollLeft > 1 ? '1' : '0');
    scroll.style.setProperty('--fade-right-opacity', scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1 ? '1' : '0');
  };
  const filtered = () => scoreData.filter(row => row.framework === framework && (provider === 'all' || row.provider === provider));
  const currentScore = (row: Score) => mode === 'skills' ? row.skillsScore ?? row.value : mode === 'mcp' ? row.mcpScore ?? row.value : row.value;
  const render = () => {
    const rows = filtered(), labels = [...new Set(rows.map(row => row.label))].sort();
    const categories = [...new Set(rows.map(row => row.category))].sort((a, b) => {
      const left = categoryOrder.indexOf(a), right = categoryOrder.indexOf(b);
      return left >= 0 && right >= 0 ? left - right : left >= 0 ? -1 : right >= 0 ? 1 : a.localeCompare(b);
    });
    const means = new Map(labels.map(label => { const group = rows.filter(row => row.label === label); return [label, group.reduce((sum, row) => sum + currentScore(row), 0) / group.length]; }));
    labels.sort((a, b) => means.get(b)! - means.get(a)!);
    const header = table.querySelector('thead tr')!, cols = table.querySelector('colgroup')!, body = table.querySelector('tbody')!;
    header.replaceChildren(firstHeading.cloneNode(true)); cols.replaceChildren(firstColumn.cloneNode(true));
    categories.forEach(category => { const heading = columnHeading.cloneNode(true) as HTMLElement; heading.firstElementChild!.textContent = category; header.append(heading); cols.append(columnTemplate.cloneNode(true)); });
    const fragment = document.createDocumentFragment();
    labels.forEach((label, index) => {
      const group = rows.filter(row => row.label === label), average = means.get(label)!;
      const row = (modelTemplates.get(label) || rowTemplate).cloneNode(true) as HTMLTableRowElement;
      while (row.children.length > 1) row.lastElementChild!.remove();
      const labelCell = row.firstElementChild!, labelGroup = labelCell.firstElementChild!;
      labelGroup.firstElementChild!.textContent = String(index + 1);
      const modelIcon = labelGroup.children[1]; modelIcon.innerHTML = icons[group[0].provider] || '';
      const modelName = labelCell.querySelector('.truncate')!; modelName.textContent = label;
      const badge = modelName.nextElementSibling!; badge.textContent = percent(average);
      badge.className = 'flex-none rounded-md border px-1 text-xs font-semibold ' + (average >= .8 ? 'border-sky-300/35 bg-sky-300/10 text-sky-300' : average >= .5 ? 'border border-white/10 bg-white/10 text-gray-300' : 'border-red-500/35 bg-red-500/10 text-red-500');
      categories.forEach((category, categoryIndex) => {
        const cell = document.createElement('td'); cell.className = 'px-1.5 py-2 transition-colors group-hover:bg-(--bg-hover) group-hover:duration-80 ease-swift-out duration-200' + (categoryIndex === 0 ? ' pl-3' : '') + (categoryIndex === categories.length - 1 ? ' pr-3' : ''); cell.style.borderBottom = '0.5px dashed #2C2C2D';
        const score = group.filter(row => row.category === category).at(-1), value = score ? currentScore(score) : undefined;
        const available = mode === 'skills' ? score?.skillsScore !== undefined : score?.mcpScore !== undefined;
        const improvement = mode === 'skills' ? score?.skillsImprovement : score?.improvement;
        const tile = document.createElement('div'); tile.className = 'relative flex cursor-default items-center justify-center rounded-lg border px-2 py-4 font-mono text-sm font-medium transition-all hover:duration-80 ease-swift-out duration-200 ' + (mode !== 'base' && !available ? 'opacity-40 ' : '') + (value === undefined ? 'border-gray-700/40 bg-gray-900/50 hover:border-gray-600/40 hover:bg-gray-800/50' : value >= .8 ? 'border-sky-900/30 bg-sky-300/10 text-sky-300 hover:border-sky-300/30 hover:bg-sky-300/15' : value >= .5 ? 'border-white/10 bg-gray-300/10 text-gray-300 hover:border-white/20 hover:bg-gray-300/15' : 'border-red-900/30 bg-red-500/10 text-red-500 hover:border-red-500/30 hover:bg-red-500/15');
        const valueText = document.createElement('span'); valueText.className = 'leading-none'; valueText.textContent = value === undefined ? '-' : percent(value); tile.append(valueText);
        if (mode !== 'base' && improvement !== undefined && improvement > .01) { const extra = document.createElement('span'); extra.className = 'absolute top-1.5 right-2 text-[0.5625rem] leading-none font-medium text-green-400'; extra.textContent = `↑${percent(improvement)}`; tile.append(extra); }
        cell.append(tile); row.append(cell);
      });
      fragment.append(row);
    });
    body.replaceChildren(fragment);
    const improvements = rows.map(row => mode === 'skills' ? row.skillsImprovement : row.improvement).filter((value): value is number => value !== undefined);
    const improvement = improvements.length ? improvements.reduce((sum, value) => sum + value, 0) / improvements.length : 0;
    if (summary) { summary.replaceChildren(); if (mode !== 'base' && improvement > 0) { const group = document.createElement('div'); group.className = 'flex items-center gap-2'; group.innerHTML = `<span class="text-gray-500">Avg. ${mode === 'skills' ? 'Skills' : 'MCP'} Improvement:</span><span class="font-medium text-green-400">+${percent(improvement)}</span>`; summary.append(group); } }
    const latest = rows.reduce((date, row) => row.updatedAt > date ? row.updatedAt : date, '1970-01-01');
    const updated = [...main.querySelectorAll('p')].find(element => element.textContent?.startsWith('Last updated:'));
    if (updated) updated.textContent = `Last updated: ${new Date(latest).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    const hasMcp = rows.some(row => row.mcpScore !== undefined), hasSkills = rows.some(row => row.skillsScore !== undefined);
    radios[1].hidden = !hasMcp || framework !== 'Next.js'; radios[2].hidden = !hasSkills; modeWrapper.hidden = !hasMcp && !hasSkills;
    updateFade();
  };
  const selectMode = (next: Mode) => {
    if (mode === next) return;
    const before = indicator.getBoundingClientRect(); mode = next;
    radios.forEach(button => { const active = button.textContent?.trim().toLowerCase() === mode; button.className = active ? selectedClass : unselectedClass; button.setAttribute('aria-checked', String(active)); button.toggleAttribute('data-selected', active); button.tabIndex = active ? 0 : -1; if (active) button.prepend(indicator); });
    const after = indicator.getBoundingClientRect();
    const control = animate(indicator, { transform: [`translateX(${before.left - after.left}px) scaleX(${before.width / after.width})`, 'translateX(0px) scaleX(1)'] }, reduced ? { duration: 0 } : { type: 'spring', visualDuration: .15, bounce: 0 }); cleanups.push(() => control.stop());
    render();
  };
  const updateButton = (button: HTMLButtonElement, key: string, label: string, icon: string) => {
    button.querySelector('.react-aria-SelectValue')!.textContent = label;
    const iconHolder = button.firstElementChild!; iconHolder.querySelector('svg')?.remove(); iconHolder.insertAdjacentHTML('afterbegin', icon);
    const svg = iconHolder.querySelector('svg'); svg?.setAttribute('class', 'size-4 flex-none');
    const select = button.parentElement?.querySelector('select'); if (select) select.value = key;
  };
  const open = (trigger: HTMLButtonElement, kind: 'framework' | 'provider') => {
    closeMenu();
    const values = kind === 'framework' ? [...new Set(scoreData.map(row => row.framework))] : ['all', ...new Set(scoreData.filter(row => row.framework === framework).map(row => row.provider))];
    const current = kind === 'framework' ? framework : provider;
    const popover = document.createElement('div'); popover.className = 'ri-lb-popover'; popover.setAttribute('role', 'listbox'); popover.setAttribute('aria-label', trigger.getAttribute('aria-label') || 'Filter');
    const bounds = trigger.getBoundingClientRect(); Object.assign(popover.style, { left: `${Math.min(bounds.left, innerWidth - 188)}px`, top: `${bounds.bottom + 4}px` });
    const options = values.map(value => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ri-lb-option'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(value === current));
      button.setAttribute('aria-label', kind === 'framework' ? value : providerLabels[value]);
      const icon = kind === 'framework' ? frameworkIcons[value] || '' : icons[value] || '';
      button.innerHTML = icon + '<span></span>' + (value === current ? checkIcon : ''); button.querySelector('span')!.textContent = kind === 'framework' ? value : providerLabels[value]; button.querySelector('svg')?.setAttribute('class', 'size-4 flex-none');
      button.addEventListener('click', () => {
        if (kind === 'framework') { framework = value; provider = 'all'; if ((value === 'iOS' || value === 'Android') && mode === 'mcp') selectMode('base'); updateButton(frameworkButton, value, value, frameworkIcons[value] || ''); updateButton(providerButton, 'all', providerLabels.all, icons.all); }
        else { provider = value; updateButton(providerButton, value, providerLabels[value], icons[value] || ''); }
        render(); closeMenu(); trigger.focus();
      }, { signal }); popover.append(button); return button;
    });
    document.body.append(popover); trigger.setAttribute('aria-expanded', 'true'); options[values.indexOf(current)]?.focus();
    const outside = (event: PointerEvent) => { if (!popover.contains(event.target as Node) && !trigger.contains(event.target as Node)) closeMenu(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); trigger.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const current = options.indexOf(document.activeElement as HTMLButtonElement); options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus(); }
    };
    document.addEventListener('pointerdown', outside, { signal }); popover.addEventListener('keydown', keyboard, { signal });
    closeMenu = () => { popover.remove(); trigger.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outside); closeMenu = () => {}; };
  };
  frameworkButton.addEventListener('click', () => open(frameworkButton, 'framework'), { signal }); providerButton.addEventListener('click', () => open(providerButton, 'provider'), { signal });
  radios.forEach(button => button.addEventListener('click', () => selectMode(button.textContent!.trim().toLowerCase() as Mode), { signal }));
  radioGroup.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const visible = radios.filter(button => !button.hidden), current = visible.findIndex(button => button.getAttribute('aria-checked') === 'true'); const target = visible[event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length]; target.focus(); target.click(); }, { signal });
  const help = main.querySelector<HTMLButtonElement>('button[aria-label="What is MCP?"]');
  const hideTip = () => { tooltip?.remove(); tooltip = null; help?.removeAttribute('aria-describedby'); };
  const showTip = () => {
    hideTip(); if (!help) return; tooltip = document.createElement('div'); tooltip.id = 'ri-lb-help'; tooltip.className = 'ri-lb-tooltip'; tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML = '<p><strong>MCP</strong> connects to <a href="/docs/guides/ai/mcp/aurora-mcp-server">Aurora\'s MCP server</a> for real-time tool access.<br><strong>Skills</strong> loads <a href="/docs/guides/ai/skills">Aurora Skills</a> as on-demand documentation.</p><svg width="12" height="6" viewBox="0 0 12 6" aria-hidden="true"><path d="M0 0L6 6L12 0"/></svg>';
    document.body.append(tooltip); const bounds = help.getBoundingClientRect(); Object.assign(tooltip.style, { left: `${Math.max(8, Math.min(innerWidth - 264, bounds.left + bounds.width / 2 - 128))}px`, top: `${bounds.top - tooltip.offsetHeight - 6}px` }); help.setAttribute('aria-describedby', tooltip.id);
  };
  help?.addEventListener('pointerenter', showTip, { signal }); help?.addEventListener('pointerleave', hideTip, { signal }); help?.addEventListener('focus', showTip, { signal }); help?.addEventListener('blur', hideTip, { signal }); help?.addEventListener('click', () => tooltip ? hideTip() : showTip(), { signal });
  scroll?.addEventListener('scroll', updateFade, { signal }); window.addEventListener('resize', updateFade, { signal });
  return () => { abort.abort(); closeMenu(); hideTip(); cleanups.forEach(cleanup => cleanup()); };
}

// Glossary Navigation scroll margin 214px and native 200ms overflow fades: module-88c956df9ae59c74.js.
export function bindGlossary(main: HTMLElement) {
  const abort = new AbortController(), signal = abort.signal;
  const nav = main.querySelector('nav'), track = nav?.querySelector<HTMLElement>('.overflow-x-auto');
  const links = [...nav?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') || []];
  if (!track || !links.length) return () => {};
  const marker = nav?.querySelector<HTMLElement>('span.bg-purple') || document.createElement('span'); marker.className = 'bg-purple absolute inset-x-0 bottom-0 h-[2px]';
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const animations: { stop: () => void }[] = [];
  let active = links.find(link => link.dataset.active === 'true');
  const update = () => {
    let next = links[0]; sections.forEach((section, index) => { if (section && section.getBoundingClientRect().top < 214) next = links[index]; });
    if (next === active) return;
    const before = marker.getBoundingClientRect(); active = next; links.forEach(link => { link.dataset.active = String(link === active); }); active.parentElement!.append(marker);
    const after = marker.getBoundingClientRect(); animations.push(animate(marker, { transform: [`translateX(${before.left - after.left}px) scaleX(${before.width / Math.max(after.width, 1)})`, 'translateX(0px) scaleX(1)'] }, { duration: reduced ? 0 : .45, ease: [.4, 0, .1, 1] }));
  };
  const fades = () => {
    const container = track.parentElement!, left = container.querySelector<HTMLElement>('[class*="left-0"]'), right = container.querySelector<HTMLElement>('[class*="right-0"]');
    if (left) left.style.opacity = track.scrollLeft > 15 ? '1' : '0'; if (right) right.style.opacity = track.scrollLeft + track.clientWidth < track.scrollWidth - 15 ? '1' : '0';
  };
  window.addEventListener('scroll', update, { signal }); track.addEventListener('scroll', fades, { signal }); window.addEventListener('resize', fades, { signal });
  update(); fades();
  return () => { abort.abort(); animations.forEach(animation => animation.stop()); };
}
