// api/og.mjs — gera a ARTE do post (1080x1350) na hora, em /api/og?title=...
//
// Por que .mjs e sem JSX? A Vercel ignora arquivos .jsx em projetos que não são Next.js
// (foi o que aconteceu na 1ª tentativa: /api/og deu 404). Aqui os elementos são objetos
// simples — o mesmo formato que o React cria por dentro — então não precisa de JSX.
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const el = (type, style, children) => ({ type, props: { style, children } });

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'FLAMMUS STUDIO').slice(0, 120);

  const arte = el(
    'div',
    {
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0A0A0A',
      padding: '60px',
      border: '20px solid #141416',
      backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255, 85, 0, 0.25), transparent 70%)',
    },
    [
      el('div', { color: '#FF5500', fontSize: 32, fontWeight: 'bold', letterSpacing: '8px', marginBottom: 40, fontFamily: 'sans-serif' }, 'FLAMMUS STUDIO'),
      el('div', { color: '#FAFAFA', fontSize: 72, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.1, fontFamily: 'sans-serif', maxWidth: '900px' }, title),
      el('div', { color: '#71717A', fontSize: 24, marginTop: 60, borderTop: '1px solid #27272A', paddingTop: 20, width: '500px', textAlign: 'center', fontFamily: 'sans-serif' }, 'HIGH PERFORMANCE WEBSITES'),
    ]
  );

  return new ImageResponse(arte, { width: 1080, height: 1350 });
}
