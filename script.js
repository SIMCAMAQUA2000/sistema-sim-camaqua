// --- CONFIGURAÇÃO INICIAL (SEGURANÇA) ---
if (typeof window.SUPABASE_CONFIG === 'undefined') {
    console.error('CRÍTICO: Arquivo config.js não foi carregado ou está vazio.');
    alert('Erro de sistema: Configuração ausente (config.js).');
}

const _supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url, 
    window.SUPABASE_CONFIG.key
);

// --- VARIÁVEIS GLOBAIS ---
let listaProdutosTemp = [];

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
        img.onerror = () => { console.warn("Img Error: " + url); resolve(null); }
    });
}

// --- 1. ROTEAMENTO ---
async function checkAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    const path = window.location.pathname;
    
    if (path.includes('verificacao.html')) return null;

    const isLoginPage = path.includes('index.html') || path.endsWith('/') || path.endsWith('/project-folder/');

    if (!session && !isLoginPage) {
        window.location.href = 'index.html';
    } else if (session && isLoginPage) {
        window.location.href = 'dashboard.html';
    }
    return session;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (document.getElementById('loginForm')) setupLogin();
    
    if (session) {
        if (document.getElementById('formUnificado')) setupDashboard(session);
        if (document.getElementById('uploadForm')) setupDocumentosPage();
        if (document.getElementById('produtoForm')) setupProdutosPage();
        if (document.getElementById('vistoriaForm')) setupVistoriasPage();
        
        const userEl = document.getElementById('userEmail');
        if(userEl) userEl.textContent = session.user.email;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) logoutBtn.addEventListener('click', async () => { await _supabase.auth.signOut(); window.location.href = 'index.html'; });
    }
});

// --- 2. LOGIN ---
function setupLogin() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('message');
        if(msgDiv) msgDiv.textContent = "Conectando...";
        
        const { error } = await _supabase.auth.signInWithPassword({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        });
        if (error) {
             if(msgDiv) msgDiv.textContent = "";
             Swal.fire('Erro', 'Credenciais inválidas', 'error');
        } else { 
            window.location.href = 'dashboard.html'; 
        }
    });
}

// --- 3. DASHBOARD ---
function setupDashboard(session) {
    const inputCnpj = document.getElementById('cnpj');
    if(inputCnpj) {
        inputCnpj.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 14) v = v.slice(0, 14);
            if (v.length <= 11) v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            else v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
            e.target.value = v;
        });
    }

    const btnAddLista = document.getElementById('btnAddProdutoLista');
    if (btnAddLista) {
        btnAddLista.addEventListener('click', () => {
            const nome = document.getElementById('tempNomeProd').value;
            const reg = document.getElementById('tempRegProd').value;
            const peso = document.getElementById('tempPesoProd').value;

            if (!nome) return Swal.fire('Atenção', 'Digite o nome do produto.', 'warning');
            
            listaProdutosTemp.push({ nome, reg, peso });
            document.getElementById('tempNomeProd').value = '';
            document.getElementById('tempRegProd').value = '';
            document.getElementById('tempPesoProd').value = '';
            document.getElementById('tempNomeProd').focus();
            atualizarTabelaVisual();
        });
    }

    const formUnificado = document.getElementById('formUnificado');
    if (formUnificado) {
        formUnificado.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const confirmacao = await Swal.fire({
                title: 'Confirmar Cadastro?',
                text: `Deseja salvar o estabelecimento e ${listaProdutosTemp.length} produtos?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#27ae60',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sim, Salvar',
                cancelButtonText: 'Cancelar'
            });

            if(!confirmacao.isConfirmed) return;

            const dadosEmpresa = {
                numero_sim: document.getElementById('numSim').value,
                data_registro: document.getElementById('dataRegistro').value || null,
                cnpj_cpf: document.getElementById('cnpj').value,
                razao_social: document.getElementById('razaoSocial').value,
                nome_fantasia: document.getElementById('nomeFantasia').value,
                classificacao: document.getElementById('classificacao').value,
                inscricao_estadual: document.getElementById('inscricaoEstadual').value,
                municipio: document.getElementById('municipio').value,
                endereco: document.getElementById('endereco').value,
                cep: document.getElementById('cep').value,
                telefone: document.getElementById('telefone').value,
                email_contato: document.getElementById('emailContato').value,
                responsavel_tecnico: document.getElementById('responsavelTecnico').value,
                crmv: document.getElementById('crmv').value,
                status: 'ativo'
            };

            const { data: empresa, error: errEmp } = await _supabase.from('estabelecimentos').insert([dadosEmpresa]).select().single();
            if (errEmp) return Swal.fire('Erro', errEmp.message, 'error');

            const novoId = empresa.id;
            if (listaProdutosTemp.length > 0) {
                const produtosParaSalvar = listaProdutosTemp.map(p => ({
                    estabelecimento_id: novoId,
                    nome: p.nome,
                    numero_registro_produto: p.reg,
                    apresentacao_peso: p.peso
                }));
                const { error: errProd } = await _supabase.from('produtos').insert(produtosParaSalvar);
            }

            Swal.fire({
                title: 'Sucesso!',
                text: 'Cadastro realizado com sucesso.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            listaProdutosTemp = [];
            atualizarTabelaVisual();
            e.target.reset();
            document.getElementById('municipio').value = 'Camaquã-RS';
            carregarEstabelecimentos();
        });
    }

    let timeout = null;
    const searchInput = document.getElementById('searchInput');
    if(searchInput){
        searchInput.addEventListener('keyup', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => carregarEstabelecimentos(e.target.value), 500);
        });
    }
    carregarEstabelecimentos();
}

function atualizarTabelaVisual() {
    const tbody = document.querySelector('#tabelaTempProdutos tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if (listaProdutosTemp.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999; padding:15px;">Nenhum produto listado.</td></tr>';
        return;
    }
    listaProdutosTemp.forEach((p, index) => {
        tbody.innerHTML += `<tr>
            <td><strong>${p.nome}</strong></td>
            <td>${p.reg}</td>
            <td>${p.peso}</td>
            <td style="text-align:center;"><button type="button" onclick="removerItemTemp(${index})" style="color:#c0392b; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

window.removerItemTemp = (index) => {
    listaProdutosTemp.splice(index, 1);
    atualizarTabelaVisual();
};

async function carregarEstabelecimentos(busca = '') {
    const tbody = document.querySelector('#tabelaEstabelecimentos tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    let query = _supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false });
    if (busca) query = query.or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj_cpf.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) { tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar.</td></tr>'; return; }
    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(item => {
        const isAtivo = item.status === 'ativo';
        const nome = item.nome_fantasia ? `<strong>${item.nome_fantasia}</strong><br><small>${item.razao_social}</small>` : `<strong>${item.razao_social}</strong>`;
        
        tbody.innerHTML += `<tr>
            <td>${item.numero_sim || '-'}</td>
            <td>${nome}</td>
            <td>${item.cnpj_cpf}</td>
            <td>${item.classificacao}</td>
            <td><span style="color:${isAtivo ? 'green' : 'red'}; font-weight:bold">${item.status.toUpperCase()}</span></td>
            <td>
                <div class="action-buttons" style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button onclick="gerarFichaCompleta(${item.id})" class="btn-action" style="background:#2980b9; color:white; padding:6px; border:none; border-radius:4px; cursor:pointer;" title="Ficha Cadastral"><i class="fas fa-file-alt"></i> Ficha</button>
                    <button onclick="gerarTitulo(${item.id})" class="btn-action" style="background:#2c3e50; color:white; padding:6px; border:none; border-radius:4px; cursor:pointer;" title="Título"><i class="fas fa-certificate"></i> Título</button>
                    <a href="documentos.html?id=${item.id}" class="btn-action" style="background:#3498db; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-folder"></i> Docs</a>
                    <a href="produtos.html?id=${item.id}" class="btn-action" style="background:#e67e22; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-drumstick-bite"></i> Prod</a>
                    <a href="vistorias.html?id=${item.id}" class="btn-action" style="background:#8e44ad; color:white; padding:6px; border-radius:4px; text-decoration:none;"><i class="fas fa-clipboard-check"></i> Vist</a>
                    <button onclick="excluirEstabelecimento(${item.id})" class="btn-action" style="background:#c0392b; color:white; padding:6px; border:none; border-radius:4px;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

// --- FUNÇÃO GLOBAL: FICHA CADASTRAL COMPLETA ---
window.gerarFichaCompleta = async (id) => {
    const confirmacao = await Swal.fire({
        title: 'Gerar Ficha?',
        text: "Deseja emitir o PDF completo com dados, produtos e QR Code?",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#2980b9',
        confirmButtonText: 'Gerar PDF',
        cancelButtonText: 'Cancelar'
    });
    if(!confirmacao.isConfirmed) return;

    try {
        const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', id).single();
        const { data: docs } = await _supabase.from('documentos').select('*').eq('estabelecimento_id', id);
        const { data: prods } = await _supabase.from('produtos').select('*').eq('estabelecimento_id', id);
        
        const [logoCamaqua, logoSim] = await Promise.all([ carregarImagem('./assets/brasao_camaqua.png'), carregarImagem('./assets/logo_sim.png') ]);
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        
        // Header
        if (logoCamaqua) doc.addImage(logoCamaqua, 'PNG', 15, 10, 20, 20);
        if (logoSim) doc.addImage(logoSim, 'PNG', 175, 10, 20, 20);
        doc.setFontSize(10); doc.setTextColor(0);
        doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", 105, 15, { align: "center" });
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", 105, 20, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", 105, 25, { align: "center" });
        doc.text("SERVIÇO DE INSPEÇÃO MUNICIPAL", 105, 30, { align: "center" });

        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(44, 62, 80);
        doc.text("FICHA CADASTRAL DE ESTABELECIMENTO", 105, 45, { align: "center" });

        let yPos = 55;
        function addSectionHeader(title, y) {
            doc.setFillColor(230, 230, 230); doc.rect(14, y, 182, 8, 'F');
            doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(50);
            doc.text(title, 16, y + 5.5);
            return y + 8;
        }

        yPos = addSectionHeader("1. IDENTIFICAÇÃO DO ESTABELECIMENTO", yPos);
        doc.autoTable({
            startY: yPos,
            body: [
                [{ content: 'RAZÃO SOCIAL:\n' + est.razao_social.toUpperCase(), colSpan: 2, styles: { fontStyle: 'bold', fontSize: 11 } }],
                [{ content: 'NOME FANTASIA:\n' + (est.nome_fantasia || '-').toUpperCase(), colSpan: 2 }],
                [{ content: 'CNPJ/CPF:\n' + est.cnpj_cpf }, { content: 'Nº REGISTRO SIM:\n' + est.numero_sim, styles: { fontStyle: 'bold', fontSize: 12 } }],
                [{ content: 'CLASSIFICAÇÃO:\n' + est.classificacao.toUpperCase(), colSpan: 2 }]
            ],
            theme: 'plain', styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
            columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 82 } }, margin: { left: 14, right: 14 }
        });
        yPos = doc.lastAutoTable.finalY + 5;

        yPos = addSectionHeader("2. LOCALIZAÇÃO E CONTATO", yPos);
        doc.autoTable({
            startY: yPos,
            body: [
                [{ content: 'LOGRADOURO:\n' + est.endereco.toUpperCase(), colSpan: 2 }],
                [{ content: 'MUNICÍPIO:\n' + est.municipio.toUpperCase() }, { content: 'CEP:\n' + (est.cep || '-') }],
                [{ content: 'TELEFONE:\n' + (est.telefone || '-') }, { content: 'E-MAIL:\n' + (est.email_contato || '-') }]
            ],
            theme: 'plain', styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
            columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 82 } }, margin: { left: 14, right: 14 }
        });
        yPos = doc.lastAutoTable.finalY + 5;

        yPos = addSectionHeader("3. RESPONSABILIDADE TÉCNICA", yPos);
        doc.autoTable({
            startY: yPos,
            body: [[{ content: 'NOME DO PROFISSIONAL:\n' + (est.responsavel_tecnico || '-').toUpperCase(), styles: { cellWidth: 100 } }, { content: 'REGISTRO CONSELHO (CRMV/CREA):\n' + (est.crmv || '-'), styles: { cellWidth: 82 } }]],
            theme: 'plain', styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 }, margin: { left: 14, right: 14 }
        });
        yPos = doc.lastAutoTable.finalY + 8;

        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0); doc.text("4. PRODUTOS REGISTRADOS", 14, yPos); yPos += 2;
        if (prods && prods.length > 0) {
            doc.autoTable({
                startY: yPos, head: [['NOME DO PRODUTO', 'REGISTRO', 'APRESENTAÇÃO']],
                body: prods.map(p => [p.nome.toUpperCase(), p.numero_registro_produto || '-', (p.embalagem + ' ' + (p.apresentacao_peso||'')).toUpperCase()]),
                theme: 'striped', headStyles: { fillColor: [52, 73, 94], halign: 'left' }, styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 100 } }, margin: { left: 14, right: 14 }
            });
            yPos = doc.lastAutoTable.finalY + 10;
        } else {
            doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Nenhum produto registrado.", 14, yPos + 6); yPos += 15;
        }

        if (docs && docs.length > 0) {
            doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0); doc.text("5. DOCUMENTAÇÃO ANEXA", 14, yPos);
            doc.autoTable({
                startY: yPos + 2, head: [['DATA', 'TIPO DOCUMENTO', 'NOME DO ARQUIVO']],
                body: docs.map(d => [formatarDataSemFuso(d.created_at), d.tipo_documento.toUpperCase(), d.nome_arquivo]),
                theme: 'grid', headStyles: { fillColor: [52, 152, 219] }, styles: { fontSize: 9 }, margin: { left: 14, right: 14 },
                didDrawCell: (data) => { if (data.section === 'body' && data.column.index === 2) { doc.setTextColor(0, 0, 255); doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: docs[data.row.index].url_arquivo }); } }
            });
        }

        // QR CODE NO RODAPÉ
        const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const baseUrl = window.location.origin + currentPath + '/verificacao.html';
        const linkValidacao = `${baseUrl}?nome=${encodeURIComponent(est.razao_social)}&cnpj=${encodeURIComponent(est.cnpj_cpf)}&sim=${encodeURIComponent(est.numero_sim)}&status=${encodeURIComponent(est.status)}`;
        
        const pages = doc.internal.getNumberOfPages();
        for(let i=1; i<=pages; i++) {
            doc.setPage(i);
            if (i === pages) {
                let yAssin = 260; 
                try { 
                    const qrData = await QRCode.toDataURL(linkValidacao);
                    doc.addImage(qrData, 'PNG', 170, yAssin - 20, 25, 25);
                    doc.setFontSize(7); doc.setTextColor(0);
                    doc.text("Valide este documento", 170, yAssin + 8);
                } catch(e) {}

                doc.setDrawColor(0); doc.setLineWidth(0.5); doc.setTextColor(0);
                doc.line(60, yAssin, 150, yAssin); doc.setFontSize(9); doc.setFont("helvetica", "bold");
                doc.text("COORDENAÇÃO DO S.I.M. CAMAQUÃ", 105, yAssin + 5, { align: "center" });
                doc.setFontSize(8); doc.setFont("helvetica", "italic");
                doc.text("Documento gerado eletronicamente pelo Sistema de Gestão SIM.", 105, yAssin + 10, { align: "center" });
            }
            doc.setFontSize(8); doc.text(`Página ${i} de ${pages} - Emitido em ${new Date().toLocaleDateString()}`, 105, 290, {align:"center"});
        }
        doc.save(`FICHA_${est.numero_sim}_${est.razao_social}.pdf`);
    } catch(err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar o PDF. Verifique o console.', 'error');
    }
}

// --- FUNÇÃO GLOBAL: TÍTULO DE REGISTRO ---
window.gerarTitulo = async (id) => {
    const { value: portaria } = await Swal.fire({
        title: 'Gerar Título',
        input: 'text',
        inputLabel: 'Portaria de Nomeação',
        inputValue: 'Portaria Nº XXXX/2025',
        showCancelButton: true,
        confirmButtonText: 'Gerar',
        cancelButtonText: 'Cancelar'
    });

    if (!portaria) return;

    try {
        const [logoCamaqua, logoSim] = await Promise.all([
            carregarImagem('./assets/brasao_camaqua.png'),
            carregarImagem('./assets/logo_sim.png')
        ]);

        const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', id).single();
        if (!est) return Swal.fire('Erro', 'Dados não encontrados', 'error');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();
        const centroX = width / 2;

        doc.setLineWidth(1.5); doc.setDrawColor(44, 62, 80); doc.rect(10, 10, width - 20, height - 20);
        doc.setLineWidth(0.5); doc.rect(12, 12, width - 24, height - 24);

        if (logoCamaqua) doc.addImage(logoCamaqua, 'PNG', 20, 18, 28, 28);
        if (logoSim) doc.addImage(logoSim, 'PNG', width - 48, 18, 28, 28);

        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", centroX, 24, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", centroX, 30, { align: "center" }); doc.text("SERVIÇO DE INSPEÇÃO MUNICIPAL - SIM", centroX, 35, { align: "center" });

        doc.setFont("times", "bold"); doc.setFontSize(26); doc.setTextColor(44, 62, 80); doc.text("TÍTULO DE REGISTRO", centroX, 52, { align: "center" });
        doc.setFontSize(15); doc.setTextColor(0); doc.text(`Nº ${est.numero_sim}`, centroX, 60, { align: "center" });

        doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.text(doc.splitTextToSize("O Serviço de Inspeção Municipal de Camaquã CERTIFICA que o estabelecimento abaixo identificado encontra-se devidamente registrado e apto a funcionar de acordo com a legislação sanitária vigente.", 240), centroX, 75, { align: "center" });

        const startY = 95; const gap = 16; doc.setDrawColor(200); doc.setLineWidth(0.1);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100); doc.text("CLASSIFICAÇÃO DO ESTABELECIMENTO", 30, startY);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0); doc.text(est.classificacao.toUpperCase(), 30, startY + 6);

        const linha2Y = startY + gap; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100); doc.text("NOME EMPRESARIAL", 30, linha2Y); doc.text("NOME FANTASIA", 130, linha2Y); doc.text("DATA REGISTRO", 230, linha2Y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0); doc.text(doc.splitTextToSize(est.razao_social.toUpperCase(), 90), 30, linha2Y + 5); doc.text(doc.splitTextToSize((est.nome_fantasia || "-").toUpperCase(), 90), 130, linha2Y + 5); doc.text(formatarDataSemFuso(est.data_registro), 230, linha2Y + 5);

        const linha3Y = startY + (gap * 2); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100); doc.text("CNPJ / CPF", 30, linha3Y); doc.text("INSCRIÇÃO ESTADUAL", 130, linha3Y); 
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0); doc.text(est.cnpj_cpf, 30, linha3Y + 5); doc.text(est.inscricao_estadual || "ISENTO", 130, linha3Y + 5);

        const linha4Y = startY + (gap * 3); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100); doc.text("LOGRADOURO / LOCALIZAÇÃO", 30, linha4Y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0); doc.text(`${est.endereco}, ${est.municipio} - CEP: ${est.cep || ""}`.toUpperCase(), 30, linha4Y + 5);

        // QR CODE COM LINK
        const currentPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const baseUrl = window.location.origin + currentPath + '/verificacao.html';
        const linkValidacao = `${baseUrl}?nome=${encodeURIComponent(est.razao_social)}&cnpj=${encodeURIComponent(est.cnpj_cpf)}&sim=${encodeURIComponent(est.numero_sim)}&status=${encodeURIComponent(est.status)}`;

        try { const qrData = await QRCode.toDataURL(linkValidacao); doc.addImage(qrData, 'PNG', 20, 160, 25, 25); } catch(e) {}

        const hoje = new Date();
        const dataExtenso = hoje.toLocaleDateString('pt-BR', {year:'numeric', month:'long', day:'numeric'});
        const yAssinatura = 175;

        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Camaquã - RS, ${dataExtenso}`, centroX, yAssinatura - 15, { align: "center" });
        doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(centroX - 70, yAssinatura, centroX + 70, yAssinatura); 
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("COORDENADOR DO SERVIÇO DE INSPEÇÃO MUNICIPAL", centroX, yAssinatura + 5, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(portaria, centroX, yAssinatura + 10, { align: "center" });

        doc.save(`TITULO_SIM_${est.numero_sim}_${est.razao_social}.pdf`);
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Erro ao gerar Título. Verifique console.', 'error');
    }
}

// --- FUNÇÃO GLOBAL: RNC CONFORME MODELO DOCX (ATUALIZADA SEQUENCIAL, ALINHADA E COM EDIÇÃO) ---
window.gerarRNC = async (vistoriaId) => {
    try {
        // 1. Busca dados ANTES do popup
        const { data: v } = await _supabase.from('vistorias').select('*').eq('id', vistoriaId).single();
        if(!v) throw new Error("Vistoria não encontrada");
        const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', v.estabelecimento_id).single();

        // Variáveis para armazenar as respostas dos passos
        let embasamento, elementoInspecao;
        let textoNCEditado;
        let textoLegalEditado;
        let respLegal, respTecnico, vet1, vet2;

        // --- PASSO 1: DADOS DA INFRAÇÃO ---
        const step1 = await Swal.fire({
            title: '1. Dados da Infração',
            html:
                '<input id="swal-embasamento" class="swal2-input" placeholder="Embasamento Legal (Ex: Decreto 53.848/2017)">' +
                '<input id="swal-elemento" class="swal2-input" placeholder="Elemento de Inspeção (Ex: Higiene Operacional)">',
            focusConfirm: false,
            confirmButtonText: 'Próximo',
            preConfirm: () => {
                return [
                    document.getElementById('swal-embasamento').value,
                    document.getElementById('swal-elemento').value
                ]
            }
        });
        if (!step1.isConfirmed) return;
        [embasamento, elementoInspecao] = step1.value;
        if(!embasamento || !elementoInspecao) return Swal.fire('Erro', 'Preencha os campos obrigatórios.', 'warning');

        // --- PASSO 2: REVISÃO DE NÃO CONFORMIDADES (NOVIDADE: EDIÇÃO) ---
        // Pega o texto atual do banco ou usa "Sem não conformidades" se vazio
        const textoOriginalNC = v.observacoes || "Nenhuma não conformidade registrada no checklist.";
        
        const step2 = await Swal.fire({
            title: '2. Revisar Não Conformidades',
            text: 'Edite o texto abaixo para sair exatamente como deseja na RNC.',
            input: 'textarea',
            inputValue: textoOriginalNC,
            inputAttributes: { style: 'height: 200px; font-size: 0.9rem; font-family: monospace;' },
            confirmButtonText: 'Próximo',
            showCancelButton: true
        });
        if (!step2.isConfirmed) return;
        textoNCEditado = step2.value;

        // Atualiza a RNC no banco com o texto editado (para ficar salvo)
        if (textoNCEditado !== textoOriginalNC) {
            await _supabase.from('vistorias').update({ observacoes: textoNCEditado }).eq('id', vistoriaId);
        }

        // --- PASSO 3: TEXTO LEGAL (PLANO DE AÇÃO) ---
        const textoPadrao = "A resposta do estabelecimento deverá ser formalizada em documento oficial da própria instituição, contendo a descrição detalhada das ações corretivas propostas para cada não conformidade apontada, com a indicação dos respectivos prazos para sua implementação. O documento deverá configurar um Plano de Ação, discriminando as medidas corretivas imediatas e o cronograma das ações subsequentes planejadas. O Plano de Ação deverá ser assinado pelos responsáveis técnicos e legais do estabelecimento e encaminhado ao serviço oficial digital, prazo máximo de 15 (quinze) dias úteis a partir do recebimento deste documento.";
        
        const step3 = await Swal.fire({
            title: '3. Plano de Ação',
            input: 'textarea',
            inputValue: textoPadrao,
            inputAttributes: { style: 'height: 150px; font-size: 0.9rem;' },
            confirmButtonText: 'Próximo'
        });
        if (!step3.isConfirmed) return;
        textoLegalEditado = step3.value;

        // --- PASSO 4: ASSINATURAS ---
        const step4 = await Swal.fire({
            title: '4. Assinaturas',
            width: '600px',
            html:
                '<div style="text-align:left; font-weight:bold; margin-top:10px;">Estabelecimento:</div>' +
                '<input id="swal-resp-legal" class="swal2-input" placeholder="Resp. Legal" style="margin:0;">' +
                '<input id="swal-resp-tecnico" class="swal2-input" placeholder="Resp. Técnico" value="' + (est.responsavel_tecnico || '') + '" style="margin:0;">' +
                '<div style="text-align:left; font-weight:bold; margin-top:10px;">Veterinários (Deixe o 2º em branco se houver apenas um):</div>' +
                '<input id="swal-vet1" class="swal2-input" placeholder="Veterinário 1" value="James William Bet - CRMV RS 10776" style="margin-bottom:10px;">' +
                '<input id="swal-vet2" class="swal2-input" placeholder="Veterinário 2 (Opcional)" value="Rejane Werenicz da Costa - CRMV-RS 6996">',
            focusConfirm: false,
            confirmButtonText: 'Gerar PDF',
            preConfirm: () => {
                return [
                    document.getElementById('swal-resp-legal').value,
                    document.getElementById('swal-resp-tecnico').value,
                    document.getElementById('swal-vet1').value,
                    document.getElementById('swal-vet2').value
                ]
            }
        });
        if (!step4.isConfirmed) return;
        [respLegal, respTecnico, vet1, vet2] = step4.value;

        // --- GERAÇÃO DO PDF ---
        Swal.fire({ title: 'Gerando PDF...', didOpen: () => Swal.showLoading() });

        // 3. Carregar Imagens
        const [logoCamaqua, logoSim] = await Promise.all([ carregarImagem('./assets/brasao_camaqua.png'), carregarImagem('./assets/logo_sim.png') ]);

        // 4. Lógica do Número Sequencial da RNC
        let num = v.rnc_numero, ano = v.rnc_ano, anoAtual = new Date().getFullYear();
        if (!num) {
            const { data: ult } = await _supabase.from('vistorias').select('rnc_numero').eq('rnc_ano', anoAtual).order('rnc_numero', { ascending: false }).limit(1);
            num = (ult && ult.length) ? ult[0].rnc_numero + 1 : 1;
            await _supabase.from('vistorias').update({ rnc_numero: num, rnc_ano: anoAtual }).eq('id', vistoriaId);
            ano = anoAtual;
        }

        const { jsPDF } = window.jspdf; 
        const doc = new jsPDF(); 
        const centroX = 105;

        // MARGEM PADRÃO PARA ALINHAMENTO
        const commonMargin = { left: 10, right: 10 };

        // --- CABEÇALHO PERSONALIZADO ---
        doc.autoTable({
            startY: 10,
            body: [
                [
                    { content: '', styles: { cellWidth: 25 } }, 
                    { content: '', styles: { cellWidth: 140 } }, // Célula central vazia (desenhada no hook)
                    { content: '', styles: { cellWidth: 25 } }
                ]
            ],
            theme: 'plain',
            margin: commonMargin,
            styles: { lineColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 28 },
            didDrawCell: (data) => {
                // Desenha Logos e Texto
                if (data.section === 'body' && data.row.index === 0) {
                    // Logos nas laterais
                    if (data.column.index === 0 && logoCamaqua) {
                         doc.addImage(logoCamaqua, 'PNG', data.cell.x + 2, data.cell.y + 4, 21, 21);
                    }
                    if (data.column.index === 2 && logoSim) {
                         doc.addImage(logoSim, 'PNG', data.cell.x + 2, data.cell.y + 4, 21, 21);
                    }

                    // Texto Central (Linha por Linha)
                    if (data.column.index === 1) {
                        const centerX = data.cell.x + (data.cell.width / 2);
                        let currentY = data.cell.y + 6; // Padding top

                        doc.setFontSize(9);
                        
                        // 1. Governo (Normal)
                        doc.setFont("helvetica", "normal");
                        doc.text("GOVERNO DO ESTADO DO RIO GRANDE DO SUL", centerX, currentY, { align: "center" });
                        
                        // 2. Prefeitura (Negrito)
                        currentY += 5;
                        doc.setFont("helvetica", "bold");
                        doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", centerX, currentY, { align: "center" });

                        // 3. Secretaria (Normal)
                        currentY += 5;
                        doc.setFont("helvetica", "normal");
                        doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", centerX, currentY, { align: "center" });

                        // 4. SIM (Normal)
                        currentY += 5;
                        doc.text("SERVIÇO DE INSPEÇÃO MUNICIPAL", centerX, currentY, { align: "center" });
                    }
                }
            }
        });

        // Título Principal
        let yPos = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DE NÃO CONFORMIDADE", centroX, yPos, { align: "center" });

        // Tabela 1: Identificação RNC
        doc.autoTable({ 
            startY: yPos + 5, 
            head:[['NÚMERO', 'SIM', 'DATA']], 
            body:[[`${num}/${ano}`, est.numero_sim || '---', formatarDataSemFuso(v.data_vistoria)]], 
            theme: 'plain', 
            margin: commonMargin,
            styles: { fontSize: 10, halign: 'center', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            headStyles: { fontStyle: 'bold', fillColor: [220, 220, 220] } 
        });

        // Tabela 2: Estabelecimento
        doc.autoTable({ 
            body:[
                [{ content: 'ESTABELECIMENTO:', styles: { fontStyle: 'bold', cellWidth: 40 } }, est.razao_social.toUpperCase()]
            ], 
            theme: 'plain',
            margin: commonMargin,
            styles: { fontSize: 10, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            margin: { top: 2, ...commonMargin } 
        });

        // Tabela 3: Detalhes da Irregularidade
        doc.autoTable({ 
            body:[
                [{ content: 'EMBASAMENTO LEGAL', styles: { fontStyle: 'bold', cellWidth: 60, fillColor: [220, 220, 220] } }, embasamento],
                [{ content: 'ELEMENTO DE INSPEÇÃO', styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, elementoInspecao],
                [{ content: 'NÃO CONFORMIDADES ENCONTRADAS (Descrição e Ação Fiscal)', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [220, 220, 220] } }],
                [{ content: textoNCEditado || "Vide anexo.", colSpan: 2, styles: { minCellHeight: 40 } }]
            ], 
            theme: 'plain', 
            margin: commonMargin,
            styles: { fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
            margin: { top: 5, ...commonMargin }
        });

        // TÍTULO "DESCRIÇÃO DO DOCUMENTO" (NOVA CAIXA)
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 2,
            head:[['DESCRIÇÃO DO DOCUMENTO']], 
            body:[["Este documento é uma notificação por escrito da falha em atender às exigências regulamentares e pode resultar em adicional ação administrativa e legal. O estabelecimento deve cumprir as exigências elencadas."]], 
            theme:'grid', margin:commonMargin, 
            headStyles:{fillColor:220, textColor:0, halign:'center', fontStyle:'bold', lineColor:0, lineWidth:0.1},
            styles:{fontSize:9, cellPadding:2, lineColor:0, lineWidth:0.1}
        });

        // 6. ASSINATURAS UNIFICADAS
        
        // Título "ASSINATURAS" com caixa cinza
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 5,
            head: [['ASSINATURAS']],
            body: [], 
            theme: 'grid',
            margin: commonMargin,
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.1 }
        });

        // Lógica Dinâmica para VET 1 ou VET 1+2
        let linhaVeterinarios = [];
        const vet1Formatado = vet1 ? `\n\n___________________________\n${vet1}` : '';
        const vet2Formatado = vet2 ? `\n\n___________________________\n${vet2}` : '';

        if (vet2 && vet2.trim() !== "") {
            linhaVeterinarios = [
                { content: vet1Formatado, styles: { halign: 'center', valign: 'bottom', cellPadding: 3 } },
                { content: vet2Formatado, styles: { halign: 'center', valign: 'bottom', cellPadding: 3 } }
            ];
        } else {
            linhaVeterinarios = [
                { content: vet1Formatado, colSpan: 2, styles: { halign: 'center', valign: 'bottom', cellPadding: 3 } }
            ];
        }

        const l1 = respLegal ? respLegal.toUpperCase() : "Responsável Legal";
        const l2 = respTecnico ? respTecnico.toUpperCase() : "Responsável Técnico";

        // Grade de Assinaturas
        doc.autoTable({
            startY: doc.lastAutoTable.finalY, 
            body: [
                linhaVeterinarios,
                [
                    { content: `\n\n___________________________\n${l1}\nResponsável Legal`, styles: { halign: 'center', valign: 'bottom', cellPadding: 3 } },
                    { content: `\n\n___________________________\n${l2}\nResponsável Técnico`, styles: { halign: 'center', valign: 'bottom', cellPadding: 3 } }
                ]
            ],
            theme: 'grid',
            margin: commonMargin,
            styles: { fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 95 } }
        });

        // TÍTULO "MEDIDAS A SEREM ADOTADAS..." (MOVIDO PARA O FINAL)
        doc.autoTable({ 
            startY: doc.lastAutoTable.finalY + 5,
            head:[['MEDIDAS A SEREM ADOTADAS PELO ESTABELECIMENTO']], 
            body:[[textoLegalEditado]], 
            theme:'grid', margin:commonMargin, 
            headStyles:{fillColor:220, textColor:0, halign:'center', fontStyle:'bold', lineColor:0, lineWidth:0.1},
            styles:{fontSize:9, fontStyle:'italic', cellPadding:2, lineColor:0, lineWidth:0.1}
        });

        doc.save(`RNC_${num}_${ano}.pdf`);
        Swal.close(); 

    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar RNC. Verifique o console.', 'error');
    }
}

// --- FUNÇÕES DE OUTRAS PÁGINAS (COMPLETAS) ---

// DOCUMENTOS
async function setupDocumentosPage() {
    const estId = new URLSearchParams(window.location.search).get('id'); if (!estId) return;
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if(est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia;
    
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const file = document.getElementById('arquivoInput').files[0];
        const nome = `${estId}_${Date.now()}`;
        
        const {data, error} = await _supabase.storage.from('documentos-sim').upload(nome, file);
        if(error) return Swal.fire('Erro', 'Falha no upload', 'error');

        const url = _supabase.storage.from('documentos-sim').getPublicUrl(nome).data.publicUrl;
        
        await _supabase.from('documentos').insert([{estabelecimento_id: estId, nome_arquivo: file.name, tipo_documento: document.getElementById('tipoDoc').value, url_arquivo: url}]);
        Swal.fire('OK', 'Documento enviado', 'success'); carregarDocumentos(estId);
    });
    carregarDocumentos(estId);
}
async function carregarDocumentos(id) {
    const { data } = await _supabase.from('documentos').select('*').eq('estabelecimento_id', id);
    const tbody = document.querySelector('#tabelaDocumentos tbody'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    data.forEach(d => tbody.innerHTML += `<tr><td>${formatarDataSemFuso(d.created_at)}</td><td>${d.tipo_documento}</td><td><a href="${d.url_arquivo}" target="_blank">Ver</a></td><td><button onclick="deletarItem('documentos',${d.id})" style="color:red;border:none;">X</button></td></tr>`);
}

// PRODUTOS
async function setupProdutosPage() {
    const estId = new URLSearchParams(window.location.search).get('id'); if (!estId) return;
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if(est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia;
    
    document.getElementById('produtoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await _supabase.from('produtos').insert([{estabelecimento_id: estId, numero_registro_produto: document.getElementById('numRegistroProd').value, nome: document.getElementById('nomeProd').value, marca: document.getElementById('marcaProd').value, embalagem: document.getElementById('embalagemProd').value, apresentacao_peso: document.getElementById('pesoProd').value}]);
        Swal.fire('OK', 'Produto cadastrado', 'success'); carregarProdutos(estId);
    });
    carregarProdutos(estId);
}
async function carregarProdutos(id) {
    const { data } = await _supabase.from('produtos').select('*').eq('estabelecimento_id', id);
    const tbody = document.querySelector('#tabelaProdutos tbody'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    data.forEach(p => tbody.innerHTML += `<tr><td>${p.numero_registro_produto}</td><td>${p.nome}</td><td>${p.marca}</td><td>${p.embalagem}</td><td><button onclick="deletarItem('produtos',${p.id})" style="color:red;border:none;">X</button></td></tr>`);
}

// --- FUNÇÕES GLOBAIS DE EXCLUSÃO ---
window.excluirEstabelecimento = async (id) => { 
    const res = await Swal.fire({ title: 'Excluir?', text: 'Essa ação é irreversível.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if(res.isConfirmed) { await _supabase.from('estabelecimentos').delete().eq('id', id); carregarEstabelecimentos(); Swal.fire('Excluído!', '', 'success'); } 
};
window.deletarItem = async (t, id) => { 
    const res = await Swal.fire({ title: 'Apagar item?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if(res.isConfirmed) { await _supabase.from(t).delete().eq('id', id); location.reload(); } 
};

// --- VISTORIAS ---
async function setupVistoriasPage() {
    const estId = new URLSearchParams(window.location.search).get('id');
    if (!estId) { window.location.href = 'dashboard.html'; return; }
    
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if (est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia || est.razao_social;
    
    const inputData = document.getElementById('dataVistoria');
    inputData.value = new Date().toISOString().split('T')[0];
    
    const selectPrazo = document.getElementById('prazoProxima');
    const inputDataProxima = document.getElementById('dataProxima');
    function calcularData() {
        const dataBase = new Date(inputData.value + 'T00:00:00');
        dataBase.setDate(dataBase.getDate() + parseInt(selectPrazo.value));
        inputDataProxima.value = dataBase.toISOString().split('T')[0];
    }
    selectPrazo.addEventListener('change', calcularData);
    inputData.addEventListener('change', calcularData);
    calcularData();

    document.getElementById('vistoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Verifica se a conclusão foi selecionada
        const conclusaoEl = document.getElementById('conclusaoSelect');
        if (!conclusaoEl) {
            console.error('Elemento conclusaoSelect não encontrado.');
            return Swal.fire('Erro', 'Formulário inválido. Recarregue a página.', 'error');
        }

        const conclusao = conclusaoEl.value;
        let statusDB = 'satisfatoria';
        if (conclusao === '7.2') statusDB = 'com_deficiencias';
        if (conclusao === '7.3') statusDB = 'grave_deficiencia';

        const file = document.getElementById('arquivoVistoria').files[0];
        if(!file) return Swal.fire('Erro', 'Anexe o checklist assinado.', 'warning');

        const nomeArquivo = `checklist_${estId}_${Date.now()}`;
        const { error: upError } = await _supabase.storage.from('documentos-sim').upload(nomeArquivo, file);
        if (upError) return Swal.fire('Erro Upload', upError.message, 'error');
        
        const url = _supabase.storage.from('documentos-sim').getPublicUrl(nomeArquivo).data.publicUrl;

        await _supabase.from('vistorias').insert([{
            estabelecimento_id: estId,
            data_vistoria: inputData.value,
            status: statusDB,
            observacoes: document.getElementById('obsVistoria').value,
            dias_para_proxima: selectPrazo.value,
            data_proxima_vistoria: inputDataProxima.value,
            url_anexo: url
        }]);

        Swal.fire('Sucesso', 'Vistoria Registrada!', 'success');
        e.target.reset();
        carregarVistorias(estId);
    });
    carregarVistorias(estId);
}

async function carregarVistorias(id) {
    const tbody = document.querySelector('#tabelaVistorias tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const { data } = await _supabase.from('vistorias').select('*').eq('estabelecimento_id', id).order('data_vistoria', {ascending:false});
    
    data.forEach(v => {
        const precisaRNC = (v.status === 'com_deficiencias' || v.status === 'grave_deficiencia');
        const btnRNC = precisaRNC 
            ? `<button onclick="gerarRNC(${v.id})" style="background:#c0392b; color:white; padding:5px 10px; border:none; cursor:pointer; border-radius:4px; font-weight:bold;">Gerar RNC</button>` 
            : '<span style="color:#27ae60; font-weight:bold;">-</span>';

        tbody.innerHTML += `<tr>
            <td>${formatarDataSemFuso(v.data_vistoria)}</td>
            <td>${v.status.toUpperCase()}</td>
            <td><a href="${v.url_anexo}" target="_blank">Ver Anexo</a></td>
            <td>${formatarDataSemFuso(v.data_proxima_vistoria)}</td>
            <td>${btnRNC}</td>
        </tr>`;
    });
}