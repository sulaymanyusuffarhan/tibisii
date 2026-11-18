import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { NextRequest } from 'next/server';
import { getDb } from './db';

const execFileAsync = promisify(execFile);

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function validateSessionSecret(): void {
  const secret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32 || secret.startsWith('REPLACE_WITH'))) {
    throw new Error('SESSION_SECRET must be a unique, cryptographically random secret of at least 32 characters.');
  }
}

function secretEncryptionKey(): Buffer {
  validateSessionSecret();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32 || secret.startsWith('REPLACE_WITH')) {
    return crypto.createHash('sha256').update('TBC local-only MFA encryption key — never deploy').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith('enc:v1:')) throw new Error('Stored MFA secret is not encrypted. An administrator must reset MFA enrollment.');
  const [, , ivText, tagText, ciphertextText] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}

export function generateReferenceNumber(prefix = 'TBC-ENQ'): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

export function slugify(input: string): string {
  const clean = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return clean || `item-${crypto.randomBytes(3).toString('hex')}`;
}

export function getClientIp(req: NextRequest | Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim().slice(0, 64);
  return '127.0.0.1';
}

export function anonymizeVisitorSession(ip: string, userAgent: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = (process.env.SESSION_SECRET || 'tbc-local-salt').slice(0, 16);
  return sha256Hex(`${day}|${ip}|${userAgent.slice(0, 80)}|${salt}`).slice(0, 20);
}

// =============================================================================
// XSS PROTECTION: STRICT SERVER-SIDE HTML SANITIZER FOR RICH TEXT CONTENT
// =============================================================================
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'h4', 'h5', 'blockquote', 'hr',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'code', 'pre', 'span', 'div',
]);

export function sanitizeRichHtml(input: string): string {
  if (!input) return '';
  let html = String(input);

  // Remove dangerous block tags together with contents
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );
  // Remove self-closing or unclosed dangerous tags
  html = html.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)[^>]*>/gi,
    ''
  );
  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Filter remaining tags and sanitize attributes
  html = html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (full.startsWith('</')) return `</${tag}>`;

    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(rawAttrs)) !== null) {
      const attr = m[1].toLowerCase();
      const val = (m[2] ?? m[3] ?? m[4] ?? '').trim();
      if (attr.startsWith('on') || attr === 'style' || attr === 'srcdoc') continue;

      if (tag === 'a' && attr === 'href') {
        if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(val) && !/^javascript:/i.test(val)) {
          safeAttrs.push(`href="${escapeHtmlAttr(val)}"`);
          if (/^https?:\/\//i.test(val)) {
            safeAttrs.push('rel="noopener noreferrer"');
          }
        }
      } else if (tag === 'a' && attr === 'target' && val === '_blank') {
        safeAttrs.push('target="_blank"');
      } else if (tag === 'img' && attr === 'src') {
        if (/^(https?:\/\/|\/)/i.test(val) && !/^javascript:/i.test(val)) {
          safeAttrs.push(`src="${escapeHtmlAttr(val)}"`);
        }
      } else if (tag === 'img' && (attr === 'alt' || attr === 'title')) {
        safeAttrs.push(`${attr}="${escapeHtmlAttr(val)}"`);
      } else if ((tag === 'th' || tag === 'td') && (attr === 'colspan' || attr === 'rowspan' || attr === 'scope')) {
        if (/^[a-z0-9]{1,8}$/i.test(val)) {
          safeAttrs.push(`${attr}="${escapeHtmlAttr(val)}"`);
        }
      }
    }

    const selfClosing = tag === 'br' || tag === 'hr' || tag === 'img';
    const attrStr = safeAttrs.length ? ' ' + safeAttrs.join(' ') : '';
    return selfClosing ? `<${tag}${attrStr} />` : `<${tag}${attrStr}>`;
  });

  return html.trim();
}

export function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripPlainText(input: string, maxLen = 4000): string {
  return String(input || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLen);
}

// =============================================================================
// SECURE FILE UPLOAD VALIDATION (EXTENSION + MIME + MAGIC BYTES + SVG SANITIZER)
// =============================================================================
export interface AllowedFileSpec {
  ext: string;
  mimes: string[];
  mediaType: 'image' | 'video' | 'document';
  checkMagic: (buf: Buffer) => boolean;
}

const isZipContainer = (buf: Buffer) =>
  buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

export const ALLOWED_FILE_SPECS: Record<string, AllowedFileSpec> = {
  jpg: {
    ext: 'jpg',
    mimes: ['image/jpeg', 'image/jpg'],
    mediaType: 'image',
    checkMagic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  jpeg: {
    ext: 'jpeg',
    mimes: ['image/jpeg', 'image/jpg'],
    mediaType: 'image',
    checkMagic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  png: {
    ext: 'png',
    mimes: ['image/png'],
    mediaType: 'image',
    checkMagic: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  webp: {
    ext: 'webp',
    mimes: ['image/webp'],
    mediaType: 'image',
    checkMagic: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  svg: {
    ext: 'svg',
    mimes: ['image/svg+xml'],
    mediaType: 'image',
    checkMagic: (b) => {
      const text = b.toString('utf8', 0, Math.min(b.length, 65536));
      if (!/<svg[\s>]/i.test(text)) return false;
      // Reject scripts, event handlers, foreignObject, javascript: URIs, external entities
      if (/<script[\s>]|<foreignObject|<!ENTITY|on[a-z]+\s*=|javascript:|data:text\/html/i.test(text)) {
        return false;
      }
      return true;
    },
  },
  mp4: {
    ext: 'mp4',
    mimes: ['video/mp4'],
    mediaType: 'video',
    checkMagic: (b) => b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp',
  },
  pdf: {
    ext: 'pdf',
    mimes: ['application/pdf'],
    mediaType: 'document',
    checkMagic: (b) => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  docx: {
    ext: 'docx',
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
    ],
    mediaType: 'document',
    checkMagic: isZipContainer,
  },
  xlsx: {
    ext: 'xlsx',
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/octet-stream',
    ],
    mediaType: 'document',
    checkMagic: isZipContainer,
  },
  pptx: {
    ext: 'pptx',
    mimes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/octet-stream',
    ],
    mediaType: 'document',
    checkMagic: isZipContainer,
  },
};

export function validateUploadedFile(params: {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): {
  valid: boolean;
  error?: string;
  ext?: string;
  canonicalMime?: string;
  mediaType?: 'image' | 'video' | 'document';
  sanitizedBuffer?: Buffer;
} {
  const { originalName, mimeType, buffer } = params;
  const maxBytes = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 25) * 1024 * 1024;

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }
  if (buffer.length > maxBytes) {
    return {
      valid: false,
      error: `File exceeds the maximum permitted size of ${Number(process.env.MAX_UPLOAD_SIZE_MB) || 25} MB.`,
    };
  }

  // Block double extensions / null bytes / traversal
  if (originalName.includes('\0') || originalName.includes('..')) {
    return { valid: false, error: 'Invalid filename.' };
  }
  const dangerousDoubleExt = /\.(php|phtml|exe|sh|bat|cmd|js|mjs|cjs|html|htm|jsp|asp|aspx|py|rb|pl)\./i;
  if (dangerousDoubleExt.test(originalName)) {
    return { valid: false, error: 'Executable or script filenames are forbidden.' };
  }

  const parts = originalName.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const spec = ALLOWED_FILE_SPECS[ext];
  if (!spec) {
    return {
      valid: false,
      error: `Unsupported file type ".${ext || 'unknown'}". Allowed: JPG, JPEG, PNG, WebP, SVG, MP4, PDF, DOCX, XLSX, PPTX.`,
    };
  }

  const normalizedMime = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (normalizedMime && !spec.mimes.includes(normalizedMime)) {
    return {
      valid: false,
      error: `File MIME type "${normalizedMime}" does not match ".${ext}".`,
    };
  }

  if (!spec.checkMagic(buffer)) {
    return {
      valid: false,
      error: `File binary signature verification failed or unsafe content detected in ".${ext}" file.`,
    };
  }

  let sanitizedBuffer = buffer;
  if (ext === 'svg') {
    const svgText = buffer.toString('utf8');
    if (/<script|<foreignObject|<!ENTITY|on[a-z]+\s*=|javascript:|xlink:href\s*=\s*["']https?:/i.test(svgText)) {
      return { valid: false, error: 'SVG rejected by security policy (active or external content detected).' };
    }
    sanitizedBuffer = Buffer.from(svgText, 'utf8');
  }

  return {
    valid: true,
    ext: spec.ext,
    canonicalMime: spec.mimes[0],
    mediaType: spec.mediaType,
    sanitizedBuffer,
  };
}

export async function runOptionalMalwareScan(filePath: string): Promise<'clean' | 'validated_no_av' | 'rejected'> {
  const cmd = process.env.CLAMAV_COMMAND?.trim();
  if (!cmd) return 'validated_no_av';
  const [bin, ...args] = cmd.split(/\s+/);
  try {
    await execFileAsync(bin, [...args, filePath], { timeout: 30_000 });
    return 'clean';
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 1) return 'rejected'; // ClamAV exit code 1 = virus found
    return 'validated_no_av';
  }
}

// =============================================================================
// DATABASE-BACKED RATE LIMITER
// =============================================================================
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const db = await getDb();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const existing = await db.query<{ count: number; reset_at: string }>(
    'SELECT count, reset_at FROM rate_limits WHERE key = $1',
    [key]
  );

  if (existing.rows.length === 0 || new Date(existing.rows[0].reset_at) <= now) {
    await db.query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET count = 1, reset_at = $2`,
      [key, resetAt.toISOString()]
    );
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: windowSeconds };
  }

  const current = Number(existing.rows[0].count);
  const currentReset = new Date(existing.rows[0].reset_at);
  const retryAfterSeconds = Math.max(1, Math.ceil((currentReset.getTime() - now.getTime()) / 1000));

  if (current >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  await db.query('UPDATE rate_limits SET count = count + 1 WHERE key = $1', [key]);
  return { allowed: true, remaining: maxRequests - (current + 1), retryAfterSeconds };
}

// =============================================================================
// PASSWORD POLICY VALIDATOR
// =============================================================================
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long.' };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character.' };
  }
  return { valid: true };
}

// =============================================================================
// RFC 6238 TOTP MULTI-FACTOR AUTHENTICATION (ZERO EXTERNAL DEPENDENCIES)
// =============================================================================
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function computeTotpCode(secret: string, counterStep?: number): string {
  const step = counterStep ?? Math.floor(Date.now() / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(step));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const nowStep = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    const expected = computeTotpCode(secret, nowStep + offset);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('TBC Corporate CMS');
  const label = encodeURIComponent(`TBC Corporate CMS:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 6): string[] {
  return Array.from({ length: count }, () =>
    `${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
  );
}
