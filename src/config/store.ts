import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';

const SERVICE = 'db2md';
const ALGORITHM = 'aes-256-gcm';

export function getConfigDir(): string {
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Preferences', SERVICE);
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? home, SERVICE);
  return path.join(home, '.config', SERVICE);
}

function getMachineKey(): Buffer {
  const seed = `${os.hostname()}:${os.userInfo().username}:${SERVICE}`;
  return crypto.createHash('sha256').update(seed).digest();
}

export function setSecret(key: string, value: string): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'secrets.json');
  const secrets = loadRaw(p);
  secrets[key] = encrypt(value);
  fs.writeFileSync(p, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

export function getSecret(key: string): string | null {
  const p = path.join(getConfigDir(), 'secrets.json');
  const enc = loadRaw(p)[key];
  if (!enc) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

export function deleteSecret(key: string): void {
  const p = path.join(getConfigDir(), 'secrets.json');
  const secrets = loadRaw(p);
  delete secrets[key];
  fs.writeFileSync(p, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

export function clearAll(): void {
  const p = path.join(getConfigDir(), 'secrets.json');
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function storedKeys(): string[] {
  return Object.keys(loadRaw(path.join(getConfigDir(), 'secrets.json')));
}

function loadRaw(p: string): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getMachineKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = (cipher as crypto.CipherGCM).getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(encoded: string): string {
  const [ivHex, tagHex, encHex] = encoded.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getMachineKey(), Buffer.from(ivHex, 'hex'));
  (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
