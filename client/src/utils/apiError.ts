/**
 * Extract an error message from an Axios-style error response.
 *
 * Handles the API's standard shape (`response.data.error.message`)
 * and the fallback shape (`response.data.message`).
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (
      err as { response?: { data?: { error?: { message?: string }; message?: string } } }
    ).response?.data;
    return data?.error?.message || data?.message || fallback;
  }
  return fallback;
}
