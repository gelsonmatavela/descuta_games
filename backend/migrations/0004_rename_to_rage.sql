-- Renomeia o jogo "Plataforma Armadilha" para "Rage".
-- (Feito numa migration própria; nunca editar uma migration já aplicada.)
UPDATE games SET name = 'Rage' WHERE slug = 'trap-adventure';
