// --- CONFIGURAÇÃO DO SUPABASE ---
// SUBSTITUA PELAS SUAS CHAVES DO PROJETO
const SUPABASE_URL = 'https://mmbhumfbmrynalzmcmxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYmh1bWZibXJ5bmFsem1jbXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDIwNjksImV4cCI6MjA4MDkxODA2OX0.uBKKZ1NYTekEVb9l4OFtP6TPrhNZ3i8rq0Huf_CHE-4';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILITÁRIOS ---
function formatarDataSemFuso(dataString) {
    if (!dataString) return '-';
    const dataLimpa = dataString.split('T')[0];
    const [ano, mes, dia] = dataLimpa.split('-');
    return `${dia}/${mes}/${ano}`;
}

function carregarImagem(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { console.warn("Imagem não encontrada: " + url); resolve(null); }
    });
}

// --- 1. ROTEAMENTO E SEGURANÇA ---
async function checkAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    const path = window.location.pathname;
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/project-folder/');

    if (!session && !isLoginPage) window.location.href = 'index.html';
    else if (session && isLoginPage) window.location.href = 'dashboard.html';
    return session;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (document.getElementById('loginForm')) setupLogin();
    if (document.getElementById('cadastroForm')) setupDashboard(session);
    if (document.getElementById('uploadForm')) setupDocumentosPage();
    if (document.getElementById('produtoForm')) setupProdutosPage();
    if (document.getElementById('vistoriaForm')) setupVistoriasPage();
});

// --- 2. LOGIN ---
function setupLogin() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('message');
        msgDiv.textContent = "Verificando...";
        const { error } = await _supabase.auth.signInWithPassword({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        });
        if (error) { msgDiv.textContent = "Erro: " + error.message; msgDiv.style.color = "red"; }
        else { window.location.href = 'dashboard.html'; }
    });
}

// --- 3. DASHBOARD ---
function setupDashboard(session) {
    document.getElementById('userEmail').textContent = session.user.email;
    const inputCnpj = document.getElementById('cnpj');
    inputCnpj.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length <= 11) v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        else v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
        e.target.value = v;
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => { await _supabase.auth.signOut(); window.location.href = 'index.html'; });

    document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            numero_sim: document.getElementById('numSim').value,
            data_registro: document.getElementById('dataRegistro').value || null,
            cnpj_cpf: document.getElementById('cnpj').value,
            razao_social: document.getElementById('razaoSocial').value,
            nome_fantasia: document.getElementById('nomeFantasia').value,
            inscricao_estadual: document.getElementById('inscricaoEstadual').value,
            nome_proprietario: document.getElementById('nomeProprietario').value,
            classificacao: document.getElementById('classificacao').value,
            especie_abatida: document.getElementById('especieAbatida').value,
            endereco: document.getElementById('endereco').value,
            cep: document.getElementById('cep').value,
            municipio: document.getElementById('municipio').value,
            telefone: document.getElementById('telefone').value,
            email_contato: document.getElementById('emailContato').value,
            responsavel_tecnico: document.getElementById('responsavelTecnico').value,
            crmv: document.getElementById('crmv').value,
            status: 'ativo'
        };
        const { error } = await _supabase.from('estabelecimentos').insert([dados]);
        if (error) alert('Erro: ' + error.message);
        else { alert('Sucesso!'); e.target.reset(); carregarEstabelecimentos(); }
    });

    let timeout = null;
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => carregarEstabelecimentos(e.target.value), 500);
    });
    carregarEstabelecimentos();
}

async function carregarEstabelecimentos(busca = '') {
    const tbody = document.querySelector('#tabelaEstabelecimentos tbody');
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    let query = _supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false });
    if (busca) query = query.or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj_cpf.ilike.%${busca}%`);

    const { data } = await query;
    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6">Nenhum registro.</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(item => {
        const isAtivo = item.status === 'ativo';
        const nome = item.nome_fantasia ? `<strong>${item.nome_fantasia}</strong><br><small>${item.razao_social}</small>` : `<strong>${item.razao_social}</strong>`;
        
        // Layout dos botões conforme solicitado (Coloridos e com Ícones)
        tbody.innerHTML += `<tr>
            <td>${item.numero_sim || '-'}</td>
            <td>${nome}</td>
            <td>${item.cnpj_cpf}</td>
            <td>${item.classificacao}</td>
            <td><span style="color:${isAtivo ? 'green' : 'red'}; font-weight:bold">${item.status.toUpperCase()}</span></td>
            <td>
                <div class="action-buttons" style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button onclick="gerarTitulo(${item.id})" class="btn-action" style="background:#2c3e50; color:white; padding:6px; border:none; border-radius:4px; cursor:pointer;" title="Gerar Título"><i class="fas fa-certificate"></i> Título</button>
                    <a href="documentos.html?id=${item.id}" class="btn-action" style="background:#3498db; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-folder"></i> Docs</a>
                    <a href="produtos.html?id=${item.id}" class="btn-action" style="background:#e67e22; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-drumstick-bite"></i> Prod</a>
                    <a href="vistorias.html?id=${item.id}" class="btn-action" style="background:#8e44ad; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-clipboard-check"></i> Vist</a>
                    <button onclick="excluirEstabelecimento(${item.id})" class="btn-action" style="background:#c0392b; color:white; padding:6px; border:none; border-radius:4px;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

// --- FUNÇÃO RNC (RESTAURADA - Versão Completa com Brasões e Assinaturas Originais) ---
async function gerarRNC(vistoriaId) {
    const embasamentoLegal = prompt("Embasamento Legal:", "Decreto Estadual 53.848/2017 e Lei Municipal vigente");
    if (embasamentoLegal === null) return;

    const [logoCamaqua, logoSim] = await Promise.all([
        carregarImagem('./assets/brasao_camaqua.png'), // ESQUERDA
        carregarImagem('./assets/logo_sim.png')        // DIREITA
    ]);

    const { data: vistoria } = await _supabase.from('vistorias').select('*').eq('id', vistoriaId).single();
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', vistoria.estabelecimento_id).single();

    let numeroRNC = vistoria.rnc_numero;
    let anoRNC = vistoria.rnc_ano;
    const anoAtual = new Date().getFullYear();

    if (!numeroRNC) {
        const { data: ultimas } = await _supabase.from('vistorias').select('rnc_numero').eq('rnc_ano', anoAtual).order('rnc_numero', { ascending: false }).limit(1);
        const proximoNumero = (ultimas && ultimas.length > 0) ? ultimas[0].rnc_numero + 1 : 1;
        await _supabase.from('vistorias').update({ rnc_numero: proximoNumero, rnc_ano: anoAtual }).eq('id', vistoriaId);
        numeroRNC = proximoNumero;
        anoRNC = anoAtual;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const centroX = 105;

    // --- CABEÇALHO DO RNC ---
    if (logoCamaqua) doc.addImage(logoCamaqua, 'PNG', 15, 10, 25, 25);
    if (logoSim) doc.addImage(logoSim, 'PNG', 170, 10, 25, 25); 

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("GOVERNO DO ESTADO DO RIO GRANDE DO SUL", centroX, 15, { align: "center" });
    
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", centroX, 20, { align: "center" });
    
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", centroX, 25, { align: "center" });
    doc.text("SERVIÇO DE INSPEÇÃO MUNICIPAL", centroX, 30, { align: "center" });

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE NÃO CONFORMIDADE", centroX, 45, { align: "center" });

    // --- TABELAS DO RNC ---
    doc.autoTable({
        startY: 50,
        head: [['NÚMERO', 'SIM', 'DATA']],
        body: [[`${numeroRNC}/${anoRNC}`, est.numero_sim, formatarDataSemFuso(vistoria.data_vistoria)]],
        theme: 'grid', styles: { halign: 'center', fillColor: [240, 240, 240] }, headStyles: { fillColor: [44, 62, 80] }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 2,
        body: [[`ESTABELECIMENTO: ${est.razao_social.toUpperCase()}`]],
        theme: 'plain', styles: { fontSize: 11, fontStyle: 'bold' }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
            ['EMBASAMENTO LEGAL', embasamentoLegal],
            ['ELEMENTO DE INSPEÇÃO', 'Higiene Operacional / Estrutural / Processos'],
            ['NÃO CONFORMIDADES', vistoria.observacoes || "Vide relatório fotográfico anexo."]
        ],
        theme: 'grid',
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: [240, 240, 240] } }
    });

    // Aviso
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const aviso = doc.splitTextToSize("Este documento é uma notificação por escrito da falha em atender às exigências regulamentares e pode resultar em adicional ação administrativa e legal.", 190);
    
    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY > 260) { doc.addPage(); finalY = 20; }
    doc.text(aviso, 14, finalY);

    // --- ASSINATURAS DO RNC (RESTAURADAS: JAMES E REJANE) ---
    let yAssin = finalY + 30;
    if (yAssin > 270) { doc.addPage(); yAssin = 40; }

    doc.line(14, yAssin, 100, yAssin);
    doc.text("James William Bet", 14, yAssin + 5);
    doc.setFontSize(8); doc.text("Médico Veterinário Oficial - CRMV RS 10776", 14, yAssin + 9);

    doc.line(110, yAssin, 196, yAssin);
    doc.setFontSize(9); doc.text("Rejane Werenicz da Costa", 110, yAssin + 5);
    doc.setFontSize(8); doc.text("Médica Veterinária Oficial - CRMV-RS 6996", 110, yAssin + 9);

    // Rodapé
    const textoFinal = prompt("Texto do Plano de Ação (Rodapé)?", "A resposta do estabelecimento deverá ser formalizada em documento oficial... prazo máximo de 15 (quinze) dias úteis.");
    doc.autoTable({
        startY: yAssin + 20,
        head: [['INSTRUÇÕES PARA O PLANO DE AÇÃO']],
        body: [[textoFinal]],
        theme: 'grid', styles: { fontSize: 8, fontStyle: 'italic', cellPadding: 4 }, headStyles: { fillColor: [100, 100, 100] }
    });

    doc.save(`RNC_${numeroRNC}_${anoRNC}_${est.razao_social}.pdf`);
    carregarVistorias(vistoriaId);
}

// --- FUNÇÃO TÍTULO (VERSÃO APROVADA: Classificação no topo, Portaria, Assinatura espaçada) ---
async function gerarTitulo(id) {
    const portaria = prompt("Por favor, informe os dados da Portaria de Nomeação do Coordenador:", "Portaria Nº XXXX/2025");
    if (portaria === null) return; 

    if(!confirm("Confirma a geração do Título de Registro com os dados informados?")) return;

    const [logoCamaqua, logoSim] = await Promise.all([
        carregarImagem('./assets/brasao_camaqua.png'),
        carregarImagem('./assets/logo_sim.png')
    ]);

    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', id).single();
    if (!est) return alert("Erro ao buscar dados.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const centroX = width / 2;

    doc.setLineWidth(1.5); doc.setDrawColor(44, 62, 80);
    doc.rect(10, 10, width - 20, height - 20);
    doc.setLineWidth(0.5);
    doc.rect(12, 12, width - 24, height - 24);

    if (logoCamaqua) doc.addImage(logoCamaqua, 'PNG', 20, 18, 28, 28);
    if (logoSim) doc.addImage(logoSim, 'PNG', width - 48, 18, 28, 28);

    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", centroX, 24, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", centroX, 30, { align: "center" });
    doc.text("SERVIÇO DE INSPEÇÃO MUNICIPAL - SIM", centroX, 35, { align: "center" });

    doc.setFont("times", "bold"); doc.setFontSize(26); doc.setTextColor(44, 62, 80);
    doc.text("TÍTULO DE REGISTRO", centroX, 52, { align: "center" });
    doc.setFontSize(15); doc.setTextColor(0);
    doc.text(`Nº ${est.numero_sim}`, centroX, 60, { align: "center" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    const texto = "O Serviço de Inspeção Municipal de Camaquã CERTIFICA que o estabelecimento abaixo identificado encontra-se devidamente registrado e apto a funcionar de acordo com a legislação sanitária vigente.";
    doc.text(doc.splitTextToSize(texto, 240), centroX, 75, { align: "center" });

    // BLOCO DE DADOS (Organizado e Espaçado)
    const startY = 95;
    const gap = 16;
    doc.setDrawColor(200); doc.setLineWidth(0.1);

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
    doc.text("CLASSIFICAÇÃO DO ESTABELECIMENTO", 30, startY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0);
    doc.text(est.classificacao.toUpperCase(), 30, startY + 6);

    const linha2Y = startY + gap;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
    doc.text("NOME EMPRESARIAL", 30, linha2Y);
    doc.text("NOME FANTASIA", 130, linha2Y);
    doc.text("DATA REGISTRO", 230, linha2Y);

    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0);
    const razao = doc.splitTextToSize(est.razao_social.toUpperCase(), 90);
    const fantasia = doc.splitTextToSize((est.nome_fantasia || "-").toUpperCase(), 90);
    doc.text(razao, 30, linha2Y + 5);
    doc.text(fantasia, 130, linha2Y + 5);
    doc.text(formatarDataSemFuso(est.data_registro), 230, linha2Y + 5);

    const linha3Y = startY + (gap * 2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
    doc.text("CNPJ / CPF", 30, linha3Y); 
    doc.text("INSCRIÇÃO ESTADUAL", 130, linha3Y); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0);
    doc.text(est.cnpj_cpf, 30, linha3Y + 5);
    doc.text(est.inscricao_estadual || "ISENTO", 130, linha3Y + 5);

    const linha4Y = startY + (gap * 3);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100);
    doc.text("LOGRADOURO / LOCALIZAÇÃO", 30, linha4Y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`${est.endereco}, ${est.municipio} - CEP: ${est.cep || ""}`.toUpperCase(), 30, linha4Y + 5);

    // Rodapé
    const hoje = new Date();
    const dataExtenso = hoje.toLocaleDateString('pt-BR', {year:'numeric', month:'long', day:'numeric'});
    const yAssinatura = 175;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Camaquã - RS, ${dataExtenso}`, centroX, yAssinatura - 15, { align: "center" });

    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(centroX - 70, yAssinatura, centroX + 70, yAssinatura); 
    
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("COORDENADOR DO SERVIÇO DE INSPEÇÃO MUNICIPAL", centroX, yAssinatura + 5, { align: "center" });
    
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(portaria, centroX, yAssinatura + 10, { align: "center" });

    doc.save(`TITULO_SIM_${est.numero_sim}_${est.razao_social}.pdf`);
}

// --- VISTORIAS, DOCS E PRODUTOS (MANTER PADRÃO) ---
async function setupVistoriasPage() {
    const estId = new URLSearchParams(window.location.search).get('id');
    if (!estId) { window.location.href = 'dashboard.html'; return; }

    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if (est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia || est.razao_social;

    const inputDataVistoria = document.getElementById('dataVistoria');
    const selectPrazo = document.getElementById('prazoProxima');
    const inputDataProxima = document.getElementById('dataProxima');

    const hoje = new Date().toISOString().split('T')[0];
    inputDataVistoria.value = hoje;

    function calcularData() {
        const dataBaseStr = inputDataVistoria.value || hoje;
        const dataBase = new Date(dataBaseStr + 'T00:00:00');
        const dias = parseInt(selectPrazo.value);
        dataBase.setDate(dataBase.getDate() + dias);
        inputDataProxima.value = dataBase.toISOString().split('T')[0];
    }
    selectPrazo.addEventListener('change', calcularData);
    inputDataVistoria.addEventListener('change', calcularData);
    calcularData();

    document.getElementById('vistoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('arquivoVistoria').files[0];
        const btn = document.getElementById('btnSalvarVistoria');
        const statusMsg = document.getElementById('statusMsg');

        if (!file) return;
        btn.disabled = true; statusMsg.textContent = "Enviando...";

        const nome = `vistoria_${estId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: upErr } = await _supabase.storage.from('documentos-sim').upload(nome, file);
        if (upErr) { alert('Erro: ' + upErr.message); btn.disabled = false; return; }

        const { data: { publicUrl } } = _supabase.storage.from('documentos-sim').getPublicUrl(nome);
        await _supabase.from('vistorias').insert([{
            estabelecimento_id: estId,
            data_vistoria: inputDataVistoria.value,
            status: document.getElementById('statusVistoria').value,
            observacoes: document.getElementById('obsVistoria').value,
            dias_para_proxima: selectPrazo.value,
            data_proxima_vistoria: inputDataProxima.value,
            url_anexo: publicUrl
        }]);

        alert('Sucesso!'); e.target.reset(); inputDataVistoria.value = hoje; calcularData(); statusMsg.textContent = ""; btn.disabled = false; carregarVistorias(estId);
    });
    carregarVistorias(estId);
}

async function carregarVistorias(estId) {
    const tbody = document.querySelector('#tabelaVistorias tbody');
    tbody.innerHTML = '';
    const { data } = await _supabase.from('vistorias').select('*').eq('estabelecimento_id', estId).order('data_vistoria', {ascending: false});
    if(!data) return;
    
    data.forEach(v => {
        let cor = '#c0392b', icone = '🚫', texto = 'GRAVES DEFICIÊNCIAS';
        if (v.status === 'satisfatoria' || v.status === 'conforme') { cor = '#27ae60'; icone = '✅'; texto = 'SATISFATÓRIA'; }
        else if (v.status === 'com_deficiencias') { cor = '#f39c12'; icone = '⚠️'; texto = 'COM DEFICIÊNCIAS'; }

        const btnRNC = (v.status !== 'satisfatoria' && v.status !== 'conforme') 
            ? `<button onclick="gerarRNC(${v.id})" style="background:#34495e; color:white; padding:5px; border-radius:4px; margin-right:5px; border:none; cursor:pointer;">RNC</button>` : '';

        tbody.innerHTML += `<tr>
            <td>${formatarDataSemFuso(v.data_vistoria)}</td>
            <td><span style="background:${cor}; color:white; padding:5px; border-radius:4px;">${icone} ${texto}</span></td>
            <td><a href="${v.url_anexo}" target="_blank">Ver</a></td>
            <td>${formatarDataSemFuso(v.data_proxima_vistoria)}</td>
            <td>${btnRNC}<button onclick="deletarItem('vistorias', ${v.id})" style="color:red; border:none; background:none; cursor:pointer;">X</button></td>
        </tr>`;
    });
}

// --- FUNÇÕES DE ARQUIVOS (DOCS E PRODUTOS) ---
async function setupDocumentosPage() {
    const estId = new URLSearchParams(window.location.search).get('id'); if (!estId) return;
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if(est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia;
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const file = document.getElementById('arquivoInput').files[0];
        const nome = `${estId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;
        const {data} = await _supabase.storage.from('documentos-sim').upload(nome, file);
        const url = _supabase.storage.from('documentos-sim').getPublicUrl(nome).data.publicUrl;
        await _supabase.from('documentos').insert([{estabelecimento_id: estId, nome_arquivo: file.name, tipo_documento: document.getElementById('tipoDoc').value, url_arquivo: url}]);
        alert('Ok'); carregarDocumentos(estId);
    });
    carregarDocumentos(estId);
}
async function carregarDocumentos(id) {
    const { data } = await _supabase.from('documentos').select('*').eq('estabelecimento_id', id);
    const tbody = document.querySelector('#tabelaDocumentos tbody'); tbody.innerHTML = '';
    data.forEach(d => tbody.innerHTML += `<tr><td>${formatarDataSemFuso(d.created_at)}</td><td>${d.tipo_documento}</td><td><a href="${d.url_arquivo}" target="_blank">Ver</a></td><td><button onclick="deletarItem('documentos',${d.id})">X</button></td></tr>`);
}
async function setupProdutosPage() {
    const estId = new URLSearchParams(window.location.search).get('id'); if (!estId) return;
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if(est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia;
    document.getElementById('produtoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await _supabase.from('produtos').insert([{estabelecimento_id: estId, numero_registro_produto: document.getElementById('numRegistroProd').value, nome: document.getElementById('nomeProd').value, marca: document.getElementById('marcaProd').value, embalagem: document.getElementById('embalagemProd').value, apresentacao_peso: document.getElementById('pesoProd').value}]);
        alert('Ok'); carregarProdutos(estId);
    });
    carregarProdutos(estId);
}
async function carregarProdutos(id) {
    const { data } = await _supabase.from('produtos').select('*').eq('estabelecimento_id', id);
    const tbody = document.querySelector('#tabelaProdutos tbody'); tbody.innerHTML = '';
    data.forEach(p => tbody.innerHTML += `<tr><td>${p.numero_registro_produto}</td><td>${p.nome}</td><td>${p.marca}</td><td>${p.embalagem}</td><td><button onclick="deletarItem('produtos',${p.id})">X</button></td></tr>`);
}

window.excluirEstabelecimento = async (id) => { if(confirm("Excluir?")) await _supabase.from('estabelecimentos').delete().eq('id', id); carregarEstabelecimentos(); };
window.deletarItem = async (t, id) => { if(confirm("Apagar?")) await _supabase.from(t).delete().eq('id', id); location.reload(); };