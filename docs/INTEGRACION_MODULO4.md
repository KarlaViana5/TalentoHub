# TalentoHub · Foros y Administración

## Qué se adaptó

La base del cambio es el commit `e89965b` de la copia de TalentoHub. El ZIP original del Integrante 4 ejecuta una aplicación Express por separado con SQLite, rutas en inglés y vistas generadas desde JavaScript. TalentoHub ya monta `/foros` y `/administrativo`, usa EJS y consume PostgreSQL mediante `pg`. Las vistas y consultas del módulo se adaptaron a ese servidor y a sus convenciones de rutas.

| Área | Integración |
| --- | --- |
| Foros | Categorías, hilos, comentarios y respuestas. Inicio de sesión de candidato, empresa o administrador. Reportes de hilos y comentarios. |
| Administración | Gestión de cuentas de comunidad, edición y verificación de empresas, gestión de vacantes compartidas, moderación de hilos, comentarios, recursos y valoraciones, resolución de reportes y auditoría. |
| Estadísticas | Indicadores de la base compartida, vacantes por estado, actividad de hilos de siete días y exportación CSV de indicadores y actividad. |
| Configuración | Pausa global para publicaciones de foros y avisos en la portada, con audiencia general, candidatos o empresas. |
| Portal público | Inicio, búsqueda, detalle de empleo y recursos aplican la moderación. Una valoración ocultada sigue disponible para su autor en su historial, con la etiqueta de moderación. |

### Datos y dependencias

| Datos del ZIP individual | Destino en TalentoHub |
| --- | --- |
| `users`, `candidate_profiles` | `modulo4.usuarios` administra las cuentas de comunidad y se vincula por ID a `public.candidatos` o `public.empresas`. |
| `companies`, `vacancies`, `applications` | Se consultan directamente `public.empresas`, `public.vacantes` y `public.postulaciones`. La verificación empresarial y la visibilidad administrativa de vacantes se guardan en `modulo4`. |
| `resources`, `reviews` | Se usan `public.recursos` y `public.valoraciones`, con indicadores de moderación en `modulo4`. |
| `forums`, `forum_threads`, `forum_comments` | `modulo4.foros`, `modulo4.hilos` y `modulo4.comentarios`. |
| Reportes, avisos, configuración y auditoría | Tablas del esquema `modulo4`. |

La migración crea un solo esquema adicional y sus referencias. Busca identificadores `id_candidato`, `id_empresa`, `id_vacante`, `id_recurso` e `id_valoracion` en el esquema `public` del equipo. La baja administrativa de una vacante conserva su fila y sus postulaciones. El cierre escribe `cerrada` en la tabla compartida y la inactivación empresarial escribe `inactiva` en la tabla compartida.

El alcance es Foros y Administración. La importación de registros SQLite, el LMS, los artículos independientes, la edición editorial de recursos y la unificación de inicio de sesión de Candidato y Empresarial quedan para otra fase. Los módulos del equipo traen perfiles simulados o IDs por defecto. La suspensión de una cuenta del módulo controla su acceso a la comunidad. Los flujos preexistentes de Candidato y Empresarial siguen dependiendo de sus propios controladores, incluida la edición de estados desde el panel empresarial. Las categorías nuevas se crean desde Administración.

## Probar con la base del equipo

1. Desde la raíz del proyecto, ejecuta `npm ci`. Pon tu configuración en `.env` a partir de `.env.example`. Conserva las variables de Supabase que usa el equipo. Usa `DB_SSL=false` para un PostgreSQL local sin TLS.
2. En una base de desarrollo con el esquema de TalentoHub, abre el SQL Editor de Supabase y ejecuta el archivo `database/001_foros_administracion.sql` completo. También puede ejecutarse con `psql`. La tabla compartida de cada módulo debe existir antes de aplicar el SQL. Aplica esta migración antes de arrancar el código nuevo, porque las consultas públicas ya referencian las tablas de moderación. Si el servidor se conecta con un rol distinto del propietario de la migración, concede a ese rol de servidor acceso de uso al esquema y permisos sobre sus tablas y secuencias.
3. Crea la primera cuenta administrativa desde PowerShell, en la raíz del proyecto. Cambia el correo de ejemplo por el que vas a usar. La contraseña se lee de forma oculta y se elimina del entorno después del comando.

   ```powershell
   $env:MODULO4_CLAVE = [pscredential]::new('cuenta', (Read-Host 'Contraseña de 12 caracteres o más' -AsSecureString)).GetNetworkCredential().Password
   try {
       node scripts/modulo4-usuario.js admin admin@ejemplo.test "Administrador TalentoHub"
   } finally {
       Remove-Item Env:MODULO4_CLAVE -ErrorAction SilentlyContinue
   }
   ```

   Para crear una cuenta participante, cambia el rol a `candidato` o `empresa` y pasa el ID real como último argumento. Ejemplo de comando dentro del mismo bloque con su propia contraseña.

   ```powershell
   node scripts/modulo4-usuario.js candidato candidato@ejemplo.test "Nombre del candidato" 1
   ```

4. Ejecuta `npm start`. Entra a http://localhost:3000/foros/ingresar y crea una categoría desde http://localhost:3000/administrativo/foros. Puedes publicar desde esa categoría con una cuenta de comunidad. Para comprobar la moderación, oculta un hilo o una vacante de prueba y consulta su página desde otra sesión.
5. Para la revisión compartida, coordina con el equipo cuándo correr la migración en la base que usan sus ramas.

La migración se ejecutó dos veces sobre PostgreSQL 18.6 local con un esquema de prueba derivado del código del equipo. Pasaron 99 comprobaciones HTTP, incluidas las rutas públicas existentes, y las 53 verificaciones del script empresarial del repositorio. La base de Supabase incluida en la configuración del equipo queda pendiente de validación.

## Subir una rama a GitHub

Usa el archivo `0001-foros-y-administracion.patch` incluido en el paquete. Desde una copia limpia del repositorio de GitHub ejecuta lo siguiente en PowerShell. Ajusta la ruta del parche a donde extrajiste el paquete.

```powershell
git fetch origin
git switch -c modulo-foros-administracion origin/main
git am --3way "C:\ruta\al\paquete\0001-foros-y-administracion.patch"
git status
git log -1 --oneline
git push -u origin modulo-foros-administracion
```

Abre un pull request con `main` como base. Si `origin/main` avanzó y Git marca un conflicto, resuélvelo sobre esa rama antes de subirla. El directorio `TalentoHub` dentro del paquete sirve para inspeccionar o probar el código completo.
