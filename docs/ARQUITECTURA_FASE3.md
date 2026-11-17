# Fase 3: arquitectura, auditoría y decisiones

## Estado encontrado

- Rama: `mejora/navbar-unificado`. Había cambios sin confirmar de las fases 1 y 2 y archivos nuevos. Se conservaron; no se hicieron commit/push.
- Fase 1: navbar compartido, menú móvil, roles y estilos presentes. Sus archivos navigation.ejs, navigation.css y navigation.js no se modificaron en Fase 3.
- Fase 2: identidad desde sesión, contexto empresarial por petición, CSRF y limitación de login implementados y cubiertos por las pruebas conservadas. Esto no equivale a una auditoría exhaustiva ni a validación SQL real.
- `database/002_propiedad_empresarial.sql` está preparado. No se ejecutó ni modificó en Fase 3, y no se consultó PostgreSQL para determinar si alguien lo aplicó externamente.
- No se detectaron conflictos de fusión. Se guardó un inventario de integridad en memoria al comenzar, excluyendo .env*, node_modules y .git, para distinguir cambios de esta fase. No se leyeron secretos.

## Flujo y responsabilidades

`server.js -> arranque.service.js -> verificaciones SELECT -> app.listen`. Las dependencias del servicio de arranque son inyectables; las pruebas no cargan PostgreSQL ni .env.
`app.js -> identificador de peticion -> parsers -> CSRF -> validacion -> sesion -> router -> controlador -> servicio -> pg -> EJS`.
Los errores inesperados llegan a `error.middleware.js`. Express 5 propaga rechazos de funciones async; no se agregaron envoltorios redundantes. Los errores operativos de formularios conservan sus renderizados/redirects y códigos existentes. Referencia: https://expressjs.com/en/guide/error-handling/

## Decisiones aplicadas

1. **Errores centralizados.** Vista existente errors/404 reutilizada; nueva errors/http para otros estados. Diferencia 400/401/403/404/500 y contempla 409/413/422/429/503. Con Accept: application/json devuelve una estructura de error; HTML mantiene navbar y parciales. No expone trazas, SQL ni mensajes de errores internos. Si falla EJS, hay fallback de texto. Si headersSent ya es true, delega según el contrato de Express.
2. **Diagnósticos seguros.** Registro JSON con evento, hora UTC, ámbito, estado, identificador generado por servidor, método y plantilla de ruta/código técnico cuando corresponde. No registra cuerpo, cabeceras, cookies, URL, querystring, mensaje o stack. Se evita repetir el mismo objeto Error entre controlador y manejador.
3. **Validación de rutas compartida.** Se extrajo el mismo conjunto de parámetros y la misma función de validación de seis routers; no se cambian rutas, permisos ni funciones de controlador.
4. **Paginación común.** Búsqueda, recursos y foros usan enteros positivos y offsets seguros. Se conservan valores predeterminados, filtros, ordenamientos y límites normales. Los valores inválidos, infinitos o fraccionarios se normalizan antes de enviarse a PostgreSQL.
5. **Lecturas independientes concurrentes.** Categorías y búsqueda de recursos; datos del dashboard empresarial; candidato/vacante/notas de una postulación ya autorizada. Se mantienen consultas parametrizadas y restricciones por propietario. No se redujo la autorización ni se creó una caché de permisos.
6. **Agrupación lineal.** Lecciones por módulo y opciones por pregunta se agrupan con Map en lugar de filtrar repetidamente. Preserva orden y referencias para los identificadores devueltos por PostgreSQL. Evita recorrer hijos una vez por cada padre.
7. **Carga compartida.** head.ejs cargaba navigation.css dos veces. Se retiró solo la primera copia; la carga efectiva final sigue después de design-system.css. No se modificaron CSS, JS ni markup del navbar.
8. **Pruebas predeterminadas seguras.** npm test usa exclusivamente los archivos de seguridad/arquitectura con mocks y la prueba de navbar. Se extrajo el cargador aislado compartido. La prueba empresarial antigua no se incluye.
9. **Dependencias y esquema.** Sin paquetes nuevos ni cambios de versiones o lockfile. Sin tablas, columnas, índices ni datos modificados. No se eliminaron archivos.

## Clasificación del código revisado

| Hallazgo | Clase | Tratamiento |
| --- | --- | --- |
| middleware/auth, csrf, input, login-limit | Activo | Seguridad conservada; validación repetida extraída. |
| middleware/error y utils | Activo, nuevo | Responsabilidades compartidas comprobadas con mocks/HTTP. |
| src/middlewares/ | Pendiente de verificar / vacío | No hay archivos en el inventario. Se conserva la carpeta. |
| middleware/modulo4-auth.js y services/modulo4-db.service.js | Legado | No montados en el router actual; utilizados por el script antiguo de cuentas. No borrar ni fusionar sus contratos. |
| controllers actuales | Activo | Se centraliza propagación de errores inesperados y registro seguro; se conservan los flujos de negocio. |
| Configuración de validarParametros en seis routers | Duplicado activo | Extraído a registrarValidacionParametros con el mismo conjunto de IDs. |
| idValido, texto y CSV en distintos módulos | Duplicado aparente, pendiente | No se fusionaron: hay diferencias de coercion, rangos, valores nulos y etiquetas. Su equivalencia no está demostrada. |
| services/administrativo y foros: usarConexion con variable db | Activo con deuda técnica | Conservar. No convertir en contexto global de identidad ni cambiar contratos de pruebas antiguas sin revisión. |
| empresarial AsyncLocalStorage | Activo | Contexto por petición y consultas de propiedad conservados. |
| listarActoresDisponibles | Activo | Aunque ya no selecciona identidad en foros, administración lo usa en cursos/exámenes. No eliminar. |
| autenticarDemoPorUsuarioId | Compatibilidad / legado | Sigue fallando cerrado; no hay login por ID. |
| listarCuentasDemo | Legado exportado, pendiente | Sin consumidor activo detectado en rutas. No eliminado. |
| obtenerCandidatoPorDefecto | Activo como fallback | Referenciado por el controlador; no se elimina por asumirlo inaccesible. |
| views/modulo4/inicio y fin | Legado | Sin render/include activo detectado desde los controladores actuales. Conservados. |
| administrativo/lista y panel | Legado / pendiente de verificar | No aparecen como destino de render activo. Mantener por posibles consumidores fuera del repositorio. |
| foros/ingresar y reportar | Legado / pendiente de verificar | No hay rutas específicas actuales que rendericen esas plantillas; no eliminar ni reasignar sus acciones. |
| config/config.js y README inicial | Legado vacío | config.js conservado; README completado. |
| migracion-modulo4.js | Legado con semillas | No se ejecuta al arrancar. CLI anterior preservada, advertida y fuera del nuevo comando de aplicación 002. |
| database/001 | Legado de otro esquema | No equivale a la migración JS; no ejecutar como sustituto del esquema actual. |
| database/002 | Pendiente de verificar/aplicar externamente | Dependencias documentadas; no ejecutado durante esta fase. |

La ausencia de referencias estáticas no prueba que un archivo pueda eliminarse: pueden existir consumidores externos. No se removió ninguno.

## Arranque y migraciones

- probarConexion mantiene su llamada sin argumentos y devuelve true/false. Ya no imprime datos del servidor ni errores completos. Si devuelve false, arranque no continúa.
- asegurarEsquemaAuth sigue siendo SELECT de existencia. Ni arranque ni middleware ejecutan DDL/semillas.
- arranque.service verifica conexión y esquema antes de escuchar; cierra el pool en errores de verificación o escucha.
- scripts/migraciones.js plan es offline; muestra 001, preparación JS con semillas y 002. No hay historial/ledger ni detección de aplicación.
- El comando aplicar solo admite 002 con confirmación exacta y NODE_ENV development/test, carga la conexión después de validar y verifica public.usuarios_cuenta/public.empresas antes de enviar el SQL. El operador debe comprobar que el destino sea aislado: NODE_ENV no prueba la identidad de la base.
- No se ejecutó el comando de aplicación, la migración JS ni semillas. aplicar002 solo se probó con un cliente mock que no conecta a una base.
- Crear empresas adicionales sigue condicionado a 002 y a permisos SELECT/INSERT sobre empresas_propietarios. El vínculo original de la cuenta sigue funcionando sin esa tabla.
- No hay un script inicial completo para una base vacía; resolverlo requiere un trabajo de esquema separado, no una semilla improvisada.

## Rendimiento: límites de las conclusiones

Las optimizaciones no cambian el SQL de negocio ni crean índices. La concurrencia reduce esperas seriales cuando el pool dispone de capacidad; el agrupado evita filtros anidados. No se midieron tiempos, EXPLAIN ni cargas de una base real y no se prometen porcentajes de mejora.
No se fusionaron conteos con consultas paginadas: podría cambiar el resultado de páginas vacías. Tampoco se aplicó cache a tablas de permisos ni a contenidos editables, para evitar resultados obsoletos. Sigue pendiente revisar las subconsultas correlacionadas de foros y los indicadores con datos y planes aislados.

## Pruebas ejecutadas y pendientes

- npm test: 27 pruebas (15 de seguridad y 12 de arquitectura) aprobadas, más 456 comprobaciones de navegación y 51 EJS compilados.
- npm run test:browser: 147 comprobaciones Chrome aprobadas; 4 roles y 6 anchos de 320 a 1440 px; foco/Escape, logout POST e impresión.
- npm run db:plan: ejecutado, exclusivamente inventario offline.
- Sintaxis JS/EJS, imports, includes, referencias literales CSS/JS, ausencia de ciclos en imports relativos y git diff --check comprobados.
- Arranque probado con dependencias falsas, sin abrir el servidor real. HTTP de pruebas usa el pool mock que bloquea pg/dotenv y la carga de server/migraciones heredadas.
- Los casos de errores fuerzan rechazos ficticios y emiten registros técnicos sanitizados: esos registros no significan fallos de la suite.
- No ejecutados: npm start/dev, DDL/semillas, scripts antiguos con escrituras ni consultas a PostgreSQL real. Tampoco se verificaron constraints, datos, permisos reales, plan SQL o estado aplicado de 002.
- No se auditó completamente la atribución histórica de auditoría administrativa, TLS, proxies o cuentas con contraseñas predeterminadas anteriores. No se cambiaron datos reales.


## Archivos de esta fase

Inventario respecto al contenido al iniciar Fase 3, no respecto a HEAD (que ya tenia cambios de Fase 1/2).

Modificados:

- `package.json`
- `pruebas/seguridad.prueba.js`
- `README.md`
- `src/app.js`
- `src/config/database.js`
- `src/controllers/administrativo.controller.js`
- `src/controllers/auth.controller.js`
- `src/controllers/busqueda.controller.js`
- `src/controllers/candidato.controller.js`
- `src/controllers/foros.controller.js`
- `src/controllers/general.controller.js`
- `src/controllers/recursos.controller.js`
- `src/middleware/input.middleware.js`
- `src/routes/administrativo.routes.js`
- `src/routes/auth.routes.js`
- `src/routes/busqueda.routes.js`
- `src/routes/candidato.routes.js`
- `src/routes/empresarial.routes.js`
- `src/routes/foros.routes.js`
- `src/server.js`
- `src/services/administrativo.service.js`
- `src/services/empresarial.service.js`
- `src/services/foros.service.js`
- `src/services/recursos.service.js`
- `src/services/vacantes.service.js`
- `src/views/partials/head.ejs`

Creados:

- `docs/ARQUITECTURA_FASE3.md`
- `pruebas/arquitectura.prueba.js`
- `pruebas/helpers/cargar-aislado.js`
- `scripts/migraciones.js`
- `src/middleware/error.middleware.js`
- `src/services/arranque.service.js`
- `src/utils/colecciones.js`
- `src/utils/http-error.js`
- `src/utils/logger.js`
- `src/utils/paginacion.js`
- `src/views/errors/http.ejs`

Eliminados: ninguno. Se comprobaron sin cambios los archivos del navbar navigation.ejs/navigation.css/navigation.js y el SQL 002 preparado.

## Recomendaciones posteriores

1. Verificar esquema y SQL en base aislada y aplicar 002 solo tras revisión operativa. No adjudicar empresas históricas por suposición.
2. Resolver la configuración TLS, proxies y despliegue de varias instancias (clave CSRF compartida y limitador de login compartido).
3. Revisar los exports legados y consumidores antes de proponer su eliminación. Crear una fase de esquema inicial y migraciones versionadas sin semillas implícitas.
4. Medir consultas y revisar paginación sobre datos representativos aislados antes de cambiar SQL o índices.
