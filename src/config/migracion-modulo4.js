require('dotenv').config();
const { pool } = require('./database');

async function ejecutarMigracionModulo4(cliente = pool) {
    // 1. Columnas adicionales no destructivas en tablas existentes
    await cliente.query(`
        ALTER TABLE empresas
            ADD COLUMN IF NOT EXISTS razon_social VARCHAR(180),
            ADD COLUMN IF NOT EXISTS nit VARCHAR(50),
            ADD COLUMN IF NOT EXISTS representante VARCHAR(150),
            ADD COLUMN IF NOT EXISTS estado_aprobacion VARCHAR(30) NOT NULL DEFAULT 'aprobada',
            ADD COLUMN IF NOT EXISTS estado_verificacion VARCHAR(30) NOT NULL DEFAULT 'verificada',
            ADD COLUMN IF NOT EXISTS documento_verificacion_url TEXT,
            ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
            ADD COLUMN IF NOT EXISTS aprobada_en TIMESTAMP,
            ADD COLUMN IF NOT EXISTS aprobada_por VARCHAR(120);

        ALTER TABLE vacantes
            ADD COLUMN IF NOT EXISTS estado_moderacion VARCHAR(20) NOT NULL DEFAULT 'normal',
            ADD COLUMN IF NOT EXISTS motivo_moderacion TEXT,
            ADD COLUMN IF NOT EXISTS moderada_en TIMESTAMP,
            ADD COLUMN IF NOT EXISTS moderada_por VARCHAR(120);

        ALTER TABLE candidatos
            ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo',
            ADD COLUMN IF NOT EXISTS motivo_suspension TEXT;

        ALTER TABLE valoraciones
            ADD COLUMN IF NOT EXISTS estado_moderacion VARCHAR(20) NOT NULL DEFAULT 'visible',
            ADD COLUMN IF NOT EXISTS motivo_moderacion TEXT;

        ALTER TABLE recursos
            ADD COLUMN IF NOT EXISTS slug VARCHAR(220),
            ADD COLUMN IF NOT EXISTS subtipo_material VARCHAR(40) NOT NULL DEFAULT 'articulo',
            ADD COLUMN IF NOT EXISTS archivo_url TEXT,
            ADD COLUMN IF NOT EXISTS nivel VARCHAR(30) NOT NULL DEFAULT 'basico',
            ADD COLUMN IF NOT EXISTS etiquetas TEXT[] NOT NULL DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS visibilidad VARCHAR(20) NOT NULL DEFAULT 'publico',
            ADD COLUMN IF NOT EXISTS descargas INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS vistas INTEGER NOT NULL DEFAULT 0;
    `);

    // 2. Tablas del Módulo de Foros y Comunidad (RF-01)
    await cliente.query(`
        CREATE TABLE IF NOT EXISTS foros (
            id_foro BIGSERIAL PRIMARY KEY,
            nombre VARCHAR(150) NOT NULL,
            slug VARCHAR(180) UNIQUE NOT NULL,
            descripcion TEXT NOT NULL,
            icono VARCHAR(100) DEFAULT '💬',
            orden INTEGER NOT NULL DEFAULT 1,
            origen VARCHAR(20) NOT NULL DEFAULT 'oficial' CHECK (origen IN ('oficial', 'comunitario')),
            creado_por VARCHAR(150) NOT NULL DEFAULT 'Administrador',
            aprobado_por VARCHAR(150),
            estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'archivado')),
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS solicitudes_foros (
            id_solicitud BIGSERIAL PRIMARY KEY,
            solicitante_tipo VARCHAR(20) NOT NULL CHECK (solicitante_tipo IN ('candidato', 'empresa')),
            solicitante_id BIGINT NOT NULL,
            solicitante_nombre VARCHAR(150) NOT NULL,
            nombre VARCHAR(150) NOT NULL,
            descripcion TEXT NOT NULL,
            icono VARCHAR(100) DEFAULT '🗣️',
            motivo TEXT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
            revisado_por VARCHAR(150),
            notas_revision TEXT,
            foro_creado_id BIGINT REFERENCES foros(id_foro) ON DELETE SET NULL,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_revision TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hilos_foro (
            id_hilo BIGSERIAL PRIMARY KEY,
            foro_id BIGINT NOT NULL REFERENCES foros(id_foro) ON DELETE CASCADE,
            autor_tipo VARCHAR(20) NOT NULL CHECK (autor_tipo IN ('candidato', 'empresa', 'admin')),
            autor_id BIGINT NOT NULL DEFAULT 1,
            autor_nombre VARCHAR(150) NOT NULL,
            autor_rol_etiqueta VARCHAR(80) NOT NULL DEFAULT 'Candidato',
            titulo VARCHAR(200) NOT NULL,
            contenido TEXT NOT NULL,
            fijado BOOLEAN NOT NULL DEFAULT FALSE,
            bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
            estado VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculto')),
            motivo_moderacion TEXT,
            vistas INTEGER NOT NULL DEFAULT 0,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            eliminado_en TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS comentarios_foro (
            id_comentario BIGSERIAL PRIMARY KEY,
            hilo_id BIGINT NOT NULL REFERENCES hilos_foro(id_hilo) ON DELETE CASCADE,
            padre_id BIGINT REFERENCES comentarios_foro(id_comentario) ON DELETE CASCADE,
            autor_tipo VARCHAR(20) NOT NULL CHECK (autor_tipo IN ('candidato', 'empresa', 'admin')),
            autor_id BIGINT NOT NULL DEFAULT 1,
            autor_nombre VARCHAR(150) NOT NULL,
            autor_rol_etiqueta VARCHAR(80) NOT NULL DEFAULT 'Candidato',
            contenido TEXT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculto')),
            motivo_moderacion TEXT,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            eliminado_en TIMESTAMP
        );
    `);

    // 3. Tablas de Cursos, Capacitaciones y Exámenes - LMS (RF-02)
    await cliente.query(`
        CREATE TABLE IF NOT EXISTS cursos (
            id_curso BIGSERIAL PRIMARY KEY,
            titulo VARCHAR(180) NOT NULL,
            slug VARCHAR(200) UNIQUE NOT NULL,
            descripcion TEXT NOT NULL,
            objetivos TEXT,
            portada_url TEXT,
            categoria_id BIGINT REFERENCES categorias_recursos(id_categoria) ON DELETE SET NULL,
            nivel VARCHAR(30) NOT NULL DEFAULT 'basico' CHECK (nivel IN ('basico', 'intermedio', 'avanzado')),
            duracion_minutos INTEGER NOT NULL DEFAULT 60,
            requisitos_previos TEXT,
            autor VARCHAR(150) NOT NULL DEFAULT 'Equipo TalentoHub',
            estado VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
            fecha_publicacion TIMESTAMP,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS modulos_curso (
            id_modulo BIGSERIAL PRIMARY KEY,
            curso_id BIGINT NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
            titulo VARCHAR(180) NOT NULL,
            descripcion TEXT,
            orden INTEGER NOT NULL DEFAULT 1,
            estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo'))
        );

        CREATE TABLE IF NOT EXISTS lecciones_curso (
            id_leccion BIGSERIAL PRIMARY KEY,
            modulo_id BIGINT NOT NULL REFERENCES modulos_curso(id_modulo) ON DELETE CASCADE,
            titulo VARCHAR(180) NOT NULL,
            descripcion TEXT,
            contenido TEXT NOT NULL,
            video_url TEXT,
            adjunto_url TEXT,
            recurso_biblioteca_id BIGINT REFERENCES recursos(id_recurso) ON DELETE SET NULL,
            duracion_minutos INTEGER NOT NULL DEFAULT 15,
            orden INTEGER NOT NULL DEFAULT 1,
            obligatoria BOOLEAN NOT NULL DEFAULT TRUE,
            estado VARCHAR(20) NOT NULL DEFAULT 'publicada' CHECK (estado IN ('borrador', 'publicada'))
        );

        CREATE TABLE IF NOT EXISTS inscripciones_curso (
            id_inscripcion BIGSERIAL PRIMARY KEY,
            curso_id BIGINT NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
            candidato_id BIGINT NOT NULL REFERENCES candidatos(id_candidato) ON DELETE CASCADE,
            porcentaje_avance INTEGER NOT NULL DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
            estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'cancelada')),
            fecha_inscripcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ultima_actividad TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_completado TIMESTAMP,
            UNIQUE (curso_id, candidato_id)
        );

        CREATE TABLE IF NOT EXISTS progreso_lecciones (
            id_progreso BIGSERIAL PRIMARY KEY,
            inscripcion_id BIGINT NOT NULL REFERENCES inscripciones_curso(id_inscripcion) ON DELETE CASCADE,
            leccion_id BIGINT NOT NULL REFERENCES lecciones_curso(id_leccion) ON DELETE CASCADE,
            completada BOOLEAN NOT NULL DEFAULT TRUE,
            fecha_completado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (inscripcion_id, leccion_id)
        );

        CREATE TABLE IF NOT EXISTS examenes (
            id_examen BIGSERIAL PRIMARY KEY,
            curso_id BIGINT NOT NULL REFERENCES cursos(id_curso) ON DELETE CASCADE,
            modulo_id BIGINT REFERENCES modulos_curso(id_modulo) ON DELETE SET NULL,
            titulo VARCHAR(180) NOT NULL,
            descripcion TEXT,
            nota_minima INTEGER NOT NULL DEFAULT 70 CHECK (nota_minima BETWEEN 1 AND 100),
            intentos_maximos INTEGER NOT NULL DEFAULT 3 CHECK (intentos_maximos >= 1),
            tiempo_limite_min INTEGER NOT NULL DEFAULT 30 CHECK (tiempo_limite_min >= 1),
            mostrar_resultados BOOLEAN NOT NULL DEFAULT TRUE,
            obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
            estado VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS preguntas_examen (
            id_pregunta BIGSERIAL PRIMARY KEY,
            examen_id BIGINT NOT NULL REFERENCES examenes(id_examen) ON DELETE CASCADE,
            enunciado TEXT NOT NULL,
            tipo VARCHAR(30) NOT NULL DEFAULT 'opcion_unica' CHECK (tipo IN ('opcion_unica', 'opcion_multiple', 'verdadero_falso')),
            puntos INTEGER NOT NULL DEFAULT 10 CHECK (puntos >= 1),
            orden INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS opciones_examen (
            id_opcion BIGSERIAL PRIMARY KEY,
            pregunta_id BIGINT NOT NULL REFERENCES preguntas_examen(id_pregunta) ON DELETE CASCADE,
            texto TEXT NOT NULL,
            es_correcta BOOLEAN NOT NULL DEFAULT FALSE,
            orden INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS intentos_examen (
            id_intento BIGSERIAL PRIMARY KEY,
            examen_id BIGINT NOT NULL REFERENCES examenes(id_examen) ON DELETE CASCADE,
            candidato_id BIGINT NOT NULL REFERENCES candidatos(id_candidato) ON DELETE CASCADE,
            numero_intento INTEGER NOT NULL DEFAULT 1,
            calificacion INTEGER NOT NULL DEFAULT 0,
            aprobado BOOLEAN NOT NULL DEFAULT FALSE,
            estado VARCHAR(20) NOT NULL DEFAULT 'calificado' CHECK (estado IN ('en_curso', 'entregado', 'calificado')),
            respuestas_json JSONB DEFAULT '[]'::jsonb,
            fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_entrega TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 4. Tablas de Aprobación Empresarial, Reportes/Denuncias, Notificaciones, Configuración y Auditoría
    await cliente.query(`
        CREATE TABLE IF NOT EXISTS solicitudes_empresas (
            id_solicitud_empresa BIGSERIAL PRIMARY KEY,
            empresa_id BIGINT NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
            documento_url TEXT,
            notas_solicitante TEXT,
            estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_correccion', 'aprobada', 'rechazada', 'suspendida')),
            motivo_decision TEXT,
            revisado_por VARCHAR(150),
            fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_revision TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reportes (
            id_reporte BIGSERIAL PRIMARY KEY,
            denunciante_tipo VARCHAR(20) NOT NULL DEFAULT 'candidato' CHECK (denunciante_tipo IN ('candidato', 'empresa', 'visitante', 'admin')),
            denunciante_id BIGINT DEFAULT 1,
            denunciante_nombre VARCHAR(150) NOT NULL DEFAULT 'Usuario de la comunidad',
            tipo_contenido VARCHAR(30) NOT NULL CHECK (tipo_contenido IN ('vacante', 'hilo', 'comentario', 'opinion', 'empresa')),
            contenido_id BIGINT NOT NULL,
            contenido_resumen TEXT,
            usuario_reportado_nombre VARCHAR(150),
            motivo VARCHAR(120) NOT NULL,
            descripcion TEXT,
            estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'resuelta', 'desestimada')),
            medida_tomada VARCHAR(100),
            resolucion TEXT,
            revisado_por VARCHAR(150),
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_revision TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notificaciones (
            id_notificacion BIGSERIAL PRIMARY KEY,
            destinatario_tipo VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (destinatario_tipo IN ('general', 'candidatos', 'empresas', 'cursos', 'comunidad', 'admin')),
            destinatario_id BIGINT,
            titulo VARCHAR(180) NOT NULL,
            mensaje TEXT NOT NULL,
            tipo_evento VARCHAR(60) NOT NULL DEFAULT 'aviso_general',
            referencia_url VARCHAR(255),
            leida BOOLEAN NOT NULL DEFAULT FALSE,
            estado VARCHAR(20) NOT NULL DEFAULT 'publicada' CHECK (estado IN ('publicada', 'borrador', 'archivada')),
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS configuracion_plataforma (
            clave VARCHAR(80) PRIMARY KEY,
            valor TEXT NOT NULL,
            etiqueta VARCHAR(140) NOT NULL,
            grupo VARCHAR(50) NOT NULL DEFAULT 'general',
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auditoria_admin (
            id_log BIGSERIAL PRIMARY KEY,
            admin_nombre VARCHAR(150) NOT NULL DEFAULT 'Administrador Principal',
            accion VARCHAR(100) NOT NULL,
            entidad_tipo VARCHAR(80) NOT NULL,
            entidad_id BIGINT,
            descripcion TEXT NOT NULL,
            valores_anteriores JSONB,
            valores_nuevos JSONB,
            ip_address VARCHAR(45) DEFAULT '127.0.0.1',
            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 5. Semilla de datos iniciales (solo si las tablas están vacías)
    const { rows: conteoForos } = await cliente.query('SELECT COUNT(*)::int AS total FROM foros');
    if (conteoForos[0].total === 0) {
        const forosInsertados = await cliente.query(`
            INSERT INTO foros (nombre, slug, descripcion, icono, orden, origen, creado_por, aprobado_por, estado)
            VALUES
                ('Primer empleo', 'primer-empleo', 'Consejos, dudas y experiencias para quienes buscan su primera oportunidad en el mundo laboral.', '🚀', 1, 'oficial', 'Administrador Principal', 'Administrador Principal', 'activo'),
                ('Entrevistas laborales', 'entrevistas-laborales', 'Preguntas frecuentes, simulaciones, recomendaciones y preparación para entrevistas técnicas y de RR. HH.', '🎤', 2, 'oficial', 'Administrador Principal', 'Administrador Principal', 'activo'),
                ('Currículum vitae y portafolio', 'curriculum-vitae', 'Comparte consejos para estructurar tu CV, optimizar palabras clave y presentar tu portafolio profesional.', '📄', 3, 'oficial', 'Administrador Principal', 'Administrador Principal', 'activo'),
                ('Experiencias profesionales', 'experiencias-profesionales', 'Anécdotas reales de crecimiento, transición de carrera, trabajo remoto y cultura organizacional.', '💼', 4, 'oficial', 'Administrador Principal', 'Administrador Principal', 'activo'),
                ('Consejos empresariales y reclutamiento', 'consejos-empresariales', 'Espacio donde reclutadores y empresas comparten qué buscan en los candidatos hoy en día.', '🏢', 5, 'oficial', 'Administrador Principal', 'Administrador Principal', 'activo'),
                ('Tecnología, IA y empleabilidad', 'tecnologia-empleabilidad', 'Comunidad propuesta por usuarios para debatir herramientas digitales, IA y certificaciones con alta demanda.', '💻', 6, 'comunitario', 'José Martínez', 'Administrador Principal', 'activo')
            RETURNING id_foro, slug;
        `);

        const mapaForos = Object.fromEntries(forosInsertados.rows.map(f => [f.slug, f.id_foro]));

        // Solicitudes de foros de ejemplo (Pendiente, Aprobada, Rechazada)
        await cliente.query(`
            INSERT INTO solicitudes_foros (solicitante_tipo, solicitante_id, solicitante_nombre, nombre, descripcion, icono, motivo, estado, revisado_por, notas_revision, foro_creado_id, fecha_revision)
            VALUES
                ('candidato', 3, 'José Martínez', 'Tecnología, IA y empleabilidad', 'Debate sobre herramientas digitales, inteligencia artificial y rutas de estudio en tecnología.', '💻', 'Muchos candidatos del sector tecnológico buscan orientación sobre habilidades emergentes.', 'aprobada', 'Administrador Principal', 'Excelente iniciativa, no existía un foro específico de tecnología.', $1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
                ('candidato', 1, 'Juan Carlos Bodoque', 'Trabajo remoto internacional y freelance', 'Guía sobre contratos remotos, pagos internacionales, inglés conversacional y plataformas freelance.', '🌎', 'Cada vez hay más vacantes remotas en TalentoHub y necesitamos compartir experiencias legales y fiscales.', 'pendiente', NULL, NULL, NULL, NULL),
                ('empresa', 1, 'TechNova Solutions', 'Programas de pasantías y trainees', 'Espacio para conectar universidades, estudiantes de último año y empresas con programas de becarios.', '🎓', 'Queremos escuchar directamente qué esperan los recién graduados de una pasantía.', 'pendiente', NULL, NULL, NULL, NULL),
                ('candidato', 4, 'Sofía López', 'Ofertas de empleo urgentes', 'Publicar ofertas de trabajo rápidas en el foro.', '⚡', 'Para encontrar trabajo sin usar el buscador.', 'rechazada', 'Administrador Principal', 'La plataforma ya cuenta con el módulo oficial de Búsqueda de Empleos (/busqueda) para publicar y filtrar vacantes.', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days');
        `, [mapaForos['tecnologia-empleabilidad']]);

        // Hilos de ejemplo
        const hilosInsertados = await cliente.query(`
            INSERT INTO hilos_foro (foro_id, autor_tipo, autor_id, autor_nombre, autor_rol_etiqueta, titulo, contenido, fijado, bloqueado, estado, vistas, fecha_creacion)
            VALUES
                ($1, 'admin', 0, 'Administrador Principal', 'Administrador', '📌 Guía oficial: Cómo destacar al postular a tu primer empleo sin experiencia laboral previa', '¡Bienvenidos al foro de Primer Empleo! Si estás recién graduado o buscando tu primera oportunidad, te recomendamos:\n\n1. Destacar tus proyectos académicos, voluntariados y prácticas profesionales como experiencia práctica.\n2. Adaptar tu resumen profesional a los requisitos específicos de la vacante.\n3. Completar los cursos de empleabilidad de TalentoHub para validar tus competencias.\n\n¿Qué obstáculo han sentido más difícil al enviar sus primeras postulaciones?', TRUE, FALSE, 'visible', 142, CURRENT_TIMESTAMP - INTERVAL '6 days'),
                ($1, 'candidato', 15, 'Ana Martínez', 'Candidato · Desarrolladora Web Junior', '¿Es recomendable incluir proyectos de la universidad en el CV si busco puesto Junior?', 'Hola comunidad. Acabo de terminar mis estudios y tengo 3 proyectos web completos desplegados, pero no tengo experiencia formal en planilla. ¿Cómo los presentan ustedes para que los reclutadores los tomen en cuenta?', FALSE, FALSE, 'visible', 68, CURRENT_TIMESTAMP - INTERVAL '3 days'),
                ($2, 'empresa', 1, 'TechNova Solutions', 'Empresa Verificada · Tecnología', '📌 Lo que realmente evaluamos en una primera entrevista técnica y cultural', 'Como equipo de reclutamiento en TechNova Solutions, queremos compartirles qué valoramos más allá del dominio técnico:\n\n• Claridad al explicar cómo resolviste un problema o bloqueo.\n• Capacidad de recibir retroalimentación y aprender rápido.\n• Conocimiento básico sobre qué hace la empresa antes de entrar a la llamada.\n\n¡Hagan sus preguntas aquí y con gusto les respondemos desde la perspectiva de RR. HH.!', TRUE, FALSE, 'visible', 215, CURRENT_TIMESTAMP - INTERVAL '5 days'),
                ($2, 'candidato', 2, 'Karla Rivas', 'Candidato · UI Designer', '¿Cómo responder a la pregunta "¿Cuál es tu pretensión salarial?" sin quedar fuera del proceso?', 'Siempre me genera duda si debo dar un número exacto o un rango cuando el anuncio no especifica salario. ¿Qué recomiendan tanto candidatos como reclutadores?', FALSE, FALSE, 'visible', 94, CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ($3, 'candidato', 1, 'Juan Carlos Bodoque', 'Candidato · Product Designer', 'Plantilla de CV de 1 sola página vs 2 páginas: ¿Qué prefieren las empresas en El Salvador?', 'He reducido mi currículum a una sola página enfocada en logros medibles y un enlace directo a mi portafolio. ¿Les ha funcionado mejor el formato compacto?', FALSE, FALSE, 'visible', 77, CURRENT_TIMESTAMP - INTERVAL '4 days'),
                ($4, 'candidato', 4, 'Sofía López', 'Candidato · Analista QA', 'Mi transición de soporte técnico a QA Testing en 8 meses: recursos y aprendizajes', 'Quería compartir mi experiencia cambiando de área hacia aseguramiento de calidad (QA). Aprendí SQL básico, diseño de casos de prueba y automatización con Selenium. ¡Ánimo a quienes están cambiando de rol!', FALSE, FALSE, 'visible', 53, CURRENT_TIMESTAMP - INTERVAL '1 day'),
                ($5, 'empresa', 3, 'Innovación Creativa Agencia', 'Empresa Verificada · Diseño y Marketing', 'Hilo cerrado de consulta: Convocatoria anual de portafolios creativos 2026', 'Esta conversación recopila las dudas generales sobre la revisión de portafolios realizada el mes pasado. El hilo queda cerrado para nuevas respuestas pero disponible como referencia de lectura.', FALSE, TRUE, 'visible', 110, CURRENT_TIMESTAMP - INTERVAL '8 days'),
                ($6, 'candidato', 3, 'José Martínez', 'Candidato · Desarrollador Web', 'Herramientas gratuitas para practicar SQL, Node.js y entrevistas técnicas en 2026', 'Abro este primer hilo en el foro comunitario de Tecnología para que compartamos recursos gratuitos y retos prácticos que les hayan servido para prepararse.', TRUE, FALSE, 'visible', 89, CURRENT_TIMESTAMP - INTERVAL '12 hours')
            RETURNING id_hilo;
        `, [
            mapaForos['primer-empleo'],
            mapaForos['entrevistas-laborales'],
            mapaForos['curriculum-vitae'],
            mapaForos['experiencias-profesionales'],
            mapaForos['consejos-empresariales'],
            mapaForos['tecnologia-empleabilidad']
        ]);

        const idsHilos = hilosInsertados.rows.map(r => r.id_hilo);

        // Comentarios de ejemplo
        await cliente.query(`
            INSERT INTO comentarios_foro (hilo_id, autor_tipo, autor_id, autor_nombre, autor_rol_etiqueta, contenido, fecha_creacion)
            VALUES
                ($1, 'candidato', 3, 'José Martínez', 'Candidato · Desarrollador Web', 'Totalmente de acuerdo con el punto 1. Cuando agregué enlaces a mis repositorios y una breve explicación del problema resuelto, empecé a recibir llamadas.', CURRENT_TIMESTAMP - INTERVAL '5 days'),
                ($1, 'empresa', 1, 'TechNova Solutions', 'Empresa Verificada · Tecnología', 'Confirmamos esto: para perfiles Junior o sin experiencia previa, un proyecto bien documentado vale muchísimo más que una lista larga de tecnologías sin contexto.', CURRENT_TIMESTAMP - INTERVAL '4 days'),
                ($2, 'empresa', 3, 'Innovación Creativa Agencia', 'Empresa Verificada · Diseño y Marketing', '¡Sí, inclúyelos sin dudar! Ponlos en una sección llamada "Proyectos Destacados" indicando qué tecnologías usaste y qué rol tuviste.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ($2, 'candidato', 4, 'Sofía López', 'Candidato · Analista QA', 'A mí me funcionó agregar capturas o el link directo al demo en vivo. Muchos reclutadores lo abren durante la entrevista.', CURRENT_TIMESTAMP - INTERVAL '1 day'),
                ($3, 'candidato', 1, 'Juan Carlos Bodoque', 'Candidato · Product Designer', '¡Gracias por abrir este espacio! ¿Qué tan determinante es que un candidato no conozca una librería específica si domina los fundamentos?', CURRENT_TIMESTAMP - INTERVAL '4 days'),
                ($3, 'empresa', 1, 'TechNova Solutions', 'Empresa Verificada · Tecnología', 'Excelente pregunta Juan Carlos: si dominas las bases (lógica, SQL, arquitectura), una herramienta específica se aprende en las primeras semanas.', CURRENT_TIMESTAMP - INTERVAL '3 days'),
                ($4, 'empresa', 2, 'Logística Global S.A.', 'Empresa Verificada · Logística', 'Recomendamos dar un rango salarial realista basado en el mercado y mencionar que estás abierta a conocer el paquete completo de beneficios y bonificaciones.', CURRENT_TIMESTAMP - INTERVAL '1 day'),
                ($5, 'candidato', 2, 'Karla Rivas', 'Candidato · UI Designer', '1 página con link a portafolio interactivo es ideal; los reclutadores revisan decenas de CVs al día y agradecen la síntesis.', CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ($6, 'candidato', 15, 'Ana Martínez', 'Candidato · Desarrolladora Web Junior', '¡Qué gran historia Sofía! Justo estoy estudiando pruebas automatizadas ySQL, me motiva mucho leer tu caso.', CURRENT_TIMESTAMP - INTERVAL '6 hours');
        `, [idsHilos[0], idsHilos[1], idsHilos[2], idsHilos[3], idsHilos[4], idsHilos[5]]);
    }

    // 6. Actualizar metadatos de recursos existentes para Biblioteca Digital
    await cliente.query(`
        UPDATE recursos SET
            slug = COALESCE(slug, 'recurso-' || id_recurso),
            subtipo_material = CASE
                WHEN tipo = 'video' THEN 'video'
                WHEN tipo = 'tutorial' THEN 'guia_descargable'
                ELSE 'articulo'
            END,
            nivel = CASE
                WHEN id_recurso % 3 = 0 THEN 'intermedio'
                ELSE 'basico'
            END,
            etiquetas = CASE
                WHEN id_recurso = 1 THEN ARRAY['CV', 'Plantilla', 'Empleabilidad']
                WHEN id_recurso = 2 THEN ARRAY['Entrevistas', 'RRHH', 'Consejos']
                WHEN id_recurso = 3 THEN ARRAY['Habilidades', 'Crecimiento', 'Guía']
                ELSE ARRAY['Empleo', 'Desarrollo Profesional']
            END,
            archivo_url = COALESCE(archivo_url, 'https://talentohub.edu.sv/biblioteca/material-' || id_recurso || '.pdf'),
            vistas = CASE WHEN vistas = 0 THEN (id_recurso * 42 + 15)::int ELSE vistas END,
            descargas = CASE WHEN descargas = 0 THEN (id_recurso * 18 + 7)::int ELSE descargas END
        WHERE slug IS NULL OR vistas = 0;
    `);

    // 7. Semilla de Cursos, Módulos, Lecciones, Inscripciones y Exámenes (LMS)
    const { rows: conteoCursos } = await cliente.query('SELECT COUNT(*)::int AS total FROM cursos');
    if (conteoCursos[0].total === 0) {
        const cursosInsertados = await cliente.query(`
            INSERT INTO cursos (titulo, slug, descripcion, objetivos, portada_url, categoria_id, nivel, duracion_minutos, requisitos_previos, autor, estado, fecha_publicacion)
            VALUES
                (
                    'Preparación integral para conseguir tu primer empleo',
                    'preparacion-primer-empleo',
                    'Programa estructurado paso a paso para construir tu perfil profesional, diseñar un CV de alto impacto y superar entrevistas laborales con seguridad.',
                    '1. Estructurar un CV orientado a logros.\n2. Preparar respuestas efectivas con el método STAR.\n3. Optimizar tu perfil y estrategia de postulación en TalentoHub.',
                    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
                    1,
                    'basico',
                    95,
                    'Ninguno. Ideal para estudiantes, recién graduados y profesionales en búsqueda activa.',
                    'Dirección Académica TalentoHub',
                    'publicado',
                    CURRENT_TIMESTAMP - INTERVAL '14 days'
                ),
                (
                    'Comunicación efectiva y liderazgo en equipos ágiles',
                    'comunicacion-equipos-agiles',
                    'Desarrolla habilidades blandas, comunicación asertiva, gestión del tiempo y colaboración en entornos presenciales, híbridos y remotos.',
                    '1. Aplicar técnicas de comunicación asertiva.\n2. Gestionar reuniones y entregables en marcos ágiles.\n3. Resolver conflictos laborales de manera constructiva.',
                    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80',
                    3,
                    'intermedio',
                    120,
                    'Deseable experiencia básica en proyectos colaborativos o académicos.',
                    'Laura Méndez · Coach Organizacional',
                    'publicado',
                    CURRENT_TIMESTAMP - INTERVAL '10 days'
                ),
                (
                    'Portafolio técnico y entrevistas para Tecnología y QA',
                    'portafolio-entrevistas-tecnologia',
                    'Curso práctico para estructurar repositorios, documentar casos de estudio de software/diseño y superar pruebas técnicas en vivo.',
                    '1. Presentar proyectos técnicos con impacto de negocio.\n2. Resolver preguntas de arquitectura y SQL en entrevistas.',
                    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
                    2,
                    'avanzado',
                    150,
                    'Conocimientos básicos de desarrollo web, diseño UI/UX o aseguramiento de calidad.',
                    'Ing. Carlos Salazar',
                    'borrador',
                    NULL
                )
            RETURNING id_curso, slug;
        `);

        const curso1Id = cursosInsertados.rows[0].id_curso;
        const curso2Id = cursosInsertados.rows[1].id_curso;
        const curso3Id = cursosInsertados.rows[2].id_curso;

        // Módulos del Curso 1
        const modulosC1 = await cliente.query(`
            INSERT INTO modulos_curso (curso_id, titulo, descripcion, orden, estado)
            VALUES
                ($1, 'Módulo 1: Construcción del perfil y elaboración del CV', 'Fundamentos para sintetizar tu propuesta de valor profesional y evitar errores de descarte.', 1, 'activo'),
                ($1, 'Módulo 2: Estrategia de postulación y entrevistas laborales', 'Cómo investigar a la empresa, aplicar el método STAR y negociar condiciones laborales.', 2, 'activo')
            RETURNING id_modulo;
        `, [curso1Id]);

        const mod1C1 = modulosC1.rows[0].id_modulo;
        const mod2C1 = modulosC1.rows[1].id_modulo;

        // Lecciones del Curso 1
        const leccionesC1 = await cliente.query(`
            INSERT INTO lecciones_curso (modulo_id, titulo, descripcion, contenido, video_url, adjunto_url, recurso_biblioteca_id, duracion_minutos, orden, obligatoria, estado)
            VALUES
                ($1, 'Lección 1: Estructura estratégica de un CV moderno', 'Qué secciones incluir y cómo redactar logros medibles.', 'Un currículum efectivo debe leerse en menos de 30 segundos. Estructura recomendada:\n1. Encabezado limpio con datos de contacto y enlace a portafolio.\n2. Perfil profesional de 3 a 4 líneas adaptado al puesto.\n3. Experiencia o Proyectos Destacados usando verbos de acción + resultado cuantificable.\n4. Habilidades técnicas y herramientas clave.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://talentohub.edu.sv/biblioteca/plantilla-cv-ats.pdf', 1, 20, 1, TRUE, 'publicada'),
                ($1, 'Lección 2: Errores frecuentes que descartan un CV', 'Revisión de casos reales y optimización de palabras clave.', 'Evita incluir fotografías informales, barras de porcentaje subjetivas (ej. "Inglés 73%") o párrafos densos sin viñetas. Alinea siempre tus habilidades con los requisitos publicados en la vacante.', NULL, NULL, 1, 20, 2, TRUE, 'publicada'),
                ($2, 'Lección 3: El método STAR para responder preguntas difíciles', 'Situación, Tarea, Acción y Resultado aplicados en entrevistas reales.', 'Cuando el reclutador pregunte "Cuéntame sobre un reto que superaste", estructura tu respuesta en 4 pasos:\n• Situación: Contexto breve.\n• Tarea: Qué debías lograr.\n• Acción: Qué hiciste específicamente tú.\n• Resultado: Qué impacto positivo se obtuvo.', NULL, 'https://talentohub.edu.sv/biblioteca/guia-metodo-star.pdf', 2, 25, 1, TRUE, 'publicada'),
                ($2, 'Lección 4: Simulación de entrevista y preguntas al reclutador', 'Cierre exitoso de entrevista y seguimiento post-entrevista.', 'Al final de toda entrevista siempre te preguntarán si tienes dudas. Prepara al menos 2 preguntas estratégicas sobre los retos del equipo en los primeros 90 días y la cultura de trabajo.', NULL, NULL, 2, 30, 2, TRUE, 'publicada')
            RETURNING id_leccion;
        `, [mod1C1, mod2C1]);

        // Módulo y lecciones del Curso 2 y Curso 3
        const modulosC2 = await cliente.query(`
            INSERT INTO modulos_curso (curso_id, titulo, descripcion, orden, estado)
            VALUES
                ($1, 'Módulo 1: Comunicación asertiva y escucha activa', 'Herramientas prácticas para comunicarte con claridad en equipos multidisciplinarios.', 1, 'activo'),
                ($2, 'Módulo 1: Diseño de portafolio con casos reales', 'Cómo documentar arquitectura, pruebas y decisiones técnicas.', 1, 'activo')
            RETURNING id_modulo;
        `, [curso2Id, curso3Id]);

        await cliente.query(`
            INSERT INTO lecciones_curso (modulo_id, titulo, descripcion, contenido, recurso_biblioteca_id, duracion_minutos, orden, obligatoria, estado)
            VALUES
                ($1, 'Lección 1: Principios de comunicación clara en entornos remotos', 'Uso efectivo de canales asíncronos y reuniones diarias.', 'La comunicación escrita en equipos híbridos y remotos requiere contexto completo, acuerdos claros y respeto por los bloques de concentración.', 3, 30, 1, TRUE, 'publicada'),
                ($1, 'Lección 2: Retroalimentación constructiva y resolución de bloqueos', 'Cómo pedir ayuda a tiempo y dar feedback accionable.', 'Comunicar un bloqueo temprano demuestra madurez profesional. Presenta siempre el problema acompañado de lo que ya intentaste.', 3, 35, 2, TRUE, 'publicada'),
                ($2, 'Lección 1: Estructura de un README y caso de estudio técnico', 'Qué revisan los líderes técnicos al evaluar tu código.', 'Todo proyecto de portafolio debe explicar el problema, la arquitectura elegida, cómo ejecutarlo y qué aprendiste.', NULL, 40, 1, TRUE, 'publicada')
        `, [modulosC2.rows[0].id_modulo, modulosC2.rows[1].id_modulo]);

        // Inscripciones y progreso de candidatos
        const inscInsertadas = await cliente.query(`
            INSERT INTO inscripciones_curso (curso_id, candidato_id, porcentaje_avance, estado, fecha_inscripcion, ultima_actividad, fecha_completado)
            VALUES
                ($1, 1, 100, 'completada', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ($1, 2, 50, 'activa', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
                ($1, 3, 75, 'activa', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 hours', NULL),
                ($2, 1, 50, 'activa', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
                ($2, 4, 100, 'completada', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days')
            RETURNING id_inscripcion, candidato_id, curso_id;
        `, [curso1Id, curso2Id]);

        const idInsc1 = inscInsertadas.rows[0].id_inscripcion;
        const idInsc2 = inscInsertadas.rows[1].id_inscripcion;
        const idsLecciones = leccionesC1.rows.map(l => l.id_leccion);

        for (const idLec of idsLecciones) {
            await cliente.query(`
                INSERT INTO progreso_lecciones (inscripcion_id, leccion_id, completada)
                VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING
            `, [idInsc1, idLec]);
        }
        await cliente.query(`
            INSERT INTO progreso_lecciones (inscripcion_id, leccion_id, completada)
            VALUES ($1, $2, TRUE), ($1, $3, TRUE) ON CONFLICT DO NOTHING
        `, [idInsc2, idsLecciones[0], idsLecciones[1]]);

        // Examen final del Curso 1
        const examenInsertado = await cliente.query(`
            INSERT INTO examenes (curso_id, modulo_id, titulo, descripcion, nota_minima, intentos_maximos, tiempo_limite_min, mostrar_resultados, obligatorio, estado)
            VALUES
                ($1, $2, 'Evaluación Final: Empleabilidad, CV y Entrevistas', 'Comprueba tu dominio sobre redacción de logros en el CV, aplicación del método STAR y preparación para entrevistas laborales.', 70, 3, 30, TRUE, TRUE, 'publicado'),
                ($3, NULL, 'Evaluación de Comunicación Ágil y Liderazgo', 'Cuestionario práctico sobre comunicación asertiva, acuerdos de equipo y resolución de conflictos.', 75, 3, 25, TRUE, TRUE, 'publicado')
            RETURNING id_examen;
        `, [curso1Id, mod2C1, curso2Id]);

        const examen1Id = examenInsertado.rows[0].id_examen;
        const examen2Id = examenInsertado.rows[1].id_examen;

        const preguntasInsertadas = await cliente.query(`
            INSERT INTO preguntas_examen (examen_id, enunciado, tipo, puntos, orden)
            VALUES
                ($1, '¿Cuál es el objetivo principal de aplicar la metodología STAR durante una entrevista laboral?', 'opcion_unica', 40, 1),
                ($1, 'En un currículum orientado a resultados, es recomendable describir logros medibles en lugar de listar únicamente tareas genéricas.', 'verdadero_falso', 30, 2),
                ($1, 'Selecciona las buenas prácticas recomendadas antes de asistir a una entrevista de trabajo:', 'opcion_multiple', 30, 3),
                ($2, 'Comunicar un bloqueo técnico a tiempo junto con las alternativas ya probadas es una práctica recomendada en equipos ágiles.', 'verdadero_falso', 100, 1)
            RETURNING id_pregunta;
        `, [examen1Id, examen2Id]);

        const [p1, p2, p3, p4] = preguntasInsertadas.rows.map(r => r.id_pregunta);

        await cliente.query(`
            INSERT INTO opciones_examen (pregunta_id, texto, es_correcta, orden)
            VALUES
                ($1, 'Estructurar una respuesta clara con Situación, Tarea, Acción y Resultado medible.', TRUE, 1),
                ($1, 'Memorizar respuestas genéricas sin mencionar experiencias reales.', FALSE, 2),
                ($1, 'Evitar hablar de resultados concretos durante la entrevista.', FALSE, 3),
                ($2, 'Verdadero', TRUE, 1),
                ($2, 'Falso', FALSE, 2),
                ($3, 'Investigar la misión, productos y cultura de la empresa.', TRUE, 1),
                ($3, 'Preparar ejemplos concretos de proyectos o retos resueltos.', TRUE, 2),
                ($3, 'Improvisar sin haber leído los requisitos de la vacante.', FALSE, 3),
                ($4, 'Verdadero', TRUE, 1),
                ($4, 'Falso', FALSE, 2);
        `, [p1, p2, p3, p4]);

        await cliente.query(`
            INSERT INTO intentos_examen (examen_id, candidato_id, numero_intento, calificacion, aprobado, estado, fecha_inicio, fecha_entrega)
            VALUES
                ($1, 1, 1, 100, TRUE, 'calificado', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ($1, 3, 1, 60, FALSE, 'calificado', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
                ($2, 4, 1, 100, TRUE, 'calificado', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days');
        `, [examen1Id, examen2Id]);
    }

    // 8. Actualizar metadatos de empresas existentes y sembrar solicitudes empresariales
    await cliente.query(`
        UPDATE empresas SET
            razon_social = COALESCE(razon_social, nombre || ', S.A. de C.V.'),
            nit = COALESCE(nit, '0614-150' || id_empresa || '22-10' || id_empresa || '-0'),
            representante = COALESCE(representante, CASE
                WHEN id_empresa = 1 THEN 'María Rodríguez'
                WHEN id_empresa = 2 THEN 'Roberto Castellanos'
                ELSE 'Gabriela Mena'
            END),
            correo = COALESCE(correo, 'contacto@empresa' || id_empresa || '.com.sv'),
            telefono = COALESCE(telefono, '+503 2200-100' || id_empresa),
            estado_aprobacion = CASE
                WHEN estado = 'activa' AND estado_aprobacion = 'aprobada' THEN 'aprobada'
                WHEN estado = 'pendiente' THEN 'pendiente'
                ELSE estado_aprobacion
            END,
            aprobada_en = COALESCE(aprobada_en, CURRENT_TIMESTAMP - INTERVAL '20 days'),
            aprobada_por = COALESCE(aprobada_por, 'Administrador Principal');
    `);

    const { rows: conteoSolEmpresas } = await cliente.query('SELECT COUNT(*)::int AS total FROM solicitudes_empresas');
    if (conteoSolEmpresas[0].total === 0) {
        await cliente.query(`
            INSERT INTO solicitudes_empresas (empresa_id, documento_url, notas_solicitante, estado, motivo_decision, revisado_por, fecha_solicitud, fecha_revision)
            SELECT id_empresa, 'https://talentohub.edu.sv/docs/registro-mercantil-' || id_empresa || '.pdf',
                   'Documentación legal y NIT verificados para operar en TalentoHub.',
                   'aprobada',
                   'Cumple todos los requisitos legales y fiscales verificados.',
                   'Administrador Principal',
                   CURRENT_TIMESTAMP - INTERVAL '25 days',
                   CURRENT_TIMESTAMP - INTERVAL '20 days'
            FROM empresas
            WHERE id_empresa IN (1, 2, 3);
        `);
    }

    // 9. Semilla de Reportes / Denuncias (Centro de Moderación)
    const { rows: conteoReportes } = await cliente.query('SELECT COUNT(*)::int AS total FROM reportes');
    if (conteoReportes[0].total === 0) {
        const { rows: primerHilo } = await cliente.query('SELECT id_hilo, titulo FROM hilos_foro ORDER BY id_hilo ASC LIMIT 1');
        const { rows: primeraVacante } = await cliente.query('SELECT id_vacante, titulo FROM vacantes ORDER BY id_vacante ASC LIMIT 1');
        const { rows: primeraOpinion } = await cliente.query('SELECT id_valoracion, comentario FROM valoraciones ORDER BY id_valoracion ASC LIMIT 1');

        if (primeraVacante[0]) {
            await cliente.query(`
                INSERT INTO reportes (denunciante_tipo, denunciante_id, denunciante_nombre, tipo_contenido, contenido_id, contenido_resumen, usuario_reportado_nombre, motivo, descripcion, estado)
                VALUES ('candidato', 2, 'Karla Rivas', 'vacante', $1, $2, 'Empresa publicadora', 'Información salarial o requisitos confusos', 'Solicito revisar que los requisitos del puesto coincidan con el nivel de experiencia solicitado.', 'pendiente')
            `, [primeraVacante[0].id_vacante, primeraVacante[0].titulo]);
        }

        if (primerHilo[0]) {
            await cliente.query(`
                INSERT INTO reportes (denunciante_tipo, denunciante_id, denunciante_nombre, tipo_contenido, contenido_id, contenido_resumen, usuario_reportado_nombre, motivo, descripcion, estado)
                VALUES ('candidato', 4, 'Sofía López', 'hilo', $1, $2, 'Autor del hilo', 'Posible enlace promocional o spam', 'Revisión preventiva solicitada por un miembro de la comunidad.', 'en_revision')
            `, [primerHilo[0].id_hilo, primerHilo[0].titulo]);
        }

        if (primeraOpinion[0]) {
            await cliente.query(`
                INSERT INTO reportes (denunciante_tipo, denunciante_id, denunciante_nombre, tipo_contenido, contenido_id, contenido_resumen, usuario_reportado_nombre, motivo, descripcion, estado, medida_tomada, resolucion, revisado_por, fecha_revision)
                VALUES ('empresa', 3, 'Innovación Creativa Agencia', 'opinion', $1, $2, 'Juan Carlos Bodoque', 'Opinión sin detalle suficiente', 'La empresa solicitó verificar si la reseña cumplía las normas.', 'desestimada', 'Ninguna (contenido permitido)', 'La valoración expresa una opinión legítima y respetuosa sin infringir las normas de la comunidad.', 'Administrador Principal', CURRENT_TIMESTAMP - INTERVAL '1 day')
            `, [primeraOpinion[0].id_valoracion, primeraOpinion[0].comentario]);
        }
    }

    // 10. Semilla de Notificaciones, Configuración General y Auditoría
    const { rows: conteoNotif } = await cliente.query('SELECT COUNT(*)::int AS total FROM notificaciones');
    if (conteoNotif[0].total === 0) {
        await cliente.query(`
            INSERT INTO notificaciones (destinatario_tipo, titulo, mensaje, tipo_evento, referencia_url, estado, fecha_creacion)
            VALUES
                ('candidatos', '¡Nuevos recursos y cursos disponibles!', 'Hemos habilitado el curso "Preparación integral para conseguir tu primer empleo" y nuevas guías en la biblioteca digital.', 'nuevo_contenido', '/recursos', 'publicada', CURRENT_TIMESTAMP - INTERVAL '3 days'),
                ('comunidad', 'Nuevo foro comunitario aprobado: Tecnología, IA y empleabilidad', 'Ya puedes participar, crear hilos y compartir recursos en el nuevo espacio de tecnología de la comunidad.', 'foro_aprobado', '/foros/tecnologia-empleabilidad', 'publicada', CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ('empresas', 'Recordatorio de buenas prácticas en publicación de vacantes', 'Recuerda especificar el rango salarial y modalidad de trabajo para atraer hasta un 30% más de candidatos calificados.', 'aviso_empresarial', '/empresarial/publicar', 'publicada', CURRENT_TIMESTAMP - INTERVAL '1 day'),
                ('admin', 'Solicitudes de foros y reportes pendientes de revisión', 'Tienes propuestas de nuevos foros comunitarios y reportes en la bandeja de moderación.', 'alerta_admin', '/administrativo/foros', 'publicada', CURRENT_TIMESTAMP - INTERVAL '4 hours');
        `);
    }

    const { rows: conteoConfig } = await cliente.query('SELECT COUNT(*)::int AS total FROM configuracion_plataforma');
    if (conteoConfig[0].total === 0) {
        await cliente.query(`
            INSERT INTO configuracion_plataforma (clave, valor, etiqueta, grupo)
            VALUES
                ('nombre_plataforma', 'TalentoHub', 'Nombre de la plataforma', 'identidad'),
                ('lema_plataforma', 'Conectamos tu talento con nuevas oportunidades profesionales.', 'Descripción / Lema oficial', 'identidad'),
                ('logo_url', '/img/logo-talentohub.svg', 'Logotipo oficial (URL)', 'identidad'),
                ('correo_contacto', 'soporte@talentohub.edu.sv', 'Correo electrónico de contacto', 'contacto'),
                ('telefono_contacto', '+503 2250-8000', 'Teléfono de atención', 'contacto'),
                ('direccion_fisica', 'San Salvador, El Salvador', 'Dirección institucional', 'contacto'),
                ('redes_sociales', 'LinkedIn: /company/talentohub · X: @talentohub_sv', 'Redes sociales oficiales', 'contacto'),
                ('normas_comunidad', '1. Trato respetuoso y profesional en todos los foros.\n2. Prohibido publicar spam, enlaces maliciosos o discriminación.\n3. Las propuestas de nuevos foros son revisadas por la administración para evitar duplicados.\n4. Las empresas deben mantener información veraz en sus vacantes.', 'Normas de la comunidad y foros', 'politicas'),
                ('terminos_condiciones', 'El uso de TalentoHub implica la aceptación de las políticas de publicación responsable de ofertas laborales, veracidad de perfiles profesionales y respeto a la propiedad intelectual de los cursos y biblioteca digital.', 'Términos y condiciones de uso', 'politicas'),
                ('politica_privacidad', 'Los datos personales y currículums de los candidatos se utilizan exclusivamente para los procesos de postulación y formación dentro de TalentoHub.', 'Política de privacidad y protección de datos', 'politicas');
        `);
    }

    const { rows: conteoLogs } = await cliente.query('SELECT COUNT(*)::int AS total FROM auditoria_admin');
    if (conteoLogs[0].total === 0) {
        await cliente.query(`
            INSERT INTO auditoria_admin (admin_nombre, accion, entidad_tipo, entidad_id, descripcion, valores_nuevos, fecha_creacion)
            VALUES
                ('Administrador Principal', 'APROBAR_EMPRESA', 'empresa', 1, 'Se aprobó el registro empresarial de TechNova Solutions tras verificar NIT y escritura.', '{"estado_aprobacion":"aprobada"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '20 days'),
                ('Administrador Principal', 'APROBAR_FORO', 'solicitud_foro', 1, 'Se aprobó la solicitud comunitaria y se creó el foro "Tecnología, IA y empleabilidad".', '{"estado":"aprobada","slug":"tecnologia-empleabilidad"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '5 days'),
                ('Administrador Principal', 'PUBLICAR_CURSO', 'curso', 1, 'Se publicó el curso "Preparación integral para conseguir tu primer empleo" con 2 módulos y evaluación final.', '{"estado":"publicado"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '14 days'),
                ('Administrador Principal', 'RECHAZAR_FORO', 'solicitud_foro', 4, 'Se rechazó la propuesta "Ofertas de empleo urgentes" por duplicidad con el buscador de empleos.', '{"estado":"rechazada"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '2 days'),
                ('Administrador Principal', 'RESOLVER_REPORTE', 'reporte', 3, 'Se revisó y desestimó el reporte sobre valoración empresarial al no encontrar infracción.', '{"estado":"desestimada"}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day');
        `);
    }
}

if (require.main === module) {
    ejecutarMigracionModulo4()
        .then(() => {
            console.log('Migración y semilla del Módulo 4 (Foros y Administración) completadas exitosamente.');
            return pool.end();
        })
        .catch((err) => {
            console.error('Error en migración del Módulo 4:', err);
            pool.end();
            process.exitCode = 1;
        });
}

module.exports = { ejecutarMigracionModulo4 };
