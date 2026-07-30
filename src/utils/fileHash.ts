export async function calculateFileSha256(data: File | string | ArrayBuffer): Promise<string> {
  try {
    let buffer: ArrayBuffer;
    if (data instanceof File) {
      buffer = await data.arrayBuffer();
    } else if (typeof data === 'string') {
      const encoder = new TextEncoder();
      buffer = encoder.encode(data).buffer;
    } else {
      buffer = data;
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return `sha256-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}
