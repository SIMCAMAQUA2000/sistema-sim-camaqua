-- SQL para adicionar colunas na tabela vistorias no Supabase
-- Execute este script no painel do Supabase > SQL Editor

ALTER TABLE vistorias
ADD COLUMN IF NOT EXISTS status_processo TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS url_rnc_assinado TEXT,
ADD COLUMN IF NOT EXISTS url_plano_acao TEXT,
ADD COLUMN IF NOT EXISTS itens_plano_acao JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS data_notificacao TIMESTAMP,
ADD COLUMN IF NOT EXISTS data_plano_recebido TIMESTAMP;

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'vistorias'
ORDER BY ordinal_position;