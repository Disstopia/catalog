export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;

  if (password === 'disfur') {
    res.setHeader('Set-Cookie', `dis_auth=disfur; Path=/; Max-Age=${60 * 60 * 24 * 7}; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false });
}
