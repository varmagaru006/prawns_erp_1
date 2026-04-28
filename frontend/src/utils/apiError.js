export function isRequestCanceled(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError';
}

export function getApiErrorReason(error) {
  if (!error) return '';
  if (error.response?.status) return `${error.response.status}`;
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') return 'Network Error';
  if (error.message) return error.message.slice(0, 50);
  return '';
}

export function formatLoadErrorMessage(fallbackMessage, error) {
  const reason = getApiErrorReason(error);
  return reason ? `${fallbackMessage} (${reason})` : fallbackMessage;
}
