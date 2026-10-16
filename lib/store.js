// 저장소: Upstash Redis (REST API, 추가 패키지 없음).
// 환경변수가 없으면 테스트용 메모리 저장소를 써요.
import crypto from 'crypto';
import { SEED_PRODUCTS, SEED_PARTNERS, DEFAULT_SETTINGS } from '../data/seed.js';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const P = 'dcat:'; // 이 사이트 데이터 이름표 (다른 사이트와 섞이지 않게)

const mem = globalThis.__dcatMem || (globalThis.__dcatMem = new Map());
export const usingMemory = !URL_ || !TOKEN || process.env.MEMORY_STORE === '1';

async function cmd(...args) {
  if (usingMemory) {
    const [c, k, v, ...rest] = args;
    const now = Date.now();
    const live = (key) => { const e = mem.get(key); if (e && e.exp && e.exp < now) { mem.delete(key); return null; } return e; };
    switch (c) {
      case 'GET': { const e = live(k); return e ? e.v : null; }
      case 'SET': { const exp = rest[0] === 'EX' ? now + Number(rest[1]) * 1000 : 0; mem.set(k, { v: String(v), exp }); return 'OK'; }
      case 'DEL': return mem.delete(k) ? 1 : 0;
      case 'INCR': { const e = live(k); const n = (e ? Number(e.v) : 0) + 1; mem.set(k, { v: String(n), exp: e ? e.exp : 0 }); return n; }
      case 'EXPIRE': { const e = live(k); if (e) e.exp = now + Number(v) * 1000; return e ? 1 : 0; }
      default: throw new Error('mem: ' + c);
    }
  }
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('저장소 오류: ' + (j.error || r.status));
  return j.result;
}

async function getJSON(key, fallback) {
  const v = await cmd('GET', P + key);
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}
const setJSON = (key, val) => cmd('SET', P + key, JSON.stringify(val));

// ---------- 상품 / 파트너 / 설정 ----------
export async function getProducts() {
  const v = await getJSON('products', null);
  if (v) return v;
  await setJSON('products', SEED_PRODUCTS); // 처음 한 번: 기존 카탈로그 상품을 그대로 넣어요
  return SEED_PRODUCTS;
}
export const saveProducts = (list) => setJSON('products', list);

export async function getPartners() {
  const v = await getJSON('partners', null);
  if (v) return v;
  await setJSON('partners', SEED_PARTNERS);
  return SEED_PARTNERS;
}
export const savePartners = (list) => setJSON('partners', list);

export async function getSettings() {
  let s = await getJSON('settings', null);
  if (!s) {
    s = { ...DEFAULT_SETTINGS, salt: crypto.randomBytes(12).toString('hex') };
    await setJSON('settings', s);
  }
  return { ...DEFAULT_SETTINGS, ...s };
}
export const saveSettings = (s) => setJSON('settings', s);

// ---------- 사진 ----------
export const putImage = (id, b64, type) => cmd('SET', P + 'img:' + id, type + '|' + b64);
export async function getImage(id) {
  const v = await cmd('GET', P + 'img:' + id);
  if (!v) return null;
  const i = v.indexOf('|');
  return { type: v.slice(0, i), data: Buffer.from(v.slice(i + 1), 'base64') };
}
export const delImage = (id) => cmd('DEL', P + 'img:' + id);

// ---------- 관리자 PIN ----------
const hash = (s) => crypto.createHash('sha256').update('dcat-pin:' + s).digest('hex');

export async function checkPin(pin, ip) {
  const failKey = P + 'fail:' + ip;
  const fails = Number((await cmd('GET', failKey)) || 0);
  if (fails >= 10) return { ok: false, locked: true };
  const stored = await cmd('GET', P + 'pin');
  const envPin = process.env.OWNER_PIN || '';
  const ok = !!pin && (stored ? hash(String(pin)) === stored : (envPin && String(pin) === envPin));
  if (!ok) {
    const n = await cmd('INCR', failKey);
    if (n === 1) await cmd('EXPIRE', failKey, 600);
    return { ok: false, noPinSet: !stored && !envPin };
  }
  return { ok: true };
}
export const setPin = (pin) => cmd('SET', P + 'pin', hash(String(pin)));

// ---------- 카탈로그 비밀번호 쿠키 ----------
export const sessionToken = (s) =>
  crypto.createHash('sha256').update(s.salt + ':' + s.password).digest('hex').slice(0, 32);
