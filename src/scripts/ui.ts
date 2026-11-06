// Small progressive enhancements for the static page. Everything works without them.

const root = document.documentElement;

// Theme toggle. The saved theme is applied before paint by an inline script in Base.astro.
document.querySelectorAll('[data-theme-toggle]').forEach((button) =>
  button.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }),
);

// Mobile menu.
const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-button]');
const menu = document.getElementById('mobile-menu');
if (menuButton && menu) {
  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => setOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

// Highlight the nav link for the section in the middle of the screen.
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of navLinks) {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    }
  },
  { rootMargin: '-45% 0px -50% 0px' },
);
document.querySelectorAll('main > section[id]').forEach((section) => spy.observe(section));

export {};
