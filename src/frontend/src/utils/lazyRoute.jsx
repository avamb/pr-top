import React, { Suspense } from 'react';
import RouteFallback from '../components/RouteFallback';
import { isChunkLoadError, reloadOnceForChunkError } from './chunkReload';

/**
 * lazyRoute(loader) - React.lazy with a synchronous fast path and its own
 * <Suspense> boundary.
 *
 * Route components are code-split (H14). Two requirements pull in opposite
 * directions:
 *
 *  1. Hydration of a prerendered page must see the real page on the very first
 *     render. A plain React.lazy component throws a promise on first render
 *     even when its chunk is already in memory, and a <Suspense> boundary in
 *     the tree makes React expect `<!--$-->` markers in the server HTML that a
 *     browser-rendered snapshot does not have. Either way hydration fails with
 *     errors #418/#423/#425 and the whole page is re-rendered on the client.
 *  2. Client-side navigation to a page whose chunk is not loaded yet needs a
 *     Suspense boundary with a fallback.
 *
 * So the wrapper remembers the resolved component and, once `.preload()` has
 * been awaited (main.jsx does that for the current URL before hydrating),
 * renders it directly with NO Suspense boundary in the tree. Only while the
 * chunk is still missing does it render <Suspense><Lazy/></Suspense>.
 *
 * @param {() => Promise<{default: React.ComponentType<any>}>} loader dynamic import
 * @param {{fallback?: React.ReactNode}} [options] Suspense fallback (default: spinner)
 */
export function lazyRoute(loader, { fallback } = {}) {
  let Resolved = null;
  let promise = null;

  const load = () => {
    if (!promise) {
      promise = loader().then((mod) => {
        Resolved = mod.default;
        return mod;
      }).catch((err) => {
        // A stale chunk (deploy happened while this tab was open): reload once
        // to pick up the new build. The returned promise never settles, so
        // nothing flashes an error while the page reloads.
        if (isChunkLoadError(err) && reloadOnceForChunkError()) {
          return new Promise(() => {});
        }
        // Allow a retry through preload()/load() (e.g. flaky network). NOTE:
        // React.lazy caches the rejection for this <Lazy> instance, so a
        // render-time failure surfaces in the top-level ErrorBoundary, whose
        // Reload button is the retry.
        promise = null;
        throw err;
      });
    }
    return promise;
  };

  const Lazy = React.lazy(load);
  const suspenseFallback = fallback === undefined ? <RouteFallback /> : fallback;

  function LazyRoute(props) {
    if (Resolved) return <Resolved {...props} />;
    return (
      <Suspense fallback={suspenseFallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  LazyRoute.preload = load;
  return LazyRoute;
}

export default lazyRoute;
