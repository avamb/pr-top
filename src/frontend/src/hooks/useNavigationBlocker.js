import { useEffect } from 'react';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

/**
 * Hook that blocks SPA navigation (via context) and browser unload
 * when there are unsaved changes.
 *
 * For SPA navigation: sets a flag in UnsavedChangesContext that the Sidebar
 * and other navigation components check before calling navigate().
 *
 * For browser refresh/close: adds a beforeunload event listener.
 *
 * @param {boolean} shouldBlock - Whether navigation should be blocked
 */
export default function useNavigationBlocker(shouldBlock) {
  var ctx = useUnsavedChanges();

  // Sync local dirty state to context
  useEffect(function() {
    ctx.setHasUnsavedChanges(shouldBlock);
    return function() {
      ctx.setHasUnsavedChanges(false);
    };
  }, [shouldBlock]);

  // Also block browser refresh/close (beforeunload)
  useEffect(function() {
    if (!shouldBlock) return;

    var handler = function(e) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return function() {
      window.removeEventListener('beforeunload', handler);
    };
  }, [shouldBlock]);
}
