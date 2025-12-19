// --- CONFIGURAÇÃO DO SUPABASE ---
// SUBSTITUA PELAS SUAS CHAVES DO PROJETO
const SUPABASE_URL = 'https://mmbhumfbmrynalzmcmxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYmh1bWZibXJ5bmFsem1jbXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDIwNjksImV4cCI6MjA4MDkxODA2OX0.uBKKZ1NYTekEVb9l4OFtP6TPrhNZ3i8rq0Huf_CHE-4';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    
    // Ignora verificação na página pública de validação
    if (path.includes('verificacao.html')) return null;

    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/project-folder/');

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
    if (document.getElementById('formUnificado')) setupDashboard(session);
    if (document.getElementById('uploadForm')) setupDocumentosPage();
    if (document.getElementById('produtoForm')) setupProdutosPage();
    if (document.getElementById('vistoriaForm')) setupVistoriasPage();
});

// --- 2. LOGIN (COM SWEETALERT) ---
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
        if (error) { 
            msgDiv.textContent = "";
            Swal.fire({
                icon: 'error',
                title: 'Acesso Negado',
                text: 'Email ou senha incorretos.',
                confirmButtonColor: '#c0392b'
            });
        } else { 
            window.location.href = 'dashboard.html'; 
        }
    });
}

// --- 3. DASHBOARD ---
function setupDashboard(session) {
    document.getElementById('userEmail').textContent = session.user.email;
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
    
    document.getElementById('logoutBtn').addEventListener('click', async () => { 
        await _supabase.auth.signOut(); window.location.href = 'index.html'; 
    });

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
                if (errProd) Swal.fire('Aviso', 'Empresa salva, mas houve erro nos produtos.', 'warning');
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
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    let query = _supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false });
    if (busca) query = query.or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj_cpf.ilike.%${busca}%`);

    const { data } = await query;
    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6">Nenhum registro.</td></tr>'; return; }

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

// --- FICHA CADASTRAL (SWEETALERT + QR NO RODAPÉ) ---
async function gerarFichaCompleta(id) {
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
}

// --- TÍTULO (SWEETALERT INPUT + QR CODE LINKADO) ---
async function gerarTitulo(id) {
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
}

// --- RNC COM SWEETALERT FORM ---
async function gerarRNC(vistoriaId) {
    const { value: formValues } = await Swal.fire({
        title: 'Gerar RNC',
        html:
            '<input id="swal-embasamento" class="swal2-input" placeholder="Embasamento (Ex: Dec. 53.848)">' +
            '<input id="swal-elemento" class="swal2-input" placeholder="Elemento (Ex: Higiene)">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Gerar PDF',
        preConfirm: () => {
            return [
                document.getElementById('swal-embasamento').value,
                document.getElementById('swal-elemento').value
            ]
        }
    });

    if (!formValues) return;
    const [embasamento, elementoInspecao] = formValues;
    if(!embasamento || !elementoInspecao) return Swal.fire('Erro', 'Preencha todos os campos.', 'warning');

    const [logoCamaqua, logoSim] = await Promise.all([ carregarImagem('./assets/brasao_camaqua.png'), carregarImagem('./assets/logo_sim.png') ]);
    const { data: v } = await _supabase.from('vistorias').select('*').eq('id', vistoriaId).single();
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', v.estabelecimento_id).single();

    let num = v.rnc_numero, ano = v.rnc_ano, anoAtual = new Date().getFullYear();
    if (!num) {
        const { data: ult } = await _supabase.from('vistorias').select('rnc_numero').eq('rnc_ano', anoAtual).order('rnc_numero', { ascending: false }).limit(1);
        num = (ult && ult.length) ? ult[0].rnc_numero + 1 : 1;
        await _supabase.from('vistorias').update({ rnc_numero: num, rnc_ano: anoAtual }).eq('id', vistoriaId);
        ano = anoAtual;
    }

    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const centroX = 105;
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

    doc.autoTable({ startY: 50, head:[['NÚMERO','SIM','DATA']], body:[[`${num}/${ano}`, est.numero_sim, formatarDataSemFuso(v.data_vistoria)]], theme: 'grid', headStyles: {fillColor: [44,62,80]} });
    doc.autoTable({ body:[[`ESTABELECIMENTO: ${est.razao_social}`]], theme: 'plain', styles:{fontStyle:'bold'} });
    doc.autoTable({ 
        body:[
            ['EMBASAMENTO LEGAL', embasamento], 
            ['ELEMENTO DE INSPEÇÃO', elementoInspecao], 
            ['NÃO CONFORMIDADES', v.observacoes]
        ], theme: 'grid', columnStyles: {0:{fontStyle:'bold', cellWidth:60}}
    });

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const aviso = doc.splitTextToSize("Este documento é uma notificação por escrito da falha em atender às exigências regulamentares e pode resultar em adicional ação administrativa e legal.", 190);
    doc.text(aviso, 14, doc.lastAutoTable.finalY + 10);

    let yAssin = doc.lastAutoTable.finalY + 40;
    if (yAssin > 260) { doc.addPage(); yAssin = 40; }

    doc.line(14, yAssin, 100, yAssin);
    doc.text("James William Bet", 14, yAssin + 5);
    doc.setFontSize(8); doc.text("Médico Veterinário Oficial - CRMV RS 10776", 14, yAssin + 9);

    doc.line(110, yAssin, 196, yAssin);
    doc.setFontSize(9); doc.text("Rejane Werenicz da Costa", 110, yAssin + 5);
    doc.setFontSize(8); doc.text("Médica Veterinária Oficial - CRMV-RS 6996", 110, yAssin + 9);

    doc.save(`RNC_${num}.pdf`);
    carregarVistorias(vistoriaId);
}

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
        const dataBaseStr = inputData.value || new Date().toISOString().split('T')[0];
        const dataBase = new Date(dataBaseStr + 'T00:00:00');
        const dias = parseInt(selectPrazo.value);
        dataBase.setDate(dataBase.getDate() + dias);
        inputDataProxima.value = dataBase.toISOString().split('T')[0];
    }
    selectPrazo.addEventListener('change', calcularData);
    inputData.addEventListener('change', calcularData);
    calcularData();

    document.getElementById('vistoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('arquivoVistoria').files[0];
        if(!file) return Swal.fire('Erro', 'Selecione um arquivo PDF', 'error');
        
        const nome = `vistoria_${estId}_${Date.now()}`;
        const { data: up } = await _supabase.storage.from('documentos-sim').upload(nome, file);
        const url = _supabase.storage.from('documentos-sim').getPublicUrl(nome).data.publicUrl;
        
        await _supabase.from('vistorias').insert([{
            estabelecimento_id: estId,
            data_vistoria: inputData.value,
            status: document.getElementById('statusVistoria').value,
            observacoes: document.getElementById('obsVistoria').value,
            dias_para_proxima: document.getElementById('prazoProxima').value,
            data_proxima_vistoria: document.getElementById('dataProxima').value,
            url_anexo: url
        }]);
        Swal.fire('Sucesso', 'Vistoria Salva!', 'success');
        e.target.reset();
        inputData.value = new Date().toISOString().split('T')[0];
        calcularData();
        carregarVistorias(estId);
    });
    carregarVistorias(estId);
}

async function carregarVistorias(id) {
    const tbody = document.querySelector('#tabelaVistorias tbody'); tbody.innerHTML = '';
    const { data } = await _supabase.from('vistorias').select('*').eq('estabelecimento_id', id).order('data_vistoria', {ascending:false});
    data.forEach(v => {
        const btnRNC = (v.status !== 'satisfatoria' && v.status !== 'conforme') ? `<button onclick="gerarRNC(${v.id})" style="background:#34495e; color:white; padding:5px; border:none; cursor:pointer;">RNC</button>` : '';
        tbody.innerHTML += `<tr><td>${formatarDataSemFuso(v.data_vistoria)}</td><td>${v.status}</td><td><a href="${v.url_anexo}">Ver</a></td><td>${formatarDataSemFuso(v.data_proxima_vistoria)}</td><td>${btnRNC}</td></tr>`;
    });
}

// --- DOCUMENTOS E PRODUTOS (PÁGINAS INDIVIDUAIS) ---
async function setupDocumentosPage() {
    const estId = new URLSearchParams(window.location.search).get('id'); if (!estId) return;
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if(est) document.getElementById('tituloEmpresa').textContent = est.nome_fantasia;
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault(); const file = document.getElementById('arquivoInput').files[0];
        const nome = `${estId}_${Date.now()}`;
        const {data} = await _supabase.storage.from('documentos-sim').upload(nome, file);
        const url = _supabase.storage.from('documentos-sim').getPublicUrl(nome).data.publicUrl;
        await _supabase.from('documentos').insert([{estabelecimento_id: estId, nome_arquivo: file.name, tipo_documento: document.getElementById('tipoDoc').value, url_arquivo: url}]);
        Swal.fire('OK', 'Documento enviado', 'success'); carregarDocumentos(estId);
    });
    carregarDocumentos(estId);
}
async function carregarDocumentos(id) {
    const { data } = await _supabase.from('documentos').select('*').eq('estabelecimento_id', id);
    const tbody = document.querySelector('#tabelaDocumentos tbody'); tbody.innerHTML = '';
    data.forEach(d => tbody.innerHTML += `<tr><td>${formatarDataSemFuso(d.created_at)}</td><td>${d.tipo_documento}</td><td><a href="${d.url_arquivo}" target="_blank">Ver</a></td><td><button onclick="deletarItem('documentos',${d.id})" style="color:red;border:none;">X</button></td></tr>`);
}
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
    const tbody = document.querySelector('#tabelaProdutos tbody'); tbody.innerHTML = '';
    data.forEach(p => tbody.innerHTML += `<tr><td>${p.numero_registro_produto}</td><td>${p.nome}</td><td>${p.marca}</td><td>${p.embalagem}</td><td><button onclick="deletarItem('produtos',${p.id})" style="color:red;border:none;">X</button></td></tr>`);
}

window.excluirEstabelecimento = async (id) => { 
    const res = await Swal.fire({ title: 'Excluir?', text: 'Essa ação é irreversível.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if(res.isConfirmed) { await _supabase.from('estabelecimentos').delete().eq('id', id); carregarEstabelecimentos(); Swal.fire('Excluído!', '', 'success'); } 
};
window.deletarItem = async (t, id) => { 
    const res = await Swal.fire({ title: 'Apagar item?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if(res.isConfirmed) { await _supabase.from(t).delete().eq('id', id); location.reload(); } 
};