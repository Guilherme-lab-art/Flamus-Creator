// api/og.jsx — gera a ARTE do post (1080x1350) na hora, em /api/og?title=...
// Padrão oficial da Vercel para projetos que NÃO são Next.js: arquivo .jsx com Edge Runtime.
// (a extensão .jsx é o que permite usar JSX aqui sem precisar de package.json)
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'FLAMMUS STUDIO').slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
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
        }}
      >
        <div style={{ color: '#FF5500', fontSize: 32, fontWeight: 'bold', letterSpacing: '8px', marginBottom: 40, fontFamily: 'sans-serif' }}>
          FLAMMUS STUDIO
        </div>
        <div style={{ color: '#FAFAFA', fontSize: 72, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.1, fontFamily: 'sans-serif', maxWidth: '900px' }}>
          {title}
        </div>
        <div style={{ color: '#71717A', fontSize: 24, marginTop: 60, borderTop: '1px solid #27272A', paddingTop: 20, width: '500px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          HIGH PERFORMANCE WEBSITES
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
