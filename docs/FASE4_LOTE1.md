# Fase 4 - Lote 1: sistema visual, Inicio, Busqueda y Recursos

## Alcance y auditoria inicial

- Rama revisada: mejora/navbar-unificado. Se conservaron todos los cambios pendientes de las fases anteriores; no hubo conflictos de fusion.
- Se revisaron las 51 vistas EJS y 13 CSS mediante inventario de estructura, dependencias, formularios y reglas; se inspeccionaron las cinco paginas del lote renderizadas en Chrome antes de modificar.
- Las 27 pruebas de seguridad/arquitectura ya pasaban al iniciar. La migracion empresarial 002 sigue preparada y fuera de este trabajo; no se conecto PostgreSQL para averiguar su estado.
- Se detectaron paletas y variables :root diferentes por modulo, reglas globales body/header y ajustes responsive superpuestos. No se eliminaron ni fusionaron archivos de otros integrantes.
- Este lote solo activa el sistema nuevo en Inicio, resultados/detalle de empleo y listado/detalle de recursos. Candidato, Empresarial, Foros, Administracion y Autenticacion quedan para los lotes siguientes.

## Archivos modificados

- src/public/css/design-system.css: tokens nuevos --th-ui-*, componentes optativos y estilos responsive acotados a body.th-public. Todo el contenido previo de la hoja se conserva literalmente, comprobado con una prueba de integridad.
- src/views/general/inicio.ejs: clase optativa, enlace de salto, destino principal y decoracion SVG no informativa. Fallback de logo empresarial mediante inicial.
- src/views/busqueda/index.ejs: clase optativa, enlace de salto y etiquetas accesibles para los filtros salariales.
- src/views/busqueda/detalle.ejs: clase optativa, ruta de navegacion semantica, mensajes status/alert y etiquetas de los campos de reporte.
- src/views/recursos/index.ejs: clase optativa, enlace de salto y etiqueta accesible del buscador.
- src/views/recursos/detalle.ejs: clase optativa, ruta semantica y eliminacion de espacios de plantilla alrededor del texto, conservando el contenido y sus saltos de linea.

## Archivos creados

- pruebas/lote1.prueba.js: cuatro comprobaciones automaticas de aislamiento del CSS, contratos de formularios, exclusividad del lote e includes/EJS.
- pruebas/lote1.browser.prueba.js: renderiza EJS reales con datos ficticios; usa Chrome sin interfaz, sin app.js, .env ni pg.
- docs/capturas-fase4-lote1/antes y despues: 20 PNG en total y resultados JSON de cada etapa.
- Este informe. No se modificaron rutas, servicios, controladores, autenticacion, CSRF, permisos, dependencias ni scripts npm.

## Sistema y componentes reutilizables

| Elemento | Implementacion |
| --- | --- |
| Identidad | Azul marino #14213d, azul #2954d8 y violeta #7048c6; blanco y fondos suaves. |
| Tipografia | Inter con fallback de sistema; escala fluida, jerarquia de titulos y anchos de lectura. |
| Espaciado | Tokens --th-ui-space-* y ancho comun de 1184px; gutters de 24/16px. |
| Superficies | Radios 10/18px, bordes claros, sombras suaves y hover moderado. |
| Componentes optativos | th-ui-card, th-ui-button, th-ui-badge, th-ui-alert, th-ui-table-wrap y th-ui-skip. La tabla queda disponible; no se redisenaron tablas de otros lotes. |
| Formularios | Campos y botones de al menos 44px; focus visible y etiquetas accesibles. |
| Listados | Tarjetas de empleo/materiales, etiquetas, contadores, filtros y paginacion coherentes. |
| Lectura | Detalles, indice, relacionados, metadata con contraste y texto sin espacios excesivos de plantilla. |
| Responsive | Grids adaptativos, columnas de detalle apiladas, buscadores verticales y acciones utilizables en movil. |
| Movimiento | Se respeta prefers-reduced-motion; sin animaciones obligatorias. |

Para futuros lotes se debe habilitar la clase optativa de manera deliberada y probar sus pantallas. No agregarla globalmente a body ni activar todos los modulos a la vez. Las reglas viejas y variables existentes permanecen para compatibilidad.
El navbar unificado no se redibujo: sus archivos navigation.ejs/navigation.css/navigation.js y reglas de rol se conservan. No se agregaron navbars ni se cambiaron sus rutas.

## Pruebas realmente ejecutadas

- npm test: 27 pruebas previas aprobadas y 456 comprobaciones de navegacion; compilacion de 51 EJS, imports e includes.
- node --test pruebas/lote1.prueba.js: 4 pruebas aprobadas. Verifica tambien que los modulos de lotes posteriores no habiliten th-public.
- node pruebas/lote1.browser.prueba.js --etapa=antes: 25 casos de las cinco paginas, 10 capturas antes.
- node pruebas/lote1.browser.prueba.js --etapa=despues: 45 casos, incluidas cuatro variantes vacias, en 320, 390, 768, 1024 y 1440 px. Sin overflow horizontal, controles fuera de pantalla ni campos sin etiqueta en las muestras.
- Comparacion de nombres, acciones, metodos y presencia de CSRF de los formularios antes/despues; envio de postulacion y reporte simulado con preventDefault, sin peticiones reales.
- Menu movil, Escape, foco, enlace de salto, controles de al menos 44px y preferencia de movimiento reducido comprobados en Chrome.
- 125 muestras de contraste sobre colores solidos calculadas: minimo observado 4.76:1. No equivale a una certificacion WCAG ni a evaluar todo texto, gradiente, imagen o estado.
- git diff --check sin errores. No se ejecutaron migraciones, semillas ni el servidor de TalentoHub.

## Capturas antes/despues

Todas usan los mismos datos ficticios. Las imagenes decorativas de los materiales pertenecen a las fixtures de prueba, no se insertaron en la base ni en el contenido real. Red externa bloqueada: fuentes e iconos CDN pueden no aparecer; se usa fallback local. No son capturas de datos reales.

| Pantalla | Antes escritorio | Despues escritorio | Antes movil | Despues movil |
| --- | --- | --- | --- | --- |
| Inicio | [1440 px](capturas-fase4-lote1/antes/inicio-1440.png) | [1440 px](capturas-fase4-lote1/despues/inicio-1440.png) | [390 px](capturas-fase4-lote1/antes/inicio-390.png) | [390 px](capturas-fase4-lote1/despues/inicio-390.png) |
| Busqueda | [1440 px](capturas-fase4-lote1/antes/busqueda-1440.png) | [1440 px](capturas-fase4-lote1/despues/busqueda-1440.png) | [390 px](capturas-fase4-lote1/antes/busqueda-390.png) | [390 px](capturas-fase4-lote1/despues/busqueda-390.png) |
| Detalle de empleo | [1440 px](capturas-fase4-lote1/antes/empleo-1440.png) | [1440 px](capturas-fase4-lote1/despues/empleo-1440.png) | [390 px](capturas-fase4-lote1/antes/empleo-390.png) | [390 px](capturas-fase4-lote1/despues/empleo-390.png) |
| Biblioteca | [1440 px](capturas-fase4-lote1/antes/recursos-1440.png) | [1440 px](capturas-fase4-lote1/despues/recursos-1440.png) | [390 px](capturas-fase4-lote1/antes/recursos-390.png) | [390 px](capturas-fase4-lote1/despues/recursos-390.png) |
| Articulo | [1440 px](capturas-fase4-lote1/antes/articulo-1440.png) | [1440 px](capturas-fase4-lote1/despues/articulo-1440.png) | [390 px](capturas-fase4-lote1/antes/articulo-390.png) | [390 px](capturas-fase4-lote1/despues/articulo-390.png) |

Los JSON registran las dimensiones, formularios, campos y resultados de cada caso. Para repetir la etapa despues es necesario conservar resultados.json de antes, usado como contrato comparativo. No sobrescribir las capturas antes con el codigo redisenado.

## Problemas encontrados y limites

- Corregidos: campos sin etiquetas accesibles en filtros/reportes/buscador; metadatos de articulo demasiado claros al adoptar fondo claro; espacio de plantilla excesivo con white-space: pre-line.
- El texto preexistente del boton movil del navbar puede mostrar un caracter de codificacion incorrecto en algunas fuentes del proyecto. No se cambio ese partial en este lote; revisar con los ajustes finales autorizados.
- Sigue pendiente la validacion de contenido e imagenes reales, y navegadores distintos de Chrome. No se envio ninguna postulacion o reporte real.
- Compartir mediante funciones del navegador y abrir materiales externos se conserva, pero no se verificaron destinos externos en las pruebas offline.
- El estado de 002 y otras deudas anteriores no se dan por resueltos. El lote visual no requiere migracion nueva.

## Siguiente lote

Lote 2: Candidato y Empresarial (dashboard, perfil, cursos, publicacion, indicadores y tablas), conservando el contexto empresarial y CSRF. No implementado: requiere autorizacion expresa del usuario. Foros/Administracion y Autenticacion tambien permanecen pendientes en sus lotes correspondientes.
