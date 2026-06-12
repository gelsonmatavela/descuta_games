-- Terceiro jogo: "Warfront" (FPS 3D de guerra em ondas).
INSERT INTO games (slug, name, difficulty)
VALUES ('warfront', 'Warfront', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO taunts (game_id, text)
SELECT id, t.text FROM games, (VALUES
    ('Caiu em combate. Os inimigos nem suaram.'),
    ('A onda te engoliu. Literalmente a primeira?'),
    ('Recarregou na hora errada. Classico.'),
    ('Eles eram feitos de caixas. CAIXAS.'),
    ('Mirar ajuda. Fica a dica.'),
    ('O esquadrao inimigo agradece a pratica de tiro.')
) AS t(text)
WHERE games.slug = 'warfront'
  AND NOT EXISTS (
    SELECT 1 FROM taunts tx JOIN games g ON g.id = tx.game_id
    WHERE g.slug = 'warfront'
  );
