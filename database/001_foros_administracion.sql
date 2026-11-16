BEGIN;

CREATE SCHEMA IF NOT EXISTS modulo4;

CREATE TABLE IF NOT EXISTS modulo4.usuarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL,
    correo text NOT NULL UNIQUE CHECK (correo = lower(correo)),
    clave_hash text NOT NULL,
    rol text NOT NULL CHECK (rol IN ('admin', 'candidato', 'empresa')),
    activo boolean NOT NULL DEFAULT true,
    candidato_id bigint UNIQUE REFERENCES public.candidatos(id_candidato) ON DELETE CASCADE,
    empresa_id bigint REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
    CHECK (
        (rol = 'admin' AND candidato_id IS NULL AND empresa_id IS NULL) OR
        (rol = 'candidato' AND candidato_id IS NOT NULL AND empresa_id IS NULL) OR
        (rol = 'empresa' AND candidato_id IS NULL AND empresa_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS modulo4.sesiones (
    token_hash text PRIMARY KEY,
    usuario_id bigint NOT NULL REFERENCES modulo4.usuarios(id) ON DELETE CASCADE,
    csrf text NOT NULL,
    vence timestamptz NOT NULL DEFAULT (now() + interval '12 hours')
);

CREATE TABLE IF NOT EXISTS modulo4.foros (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    nombre text NOT NULL,
    descripcion text NOT NULL,
    estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'archivado')),
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modulo4.hilos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    foro_id bigint NOT NULL REFERENCES modulo4.foros(id),
    autor_id bigint REFERENCES modulo4.usuarios(id) ON DELETE SET NULL,
    titulo text NOT NULL,
    contenido text NOT NULL,
    fijado boolean NOT NULL DEFAULT false,
    cerrado boolean NOT NULL DEFAULT false,
    estado text NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculto', 'eliminado')),
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modulo4.comentarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hilo_id bigint NOT NULL REFERENCES modulo4.hilos(id),
    autor_id bigint REFERENCES modulo4.usuarios(id) ON DELETE SET NULL,
    padre_id bigint,
    contenido text NOT NULL,
    estado text NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculto', 'eliminado')),
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (hilo_id, id),
    FOREIGN KEY (hilo_id, padre_id) REFERENCES modulo4.comentarios(hilo_id, id)
);

CREATE TABLE IF NOT EXISTS modulo4.reportes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    autor_id bigint REFERENCES modulo4.usuarios(id) ON DELETE SET NULL,
    tipo text NOT NULL CHECK (tipo IN ('hilo', 'comentario', 'vacante', 'empresa', 'recurso', 'valoracion')),
    objetivo_id bigint NOT NULL,
    motivo text NOT NULL,
    estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'resuelto', 'desestimado')),
    resolucion text,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modulo4.auditoria (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id bigint REFERENCES modulo4.usuarios(id) ON DELETE SET NULL,
    entidad text NOT NULL,
    objetivo_id bigint,
    accion text NOT NULL,
    detalle text,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modulo4.vacantes_moderacion (
    id bigint PRIMARY KEY REFERENCES public.vacantes(id_vacante) ON DELETE CASCADE,
    visibilidad text NOT NULL DEFAULT 'visible' CHECK (visibilidad IN ('visible', 'oculta', 'eliminada')),
    sospechosa boolean NOT NULL DEFAULT false,
    nota text
);

CREATE TABLE IF NOT EXISTS modulo4.empresas_verificacion (
    id bigint PRIMARY KEY REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
    estado text NOT NULL CHECK (estado IN ('sin_verificar', 'en_revision', 'verificada')),
    nota text
);

CREATE TABLE IF NOT EXISTS modulo4.recursos_moderacion (
    id bigint PRIMARY KEY REFERENCES public.recursos(id_recurso) ON DELETE CASCADE,
    oculto boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS modulo4.valoraciones_moderacion (
    id bigint PRIMARY KEY REFERENCES public.valoraciones(id_valoracion) ON DELETE CASCADE,
    oculto boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS modulo4.configuracion (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    publicaciones_abiertas boolean NOT NULL DEFAULT true,
    aviso_foros text NOT NULL DEFAULT ''
);

INSERT INTO modulo4.configuracion DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS modulo4.avisos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    audiencia text NOT NULL CHECK (audiencia IN ('todos', 'candidato', 'empresa')),
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hilos_foro_visibilidad ON modulo4.hilos(foro_id, estado, fijado DESC, id DESC);
CREATE INDEX IF NOT EXISTS comentarios_hilo_visibilidad ON modulo4.comentarios(hilo_id, estado, id);
CREATE INDEX IF NOT EXISTS sesiones_vencimiento ON modulo4.sesiones(vence);
CREATE INDEX IF NOT EXISTS reportes_estado ON modulo4.reportes(estado, id DESC);

-- Las tablas del módulo solo se acceden desde el servidor de TalentoHub.
REVOKE ALL ON SCHEMA modulo4 FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA modulo4 FROM PUBLIC;

COMMIT;
