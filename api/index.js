// 카탈로그 페이지: 비밀번호 쿠키가 맞으면 카탈로그, 아니면 비밀번호 화면
import fs from 'fs';
import path from 'path';
import { getProducts, getPartners, getSettings, sessionToken } from '../lib/store.js';
import { parseCookies } from '../lib/http.js';

const tpl = (name) => fs.readFileSync(path.join(process.cwd(), 'templates', name), 'utf8');

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  try {
    const settings = await getSettings();
    const cookie = parseCookies(req).dis_auth;
    if (cookie !== sessionToken(settings)) {
      res.statusCode = 200;
      return res.end(tpl('auth.html'));
    }
    const [products, partners] = await Promise.all([getProducts(), getPartners()]);
    const data = {
      products: products.filter((p) => !p.hidden),
      partners: partners.filter((p) => !p.hidden),
      settings: {
        calendarUrl: settings.calendarUrl,
        calendarLabel: settings.calendarLabel,
        usoList: settings.usoList,
        matList: settings.matList,
      },
    };
    const safe = JSON.stringify(data).replace(/</g, '\\u003c');
    const html = tpl('catalog.html').replace('/*__CATALOG_DATA__*/null', () => safe);
    res.statusCode = 200;
    res.end(html);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('<meta charset="utf-8"><p style="font-family:sans-serif;padding:2rem">잠시 후 다시 시도해 주세요. (저장소 연결 오류)</p>');
  }
}
