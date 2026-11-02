/**
 * Creates an icon resolver that loads icons over HTTP.
 *
 * This resolver is intended for browser environments only and relies on
 * browser APIs such as `fetch` and `FileReader`.
 *
 * @param baseUrl Base URL where icon assets are served.
 */

export function makeFetchIconResolver(baseUrl = '/assets') {
  if (typeof FileReader === 'undefined') {
    throw new Error(
      'makeFetchIconResolver is only supported in browser environments.'
    );
  }
  const cache = new Map<string, string>();
  return async function (relativePath: string): Promise<string | null> {
    if (cache.has(relativePath)) return cache.get(relativePath)!;
    const resp = await fetch(`${baseUrl}/${relativePath}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        cache.set(relativePath, result);
        resolve(result);
      };

      reader.onerror = () => {
        reject(reader.error ?? new Error(`Failed to read "${relativePath}"`));
      };

      reader.onabort = () => {
        reject(new Error(`Reading "${relativePath}" was aborted`));
      };

      reader.readAsDataURL(blob);
    });
  };
}
