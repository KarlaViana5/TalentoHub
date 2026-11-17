# TalentoHub

Portal universitario colaborativo de oportunidades laborales, perfiles, empresas, recursos educativos, comunidad y administración.

## Tecnologías y requisitos

Node.js, Express 5, EJS y PostgreSQL mediante pg; CSS y JavaScript propios. dotenv carga configuración y nodemon se usa en desarrollo. Entorno verificado: Node.js 22.19.0. La prueba opcional de navegador necesita Chrome/Edge y WebSocket global de Node.

## Estructura

- `src/app.js`: configura Express y rutas; no abre el puerto.
- `src/server.js`: entrada del proceso y verificación del arranque.
- `src/config/`: conexión y preparación heredada del esquema.
- `src/routes/`, `controllers/`, `services/`: HTTP, coordinación/vistas y consultas/reglas.
- `src/middleware/`: sesiones, CSRF, validación, límites y errores.
- `src/utils/`: errores HTTP, registro seguro, paginación y agrupación.
- `src/views/` y `src/public/`: EJS, navbar compartido, CSS y JavaScript.
- `database/`, `scripts/`, `pruebas/`, `docs/`: SQL preparado, herramientas, pruebas y documentación.

## Instalación

1. Ejecuta `npm ci` desde la raíz para instalar el lockfile existente.
2. Configura las variables en tu entorno privado. Si usas .env, no lo subas al repositorio ni compartas valores. Revisa cualquier plantilla antes de copiarla.
3. Usa una base de desarrollo preparada con las tablas existentes de TalentoHub. El repositorio NO contiene un esquema inicial completo para partir de una base vacía.
4. Revisa los pendientes de migración antes de iniciar.

| Variable | Uso |
| --- | --- |
| DB_HOST | Servidor PostgreSQL; requerida. |
| DB_NAME | Base de datos; requerida. |
| DB_USER | Rol de conexión; requerida. |
| DB_PASSWORD | Secreto del rol; requerida, nunca registrar. |
| DB_PORT | Puerto opcional; predeterminado 5432. |
| DB_SSL | TLS: sin definir se desactiva para hosts locales y activa para otros. |
| PORT | Puerto HTTP opcional; predeterminado 3000. |
| NODE_ENV | En producción activa cookies Secure; requiere HTTPS. |
| CSRF_SIGNING_KEY | Secreto opcional de al menos 32 bytes; compartir entre procesos. |

No se muestran valores de conexión ni credenciales. TLS mantiene `rejectUnauthorized: false`: revisar la validación del certificado con el operador antes de desplegar. Esa configuración no se cambió silenciosamente.

## Ejecución

```powershell
npm start
npm run dev
```

El arranque comprueba conectividad y tablas de autenticación mediante SELECT. Si falla, cierra el pool y no abre el puerto. No ejecuta migraciones, semillas ni creación de usuarios. Importar server.js no inicia la escucha; el flujo normal sigue siendo npm start.

## Módulos

| Entrada | Funciones |
| --- | --- |
| / | Portada con vacantes y recursos. |
| /busqueda | Filtros, detalle y postulaciones. |
| /recursos | Biblioteca pública y materiales. |
| /auth | Registro, login y logout por POST con CSRF. |
| /candidato | Perfil, historial, alertas, valoraciones e inscripción a cursos. |
| /empresarial | Empresas propias, vacantes, postulaciones, notas y exportaciones. |
| /foros | Lectura pública y participación autenticada. |
| /administrativo | Aprobaciones, contenidos, formación y moderación; exige administrador. |

Las rutas y permisos de las fases 1 y 2 se conservan. El contexto empresarial usa AsyncLocalStorage por petición: las llamadas internas necesitan `conContextoEmpresa`. No guardar permisos ni identidades en una caché global.

Los formularios POST envían `_csrf`; JavaScript puede enviar `X-CSRF-Token` o usar `window.talentoHubFetch`. GET /auth/logout muestra confirmación; no invalida sesiones. Los contadores usan POST separado. Tras reiniciar sin clave CSRF persistente, recargar los formularios abiertos.

## Pruebas seguras

```powershell
npm test
npm run test:browser
npm run db:plan
```

- `npm test`: seguridad y arquitectura con mocks, HTTP local sin PostgreSQL real, compilación EJS y comprobaciones del navbar.
- `test:browser`: HTML local y usuarios ficticios, sin cargar el servidor real. Para otra ubicación: `npm run test:browser -- "RUTA_AL_NAVEGADOR"`.
- `db:plan`: inventario offline. No consulta la base ni comprueba si una migración está aplicada.
- NO ejecutar `pruebas/empresarial.prueba.js` contra datos reales: usa la conexión configurada y escribe aunque termine con rollback. Es legado y requiere adaptar su contexto para una base aislada.

Los mocks no verifican sintaxis SQL, constraints, planes de ejecución ni permisos reales de PostgreSQL. Se necesita integración con base aislada antes del despliegue.

## Migraciones separadas del arranque

| Archivo | Clasificación |
| --- | --- |
| database/001_foros_administracion.sql | Integración anterior del esquema modulo4; no sustituye la autenticación pública actual. |
| src/config/migracion-modulo4.js | Legado con DDL, semillas y UPDATE de datos existentes. No se importa en el arranque. Su CLI antigua se conserva; no ejecutarla sobre datos reales sin revisión y autorización. |
| database/002_propiedad_empresarial.sql | Aditiva, preparada en Fase 2. Depende de public.empresas y public.usuarios_cuenta; copia solo relaciones conocidas. No se ejecutó en estas fases. |

Si falta 002 se conserva `usuarios_cuenta.empresa_id`. Crear empresas adicionales NO está operativo hasta aplicar 002 y conceder permisos al rol backend. No se asignan automáticamente propietarios a empresas históricas sin un vínculo demostrado.

Comando preparado para una base de desarrollo aislada, tras revisar SQL y respaldos. NO ejecutado en este trabajo:

```powershell
# Configura antes una conexion a una base aislada, nunca datos reales.
$env:NODE_ENV = 'test'
npm run db:apply:002 -- --confirmar=002
```

Rechaza argumentos incompletos, entornos distintos de development/test y falta de tablas prerrequisito. El SQL contiene BEGIN/COMMIT; ante fallos se intenta rollback y se liberan recursos. No hay ledger de migraciones. NODE_ENV por sí solo no demuestra que una base sea de pruebas: el operador debe verificar el destino.

## Pendientes

- Probar 002 y SQL en una base aislada; comprobar propietarios y permisos antes de habilitar empresas adicionales.
- Resolver el esquema inicial completo para instalaciones desde cero.
- Revisar por separado auditoría administrativa, credenciales históricas, TLS y proxies. No se cambiaron contraseñas ni datos existentes.
- El límite de login reside en memoria por proceso; varias instancias necesitan una estrategia compartida. No se confía automáticamente en cabeceras de proxy.
- Se paralelizan lecturas independientes y se agrupan resultados en memoria, sin afirmar mejoras medidas contra PostgreSQL real.
- El legado se conserva; no se eliminaron archivos.

Consulta [ARQUITECTURA_FASE3.md](docs/ARQUITECTURA_FASE3.md) para decisiones y duplicados y [SEGURIDAD_FASE2.md](docs/SEGURIDAD_FASE2.md) para la fase anterior. INTEGRACION_MODULO4.md es histórico y no representa todo el flujo actual.
