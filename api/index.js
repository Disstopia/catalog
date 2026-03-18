import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const cookie = req.cookies['dis_auth'];
  if (cookie === 'disfur') {
    const html = fs.readFileSync(path.join(process.cwd(), 'catalog.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }
  const html = fs.readFileSync(path.join(process.cwd(), 'auth.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
