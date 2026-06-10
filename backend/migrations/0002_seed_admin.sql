-- Admin padrao para acesso ao painel.
-- Credenciais: email = admin@rage.dev / senha = admin123
-- Hash Argon2 gerado com Argon2::default() (mesmo algoritmo do backend).
-- TROQUE a senha em producao.
INSERT INTO players (username, email, password_hash, is_admin)
VALUES (
    'admin',
    'admin@rage.dev',
    '$argon2id$v=19$m=19456,t=2,p=1$SF/1c6ss7eJrk71AKcKQkg$7vZKT6aGUojpUONe1ftDq0+NiIOlrlomtv4f4DRFRV4',
    TRUE
)
ON CONFLICT (email) DO NOTHING;
