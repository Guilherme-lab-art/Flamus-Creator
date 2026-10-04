// api/postar.js — o "cérebro" do robô da Flammus Studio
//
// A cada execução:
//   1. a IA escreve 2 posts estruturados (frase de impacto + palavra de destaque + apoio + legenda)
//   2. a arte é gerada por /api/og, alternando entre 3 templates da identidade da marca
//   3. os 2 posts entram na fila do Buffer para os horários definidos
//   4. antes de agendar, confere se o horário já está ocupado (nunca duplica)
//
// VARIÁVEIS DE AMBIENTE
//    GEMINI_API_KEY   obrigatória
//    BUFFER_API_KEY   obrigatória
//    CRON_SECRET      recomendada (a Vercel envia sozinha quando o cron dispara)
//    SITE_URL         opcional — padrão https://flammus.com.br
//    GEMINI_MODEL     opcional — padrão gemini-3.8-flash

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const BUFFER_KEY = process.env.BUFFER_API_KEY;
const SEGREDO    = process.env.CRON_SECRET;
const ORG_ID     = process.env.BUFFER_ORG_ID || '6ac16e405d10ce1755d3ec74';
const CHANNEL_ID = process.env.BUFFER_CHANNEL_ID || '6ac1710bea19ca0bde6998f3'; // @flammus_br
const SITE_URL   = (process.env.SITE_URL || 'https://flammus.com.br').replace(/\/$/, '');
const MODELO     = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Modelos em ordem de preferência (se um estiver sobrecarregado, tenta o próximo)
const MODELOS = [MODELO, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']
  .filter((m, i, a) => m && a.indexOf(m) === i);

// Horários (UTC) dos posts do dia. UTC = Brasília + 3h → 13 = 10h · 22 = 19h
const HORARIOS_UTC = [13, 22];

// Ângulos rotativos: evita que os posts virem o mesmo discurso
const ANGULOS = [
  'a lentidão do site como dinheiro saindo pelo ralo todos os dias',
  'o concorrente pior fechando a venda que deveria ser sua',
  'site amador derrubando a credibilidade de uma empresa séria',
  'o cliente que pesquisa no Google e desiste antes de falar com você',
  'o custo real de empurrar a reforma do site mais 6 meses',
  'velocidade de carregamento como prova de profissionalismo',
  'a ilusão de achar que só Instagram basta para vender',
  'site que existe mas não gera um único contato qualificado',
];

function proximoHorarioUTC(horaUTC) {
  const agora = new Date();
  const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), horaUTC, 0, 0));
  if (alvo.getTime() - agora.getTime() < 10 * 60 * 1000) alvo.setUTCDate(alvo.getUTCDate() + 1);
  return alvo.toISOString();
}

// --------------------------------------------------------------------------
// O prompt. A chave da qualidade está aqui: estrutura fixa, regras explícitas
// de escrita e proibições do que soa artificial.
// --------------------------------------------------------------------------
function montarPrompt(angulo) {
  return `Você é o redator-chefe da Flammus Studio, estúdio que cria sites rápidos e de alta performance para empresas que querem vender mais.

Escreva UM post de Instagram sobre este ângulo: ${angulo}

O público é dono de empresa, 35-55 anos, cético, cansado de papo de agência. Ele não quer "transformação digital". Ele quer saber quanto está perdendo.

REGRAS DE ESCRITA:
- Frases curtas. Sujeito, verbo, objeto. Ponto final.
- Fale de dinheiro, tempo e cliente perdido. Nada de adjetivo vazio ("incrível", "poderoso", "inovador").
- Proibido: "no mundo digital de hoje", "solução sob medida", "levar seu negócio ao próximo nível", "desbloqueie", "mergulhe", "jornada", "empoderar".
- Use números concretos e plausíveis (ex.: 53% dos visitantes abandonam após 3 segundos).
- Escreva como quem fala numa reunião, não como quem escreve um anúncio.
- Sem emojis na frase de impacto. No máximo 1 na legenda.

FORMATO DA RESPOSTA — responda APENAS com este JSON, sem crases e sem texto antes ou depois:
{
  "t": "frase de impacto para a arte, MÁXIMO 7 palavras, sem ponto final",
  "d": "uma única palavra que já existe na frase 't' — a mais forte dela, que merece destaque visual",
  "k": "etiqueta curta de apoio em maiúsculas, 2 a 5 palavras (ex.: O CUSTO DA LENTIDÃO)",
  "s": "uma linha de sustentação de até 14 palavras que complemente a frase de impacto",
  "l": "legenda para o Instagram com até 550 caracteres, começando com uma frase de choque, desenvolvendo o argumento com um número concreto e terminando com uma chamada para o direct. Depois dela, 5 hashtags do nicho de sites, performance e negócios locais."
}`;
}

function limpar(valor, max) {
  return String(valor || '').replace(/["""]/g, '"').trim().slice(0, max);
}

// Garante que a estrutura veio completa; se a IA errar, conserta em vez de falhar
function validar(post) {
  const t = limpar(post.t, 80).replace(/[.!?]+$/, '');
  if (!t) throw new Error('IA: frase de impacto ausente');

  let d = limpar(post.d, 24).replace(/[.,!?;:]/g, '');
  // o destaque precisa existir dentro da frase, senão a arte não marca nada
  const palavras = t.split(/\s+/);
  const achou = palavras.find(p => p.toLowerCase().replace(/[.,!?;:]/g, '') === d.toLowerCase());
  if (!achou) {
    // sem destaque confiável: usa a palavra mais longa com 5+ letras
    const forte = palavras.filter(p => p.length >= 5).sort((a, b) => b.length - a.length)[0];
    d = forte ? forte.replace(/[.,!?;:]/g, '') : '';
  }

  const k = limpar(post.k, 40).toUpperCase() || 'SITES DE ALTA PERFORMANCE';
  const s = limpar(post.s, 110);
  const l = limpar(post.l, 900);

  if (l.length < 60) throw new Error('IA: legenda curta demais');
  return { t, d, k, s, l };
}

async function tentarModelo(modelo, angulo) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: montarPrompt(angulo) }] }],
      // O gemini-3.8 gasta o limite de resposta "pensando". Sem limitar isso,
      // ele devolve resposta vazia (finishReason: MAX_TOKENS). 128 é o suficiente
      // para escrever bem e responde em ~5s.
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        maxOutputTokens: 2500,
        thinkingConfig: { thinkingBudget: 128 },
      },
    })
  });
  const d = await r.json();
  if (!r.ok) {
    const msg = (d && d.error && d.error.message) || 'falha ao chamar o Gemini';
    const e = new Error(`IA (${modelo}): ${msg}`);
    e.recuperavel = /high demand|unavailable|overload|rate limit|quota/i.test(msg) || r.status === 429 || r.status >= 500;
    throw e;
  }

  const bruto = (d && d.candidates && d.candidates[0] && d.candidates[0].content &&
                 d.candidates[0].content.parts && d.candidates[0].content.parts[0] &&
                 d.candidates[0].content.parts[0].text) || '';
  const achou = bruto.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!achou) throw new Error(`IA (${modelo}): não retornou JSON`);

  return validar(JSON.parse(achou[0]));
}

async function gerarConteudo(angulo) {
  let ultimoErro;
  for (const modelo of MODELOS) {
    try {
      return await tentarModelo(modelo, angulo);
    } catch (e) {
      ultimoErro = e;
      if (!e.recuperavel) throw e;
      await new Promise(r => setTimeout(r, 900));
    }
  }
  throw ultimoErro;
}

// Monta a URL da arte com tudo que o /api/og precisa
function urlDaArte(c, tpl) {
  const q = new URLSearchParams({ title: c.t, destaque: c.d, kicker: c.k, sub: c.s, tpl: String(tpl) });
  return `${SITE_URL}/api/og?${q.toString()}`;
}

const consultaAgendados = `query($o: OrganizationId!, $c: ChannelId!) {
  posts(first: 30, input: { organizationId: $o, filter: { status: [scheduled], channelIds: [$c] }, sort: [{ field: dueAt, direction: asc }] }) {
    edges { node { id dueAt } }
  }
}`;

async function chamarBuffer(query, variables) {
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER_KEY}` },
    body: JSON.stringify({ query, variables })
  });
  return r.json();
}

async function horarioJaOcupado(dueAt) {
  const d = await chamarBuffer(consultaAgendados, { o: ORG_ID, c: CHANNEL_ID });
  const edges = (d && d.data && d.data.posts && d.data.posts.edges) || [];
  const alvo = new Date(dueAt).getTime();
  return edges.some(e => e.node && e.node.dueAt && Math.abs(new Date(e.node.dueAt).getTime() - alvo) < 45 * 60 * 1000);
}

async function agendarNoBuffer(conteudo, modo, dueAt, tpl) {
  const imagem = urlDaArte(conteudo, tpl);
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
    mode: modo, // customScheduled | shareNow
    assets: [{ image: { url: imagem } }],
    metadata: { instagram: { type: 'post', shouldShareToFeed: true, isAiGenerated: true } }
  };
  if (modo === 'customScheduled') input.dueAt = dueAt;

  const d = await chamarBuffer(query, { input });
  const res = d && d.data && d.data.createPost;
  if (res && res.post) return { ok: true, post: res.post, arte: imagem, conteudo: { ...conteudo, tpl } };

  const erro = (res && res.message) || (d && d.errors && d.errors[0] && d.errors[0].message) || 'falha no Buffer';
  return { ok: false, erro, detalhe: d };
}

module.exports = async function handler(req, res) {
  // --- porta de entrada ---
  const autorizado = !SEGREDO
    || req.headers['authorization'] === `Bearer ${SEGREDO}`
    || (req.query && req.query.key === SEGREDO);
  if (!autorizado) return res.status(401).json({ error: 'Não autorizado. Use /api/postar?key=SEU_CRON_SECRET' });

  const faltando = [!GEMINI_KEY && 'GEMINI_API_KEY', !BUFFER_KEY && 'BUFFER_API_KEY'].filter(Boolean);
  if (faltando.length) {
    return res.status(500).json({
      error: 'Configuração incompleta na Vercel.',
      faltando,
      comoResolver: 'Vercel → projeto → Settings → Environment Variables → crie as variáveis → Deployments → Redeploy.'
    });
  }

  const agora = String((req.query && req.query.agora) || '') === '1';
  // permite forçar um template na mão: ?tpl=2
  const tplForcado = (req.query && req.query.tpl) ? String(req.query.tpl) : null;
  const tplDe = (i) => tplForcado || [(i % 3) + 1][0];

  try {
    // --- modo teste: publica 1 post agora ---
    if (agora) {
      const angulo = ANGULOS[Math.floor(Math.random() * ANGULOS.length)];
      const conteudo = await gerarConteudo(angulo);
      const r = await agendarNoBuffer(conteudo, 'shareNow', null, tplDe(Math.floor(Math.random() * 3)));
      return res.status(r.ok ? 200 : 500).json(r.ok
        ? { success: true, mensagem: '🔥 Post publicado no Instagram agora!', ...r }
        : { etapa: 'Buffer', ...r });
    }

    // --- modo normal: gera os posts do dia e agenda ---
    const angulosDoDia = [...ANGULOS].sort(() => Math.random() - 0.5).slice(0, HORARIOS_UTC.length);
    const criados = [], pulados = [], falhas = [];

    for (let i = 0; i < HORARIOS_UTC.length; i++) {
      const dueAt = proximoHorarioUTC(HORARIOS_UTC[i]);
      try {
        if (await horarioJaOcupado(dueAt)) {
          pulados.push({ horario: dueAt, motivo: 'já existe post agendado neste horário' });
          continue;
        }
        const conteudo = await gerarConteudo(angulosDoDia[i]);
        const r = await agendarNoBuffer(conteudo, 'customScheduled', dueAt, tplDe(i));
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
      criados, pulados, falhas
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// Exposto apenas para os testes locais (não afeta o funcionamento na Vercel)
module.exports._montarPrompt = montarPrompt;
