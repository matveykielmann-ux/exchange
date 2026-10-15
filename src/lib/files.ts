/** Reads a chosen file as base64 (without the data: prefix) for a JSON upload. */
export function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new Error('The file could not be read. Choose it again.'));
    r.readAsDataURL(file);
  });
}

/** A browser URL for a downloaded file, to show an image or open a PDF. Revoke it when done. */
export function base64ObjectUrl(dataBase64: string, contentType: string): string {
  const bin = atob(dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}

export const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
