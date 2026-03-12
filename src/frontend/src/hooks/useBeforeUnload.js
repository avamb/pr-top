import { useEffect } from 'react';

/**
 * Hook that warns users before leaving a page with unsaved changes.
 * Shows the browser's native "Are you sure you want to leave?" dialog.
 *
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 */
export default function useBeforeUnload(hasUnsavedChanges) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}
