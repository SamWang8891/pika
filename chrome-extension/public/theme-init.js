// Same rule as theme.tsx (override wins, else OS), so there's no light flash before React mounts.
document.documentElement.dataset.theme = document.documentElement.style.colorScheme =
  localStorage.getItem('pika-theme-override') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
