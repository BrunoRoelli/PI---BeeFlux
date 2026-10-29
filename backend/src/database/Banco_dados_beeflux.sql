-- =========================================================
-- BEEFLUX - Banco de dados FINAL (MySQL 8.0.16+)
-- Ordem de criacao respeita as dependencias entre tabelas.
--
-- Regra tecnica: no MySQL, colunas usadas em CHECK nao podem ter
-- ON DELETE / ON UPDATE explicitos na FK. Nesses casos a FK fica sem
-- acoes (o padrao ja e restringir).
-- =========================================================

CREATE DATABASE IF NOT EXISTS beeflux
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE beeflux;


-- =========================================================
-- 1. USUARIOS (administrador unico)
-- =========================================================
-- senha_user guarda o HASH (Argon2id/bcrypt), nunca a senha pura.

CREATE TABLE usuarios (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nome_user VARCHAR(100) NOT NULL,
    email_user VARCHAR(150) NOT NULL UNIQUE,
    telefone_user VARCHAR(20),
    senha_user VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. CLIENTES
-- =========================================================

CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nome_cliente VARCHAR(100) NOT NULL,
    telefone_cliente VARCHAR(20),
    email_cliente VARCHAR(150),
    observacao VARCHAR(500),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_clientes_telefone (telefone_cliente)
);


-- =========================================================
-- 3. CATEGORIAS
-- =========================================================
-- personalizada = FALSE -> categoria padrao do sistema
-- personalizada = TRUE  -> categoria criada pelo usuario

CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nome_categoria VARCHAR(100) NOT NULL,
    personalizada BOOLEAN NOT NULL DEFAULT TRUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE (nome_categoria)
);


-- =========================================================
-- 4. FORNECEDORES
-- =========================================================

CREATE TABLE fornecedores (
    id_fornecedor INT AUTO_INCREMENT PRIMARY KEY,
    nome_fornecedor VARCHAR(100) NOT NULL,
    telefone_fornecedor VARCHAR(20),
    email_fornecedor VARCHAR(150),
    cnpj_fornecedor VARCHAR(18) UNIQUE,

    rua VARCHAR(100),
    numero VARCHAR(10),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(50),
    cep VARCHAR(9),
    complemento VARCHAR(100),

    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 5. PRODUTOS
-- =========================================================
-- REVENDA     -> comprado pronto e vendido (refrigerante, etc.)
-- INGREDIENTE -> materia-prima, nao e vendido
-- FEITO       -> fabricado pela confeitaria (tem receita)
--
-- preco_produto = preco de venda atual (REVENDA/FEITO).
-- estoque_minimo = limite de alerta, NAO e o saldo fisico.
-- O UNIQUE (id_produto, tipo_produto) permite as FKs compostas
-- que travam o tipo do produto nas demais tabelas.

CREATE TABLE produtos (
    id_produto INT AUTO_INCREMENT PRIMARY KEY,
    id_categoria INT NULL,

    nome_produto VARCHAR(120) NOT NULL,
    descricao_produto VARCHAR(500),
    marca VARCHAR(100),

    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL DEFAULT 'un',

    preco_produto DECIMAL(10,2) NOT NULL DEFAULT 0,
    estoque_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (preco_produto >= 0),
    CHECK (estoque_minimo >= 0),

    UNIQUE (id_produto, tipo_produto),
    INDEX idx_produtos_tipo (tipo_produto, ativo),

    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 6. FEITOS (subtipo de produtos fabricados)
-- =========================================================

CREATE TABLE feitos (
    id_produto INT PRIMARY KEY,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL DEFAULT 'FEITO',

    CHECK (tipo_produto = 'FEITO'),

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_feitos_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 7. DETALHES_RECEITA
-- =========================================================
-- Preparo, rendimento, custos adicionais, margem e status.
-- Cada produto FEITO tem no maximo uma receita.
--
-- rendimento_receita: quanto a receita rende (na unidade do produto).
-- custos_fixos e custo_mao_obra: valores por receita inteira (lote).
-- margem_lucro: percentual (30.00 = 30%).

CREATE TABLE detalhes_receita (
    id_produto_feito INT PRIMARY KEY,

    tempo_preparo_minutos INT NOT NULL,
    rendimento_receita DECIMAL(10,3) NOT NULL,

    instrucoes TEXT,

    custos_fixos DECIMAL(10,2) NOT NULL DEFAULT 0,
    custo_mao_obra DECIMAL(10,2) NOT NULL DEFAULT 0,
    margem_lucro DECIMAL(5,2) NOT NULL DEFAULT 0,

    status_receita ENUM(
        'EM_DESENVOLVIMENTO',
        'ATIVA',
        'INATIVA'
    ) NOT NULL DEFAULT 'EM_DESENVOLVIMENTO',

    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CHECK (tempo_preparo_minutos > 0),
    CHECK (rendimento_receita > 0),
    CHECK (custos_fixos >= 0),
    CHECK (custo_mao_obra >= 0),
    CHECK (margem_lucro >= 0),

    CONSTRAINT fk_detalhes_receita_feitos
        FOREIGN KEY (id_produto_feito)
        REFERENCES feitos(id_produto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 8. RECEITA_INGREDIENTE
-- =========================================================
-- Quanto de cada ingrediente a receita inteira usa.
-- Ex.: rende 20 brownies e usa 500 g de chocolate
--      -> 25 g por brownie (calculado em consulta).
-- A unidade deve ser a mesma de produtos.unidade_medida do ingrediente.

CREATE TABLE receita_ingrediente (
    id_produto_feito INT NOT NULL,
    id_ingrediente INT NOT NULL,
    tipo_ingrediente ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL DEFAULT 'INGREDIENTE',

    quantidade DECIMAL(12,3) NOT NULL,

    PRIMARY KEY (id_produto_feito, id_ingrediente),

    CHECK (quantidade > 0),
    CHECK (tipo_ingrediente = 'INGREDIENTE'),

    CONSTRAINT fk_receita_ing_feito
        FOREIGN KEY (id_produto_feito)
        REFERENCES detalhes_receita(id_produto_feito)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_receita_ing_ingrediente
        FOREIGN KEY (id_ingrediente, tipo_ingrediente)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 9. FORNECEDOR_PRODUTO (N:N)
-- =========================================================
-- Um fornecedor fornece varios produtos e vice-versa.
-- Apenas REVENDA ou INGREDIENTE (produto FEITO nao tem fornecedor).

CREATE TABLE fornecedor_produto (
    id_fornecedor INT NOT NULL,
    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,

    preco_compra DECIMAL(10,2) NOT NULL,

    PRIMARY KEY (id_fornecedor, id_produto),

    CHECK (preco_compra >= 0),
    CHECK (tipo_produto IN ('REVENDA', 'INGREDIENTE')),

    CONSTRAINT fk_fornecedor_produto_fornecedor
        FOREIGN KEY (id_fornecedor)
        REFERENCES fornecedores(id_fornecedor)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_fornecedor_produto_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 10. HISTORICO_PRECO_FORNECEDOR
-- =========================================================
-- Cada mudanca de preco de um produto num fornecedor.
-- Inserir pela aplicacao (ou trigger). RESTRICT: o historico
-- nao some se o vinculo for removido.

CREATE TABLE historico_preco_fornecedor (
    id_historico INT AUTO_INCREMENT PRIMARY KEY,

    id_fornecedor INT NOT NULL,
    id_produto INT NOT NULL,

    preco_compra DECIMAL(10,2) NOT NULL,
    registrado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (preco_compra >= 0),

    CONSTRAINT fk_historico_preco_vinculo
        FOREIGN KEY (id_fornecedor, id_produto)
        REFERENCES fornecedor_produto(id_fornecedor, id_produto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_historico (id_fornecedor, id_produto, registrado_em)
);


-- =========================================================
-- 11. COMPRAS
-- =========================================================
-- Compra CANCELADA nao pode aumentar estoque (regra da aplicacao).
-- valor_total = soma dos itens + frete - desconto (aplicacao/transacao).

CREATE TABLE compras (
    id_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_fornecedor INT NOT NULL,

    data_compra DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    status_compra ENUM('PENDENTE', 'RECEBIDA', 'CANCELADA')
        NOT NULL DEFAULT 'PENDENTE',

    frete DECIMAL(10,2) NOT NULL DEFAULT 0,
    desconto DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,

    observacao VARCHAR(500),

    CHECK (frete >= 0),
    CHECK (desconto >= 0),
    CHECK (valor_total >= 0),

    INDEX idx_compras_data (data_compra),

    CONSTRAINT fk_compras_fornecedor
        FOREIGN KEY (id_fornecedor)
        REFERENCES fornecedores(id_fornecedor)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 12. ITENS_COMPRA
-- =========================================================
-- Ingredientes e produtos de revenda entram pela mesma tabela;
-- a FK composta impede item apontando para produto FEITO.

CREATE TABLE itens_compra (
    id_item_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_compra INT NOT NULL,

    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,

    quantidade DECIMAL(12,3) NOT NULL,
    custo_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2)
        GENERATED ALWAYS AS (ROUND(quantidade * custo_unitario, 2)) STORED,

    CHECK (quantidade > 0),
    CHECK (custo_unitario >= 0),
    CHECK (tipo_produto IN ('REVENDA', 'INGREDIENTE')),

    UNIQUE (id_item_compra, id_produto),

    CONSTRAINT fk_itens_compra_compra
        FOREIGN KEY (id_compra)
        REFERENCES compras(id_compra)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_itens_compra_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 13. PAGAMENTOS_COMPRA
-- =========================================================
-- Pagamentos ao fornecedor separados do recebimento da mercadoria.
-- Uma compra pode ser paga de uma vez ou em parcelas.

CREATE TABLE pagamentos_compra (
    id_pagamento_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_compra INT NOT NULL,
    valor_pagamento DECIMAL(10,2) NOT NULL,
    data_pagamento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    forma_pagamento ENUM(
        'DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'TRANSFERENCIA', 'OUTRO'
    ) NOT NULL,
    status_pagamento ENUM('PENDENTE', 'CONFIRMADO', 'ESTORNADO')
        NOT NULL DEFAULT 'CONFIRMADO',
    observacao VARCHAR(500),

    CHECK (valor_pagamento > 0),
    INDEX idx_pagamentos_compra_compra (id_compra),
    INDEX idx_pagamentos_compra_data (data_pagamento),

    CONSTRAINT fk_pagamentos_compra_compra
        FOREIGN KEY (id_compra)
        REFERENCES compras(id_compra)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 14. LOTES_ESTOQUE
-- =========================================================
-- A validade fica no lote fisico (duas compras do mesmo
-- ingrediente podem vencer em datas diferentes).
-- Lote vencido nao deve ser considerado disponivel.

CREATE TABLE lotes_estoque (
    id_lote INT AUTO_INCREMENT PRIMARY KEY,

    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,
    id_item_compra INT NULL,

    codigo_lote VARCHAR(50),
    quantidade_inicial DECIMAL(12,3) NOT NULL,
    quantidade_atual DECIMAL(12,3) NOT NULL,

    data_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_validade DATE NULL,

    CHECK (quantidade_inicial > 0),
    CHECK (quantidade_atual >= 0),
    CHECK (quantidade_atual <= quantidade_inicial),
    CHECK (tipo_produto IN ('REVENDA', 'INGREDIENTE')),

    UNIQUE (id_lote, id_produto),
    INDEX idx_lotes_produto_validade (id_produto, data_validade),

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_lotes_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto),

    CONSTRAINT fk_lotes_item_compra_produto
        FOREIGN KEY (id_item_compra, id_produto)
        REFERENCES itens_compra(id_item_compra, id_produto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 15. MOVIMENTACOES_ESTOQUE
-- =========================================================
-- Historico do estoque. quantidade COM SINAL:
--   ENTRADA > 0 | SAIDA e PERDA < 0 | AJUSTE pode ser + ou -
-- PERDA e AJUSTE exigem motivo.
-- O saldo atual oficial e mantido em lotes_estoque.quantidade_atual.
-- Cada alteracao deve gerar tambem uma movimentacao de auditoria,
-- atualizando lote e historico na mesma transacao.

CREATE TABLE movimentacoes_estoque (
    id_movimentacao INT AUTO_INCREMENT PRIMARY KEY,

    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,
    id_lote INT NULL,
    id_item_compra INT NULL,
    id_pedido INT NULL,
    id_user INT NULL,

    tipo_movimentacao ENUM('ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE') NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    motivo VARCHAR(255),
    data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (quantidade <> 0),
    CHECK (
        (tipo_movimentacao = 'ENTRADA' AND quantidade > 0)
        OR (tipo_movimentacao IN ('SAIDA', 'PERDA') AND quantidade < 0)
        OR tipo_movimentacao = 'AJUSTE'
    ),
    CHECK (tipo_movimentacao IN ('ENTRADA', 'SAIDA') OR motivo IS NOT NULL),
    CHECK (tipo_produto IN ('REVENDA', 'INGREDIENTE')),

    INDEX idx_mov_estoque_produto_data (id_produto, data_movimentacao),

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_mov_estoque_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto),

    CONSTRAINT fk_mov_estoque_lote_produto
        FOREIGN KEY (id_lote, id_produto)
        REFERENCES lotes_estoque(id_lote, id_produto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_mov_estoque_item_compra_produto
        FOREIGN KEY (id_item_compra, id_produto)
        REFERENCES itens_compra(id_item_compra, id_produto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_mov_estoque_user
        FOREIGN KEY (id_user)
        REFERENCES usuarios(id_user)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 16. PEDIDOS
-- =========================================================
-- IMEDIATO: atendimento na hora, com ou sem cliente cadastrado.
-- AGENDADO: atendimento posterior, exige cliente cadastrado
--           (garantido pelo CHECK abaixo) e um agendamento
--           (garantido pela aplicacao).
-- valor_total e atualizado pela aplicacao dentro de transacao.

CREATE TABLE pedidos (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NULL,
    data_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    tipo_pedido ENUM('IMEDIATO', 'AGENDADO') NOT NULL,

    status_pedido ENUM(
        'PENDENTE',
        'CONFIRMADO',
        'EM_PREPARACAO',
        'PRONTO',
        'CONCLUIDO',
        'CANCELADO'
    ) NOT NULL DEFAULT 'PENDENTE',

    observacao VARCHAR(500),
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,

    CHECK (valor_total >= 0),
    CHECK (tipo_pedido = 'IMEDIATO' OR id_cliente IS NOT NULL),

    UNIQUE (id_pedido, tipo_pedido),

    INDEX idx_pedidos_status_data (status_pedido, data_pedido),

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_pedidos_cliente
        FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_cliente)
);

-- Agora que pedidos existe, liga a movimentacao de estoque ao pedido.
ALTER TABLE movimentacoes_estoque
    ADD CONSTRAINT fk_mov_estoque_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT;


-- =========================================================
-- 17. ITEM_PEDIDO
-- =========================================================
-- So REVENDA ou FEITO podem ser vendidos.
-- preco_unitario = preco praticado no momento do pedido.
-- Sem CASCADE: o historico de vendas nao deve ser apagado.

CREATE TABLE item_pedido (
    id_pedido INT NOT NULL,
    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,

    quantidade DECIMAL(10,3) NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2)
        GENERATED ALWAYS AS (ROUND(quantidade * preco_unitario, 2)) STORED,

    PRIMARY KEY (id_pedido, id_produto),

    CHECK (quantidade > 0),
    CHECK (preco_unitario >= 0),
    CHECK (tipo_produto IN ('REVENDA', 'FEITO')),

    CONSTRAINT fk_item_pedido_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_item_pedido_produto_tipo
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 18. AGENDAMENTOS
-- =========================================================
-- Cada agendamento pertence a um pedido AGENDADO.
-- RETIRADA: cliente busca na confeitaria.
-- ENTREGA: exige endereco de entrega.

CREATE TABLE agendamentos (
    id_pedido INT PRIMARY KEY,
    tipo_pedido ENUM('IMEDIATO', 'AGENDADO') NOT NULL DEFAULT 'AGENDADO',

    tipo_atendimento ENUM('RETIRADA', 'ENTREGA') NOT NULL,
    data_hora_agendada DATETIME NOT NULL,
    endereco_entrega VARCHAR(255),
    observacao VARCHAR(500),

    CHECK (tipo_pedido = 'AGENDADO'),
    CHECK (
        tipo_atendimento = 'RETIRADA'
        OR endereco_entrega IS NOT NULL
    ),

    INDEX idx_agendamentos_data (data_hora_agendada),

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_agendamentos_pedido_tipo
        FOREIGN KEY (id_pedido, tipo_pedido)
        REFERENCES pedidos(id_pedido, tipo_pedido)
);


-- =========================================================
-- 19. PAGAMENTOS
-- =========================================================
-- Um pedido pode ter varios pagamentos (parciais).
-- Valor pago e separado do valor total do pedido.

CREATE TABLE pagamentos (
    id_pagamento INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,

    valor_pagamento DECIMAL(10,2) NOT NULL,
    data_pagamento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    forma_pagamento ENUM(
        'DINHEIRO',
        'PIX',
        'CARTAO_DEBITO',
        'CARTAO_CREDITO',
        'OUTRO'
    ) NOT NULL,

    status_pagamento ENUM('PENDENTE', 'CONFIRMADO', 'ESTORNADO')
        NOT NULL DEFAULT 'CONFIRMADO',

    observacao VARCHAR(500),

    CHECK (valor_pagamento > 0),

    INDEX idx_pagamentos_pedido (id_pedido),
    INDEX idx_pagamentos_data (data_pagamento),

    CONSTRAINT fk_pagamentos_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 20. DESPESAS
-- =========================================================
-- Gastos operacionais. Compra de estoque NAO entra aqui
-- (ela fica em compras).

CREATE TABLE despesas (
    id_despesa INT AUTO_INCREMENT PRIMARY KEY,

    descricao_despesa VARCHAR(255) NOT NULL,

    categoria_despesa ENUM(
        'ALUGUEL',
        'ENERGIA',
        'AGUA',
        'INTERNET',
        'MANUTENCAO',
        'EMBALAGEM',
        'MAO_DE_OBRA',
        'OUTRO'
    ) NOT NULL DEFAULT 'OUTRO',

    valor_despesa DECIMAL(10,2) NOT NULL,
    data_despesa DATE NOT NULL,
    data_vencimento DATE NULL,

    status_pagamento ENUM('PENDENTE', 'PAGO') NOT NULL DEFAULT 'PENDENTE',
    observacao VARCHAR(500),

    CHECK (valor_despesa > 0),

    INDEX idx_despesas_data (data_despesa)
);


-- =========================================================
-- 21. RETIRADAS (dinheiro retirado pelo proprietario)
-- =========================================================
-- NAO e custo de producao: e movimento financeiro distinto.

CREATE TABLE retiradas (
    id_retirada INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT NOT NULL,

    valor_retirada DECIMAL(10,2) NOT NULL,
    data_retirada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descricao_retirada VARCHAR(255),

    CHECK (valor_retirada > 0),

    INDEX idx_retiradas_data (data_retirada),

    CONSTRAINT fk_retiradas_user
        FOREIGN KEY (id_user)
        REFERENCES usuarios(id_user)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);


-- =========================================================
-- 22. CARDAPIOS
-- =========================================================

CREATE TABLE cardapios (
    id_cardapio INT AUTO_INCREMENT PRIMARY KEY,

    nome_cardapio VARCHAR(100) NOT NULL,
    descricao_cardapio VARCHAR(500),

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE (nome_cardapio)
);


-- =========================================================
-- 23. CARDAPIO_PRODUTO (N:N)
-- =========================================================
-- So REVENDA ou FEITO entram no cardapio.
-- preco_cardapio opcional: se NULL, vale produtos.preco_produto.

CREATE TABLE cardapio_produto (
    id_cardapio INT NOT NULL,
    id_produto INT NOT NULL,
    tipo_produto ENUM('REVENDA', 'INGREDIENTE', 'FEITO') NOT NULL,

    preco_cardapio DECIMAL(10,2) NULL,
    disponivel BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id_cardapio, id_produto),

    CHECK (tipo_produto IN ('REVENDA', 'FEITO')),
    CHECK (preco_cardapio IS NULL OR preco_cardapio >= 0),

    CONSTRAINT fk_cardapio_produto_cardapio
        FOREIGN KEY (id_cardapio)
        REFERENCES cardapios(id_cardapio)
        ON DELETE CASCADE,

    -- sem ON DELETE/UPDATE: coluna usada em CHECK
    CONSTRAINT fk_cardapio_produto_produto
        FOREIGN KEY (id_produto, tipo_produto)
        REFERENCES produtos(id_produto, tipo_produto)
);


-- =========================================================
-- 24. HISTORICO_PEDIDOS
-- =========================================================
-- Cada registro e um evento do pedido.
-- valor_historico e opcional (nao faz sentido em todo evento).

CREATE TABLE historico_pedidos (
    id_historico INT AUTO_INCREMENT PRIMARY KEY,

    id_pedido INT NOT NULL,

    tipo_evento ENUM(
        'CRIACAO',
        'ALTERACAO_VALOR',
        'ALTERACAO_STATUS',
        'CANCELAMENTO',
        'CONCLUSAO',
        'OUTRO'
    ) NOT NULL DEFAULT 'OUTRO',

    status_anterior VARCHAR(20) NULL,
    status_novo VARCHAR(20) NULL,
    valor_historico DECIMAL(10,2) NULL,

    descricao_historico VARCHAR(500) NOT NULL,
    data_historico TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (valor_historico IS NULL OR valor_historico >= 0),

    CONSTRAINT fk_historico_pedidos_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_historico_pedido_data
    ON historico_pedidos (id_pedido, data_historico);


-- =========================================================
-- 25. PRODUCAO, ESTOQUE DE FEITOS, RESERVAS E PENDENCIAS
-- =========================================================
-- Estas tabelas fazem parte do banco principal.
-- Foram incorporadas diretamente ao modelo, sem depender de
-- uma segunda etapa de migração.
-- Producao sempre associada a um item de pedido FEITO.
-- receita_snapshot preserva a receita/custos utilizados na data da producao.
CREATE TABLE IF NOT EXISTS producoes (
    id_producao INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_produto_feito INT NOT NULL,
    quantidade_planejada DECIMAL(12,3) NOT NULL,
    quantidade_concluida DECIMAL(12,3) NOT NULL DEFAULT 0,
    quantidade_perdida DECIMAL(12,3) NOT NULL DEFAULT 0,
    status_producao ENUM('PLANEJADA','EM_ANDAMENTO','PARCIAL','CONCLUIDA','CANCELADA') NOT NULL DEFAULT 'PLANEJADA',
    receita_snapshot JSON NULL,
    data_inicio DATETIME NULL,
    data_conclusao DATETIME NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade_planejada > 0),
    CHECK (quantidade_concluida >= 0),
    CHECK (quantidade_perdida >= 0),
    CHECK (quantidade_concluida + quantidade_perdida <= quantidade_planejada),
    INDEX idx_producoes_pedido (id_pedido),
    CONSTRAINT fk_producoes_item FOREIGN KEY (id_pedido,id_produto_feito)
        REFERENCES item_pedido(id_pedido,id_produto) ON DELETE RESTRICT,
    CONSTRAINT fk_producoes_feito FOREIGN KEY (id_produto_feito)
        REFERENCES feitos(id_produto) ON DELETE RESTRICT
);

-- Saldo fisico dos produtos FEITOS, separado dos lotes de compra existentes.
CREATE TABLE IF NOT EXISTS estoque_feitos (
    id_produto_feito INT PRIMARY KEY,
    quantidade_atual DECIMAL(12,3) NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (quantidade_atual >= 0),
    CONSTRAINT fk_estoque_feitos_produto FOREIGN KEY (id_produto_feito)
        REFERENCES feitos(id_produto) ON DELETE RESTRICT
);

-- Auditoria de entradas/saidas/perdas/ajustes de produtos acabados.
CREATE TABLE IF NOT EXISTS movimentacoes_feitos (
    id_movimentacao_feito INT AUTO_INCREMENT PRIMARY KEY,
    id_produto_feito INT NOT NULL,
    id_producao INT NULL,
    id_pedido INT NULL,
    tipo_movimentacao ENUM('ENTRADA','SAIDA','PERDA','AJUSTE') NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    motivo VARCHAR(255) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade <> 0),
    CHECK ((tipo_movimentacao = 'ENTRADA' AND quantidade > 0)
        OR (tipo_movimentacao IN ('SAIDA','PERDA') AND quantidade < 0)
        OR tipo_movimentacao = 'AJUSTE'),
    CHECK (tipo_movimentacao IN ('ENTRADA','SAIDA') OR motivo IS NOT NULL),
    INDEX idx_mov_feitos_produto_data (id_produto_feito,criado_em),
    CONSTRAINT fk_mov_feitos_produto FOREIGN KEY (id_produto_feito)
        REFERENCES feitos(id_produto) ON DELETE RESTRICT,
    CONSTRAINT fk_mov_feitos_producao FOREIGN KEY (id_producao)
        REFERENCES producoes(id_producao) ON DELETE RESTRICT,
    CONSTRAINT fk_mov_feitos_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido) ON DELETE RESTRICT
);

-- Reserva por produto e pedido; a aplicacao deve considerar lotes validos
-- e bloquear linhas com SELECT ... FOR UPDATE para impedir disputa de saldo.
CREATE TABLE IF NOT EXISTS reservas_estoque (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_produto INT NOT NULL,
    quantidade_reservada DECIMAL(12,3) NOT NULL,
    quantidade_consumida DECIMAL(12,3) NOT NULL DEFAULT 0,
    status_reserva ENUM('ATIVA','CONSUMIDA','LIBERADA') NOT NULL DEFAULT 'ATIVA',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade_reservada > 0),
    CHECK (quantidade_consumida >= 0),
    CHECK (quantidade_consumida <= quantidade_reservada),
    INDEX idx_reservas_produto_status (id_produto,status_reserva),
    CONSTRAINT fk_reservas_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido) ON DELETE RESTRICT,
    CONSTRAINT fk_reservas_produto FOREIGN KEY (id_produto)
        REFERENCES produtos(id_produto) ON DELETE RESTRICT
);

-- Demanda nao atendida: nunca altera o saldo fisico para valor negativo.
CREATE TABLE IF NOT EXISTS pendencias_estoque (
    id_pendencia INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producao INT NULL,
    id_produto INT NOT NULL,
    quantidade_pendente DECIMAL(12,3) NOT NULL,
    status_pendencia ENUM('ABERTA','RESOLVIDA','CANCELADA') NOT NULL DEFAULT 'ABERTA',
    motivo VARCHAR(255) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade_pendente > 0),
    INDEX idx_pendencias_produto_status (id_produto,status_pendencia),
    CONSTRAINT fk_pendencias_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido) ON DELETE RESTRICT,
    CONSTRAINT fk_pendencias_producao FOREIGN KEY (id_producao)
        REFERENCES producoes(id_producao) ON DELETE RESTRICT,
    CONSTRAINT fk_pendencias_produto FOREIGN KEY (id_produto)
        REFERENCES produtos(id_produto) ON DELETE RESTRICT
);

-- Consumo real por lote, para auditoria e rastreabilidade.
CREATE TABLE IF NOT EXISTS consumo_producao (
    id_consumo INT AUTO_INCREMENT PRIMARY KEY,
    id_producao INT NOT NULL,
    id_lote INT NOT NULL,
    id_ingrediente INT NOT NULL,
    quantidade_consumida DECIMAL(12,3) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade_consumida > 0),
    INDEX idx_consumo_producao (id_producao),
    CONSTRAINT fk_consumo_producao FOREIGN KEY (id_producao)
        REFERENCES producoes(id_producao) ON DELETE RESTRICT,
    CONSTRAINT fk_consumo_lote_produto FOREIGN KEY (id_lote,id_ingrediente)
        REFERENCES lotes_estoque(id_lote,id_produto) ON DELETE RESTRICT
);

-- =========================================================
-- VIEWS (indicadores calculados, sem duplicar dados)
-- =========================================================

-- Saldo de estoque por produto: a fonte oficial e quantidade_atual dos lotes.
-- Movimentacoes de estoque funcionam como trilha de auditoria; a aplicacao
-- deve atualizar o lote e inserir a movimentacao na mesma transacao.
CREATE VIEW vw_estoque_atual AS
SELECT
    p.id_produto,
    p.nome_produto,
    p.tipo_produto,
    p.unidade_medida,
    p.estoque_minimo,
    COALESCE(SUM(l.quantidade_atual), 0) AS saldo_atual
FROM produtos p
LEFT JOIN lotes_estoque l
    ON l.id_produto = p.id_produto
   AND (l.data_validade IS NULL OR l.data_validade >= CURDATE())
WHERE p.tipo_produto IN ('REVENDA', 'INGREDIENTE')
GROUP BY p.id_produto, p.nome_produto, p.tipo_produto,
         p.unidade_medida, p.estoque_minimo;

-- Produtos abaixo do estoque minimo.
CREATE VIEW vw_alerta_estoque_minimo AS
SELECT *
FROM vw_estoque_atual
WHERE saldo_atual < estoque_minimo;

-- Quanto cada pedido ja recebeu e quanto falta.
CREATE VIEW vw_saldo_pedidos AS
SELECT
    pe.id_pedido,
    pe.status_pedido,
    pe.valor_total,
    COALESCE(SUM(CASE WHEN pg.status_pagamento = 'CONFIRMADO'
                      THEN pg.valor_pagamento END), 0) AS valor_recebido,
    pe.valor_total - COALESCE(SUM(CASE WHEN pg.status_pagamento = 'CONFIRMADO'
                                       THEN pg.valor_pagamento END), 0) AS valor_em_aberto
FROM pedidos pe
LEFT JOIN pagamentos pg ON pg.id_pedido = pe.id_pedido
WHERE pe.status_pedido <> 'CANCELADO'
GROUP BY pe.id_pedido, pe.status_pedido, pe.valor_total;

-- Livro-caixa unificado (base para lucro e saldo nos relatorios).
CREATE VIEW vw_movimentacoes_financeiras AS
SELECT data_pagamento AS data_mov, 'ENTRADA' AS tipo,
       'VENDA' AS categoria, valor_pagamento AS valor,
       'PAGAMENTO' AS origem, id_pagamento AS id_referencia,
       id_pedido AS id_pedido
FROM pagamentos
WHERE status_pagamento = 'CONFIRMADO'
UNION ALL
SELECT data_pagamento, 'SAIDA', 'COMPRA_ESTOQUE', valor_pagamento,
       'PAGAMENTO_COMPRA' AS origem,
       id_pagamento_compra AS id_referencia,
       NULL AS id_pedido
FROM pagamentos_compra
WHERE status_pagamento = 'CONFIRMADO'
UNION ALL
SELECT CAST(data_despesa AS DATETIME), 'SAIDA', categoria_despesa,
       valor_despesa, 'DESPESA' AS origem, id_despesa AS id_referencia,
       NULL AS id_pedido
FROM despesas
WHERE status_pagamento = 'PAGO'
UNION ALL
SELECT data_retirada, 'SAIDA', 'RETIRADA_PROPRIETARIO', valor_retirada,
       'RETIRADA' AS origem, id_retirada AS id_referencia,
       NULL AS id_pedido
FROM retiradas;

-- =========================================================
-- REGRAS IMPORTANTES DA APLICACAO
-- =========================================================
-- 1. Inserir historico_pedidos em toda criacao/alteracao relevante do pedido.
-- 2. Pedido AGENDADO deve ter linha em agendamentos; o CHECK/FK valida apenas
--    que um agendamento existente pertence a pedido do tipo AGENDADO.
-- 3. Atualizar lotes_estoque.quantidade_atual e inserir movimentacoes_estoque
--    na mesma transacao; nao calcular o saldo somando ambas as estruturas.
-- 4. Criar lotes e movimentacoes de entrada quando uma compra for recebida.
-- 5. Registrar pagamentos de clientes e fornecedores apenas quando houver evento
--    real; evitar duplicidade com referencia/identificador unico no backend.
-- 6. vw_movimentacoes_financeiras e um livro-caixa simplificado: inclui pagamentos
--    efetivamente confirmados a fornecedores, nao apenas compras recebidas.
--    Lucro real exige custo dos produtos vendidos e apropriacao dos custos.
-- 7. CHECKs sao aplicados a partir do MySQL 8.0.16.
