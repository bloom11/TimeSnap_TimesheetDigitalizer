import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS prompt after a small delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col gap-3 sm:max-w-md sm:mx-auto">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Install TimeSnap</h3>
        <button onClick={() => setShowPrompt(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <X size={20} />
        </button>
      </div>
      
      {isIOS ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400 flex flex-col gap-2">
          <p>Install this app on your iPhone/iPad for offline access:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li className="flex items-center gap-2">Tap the <Share size={16} className="inline text-blue-500" /> Share button</li>
            <li className="flex items-center gap-2">Select <PlusSquare size={16} className="inline" /> "Add to Home Screen"</li>
          </ol>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Install this app for offline access and a better experience.</p>
          <button 
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            <Download size={18} />
            Install App
          </button>
        </div>
      )}
    </div>
  );
};
