// =====================================================
// 🔧 CONFIGURAÇÃO
// =====================================================

// 🔴 COLOQUE AQUI O URL DO SEU APPS SCRIPT
const URL_API = "https://script.google.com/macros/s/AKfycbx8RFNl2dvEt-emLaZJlqjlcE0sjuXu-K5RqvnR3ewzoeBhD0_HpporWXHr81jTcytpFg/exec";

// Lista de jogadores ativos - carregada do servidor (aba "Jogadores" da planilha)
let JOGADORES = [];

// ⭐ NÍVEIS COM ESTRELAS (1 a 4 estrelas)
const NIVEL_OPCOES = [
    { estrelas: "⭐", nivel: "Não corre e nem marca", valor: 1 },
    { estrelas: "⭐⭐", nivel: "Preguiçoso", valor: 2 },
    { estrelas: "⭐⭐⭐", nivel: "Corre e marca", valor: 3 },
    { estrelas: "⭐⭐⭐⭐", nivel: "Joga bem", valor: 4 }
];

// =====================================================
// Código principal
// =====================================================
const form = document.getElementById('formVotacao');
const nomeInput = document.getElementById('nomeVotante');
const listaContainer = document.getElementById('listaJogadores');
const resultadoDiv = document.getElementById('resultado');
const erroGlobal = document.getElementById('erroGlobal');
const btnVotar = document.getElementById('btnVotar');
const btnVoltar = document.getElementById('btnVoltar');
const loading = document.getElementById('loading');

// Elementos da aba resultados
const loadingResultados = document.getElementById('loadingResultados');
const conteudoResultados = document.getElementById('conteudoResultados');
const totalVotos = document.getElementById('totalVotos');
const rankingLista = document.getElementById('rankingLista');
const porcentagemLista = document.getElementById('porcentagemLista');

// Elementos da aba admin
const adminLoginDiv = document.getElementById('adminLogin');
const adminPainelDiv = document.getElementById('adminPainel');
const senhaAdminInput = document.getElementById('senhaAdmin');
const erroAdmin = document.getElementById('erroAdmin');
const btnEntrarAdmin = document.getElementById('btnEntrarAdmin');
const novoJogadorNomeInput = document.getElementById('novoJogadorNome');
const btnAdicionarJogador = document.getElementById('btnAdicionarJogador');
const erroAdminPainel = document.getElementById('erroAdminPainel');
const listaAdminJogadores = document.getElementById('listaAdminJogadores');

let adminSenha = null;
let votoEmAndamento = false;

// =====================================================
// FUNÇÃO PARA BUSCAR DADOS DA PLANILHA
// =====================================================
async function buscarDadosPlanilha() {
    if (!URL_API) {
        totalVotos.textContent = '⚠️ URL_API não configurado! Configure no código.';
        rankingLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">⚠️ API não configurada</p>';
        porcentagemLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">⚠️ API não configurada</p>';
        return null;
    }

    try {
        const response = await fetch(URL_API + '?acao=buscar', {
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) throw new Error('Erro ao buscar dados');

        const dados = await response.json();
        return dados;
    } catch (error) {
        console.warn('Erro ao buscar dados da planilha:', error);
        totalVotos.textContent = '❌ Erro ao carregar dados: ' + error.message;
        rankingLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">❌ Erro ao carregar</p>';
        porcentagemLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">❌ Erro ao carregar</p>';
        return null;
    }
}

// =====================================================
// FUNÇÃO PARA CALCULAR RESULTADOS
// =====================================================
function calcularResultados(votos) {
    if (!votos || votos.length === 0) {
        return {
            total: 0,
            ranking: JOGADORES.map(jogador => ({
                nome: jogador,
                media: 0,
                totalVotos: 0,
                estrelas: '☆'
            })),
            porcentagens: {}
        };
    }

    const resultados = {};
    const totalVotantes = votos.length;

    // Inicializa resultados para cada jogador
    JOGADORES.forEach(jogador => {
        resultados[jogador] = {
            totalVotos: 0,
            somaEstrelas: 0,
            niveis: {
                "Não corre e nem marca": 0,
                "Preguiçoso": 0,
                "Corre e marca": 0,
                "Joga bem": 0
            }
        };
    });

    // Processa cada voto
    votos.forEach(voto => {
        Object.keys(voto).forEach(jogador => {
            if (jogador !== 'votante' && jogador !== 'timestamp' && jogador !== 'index') {
                const nivel = voto[jogador];
                if (nivel && resultados[jogador]) {
                    resultados[jogador].totalVotos++;

                    // Soma estrelas - com validação de segurança
                    const opcao = NIVEL_OPCOES.find(o => o.nivel === nivel);
                    if (opcao && typeof opcao.valor === 'number') {
                        resultados[jogador].somaEstrelas += opcao.valor;
                    }

                    // Conta por nível
                    if (resultados[jogador].niveis[nivel] !== undefined) {
                        resultados[jogador].niveis[nivel]++;
                    }
                }
            }
        });
    });

    // Calcula médias e porcentagens
    const ranking = [];
    const porcentagens = {};

    JOGADORES.forEach(jogador => {
        const dados = resultados[jogador];
        const total = dados.totalVotos;

        if (total > 0) {
            const soma = dados.somaEstrelas || 0;
            const media = soma / total;
            const mediaValida = Math.max(0, Math.min(4, media));

            ranking.push({
                nome: jogador,
                media: mediaValida,
                totalVotos: total,
                estrelas: mediaValida > 0 ? '⭐'.repeat(Math.round(mediaValida)) : '☆'
            });

            porcentagens[jogador] = {
                totalVotos: total,
                niveis: {}
            };

            NIVEL_OPCOES.forEach(opcao => {
                const count = dados.niveis[opcao.nivel] || 0;
                porcentagens[jogador].niveis[opcao.nivel] = {
                    count: count,
                    porcentagem: total > 0 ? (count / total) * 100 : 0,
                    estrelas: opcao.estrelas
                };
            });
        } else {
            ranking.push({
                nome: jogador,
                media: 0,
                totalVotos: 0,
                estrelas: '☆'
            });

            porcentagens[jogador] = {
                totalVotos: 0,
                niveis: {}
            };

            NIVEL_OPCOES.forEach(opcao => {
                porcentagens[jogador].niveis[opcao.nivel] = {
                    count: 0,
                    porcentagem: 0,
                    estrelas: opcao.estrelas
                };
            });
        }
    });

    ranking.sort((a, b) => b.media - a.media);

    return {
        total: totalVotantes,
        ranking: ranking,
        porcentagens: porcentagens
    };
}

// =====================================================
// FUNÇÃO PARA EXIBIR RESULTADOS
// =====================================================
function exibirResultados(dados) {
    if (!dados || dados.total === 0) {
        totalVotos.textContent = '📊 Nenhum voto registrado ainda. Seja o primeiro a votar! 🗳️';
        rankingLista.innerHTML = '<p style="text-align:center; color:#667781; padding:20px;">Aguardando votos...</p>';
        porcentagemLista.innerHTML = '<p style="text-align:center; color:#667781; padding:20px;">Aguardando votos...</p>';
        return;
    }

    // Total de votos
    totalVotos.textContent = `📊 Total de votos: ${dados.total} pessoa(s) já votaram!`;

    // Ranking - agrupado por nível arredondado (⭐⭐⭐⭐ Joga bem, ⭐⭐⭐ Corre e marca, ...)
    const grupos = [4, 3, 2, 1].map(valor => ({
        valor,
        opcao: NIVEL_OPCOES.find(o => o.valor === valor),
        jogadores: []
    }));
    const semVotos = [];

    dados.ranking.forEach(item => {
        if (item.totalVotos === 0) {
            semVotos.push(item);
            return;
        }
        const nivelArredondado = Math.min(4, Math.max(1, Math.round(item.media)));
        const grupo = grupos.find(g => g.valor === nivelArredondado);
        grupo.jogadores.push(item);
    });

    grupos.forEach(grupo => {
        grupo.jogadores.sort((a, b) => b.media - a.media);
    });

    let rankingHTML = '';
    grupos.forEach(grupo => {
        if (grupo.jogadores.length === 0) return;

        rankingHTML += `
            <div class="ranking-grupo">
                <div class="ranking-grupo-titulo">
                    <span class="estrelas">${grupo.opcao.estrelas}</span>
                    <span>${grupo.opcao.nivel}</span>
                </div>
        `;

        grupo.jogadores.forEach(item => {
            rankingHTML += `
                <div class="ranking-item">
                    <span class="nome-jogador">${item.nome}</span>
                    <span class="media-numero">${item.media.toFixed(1)}</span>
                </div>
            `;
        });

        rankingHTML += `</div>`;
    });

    if (semVotos.length > 0) {
        rankingHTML += `
            <div class="ranking-grupo">
                <div class="ranking-grupo-titulo">
                    <span class="estrelas">☆</span>
                    <span>Aguardando votos</span>
                </div>
        `;

        semVotos.forEach(item => {
            rankingHTML += `
                <div class="ranking-item">
                    <span class="nome-jogador">${item.nome}</span>
                    <span class="media-numero">-</span>
                </div>
            `;
        });

        rankingHTML += `</div>`;
    }

    rankingLista.innerHTML = rankingHTML;

    // Porcentagens por jogador
    let porcentagemHTML = '';
    JOGADORES.forEach(jogador => {
        const dadosJogador = dados.porcentagens[jogador];
        if (!dadosJogador) return;

        porcentagemHTML += `
            <div class="jogador-resultado">
                <div class="nome">${jogador} <span style="font-weight:400; color:#667781; font-size:12px;">(${dadosJogador.totalVotos} votos)</span></div>
                <div class="niveis">
        `;

        NIVEL_OPCOES.forEach(opcao => {
            const nivel = dadosJogador.niveis[opcao.nivel];
            const pct = nivel ? nivel.porcentagem : 0;
            const count = nivel ? nivel.count : 0;
            const cor = pct > 50 ? '#25D366' : pct > 25 ? '#f1c40f' : '#e74c3c';

            porcentagemHTML += `
                <div class="nivel-item">
                    <span class="estrela">${opcao.estrelas}</span>
                    <span style="flex:1; font-size:10px; color:#667781;">${count}</span>
                    <div class="barra-pequena">
                        <div class="fill" style="width:${pct}%; background:${cor};"></div>
                    </div>
                    <span class="porcentagem" style="color:${cor};">${pct.toFixed(0)}%</span>
                </div>
            `;
        });

        porcentagemHTML += `
                </div>
            </div>
        `;
    });
    porcentagemLista.innerHTML = porcentagemHTML;
}

// =====================================================
// FUNÇÃO PARA CARREGAR RESULTADOS DA PLANILHA
// =====================================================
async function carregarResultados() {
    loadingResultados.style.display = 'block';
    conteudoResultados.style.display = 'none';

    try {
        const dados = await buscarDadosPlanilha();

        if (dados && dados.jogadores) {
            JOGADORES = dados.jogadores;
            // Mantém a votação sincronizada com a lista de jogadores do servidor
            // (ex: admin adicionou/inativou alguém), mas nunca depois que a pessoa já
            // começou a marcar votos, pra não apagar o que ela já preencheu.
            if (!votoEmAndamento) {
                renderizarJogadores();
            }
        }

        if (dados && dados.votos && dados.votos.length > 0) {
            const resultados = calcularResultados(dados.votos);
            exibirResultados(resultados);
        } else if (dados && dados.votos && dados.votos.length === 0) {
            totalVotos.textContent = '📊 Nenhum voto registrado ainda. Seja o primeiro a votar! 🗳️';
            rankingLista.innerHTML = '<p style="text-align:center; color:#667781; padding:20px;">Aguardando votos...</p>';
            porcentagemLista.innerHTML = '<p style="text-align:center; color:#667781; padding:20px;">Aguardando votos...</p>';
        } else {
            totalVotos.textContent = '⚠️ Não foi possível carregar os dados.';
        }
    } catch (error) {
        console.error('Erro ao carregar resultados:', error);
        totalVotos.textContent = '❌ Erro ao carregar resultados';
        rankingLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">❌ Erro no carregamento</p>';
        porcentagemLista.innerHTML = '<p style="text-align:center; color:#e74c3c; padding:20px;">❌ Erro no carregamento</p>';
    }

    loadingResultados.style.display = 'none';
    conteudoResultados.style.display = 'block';
}

// =====================================================
// FUNÇÃO PARA RENDERIZAR JOGADORES NO FORMULÁRIO
// =====================================================
function renderizarJogadores() {
    listaContainer.innerHTML = '';

    JOGADORES.forEach((nome, index) => {
        const card = document.createElement('div');
        card.className = 'jogador-card';
        card.setAttribute('data-index', index);

        const nomeHTML = `
            <div class="jogador-nome">
                ${nome}
                <span class="badge">${index + 1}</span>
            </div>
        `;

        const opcoesHTML = NIVEL_OPCOES.map((opcao, opIndex) => {
            const id = `jogador_${index}_${opIndex}`;
            return `
                <div class="opcao">
                    <input type="radio"
                           name="jogador_${index}"
                           value="${opcao.nivel}"
                           id="${id}">
                    <label for="${id}">
                        <span class="estrelas-texto">${opcao.estrelas}</span>
                        <span class="nivel-texto">${opcao.nivel}</span>
                    </label>
                </div>
            `;
        }).join('');

        card.innerHTML = nomeHTML + `<div class="opcoes">${opcoesHTML}</div>`;
        listaContainer.appendChild(card);
    });
}

// =====================================================
// VALIDAÇÃO E ENVIO DO VOTO
// =====================================================
function validarVotos() {
    const cards = document.querySelectorAll('.jogador-card');
    let todosVotados = true;

    cards.forEach((card, index) => {
        const radios = card.querySelectorAll(`input[name="jogador_${index}"]`);
        let marcado = false;
        radios.forEach(r => { if (r.checked) marcado = true; });
        if (!marcado) {
            todosVotados = false;
            card.style.borderColor = '#e74c3c';
            card.style.background = '#fdf0f0';
        } else {
            card.style.borderColor = '#eef2f5';
            card.style.background = '#f8fafc';
        }
    });

    return todosVotados;
}

function coletarDados() {
    const nome = nomeInput.value.trim();
    if (!nome) {
        erroGlobal.textContent = '❌ Por favor, digite seu nome.';
        erroGlobal.classList.add('show');
        return null;
    }
    erroGlobal.classList.remove('show');

    if (!validarVotos()) {
        erroGlobal.textContent = '❌ Você precisa votar em TODOS os jogadores.';
        erroGlobal.classList.add('show');
        return null;
    }

    const votos = {};
    JOGADORES.forEach((nomeJogador, index) => {
        const radios = document.querySelectorAll(`input[name="jogador_${index}"]`);
        let valor = '';
        radios.forEach(r => { if (r.checked) valor = r.value; });
        votos[nomeJogador] = valor;
    });

    return { acao: 'votar', votante: nome, votos };
}

async function enviarVoto(dados) {
    loading.classList.add('show');
    btnVotar.disabled = true;
    erroGlobal.classList.remove('show');

    try {
        const response = await fetch(URL_API, {
            method: 'POST',
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        loading.classList.remove('show');

        if (resultado.status === 'erro') {
            btnVotar.disabled = false;
            erroGlobal.textContent = resultado.mensagem || '❌ Não foi possível registrar seu voto.';
            erroGlobal.classList.add('show');
            return;
        }

        resultadoDiv.classList.add('show');
        form.style.display = 'none';

        // Recarrega os resultados após votar
        setTimeout(() => {
            carregarResultados();
        }, 1000);

    } catch (error) {
        loading.classList.remove('show');
        btnVotar.disabled = false;
        erroGlobal.textContent = '❌ Erro ao enviar. Tente novamente.';
        erroGlobal.classList.add('show');
        console.error('Erro:', error);
    }
}

function voltarFormulario() {
    form.style.display = 'block';
    resultadoDiv.classList.remove('show');
    btnVotar.disabled = false;
    votoEmAndamento = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// SISTEMA DE ABAS
// =====================================================
function alternarAba(abaId) {
    document.querySelectorAll('.aba-conteudo').forEach(el => {
        el.classList.remove('active');
    });

    document.querySelectorAll('.aba-btn').forEach(el => {
        el.classList.remove('active');
    });

    const abaSelecionada = document.getElementById(`aba-${abaId}`);
    if (abaSelecionada) {
        abaSelecionada.classList.add('active');
    }

    const botaoSelecionado = document.querySelector(`.aba-btn[data-aba="${abaId}"]`);
    if (botaoSelecionado) {
        botaoSelecionado.classList.add('active');
    }

    if (abaId === 'resultados') {
        carregarResultados();
    }
}

document.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const aba = this.getAttribute('data-aba');
        alternarAba(aba);
    });
});

// =====================================================
// EVENT LISTENERS DO FORMULÁRIO
// =====================================================

if (form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const dados = coletarDados();
        if (dados) {
            enviarVoto(dados);
        }
    });
}

if (btnVoltar) {
    btnVoltar.addEventListener('click', voltarFormulario);
}

document.addEventListener('change', function(e) {
    if (e.target && e.target.type === 'radio') {
        votoEmAndamento = true;
        erroGlobal.classList.remove('show');
        const card = e.target.closest('.jogador-card');
        if (card) {
            card.style.borderColor = '#eef2f5';
            card.style.background = '#f8fafc';
        }
    }
});

if (nomeInput) {
    nomeInput.addEventListener('input', function() {
        erroGlobal.classList.remove('show');
    });
}

// =====================================================
// ADMIN - GERENCIAMENTO DE JOGADORES
// =====================================================
async function chamarApiAdmin(acao, extras) {
    const response = await fetch(URL_API, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ acao: acao, senha: adminSenha }, extras || {}))
    });
    return response.json();
}

async function entrarAdmin() {
    const senha = senhaAdminInput.value;
    if (!senha) {
        erroAdmin.textContent = '❌ Digite a senha.';
        erroAdmin.classList.add('show');
        return;
    }

    btnEntrarAdmin.disabled = true;
    erroAdmin.classList.remove('show');
    adminSenha = senha;

    const resultado = await chamarApiAdmin('listarJogadores');

    btnEntrarAdmin.disabled = false;

    if (resultado.status === 'erro') {
        adminSenha = null;
        erroAdmin.textContent = resultado.mensagem || '❌ Senha inválida.';
        erroAdmin.classList.add('show');
        return;
    }

    adminLoginDiv.style.display = 'none';
    adminPainelDiv.style.display = 'block';
    renderizarPainelAdmin(resultado.jogadores);
}

function renderizarPainelAdmin(jogadores) {
    if (!jogadores || jogadores.length === 0) {
        listaAdminJogadores.innerHTML = '<p style="text-align:center; color:#667781; padding:16px;">Nenhum jogador cadastrado.</p>';
        return;
    }

    listaAdminJogadores.innerHTML = jogadores.map(j => `
        <div class="admin-jogador-item">
            <span class="nome-jogador">${j.nome}</span>
            <span class="status-badge ${j.ativo ? 'ativo' : 'inativo'}">${j.ativo ? 'Ativo' : 'Inativo'}</span>
            <button class="btn-toggle" data-nome="${j.nome}" data-ativo="${j.ativo}">${j.ativo ? 'Inativar' : 'Ativar'}</button>
            <button class="btn-excluir" data-nome="${j.nome}">Excluir</button>
        </div>
    `).join('');
}

async function recarregarPainelAdmin() {
    const resultado = await chamarApiAdmin('listarJogadores');
    if (resultado.status === 'erro') {
        erroAdminPainel.textContent = resultado.mensagem;
        erroAdminPainel.classList.add('show');
        return;
    }
    renderizarPainelAdmin(resultado.jogadores);
}

async function adicionarJogadorAdmin() {
    const nome = novoJogadorNomeInput.value.trim();
    if (!nome) {
        erroAdminPainel.textContent = '❌ Digite o nome do jogador.';
        erroAdminPainel.classList.add('show');
        return;
    }

    erroAdminPainel.classList.remove('show');
    btnAdicionarJogador.disabled = true;

    const resultado = await chamarApiAdmin('adicionarJogador', { nome });

    btnAdicionarJogador.disabled = false;

    if (resultado.status === 'erro') {
        erroAdminPainel.textContent = resultado.mensagem;
        erroAdminPainel.classList.add('show');
        return;
    }

    novoJogadorNomeInput.value = '';
    await recarregarPainelAdmin();
}

async function alterarStatusJogadorAdmin(nome, ativoAtual) {
    const resultado = await chamarApiAdmin('alterarStatusJogador', { nome, ativo: !ativoAtual });
    if (resultado.status === 'erro') {
        erroAdminPainel.textContent = resultado.mensagem;
        erroAdminPainel.classList.add('show');
        return;
    }
    await recarregarPainelAdmin();
}

async function excluirJogadorAdmin(nome) {
    if (!confirm(`Remover ${nome} definitivamente da lista de jogadores?`)) return;

    const resultado = await chamarApiAdmin('excluirJogador', { nome });
    if (resultado.status === 'erro') {
        erroAdminPainel.textContent = resultado.mensagem;
        erroAdminPainel.classList.add('show');
        return;
    }
    await recarregarPainelAdmin();
}

if (btnEntrarAdmin) {
    btnEntrarAdmin.addEventListener('click', entrarAdmin);
}

if (senhaAdminInput) {
    senhaAdminInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') entrarAdmin();
    });
}

if (btnAdicionarJogador) {
    btnAdicionarJogador.addEventListener('click', adicionarJogadorAdmin);
}

if (listaAdminJogadores) {
    listaAdminJogadores.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const nome = btn.getAttribute('data-nome');
        if (btn.classList.contains('btn-toggle')) {
            const ativoAtual = btn.getAttribute('data-ativo') === 'true';
            alterarStatusJogadorAdmin(nome, ativoAtual);
        } else if (btn.classList.contains('btn-excluir')) {
            excluirJogadorAdmin(nome);
        }
    });
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================
async function inicializar() {
    const dados = await buscarDadosPlanilha();
    if (dados && dados.jogadores) {
        JOGADORES = dados.jogadores;
    }
    renderizarJogadores();

    setTimeout(() => {
        carregarResultados();
    }, 500);
}

inicializar();

console.log('✅ Formulário carregado com segurança!');
