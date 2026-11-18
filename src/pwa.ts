/**
 * Install as an app: the browser's install prompt where there is one (Android, desktop
 * Chrome and Edge), instructions on iPhone and iPad, and a service worker so the game
 * opens offline once installed.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export let installPrompt: InstallPrompt | null = null;

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOSInstallable = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone();

export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
    window.dispatchEvent(new Event('pale-lamps-installable'));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event('pale-lamps-installable'));
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}

export async function runInstall(): Promise<void> {
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    window.dispatchEvent(new Event('pale-lamps-installable'));
    return;
  }
  if (isIOSInstallable()) alert('To install on iPhone or iPad: tap the Share button in Safari, then "Add to Home Screen".');
}
