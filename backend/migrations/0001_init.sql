-- Jogadores
CREATE TABLE players (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogo de jogos (ex.: "Rage")
CREATE TABLE games (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    -- 1 = sadico, 10 = impossivel. Ajustavel pelo painel admin.
    difficulty INT NOT NULL DEFAULT 5 CHECK (difficulty BETWEEN 1 AND 10),
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada tentativa/partida de um jogador
CREATE TABLE runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    score            INT NOT NULL DEFAULT 0,
    deaths           INT NOT NULL DEFAULT 0,
    duration_seconds INT NOT NULL DEFAULT 0,
    completed        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runs_game_score ON runs (game_id, score DESC);
CREATE INDEX idx_runs_player ON runs (player_id);

-- Frases zombeteiras mostradas ao jogador quando morre (configuraveis pelo admin)
CREATE TABLE taunts (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    text    TEXT NOT NULL,
    active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO games (slug, name, difficulty) VALUES
    ('trap-adventure', 'Rage', 6);

INSERT INTO taunts (game_id, text)
SELECT id, t.text FROM games, (VALUES
    ('Serio? Voce caiu AI?'),
    ('Ate minha avo passou dessa parte.'),
    ('A armadilha estava literalmente na sua frente.'),
    ('Tenta de novo. Ou nao, tanto faz.'),
    ('Voce de novo? Que persistencia inutil.')
) AS t(text)
WHERE games.slug = 'trap-adventure';
