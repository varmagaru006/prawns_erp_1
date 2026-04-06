/**
 * Format API error for display. Use in catch blocks so toasts show why the request failed.
 * @param {Error} error - axios error or similar
 * @returns {string} - Short reason, e.g. "Network Error", "401", "500"
 */
export function getApiErrorReason(error) {
  if (!error) return '';
  if (error.response?.status) return `${error.response.status}`;
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') return 'Network Error';
  if (error.message) return error.message.slice(0, 50);
  return '';
}

/**
 * Build toast message: "Failed to load X (reason)" so user can tell if it's backend/network/auth.
 */
export function formatLoadErrorMessage(fallbackMessage, error) {
  const reason = getApiErrorReason(error);
  return reason ? `${fallbackMessage} (${reason})` : fallbackMessage;
}
