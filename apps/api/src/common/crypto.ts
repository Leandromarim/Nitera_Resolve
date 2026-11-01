import { createHash, createHmac, randomBytes } from 'crypto';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
/** Hash com pepper — usado para IPs (LGPD) e tokens persistidos. */
export const pepperHash = (v: string) => createHmac('sha256', process.env.HASH_PEPPER ?? '').update(v).digest('hex');
