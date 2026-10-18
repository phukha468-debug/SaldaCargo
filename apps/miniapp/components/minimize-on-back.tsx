'use client';

import { useEffect } from 'react';

/**
 * MinimizeOnBack
 *
 * Prevents the app from closing when the user presses Back on the root page.
 * MAX SDK (window.WebApp) does NOT have a minimize() method, so we use two
 * complementary strategies:
 *
 * 1. window.WebApp.BackButton — MAX native back button (appears in the MAX header).
 *    When shown, it intercepts BOTH the header button AND the Android hardware back.
 *    We show it on root pages and handle its onClick to do nothing (app stays open).
 *    On inner pages Next.js handles navigation normally via router — BackButton hidden.
 *
 * 2. History API barrier — fallback for environments where BackButton is unavailable.
 *    replaceState tags the initial entry as "barrier"; pushState adds an entry above it.
 *    popstate: if we popped to the barrier → re-push to keep app alive.
 *
 * 3. window.WebApp.enableClosingConfirmation() — shows a native dialog when the user
 *    taps the ✕ button in the MAX header, preventing accidental full close.
 *
 * MAX SDK reference: https://dev.max.ru/docs/webapps/bridge
 *   window.WebApp.BackButton.show()
 *   window.WebApp.BackButton.hide()
 *   window.WebApp.BackButton.onClick(cb)
 *   window.WebApp.BackButton.offClick(cb)
 *   window.WebApp.BackButton.isVisible
 *   window.WebApp.enableClosingConfirmation()
 *   window.WebApp.disableClosingConfirmation()
 */

declare global {
  interface Window {
    WebApp?: {
      ready?: () => void;
      BackButton?: {
        isVisible: boolean;
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
      };
      enableClosingConfirmation?: () => void;
      disableClosingConfirmation?: () => void;
      platform?: string;
      version?: string;
    };
  }
}

const BARRIER_KEY = '_salda_back_barrier';

// Root paths where back press should NOT navigate away (keep app open instead)
const ROOT_PATHS = new Set(['/', '/driver', '/admin', '/mechanic', '/login']);

function isRootPath(pathname: string): boolean {
  return ROOT_PATHS.has(pathname);
}

export function MinimizeOnBack() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const WebApp = window.WebApp;

      // ── Уведомляем MAX о готовности приложения ───────────────────────────
      try {
        WebApp?.ready?.();
      } catch {
        // Not supported — silently skip
      }

      // ── Closing confirmation (handles the ✕ button in MAX header) ──────────
      try {
        WebApp?.enableClosingConfirmation?.();
      } catch {
        // Not supported — silently skip
      }

      // ── History API barrier ONLY on root pages to prevent app closing ─────
      function ensureBarrierOnRoot() {
        try {
          if (isRootPath(window.location.pathname)) {
            if (window.history && window.history.replaceState && window.history.pushState) {
              window.history.replaceState({ [BARRIER_KEY]: true }, '', window.location.href);
              window.history.pushState({ [BARRIER_KEY]: false }, '', window.location.href);
            }
          }
        } catch {
          // ignore
        }
      }

      ensureBarrierOnRoot();

      function onPopState(e: PopStateEvent) {
        try {
          // Only intercept and bounce back if we are on a root page
          if (
            isRootPath(window.location.pathname) &&
            e.state?.[BARRIER_KEY] === true &&
            window.history?.pushState
          ) {
            window.history.pushState({ [BARRIER_KEY]: false }, '', window.location.href);
          }
        } catch {
          // ignore
        }
      }

      window.addEventListener('popstate', onPopState);

      // ── MAX BackButton: show on inner pages, hide on root pages ───────────
      let backButton:
        | {
            isVisible: boolean;
            show: () => void;
            hide: () => void;
            onClick: (callback: () => void) => void;
            offClick: (callback: () => void) => void;
          }
        | undefined = undefined;
      try {
        backButton = WebApp?.BackButton;
      } catch {
        backButton = undefined;
      }

      function handleBackButtonClick() {
        try {
          const current = window.location.pathname;
          if (!isRootPath(current)) {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              // Smart fallback navigation
              if (current.startsWith('/trip/')) {
                window.location.href = '/driver';
              } else if (current.startsWith('/admin/')) {
                window.location.href = '/admin';
              } else if (current.startsWith('/mechanic/')) {
                window.location.href = '/mechanic';
              } else {
                window.location.href = '/';
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (backButton) {
        try {
          backButton.onClick?.(handleBackButtonClick);
          if (isRootPath(window.location.pathname)) {
            backButton.hide?.();
          } else {
            backButton.show?.();
          }
        } catch {
          // ignore
        }
      }

      // Watch for URL changes (Next.js App Router navigation) to toggle BackButton
      let lastPathname = window.location.pathname;

      function onLocationChange() {
        try {
          const current = window.location.pathname;
          if (current === lastPathname) return;
          lastPathname = current;

          if (isRootPath(current)) {
            ensureBarrierOnRoot();
            if (backButton?.isVisible) backButton.hide?.();
          } else {
            if (backButton && !backButton.isVisible) backButton.show?.();
          }
        } catch {
          // ignore
        }
      }

      window.addEventListener('popstate', onLocationChange);
      const pollInterval = setInterval(onLocationChange, 300);

      return () => {
        try {
          window.removeEventListener('popstate', onPopState);
          window.removeEventListener('popstate', onLocationChange);
          clearInterval(pollInterval);
          backButton?.offClick?.(handleBackButtonClick);
          WebApp?.disableClosingConfirmation?.();
        } catch {
          // ignore
        }
      };
    } catch (rootErr) {
      console.warn('MinimizeOnBack initialization safely ignored:', rootErr);
    }
  }, []);

  return null;
}
