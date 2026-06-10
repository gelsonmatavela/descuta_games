-- Segundo jogo: "Neon Dash" (endless runner).
INSERT INTO games (slug, name, difficulty)
VALUES ('neon-dash', 'Neon Dash', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO taunts (game_id, text)
SELECT id, t.text FROM games, (VALUES
    ('Correu direto pro obstaculo. Impressionante.'),
    ('Seus reflexos sao... decorativos.'),
    ('A velocidade te pegou. Como sempre.'),
    ('Pulou tarde. De novo.'),
    ('Tao perto. Mentira, nem foi.'),
    ('Ate parado voce perderia.')
) AS t(text)
WHERE games.slug = 'neon-dash'
  AND NOT EXISTS (
    SELECT 1 FROM taunts tx JOIN games g ON g.id = tx.game_id
    WHERE g.slug = 'neon-dash'
  );
