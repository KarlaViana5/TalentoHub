const { filas, primera, transaccion, errorHttp, texto, opcion, auditar } = require('./modulo4-db.service');

const secciones = {
    usuarios: {
        titulo: 'Usuarios',
        consulta: `SELECT u.id, u.nombre, u.correo, u.rol, CASE WHEN u.activo THEN 'activo' ELSE 'suspendido' END AS estado,
            COALESCE(c.nombre, e.nombre) AS vinculo FROM modulo4.usuarios u
            LEFT JOIN public.candidatos c ON c.id_candidato = u.candidato_id
            LEFT JOIN public.empresas e ON e.id_empresa = u.empresa_id`,
        columnas: { nombre: 'Nombre', correo: 'Correo', rol: 'Rol', estado: 'Estado', vinculo: 'Registro vinculado' },
        acciones: { suspender: 'Suspender', reactivar: 'Reactivar' }
    },
    empresas: {
        titulo: 'Empresas',
        consulta: `SELECT e.id_empresa AS id, e.nombre, e.sector, e.estado, e.ubicacion, e.descripcion,
            COALESCE(m.estado, 'sin_verificar') AS verificacion, m.nota FROM public.empresas e
            LEFT JOIN modulo4.empresas_verificacion m ON m.id = e.id_empresa`,
        columnas: { nombre: 'Empresa', sector: 'Sector', ubicacion: 'Ubicación', descripcion: 'Descripción',
            estado: 'Estado', verificacion: 'Verificación', nota: 'Nota' },
        acciones: { activar: 'Activar', desactivar: 'Desactivar', verificar: 'Verificar', revisar: 'En revisión',
            quitar_verificacion: 'Quitar verificación' }
    },
    vacantes: {
        titulo: 'Vacantes',
        consulta: `SELECT v.id_vacante AS id, v.titulo, e.nombre AS empresa, v.estado,
            COALESCE(m.visibilidad, 'visible') AS visibilidad,
            CASE WHEN m.sospechosa THEN 'Sí' ELSE 'No' END AS sospechosa, m.nota
            FROM public.vacantes v JOIN public.empresas e ON e.id_empresa = v.empresa_id
            LEFT JOIN modulo4.vacantes_moderacion m ON m.id = v.id_vacante`,
        columnas: { titulo: 'Título', empresa: 'Empresa', estado: 'Estado', visibilidad: 'Visibilidad',
            sospechosa: 'Sospechosa', nota: 'Nota' },
        acciones: { ocultar: 'Ocultar', mostrar: 'Restaurar visibilidad', cerrar: 'Cerrar',
            eliminar: 'Dar de baja', marcar: 'Marcar como sospechosa', desmarcar: 'Quitar alerta' }
    },
    foros: {
        titulo: 'Categorías de foros',
        consulta: 'SELECT id, slug, nombre, descripcion, estado FROM modulo4.foros',
        columnas: { nombre: 'Nombre', descripcion: 'Descripción', slug: 'Ruta', estado: 'Estado' },
        acciones: { activar: 'Activar', desactivar: 'Desactivar', archivar: 'Archivar' }
    },
    hilos: {
        titulo: 'Hilos',
        consulta: `SELECT h.id, h.titulo, h.contenido, h.estado, h.fijado, h.cerrado, f.nombre AS foro, u.nombre AS autor
            FROM modulo4.hilos h JOIN modulo4.foros f ON f.id = h.foro_id
            LEFT JOIN modulo4.usuarios u ON u.id = h.autor_id`,
        columnas: { titulo: 'Título', contenido: 'Contenido', foro: 'Foro', autor: 'Autor', estado: 'Estado',
            fijado: 'Fijado', cerrado: 'Cerrado' },
        acciones: { ocultar: 'Ocultar', mostrar: 'Restaurar', eliminar: 'Eliminar', fijar: 'Fijar', desfijar: 'Desfijar',
            cerrar: 'Cerrar comentarios', abrir: 'Abrir comentarios' }
    },
    comentarios: {
        titulo: 'Comentarios',
        consulta: `SELECT c.id, h.titulo AS hilo, c.contenido, c.estado, u.nombre AS autor
            FROM modulo4.comentarios c JOIN modulo4.hilos h ON h.id = c.hilo_id
            LEFT JOIN modulo4.usuarios u ON u.id = c.autor_id`,
        columnas: { hilo: 'Hilo', contenido: 'Contenido', autor: 'Autor', estado: 'Estado' },
        acciones: { ocultar: 'Ocultar', mostrar: 'Restaurar', eliminar: 'Eliminar' }
    },
    recursos: {
        titulo: 'Moderación de recursos',
        consulta: `SELECT r.id_recurso AS id, r.titulo, r.tipo, r.estado, COALESCE(m.oculto, false) AS oculto
            FROM public.recursos r LEFT JOIN modulo4.recursos_moderacion m ON m.id = r.id_recurso`,
        columnas: { titulo: 'Título', tipo: 'Tipo', estado: 'Estado editorial', oculto: 'Oculto al público' },
        acciones: { ocultar: 'Ocultar', mostrar: 'Restaurar visibilidad' }
    },
    valoraciones: {
        titulo: 'Moderación de valoraciones',
        consulta: `SELECT v.id_valoracion AS id, e.nombre AS empresa, v.puntuacion, v.comentario,
            COALESCE(m.oculto, false) AS oculto FROM public.valoraciones v
            JOIN public.empresas e ON e.id_empresa = v.empresa_id
            LEFT JOIN modulo4.valoraciones_moderacion m ON m.id = v.id_valoracion`,
        columnas: { empresa: 'Empresa', puntuacion: 'Puntuación', comentario: 'Comentario', oculto: 'Oculta' },
        acciones: { ocultar: 'Ocultar', mostrar: 'Restaurar' }
    },
    reportes: {
        titulo: 'Reportes',
        consulta: `SELECT r.id, r.tipo, r.objetivo_id, r.motivo, r.estado, r.resolucion, u.nombre AS autor
            FROM modulo4.reportes r LEFT JOIN modulo4.usuarios u ON u.id = r.autor_id`,
        columnas: { tipo: 'Tipo', objetivo_id: 'Registro señalado', motivo: 'Motivo', estado: 'Estado',
            autor: 'Denunciante', resolucion: 'Resolución' },
        acciones: { revisar: 'En revisión', resolver: 'Resolver', desestimar: 'Desestimar' }
    },
    auditoria: {
        titulo: 'Auditoría',
        consulta: `SELECT a.id, a.entidad, a.objetivo_id, a.accion, a.detalle, a.creado_en, u.nombre AS admin
            FROM modulo4.auditoria a LEFT JOIN modulo4.usuarios u ON u.id = a.admin_id`,
        columnas: { creado_en: 'Fecha', admin: 'Administrador', entidad: 'Sección',
            objetivo_id: 'Registro', accion: 'Acción', detalle: 'Detalle' },
        acciones: {}
    }
};

async function listar(seccion, filtro, anteriorA) {
    const { consulta } = seccion;
    return filas(`SELECT * FROM (${consulta}) datos
        WHERE ($1 = '' OR position(lower($1) in lower(to_jsonb(datos)::text)) > 0)
          AND ($2::bigint IS NULL OR id < $2)
        ORDER BY id DESC LIMIT 51`, [filtro, anteriorA]);
}

async function estadisticas() {
    const indicadores = await primera(`SELECT
        (SELECT count(*)::int FROM modulo4.usuarios) AS usuarios,
        (SELECT count(*)::int FROM public.candidatos) AS candidatos,
        (SELECT count(*)::int FROM public.empresas) AS empresas,
        (SELECT count(*)::int FROM public.vacantes) AS vacantes,
        (SELECT count(*)::int FROM public.postulaciones) AS postulaciones,
        (SELECT count(*)::int FROM public.recursos) AS recursos,
        (SELECT count(*)::int FROM modulo4.foros WHERE estado = 'activo') AS foros_activos,
        (SELECT count(*)::int FROM modulo4.hilos WHERE estado = 'visible') AS hilos_visibles,
        (SELECT count(*)::int FROM modulo4.reportes WHERE estado IN ('pendiente', 'en_revision')) AS reportes_pendientes`);
    const actividad = await filas(`SELECT d.dia::date::text AS dia, count(h.id)::int AS hilos
        FROM generate_series(current_date - 6, current_date, '1 day'::interval) AS d(dia)
        LEFT JOIN modulo4.hilos h ON h.creado_en >= d.dia AND h.creado_en < d.dia + interval '1 day'
        GROUP BY d.dia ORDER BY d.dia`);
    const vacantesPorEstado = await filas('SELECT estado, count(*)::int AS cantidad FROM public.vacantes GROUP BY estado ORDER BY estado');
    return { indicadores, actividad, vacantesPorEstado };
}

async function guardarForo(adminId, datos, id = null) {
    const nombre = texto(datos.nombre, 'El nombre', 100, 3);
    const descripcion = texto(datos.descripcion, 'La descripción', 800);
    await transaccion(async cliente => {
        const foro = id
            ? await primera(`UPDATE modulo4.foros SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING id`,
                [nombre, descripcion, id], cliente)
            : await primera(`INSERT INTO modulo4.foros (nombre, descripcion, slug) VALUES ($1, $2, $3) RETURNING id`,
                [nombre, descripcion, validarSlug(datos.slug)], cliente);
        if (!foro) throw errorHttp(404, 'Foro no encontrado.');
        await auditar(cliente, adminId, 'foros', foro.id, id ? 'editar' : 'crear', nombre);
    }).catch(error => {
        if (error.code === '23505') throw errorHttp(409, 'Ya existe un foro con esa ruta.');
        throw error;
    });
}

function validarSlug(valor) {
    const slug = texto(valor, 'La ruta', 80);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || ['hilos', 'ingresar', 'salir'].includes(slug)) {
        throw errorHttp(422, 'Usa una ruta disponible con letras minúsculas, números y guiones.');
    }
    return slug;
}

async function cambiarUsuario(id, accion, cliente) {
    const usuario = await primera('SELECT rol FROM modulo4.usuarios WHERE id = $1 FOR UPDATE', [id], cliente);
    if (!usuario) return null;
    if (usuario.rol === 'admin') throw errorHttp(403, 'Las cuentas administrativas se gestionan desde la consola.');
    await filas('UPDATE modulo4.usuarios SET activo = $2 WHERE id = $1', [id, accion === 'reactivar'], cliente);
    await filas('DELETE FROM modulo4.sesiones WHERE usuario_id = $1', [id], cliente);
    return usuario;
}

async function cambiarEmpresa(id, accion, nota, cliente) {
    if (accion === 'activar' || accion === 'desactivar') {
        const empresa = await primera('UPDATE public.empresas SET estado = $2 WHERE id_empresa = $1 RETURNING id_empresa',
            [id, accion === 'activar' ? 'activa' : 'inactiva'], cliente);
        if (empresa && accion === 'desactivar') {
            await filas(`DELETE FROM modulo4.sesiones WHERE usuario_id IN
                (SELECT id FROM modulo4.usuarios WHERE empresa_id = $1)`, [id], cliente);
        }
        return empresa;
    }
    const estado = { verificar: 'verificada', revisar: 'en_revision', quitar_verificacion: 'sin_verificar' }[accion];
    return primera(`INSERT INTO modulo4.empresas_verificacion (id, estado, nota)
        SELECT id_empresa, $2, $3 FROM public.empresas WHERE id_empresa = $1
        ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, nota = EXCLUDED.nota RETURNING id`,
    [id, estado, nota], cliente);
}

async function cambiarVacante(id, accion, nota, cliente) {
    if (accion === 'cerrar') {
        return primera("UPDATE public.vacantes SET estado = 'cerrada' WHERE id_vacante = $1 RETURNING id_vacante",
            [id], cliente);
    }
    const visibilidad = { ocultar: 'oculta', mostrar: 'visible', eliminar: 'eliminada' }[accion] || null;
    const sospechosa = { marcar: true, desmarcar: false }[accion] ?? null;
    return primera(`INSERT INTO modulo4.vacantes_moderacion AS m (id, visibilidad, sospechosa, nota)
        SELECT id_vacante, COALESCE($2, 'visible'), COALESCE($3, false), $4
        FROM public.vacantes WHERE id_vacante = $1
        ON CONFLICT (id) DO UPDATE SET visibilidad = COALESCE($2, m.visibilidad),
            sospechosa = COALESCE($3, m.sospechosa), nota = COALESCE($4, m.nota) RETURNING id`,
    [id, visibilidad, sospechosa, nota], cliente);
}

const accionesEstado = {
    foros: { activar: 'activo', desactivar: 'inactivo', archivar: 'archivado' },
    hilos: { ocultar: 'oculto', mostrar: 'visible', eliminar: 'eliminado' },
    comentarios: { ocultar: 'oculto', mostrar: 'visible', eliminar: 'eliminado' },
    reportes: { revisar: 'en_revision', resolver: 'resuelto', desestimar: 'desestimado' }
};

const cambiosHilo = {
    fijar: { columna: 'fijado', valor: true },
    desfijar: { columna: 'fijado', valor: false },
    cerrar: { columna: 'cerrado', valor: true },
    abrir: { columna: 'cerrado', valor: false }
};

const moderacionCompartida = {
    recursos: { tabla: 'recursos', pk: 'id_recurso', moderacion: 'recursos_moderacion' },
    valoraciones: { tabla: 'valoraciones', pk: 'id_valoracion', moderacion: 'valoraciones_moderacion' }
};

async function cambiarRegistro(seccion, id, accion, nota, cliente) {
    if (seccion === 'usuarios') return cambiarUsuario(id, accion, cliente);
    if (seccion === 'empresas') return cambiarEmpresa(id, accion, nota, cliente);
    if (seccion === 'vacantes') return cambiarVacante(id, accion, nota, cliente);
    if (seccion === 'reportes') {
        return primera('UPDATE modulo4.reportes SET estado = $2, resolucion = $3 WHERE id = $1 RETURNING id',
            [id, accionesEstado.reportes[accion], nota], cliente);
    }
    if (Object.hasOwn(moderacionCompartida, seccion)) {
        const { tabla, pk, moderacion } = moderacionCompartida[seccion];
        return primera(`INSERT INTO modulo4.${moderacion} (id, oculto)
            SELECT ${pk}, $2 FROM public.${tabla} WHERE ${pk} = $1
            ON CONFLICT (id) DO UPDATE SET oculto = EXCLUDED.oculto RETURNING id`,
        [id, accion === 'ocultar'], cliente);
    }
    const cambio = seccion === 'hilos' && Object.hasOwn(cambiosHilo, accion)
        ? cambiosHilo[accion] : { columna: 'estado', valor: accionesEstado[seccion][accion] };
    return primera(`UPDATE modulo4.${seccion} SET ${cambio.columna} = $2 WHERE id = $1 RETURNING id`,
        [id, cambio.valor], cliente);
}

async function moderar(adminId, seccion, id, datos) {
    const accion = opcion(datos.accion, Object.keys(secciones[seccion].acciones));
    const nota = texto(datos.nota, 'La nota', 1000, seccion === 'reportes' && accion !== 'revisar' ? 5 : 0) || null;
    await transaccion(async cliente => {
        if (!await cambiarRegistro(seccion, id, accion, nota, cliente)) {
            throw errorHttp(404, 'Registro no encontrado.');
        }
        await auditar(cliente, adminId, seccion, id, accion, nota);
    });
}

async function editarUsuario(adminId, id, datos) {
    const nombre = texto(datos.nombre, 'El nombre', 150);
    const correo = texto(datos.correo, 'El correo', 254).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(correo)) throw errorHttp(422, 'Escribe un correo válido.');
    await transaccion(async cliente => {
        const usuario = await primera('SELECT rol, correo FROM modulo4.usuarios WHERE id = $1 FOR UPDATE', [id], cliente);
        if (!usuario) throw errorHttp(404, 'Usuario no encontrado.');
        if (usuario.rol === 'admin') throw errorHttp(403, 'Las cuentas administrativas se gestionan desde la consola.');
        await filas('UPDATE modulo4.usuarios SET nombre = $1, correo = $2 WHERE id = $3', [nombre, correo, id], cliente);
        if (correo !== usuario.correo) await filas('DELETE FROM modulo4.sesiones WHERE usuario_id = $1', [id], cliente);
        await auditar(cliente, adminId, 'usuarios', id, 'editar', nombre);
    }).catch(error => {
        if (error.code === '23505') throw errorHttp(409, 'El correo pertenece a otra cuenta.');
        throw error;
    });
}

async function editarEmpresa(adminId, id, datos) {
    const nombre = texto(datos.nombre, 'El nombre', 150);
    const ubicacion = texto(datos.ubicacion, 'La ubicación', 150);
    const descripcion = texto(datos.descripcion, 'La descripción', 3000, 0);
    await transaccion(async cliente => {
        const empresa = await primera(`UPDATE public.empresas SET nombre = $1, ubicacion = $2, descripcion = $3
            WHERE id_empresa = $4 RETURNING id_empresa`, [nombre, ubicacion, descripcion, id], cliente);
        if (!empresa) throw errorHttp(404, 'Empresa no encontrada.');
        await auditar(cliente, adminId, 'empresas', id, 'editar', nombre);
    });
}

async function leerConfiguracion() {
    return {
        configuracion: await primera('SELECT * FROM modulo4.configuracion'),
        avisos: await filas('SELECT * FROM modulo4.avisos ORDER BY id DESC LIMIT 30')
    };
}

async function configurar(adminId, datos) {
    const aviso = texto(datos.aviso, 'El aviso de foros', 600, 0);
    const abiertas = datos.abiertas === '1';
    await transaccion(async cliente => {
        await filas('UPDATE modulo4.configuracion SET publicaciones_abiertas = $1, aviso_foros = $2', [abiertas, aviso], cliente);
        await auditar(cliente, adminId, 'configuracion', null, 'actualizar', abiertas ? 'Publicaciones abiertas' : 'Publicaciones cerradas');
    });
}

async function publicarAviso(adminId, datos) {
    const titulo = texto(datos.titulo, 'El título', 150);
    const mensaje = texto(datos.mensaje, 'El mensaje', 1000);
    const audiencia = opcion(datos.audiencia, ['todos', 'candidato', 'empresa']);
    await transaccion(async cliente => {
        const aviso = await primera(`INSERT INTO modulo4.avisos (titulo, mensaje, audiencia)
            VALUES ($1, $2, $3) RETURNING id`, [titulo, mensaje, audiencia], cliente);
        await auditar(cliente, adminId, 'avisos', aviso.id, 'publicar', titulo);
    });
}

module.exports = { secciones, listar, estadisticas, guardarForo, moderar, editarUsuario, editarEmpresa, leerConfiguracion, configurar, publicarAviso };
