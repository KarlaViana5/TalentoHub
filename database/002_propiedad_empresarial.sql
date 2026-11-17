-- FASE 2: migration prepared only; never run from application startup.
-- Apply manually after review on a backed-up/test database first.
BEGIN;
CREATE TABLE IF NOT EXISTS public.empresas_propietarios (
    usuario_id BIGINT NOT NULL REFERENCES public.usuarios_cuenta(id_usuario) ON DELETE CASCADE,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, empresa_id)
);
INSERT INTO public.empresas_propietarios (usuario_id, empresa_id)
SELECT id_usuario, empresa_id FROM public.usuarios_cuenta
WHERE rol = 'empresa' AND empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS empresas_propietarios_empresa_idx ON public.empresas_propietarios(empresa_id);
REVOKE ALL ON public.empresas_propietarios FROM PUBLIC;
COMMIT;
-- If migration owner differs from the backend role, grant SELECT/INSERT to that role manually.
-- No ownership is guessed for additional legacy companies without a linked account.
