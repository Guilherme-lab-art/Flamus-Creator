// api/og.mjs — gerador de arte dos posts (1080x1350)
//
// Identidade: chama amber #F6AD32 · preto #0A0705 · off-white #F7F4EF · laranja #FF5B00
// Tipografia: Space Grotesk (títulos) + DM Sans (apoio) — as mesmas do site.
//
// Parâmetros:
//   ?title=frase de impacto      (até 90 caracteres)
//   &destaque=palavra           (ganha linha própria, em cor de destaque)
//   &kicker=linha de apoio      (etiqueta pequena acima do título)
//   &sub=frase de sustentação   (linha média abaixo do título)
//   &tpl=1|2|3                  (1 Flame Dark · 2 Amber Block · 3 Editorial Light)

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SITE = (process.env.SITE_URL || 'https://flammus.com.br').replace(/\/$/, '');

// ---------- fontes (vêm do próprio site, uma vez por instância) ----------
const fonte = (arquivo) => fetch(`${SITE}/fonts/${arquivo}`).then(r => r.arrayBuffer());

const fontesPromise = Promise.all([
  fonte('SpaceGrotesk-700.ttf'),
  fonte('DMSans-700.ttf'),
  fonte('DMSans-500.ttf'),
]).then(([titulo, apoio700, apoio500]) => [
  { name: 'Space Grotesk', data: titulo, weight: 700, style: 'normal' },
  { name: 'DM Sans', data: apoio700, weight: 700, style: 'normal' },
  { name: 'DM Sans', data: apoio500, weight: 500, style: 'normal' },
]);

// ---------- marca (chama vetorizada, em base64) ----------
const MARCA = 'data:image/png;base64,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';
const CHAMA_AMBER = 'data:image/png;base64,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';
const CHAMA_PRETA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAACXBIWXMAAAsTAAALEwEAmpwYAAAPlElEQVR4nO3df9BtVVnA8X3veZ5n7b3Wee8FUYlk1PyJWRqMqZhDKmVT/sA0JzHyRw6SSaJRWUaIY4SKM6g4SoalOFJRIA5GhFQihROWSWGmZuDAjRQQTUy4XC7Net/7C+573/uec/baz97nfD8zzz/vH+9Za53n2b/O2mtVFQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsqOTdAAATelBVjWOQP02qL2HwgAFZMntsDHJdCnpvNPkt7/YAWKfG7AUx6Ldy8S6H6fsZPKD/NqSg79hVuLsL+DLvhgFYmyaT8/Yq3nwJHeQ6Bg/orxCDXLha8e44A/+3dwMBrGJzVR0QTa/aZ/GuxF0MHtAz43H1wBjk2v0U73Lkn5S82wtgh4OqaikFvWY9xZujaZqHMHhAP1h+srze4s1R1/XDvBsNoKpGMcgFkxRvjk0hPJLBA5wlk3MnLd4ceWaWd9uBhZZMXj9N8VLAgLO6liPzz0HTFnDTNId69wFYSClVByeTLdMWb478e7F3P4BFJNH0ylmKN0eeaundEWDhpKBnzlq8Meh3vPsBLOp977bZC1i+6N0XYBFfUPjCrMW7XMCmV3h3Blgoq77XO22YfMi7P8DCaBp5ShuXzrvPwPLb3n0CFoXsXMuqrWjMjvHuFLAQxkFe02bx5lgye7R3v4C5l9/ZTaY3t1m8MejtVVVt9O4bMPdS0Le2ffZNQS/17hcw95qm+f4U9I62CzianOLdN2DuJZMPFDj73juu5SjvvgFzLS93M8ubRmvc/36bOdDAkCZt3KeA5S/48oCCHlBVm+6zDUqbBVzry/jygIKSycklijc/EGMpWaD8dihfK1LAJh/mywMKGpu9uNDZ994URj/BlwcUlIJ+otDZ96a8/CxfHlBIStWDU9Cthc7AZ/DFAQUlk9cVKt6tdV0/lC8PKCgF/Wyhy+fz+OKAgsZmhxU6+26Pqk/s6suLqkdsWv4pG1gg0eTUMmdfvazjfrwxBb2kqqoNXX4u4CqZfqbMGXh0dJf9iCYfyZ8bTd7U5ecCbvIlZ5vrXe2MaPr3XfclBfmXHZ9/Twqjn+z684HOJdVjC519n9FxVyQF/d4eB5Cvs4k45l5+Sjz0e99sbPaDq1wFfDoXdtdtAbqyMZr+T8sFvL0ReXLXX2EKcuI+2nNm120BOpF/4pmXd35TkI/v64ASbfRcjzYBRTVBTmi5gLeNzR7n8LVJXu1jjQdq34ix+j6HdgHlJJNzW773fb/H95XX2VpH2/6K34cxV1KQz7dYwHfEWB3i0w992/ou7/V4j/YBJcQU9O4WC/gtTl+TJJMt6z3ILJk9xqmdQHvGtTy9reLN95gHVdWSx/cTbfScCS/zP8NPSxi8ZPL69u595WSvfsQgF05+wJE3e7UXaEUyPael4t2SH2h7fC0pVQdPuX713VH1RzzajDm3Y+2o4pt/RdMr2ijgcZBfqYa5fvU1LPODVjWNPDUG/U6ur9JDm0xuaOHse0NVVaFyMB5XD8xjNWP7X+fRdsyhpPqEGPS2nFgdvJQe2nkDSU6snKSgb2/hCuKOEMLDvfqAOZE3vM5PcncmVt4ZsOTn5dlSbezz67VQe55VNfPZd/dB6OMefcBcbWUi1+2ZVCGER5T8zMbseS0kv9tLAjHIn7RTvCsxNnuhV18wbBJNL98rqVQf7/Tmznpjm9elZ35Rv83iXQ6TLQdW1WaP/mDAoul7V0+q0bNKfm4KetqMl50XVT7qaPKV1gt45ZbgnU59whClWo/bZ0LVelzJz46mZ8+S7I3Zz5Zs3z7bHfSsEsW7I+4sfeuCObFk9ti1HsJEk98s+fkxyPkznKm+6fHT0Y4pk9sLFnB+l/mCrvuF4alTkM/tp0jOKtmAVe+715/kH60cZlwVWDlk1chzxLvuH+bivre7VS1S0H8a0CbdGk0/1UXx7vGyA+tKY295pcb1XAbGIP9RcvySyfXTJnjXKz0mkw90Vrw7Q/UlXfYRwxCjyX+uM4m2lZxOGU1vnWGb0M4kk5M6L96Vfl7vNUUUPTXpE9RG5EcLtuX26ZJbLi7Vpr3aaKPnllhwft3jH+SErvqKnouqh0+ajDHoq4q1Z/ppiO+oOlDX8rQU9LtexbvHWVi76C/6bUM0vXKKBPqjUg3acweDvr06mBdo3/lSh3fEoK8o3V/0XFJ96ZRngBuLtSno1mna1Ji9oCoohPADud/ehbu7gOVLvDO82NIsCVlqjeXpJ0QsLzZQRH66nUy+6l20e4XqsaX6jJ7LM6pmSh6Tkwo0azRte+pajiw0UePBMcgX3Yt19bPwv3WxQgp6Jq/SGE1v6eEWnRunPQPnh0ttNyYvXhCDXOtdqGtFY3ZM2/1Gz0WTU9pInhLrGE//hLfdS+j8LnQK+o/eBbrfMP3rNvuNQbykr99sKYFOa7t9ee/cHjzEinn7T/fiXF9s3xTCo1rsOxZozeUb2t7jdvqHRa2tgaUp6KU9KMxJ4syW+o6eG7X9NDXW+vI2GxiD/KtjEm9se0mcLiKuvEZZfLVQOBub/Vz7ybP8csOorTYm06u9VuJYz9tYfY3Y8oEUPRRNryqSQKq/0GIbPznD5Xw/bi08wpZfNcQ8r7RRLnlkS3441kY78/vGU7cjVQfPsBKm28sJbcXY7LA2vgP0UAp6RsnkiUHf3UY7Z7mMbcyeP/G4qP5we+s4+0Y0+d02vgP08+HVTYUTaNu4lh+btaHR5E3TJ7C+d5LPyou/93WW1QwzszBvYhj9VCdJZHLTeJzrYpa26itn+Pz/6moBvb7GuNAcdThKJn/Y2VnA9PJZfhue9WCTX/lb3+fo8d7FVmb85dRpxx79NNpzb6OOkugj006yz/ekpWeHxVgdMv3KH/2OyGX0XC5W55BI0z3UyltzzvTZK5fRa67cmIJ8zLvQSsaYp9HzIwZ9l1symXxwisvpDXkngpkSuJaj9vXPx2Yv8i6w8iG/OnvmoBdikC84J9Slk/5GHIP8ewuX8KvRXr6Y334BX9RO9sBVvtcrveXHusLkhkne123hEndr0zSH3v//NkF+2X0sOogY9DZe9J/3Tcq6j7t2TDSwjiadnH6/f1v3aU2r4kWsekS5zEIn8uqRvUus5YkTo6PXaneemD/z55jemodg11gEea133zsNk5M7STLM9f3vWgX2yaaRp6zW7vz3dj5j906K+ecV7z53HJ+gtga+7lUKek8PEml/hfy3eaeDPe/ZNlfVAS3971vyOLR1QBjgO8IYqhRGz/ROoonC5Kb823FSfcJy+01vbqeI5ZQuZ6L1KZpVHuRhIKLJb3gn0PTFrFe3VsBBb5+Xt40m7ruNfsY7DzGlZPJh7wQivAtYdj0DwMDkFRoooMU+iMR9T2hB3/VlEy7Ccwzk8955iCnkd3IpHA4eKeidbIA2QI3IkylgCjjly+hYHeKdj5hQ3qWAAqaA08qUysMpoIHJm11TwBRw4qekYUpB30oBU8Bp5XfwX/LOR0womr6PAqaA08pPSb9DAQ1MMjmPAqaA08p88LO98xETyisyUMAUcGIyxzDlpV0pYAo4rbx/fb53PmJCA9qcmig8BjHIBRTQwFDAHBjS7gK+0DsfMaFoeiVnN4o4rcyHvpgCGpho+ikKmAJOK2NwiXc+YkLR9AoKmAJOK2PwlxTQwPAzEsWbdt8Df9Q7HzGhZPLHnIEp4sREjmFy3Q+J6NsYvMU7HzGhvMVmDxKH6MMYmLyBAhqYGPTV7olD9GIMYq0v985HTCja6Ke9E4foxxg0Zs+ngAamhV3uiTkZg6j6RO98xITa2pqEGPwYbM8XZBTQAEXTr/cggQjPMTD5mnceYkp50zAKaLEPINH0cgpooPJKDN4JRLgX8NneeYgpNUFOoIAW/SAiJ1JAAxVVj/BPIMJzDMa1/Lh3HmJ6o0XdVpPQPAZbeQI9cNH070jmBS1o06u98w8zSkFPd08kwmsMzqSABi6F0TMpoMU8iDRmx3jnH2anMei3vJOJ6HwMtuctZimgOZCCfIwCWqyDSAxynXfeoSW8WriQcQYFNCfypVQKencPkoroaAwakSd55x1alEwvo4AW5ABicmNVVRsooDkSg77CPbGITsYgBn2Xd76hZQdW1eYU9P8ookU4kIyeQQHNIZaaXYCzr+k38hRa71xDAVH1cO8EIwoXcNCzKJ45loJeQxHN8YFE9fHeOYaCYq2/6J5kRJmzr+mVFM/8G0WTr1BEc3ggUX2pd3KhA6zUMZdn31urqqopoMWgebVC76QjWizgoO/0Tip0KAY9ngKam4PItk0hPIoCWiwbU5B/7kHyETOffYX9fxdRCqNnUUCDP4Bsz9voeOcSnKSgl/QgCYnpz75/TvEssLquHxqD/i9FNMiDyNYls0d75xCcpSCv7UEyEpOefU3f45076IeN0fQqimg4B5EY9DbWvMIum0J4JIvfDaqAX0X64j7GZi/2TkxiXZfOn2bFDawqmZ5DEfX6QHLHktljSF/sS5OCfrYHiUqsfun8alIXa4qxOiQvjEYR9e0gIheTuliX/GJ4DPpt/6QllsfA5Pqlpeog0hfrFm30nDxZgCLyPYgsbxGr+kOkLqZ9Mr2NInYr4HvGZi8kdTHrMjz3UMQOBWxyEqmLmcWgr+RM3HkBv53URWsas+exOHxXZ149h8kaaF3TyFPz+ktcTlO8GPRPTPJlirhIEZ/OmRfFHVRVSynIRRRxa4W7PZmcTOqiSxujyZt5Qj1b8eYFFRqzY0hduKhrOZJL6mmLV77Mdihw96CqGifTP1i+FOz+55ZBRgxy/gOqapP3dwfsEsPo2THIl7yLo++XzLHWl5E26CuLJm9cnsPbg4LpWVwaQni49xcE7FfTNA9JJh9iBtfyxIybk+qxpA0GZ2z2uBjkggW9P74rBn0397oYvKh6RAzyZwtyRt6aTD5Y1/XDvMcdaH8FTNP3zek98vfy03juc7EQs7nyGk8pyOd6UHiz3+MGPY21mrGQ8mSGXADJ5Kvuxbj+uDPvLZUXPch7LnuPIdAHG+tanpaC/n4Mcm0PivT+8d0Y5MJU63Gbq+oA78ECeq1pmkOXVwQxOddpgshd0fQfUtDfS2F0dG6S95gAg7W5qg7M+xpHk19f/o3Z9Opoeks797FyYzT9m/yAbRzkNY3Ik/KkFO8+AwvxQGxsdti4lqOS6s8vPxwz+bVockoK+radEU1OTSZviEGPH5u9aFzL00MIj8jvZHj3AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFUv/D+iGJl66s9LzwAAAABJRU5ErkJggg==';

// ---------- paleta ----------
const C = {
  preto: '#0A0705',
  offwhite: '#F7F4EF',
  amber: '#F6AD32',
  laranja: '#FF5B00',
  creme: '#FFF9F0',
};

const el = (type, style, children) => ({ type, props: { style, children } });
const img = (src, style) => ({ type: 'img', props: { src, style, children: null } });
const txt = (style, children) => el('div', { display: 'flex', ...style }, children);

const LARGURA_UTIL = 928; // 1080 - 2x76

// ---------------------------------------------------------------------------
// Quebra o título em linhas próprias.
// Isso resolve dois problemas de uma vez: controla o ritmo visual e garante que
// a palavra de destaque fique sozinha na linha (sem o espaço sumir entre as palavras).
// ---------------------------------------------------------------------------
function montarLinhas(titulo, destaque, maxChars) {
  const palavras = String(titulo).trim().replace(/\s+/g, ' ').split(' ');
  const alvo = (destaque || '').trim().toLowerCase();

  // acha a posição da palavra de destaque
  let iDestaque = -1;
  if (alvo) {
    iDestaque = palavras.findIndex(p => p.toLowerCase().replace(/[.,!?;:]/g, '') === alvo.replace(/[.,!?;:]/g, ''));
    if (iDestaque === -1) iDestaque = palavras.findIndex(p => p.toLowerCase().includes(alvo));
  }

  const linhas = [];
  let atual = [];
  const fechar = () => { if (atual.length) { linhas.push({ palavras: atual, destaque: false }); atual = []; } };

  for (let i = 0; i < palavras.length; i++) {
    // a palavra de destaque ocupa a própria linha
    if (i === iDestaque) {
      fechar();
      linhas.push({ palavras: [palavras[i]], destaque: true });
      continue;
    }
    const tentativa = [...atual, palavras[i]];
    if (tentativa.join(' ').length > maxChars && atual.length) {
      fechar();
      atual = [palavras[i]];
    } else {
      atual = tentativa;
    }
  }
  fechar();

  // se o destaque caiu no começo e sobrou linha órfã de 1 palavra, junta
  return linhas;
}

function tamanhoPorLinhas(linhas, max) {
  const maior = Math.max(...linhas.map(l => l.palavras.join(' ').length), 1);
  // 0.54 ≈ largura média de um caractere em Space Grotesk Bold
  const cabe = Math.floor(LARGURA_UTIL / (maior * 0.54));
  return Math.max(54, Math.min(max, cabe));
}

// ============================ TEMPLATE 1 — Flame Dark ============================
function flameDark({ t, d, k, s }) {
  const linhas = montarLinhas(t, d, 17);
  const tam = tamanhoPorLinhas(linhas, 106);
  return el('div', {
    width: '1080px', height: '1350px', display: 'flex', flexDirection: 'column',
    backgroundColor: C.preto, position: 'relative', padding: '76px',
    backgroundImage:
      'radial-gradient(circle at 8% 92%, rgba(255,91,0,0.34), transparent 48%),' +
      'radial-gradient(circle at 92% 6%, rgba(246,173,50,0.18), transparent 42%)',
  }, [
    // chama gigante de fundo
    img(CHAMA_AMBER, { position: 'absolute', right: '-90px', bottom: '-70px', width: '520px', height: '520px', opacity: 0.07 }),
    // moldura
    el('div', {
      position: 'absolute', top: '38px', left: '38px', right: '38px', bottom: '38px',
      border: '1px solid rgba(246,173,50,0.22)', borderRadius: '28px', display: 'flex',
    }, []),
    // topo
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      img(MARCA, { width: '92px', height: '92px' }),
      txt({ color: 'rgba(247,244,239,0.72)', fontSize: 21, letterSpacing: '6px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, 'Flammus Studio'),
    ]),
    // miolo
    el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '30px' }, [
      txt({ color: C.amber, fontSize: 23, letterSpacing: '5px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, k),
      el('div', { display: 'flex', flexDirection: 'column' },
        linhas.map(l => txt({
          color: l.destaque ? C.amber : C.offwhite,
          fontSize: tam, lineHeight: 1.0, letterSpacing: '-2px',
          fontFamily: 'Space Grotesk', fontWeight: 700,
        }, l.palavras.join(' ')))
      ),
      el('div', { width: '104px', height: '5px', backgroundColor: C.laranja, borderRadius: '3px', display: 'flex', marginTop: '6px' }, []),
      txt({ color: 'rgba(247,244,239,0.80)', fontSize: 33, lineHeight: 1.35, fontFamily: 'DM Sans', fontWeight: 500, maxWidth: '860px' }, s),
    ]),
    // base
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      txt({ color: 'rgba(247,244,239,0.62)', fontSize: 25, fontFamily: 'DM Sans', fontWeight: 500 }, '@flammus_br'),
      el('div', {
        display: 'flex', alignItems: 'center', border: '1px solid rgba(246,173,50,0.5)',
        borderRadius: '999px', padding: '16px 30px', backgroundColor: 'rgba(246,173,50,0.10)',
      }, [txt({ color: C.amber, fontSize: 22, fontFamily: 'DM Sans', fontWeight: 700, letterSpacing: '2px' }, 'flammus.com.br')]),
    ]),
  ]);
}

// ============================ TEMPLATE 2 — Amber Block ============================
function amberBlock({ t, d, k, s }) {
  const linhas = montarLinhas(t, d, 16);
  const tam = tamanhoPorLinhas(linhas, 110);
  return el('div', {
    width: '1080px', height: '1350px', display: 'flex', flexDirection: 'column',
    padding: '76px', position: 'relative',
    backgroundImage: `linear-gradient(150deg, ${C.amber} 0%, #FF8A1D 52%, ${C.laranja} 100%)`,
  }, [
    img(CHAMA_PRETA, { position: 'absolute', right: '-70px', top: '300px', width: '460px', height: '460px', opacity: 0.08 }),
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      img(CHAMA_PRETA, { width: '78px', height: '78px' }),
      txt({ color: C.preto, fontSize: 21, letterSpacing: '6px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, 'Flammus Studio'),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '26px' }, [
      txt({ color: 'rgba(10,7,5,0.66)', fontSize: 23, letterSpacing: '5px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, k),
      el('div', { display: 'flex', flexDirection: 'column' },
        linhas.map(l => txt({
          color: l.destaque ? C.creme : C.preto,
          fontSize: tam, lineHeight: 0.98, letterSpacing: '-2.5px',
          fontFamily: 'Space Grotesk', fontWeight: 700,
        }, l.palavras.join(' ')))
      ),
      txt({ color: 'rgba(10,7,5,0.78)', fontSize: 33, lineHeight: 1.35, fontFamily: 'DM Sans', fontWeight: 700, maxWidth: '860px', marginTop: '10px' }, s),
    ]),
    el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      backgroundColor: C.preto, borderRadius: '20px', padding: '30px 38px',
    }, [
      txt({ color: C.offwhite, fontSize: 25, fontFamily: 'DM Sans', fontWeight: 700 }, '@flammus_br'),
      txt({ color: C.amber, fontSize: 25, fontFamily: 'DM Sans', fontWeight: 500 }, 'flammus.com.br'),
    ]),
  ]);
}

// ============================ TEMPLATE 3 — Editorial Light ============================
function editorialLight({ t, d, k, s }) {
  const linhas = montarLinhas(t, d, 18);
  const tam = tamanhoPorLinhas(linhas, 100);
  return el('div', {
    width: '1080px', height: '1350px', display: 'flex', flexDirection: 'column',
    backgroundColor: C.offwhite, padding: '76px', position: 'relative',
  }, [
    el('div', { position: 'absolute', top: '0px', right: '0px', width: '18px', height: '100%', backgroundColor: C.laranja, display: 'flex' }, []),
    img(CHAMA_PRETA, { position: 'absolute', right: '60px', bottom: '40px', width: '420px', height: '420px', opacity: 0.05 }),
    el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '46px' }, [
      img(CHAMA_PRETA, { width: '62px', height: '62px' }),
      txt({ color: 'rgba(10,7,5,0.55)', fontSize: 20, letterSpacing: '5px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, 'Flammus Studio'),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '28px', paddingRight: '46px' }, [
      txt({ color: C.laranja, fontSize: 23, letterSpacing: '5px', fontFamily: 'DM Sans', fontWeight: 700, textTransform: 'uppercase' }, k),
      el('div', { display: 'flex', flexDirection: 'column' },
        linhas.map(l => txt({
          color: l.destaque ? C.laranja : '#141008',
          fontSize: tam, lineHeight: 1.02, letterSpacing: '-2px',
          fontFamily: 'Space Grotesk', fontWeight: 700,
        }, l.palavras.join(' ')))
      ),
      txt({ color: '#453B31', fontSize: 33, lineHeight: 1.35, fontFamily: 'DM Sans', fontWeight: 500, maxWidth: '820px', marginTop: '10px' }, s),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '46px' }, [
      el('div', { height: '2px', width: '100%', backgroundColor: 'rgba(10,7,5,0.14)', display: 'flex' }, []),
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        txt({ color: '#3B3229', fontSize: 25, fontFamily: 'DM Sans', fontWeight: 700 }, '@flammus_br'),
        txt({ color: '#3B3229', fontSize: 25, fontFamily: 'DM Sans', fontWeight: 500 }, 'flammus.com.br'),
      ]),
    ]),
  ]);
}

const TEMPLATES = { '1': flameDark, '2': amberBlock, '3': editorialLight };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const t = (searchParams.get('title') || 'Seu site está perdendo vendas').slice(0, 90);
  const d = (searchParams.get('destaque') || '').slice(0, 24);
  const k = (searchParams.get('kicker') || 'Sites de alta performance').slice(0, 46);
  const s = (searchParams.get('sub') || 'Enquanto você lê isso, alguém está fechando a venda que era sua.').slice(0, 120);
  const tpl = TEMPLATES[searchParams.get('tpl')] || flameDark;

  const fonts = await fontesPromise;

  return new ImageResponse(tpl({ t, d, k, s }), { width: 1080, height: 1350, fonts });
}
