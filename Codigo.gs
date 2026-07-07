// ============================================
// APPS SCRIPT - BACKEND DA VOTAÇÃO
// ============================================

// 🔴 Ajuste se o nome das abas na sua planilha for diferente
const SHEET_RESPOSTAS = "Respostas";
const SHEET_JOGADORES = "Jogadores";

// ============================================
// HELPERS
// ============================================
function validarSenhaAdmin(senha) {
  const senhaCorreta = PropertiesService.getScriptProperties().getProperty("ADMIN_SENHA");
  return !!senhaCorreta && senha === senhaCorreta;
}

function respostaErro(mensagem) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "erro", mensagem: mensagem }))
    .setMimeType(ContentService.MimeType.JSON);
}

function respostaSucesso(dadosExtras) {
  const corpo = Object.assign({ status: "sucesso" }, dadosExtras || {});
  return ContentService
    .createTextOutput(JSON.stringify(corpo))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// doPost - roteia pela ação enviada
// ============================================
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const acao = dados.acao || "votar";

    switch (acao) {
      case "votar":
        return registrarVoto(dados);
      case "listarJogadores":
        return listarJogadores(dados);
      case "adicionarJogador":
        return adicionarJogador(dados);
      case "alterarStatusJogador":
        return alterarStatusJogador(dados);
      case "excluirJogador":
        return excluirJogador(dados);
      default:
        return respostaErro("❌ Ação inválida.");
    }
  } catch (error) {
    return respostaErro("❌ Erro: " + error.toString());
  }
}

// ============================================
// VOTAÇÃO
// ============================================
function registrarVoto(dados) {
  const lock = LockService.getScriptLock();
  const conseguiuLock = lock.tryLock(10000); // espera até 10s pela vez de escrever

  if (!conseguiuLock) {
    return respostaErro("⚠️ Muita gente votando ao mesmo tempo. Tente novamente em alguns segundos.");
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESPOSTAS);
    const nomeVotante = (dados.votante || "").trim();
    const nomeVotanteNormalizado = nomeVotante.toLowerCase();

    const nomes = sheet.getRange("B:B").getValues().flat();
    const jaVotou = nomes.some(nome => String(nome).trim().toLowerCase() === nomeVotanteNormalizado);
    if (jaVotou) {
      return respostaErro("⚠️ " + nomeVotante + " já votou!");
    }

    const timestamp = new Date();
    const linha = [timestamp, nomeVotante];

    const totalColunas = Math.max(sheet.getLastColumn() - 2, 0);
    const cabecalhos = totalColunas > 0
      ? sheet.getRange(1, 3, 1, totalColunas).getValues()[0]
      : [];

    cabecalhos.forEach(nomeJogador => {
      const voto = (dados.votos || {})[nomeJogador];
      linha.push(voto || "");
    });

    sheet.appendRow(linha);

    return respostaSucesso({ mensagem: "✅ Voto registrado com sucesso!" });
  } finally {
    lock.releaseLock();
  }
}

// ============================================
// ADMIN - JOGADORES
// ============================================
function listarJogadores(dados) {
  if (!validarSenhaAdmin(dados.senha)) return respostaErro("❌ Senha de admin inválida.");

  const sheetJogadores = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
  const ultimaLinha = sheetJogadores.getLastRow();
  if (ultimaLinha < 2) return respostaSucesso({ jogadores: [] });

  const valores = sheetJogadores.getRange(2, 1, ultimaLinha - 1, 2).getValues();
  const jogadores = valores
    .filter(linha => linha[0])
    .map(linha => ({ nome: String(linha[0]).trim(), ativo: linha[1] === true }));

  return respostaSucesso({ jogadores: jogadores });
}

function adicionarJogador(dados) {
  if (!validarSenhaAdmin(dados.senha)) return respostaErro("❌ Senha de admin inválida.");

  const nome = (dados.nome || "").trim();
  if (!nome) return respostaErro("❌ Informe o nome do jogador.");

  const sheetJogadores = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
  const ultimaLinha = sheetJogadores.getLastRow();
  const nomesExistentes = ultimaLinha >= 2
    ? sheetJogadores.getRange(2, 1, ultimaLinha - 1, 1).getValues().flat().map(n => String(n).trim().toLowerCase())
    : [];

  if (nomesExistentes.includes(nome.toLowerCase())) {
    return respostaErro("⚠️ Já existe um jogador com esse nome.");
  }

  sheetJogadores.appendRow([nome, true]);

  // Garante que exista uma coluna para esse jogador na aba de respostas
  const sheetRespostas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESPOSTAS);
  const totalColunas = Math.max(sheetRespostas.getLastColumn() - 2, 0);
  const cabecalhos = totalColunas > 0
    ? sheetRespostas.getRange(1, 3, 1, totalColunas).getValues()[0]
    : [];

  if (cabecalhos.indexOf(nome) === -1) {
    sheetRespostas.getRange(1, sheetRespostas.getLastColumn() + 1).setValue(nome);
  }

  return respostaSucesso({ mensagem: "✅ " + nome + " adicionado!" });
}

function alterarStatusJogador(dados) {
  if (!validarSenhaAdmin(dados.senha)) return respostaErro("❌ Senha de admin inválida.");

  const nome = (dados.nome || "").trim();
  const sheetJogadores = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
  const ultimaLinha = sheetJogadores.getLastRow();
  if (ultimaLinha < 2) return respostaErro("❌ Jogador não encontrado.");

  const valores = sheetJogadores.getRange(2, 1, ultimaLinha - 1, 1).getValues();

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === nome.toLowerCase()) {
      sheetJogadores.getRange(i + 2, 2).setValue(!!dados.ativo);
      return respostaSucesso({ mensagem: "✅ Status de " + nome + " atualizado!" });
    }
  }

  return respostaErro("❌ Jogador não encontrado.");
}

function excluirJogador(dados) {
  if (!validarSenhaAdmin(dados.senha)) return respostaErro("❌ Senha de admin inválida.");

  const nome = (dados.nome || "").trim();
  const sheetJogadores = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
  const ultimaLinha = sheetJogadores.getLastRow();
  if (ultimaLinha < 2) return respostaErro("❌ Jogador não encontrado.");

  const valores = sheetJogadores.getRange(2, 1, ultimaLinha - 1, 1).getValues();

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === nome.toLowerCase()) {
      sheetJogadores.deleteRow(i + 2);
      return respostaSucesso({ mensagem: "✅ " + nome + " removido!" });
    }
  }

  return respostaErro("❌ Jogador não encontrado.");
}

// ============================================
// doGet - busca votos + jogadores ativos (rota pública, sem senha)
// ============================================
function doGet(e) {
  try {
    const sheetRespostas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESPOSTAS);
    const dados = sheetRespostas.getDataRange().getValues();

    const cabecalhos = dados[0];
    const votos = [];
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      const voto = {};
      voto.votante = linha[1] || '';

      for (let j = 2; j < cabecalhos.length; j++) {
        const jogador = cabecalhos[j];
        const nivel = linha[j];
        if (jogador && nivel) {
          voto[jogador] = nivel;
        }
      }

      if (voto.votante && Object.keys(voto).length > 1) {
        votos.push(voto);
      }
    }

    const sheetJogadores = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
    const ultimaLinha = sheetJogadores.getLastRow();
    const jogadoresAtivos = ultimaLinha >= 2
      ? sheetJogadores.getRange(2, 1, ultimaLinha - 1, 2).getValues()
          .filter(linha => linha[0] && linha[1] === true)
          .map(linha => String(linha[0]).trim())
      : [];

    return respostaSucesso({ jogadores: jogadoresAtivos, votos: votos, total: votos.length });

  } catch (error) {
    return respostaErro(error.toString());
  }
}

// ============================================
// SETUP - rode estas funções UMA VEZ pelo editor do Apps Script
// ============================================

// 1) Cria a aba "Jogadores" já populada com o grupo atual
function configurarJogadoresIniciais() {
  const nomes = [
    "Ericleiton", "Willian", "Juliano", "Japão", "Marcelo", "Roni", "Filipe",
    "Guilherme GS Store", "Lucas", "Ricardo", "Guilherme Ipero", "Guilherme Boituva",
    "Paraiba", "Doninho", "Eduardo Ipero", "Eduardo Boituva", "Matheus Boituva",
    "Vinicius", "Welio", "Bombeiro", "Josildo", "Nelson", "Henrique"
  ];

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGADORES);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_JOGADORES);
  }
  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([["Nome", "Ativo"]]);
  sheet.getRange(2, 1, nomes.length, 2).setValues(nomes.map(n => [n, true]));
}

// 2) Define a senha do admin (troque "SUA_SENHA_AQUI" antes de rodar)
function configurarSenhaAdmin() {
  PropertiesService.getScriptProperties().setProperty("ADMIN_SENHA", "SUA_SENHA_AQUI");
}
