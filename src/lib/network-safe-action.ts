// Wrap a server action so a NETWORK-level failure (offline, a timed-out or
// aborted request, a dropped connection) becomes a normal error result the UI
// can show — instead of an unhandled promise rejection that trips the global
// error monitor as "Load failed" / "Failed to fetch" and, for a form action,
// can surface the page's error boundary.
//
// A server action that returns an { error } object is untouched; only a thrown
// transport error is caught here. Business-logic errors still flow through as
// the action intends.

export const NETWORK_ERROR_MESSAGE = "Couldn't reach the server — check your connection and try again.";

// For `useActionState`: wrap the action so a transport failure resolves to an
// error state (built from the current state) rather than rejecting.
export function networkSafeAction<S, A extends unknown[]>(
  action: (state: S, ...args: A) => Promise<S>,
  onNetworkError: (state: S) => S,
): (state: S, ...args: A) => Promise<S> {
  return async (state, ...args) => {
    try {
      return await action(state, ...args);
    } catch {
      return onNetworkError(state);
    }
  };
}
