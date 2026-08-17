# Changelog de fixes - Bot-RialWay

Periodo cubierto: 10/08/2026 a 11/08/2026.

Este documento registra solo los fixes aplicados y el motivo tecnico de cada uno. No incluye detalle de git pull, commits remotos ni movimientos operativos de Git.

## 1. Aislamiento OpenAI por service_id

Problema:
Los bots podian leer credenciales, prompts, asistentes, tools o configuracion del servicio base en vez del servicio real del cliente.

Causa:
Varias llamadas a OpenAI y a `HistoryHandler.getConfig/getSetting` estaban usando solo `projectId` o directamente los valores globales del entorno.

Arreglo:
Se paso `serviceId` en el flujo principal de OpenAI, `AiManager`, `openaiHelper`, `AssistantResponseProcessor`, sync de tools, transcripcion de audio y rutas de backoffice relacionadas con OpenAI.

Que ocasionaba sin el arreglo:
Un cliente podia responder con el asistente equivocado, prompt equivocado, API key equivocada o tools de otro servicio. En produccion esto podia romper bots multi-cliente y generar respuestas desfasadas.

## 2. Historial de mensajes filtrado por service_id

Problema:
La IA podia quedarse sin contexto o leer un historial incorrecto.

Causa:
`HistoryHandler.getMessages` no contemplaba correctamente el `serviceId` del chat que estaba siendo procesado.

Arreglo:
`getMessages` acepta `serviceId` y filtra por `service_id` cuando corresponde. `AiManager` le pasa el `dynamicServiceId`.

Que ocasionaba sin el arreglo:
El bot recibia contexto vacio o contexto de otro servicio. Esto generaba respuestas genericas, incoherentes o sin memoria conversacional.

## 3. Sincronizacion de tools por servicio

Problema:
La sincronizacion de tools podia actualizar el asistente usando definiciones de otro cliente o del servicio base.

Causa:
`syncAssistantTools` resolvia OpenAI, `OPENAI_TOOLS_DEFINITION`, `DB_TABLES` y prompts sin un scope firme de `projectId + serviceId`.

Arreglo:
`syncAssistantTools` ahora resuelve OpenAI, tools, tablas y prompts usando `projectId + serviceId`.

Que ocasionaba sin el arreglo:
Las herramientas del asistente podian quedar vacias, equivocadas o mezcladas entre clientes. Eso afectaba funciones custom como consultas a bases de datos, reservas o integraciones por cliente.

## 4. Cache de modulos por projectId y serviceId

Problema:
El modulo activo de cliente podia quedar cacheado globalmente.

Causa:
`toolRouter` guardaba un unico modulo activo, basado en `CLIENT_SLUG`, sin separar servicios.

Arreglo:
La cache del modulo ahora usa clave `projectId:serviceId`. `clientModuleLoader` lee `CLIENT_SLUG` con ese mismo scope.

Que ocasionaba sin el arreglo:
Si un servicio cargaba un modulo de cliente, otro servicio podia reutilizarlo por error y ejecutar tools que no le correspondian.

## 5. Procesamiento de respuestas del asistente con service_id

Problema:
Al procesar respuestas, handovers, llamadas a tools o mensajes persistidos, se podia perder el servicio original.

Causa:
`AssistantResponseProcessor` propagaba `projectId`, pero no siempre `serviceId`.

Arreglo:
Se agrego `serviceId` en llamadas recursivas, handovers, ejecucion de tools y guardado de mensajes del asistente.

Que ocasionaba sin el arreglo:
La respuesta podia guardarse en el historial incorrecto, activar/desactivar bot en el chat equivocado o ejecutar herramientas con configuracion de otro servicio.

## 6. last_db_result por service_id

Problema:
El ultimo resultado de base de datos del chat podia actualizarse en un registro incorrecto.

Causa:
`updateLastDbResult` filtraba por `chatId` y `projectId`, pero no por `serviceId`.

Arreglo:
`updateLastDbResult` acepta `forcedServiceId` y agrega filtro `service_id` cuando corresponde.

Que ocasionaba sin el arreglo:
Un resultado de herramienta o consulta podia pisar el estado de otro chat con mismo ID dentro de otro servicio.

## 7. RAG service-aware

Problema:
La busqueda de conocimiento podia devolver fragmentos de otro servicio.

Causa:
`searchKnowledgeBase` usaba OpenAI por proyecto y la RPC no garantizaba por si sola el filtrado por `service_id`.

Arreglo:
La busqueda RAG usa OpenAI por `projectId + serviceId` y filtra resultados por `service_id` en codigo.

Que ocasionaba sin el arreglo:
Un bot podia responder con documentos o conocimiento de otro cliente/servicio.

Pendiente recomendado:
Mover tambien el filtro `service_id` dentro de la RPC de Supabase `match_knowledge_chunks` para que el aislamiento ocurra desde la base.

## 8. Transcripcion de voz por servicio

Problema:
Los audios podian transcribirse con la API key global.

Causa:
`transcribeAudioFile` llamaba a OpenAI sin recibir `projectId` ni `serviceId`.

Arreglo:
`transcribeAudioFile` acepta `projectId` y `serviceId`. `welcomeFlowVoice` los calcula y los pasa.

Que ocasionaba sin el arreglo:
Audios de un cliente podian consumir credenciales del servicio base o fallar si la key global no correspondia.

## 9. Timeouts y settings de flujos por servicio

Problema:
Los flujos del bot podian usar tiempos y settings globales.

Causa:
Los flows de texto, botones, documentos, video, voz, ubicacion y reconexion leian `timeOutCierre` o settings sin `serviceId`.

Arreglo:
Los flows calculan `dynamicProjectId` y `dynamicServiceId` desde el numero del bot o estado, y leen configuracion con ambos valores.

Que ocasionaba sin el arreglo:
Un cliente podia heredar tiempos de cierre, seguimientos o reglas operativas de otro servicio.

## 10. Reconexion y seguimientos por servicio

Problema:
Los mensajes de seguimiento y resumen podian salir con configuracion incorrecta.

Causa:
`reconectionFlow` leia `ASSISTANT_ID`, `msjSeguimiento1/2/3` y timeouts solo por proyecto.

Arreglo:
Se agrego `dynamicServiceId` a lecturas de configuracion, guardado de mensajes y llamadas `safeToAsk`.

Que ocasionaba sin el arreglo:
Los seguimientos podian usar textos, asistente o historial equivocado.

## 11. Ubicaciones y Google Maps por servicio

Problema:
El flujo de ubicacion podia usar una API key de Google Maps incorrecta.

Causa:
`getAddressFromCoordinates` solo recibia `projectId`.

Arreglo:
Ahora recibe tambien `serviceId` y consulta `GOOGLE_MAPS_API_KEY` con `projectId + serviceId`.

Que ocasionaba sin el arreglo:
Servicios con configuraciones separadas podian fallar al procesar ubicaciones o consumir credenciales del servicio base.

## 12. Endpoints OpenAI del backoffice con scope de request

Problema:
Acciones manuales del backoffice podian operar contra OpenAI sin respetar el servicio activo.

Causa:
Algunos endpoints usaban `getOpenAI()` sin `projectId/serviceId`.

Arreglo:
Se actualizaron envio manual, sync de prompt, listado de modelos y update de prompt para resolver `projectId` y `serviceId` desde request/auth/header/body.

Que ocasionaba sin el arreglo:
El operador podia editar o sincronizar el asistente equivocado.

## 13. Evento setting_changed con service_id

Problema:
Cuando cambiaba `CLIENT_SLUG` u `OPENAI_TOOLS_DEFINITION`, la sincronizacion podia ejecutarse sin servicio.

Causa:
El evento declaraba `serviceId`, pero no lo tomaba en la desestructuracion ni lo usaba en todos los saves/gets.

Arreglo:
El evento ahora recibe `serviceId` y lo usa para resetear CRM fields, guardar tools, limpiar tools y sincronizar asistentes.

Que ocasionaba sin el arreglo:
Un cambio de settings de un servicio podia impactar otro servicio dentro del mismo proyecto.

## 14. Inicializacion global de OpenAI limpiada

Problema:
`app.ts` inicializaba clientes OpenAI/vision que no se usaban o que no tenian scope.

Causa:
Habia llamadas sobrantes a `getOpenAI()` y `getOpenAIVision()` durante el arranque/rutas.

Arreglo:
Se eliminaron inicializaciones no usadas y se dejo OpenAI base solo donde corresponde, con `HistoryHandler.PROJECT_IDENTIFIER` y `HistoryHandler.SERVICE_IDENTIFIER`.

Que ocasionaba sin el arreglo:
Podia cargar credenciales globales innecesarias y confundir el scope real de la ejecucion.

## 15. Reply / quoted messages

Problema:
Las respuestas a mensajes no se veian ni se persistian correctamente como respuestas.

Causa:
Faltaba contemplar el ID externo citado en ambos sentidos:
- Meta envio: `context.message_id`.
- Meta recepcion: `message.context.id`.

Arreglo:
Se trabajo el soporte para guardar y renderizar datos de reply/quoted en mensajes.

Que ocasionaba sin el arreglo:
El operador no sabia a que mensaje respondia el cliente y el cliente no veia claramente cuando el backoffice respondia a un mensaje puntual.

## 16. Realtime de conversaciones

Problema:
Al estar dentro de una conversacion, algunos mensajes entrantes no aparecian hasta hacer click o refrescar.

Causa:
La actualizacion realtime no refrescaba correctamente el chat activo y tambien podia disparar notificaciones aunque el operador estuviera dentro.

Arreglo:
Se ajusto la actualizacion realtime del chat activo y se evito notificar si la conversacion ya esta abierta.

Que ocasionaba sin el arreglo:
La experiencia parecia no ser realtime y podia duplicar ruido de notificaciones.

## 17. Persistencia visual de navegacion

Problema:
Al cambiar entre Gestion e Integraciones, el sistema volvia a la seccion principal y se perdia el lugar donde estaba el operador.

Causa:
La navegacion reconstruia estado en vez de recordar la ultima pestana activa por grupo.

Arreglo:
Se agrego memoria de ultima pestana por seccion y persistencia del ultimo chat abierto mientras no haya refresh ni `ESC`.

Que ocasionaba sin el arreglo:
El operador perdia contexto de trabajo y tenia que volver a abrir manualmente la vista o conversacion.

## 18. Sidebar fijo y navegacion simplificada

Problema:
El sidebar expandible generaba inconsistencias visuales y de UX.

Causa:
Existia logica de expandir/contraer que ya no se queria mantener.

Arreglo:
Se elimino la posibilidad de expandir el sidebar y se dejo compacto fijo con iconos.

Que ocasionaba sin el arreglo:
Mas estados visuales para mantener y mayor riesgo de bugs de alineacion.

## 19. System Config seguro y persistente

Problema:
`System Config` podia perder visibilidad o quedar accesible en condiciones no deseadas.

Causa:
La visibilidad no estaba atada de forma estricta al superadmin y podia perder estado.

Arreglo:
Se dejo visible solo con `SYSTEM_CONFIG_VISIBLE` habilitado y login con password hardcodeada/superadmin. El estado no expira automaticamente.

Que ocasionaba sin el arreglo:
Un usuario no autorizado podia ver configuracion sensible o el superadmin podia perder acceso tras refresh/reinicio.

## 20. Toggle global del bot

Problema:
Apagar el bot globalmente no garantizaba visual ni funcionalmente que dejara de responder.

Causa:
El estado global y el estado por chat no estaban suficientemente alineados.

Arreglo:
Se ajusto el comportamiento para que el bot no responda si esta globalmente desactivado, manteniendo la posibilidad de reactivar un chat puntual.

Que ocasionaba sin el arreglo:
El bot podia seguir respondiendo cuando el operador esperaba silencio total.

## 21. Contactos base

Problema:
No habia una agenda centralizada lista para importar contactos por canal.

Causa:
Los datos vivian principalmente en chats o estructuras legacy.

Arreglo:
Se creo base backend/frontend para contactos, normalizacion de telefonos, importacion por canal y deteccion/combinacion de duplicados.

Que ocasionaba sin el arreglo:
No habia forma robusta de centralizar contactos del cliente ni preparar soporte futuro para WhatsApp, Instagram, Facebook o Telegram.

## 22. Reportes duplicados

Problema:
Algunos reportes se veian duplicados dentro de la misma card.

Causa:
El render mezclaba contenido acumulado o multiples resumenes sin separar/actualizar correctamente la card.

Arreglo:
Se planteo y trabajo el fix desde codigo para actualizar la card existente y no crear duplicados visuales, sin tocar Supabase.

Que ocasionaba sin el arreglo:
La misma informacion aparecia repetida y confundia el seguimiento del lead.

## 23. Cards individuales y exportacion XLSX de reportes

Problema:
La vista de reportes mostraba todos los reportes dentro de una sola card visual y no habia una forma de exportar todos los reportes.

Causa:
`reportes.view.js` envolvia todos los items en un unico contenedor `glass-card`. Ademas, el frontend solo cargaba un limite de reportes, por lo que exportar desde pantalla podia dejar datos afuera.

Arreglo:
Cada reporte ahora se renderiza como una card individual sin efecto hover. Se agrego un endpoint backend `GET /api/backoffice/reportes/export` que exporta XLSX desde Supabase filtrando estrictamente `tipo = 'Nuevo Lead'`. La hoja se llama `Reportes de Leads` y solo incluye informacion util para lectura comercial.

Que ocasionaba sin el arreglo:
La lectura visual parecia una sola card gigante y una exportacion frontend hubiera sido incompleta si habia mas reportes que los cargados en pantalla. Tambien podia mezclarse con tickets de `Soporte` si no se filtraba por tipo.

## 24. Reportes acumulados del mismo lead

Problema:
Un mismo reporte de `Nuevo Lead` podia mostrar varios bloques de resumen dentro de la misma card.

Causa:
El cierre de conversacion acumulaba las notas anteriores del chat en `notes` y luego, al crear el ticket por primera vez, `updateContactDetails` usaba `details.notes` como descripcion del ticket. Eso guardaba historial completo en el reporte en vez del resumen actual.

Arreglo:
El ticket `Nuevo Lead` ahora usa `ticket_description` cuando existe, tanto al actualizar como al crear. La busqueda de ticket activo tambien filtra `tipo = 'Nuevo Lead'`, para no tocar tickets de `Soporte`. La salida de reportes y el XLSX normalizan descripciones viejas acumuladas mostrando solo el ultimo resumen util.

Que ocasionaba sin el arreglo:
Cada cierre podia sumar otro bloque de resumen al mismo lead, haciendo que una sola card parezca tener 3 o 4 reportes mezclados.

## 25. Acciones de conversaciones ordenadas

Problema:
El panel de chat tenia controles que no aportaban o ocupaban espacio.

Causa:
Habia boton WhatsApp superior sin funcion real, contador general innecesario y acciones dispersas.

Arreglo:
Se elimino el boton WhatsApp, se movio el buscador al encabezado, se reemplazo el toggle no leidos por botones `Todos` / `No leidos`, y se agruparon acciones en menu de tres puntos.

Que ocasionaba sin el arreglo:
Menos espacio util, acciones poco claras y UX mas pesada.

## 26. Plantillas, mensajes rapidos y comandos

Problema:
Mensajes rapidos y plantillas ocupaban espacio y algunos accesos no abrian correctamente.

Causa:
Los botones estaban sueltos en el composer y no habia comandos de acceso rapido.

Arreglo:
Se movieron a un menu bajo `+` y se agregaron comandos:
- `./` para mensajes rapidos.
- `/` para plantillas express.

Que ocasionaba sin el arreglo:
El composer quedaba cargado de iconos y el operador no tenia una forma rapida y consistente de abrir plantillas.

## 27. Modales, botones y dark mode

Problema:
Habia estilos inconsistentes entre vistas, modales, botones, offcanvas y SweetAlert.

Causa:
CSS disperso, botones con colores distintos y dark mode demasiado oscuro o no aplicado de forma pareja.

Arreglo:
Se modularizaron estilos, se estandarizaron botones, modales y offcanvas, y se ajusto dark mode al azul nuevo.

Que ocasionaba sin el arreglo:
UX inconsistente, pantallas visualmente rotas y mayor dificultad para mantener estilos.

## 28. Vista desktop master-detail de reportes

Problema:
En desktop, los reportes se leian como una lista larga y cada card mezclaba demasiada informacion, lo que hacia incomodo revisar leads uno por uno.

Causa:
La vista usaba el mismo render de cards completas para todas las resoluciones y no tenia una seleccion persistente de reporte dentro de la pantalla.

Arreglo:
En `reportes.view.js` se agrego una vista desktop desde 1024px con grid de dos columnas: lista de leads a la izquierda y detalle indentado del resumen a la derecha. Mobile y tablet conservan el render de cards anterior. Tambien se estandarizo la barra de busqueda, filtros, exportacion y refresco usando estilos dinamicos del tema.
Luego se compacto el panel de resumen y se amplio la columna izquierda para reducir scroll innecesario en desktop.
Tambien se ajusto la vista a `100dvh` para que el contenido entre en el alto visible del usuario y el scroll quede dentro de la lista/detalle, evitando que acciones inferiores queden tapadas por la barra del sistema.
Se corrigio el scroll interno del detalle para que el cuerpo del resumen ocupe el espacio flexible disponible y no se corte.
Se corrigio el bloqueo del scroll general de la seccion Reportes quitando `overflow:hidden` de los contenedores principales y dejando `reportes-page` con scroll vertical propio.
Se elimino el `max-height` y el scroll interno del panel derecho para que el resumen de conversacion no quede cortado a media altura; ahora crece completo y scrollea la seccion.
Se ajusto la seleccion del lead para que no reconstruya la lista completa al hacer click, evitando que el scroll vuelva arriba. La seleccion queda guardada en `localStorage` por token y se restaura al refrescar o despues de redeploy.
Se estandarizo la toolbar de Reportes con una altura comun para filtros, exportacion y refresco. Tambien se convirtio Grupos Meta WABA en acordeon cerrado por defecto, con estado expandido persistente si el usuario lo abre.

Que ocasionaba sin el arreglo:
La lectura en desktop era mas lenta, el resumen no estaba jerarquizado y la toolbar se veia menos coherente con el resto del backoffice.

## 29. Reportes nativos sin toggle

Problema:
La vista de reportes dependia de un toggle manual `Encendido/Apagado` para mostrar la funcion, aunque reportes ya forma parte del flujo nativo del sistema.

Causa:
La pantalla consultaba `REPORTES_ACTIVE` y mostraba un onboarding si estaba apagado. Eso podia ocultar reportes o forzar una activacion manual innecesaria.

Arreglo:
Se elimino el toggle y el onboarding de activacion en `reportes.view.js`. La vista ahora carga reportes directamente. Los endpoints antiguos de `status`, `activate` y `deactivate` quedan compatibles, pero responden siempre activo para no romper llamadas existentes ni permitir apagar la funcion.
Tambien se quito el estado residual `_isActive`; el realtime de reportes ahora recarga siempre que llega `reporte_created`.

Que ocasionaba sin el arreglo:
Un usuario podia ver la seccion apagada aunque el sistema genere reportes, agregando friccion y riesgo de confundir una funcion nativa con una integracion opcional.

## 30. Validaciones ejecutadas

Checks corridos:
- `pnpm build`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm run lint`
- `pnpm run tailwind:build`
- `git diff --check`

Resultado:
Todos pasaron correctamente. `git diff --check` solo mostro warnings normales LF/CRLF de Windows.

Limitacion:
No hay script `test` definido en `package.json`, por lo tanto no existe suite automatizada adicional para correr desde npm/pnpm.

## Pendientes tecnicos recomendados

1. Probar con un cliente real con `service_id` distinto al base.
2. Probar Meta y Baileys en vivo antes de deploy.
3. Confirmar reply/quoted en ambos sentidos con Meta.
4. Confirmar toggles `GLOBAL_BOT_ENABLED` y bot por chat.
5. Mover el filtro `service_id` de RAG a la RPC de Supabase si se quiere aislamiento desde base.
6. Revisar si `waba_report_groups` y `mercadopago_user_routoing` deben incorporar `service_id`.
## 31. Grupos de WhatsApp dinamicos por vinculacion Meta

Problema:
La seccion de grupos aparecia dentro de Reportes con un toggle manual y permitia intentar crear grupos aunque el numero no estuviera vinculado con Meta o no fuera elegible para Groups API.

Causa:
La UI dependia de un estado manual `META_GROUP_REPORTS_ENABLED` y el backend podia usar fallback al `main_token`, por lo que la feature no representaba correctamente la configuracion real del cliente/proyecto/servicio.

Arreglo:
Se agrego el endpoint `/api/backoffice/waba-groups/capability`, que valida `waba_id`, `phone_number_id` y token desde `meta_onboarding` del proyecto/servicio actual sin fallback al token principal. Si no hay Meta vinculado, el boton `Grupos de WhatsApp` queda visible pero deshabilitado. Si Meta esta vinculado, abre una subvista propia; si Meta responde que el numero no es elegible para Groups API, la vista lo informa y bloquea la creacion. Tambien se cambio la lista de grupos a tarjetas con avatar circular que abren el modal de configuracion al hacer click. La subvista quedo unificada en un solo contenedor para que la cabecera, el estado de Meta/Groups API y la lista de grupos se lean como una misma seccion. Al entrar a Grupos de WhatsApp se oculta la toolbar de Reportes, dejando visible solo la vista de gestion con su boton Volver a Reportes. Los botones de la toolbar y de la subvista se compactaron, el boton Exportar XLSX quedo normalizado con la misma escala tipografica de los filtros, y el hover del boton de grupos quedo neutral para que la explicacion de elegibilidad aparezca solo dentro de la vista.

Que ocasionaba sin el arreglo:
El usuario podia entrar a una feature que iba a fallar en Meta con errores como `(#131215) This phone number is not eligible to access Groups APIs`, generando una UX confusa y riesgo de usar credenciales no correspondientes al cliente.
## 32. Reportes sin boton de refresco manual

Problema:
La toolbar de Reportes tenia un boton manual de actualizar, pero la seccion deberia reflejar los reportes nuevos automaticamente cuando el backend los genera.

Causa:
El frontend escuchaba `reporte_created`, pero usaba `_load()` completo, lo que volvia a pedir todos los reportes y reconstruia la vista de lista/detalle.

Arreglo:
Se elimino el boton manual de actualizar y se agrego actualizacion incremental por socket para `reporte_created` y `ticket_updated`. Ahora el frontend normaliza el reporte recibido, lo inserta o reemplaza en memoria, actualiza el contador, mueve solo la card afectada y refresca el detalle solo si el usuario esta viendo ese lead.

Que ocasionaba sin el arreglo:
El usuario dependia de un boton manual innecesario y cada evento podia provocar una reconstruccion visual mas grande de la necesaria, afectando la sensacion de realtime.
## 33. Toolbar de Reportes alineada al sistema visual

Problema:
Los filtros `Todos / Nuevo Lead`, `Grupos de WhatsApp` y `Exportar XLSX` usaban estilos propios dentro de Reportes y no coincidían con los patrones ya usados en Conversaciones y CRM.

Causa:
Todos los botones compartían la misma clase de filtro, por lo que acciones y filtros se mezclaban visualmente y quedaban con tamaños/textos inconsistentes.

Arreglo:
Se separó el control segmentado de filtros para que copie el patrón de Conversaciones y se movieron `Grupos de WhatsApp` y `Exportar XLSX` a un estilo de acción secundario equivalente al botón `Limpiar` de CRM, respetando darkmode y lightmode.

Que ocasionaba sin el arreglo:
La toolbar se veía desnormalizada y confundía acciones generales con filtros de estado.
## 34. Detalle de reporte en dos columnas

Problema:
El detalle de Reportes usaba una fila por campo y desaprovechaba el ancho disponible en desktop. Ademas tenia un boton `Abrir conversacion` redundante porque el enlace `wa.me` ya abre la conversacion interna.

Causa:
Todos los campos se renderizaban como filas de ancho completo y la accion de abrir chat estaba duplicada.

Arreglo:
En desktop el resumen ahora organiza campos compactos en dos columnas: Nombre/Interes, Empresa/Cargo, Etiqueta/Estado y Chat del usuario/Detalle adicional cuando aplica. Seguimiento se mantiene en ancho completo por ser texto largo. Se elimino el boton `Abrir conversacion` y se conserva el link clickeable del chat.

Que ocasionaba sin el arreglo:
La vista obligaba a scrollear mas de lo necesario y mostraba dos caminos para la misma accion de abrir una conversacion.
## 35. Detalle de Reportes con acciones Ver

Problema:
Los valores del detalle quedaban visualmente centrados y los textos largos como `Seguimiento1` y `Detalle adicional` ocupaban demasiado espacio dentro de la card.

Causa:
El grid mezclaba campos cortos y textos largos con el mismo tratamiento visual, sin una accion compacta para consultar contenido extenso.

Arreglo:
Se alinearon los valores hacia la izquierda, `Seguimiento1` y `Detalle adicional` pasan a mostrarse como campos compactos con boton `Ver`, y ese boton abre un modal con el contenido completo. El link de `Chat del usuario` mantiene apertura de la conversacion interna y ahora tiene hover shrink para sentirse como accion clickeable.

Que ocasionaba sin el arreglo:
La card perdia legibilidad, ocupaba mas alto del necesario y el enlace del chat se leia plano, sin feedback de interaccion.
## 36. Reportes ordenados por fecha de creacion

Problema:
Los reportes podian aparecer ordenados por ultima actualizacion, haciendo que un reporte viejo editado subiera arriba de reportes nuevos.

Causa:
El endpoint y el orden local usaban `updated_at` como fecha principal.

Arreglo:
La lista y la exportacion de Reportes ahora ordenan por `created_at` descendente. El frontend tambien reordena por `created_at` cuando recibe eventos realtime.

Que ocasionaba sin el arreglo:
La vista no respetaba la expectativa de que los reportes nuevos aparezcan arriba y los viejos abajo.
## 37. Reportes sin filtro de tipo

Problema:
La toolbar mostraba un selector `Todos / Nuevo Lead` aunque la seccion Reportes ya lista exclusivamente tickets de tipo `Nuevo Lead` desde el backend.

Causa:
El frontend conservaba un filtro generico de tipo heredado de una version anterior, pero ya no aportaba valor funcional.

Arreglo:
Se elimino el filtro de tipo, su estado interno, estilos, render y logica asociada. La busqueda sigue funcionando sobre los reportes cargados.

Que ocasionaba sin el arreglo:
El usuario veia un control innecesario que ocupaba espacio y sugeria que existian otros tipos de reporte dentro de esa vista.
## 38. Router responsive de navegacion

Problema:
La navegacion desktop usaba sidebar y pestañas, pero en tablet/mobile no habia una estructura clara para reemplazar esas pestañas sin duplicar logica ni romper la ultima ruta visitada dentro de cada seccion.

Causa:
La configuracion de rutas y pestañas estaba distribuida entre `app.js`, `crm-common.js`, `section-header.js` y el HTML del sidebar. Si se agregaba un offcanvas separado a mano, mobile podia quedar desincronizado de desktop.

Arreglo:
Se agrego `src/frontend/js/core/navigation-router.js` como componente compartido. El offcanvas mobile lee la misma configuracion de pestañas que desktop, muestra `Gestion` e `Integraciones` como acordeones, conserva la ultima ruta por seccion y sincroniza puntos de notificacion con `data-dot-sync`. Desktop queda igual desde `1024px` en adelante y mobile/tablet usa offcanvas desde `1023px` hacia abajo.

Que ocasionaba sin el arreglo:
Agregar responsive sobre la navegacion actual podia generar rutas duplicadas, pestañas desactualizadas, dots inconsistentes y cambios visuales no deseados en desktop.

## 39. Eliminacion de acceso externo al portal

Problema:
El sidebar y el offcanvas mobile mantenian el acceso `Volver a mi portal`, pero esa navegacion externa ya no corresponde al flujo actual del backoffice.

Causa:
El acceso seguia hardcodeado en el HTML del sidebar y en el router responsive mobile apuntando a `clientesneurolinks.com/portal/dashboard`.

Arreglo:
Se elimino el item `Volver a mi portal` del sidebar desktop y del offcanvas mobile, dejando solo las entradas internas vigentes del backoffice.

Que ocasionaba sin el arreglo:
El usuario veia una accion obsoleta que podia sacarlo del backoffice hacia un portal que ya no forma parte del plan de navegacion.
## 40. Offcanvas mobile con scroll real y tema persistente

Problema:
La cabecera del menu mobile quedaba fija visualmente arriba al scrollear y al tocar el cambio de tema el offcanvas volvia al inicio.

Causa:
El router responsive podia tomar mas de un contenedor como elemento scrolleable y el cambio de tema reconstruia el menu sin preservar de forma estable la posicion del scroll.

Arreglo:
Se dejo el overlay completo como unico contenedor de scroll, la cabecera/footer quedan en posicion estatica dentro del flujo del drawer, y el cambio de tema guarda/restaura el `scrollTop` actual.

Que ocasionaba sin el arreglo:
El menu se sentia cortado y pesado de usar en mobile/tablet porque el usuario perdia la posicion cada vez que cambiaba el tema.
## 41. Flecha contextual por lado del mensaje

Problema:
La flecha del menu contextual aparecia del lado derecho incluso en mensajes recibidos, lo que rompia la lectura visual de izquierda/recibido y derecha/enviado.

Causa:
El toggle del menu de mensaje tenia posicion global `right`, sin diferenciar entre `.msg.user` y `.msg.assistant`.

Arreglo:
Se agregaron reglas por rol: mensajes recibidos (`.msg.user`) ubican la flecha a la izquierda y mensajes enviados (`.msg.assistant`) la mantienen a la derecha.

Que ocasionaba sin el arreglo:
El menu contextual se veia inconsistente con la direccion de los mensajes y confundia especialmente en burbujas entrantes.
## 42. Reportes responsive como acordeon persistente

Problema:
En tablet/mobile la vista de Reportes no scrolleaba de forma confiable y las cards ocupaban demasiado espacio mostrando toda la informacion de golpe.

Causa:
La vista quedaba con `height:auto` y `overflow:visible` desde `1023px`, dependiendo del contenedor padre para scrollear. Ademas, el render mobile usaba cards completas en vez de un patron compacto.

Arreglo:
Desde `1023px` hacia abajo los reportes se renderizan como acordeones cerrados por defecto. Cada acordeon muestra `Nuevo Lead`, informacion principal y fecha; al abrirlo muestra el detalle completo. Se persiste el reporte abierto y el `scrollTop` de la vista para que al refrescar vuelva al mismo punto. La mini cabecera se adapta: buscador arriba y botones `Grupos de WhatsApp`/`Exportar XLSX` en una fila hasta `767px`, y apilados desde `424px` hacia abajo.

Que ocasionaba sin el arreglo:
El usuario perdia contexto en mobile/tablet, no podia scrollear bien la seccion y tenia que recorrer reportes largos sin una vista compacta.

## 43. Cabeceras mobile sin nombre ni project_id

Problema:
La appbar mobile y la cabecera del offcanvas mostraban nombre del proyecto y project_id, generando ruido visual en un espacio chico.

Causa:
El markup de `shell.html` y del router mobile renderizaba el bloque de marca completo dentro de la cabecera.

Arreglo:
Se elimino el texto de nombre/project_id de ambas cabeceras y se dejo solo el icono del cerebro. Tambien se limpiaron estilos asociados al bloque de texto eliminado.

Que ocasionaba sin el arreglo:
La cabecera mobile se veia saturada y el offcanvas arrancaba con informacion redundante que no aportaba a la navegacion.

## 44. Sidebar desktop expandible y secciones desplegables

Problema:
En desktop el sidebar habia quedado fijo en modo colapsado y la navegacion por pestañas no iba a escalar bien cuando se agregaran mas integraciones.

Causa:
El JS forzaba `_setSidebarCollapsed(true)` y el CSS responsive obligaba tanto `.collapsed` como `:not(.collapsed)` a medir `65px`, anulando cualquier intento de expandir el menu.

Arreglo:
Se restauro el boton para expandir/contraer el sidebar, se reactivaron los desplegables de `Gestion` e `Integraciones` dentro del sidebar y se sincroniza el desplegable activo con la ruta actual. El desktop vuelve a tener dos estados reales: `65px` colapsado y ancho expandido, manteniendo el darkmode actual.

Que ocasionaba sin el arreglo:
El usuario no podia usar el sidebar convencional en escritorio y quedaba obligado a navegar por pestañas horizontales, lo que iba a generar mala UX al crecer la cantidad de secciones.

## 45. Submenus del sidebar colapsado hacia la derecha

Problema:
Cuando el sidebar estaba colapsado, los submenus internos del flyout podian crecer hacia abajo dentro del mismo contenedor, ocupando espacio y perdiendo claridad.

Causa:
Los submenus anidados usaban el mismo layout vertical que el sidebar expandido.

Arreglo:
En sidebar colapsado, los submenus anidados ahora se abren hacia la derecha del flyout con `hover` y `focus-within`. En sidebar expandido se mantiene el comportamiento convencional hacia abajo.

Que ocasionaba sin el arreglo:
Los niveles internos del menu eran menos legibles en modo colapsado y el flyout podia quedar visualmente cargado.

## 46. Configuracion de navegacion fuera de CRM

Problema:
La estructura del sidebar, secciones y rutas SPA vivia dentro de `crm-common.js`, aunque no pertenece al dominio de CRM.

Causa:
La navegacion se habia agregado durante cambios visuales del backoffice y quedo acoplada a un archivo comun historico de CRM.

Arreglo:
Se creo `src/frontend/js/core/navigation-config.js` para centralizar `APP_ROUTES`, secciones, items del sidebar, visibilidad por feature, render de navegacion, apertura/cierre del sidebar, flyouts y estado visual activo. `app.js` toma las rutas desde esa configuracion y `crm-common.js` queda limitado a helpers comunes y configuracion CRM, sin responsabilidad de navegacion ni acciones globales del shell.

Que ocasionaba sin el arreglo:
Agregar nuevas views obligaba a tocar archivos de CRM para cambios de navegacion, aumentando el riesgo de bugs y haciendo menos claro donde mantener el menu.

## 47. Cabecera desktop y shell de navegacion mas limpio

Problema:
El sidebar expandido estaba cargando acciones globales del sistema en el bloque inferior, con un gap mayor que el grupo principal. Ademas, el boton de contraer/expandir se veia grande y el cambio de estado resultaba abrupto.

Causa:
Notificaciones, soporte y tema vivian dentro del sidebar aunque son acciones globales del shell. La transicion del sidebar y el tamano del boton no estaban calibrados con el resto de iconos.

Arreglo:
Se agrego una cabecera desktop con `Notificaciones`, `Soporte`, `Tema` y un avatar circular con iniciales del proyecto. Las acciones globales de tema, logout y visibilidad de system config pasaron a `navigation-config.js`. El sidebar oculta esas acciones globales en desktop, reduce el gap del bloque inferior y usa transiciones mas cortas con boton de toggle mas compacto.

Que ocasionaba sin el arreglo:
El sidebar expandido se veia desbalanceado, con acciones globales mezcladas con navegacion principal, y la experiencia al contraer/expandir parecia brusca.


## 48. Secciones fijas del sidebar expandido

Problema:
En sidebar expandido, `Gestion` e `Integraciones` seguian comportandose como desplegables principales y podian cerrarse, ocultando opciones que deberian estar siempre visibles en desktop.

Causa:
La sincronizacion del sidebar abria solamente la seccion correspondiente a la ruta actual y reutilizaba el mismo comportamiento de dropdown para el estado expandido y colapsado.

Arreglo:
En desktop expandido, `Gestion` e `Integraciones` quedan siempre abiertas como grupos fijos. Solo los subgrupos internos, como `Mercado Libre`, se expanden/contraen hacia abajo. En sidebar colapsado se mantiene el comportamiento existente. Tambien se ajusto el eje de iconos y la transicion del sidebar para que al contraer/expandir no se desplacen visualmente los elementos principales.

Que ocasionaba sin el arreglo:
La navegacion desktop escondia opciones innecesariamente y la animacion del sidebar movia iconos/labels de forma brusca, dando una sensacion poco pulida.


## 49. Sidebar sin reflow animado en la vista activa

Problema:
Al contraer o expandir el sidebar, los contenedores de la seccion activa recalculaban su ancho durante toda la animacion.

Causa:
`#view-root` animaba `margin-left` al mismo tiempo que el sidebar animaba su ancho.

Arreglo:
`#view-root` ahora actualiza su margen instantaneamente y solo el sidebar conserva la animacion visual. Asi la vista deja de reflowear durante la contraccion o expansion.

Que ocasionaba sin el arreglo:
Las cards, grids y contenedores de la vista activa se veian inestables por micro-resizes mientras el sidebar terminaba de contraerse o expandirse.


## 50. Sidebar contraido con iconos directos por seccion

Problema:
Cuando el sidebar estaba contraido, solo se veian los iconos de `Gestion` e `Integraciones`, obligando a abrir flyouts principales para llegar a vistas frecuentes. Ademas, durante la contraccion los iconos se centraban momentaneamente en el ancho completo del sidebar y se veia un salto visual.

Causa:
La misma estructura de dropdown principal se usaba tanto para sidebar expandido como contraido. Al aplicar `.collapsed`, los items internos pasaban a ocupar todo el ancho disponible durante la animacion.

Arreglo:
En desktop contraido, los items de `Gestion` e `Integraciones` se muestran como iconos directos dentro del rail de 65px. Solo los subgrupos reales, como `Mercado Libre`, mantienen flyout hacia la derecha. El rail interno del sidebar queda fijo a 65px durante la animacion para que los iconos no se recentren mientras el contenedor contrae.

Que ocasionaba sin el arreglo:
La navegacion contraida escondia accesos importantes y la animacion del sidebar generaba un reacomodo visual brusco de los iconos.


## 51. Scroll y labels del sidebar contraido

Problema:
Al mostrar todos los iconos directos en el sidebar contraido, algunos quedaban encimados o fuera de pantalla y al pasar el mouse no se veia el nombre de la seccion.

Causa:
El sidebar contraido mantenia `overflow: visible` para los flyouts, pero al tener mas accesos directos ya necesitaba scroll vertical. Los labels tambien estaban ocultos sin un tooltip alternativo.

Arreglo:
El rail contraido ahora puede scrollear verticalmente. Los nombres al hover y los submenus reales, como `Mercado Libre`, se muestran como overlays posicionados por JS para que no queden recortados por el scroll.

Ajuste posterior:
El ancho contraido paso de 65px a 70px para dar mas aire a los iconos y puntos de notificacion. Tambien se elimino el scroll horizontal del sidebar contraido, manteniendo solo scroll vertical.

Segundo ajuste:
El subgrupo `Mercado Libre` en sidebar contraido recupera el flyout hacia la derecha. La regla activa del overlay ahora tiene mayor prioridad que la regla base que mantiene ocultos los submenus cerrados.

Tercer ajuste:
Se oculto la barra visual del scroll del sidebar contraido para evitar una apariencia pesada, manteniendo el scroll vertical con rueda o touchpad. El flyout de `Mercado Libre` se mueve temporalmente al `body` al abrirse para que no lo recorte el sidebar. Tambien se actualizaron los query params de `tailwind.css` y `navigation-config.js` para evitar cache viejo del navegador.

Cuarto ajuste:
El punto rojo de notificacion en sidebar contraido se acerco hacia adentro del icono para que no quede tan separado del item al aumentar el rail a 70px.

Quinto ajuste:
El tooltip con el nombre del item en sidebar contraido ahora queda pegado al borde del sidebar, sin espacio lateral extra.

Que ocasionaba sin el arreglo:
La navegacion contraida quedaba visualmente rota en pantallas con menor alto, con iconos superpuestos y sin identificacion al pasar el mouse.


## 52. Cabecera desktop compacta y menu de cuenta

Problema:
La cabecera desktop usaba botones con texto para acciones globales y el sidebar expandido seguia mostrando nombre, project_id y service_id aunque esa informacion ya no era necesaria ahi.

Causa:
Las acciones globales y los datos del proyecto estaban repartidos entre topbar y sidebar, generando ruido visual en desktop.

Arreglo:
Los botones de la cabecera desktop ahora son iconos compactos. El avatar con iniciales del proyecto abre un menu con `Nuevo usuario`, `Configuracion` cuando `system_config` esta habilitado para superadmin, y `Cerrar sesion`. El sidebar desktop conserva solo el icono de cerebro en su cabecera, sin nombre ni IDs.

Que ocasionaba sin el arreglo:
La cabecera ocupaba mas espacio del necesario y el sidebar repetia datos que no aportaban navegacion.


## 53. Ajustes finos de sidebar y menu de mensajes

Problema:
El sidebar expandido ocupaba mas ancho del necesario, el estado activo en lightmode habia quedado con un azul distinto al del cerebro, el scroll del sidebar contraido no seguia el mismo comportamiento visual y el menu de acciones de mensajes en mobile dependia del boton chico.

Causa:
Los estilos del rail contraido y los estados lightmode habian quedado con reglas especificas heredadas de ajustes anteriores. El menu de mensajes solo estaba pensado para hover/click desktop.

Arreglo:
El sidebar expandido ahora es un poco mas angosto, el active/hover lightmode vuelve al azul del cerebro, el sidebar contraido recupera scrollbar vertical fino visible al hover y los mensajes en mobile abren el menu con pulsacion larga. Tambien se agrego fondo hover a la flecha del menu de mensajes para distinguirla en enviados y recibidos.

Que ocasionaba sin el arreglo:
La navegacion perdia coherencia visual entre temas y en mobile no se podia acceder comodamente a responder, reaccionar o copiar desde una interaccion natural tipo WhatsApp.


## 54. Topbar y sidebar desktop mas consistentes

Problema:
Los botones de la cabecera desktop tenian un tratamiento distinto al sidebar, el sidebar contraido quedaba justo con el scrollbar, habia accesos duplicados abajo del sidebar y soporte podia mostrar punto aunque no hubiese tickets activos.

Causa:
La cabecera tenia estilos propios mas llamativos, el ancho contraido no contemplaba el scroll visible y el resumen global marcaba soporte por ultimo ticket historico sin filtrar tickets cerrados.

Arreglo:
Los botones de cabecera ahora usan iconos grises con el mismo hover/shrink del sidebar, se quitaron `Nuevo Usuario` y `Salir` del sidebar desktop porque viven en el menu del avatar, el rail contraido se amplio a 76px, el scrollbar usa el azul principal y los puntos se acercaron al icono. Soporte queda delegado al widget y el backend solo considera tickets de soporte no cerrados para el resumen.

Que ocasionaba sin el arreglo:
La navegacion desktop repetia acciones, el rail contraido quedaba apretado y soporte podia indicar una accion pendiente inexistente.


## 55. Header sticky del sidebar

Problema:
Al scrollear el sidebar, el boton de expandir/contraer quedaba arriba y habia que volver al inicio para poder usarlo. Ademas el boton seguia viendose como un cuadrado redondeado grande.

Causa:
La cabecera del sidebar formaba parte del flujo normal del scroll y el toggle tenia dimensiones y radio distintos a los iconos del rail.

Arreglo:
La cabecera del sidebar ahora queda sticky dentro del propio sidebar. El boton de expandir/contraer pasa a ser circular, mas compacto y alineado con la columna de iconos cuando el sidebar esta contraido.

Que ocasionaba sin el arreglo:
El usuario perdia acceso rapido al control del sidebar al navegar listas largas y el boton no respetaba la geometria del resto de la navegacion.


## 56. Botones de cabecera con estilo de sidebar

Problema:
Los botones de la cabecera seguian viendose como botones propios, con fondo gris permanente, en vez de comportarse como los iconos del sidebar.

Causa:
La topbar tenia reglas de borde y background independientes del componente de navegacion lateral.

Arreglo:
Los botones de notificaciones, soporte y tema ahora quedan como iconos sueltos, muestran fondo solo en hover/active y respetan el mismo patron visual del sidebar. El punto de soporte en la cabecera tambien se acerco al icono y el boton de soporte sincroniza su active cuando el widget esta abierto.

Que ocasionaba sin el arreglo:
La cabecera no parecia parte del mismo sistema de navegacion y el punto de soporte quedaba visualmente demasiado separado.


## 57. Tooltip y scrollbar del sidebar contraido

Problema:
El tooltip de nombres en lightmode usaba un azul distinto al principal y el scrollbar contraido habia quedado solido todo el tiempo al hacer hover sobre el sidebar.

Causa:
Quedaban reglas lightmode con azul anterior y el thumb del scrollbar no diferenciaba entre hover del sidebar y hover directo sobre la barra.

Arreglo:
El tooltip ahora usa `#0099FF`. El scrollbar contraido vuelve a verse semitransparente al entrar al sidebar y pasa al azul principal solo cuando el mouse esta sobre la barra.

Que ocasionaba sin el arreglo:
El rail contraido no respetaba el color unificado de la interfaz y el scrollbar tenia demasiado peso visual.


## 58. Marca fija y sidebar mas compacto

Problema:
La cabecera del sidebar quedaba demasiado vacia y el sidebar expandido seguia ocupando mas ancho del necesario. En darkmode el scrollbar expandido no tenia el mismo comportamiento pedido para el contraido.

Causa:
La cabecera solo mostraba el cerebro y el scrollbar del area interna dependia de reglas globales.

Arreglo:
Se agrego `Neurolinks - Backoffice` junto al cerebro, el sidebar expandido se achico a 286px y el scrollbar interno replica el comportamiento del contraido: transparente por defecto, azul semitransparente al hover del area y azul principal al hover directo sobre el thumb.

Que ocasionaba sin el arreglo:
El sidebar expandido ocupaba espacio innecesario y el scroll no mantenia una experiencia consistente entre estados.


## 59. Marca del sidebar en dos lineas

Problema:
La marca `Neurolinks - Backoffice` se veia pesada y no seguia la jerarquia tipografica del sistema.

Causa:
El texto estaba en una sola linea con peso alto y no separaba titulo de contexto.

Arreglo:
La marca queda como titulo `Neurolinks` y subtitulo `Backoffice`, usando la familia tipografica del sistema y una jerarquia mas compacta.

Que ocasionaba sin el arreglo:
La cabecera del sidebar competia visualmente con la navegacion y se sentia fuera del lenguaje de la interfaz.


## 60. Notificaciones como widget

Problema:
Las notificaciones se abrian en un modal centrado con overlay, distinto al patron del widget de soporte.

Causa:
La pantalla de notificaciones tenia markup y estilos propios en `notifications.modal.js`, sin compartir posicion, tamano ni comportamiento visual con soporte.

Arreglo:
Las notificaciones ahora se muestran como un widget fijo en la misma posicion y con el mismo tamano que soporte. El widget solo permite cerrar, mantiene el listado de errores Meta API y conserva el marcado automatico de leidas al abrir.

Que ocasionaba sin el arreglo:
La experiencia de notificaciones se sentia desconectada del resto del backoffice y ocupaba la pantalla completa sin necesidad.


## 61. Ajustes de conversaciones y tema

Problema:
El panel de conversaciones ocupaba demasiado ancho, el filtro de etiquetas mostraba un texto largo, el input de busqueda podia cortar texto en el borde derecho y el boton de tema quedaba visualmente seleccionado al activar darkmode.

Causa:
El ancho desktop de `#sidebar` seguia en 480px, el placeholder del filtro usaba `Todas las etiquetas`, el input no tenia restricciones flex suficientes y el boton de tema recibia `active` cuando el tema era oscuro.

Arreglo:
`#sidebar` queda en 360px en desktop, el filtro muestra `Etiquetas`, el input tiene `min-width: 0` y padding derecho, y el boton de tema solo cambia el icono sin quedar activo.

Que ocasionaba sin el arreglo:
La zona de conversaciones robaba espacio al chat, el filtro se truncaba mal, textos largos se veian fuera del input y el estado darkmode parecia una seleccion de navegacion.


## 62. Notificaciones genericas y lectura manual

Problema:
El widget de notificaciones seguia nombrando errores de Meta y marcaba todo como leido apenas se abria, ademas podia convivir abierto con soporte.

Causa:
El texto estaba acoplado a Meta API, el `load()` marcaba automaticamente las notificaciones no leidas y soporte no cerraba el widget de notificaciones.

Arreglo:
La cabecera ahora dice `Notificaciones` con subtitulo generico, cada item no leido se puede marcar individualmente, hay un boton para marcar todas como leidas y soporte/notificaciones se cierran mutuamente.

Que ocasionaba sin el arreglo:
Las notificaciones no servian como sistema general, se perdia el estado de no leido sin accion del usuario y dos widgets podian superponerse en la misma zona.


## 63. Conexion & Chatbot

Problema:
La vista de conexion estaba concentrada en una unica card, el estado de Baileys/Meta tardaba en aparecer sin skeleton y el nombre de la seccion no representaba que tambien administra acciones del chatbot.

Causa:
El layout mezclaba estado de canales, control global del bot y acciones destructivas en una columna chica, y la ruta seguia acoplada a `/conexion`.

Arreglo:
La seccion pasa a llamarse `Conexion & Chatbot`, navega por `/conexion-chatbot` dejando `/conexion` como alias de compatibilidad, separa canales, chatbot y zona de peligro en bloques independientes, y agrega skeleton inicial para el estado de sesion.

Que ocasionaba sin el arreglo:
La pantalla desaprovechaba espacio, parecia lenta mientras cargaba el proveedor y el alcance real de la seccion no quedaba claro.

## Selector de linea vinculada en cabecera
- Se agrego un selector en la cabecera desktop para mostrar la linea vinculada del backoffice y una accion de `Agregar linea` con aviso de proximamente.
- Se agrego un endpoint de lectura de linea actual que prioriza Meta y usa Baileys como fallback cuando no hay Meta vinculada.
- Se emiten eventos realtime al vincular/desvincular Meta y al conectar/desvincular Baileys para que la cabecera se actualice sin recargar.
- Sin este ajuste, el usuario no tenia feedback visible de que linea estaba operando y debia recargar para ver cambios de vinculacion.

## Conexion & Chatbot - QR estable y skeletons

- Se mantuvo visible el bloque de vinculacion de Baileys mientras el canal no esta activo, evitando que el QR/codigo desaparezca en cada polling.
- Se agrego skeleton real de QR durante 2 segundos cuando se genera o cambia el QR, para que el usuario perciba la renovacion sin pantalla vacia.
- Se normalizo la tipografia y pesos de la informacion de Meta para alinearla con el resto del backoffice y no mostrar textos excesivamente pesados.

## Login, cabecera y conexion - ajustes de estabilidad

- Se agrego revelar/ocultar contrase?a y recordar credenciales en login para evitar tipeo repetido.
- Se alinio el selector de linea vinculada con el estilo de dropdown usado por etiquetas y se agrego skeleton mientras carga.
- Se estandarizo el modal de "Proximamente" con el estilo visual de los modales del backoffice.
- Se mantuvo visible el panel de QR/codigo mientras Baileys genera la vinculacion para evitar que la vista se oculte antes de recibir el QR.

## Selector de linea, conexion y notificaciones - estabilidad visual

- Se elimino el efecto de flow del selector de linea y quedo solamente el efecto shrink.
- Se corrigio el toggle del selector de linea para que al tocarlo abierto vuelva a contraerse.
- Se evito que el polling de conexion oculte y vuelva a mostrar el bloque de `Generar QR Grupos`; ahora el bloque se mantiene estable mientras Baileys no esta activo.
- Se elimino el estado visual de `Cargando...` del widget de notificaciones y se conserva el listado actual mientras refresca.
- Se agrego animacion de entrada para notificaciones nuevas cuando el widget esta abierto y se atenuan las notificaciones marcadas como leidas.

Que ocasionaba sin el arreglo:
El selector parecia tener efectos inconsistentes, el usuario no podia cerrar el desplegable tocando el mismo control, la vinculacion de grupos parpadeaba por el polling y las notificaciones quedaban en una pantalla de carga innecesaria.

## Padding y layout estable en vistas principales

Problema:
Los elementos principales de la vista (especialmente a la derecha en la sección "Conexión & Chatbot") quedaban cortados o pegados al borde de la pantalla sin márgenes respirables consistentes en todas las resoluciones.

Causa:
Las clases globales del layout (`#view-root`, `page-container`, `section-header`) no aplicaban padding consistente de forma responsiva y dependían de que las cards internas aportaran su propio espaciado, lo cual fallaba en contenedores flexibles grandes.

Arreglo:
Se normalizó `#view-root` y el contenedor interior para asegurar un padding perimetral unificado (`p-6` en desktop, ajustado en mobile). Ahora todo el contenido se adapta sin cortarse ni llegar a los márgenes absolutos del navegador.

Que ocasionaba sin el arreglo:
Las pantallas se veían asimétricas y en resoluciones específicas el contenido del borde derecho quedaba inaccesible o cortado visualmente.

## Configuración de ID de Servicio (Service ID)

Problema:
En el panel de `System Config`, solo se veía el `PROJECT_ID`, pero era necesario visualizar también el `SERVICE_ID` para asegurar el aislamiento y conexión correcta de los entornos multi-cliente.

Causa:
El markup del panel no contemplaba este bloque de información.

Arreglo:
Se agregó el bloque de `SERVICE_ID` directamente debajo del `PROJECT_ID` en `system-config.view.js`, leyendo su valor de las variables inyectadas de entorno/Railway, manteniendo el diseño de caja descriptiva.

Que ocasionaba sin el arreglo:
Falta de visibilidad sobre qué instancia/servicio estaba ejecutando el superadmin.

## Menú Mercado Libre como flyout a la derecha

Problema:
El menú anidado de Mercado Libre, cuando el sidebar estaba expandido, se abría empujando el contenido hacia abajo. El usuario deseaba que se comportara siempre como un menú lateral (flyout a la derecha), idéntico a cómo funciona cuando el sidebar está contraído.

Causa:
Las clases CSS `nav-sub-dropdown` tenían un comportamiento por defecto para apilar el contenido verticalmente cuando el menú estaba expandido (`display: flex; flex-direction: column;`).

Arreglo:
Se estandarizó el comportamiento de `nav-sub-dropdown` para que **siempre** actúe como un menú flotante lateral absoluto a la derecha del ítem padre, independientemente de si el sidebar principal está expandido o contraído, usando `position: absolute; left: 100%;`.

Que ocasionaba sin el arreglo:
La navegación perdía previsibilidad e inconsistencia visual dependiendo del estado global del sidebar, ocupando espacio vertical no deseado.

## Rediseño del menú contextual en mensajes (Click Derecho & Long Press)

Problema:
El menú contextual de los mensajes aparecía con un botón flotante al hacer hover, el cual molestaba visualmente. Además, en dispositivos táctiles, mantener pulsado (long press) abría el menú pero al soltar el dedo el menú se cerraba instantáneamente, haciendo imposible su uso, y la acción carecía de feedback visual.

Causa:
1. El botón flotante estaba fijado por CSS en el hover del mensaje.
2. Los eventos táctiles `touchend` limpiaban el estado prematuramente sin anular la pulsación en el menú recién abierto.
3. No se implementaban eventos `contextmenu` reales de navegador en desktop.

Arreglo:
1. **Desktop:** Se eliminó el botón flotante. Se implementó el click derecho real (`contextmenu`) sobre el mensaje para abrir el menú en la posición correspondiente (izquierda o derecha según el remitente).
2. **Táctil (Mobile/Tablet):** Se corrigió el timer del long press para que el menú permanezca abierto al soltar el dedo.
3. **Feedback táctil:** Se agregó una animación sutil: un efecto de "hundido" (`scale(0.98)`) al tocar, y un rápido parpadeo de opacidad (`opacity: 0.6`) a los 500ms indicando que el menú se abrió con éxito y se puede soltar el dedo.
4. Se corrigió un error que ponía el fondo transparente y se le aplicó fondo sólido a los badges superpuestos de "bot" y "humano" de los chats para que resalten.

Que ocasionaba sin el arreglo:
En escritorio el diseño se veía sucio con flechas sobrepuestas, y en móviles los usuarios literalmente no podían interactuar con las acciones del chat porque el menú desaparecía al soltar el touch.

## Ubicación unificada para Soporte y Notificaciones

Problema:
El panel de notificaciones se abría en el extremo derecho de la pantalla mientras el menú de cuenta se despliega junto al sidebar, generando una experiencia inconsistente. Además, soporte y notificaciones podían quedar abiertos al mismo tiempo.

Causa:
Los widgets tenían su posición fija anclada a `right: 24px`, independiente del sidebar, y el widget de soporte no cerraba notificaciones al abrirse.

Arreglo:
Se reubicaron ambos widgets para que se abran desde el borde derecho del sidebar, con el mismo origen visual del menú de cuenta. También se agregó cierre cruzado: al abrir soporte se cierran notificaciones, y notificaciones ya cerraba soporte.

Que ocasionaba sin el arreglo:
El usuario veía menús flotantes en zonas distintas para acciones relacionadas y podía terminar con capas superpuestas en pantalla.

## Email de usuario en footer y posicion original de widgets

Problema:
El footer del sidebar mostraba el texto generico "Usuario activo" y los widgets de Soporte/Notificaciones quedaron anclados junto al sidebar, pero visualmente no funcionaban bien en esa ubicacion.

Causa:
El front no consumia el email del usuario/proyecto desde `/api/backoffice/me`, y los widgets habian cambiado su anclaje desde el margen derecho del viewport hacia el borde del sidebar.

Arreglo:
Se amplio `/api/backoffice/me` para devolver `email` desde `users` o `clientes.email`, el sidebar lo carga y cachea en `localStorage`, y Soporte/Notificaciones volvieron a abrirse en su posicion original inferior derecha.

Que ocasionaba sin el arreglo:
El usuario no podia identificar rapidamente la cuenta activa y los widgets quedaban visualmente corridos respecto del patron previo.

## Footer de cuenta sin parpadeo generico

Problema:
Al refrescar, el footer del sidebar mostraba "Usuario activo" antes de resolver el usuario real.

Causa:
El HTML tenia un texto fijo inicial y el JavaScript lo reemplazaba recien despues de cargar localStorage o consultar `/api/backoffice/me`.

Arreglo:
Se quito el texto fijo del HTML y el sidebar ahora pinta inmediatamente el email cacheado o el usuario cacheado antes de consultar al backend.

Que ocasionaba sin el arreglo:
Se veia un parpadeo visual con un estado generico que no correspondia a la cuenta real.

## Rutas SPA centralizadas

Problema:
Al navegar a secciones como Contactos y refrescar la pagina, el servidor podia responder `Not Found` aunque la navegacion interna funcionara.

Causa:
Las rutas estaban duplicadas: el frontend tenia `/contactos` en `navigation-config.js`, pero el backend no lo registraba en `static.routes.ts` para servir `shell.html` al refrescar.

Arreglo:
El backend ahora lee las rutas SPA desde `navigation-config.js` y registra automaticamente esas rutas para servir `shell.html`, manteniendo `/tickets` como ruta legacy.

Que ocasionaba sin el arreglo:
Cada nueva vista necesitaba tocar dos archivos distintos y era facil que el refresh directo de una seccion fallara.

## Limpieza de rutas SPA duplicadas

Problema:
Aunque las rutas SPA ya se leian desde `navigation-config.js`, `static.routes.ts` conservaba una lista larga de respaldo con las mismas rutas.

Causa:
La migracion inicial mantuvo un fallback amplio para seguridad, pero eso seguia duplicando informacion de navegacion.

Arreglo:
Se redujo el fallback del backend a una ruta minima de emergencia y se dejo `navigation-config.js` como fuente principal de rutas SPA.

Que ocasionaba sin el arreglo:
La navegacion quedaba mas dificil de mantener porque futuras vistas podian volver a depender de listas duplicadas.

## Rutas SPA sin fallback duplicado

Problema:
El registro de rutas SPA seguia teniendo una ruta fallback dentro de `static.routes.ts`.

Causa:
Quedo una proteccion de emergencia despues de centralizar las rutas en `navigation-config.js`.

Arreglo:
Se elimino el fallback y ahora el backend exige leer `APP_ROUTES` desde `navigation-config.js` como unica fuente.

Que ocasionaba sin el arreglo:
Segu�a existiendo una segunda fuente, aunque minima, para rutas del shell.

## 27. Meta Cloud API por service_id en plantillas y errores

Problema:
Los envios de plantillas podian usar la configuracion global de Meta en vez de la linea del servicio real.

Causa:
`sendTemplate` leia `this.config` directamente y varios endpoints no pasaban `projectId/serviceId` al provider. Ademas, el registro de errores de Meta resolvia el proyecto desde la config global.

Arreglo:
Se centralizo la resolucion de credenciales Meta por `projectId + serviceId`, se pasaron esos datos en envios de plantillas/backoffice/API externa y las notificaciones de error ahora priorizan el servicio del envio. Tambien se agrego un mensaje breve para el codigo 131049.

Que ocasionaba sin el arreglo:
Una plantilla podia salir desde otra linea, guardarse en un servicio distinto o registrar el error en el proyecto incorrecto. En entornos multi-servicio esto generaba diagnosticos falsos y fallas intermitentes en reenvios/campanias.

## 28. Conexion: QR Baileys estable por service_id

- Problema: despues del redisenio visual de Conexion & Chatbot, el boton de generar QR podia inferir mal si debia iniciar Baileys principal o Baileys de grupos usando el texto visible del boton. En proyectos con Meta como proveedor principal, eso podia intentar iniciar el proveedor equivocado y no generar QR real.
- Arreglo: el frontend ahora guarda explicitamente el target de vinculacion (primary/groups), envia projectId y serviceId al endpoint de inicio, y consulta el estado con esos mismos parametros.
- Impacto: Meta sigue leyendo su configuracion por proyecto/servicio, y Baileys inicia el proveedor correcto para QR o codigo sin depender del texto/render visual.

## 29. CRM/Tareas: navegacion rapida sin render cruzado

Problema:
Al alternar rapido entre CRM y Ver tareas, una inicializacion asincronica de la vista anterior podia terminar tarde y renderizar su tablero dentro de la vista nueva.

Causa:
CRM y Tareas comparten contenedores como `#kanban-board-inner`; sin una marca de vista activa ni invalidacion de ejecuciones pendientes, los `syncCRM()` tardios podian escribir despues de navegar.

Arreglo:
Cada vista ahora marca su contenedor con `data-crm-view`, usa un identificador de ejecucion activo y valida la ruta/contenedor antes de seguir cargando, sincronizar o renderizar. Al destruir una vista se invalidan ejecuciones y sincronizaciones pendientes.

Que ocasionaba sin el arreglo:
Se podia ver por un instante el tablero de Tareas en CRM, o el de CRM en Tareas, especialmente al cambiar rapido antes de que terminaran los fetchs.

## 30. CRM: cabecera compacta con filtros y eliminacion selectiva

Problema:
La mini cabecera del CRM mezclaba filtros, contador y eliminacion masiva en una sola fila larga, ocupando demasiado espacio y dejando la accion de borrar demasiado directa.

Causa:
Los filtros estaban siempre visibles y el boton de eliminacion borraba todos los leads filtrados despues de una sola confirmacion general.

Arreglo:
Se movieron los filtros a un modal estandarizado, se compacto la cabecera a `Filtros | Eliminar - Mostrando leads` y la eliminacion ahora abre un modal donde se seleccionan uno, varios o todos los leads visibles antes de confirmar.

Que ocasionaba sin el arreglo:
La cabecera se volvia dificil de escanear y era mas riesgoso eliminar leads por accidente al trabajar con filtros activos.

## 31. CRM: filtros desplegables y eliminacion filtrable

Problema:
El filtro principal abria un modal demasiado pesado para una accion frecuente y la eliminacion selectiva solo tomaba los filtros actuales sin permitir ajustar el rango dentro del flujo de borrado.

Causa:
Los controles de etiqueta/fecha estaban encapsulados en un modal independiente y el modal de eliminacion no tenia filtros propios antes de seleccionar leads.

Arreglo:
Se cambio Filtros a un desplegable compacto en la cabecera y se agregaron filtros por etiqueta, fecha desde y fecha hasta dentro de Eliminar leads. El listado de eliminacion ahora se recalcula sin cerrar el modal y conserva seleccion solo para los resultados visibles.

Que ocasionaba sin el arreglo:
El usuario tenia que navegar mas de lo necesario para filtrar y podia necesitar cerrar/reabrir la eliminacion para ajustar que leads borrar.

## 56. Error "Proveedor Meta no disponible" en descargas masivas y envios

Problema:
Al intentar exportar la plantilla a Excel o usar los envios masivos/rapidos, el sistema arrojaba el error "Proveedor Meta no disponible" (HTTP 400).

Causa:
Varias rutas en `backoffice.routes.ts` intentaban acceder a la variable `adapterProvider` y `groupProvider` sin inicializarlas mediante las funciones correspondientes (`getAdapterProvider()` y `getGroupProvider()`). Esto causaba que la validacion de proveedor fallara o se perdiera la referencia al proveedor real.

Arreglo:
Se instanciaron correctamente las variables en cada ruta afectada antes de evaluar la capacidad de MetaCloudProvider.

Que ocasionaba sin el arreglo:
El boton de Formato Excel y otras funciones de envio masivo fallaban inmediatamente porque el backend no lograba identificar al proveedor Meta conectado.

## 57. Refactorización de Arquitectura: Aislamiento del CRM y limpieza Global

Problema:
El archivo crm-common.js operaba como un 'God Object' conteniendo lógica global no relacionada al CRM (modal de usuarios, interceptor de fetch, utilidades de textarea de chat, selectores custom), generando posibles fallas, colisiones de estado global y carga innecesaria en pantallas como login.

Causa:
Funcionalidades comunes de interfaz o autenticación estaban mezcladas junto a la lógica pesada del tablero Kanban, obligando a cargar crm-common.js indiscriminadamente en el shell global e incluso en el login, a menudo utilizando sufijos de cache busting (?v=X) que la ensuciaban.

Arreglo:
Se extrajo la lógica global y se repartió correctamente:
- Interceptor Fetch y utilidades de Token fueron a auth-check.js.
- UI global (modales de usuarios, CSD, Meta panel) a app.js.
- Lógica de textareas de chat a backoffice.js.
Se dejó a crm-common.js puramente para configuraciones y utilidades de las columnas del Kanban. Además, crm-common.js ahora se carga dinámicamente mediante lazy loading únicamente al visitar 'CRM' o 'Ver Tareas', y se removieron todos los sufijos ?v=X de los scripts cargados en el shell y login.

Que ocasionaba sin el arreglo:
Podían ocurrir errores de "is undefined" si los scripts no se inicializaban en el orden estricto esperado, tiempos de carga marginalmente más lentos y código difícil de mantener.

## 58. Prevención de Caché Persistente en Assets (Archivos Estáticos)

Problema:
Al retirar los sufijos manuales de cache busting (?v=8) en el frontend, navegadores en producción conservaban copias antiguas de archivos críticos (como `app.js` y los módulos de `/js`), ejecutando lógica desactualizada y provocando errores fantasmas (como el fallo en envíos de Excel porque el JS viejo no pasaba `projectId`).

Causa:
Express utilizaba el middleware `serve-static` con configuración por defecto para las carpetas `/js` y `/style`. Al no enviar explícitamente cabeceras de prevención de caché, los navegadores y servicios Cloud guardaban agresivamente los archivos JS y CSS.

Arreglo:
Se inyectaron cabeceras HTTP de prevención de caché (`Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0`) en `static.routes.ts` para `app.js`, `/js` y `/style`.

Impacto de la corrección:
Ahora el navegador siempre validará y descargará las últimas versiones de la lógica de aplicación sin afectar configuraciones locales ni requerir que el desarrollador añada manualmente `?v=X` en cada cambio.

## 59. Fix: Error "Proveedor Meta no disponible" en envíos de plantilla directa

Problema:
Al intentar enviar una plantilla individual desde el chat de conversaciones en entornos de Meta Cloud, el backend rechazaba la solicitud con el error "El proveedor WhatsApp configurado no soporta plantillas de Meta.", pese a que el proveedor activo sí era Meta.

Causa:
La ruta `/api/backoffice/whatsapp/send-single-template` solicitaba la instancia de `getAdapterProvider()` y `getGroupProvider()` sin enviarles los parámetros `projectId` y `serviceId`. Como la arquitectura multitenant los requiere para encontrar el proveedor correcto, el servidor resolvía un proveedor vacío o nulo, fallando la validación estricta de tipo `MetaCloudProvider`.

Arreglo:
Se modificaron las invocaciones a `getAdapterProvider(projectId, serviceId)` y `getGroupProvider(projectId, serviceId)` en `backoffice.routes.ts`, permitiendo que el backend capture correctamente la instancia asignada al espacio de trabajo.

Impacto de la corrección:
El envío directo de plantillas desde la interfaz de CRM o tickets (Conversaciones) ahora reconoce correctamente el proveedor de Meta Cloud y despacha la plantilla.

## 60. Corrección estructural en validación de Proveedor Meta (Duck Typing)

Problema:
En entornos de producción, el envío de plantillas de forma individual o masiva, y la exportación de plantillas a Excel fallaban intermitentemente con el error "El proveedor WhatsApp configurado no soporta plantillas de Meta" o "Proveedor Meta no disponible", pese a tener un proveedor MetaCloudProvider conectado.

Causa:
Las rutas en `backoffice.routes.ts` validaban la instancia del proveedor comprobando rígidamente su nombre de clase (`activeAdapter.constructor.name === 'MetaCloudProvider'`). Durante el proceso de build/empaquetado en producción, o cuando la librería base envuelve la clase en un Proxy, el nombre del constructor cambia, haciendo que la validación falle y caiga en el proveedor de "fallback" (Baileys), el cual no soporta plantillas.

Arreglo:
Se reemplazó la validación estricta por "Duck Typing". Ahora el sistema verifica directamente si la instancia en cuestión posee los métodos necesarios (`typeof activeAdapter.sendTemplate === 'function'` o `getTemplates`). 

Impacto de la corrección:
Esto garantiza que la aplicación sea 100% resistente a procesos de compilación (minificación/mangling) y proxys, asegurando que las plantillas y el formato Excel funcionen perfectamente en producción.
