// 관리자 화면에서 올린 상품 사진 보여주기
import { getImage } from '../lib/store.js';

export default async function handler(req, res) {
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  if (!/^[a-z0-9]{6,40}$/.test(id)) { res.statusCode = 404; return res.end(); }
  const img = await getImage(id).catch(() => null);
  if (!img) { res.statusCode = 404; return res.end(); }
  res.statusCode = 200;
  res.setHeader('Content-Type', img.type);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(img.data);
}
