/**
 * Vortex MCP Specification - JSON Canonicalization Scheme (RFC 8785 - JCS)
 * 
 * Normative requirement:
 * Canonicalization must yield byte-for-byte identical UTF-8 representations
 * across TypeScript, Go, Rust, Java, and Python.
 * 
 * Flow:
 * Object -> JCS (RFC 8785) -> SHA-256 / Ed25519
 */

export function canonicalize(obj: unknown): string {
  if (obj === null) {
    return 'null';
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const values = obj.map((item) => (item === undefined ? 'null' : canonicalize(item)));
    return `[${values.join(',')}]`;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    // RFC 8785: Object keys MUST be sorted by UTF-16 code unit order
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const parts = keys.map((key) => {
      const formattedKey = JSON.stringify(key);
      const formattedValue = canonicalize(record[key]);
      return `${formattedKey}:${formattedValue}`;
    });

    return `{${parts.join(',')}}`;
  }

  return 'null';
}

export const canonicalizeRFC8785 = canonicalize;
