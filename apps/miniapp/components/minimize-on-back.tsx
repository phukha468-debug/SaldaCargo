'use client';

import { useEffect } from 'react';

/**
 * MinimizeOnBack
 *
 * Intercepting the hardware back button (Android) and swipe-back (iOS) so the
 * app minimizes instead of closing when the user reaches the history root.
 *
 * Strategy (History API barrier):
 *   1. replaceState marks the very first history entry as our "barrier"
 *   2. pushState adds a clean entry above it — this is where the app lives
 *   3. popstate handler: if we popped to the barrier → call minimize SDK,
 *      then push a fresh entry to keep the barrier accessible for next time
 *
 * Next.js Router pushes its own states on navigation; those don't have the
 * barrier marker, so normal in-app back navigation is unaffected.
 *
 * Platform SDK priority:
 *   1. window.Telegram.WebApp.minimize()  — Telegram / MAX if they mirror TG API
 *   2. window.max.minimize()              — MAX native SDK (add when docs arrive)
 *   3. postMessage to parent frame        — generic WebView containers
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        minimize?: () => void;
        close?: () => void;
        enableClosingConfirmation?: () => void;
      };
    };
    // MAX messenger SDK (placeholder — update when official docs available)
    max?: {
      minimize?: () => void;
      close?: () => void;
    };
  }
}

const BARRIER_KEY = '_salda_back_barrier';

function callMinimize() {
  // 1. Telegram / MAX (if they expose Telegram-compatible API)
  const tg = window.Telegram?.WebApp;
  if (tg?.minimize) {
    tg.minimize();
    return;
  }

  // 2. MAX native SDK
  if (window.max?.minimize) {
    window.max.minimize();
    return;
  }

  // 3. postMessage — some mini-app containers listen for this
  try {
    window.parent?.postMessage(JSON.stringify({ type: 'minimize_app' }), '*');
    // Also try the Telegram Web App event format
    window.parent?.postMessage(JSON.stringify({ eventType: 'web_app_minimize' }), '*');
  } catch {
    // Swallow — we're in a sandboxed context
  }
}

export function MinimizeOnBack() {
  useEffect(() => {
    // Mark the initial history entry as our barrier
    // (replaceState = no new entry, just tags what's already there)
    try {
      history.replaceState({ [BARRIER_KEY]: true }, '');
    } catch {
      return; // SSR guard or restricted environment
    }

    // Push a clean entry for the actual app content to live on
    history.pushState({ [BARRIER_KEY]: false }, '');

    function onPopState(e: PopStateEvent) {
      if (e.state?.[BARRIER_KEY] === true) {
        // User navigated back past the app root — minimize instead of closing
        callMinimize();

        // Restore a clean entry so the barrier stays accessible on next back press
        history.pushState({ [BARRIER_KEY]: false }, '');
      }
      // For all other popstate events (normal Next.js navigation), do nothing
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return null;
}
