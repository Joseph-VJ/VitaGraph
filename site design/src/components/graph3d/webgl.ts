// WebGL2 support check with context release and session cache.

let cachedResult: boolean | null = null;

export function hasWebGL2(): boolean {
  if (cachedResult !== null) {
    return cachedResult;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    cachedResult = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const available = Boolean(gl);
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) {
        ext.loseContext();
      }
    }
    cachedResult = available;
    return available;
  } catch {
    cachedResult = false;
    return false;
  }
}
