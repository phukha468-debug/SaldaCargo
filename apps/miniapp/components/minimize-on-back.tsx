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
    const WebApp = window.WebApp;

    // ── Closing confirmation (handles the ✕ button in MAX header) ──────────
    try {
      WebApp?.enableClosingConfirmation?.();
    } catch {
      // Not supported — silently skip
    }

    // ── History API barrier (hardware back / environments without BackButton) ─
    try {
      history.replaceState({ [BARRIER_KEY]: true }, '');
    } catch {
      return; // SSR guard or restricted environment
    }

    // Push a clean entry for the app to live on; barrier is below it
    history.pushState({ [BARRIER_KEY]: false }, '');

    function onPopState(e: PopStateEvent) {
      if (e.state?.[BARRIER_KEY] === true) {
        // User hit the barrier — re-push a clean entry so the app stays alive
        // (there is no SDK minimize in MAX, so we just keep the app open at root)
        history.pushState({ [BARRIER_KEY]: false }, '');
      }
    }

    window.addEventListener('popstate', onPopState);

    // ── MAX BackButton: intercept header back button on root pages ────────────
    const backButton = WebApp?.BackButton;

    function handleBackButtonClick() {
      if (isRootPath(window.location.pathname)) {
        // On root — do nothing; app stays open (no SDK minimize available)
        // The History API barrier also ensures hardware back doesn't close the app
      } else {
        // On inner pages — navigate back within the app
        history.back();
      }
    }

    if (backButton) {
      backButton.onClick(handleBackButtonClick);

      // Show BackButton on root pages (routes the hardware back button through MAX SDK)
      // Visibility will be updated on each navigation via the route-aware hook below
      if (isRootPath(window.location.pathname)) {
        backButton.show();
      }
    }

    // Watch for URL changes (Next.js App Router navigation) to toggle BackButton
    let lastPathname = window.location.pathname;

    function onLocationChange() {
      const current = window.location.pathname;
      if (current === lastPathname) return;
      lastPathname = current;

      if (!backButton) return;

      if (isRootPath(current)) {
        // On root pages: show BackButton so MAX routes hardware back through our handler
        if (!backButton.isVisible) backButton.show();
      } else {
        // On inner pages: hide BackButton so Next.js router handles navigation
        if (backButton.isVisible) backButton.hide();
      }
    }

    // Next.js App Router doesn't fire popstate on push — observe via MutationObserver
    // on the URL, or use the popstate event (fires on back/forward, not push).
    // We combine popstate + a periodic check as the simplest cross-version approach.
    window.addEventListener('popstate', onLocationChange);

    // Poll for pushState-based navigation (Next.js link clicks)
    const pollInterval = setInterval(onLocationChange, 300);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('popstate', onLocationChange);
      clearInterval(pollInterval);
      backButton?.offClick(handleBackButtonClick);
      // Restore closing without confirmation on unmount (component teardown)
      try {
        WebApp?.disableClosingConfirmation?.();
      } catch {
        // ignore
      }
    };
  }, []);

  return null;
}
