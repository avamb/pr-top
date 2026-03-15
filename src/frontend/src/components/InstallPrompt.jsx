import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * InstallPrompt - Shows a banner suggesting the user install the PWA.
 * Listens for the `beforeinstallprompt` event and provides Install/Dismiss buttons.
 */
function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [swUpdated, setSwUpdated] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
    }

    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleSwUpdate = () => {
      setSwUpdated(true);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('sw-updated', handleSwUpdate);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('sw-updated', handleSwUpdate);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleReload = () => {
    window.location.reload();
  };

  // SW update banner
  if (swUpdated) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-teal-600 text-white rounded-lg shadow-lg p-4 z-50 flex items-center gap-3">
        <span className="text-lg">🔄</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t('pwa.updateAvailable')}</p>
        </div>
        <button
          onClick={handleReload}
          className="px-3 py-1.5 bg-white text-teal-700 rounded text-sm font-medium hover:bg-teal-50 flex-shrink-0"
        >
          {t('pwa.reload')}
        </button>
      </div>
    );
  }

  // Install prompt banner
  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-stone-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800">{t('pwa.installTitle')}</p>
          <p className="text-xs text-stone-500 mt-0.5">{t('pwa.installDesc')}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-stone-500 hover:text-stone-700 text-sm"
        >
          {t('pwa.notNow')}
        </button>
        <button
          onClick={handleInstall}
          className="px-4 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700"
        >
          {t('pwa.install')}
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
