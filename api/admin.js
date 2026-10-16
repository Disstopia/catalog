// 관리자 API (PIN 필요)
import crypto from 'crypto';
import {
  getProducts, saveProducts, getPartners, savePartners, getSettings, saveSettings,
  putImage, delImage, checkPin, setPin, usingMemory,
} from '../lib/store.js';
import { readBody, ipOf, json } from '../lib/http.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true;
const strList = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
const COLORS = ['pink', 'violet', 'sunset', 'flame', 'black', 'cyan'];

function okUrl(u) {
  if (/^\/api\/img\?id=[a-z0-9]{6,40}$/.test(u)) return true;
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; }
}
const newId = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

function cleanProduct(p) {
  const name = str(p.name, 100);
  if (!name) throw new Error('상품명을 입력해 주세요.');
  const imgs = strList(p.imgs, 15, 600);
  const bad = imgs.find((u) => !okUrl(u));
  if (bad) throw new Error('사진 주소가 올바르지 않아요: ' + bad.slice(0, 60));
  return {
    id: str(p.id, 40) || newId(),
    name,
    uso: strList(p.uso, 20, 20),
    mat: strList(p.mat, 20, 20),
    level: ['입문자', '숙련자'].includes(p.level) ? p.level : '',
    price: str(p.price, 200),
    custom: bool(p.custom),
    isNew: bool(p.isNew),
    hidden: bool(p.hidden),
    imgs,
    note: str(p.note, 3000),
    emoji: str(p.emoji, 16),
  };
}

function cleanPartner(p) {
  const name = str(p.name, 80);
  if (!name) throw new Error('파트너 이름을 입력해 주세요.');
  const buttons = (Array.isArray(p.buttons) ? p.buttons : []).slice(0, 3).map((b) => ({
    label: str(b.label, 80), url: str(b.url, 600), color: COLORS.includes(b.color) ? b.color : 'pink',
  })).filter((b) => b.label && b.url);
  const bad = buttons.find((b) => !okUrl(b.url));
  if (bad) throw new Error('버튼 링크가 올바르지 않아요: ' + bad.url.slice(0, 60));
  return {
    id: str(p.id, 40) || newId(),
    icon: str(p.icon, 16), name, tagline: str(p.tagline, 120),
    badge: str(p.badge, 30), color: COLORS.includes(p.color) ? p.color : 'pink',
    desc: str(p.desc, 2000), features: strList(p.features, 12, 60),
    buttons, note: str(p.note, 300), hidden: bool(p.hidden),
  };
}

// 어떤 상품에서도 안 쓰는 업로드 사진은 지워요
async function dropUnused(before, after) {
  const ids = (list) => new Set(list.flatMap((p) => p.imgs || []).map((u) => (u.match(/^\/api\/img\?id=([a-z0-9]+)$/) || [])[1]).filter(Boolean));
  const still = ids(after);
  for (const id of ids(before)) if (!still.has(id)) await delImage(id).catch(() => {});
}

function reorder(list, ids) {
  const map = new Map(list.map((x) => [x.id, x]));
  const out = (Array.isArray(ids) ? ids : []).map((id) => map.get(id)).filter(Boolean);
  const seen = new Set(out.map((x) => x.id));
  return [...out, ...list.filter((x) => !seen.has(x.id))];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST만 돼요' });
  try {
    const body = await readBody(req);
    const pin = req.headers['x-admin-pin'];
    const auth = await checkPin(pin, ipOf(req));
    if (!auth.ok) {
      if (auth.locked) return json(res, 429, { error: 'PIN을 여러 번 틀려서 10분 동안 막혔어요.' });
      if (auth.noPinSet) return json(res, 401, { error: 'Vercel 환경변수 OWNER_PIN이 아직 없어요.' });
      return json(res, 401, { error: 'PIN이 맞지 않아요.' });
    }
    const a = body.action;

    if (a === 'load') {
      const [products, partners, settings] = await Promise.all([getProducts(), getPartners(), getSettings()]);
      const { salt, ...pub } = settings;
      return json(res, 200, { products, partners, settings: pub, memory: usingMemory });
    }

    if (a === 'saveProduct') {
      const list = await getProducts();
      const p = cleanProduct(body.product || {});
      const i = list.findIndex((x) => x.id === p.id);
      const next = [...list];
      if (i >= 0) next[i] = p; else next.unshift(p); // 새 상품은 맨 위에
      await saveProducts(next);
      await dropUnused(list, next);
      return json(res, 200, { ok: true, product: p, products: next });
    }

    if (a === 'deleteProduct') {
      const list = await getProducts();
      const next = list.filter((x) => x.id !== body.id);
      await saveProducts(next);
      await dropUnused(list, next);
      return json(res, 200, { ok: true, products: next });
    }

    if (a === 'reorderProducts') {
      const next = reorder(await getProducts(), body.ids);
      await saveProducts(next);
      return json(res, 200, { ok: true, products: next });
    }

    if (a === 'savePartner') {
      const list = await getPartners();
      const p = cleanPartner(body.partner || {});
      const i = list.findIndex((x) => x.id === p.id);
      const next = [...list];
      if (i >= 0) next[i] = p; else next.push(p);
      await savePartners(next);
      return json(res, 200, { ok: true, partners: next });
    }

    if (a === 'deletePartner') {
      const next = (await getPartners()).filter((x) => x.id !== body.id);
      await savePartners(next);
      return json(res, 200, { ok: true, partners: next });
    }

    if (a === 'reorderPartners') {
      const next = reorder(await getPartners(), body.ids);
      await savePartners(next);
      return json(res, 200, { ok: true, partners: next });
    }

    if (a === 'saveSettings') {
      const s = await getSettings();
      const v = body.settings || {};
      const next = { ...s };
      if ('calendarUrl' in v) {
        const u = str(v.calendarUrl, 500);
        if (u && !okUrl(u)) throw new Error('캘린더 주소는 https://로 시작해야 해요.');
        next.calendarUrl = u;
      }
      if ('calendarLabel' in v) next.calendarLabel = str(v.calendarLabel, 30) || '📅 행사 일정';
      if ('usoList' in v) next.usoList = strList(v.usoList, 30, 20);
      if ('matList' in v) next.matList = strList(v.matList, 30, 20);
      if ('password' in v) {
        const pw = str(v.password, 40);
        if (pw.length < 3) throw new Error('카탈로그 비밀번호는 3글자 이상이어야 해요.');
        next.password = pw;
      }
      await saveSettings(next);
      const { salt, ...pub } = next;
      return json(res, 200, { ok: true, settings: pub });
    }

    if (a === 'changePin') {
      const np = str(body.newPin, 40);
      if (np.length < 4) throw new Error('새 PIN은 4자리 이상이어야 해요.');
      await setPin(np);
      return json(res, 200, { ok: true });
    }

    if (a === 'upload') {
      const type = ['image/jpeg', 'image/webp', 'image/png'].includes(body.type) ? body.type : null;
      const data = String(body.data || '');
      if (!type || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new Error('사진 형식이 올바르지 않아요.');
      if (data.length > 2_000_000) throw new Error('사진이 너무 커요. (최대 약 1.5MB)');
      const id = crypto.randomBytes(10).toString('hex');
      await putImage(id, data, type);
      return json(res, 200, { ok: true, url: '/api/img?id=' + id });
    }

    return json(res, 400, { error: '알 수 없는 요청이에요.' });
  } catch (e) {
    console.error(e);
    return json(res, 400, { error: e.message || '오류가 났어요.' });
  }
}
