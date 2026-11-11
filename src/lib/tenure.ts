// Formats a role's dates ("2026-06" to "2026-11") for display.

const toIndex = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number);
  return year * 12 + (month - 1);
};

const monthName = (index: number) =>
  new Date(Date.UTC(Math.floor(index / 12), index % 12)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });

const monthYear = (index: number) => `${monthName(index)} ${Math.floor(index / 12)}`;

/**
 * Date range, length and month ticks for a role. Without an end date the role runs
 * to `now`, which is the build date (the site rebuilds on every publish).
 */
export function describeTenure(start: string, end: string | undefined, now = new Date()) {
  const from = toIndex(start);
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const to = end ? toIndex(end) : current;
  const months = Math.max(1, to - from + 1);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const duration = [years && `${years} yr${years > 1 ? 's' : ''}`, rest && `${rest} mo${rest > 1 ? 's' : ''}`].filter(Boolean).join(' ');
  // At most ~12 ticks, so long roles stay readable.
  const step = Math.ceil(months / 12);
  const ticks = Array.from({ length: Math.ceil(months / step) }, (_, i) => monthName(from + i * step));
  return {
    range: `${monthYear(from)} – ${end ? monthYear(to) : 'Present'}`,
    duration,
    ongoing: !end || to >= current,
    ticks,
  };
}
