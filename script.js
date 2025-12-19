// --- CONFIGURAÇÃO DO SUPABASE ---
// SUBSTITUA PELAS SUAS CHAVES DO PROJETO
const SUPABASE_URL = 'https://mmbhumfbmrynalzmcmxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tYmh1bWZibXJ5bmFsem1jbXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDIwNjksImV4cCI6MjA4MDkxODA2OX0.uBKKZ1NYTekEVb9l4OFtP6TPrhNZ3i8rq0Huf_CHE-4';

// Usamos '_supabase' para evitar conflito de nomes
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. ROTEAMENTO E SEGURANÇA ---
async function checkAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    const path = window.location.pathname;
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
    
    // Roteador: Verifica qual página está aberta
    if (document.getElementById('loginForm')) setupLogin();
    if (document.getElementById('cadastroForm')) setupDashboard(session);
    if (document.getElementById('uploadForm')) setupDocumentosPage();
    if (document.getElementById('produtoForm')) setupProdutosPage();
    if (document.getElementById('vistoriaForm')) setupVistoriasPage();
});

// --- 2. TELA DE LOGIN ---
function setupLogin() {
    const form = document.getElementById('loginForm');
    const msgDiv = document.getElementById('message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgDiv.textContent = "Verificando...";
        msgDiv.style.color = "#333";

        const { error } = await _supabase.auth.signInWithPassword({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        });

        if (error) {
            msgDiv.textContent = "Erro: " + error.message;
            msgDiv.style.color = "red";
        } else {
            msgDiv.textContent = "Sucesso! Entrando...";
            msgDiv.style.color = "green";
            window.location.href = 'dashboard.html';
        }
    });
}

// --- 3. DASHBOARD (Cadastro e Busca) ---
function setupDashboard(session) {
    document.getElementById('userEmail').textContent = session.user.email;

    // Máscara CNPJ/CPF
    const inputCnpj = document.getElementById('cnpj');
    inputCnpj.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length <= 11) {
            v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            v = v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
        }
        e.target.value = v;
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // Salvar Estabelecimento
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
        else { alert('Cadastrado com sucesso!'); e.target.reset(); carregarEstabelecimentos(); }
    });

    // Busca com delay
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
        
        tbody.innerHTML += `<tr>
            <td>${item.numero_sim || '-'}</td>
            <td>${nome}</td>
            <td>${item.cnpj_cpf}</td>
            <td>${item.classificacao}</td>
            <td><span style="color:${isAtivo ? 'green' : 'red'}; font-weight:bold">${item.status.toUpperCase()}</span></td>
            <td>
                <div class="action-buttons" style="display:flex; gap:5px;">
                    <a href="documentos.html?id=${item.id}" class="btn-action" style="background:#3498db; color:white; padding:6px; text-decoration:none; border-radius:4px;" title="Documentos"><i class="fas fa-folder"></i></a>
                    <a href="produtos.html?id=${item.id}" class="btn-action" style="background:#e67e22; color:white; padding:6px; text-decoration:none; border-radius:4px;" title="Produtos"><i class="fas fa-drumstick-bite"></i></a>
                    <a href="vistorias.html?id=${item.id}" class="btn-action" style="background:#8e44ad; color:white; padding:6px; text-decoration:none; border-radius:4px;" title="Vistorias"><i class="fas fa-clipboard-check"></i></a>
                    <button onclick="excluirEstabelecimento(${item.id})" class="btn-action" style="background:#c0392b; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

// --- 4. MÓDULO DE VISTORIAS (ATUALIZADO) ---
async function setupVistoriasPage() {
    const estId = new URLSearchParams(window.location.search).get('id');
    if (!estId) { window.location.href = 'dashboard.html'; return; }

    // Cabeçalho
    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if (est) {
        document.getElementById('tituloEmpresa').textContent = est.nome_fantasia || est.razao_social;
        document.getElementById('subtituloEmpresa').textContent = `CNPJ: ${est.cnpj_cpf} | SIM: ${est.numero_sim}`;
    }

    // Configuração de Datas
    const inputDataVistoria = document.getElementById('dataVistoria');
    const selectPrazo = document.getElementById('prazoProxima');
    const inputDataProxima = document.getElementById('dataProxima');

    // Define hoje como padrão
    const hoje = new Date().toISOString().split('T')[0];
    inputDataVistoria.value = hoje;

    function calcularData() {
        const dataBaseStr = inputDataVistoria.value || hoje;
        const dataBase = new Date(dataBaseStr + 'T00:00:00'); // T00:00 corrige fuso
        const dias = parseInt(selectPrazo.value);
        
        dataBase.setDate(dataBase.getDate() + dias);
        inputDataProxima.value = dataBase.toISOString().split('T')[0];
    }

    selectPrazo.addEventListener('change', calcularData);
    inputDataVistoria.addEventListener('change', calcularData);
    calcularData();

    // Salvar Vistoria
    document.getElementById('vistoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('arquivoVistoria').files[0];
        const btn = document.getElementById('btnSalvarVistoria');
        const statusMsg = document.getElementById('statusMsg');

        if (!file) return;
        btn.disabled = true;
        statusMsg.textContent = "Enviando arquivo...";

        // Upload
        const nomeLimpo = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `vistoria_${estId}_${Date.now()}_${nomeLimpo}`;

        const { error: upErr } = await _supabase.storage.from('documentos-sim').upload(fileName, file);
        if (upErr) { alert('Erro no Upload: ' + upErr.message); btn.disabled = false; return; }

        const { data: { publicUrl } } = _supabase.storage.from('documentos-sim').getPublicUrl(fileName);

        // Salvar no Banco
        const dados = {
            estabelecimento_id: estId,
            data_vistoria: inputDataVistoria.value,
            status: document.getElementById('statusVistoria').value,
            observacoes: document.getElementById('obsVistoria').value,
            dias_para_proxima: selectPrazo.value,
            data_proxima_vistoria: inputDataProxima.value,
            url_anexo: publicUrl
        };

        const { error: dbErr } = await _supabase.from('vistorias').insert([dados]);
        if (dbErr) { 
            statusMsg.textContent = "Erro Banco: " + dbErr.message; 
        } else {
            alert('Vistoria Registrada!');
            e.target.reset();
            inputDataVistoria.value = hoje;
            calcularData();
            statusMsg.textContent = "";
            carregarVistorias(estId);
        }
        btn.disabled = false;
    });

    carregarVistorias(estId);
}

async function carregarVistorias(estId) {
    const tbody = document.querySelector('#tabelaVistorias tbody');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    
    const { data } = await _supabase
        .from('vistorias')
        .select('*')
        .eq('estabelecimento_id', estId)
        .order('data_vistoria', {ascending: false});

    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="5">Nenhuma vistoria.</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(v => {
        // Cores e Ícones
        let badgeColor, badgeText, badgeIcon;
        if (v.status === 'satisfatoria' || v.status === 'conforme') {
            badgeColor = '#27ae60'; badgeText = 'SATISFATÓRIA'; badgeIcon = '✅';
        } else if (v.status === 'com_deficiencias') {
            badgeColor = '#f39c12'; badgeText = 'COM DEFICIÊNCIAS'; badgeIcon = '⚠️';
        } else {
            badgeColor = '#c0392b'; badgeText = 'GRAVES DEFICIÊNCIAS'; badgeIcon = '🚫';
        }

        const dataRealizacao = v.data_vistoria ? new Date(v.data_vistoria).toLocaleDateString('pt-BR') : new Date(v.created_at).toLocaleDateString('pt-BR');
        const dataProxima = v.data_proxima_vistoria ? new Date(v.data_proxima_vistoria).toLocaleDateString('pt-BR') : '-';

        tbody.innerHTML += `<tr>
            <td>${dataRealizacao}</td>
            <td><span style="background-color: ${badgeColor}; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">${badgeIcon} ${badgeText}</span></td>
            <td><a href="${v.url_anexo}" target="_blank" style="text-decoration:none; color:#2980b9;">Ver Relatório</a></td>
            <td style="font-weight:bold; color:#8e44ad;">${dataProxima}</td>
            <td><button onclick="deletarItem('vistorias', ${v.id})" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

// --- 5. DOCUMENTOS (Simples) ---
async function setupDocumentosPage() {
    const estId = new URLSearchParams(window.location.search).get('id');
    if (!estId) return;

    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if (est) {
        document.getElementById('tituloEmpresa').textContent = est.nome_fantasia || est.razao_social;
        document.getElementById('subtituloEmpresa').textContent = `CNPJ: ${est.cnpj_cpf} | SIM: ${est.numero_sim}`;
    }

    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('arquivoInput').files[0];
        const btn = document.getElementById('btnUpload');
        
        if (!file) return;
        btn.disabled = true;

        const nomeLimpo = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${estId}_${Date.now()}_${nomeLimpo}`;

        const { error: upErr } = await _supabase.storage.from('documentos-sim').upload(fileName, file);
        if (upErr) { alert('Erro: ' + upErr.message); btn.disabled = false; return; }

        const { data: { publicUrl } } = _supabase.storage.from('documentos-sim').getPublicUrl(fileName);
        
        await _supabase.from('documentos').insert([{
            estabelecimento_id: estId,
            nome_arquivo: file.name,
            tipo_documento: document.getElementById('tipoDoc').value,
            url_arquivo: publicUrl
        }]);

        alert('Sucesso!'); e.target.reset(); carregarDocumentos(estId); btn.disabled = false;
    });
    carregarDocumentos(estId);
}

async function carregarDocumentos(estId) {
    const tbody = document.querySelector('#tabelaDocumentos tbody');
    tbody.innerHTML = '';
    const { data } = await _supabase.from('documentos').select('*').eq('estabelecimento_id', estId).order('created_at', {ascending: false});
    if(!data) return;
    data.forEach(doc => {
        tbody.innerHTML += `<tr>
            <td>${new Date(doc.created_at).toLocaleDateString()}</td>
            <td>${doc.tipo_documento}</td>
            <td><a href="${doc.url_arquivo}" target="_blank">${doc.nome_arquivo}</a></td>
            <td><button onclick="deletarItem('documentos', ${doc.id})" style="color:red; border:none; background:none; cursor:pointer;">X</button></td>
        </tr>`;
    });
}

// --- 6. PRODUTOS (Simples) ---
async function setupProdutosPage() {
    const estId = new URLSearchParams(window.location.search).get('id');
    if (!estId) return;

    const { data: est } = await _supabase.from('estabelecimentos').select('*').eq('id', estId).single();
    if (est) {
        document.getElementById('tituloEmpresa').textContent = est.nome_fantasia || est.razao_social;
        document.getElementById('subtituloEmpresa').textContent = `CNPJ: ${est.cnpj_cpf} | SIM: ${est.numero_sim}`;
    }

    document.getElementById('produtoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            estabelecimento_id: estId,
            numero_registro_produto: document.getElementById('numRegistroProd').value,
            nome: document.getElementById('nomeProd').value,
            marca: document.getElementById('marcaProd').value,
            embalagem: document.getElementById('embalagemProd').value,
            apresentacao_peso: document.getElementById('pesoProd').value
        };
        const { error } = await _supabase.from('produtos').insert([dados]);
        if (error) alert('Erro: ' + error.message);
        else { alert('Produto Salvo!'); e.target.reset(); carregarProdutos(estId); }
    });
    carregarProdutos(estId);
}

async function carregarProdutos(estId) {
    const tbody = document.querySelector('#tabelaProdutos tbody');
    tbody.innerHTML = '';
    const { data } = await _supabase.from('produtos').select('*').eq('estabelecimento_id', estId).order('created_at', {ascending: false});
    if(!data) return;
    data.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.numero_registro_produto}</td><td>${p.nome}</td><td>${p.marca}</td><td>${p.embalagem}</td>
            <td><button onclick="deletarItem('produtos', ${p.id})" style="color:red; border:none; background:none; cursor:pointer;">X</button></td>
        </tr>`;
    });
}

// --- FUNÇÕES GLOBAIS ---
window.excluirEstabelecimento = async (id) => { if(confirm("ATENÇÃO: Isso excluirá o estabelecimento e todos os dados vinculados!")) { await _supabase.from('estabelecimentos').delete().eq('id', id); carregarEstabelecimentos(); } };
window.deletarItem = async (tabela, id) => { if(confirm("Apagar este item?")) { await _supabase.from(tabela).delete().eq('id', id); location.reload(); } };