// 카탈로그 비밀번호 확인
import { getSettings, sessionToken } from '../lib/store.js';
import { readBody, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const { password } = await readBody(req);
  const s = await getSettings();
  if (String(password || '').trim() === s.password) {
    res.setHeader('Set-Cookie', `dis_auth=${sessionToken(s)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; HttpOnly; Secure; SameSite=Lax`);
    return json(res, 200, { ok: true });
  }
  return json(res, 401, { ok: false });
}
