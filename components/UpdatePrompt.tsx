import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, ExternalLink, X } from 'lucide-react';

// IMPORTANT: To make this future-proof, replace this URL with a permanent link 
// to a raw JSON file (e.g., a GitHub Gist or a dedicated domain) that you will NEVER delete.
// For now, it points to the local config.json.
const REMOTE_CONFIG_URL = import.meta.env.BASE_URL + 'config.json';

export const UpdatePrompt: React.FC = () => {
  // 1. PWA Update Logic (Standard Updates)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered');
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // 2. Remote Migration Logic (Repo/URL Changes)
  const [migrationUrl, setMigrationUrl] = useState<string | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [dismissedMigration, setDismissedMigration] = useState(false);

  useEffect(() => {
    const checkRemoteConfig = async () => {
      try {
        // Fetch the config file
        const res = await fetch(REMOTE_CONFIG_URL + '?t=' + new Date().getTime()); // Cache buster
        if (!res.ok) return;
        const config = await res.json();
        
        // Get the current URL without query parameters or hash
        const currentUrl = window.location.origin + window.location.pathname;
        
        // If an official URL is defined and we are not on it, prompt migration
        if (config.officialUrl && !currentUrl.startsWith(config.officialUrl)) {
            setMigrationUrl(config.officialUrl);
            setMigrationMessage(config.message || "TimeSnap has moved to a new home! Please visit the new link to continue getting updates.");
        }
      } catch (e) {
        console.error("Failed to fetch remote config", e);
      }
    };

    checkRemoteConfig();
  }, []);

  // Show PWA Update Prompt
  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-blue-100 dark:border-slate-700 p-4 z-[100] animate-fade-in flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
            <RefreshCw className="w-5 h-5" />
            <span>Update Available</span>
          </div>
          <button onClick={() => setNeedRefresh(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A new version of TimeSnap is ready. Update now to get the latest features and fixes.
        </p>
        <div className="flex gap-2 mt-1">
          <button 
            onClick={() => updateServiceWorker(true)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-bold transition-colors"
          >
            Update Now
          </button>
          <button 
            onClick={() => setNeedRefresh(false)}
            className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // Show Migration Prompt
  if (migrationUrl && !dismissedMigration) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/50 p-4 z-[100] animate-fade-in flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold">
            <ExternalLink className="w-5 h-5" />
            <span>App Relocated</span>
          </div>
          <button onClick={() => setDismissedMigration(true)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {migrationMessage}
        </p>
        <div className="flex gap-2 mt-1">
          <a 
            href={migrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-bold transition-colors text-center"
          >
            Go to New Site
          </a>
          <button 
            onClick={() => setDismissedMigration(true)}
            className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
};
