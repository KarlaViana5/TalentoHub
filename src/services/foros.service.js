const { filas, primera, transaccion, errorHttp, identificador, texto } = require('./modulo4-db.service');

async function listarForos() {
    return filas(`SELECT f.*, count(h.id)::int AS cantidad FROM modulo4.foros f
        LEFT JOIN modulo4.hilos h ON h.foro_id = f.id AND h.estado = 'visible'
        WHERE f.estado = 'activo' GROUP BY f.id ORDER BY f.nombre, f.id`);
}

async function obtenerForo(slug) {
    const foro = await primera("SELECT * FROM modulo4.foros WHERE slug = $1 AND estado = 'activo'", [slug]);
    if (!foro) throw errorHttp(404, 'Foro no disponible.');
    const hilos = await filas(`SELECT h.id, h.titulo, h.fijado, h.cerrado, u.nombre AS autor
        FROM modulo4.hilos h LEFT JOIN modulo4.usuarios u ON u.id = h.autor_id
        WHERE h.foro_id = $1 AND h.estado = 'visible' ORDER BY h.fijado DESC, h.id DESC`, [foro.id]);
    return { foro, hilos };
}

async function obtenerHilo(id) {
    const hilo = await primera(`SELECT h.*, f.slug, f.nombre AS foro, u.nombre AS autor
        FROM modulo4.hilos h JOIN modulo4.foros f ON f.id = h.foro_id
        LEFT JOIN modulo4.usuarios u ON u.id = h.autor_id
        WHERE h.id = $1 AND h.estado = 'visible' AND f.estado = 'activo'`, [id]);
    if (!hilo) throw errorHttp(404, 'Hilo no disponible.');
    const comentarios = await filas(`WITH RECURSIVE visibles AS (
        SELECT c.* FROM modulo4.comentarios c WHERE c.hilo_id = $1 AND c.padre_id IS NULL AND c.estado = 'visible'
        UNION ALL
        SELECT c.* FROM modulo4.comentarios c JOIN visibles p ON p.id = c.padre_id
        WHERE c.hilo_id = $1 AND c.estado = 'visible'
    ) SELECT c.*, u.nombre AS autor, pu.nombre AS autor_padre
        FROM visibles c LEFT JOIN modulo4.usuarios u ON u.id = c.autor_id
        LEFT JOIN visibles p ON p.id = c.padre_id
        LEFT JOIN modulo4.usuarios pu ON pu.id = p.autor_id ORDER BY c.id`, [id]);
    return { hilo, comentarios };
}

async function validarPublicacion(usuarioId, cliente) {
    const usuario = await primera(`SELECT u.activo, (u.rol <> 'empresa' OR EXISTS (
        SELECT 1 FROM public.empresas e WHERE e.id_empresa = u.empresa_id AND e.estado = 'activa' FOR SHARE
    )) AS empresa_habilitada FROM modulo4.usuarios u WHERE u.id = $1 FOR SHARE`, [usuarioId], cliente);
    const configuracion = await primera('SELECT publicaciones_abiertas FROM modulo4.configuracion FOR SHARE', [], cliente);
    if (!usuario?.activo || !usuario.empresa_habilitada || !configuracion.publicaciones_abiertas) {
        throw errorHttp(403, 'Las publicaciones están restringidas.');
    }
}

async function crearHilo(slug, usuarioId, datos) {
    const titulo = texto(datos.titulo, 'El título', 150, 5);
    const contenido = texto(datos.contenido, 'El contenido', 10000, 5);
    return transaccion(async cliente => {
        await validarPublicacion(usuarioId, cliente);
        const foro = await primera("SELECT id FROM modulo4.foros WHERE slug = $1 AND estado = 'activo' FOR SHARE",
            [slug], cliente);
        if (!foro) throw errorHttp(404, 'Foro no disponible.');
        return primera(`INSERT INTO modulo4.hilos (foro_id, autor_id, titulo, contenido)
            VALUES ($1, $2, $3, $4) RETURNING id`, [foro.id, usuarioId, titulo, contenido], cliente);
    });
}

async function crearComentario(id, usuarioId, datos) {
    const contenido = texto(datos.contenido, 'El comentario', 4000);
    const padre = datos.padre_id ? identificador(datos.padre_id) : null;
    await transaccion(async cliente => {
        await validarPublicacion(usuarioId, cliente);
        const hilo = await primera(`SELECT h.cerrado FROM modulo4.hilos h JOIN modulo4.foros f ON f.id = h.foro_id
            WHERE h.id = $1 AND h.estado = 'visible' AND f.estado = 'activo' FOR SHARE OF h, f`, [id], cliente);
        if (!hilo) throw errorHttp(404, 'Hilo no disponible.');
        if (hilo.cerrado) throw errorHttp(409, 'Este hilo está cerrado a comentarios.');
        if (padre) {
            const respuesta = await primera(`WITH RECURSIVE cadena AS (
                SELECT c.id, c.padre_id, c.estado FROM modulo4.comentarios c WHERE c.id = $2 AND c.hilo_id = $1
                UNION ALL
                SELECT c.id, c.padre_id, c.estado FROM modulo4.comentarios c JOIN cadena p ON c.id = p.padre_id
            ) SELECT bool_and(c.estado = 'visible') AS visible FROM modulo4.comentarios c
                JOIN (SELECT original.id FROM modulo4.comentarios original JOIN cadena USING (id) FOR SHARE OF original) p
                    ON c.id = p.id`, [id, padre], cliente);
            if (!respuesta.visible) throw errorHttp(422, 'El comentario seleccionado no está disponible.');
        }
        await filas(`INSERT INTO modulo4.comentarios (hilo_id, autor_id, padre_id, contenido)
            VALUES ($1, $2, $3, $4)`, [id, usuarioId, padre, contenido], cliente);
    });
}

async function contextoPublico(rol) {
    const [configuracion, avisos] = await Promise.all([
        primera('SELECT * FROM modulo4.configuracion'),
        filas(`SELECT titulo, mensaje FROM modulo4.avisos
            WHERE audiencia = 'todos' OR audiencia = $1 ORDER BY id DESC LIMIT 5`, [rol || null])
    ]);
    return { configuracion, avisos };
}

async function denunciar(id, usuarioId, datos) {
    const { comentarios } = await obtenerHilo(id);
    const comentario = datos.comentario_id ? identificador(datos.comentario_id) : null;
    if (comentario && !comentarios.some(c => c.id === comentario)) throw errorHttp(404, 'Comentario no disponible.');
    const motivo = texto(datos.motivo, 'El motivo', 1000, 5);
    await filas(`INSERT INTO modulo4.reportes (autor_id, tipo, objetivo_id, motivo) VALUES ($1, $2, $3, $4)`,
        [usuarioId, comentario ? 'comentario' : 'hilo', comentario || id, motivo]);
}

module.exports = { listarForos, obtenerForo, obtenerHilo, crearHilo, crearComentario, contextoPublico, denunciar };
