export async function readJson<T>(result: Response): Promise<T> {
  if (result.ok) return result.json() as Promise<T>;
  const body = await result.json().catch(() => null);
  throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${result.status}).`);
}

export function getJson<T>(url: string, signal?: AbortSignal) {
  return fetch(url, { signal }).then((response) => readJson<T>(response));
}

export async function downloadTextFile(response: Response, filename: string) {
  if (!response.ok) await readJson(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
