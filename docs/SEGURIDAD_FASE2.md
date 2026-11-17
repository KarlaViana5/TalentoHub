# Fase 2: seguridad de TalentoHub

## Alcance y estado

Rama revisada: mejora/navbar-unificado. Se integraron los cambios sobre el trabajo pendiente de Fase 1. No se hicieron commits, push, cambios en .env, ejecuciones de migracion ni escrituras en PostgreSQL real. Las pruebas cargan las fuentes con una dependencia de base de datos simulada que bloquea pg, dotenv y el arranque.

## Correcciones

- Foros resuelve el actor exclusivamente desde req.usuario, cargado a partir de la sesion del servidor. actor/rol/usuario del cliente no conceden identidad. Los actores internos son inmutables y se comprueba participacion, autor o administrador. Las mutaciones de autor incorporan el permiso tambien en SQL.
- Empresarial usa AsyncLocalStorage por peticion; no existe empleadorActual compartido. Todas las consultas de empresas, vacantes, postulaciones, notas, indicadores y exportaciones se acotan a las empresas autorizadas. Un lote mixto se rechaza completo. La creacion adicional y su vinculo de propietario comparten transaccion.
- El login limita a 10 intentos por cuenta y 30 por IP en 15 minutos, con un mapa acotado a 10000 entradas. No confia en X-Forwarded-For. Se mantienen scrypt y los hashes existentes; el login por ID de demostracion falla cerrado. Una cuenta suspendida deja de validar su sesion.
- asegurarEsquemaAuth solo comprueba tablas existentes. Ni el arranque ni el middleware ejecutan DDL o crean usuarios. server.js ya no ejecuta migracion-modulo4.js. No se cambian cuentas existentes.
- Empresas nuevas: pendiente, pendiente, no_verificada. No se fabrican NIT ni documentos y no se escribe una aprobacion automatica. El formulario solicita el NIT. Publicar o reactivar vacantes exige empresa activa y aprobada; editar el perfil no puede autoaprobar una empresa.
- CSRF firmado con HMAC y ligado a cookie/sesion, incluso antes de login. Los formularios usan _csrf; JSON/JavaScript pueden usar X-CSRF-Token. Se verifican Origin y Sec-Fetch-Site cuando llegan. SameSite no reemplaza al token. Referencia: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Cierre de sesion mediante POST con CSRF. GET /auth/logout y /logout muestran confirmacion sin invalidar la sesion. El navbar conserva sus clases, responsive y menu movil; el control tiene la misma apariencia y ahora envia un formulario.
- Los GET de detalle ya no incrementan contadores. El navegador envia un POST separado, con CSRF y filtro de visibilidad, a las rutas /vista. Sin JavaScript los contadores no se incrementan.
- Limites de cuerpo, parametros positivos seguros, validacion de estructuras y errores globales sin detalles de PostgreSQL.

## Requisitos y migracion pendiente

1. La base existente debe contar ya con las tablas publicas de TalentoHub, usuarios_cuenta y sesiones_auth. No hay inicializacion automatica de esquema/cuentas. Una instalacion nueva requiere un procedimiento de provisionamiento revisado por separado; el SQL antiguo 001 del esquema modulo4 no sustituye las tablas de autenticacion actuales.
2. database/002_propiedad_empresarial.sql esta PREPARADO Y NO EJECUTADO. Crea la relacion empresas_propietarios y copia solo relaciones conocidas de usuarios_cuenta. No borra registros ni adivina propietarios de empresas historicas sin vinculo.
3. Antes de aplicar 002: revisar y probar en base aislada. Si el rol del backend no es propietario, conceder SELECT e INSERT sobre la nueva tabla al rol correcto. No asignar empresas historicas a cuentas sin revision/autorizacion.
4. Sin 002, funciona el vinculo original usuarios_cuenta.empresa_id. Crear empresas adicionales devuelve 503 explicativo; nunca deja una empresa nueva sin propietario. Tras aplicar 002, las peticiones siguientes detectan la tabla y permiten el flujo adicional.
5. En produccion usar HTTPS y NODE_ENV=production para cookies Secure. No se altero .env.
6. CSRF_SIGNING_KEY es opcional: secreto aleatorio de al menos 32 bytes suministrado por el operador fuera del repositorio. En un proceso sin esa configuracion se genera una clave en memoria y, al reiniciar, los formularios abiertos requieren recarga. Varios procesos deben compartir esa clave. Nunca registrar su valor.
7. El limite de login reside en memoria por proceso: para varias instancias se requiere un almacen compartido o un limitador perimetral. No se agregaron dependencias ni confianza automatica en proxies; configurar solo proxies conocidos si corresponde.

## Compatibilidad

- Se conservan rutas y vistas. GET logout pasa a confirmacion. Formularios antiguos abiertos antes del cambio necesitan recarga por CSRF; clientes que envian POST deben incluir _csrf o X-CSRF-Token.
- Las contrasenas existentes siguen funcionando sin restablecimiento; los registros nuevos exigen 12-256 caracteres y confirmacion coincidente.
- Los consumidores internos de empresarial deben ejecutarse dentro de conContextoEmpresa(usuario, tarea, conexionOpcional). Los servicios sin contexto fallan cerrado. usarConexion requiere tarea y contexto, y no establece un cliente global. La antigua prueba empresarial que escribe en una base configurada no se ejecuto y necesita adaptacion a este contexto antes de usarse en una base aislada.
- Crear empresas adicionales sigue disponible cuando se aplica la migracion autorizada; los registros historicos sin relacion demostrable no se exponen por defecto.
- No se reviso toda la plataforma como una auditoria exhaustiva. Permanecen por validar las restricciones SQL reales, el despliegue/proxy, permisos del rol de PostgreSQL, la atribucion de auditoria administrativa existente y las cuentas historicas con contrasenas antiguas conocidas. No se cambio ninguna contrasena ni dato real.

## Archivos de implementacion

- src/app.js y src/server.js.
- src/middleware/auth.middleware.js; nuevos csrf.middleware.js, input.middleware.js y login-limit.middleware.js.
- Controladores: administrativo, auth, busqueda, empresarial y foros.
- Servicios: administrativo, auth, empresarial, foros y vacantes.
- Rutas: administrativo, auth, busqueda, candidato, empresarial y foros.
- Vistas: formularios POST de auth, candidato, empresarial, foros, administrativo y busqueda; logout existente convertido a POST. Parciales navigation.ejs y head.ejs; nuevo csrf-head.ejs y pagina auth/logout.ejs. Heads independientes de busqueda, candidato y CV incluyen los metadatos CSRF.
- src/public/css/navigation.css: solo reglas para conservar apariencia del formulario/boton POST. No se cambio navigation.js.
- Nuevo src/public/js/csrf.js: helper same-origin talentoHubFetch y registro de vistas.
- database/002_propiedad_empresarial.sql, esta documentacion y pruebas/seguridad.prueba.js, navigation.browser.prueba.js. navigation.prueba.js conserva las comprobaciones previas y ajusta el texto de sesion.

## Pruebas ejecutadas

- node --test pruebas/seguridad.prueba.js: 15 pruebas aprobadas, con mocks y HTTP local contra app.js usando esos mocks; sin importar config/database.js real.
- node pruebas/navigation.prueba.js: 446 comprobaciones y 50 EJS compilados.
- node pruebas/navigation.browser.prueba.js: 147 comprobaciones Chrome sobre HTML local; 4 roles y 320, 375, 768, 1199, 1200, 1440 px, menu, foco/Escape, logout POST, ausencia de desbordamiento e impresion.
- Comprobacion de sintaxis JavaScript, includes y git diff --check.
- No ejecutadas: npm start/dev, migraciones 001/002/JavaScript, semillas, pruebas/empresarial.prueba.js, SQL contra bases reales. Los mocks no validan sintaxis SQL ni constraints de PostgreSQL: queda la integracion con base aislada antes del despliegue.

## Inventario de rutas de escritura

Las rutas se mantienen en los mismos routers. Las excepciones publicas (registro, login, denuncias publicas de vacantes y contadores) tambien requieren CSRF. GET de busqueda, recursos, portada y foros conserva lectura publica; datos privados exigen sesion/rol.

### /auth

Publico, CSRF; login con limite de intentos. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/auth/login`
- POST `/auth/registro`
- POST `/auth/logout`

### /busqueda

Postular: candidato autenticado. Reportar y contador: publicos con CSRF. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/busqueda/empleo/:id/vista`
- POST `/busqueda/empleo/:id/postular`
- POST `/busqueda/empleo/:id/reportar`

### /candidato

Sesion de candidato, operaciones vinculadas al candidato de sesion. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/candidato/perfil/:id`
- POST `/candidato/postulaciones/:idPostulacion/cancelar`
- POST `/candidato/alertas`
- POST `/candidato/alertas/:idAlerta/estado`
- POST `/candidato/alertas/:idAlerta/eliminar`
- POST `/candidato/valoraciones`
- POST `/candidato/valoraciones/:idValoracion/actualizar`
- POST `/candidato/cursos/:idCurso/inscribir`

### /empresarial

Sesion empresarial, contexto por peticion y propiedad SQL. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/empresarial/empresas`
- POST `/empresarial/empresas/:id`
- POST `/empresarial/empresas/:id/estado`
- POST `/empresarial/publicar`
- POST `/empresarial/vacantes/:id`
- POST `/empresarial/vacantes/:id/estado`
- POST `/empresarial/vacantes/:id/eliminar`
- POST `/empresarial/postulaciones/estado`
- POST `/empresarial/postulaciones/:id/estado`
- POST `/empresarial/candidatos/:id/estado`
- POST `/empresarial/candidatos/:id/notas`

### /foros

Sesion y actor validado para participar; contador publico con CSRF. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/foros/:foro/hilos/:hilo/vista`
- POST `/foros/solicitudes`
- POST `/foros/reportes`
- POST `/foros/:foro/hilos`
- POST `/foros/:foro/hilos/:hilo/editar`
- POST `/foros/:foro/hilos/:hilo/eliminar`
- POST `/foros/:foro/hilos/:hilo/comentarios`
- POST `/foros/:foro/hilos/:hilo/comentarios/:comentario/eliminar`

### /administrativo

Sesion con rol admin. Todos los POST pasan por CSRF global y validacion de entrada.

- POST `/administrativo/empresas/:id/decision`
- POST `/administrativo/recursos`
- POST `/administrativo/resources`
- POST `/administrativo/articulos`
- POST `/administrativo/articles`
- POST `/administrativo/recursos/:id/editar`
- POST `/administrativo/recursos/:id/estado`
- POST `/administrativo/recursos/:id/destacado`
- POST `/administrativo/recursos/categorias`
- POST `/administrativo/cursos`
- POST `/administrativo/courses`
- POST `/administrativo/cursos/:id/estado`
- POST `/administrativo/cursos/:id/modulos`
- POST `/administrativo/cursos/:id/modulos/:idModulo/lecciones`
- POST `/administrativo/cursos/:id/inscribir`
- POST `/administrativo/cursos/:id/inscripciones/:idInscripcion/lecciones/:idLeccion`
- POST `/administrativo/examenes`
- POST `/administrativo/exams`
- POST `/administrativo/examenes/:id/preguntas`
- POST `/administrativo/examenes/:id/presentar`
- POST `/administrativo/foros`
- POST `/administrativo/forums`
- POST `/administrativo/foros/:id/editar`
- POST `/administrativo/foros/:id/estado`
- POST `/administrativo/foros/solicitudes/:id/revisar`
- POST `/administrativo/foros/hilos/:id/moderacion`
- POST `/administrativo/foros/comentarios/:id/moderacion`
- POST `/administrativo/moderacion/valoraciones/:id`
- POST `/administrativo/moderacion/reportes/:id`
- POST `/administrativo/notificaciones`
- POST `/administrativo/notifications`
- POST `/administrativo/configuracion`
- POST `/administrativo/settings`


## Inventario exacto de archivos

Nuevos de Fase 2:

- `database/002_propiedad_empresarial.sql`
- `docs/SEGURIDAD_FASE2.md`
- `pruebas/seguridad.prueba.js`
- `pruebas/navigation.browser.prueba.js`
- `src/middleware/csrf.middleware.js`
- `src/middleware/input.middleware.js`
- `src/middleware/login-limit.middleware.js`
- `src/public/js/csrf.js`
- `src/views/auth/logout.ejs`
- `src/views/partials/csrf-head.ejs`

Archivos con diferencias de contenido frente a HEAD al finalizar (incluye cambios pendientes conservados de Fase 1):

- `src/app.js`
- `src/controllers/administrativo.controller.js`
- `src/controllers/auth.controller.js`
- `src/controllers/busqueda.controller.js`
- `src/controllers/empresarial.controller.js`
- `src/controllers/foros.controller.js`
- `src/middleware/auth.middleware.js`
- `src/public/css/administrativo.css`
- `src/public/css/empresarial.css`
- `src/public/css/navigation.css`
- `src/public/css/recursos.css`
- `src/routes/administrativo.routes.js`
- `src/routes/auth.routes.js`
- `src/routes/busqueda.routes.js`
- `src/routes/candidato.routes.js`
- `src/routes/empresarial.routes.js`
- `src/routes/foros.routes.js`
- `src/server.js`
- `src/services/administrativo.service.js`
- `src/services/auth.service.js`
- `src/services/empresarial.service.js`
- `src/services/foros.service.js`
- `src/services/vacantes.service.js`
- `src/views/administrativo/acceso-denegado.ejs`
- `src/views/administrativo/configuracion.ejs`
- `src/views/administrativo/cursos.ejs`
- `src/views/administrativo/empresas.ejs`
- `src/views/administrativo/examenes.ejs`
- `src/views/administrativo/foros.ejs`
- `src/views/administrativo/index.ejs`
- `src/views/administrativo/moderacion.ejs`
- `src/views/administrativo/notificaciones.ejs`
- `src/views/administrativo/partials/topbar-admin.ejs`
- `src/views/administrativo/recursos.ejs`
- `src/views/administrativo/usuarios.ejs`
- `src/views/auth/login.ejs`
- `src/views/auth/registro.ejs`
- `src/views/busqueda/detalle.ejs`
- `src/views/busqueda/index.ejs`
- `src/views/candidato/index.ejs`
- `src/views/empresarial/candidato.ejs`
- `src/views/empresarial/cv.ejs`
- `src/views/empresarial/empresas.ejs`
- `src/views/empresarial/index.ejs`
- `src/views/empresarial/partials/menu.ejs`
- `src/views/empresarial/postulaciones.ejs`
- `src/views/empresarial/publicar.ejs`
- `src/views/empresarial/vacantes.ejs`
- `src/views/foros/crear-hilo.ejs`
- `src/views/foros/detalle-hilo.ejs`
- `src/views/foros/hilos.ejs`
- `src/views/foros/ingresar.ejs`
- `src/views/foros/partials/header-foros.ejs`
- `src/views/foros/solicitar.ejs`
- `src/views/modulo4/inicio.ejs`
- `src/views/partials/head.ejs`
- `src/views/partials/navigation.ejs`

No se listan como cambios funcionales los archivos que Git marca por metadatos/finales de linea pero cuyo diff esta vacio. Los archivos .env - copia.example y pruebas/prueba-codex.txt ya existian y no se tocaron.
