// api/postar.js — o "cérebro" do robô da Flammus Studio
//
// O que ele faz, a cada execução:
//   1. pede para a IA (Gemini) escrever 2 posts diferentes sobre sites de alta performance
//   2. monta a arte de cada post com /api/og (1080x1350)
//   3. agenda os 2 posts no Buffer, para o Instagram @flammus_br, nos horários definidos abaixo
//   4. confere antes se aquele horário já não está ocupado (evita post duplicado)
//
// VARIÁVEIS DE AMBIENTE (Vercel → projeto → Settings → Environment Variables)
//    GEMINI_API_KEY   obrigatória — chave do Google AI Studio
//    BUFFER_API_KEY   obrigatória — API key do Buffer (Settings > API)
//    CRON_SECRET      recomendada  — senha que protege este endpoint
//    SITE_URL         opcional     — padrão https://flammus.com.br
//    GEMINI_MODEL     opcional     — padrão gemini-3.8-flash
//
// TESTE MANUAL:  /api/postar?agora=1            → publica 1 post na hora
//                /api/postar?agora=1&key=XXXX   → idem, se você criou o CRON_SECRET

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const BUFFER_KEY = process.env.BUFFER_API_KEY;
const SEGREDO    = process.env.CRON_SECRET;
const ORG_ID     = process.env.BUFFER_ORG_ID || '6ac16e405d10ce1755d3ec74';
const CHANNEL_ID = process.env.BUFFER_CHANNEL_ID || '6ac1710bea19ca0bde6998f3'; // @flammus_br
const SITE_URL   = (process.env.SITE_URL || 'https://flammus.com.br').replace(/\/$/, '');
const MODELO     = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Horários (em UTC) dos 2 posts do dia. UTC = horário de Brasília + 3h.
//   13 = 10h em Brasília   |   22 = 19h em Brasília
const HORARIOS_UTC = [13, 22];

// Ângulos diferentes, para os posts não saírem repetitivos
const ANGULOS = [
  'quanto dinheiro o empresário perde por dia com um site lento',
  'o concorrente com site pior está fechando vendas que eram suas',
  'site amador destruindo a credibilidade de uma empresa boa',
  'cliente que pesquisa no Google e desiste antes de falar com você',
  'o custo de adiar a reforma do site mais 6 meses',
  'velocidade de carregamento como vantagem competitiva',
  'empresário que acha que Instagram basta e não tem onde receber o cliente pronto para comprar'
];

function proximoHorarioUTC(horaUTC) {
  const agora = new Date();
  const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), horaUTC, 0, 0));
  if (alvo.getTime() - agora.getTime() < 10 * 60 * 1000) alvo.setUTCDate(alvo.getUTCDate() + 1);
  return alvo.toISOString();
}

function montarPrompt(angulo) {
  return `Você é o estrategista chefe da Flammus Studio, estúdio que cria sites rápidos e de alta performance.
Crie um post agressivo para Instagram focado em empresários que perdem dinheiro com sites lentos ou amadores.
Ângulo obrigatório deste post: ${angulo}.
Regras: tom direto, frases secas, soe humano (nada de "no mundo digital de hoje"), sem emojis em excesso.
Responda APENAS com JSON puro, sem crases e sem texto antes ou depois, neste formato exato:
{"t":"frase de impacto para a arte (máximo 6 palavras)","l":"legenda persuasiva de até 600 caracteres, terminando com 4 hashtags do nicho"}`;
}

// Modelos em ordem de preferência. Se um estiver sobrecarregado, tenta o próximo.
const MODELOS = [MODELO, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']
  .filter((m, i, a) => m && a.indexOf(m) === i);

async function tentarModelo(modelo, angulo) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: montarPrompt(angulo) }] }] })
  });
  const d = await r.json();
  if (!r.ok) {
    const msg = (d && d.error && d.error.message) || 'falha ao chamar o Gemini';
    const e = new Error('IA (' + modelo + '): ' + msg);
    e.recuperavel = /high demand|unavailable|overload|rate limit|quota/i.test(msg) || r.status === 429 || r.status >= 500;
    throw e;
  }

  const bruto = (d && d.candidates && d.candidates[0] && d.candidates[0].content &&
                 d.candidates[0].content.parts && d.candidates[0].content.parts[0] &&
                 d.candidates[0].content.parts[0].text) || '';
  const achou = bruto.match(/\{[\s\S]*\}/); // aceita resposta embrulhada em ```json ... ```
  if (!achou) throw new Error('IA (' + modelo + '): não retornou JSON válido — ' + bruto.slice(0, 200));

  const post = JSON.parse(achou[0]);
  if (!post.t || !post.l) throw new Error('IA (' + modelo + '): JSON sem os campos "t" e "l"');
  return post;
}

async function gerarConteudo(angulo) {
  let ultimoErro;
  for (const modelo of MODELOS) {
    try {
      return await tentarModelo(modelo, angulo);
    } catch (e) {
      ultimoErro = e;
      if (!e.recuperavel) throw e; // erro de chave/permissão: não adianta tentar outro modelo
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw ultimoErro;
}

// Já existe post agendado perto deste horário? (evita duplicidade)
async function horarioJaOcupado(dueAt) {
  const query = `query($o: OrganizationId!, $c: ChannelId!) {
    posts(first: 30, input: { organizationId: $o, filter: { status: [scheduled], channelIds: [$c] }, sort: [{ field: dueAt, direction: asc }] }) {
      edges { node { id dueAt } }
    }
  }`;
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER_KEY}` },
    body: JSON.stringify({ query, variables: { o: ORG_ID, c: CHANNEL_ID } })
  });
  const d = await r.json();
  const edges = (d && d.data && d.data.posts && d.data.posts.edges) || [];
  const alvo = new Date(dueAt).getTime();
  return edges.some(e => e.node && e.node.dueAt && Math.abs(new Date(e.node.dueAt).getTime() - alvo) < 45 * 60 * 1000);
}

async function agendarNoBuffer(conteudo, modo, dueAt) {
  const imagem = `${SITE_URL}/api/og?title=${encodeURIComponent(conteudo.t)}`;

  const query = `mutation($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id status dueAt } }
      ... on MutationError { message }
    }
  }`;

  const input = {
    text: conteudo.l,
    channelId: CHANNEL_ID,
    schedulingType: 'automatic',
    mode: modo, // customScheduled (hora marcada) | shareNow (publica agora)
    assets: [{ image: { url: imagem } }],
    metadata: { instagram: { type: 'post', shouldShareToFeed: true, isAiGenerated: true } }
  };
  if (modo === 'customScheduled') input.dueAt = dueAt;

  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER_KEY}` },
    body: JSON.stringify({ query, variables: { input } })
  });
  const d = await r.json();
  const res = d && d.data && d.data.createPost;

  if (res && res.post) return { ok: true, post: res.post, arte: imagem, conteudo };
  const erro = (res && res.message) || (d && d.errors && d.errors[0] && d.errors[0].message) || 'falha no Buffer';
  return { ok: false, erro, detalhe: d };
}

module.exports = async function handler(req, res) {
  // --- 1) Porta de entrada: proteção e conferência da configuração ---
  const autorizado = !SEGREDO
    || req.headers['authorization'] === `Bearer ${SEGREDO}`
    || (req.query && req.query.key === SEGREDO);
  if (!autorizado) {
    return res.status(401).json({ error: 'Não autorizado. Use /api/postar?key=SEU_CRON_SECRET' });
  }

  const faltando = [!GEMINI_KEY && 'GEMINI_API_KEY', !BUFFER_KEY && 'BUFFER_API_KEY'].filter(Boolean);
  if (faltando.length) {
    return res.status(500).json({
      error: 'Configuração incompleta na Vercel.',
      faltando,
      comoResolver: 'Vercel → seu projeto → Settings → Environment Variables → crie as variáveis → Deployments → Redeploy.'
    });
  }

  const agora = String((req.query && req.query.agora) || '') === '1';

  try {
    // --- 2) Modo teste: gera 1 post e publica agora ---
    if (agora) {
      const conteudo = await gerarConteudo(ANGULOS[Math.floor(Math.random() * ANGULOS.length)]);
      const r = await agendarNoBuffer(conteudo, 'shareNow', null);
      return res.status(r.ok ? 200 : 500).json(r.ok
        ? { success: true, mensagem: '🔥 Post publicado no Instagram agora!', ...r }
        : { etapa: 'Buffer', ...r });
    }

    // --- 3) Modo normal: gera os 2 posts do dia e agenda ---
    const angulosDoDia = [...ANGULOS].sort(() => Math.random() - 0.5).slice(0, HORARIOS_UTC.length);
    const criados = [];
    const pulados = [];
    const falhas = [];

    for (let i = 0; i < HORARIOS_UTC.length; i++) {
      const dueAt = proximoHorarioUTC(HORARIOS_UTC[i]);
      try {
        if (await horarioJaOcupado(dueAt)) {
          pulados.push({ horario: dueAt, motivo: 'já existe post agendado neste horário' });
          continue;
        }
        const conteudo = await gerarConteudo(angulosDoDia[i]);
        const r = await agendarNoBuffer(conteudo, 'customScheduled', dueAt);
        if (r.ok) criados.push({ agendadoPara: dueAt, arte: r.arte, conteudo: r.conteudo, post: r.post });
        else falhas.push({ horario: dueAt, erro: r.erro });
      } catch (e) {
        falhas.push({ horario: dueAt, erro: e.message });
      }
    }

    const sucesso = criados.length > 0 || (pulados.length > 0 && falhas.length === 0);
    const horarios = HORARIOS_UTC.map(h => `${h - 3}h (Brasília)`).join(' e ');
    return res.status(sucesso ? 200 : 500).json({
      success: sucesso,
      mensagem: criados.length
        ? `🔥 ${criados.length} post(s) agendado(s) para ${horarios}`
        : 'Nenhum post novo agendado nesta execução.',
      criados,
      pulados,
      falhas
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
