'use client';

import { useEffect } from 'react';

/** Scrolls focused inputs into view so the virtual keyboard never covers them. */
export function ScrollOnFocus() {
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    };
    document.addEventListener('focusin', handler);
    return () => document.removeEventListener('focusin', handler);
  }, []);

  return null;
}
