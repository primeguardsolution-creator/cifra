# CIFRA

Mensajería privada con dos espacios a un toque: **Personal** y **Business**. Expo (React Native + web) sobre Supabase.

- **App web de pruebas:** https://cifra-mensajeria.netlify.app (PWA: se puede “instalar” desde el navegador del móvil)
- **Identidad:** el número de teléfono. Una cuenta por número, garantizado por el servidor.
- **Espacios:** el botón *Personal | Business* (arriba en la lista de chats, o en la barra lateral en escritorio) cambia de espacio al instante, con tema, bandeja y pestañas propias.

## Qué incluye
| Personal | Business |
| --- | --- |
| Chats 1:1 y grupos en tiempo real; fijar, archivar, marcar como no leído, silenciar | Perfil de negocio con logo, **portada**, **color propio** (5 opciones), categoría, contacto y visibilidad |
| **Chat incógnito**: sala aparte con nombre, en blanco y negro y tipografía de máquina de escribir; se autodestruye tras 3 h sin actividad o al instante si ambos lo piden, sin dejar rastro | **Publicaciones**: texto, foto o vídeo (7 días) visibles en el perfil público y en los Estados de tus clientes, con botón «Escribir» |
| **Contacto desconocido**: si te escribe alguien que no tienes guardado, puedes añadirlo, reportarlo o bloquearlo desde el chat | **Escribir a un cliente** desde el CRM (crea el chat aunque solo tengas su teléfono) e **invitar a cualquier cuenta** a una cita, que la acepta desde su chat |
| Enviado / leído, “escribiendo…”, respuestas, reacciones, editar/eliminar | Bandeja compartida: estados, asignación, filtros, notas internas |
| Fotos, vídeos y documentos (hasta 25 MB) | Catálogo con fotos y precios (público para clientes) |
| **Programar mensajes** (los envía el servidor aunque cierres la app) | Saludo automático, mensaje de ausencia, respuestas rápidas |
| **@usuario** para chatear sin dar tu teléfono; opción de ocultar tu número. Se encuentra a cualquier cuenta por su @usuario (también por prefijo) y se añade a contactos sin número | Perfil público `/b/<identificador>` con botón “Enviar mensaje”, portada, color y “Novedades” |
| Búsqueda en todos los mensajes (salta al mensaje), personas por @usuario y negocios; mensajes destacados | Equipo con roles y asignación |
| Mensajes de voz (grabar, reproducir a 1×/1,5×/2×) | Navegación con animaciones (franja, rebote, tecla Doer) |
| Llamadas de voz y videollamadas por internet (WebRTC) + pestaña **Llamadas** con historial y perdidas | |
| Estados de 24 h (texto, foto o **vídeo**) + publicaciones de los negocios con los que hablas | |
| Bloqueo con PIN (6 dígitos), 5 colores de acento, 6 fondos de chat, modo claro/oscuro | |
| Contactos, bloqueo, silenciar, descubrir por número o por @usuario | Roles: propietario, admin, supervisor, agente, solo lectura |
| Perfil editable con foto y **portada**, «Mis citas» (invitaciones de negocios) | |

## Puesta en marcha
```bash
npm install
cp .env.example .env.local     # URL y Publishable key de Supabase (Dashboard → Connect)
npx expo start --web           # desarrollo
npm run typecheck
npm run test:db                # 68 pruebas de aislamiento/seguridad en un Postgres embebido
node scripts/e2e-live.mjs      # prueba extremo a extremo contra tu Supabase (crea cuentas de prueba)
npm run build:web              # genera dist/ para Netlify
```

### Base de datos (SQL Editor de Supabase, en este orden)
1. `supabase/migrations/20261021_000001_cifra_foundation.sql`
2. `supabase/migrations/20261022_000002_cifra_messaging.sql`
3. `supabase/migrations/20261022_000003_phone_alias_identity.sql`
4. `supabase/migrations/20261022_000004_avatar_read.sql`
5. `supabase/migrations/20261023_000005_voice_and_calls.sql`
6. `supabase/migrations/20261024_000006_organize_schedule_username.sql` (activa pg_cron para enviar mensajes programados cada minuto)
7. `supabase/migrations/20261025_000007_reserved_usernames.sql` (usernames reservados + límite del asistente IA)
8. `supabase/migrations/20261026_000008_crm_agenda_profiles.sql` (perfil @usuario, teléfono de negocio, CRM, agenda)
9. `supabase/migrations/20261027_000009_social_incognito_covers.sql` (portadas, color por negocio, chats incógnito con purga por pg_cron cada 5 min, búsqueda por @usuario, chat desde el CRM, invitaciones de cita a cualquier cuenta, publicaciones con vídeo y feed de negocio, reportes)
10. `supabase/migrations/20261028_000010_delivery_receipts.sql` (acuses de entrega: un tick enviado, dos entregado, dos en verde leído; también en la lista de chats)

### Autenticación
`EXPO_PUBLIC_PHONE_VERIFICATION`
- `none` (por defecto, **beta**): el teléfono es la identidad mediante un alias interno `p<número>@phone.example.com` (dominio reservado: nadie puede recibir correo allí). Requiere *Auth → Sign In / Providers → Confirm email = off*. **El número no se verifica por SMS.**
- `sms`: verificación por código. Requiere activar *Phone* en Supabase con un proveedor SMS (p. ej. Twilio). La app ya soporta el flujo de código y reenvío.

## Llamadas por internet
- Audio y vídeo directos entre dos personas (WebRTC). La señalización viaja por canales privados de Supabase Realtime (`call:<id>`); solo se puede llamar a quien tienes en un chat y no te ha bloqueado.
- **TURN (para que funcione entre redes distintas y con datos móviles):** la función `netlify/functions/ice.mts` pide servidores a Twilio. En Netlify → *Site configuration → Environment variables* añade `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` (o `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`) con scope *Functions* y vuelve a desplegar. Sin ellas se usa solo STUN público (funciona en muchas redes, no en todas).
- La app web solo suena **con la app abierta**. Para recibir llamadas con la app cerrada hacen falta notificaciones push nativas (apps iOS/Android).
- Mensajes de voz y llamadas funcionan hoy en la versión web/PWA; la versión nativa necesitará `react-native-webrtc`/`expo-audio`.

## Dos espacios, dos diseños
- **Personal («Aurora»)**: violeta eléctrico, modo oscuro negro real, avatares «squircle», burbujas con degradado, barra inferior flotante, títulos en Bricolage Grotesque y 4 fondos de chat propios (Cifra, Aurora, Trama, Noche) o tu imagen.
- **Business («Ink & Amber»)**: esquinas rectas, mensajes en filas tipo Slack, barra lateral de trabajo, ámbar sobre negro. Incluye **Agenda de citas** (calendario, solicitudes de clientes desde el perfil público, tarjetas en el chat con Confirmar/Cancelar), **Clientes (CRM)** con embudo, etiquetas, notas y tareas, y **Doer**, el asistente que ejecuta tareas (plan → «Hacerlo»). Migración 8; Doer usa `netlify/functions/doer.mts` (`npm run test:doer`, `npm run test:assistant-fn`).
- Perfiles: `/user/[id]` (personas) y `/b/[id]` (negocios) con su propia cabecera y portada editable; el teléfono del negocio es opcional (`show_phone`).
- Cada negocio elige su **color** (ámbar, cobalto, jade, rubí, orquídea): tiñe la barra, los botones y el perfil público para todo el equipo (`businesses.accent`).
- **Publicaciones** (`/posts`): texto, foto o vídeo de hasta 90 s que dura 7 días; se ve en el perfil público (“Novedades”) y en la pestaña Estados de quien ya habla con el negocio, con botón «Escribir». Los archivos viven en `chat-media/status/biz/<negocio>/`.
- Reproductor de vídeo interno (`VideoPlayer.tsx`) y búsqueda por `@` que también encuentra negocios.

## Avisos, acuses y actualizaciones
- **Aviso emergente** dentro de la app cuando llega un mensaje de otro chat (verde, con el nombre; toca para abrirlo). Los chats silenciados e incógnito no avisan.
- **Ticks**: ✓ enviado · ✓✓ gris entregado al dispositivo del otro (`mark_delivered`, se marca al recibir la lista o el mensaje) · ✓✓ verde leído. Igual en el chat y en la lista.
- **Burbuja verde** de no leídos y borde verde en Estados solo hasta que los abres (se recuerda en el dispositivo).
- **Arrastra hacia abajo** en el chat (en el extremo de los mensajes nuevos) para recargarlo.
- **Versión nueva**: `scripts/build-web.sh` sella cada build con `EXPO_PUBLIC_BUILD_ID` y escribe `dist/version.json`. La PWA lo lee solo al abrir, al volver a la pestaña y **cuando un deploy lo anuncia**: la función `netlify/functions/release.mts` inserta una fila en `app_releases` y todas las pestañas abiertas reciben el aviso por realtime y muestran «Hay una versión nueva · Actualizar». Sin sondeo periódico ni consumo de IA (es un JSON estático de 60 bytes). Para activar el aviso instantáneo: en Netlify añade `RELEASE_TOKEN` (cualquier cadena larga), `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (scope *Functions*) y crea una notificación *Deploy succeeded → Outgoing webhook* a `https://cifra-mensajeria.netlify.app/api/release?token=<RELEASE_TOKEN>`.

## Chat incógnito
Desde los tres puntos de cualquier chat 1:1: «Chat incógnito con …». Se crea una sala aparte con nombre, en blanco y negro y con tipografía de máquina de escribir (fotos y vídeos siguen a color), para que no se confunda con el chat normal. Se autodestruye tras **3 horas sin mensajes** (cada mensaje renueva el plazo) o **al instante cuando los dos pulsan «Destruir ahora»**. Al destruirse se borran mensajes, archivos, reacciones y destacados para ambos (`request_incognito_destroy`, `purge_incognito` con pg_cron cada 5 min; sin pg_cron la sala se oculta al caducar y se purga en la siguiente ejecución). Dentro del incógnito no hay llamadas, programados ni destacados, y nunca se expone el teléfono.

## Contactos desconocidos
Si te escribe alguien que no está en tus contactos, el chat muestra una barra con **Añadir**, **Reportar** y **Bloquear** (se puede cerrar y queda recordado en el dispositivo). Reportar pide un motivo, lo guarda en `reports` (solo lo lee quien reporta) y permite bloquear en el mismo paso. También desde el menú del chat, incluso para negocios.

## Asistente @maestro (Maestro CIFRA)
Bot oficial dentro de la app (fila fija arriba en *Chats*, también en *Nuevo chat → @usuario → maestro* y en *Ajustes*). Conoce toda la app y explica paso a paso cómo hacer cada cosa.
- **Base de conocimiento local** (`src/features/assistant/knowledge.ts`, datos puros): 45 temas con respuestas, botones de acción (abrir pantallas, cambiar de espacio, invitar) y comandos `/start /ayuda /llamadas /negocio …`. Responde al instante, sin red. `npm run test:assistant` comprueba 130+ preguntas.
- **IA opcional** (`netlify/functions/assistant.mts`, `/api/assistant`): solo se consulta cuando la base local no encuentra respuesta. Usa Claude (`claude-opus-5-5` por defecto; cambia con la variable `ASSISTANT_MODEL`, p. ej. `claude-haiku-5-5` para gastar mucho menos) con la base de conocimiento como único contexto. Necesita `ANTHROPIC_API_KEY` (Netlify AI Gateway la inyecta sola; si no, añádela en *Environment variables*). Solo usuarios con sesión, 40 preguntas/hora por usuario (`check_assistant_rate`). Sin clave o si falla, la app sigue con la base local. `npm run test:assistant-fn` lo prueba con mocks.
- El historial se guarda solo en el dispositivo (AsyncStorage). Los usernames `maestro`, `cifra`, `soporte`… están reservados (migración 7).
- Al desplegar con el CLI, la función se pre-empaqueta con esbuild (`npx esbuild netlify/functions/assistant.mts --bundle --platform=node --format=esm --outfile=…/assistant.mjs`) porque la instalación de dependencias en Netlify falló con el paquete dentro del upload.

## Seguridad (resumen)
- RLS en todas las tablas; el cliente solo puede tocar columnas permitidas; crear conversaciones, negocios y equipos se hace solo con funciones del servidor.
- El teléfono se deriva en el servidor y es único; no se puede suplantar ni marcar como verificado desde el cliente.
- Notas internas nunca llegan al cliente; archivos privados con URL firmadas y caducidad.
- **Los mensajes NO tienen cifrado de extremo a extremo.** Viajan por TLS y se guardan cifrados en reposo; el servicio puede técnicamente leerlos. La app lo dice así.

## Pendiente (hoja de ruta)
Llamadas de grupo, notificaciones push nativas (y llamadas con la app cerrada), verificación SMS en producción, E2EE, borrado/exportación de cuenta automática, apps de iOS/Android publicadas (EAS).

## Languages

CIFRA ships in Spanish, English and German (`src/i18n`). The language follows the device/browser setting: Spanish -> Spanish, German -> German, anything else -> English. It can be overridden in Settings -> Language. Spanish source strings are the keys of `src/i18n/dict.ts` ([es, en, de] rows); `npm run test:i18n` fails if a string used in the UI has no translation. The assistant (@maestro) and Doer have per-language packs/interpreters.

## Migración 11 · notificaciones push, saludo automático y clientes

- `20261029_000011_greeting_push.sql`: el saludo automático de Business solo sale si el negocio no escribió antes al contacto; `list_chats` devuelve `last_sender_name/avatar`; tabla `push_subscriptions` + RPC `save_push_subscription`/`delete_push_subscription`; `push_payloads` y trigger `messages_notify_push` (pg_net → `/api/push`); `add_customer_from_user`.
- Push (iOS 16.4+ solo con la PWA añadida a la pantalla de inicio): variables Netlify `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; en Supabase habilitar `pg_net` y rellenar `push_config` (`url`, `token`).
- Búsqueda de país multilingüe (es/en/de + alias) y búsqueda de clientes por @usuario/teléfono en Business.

### Migración 12 · avisos separados Personal / Business
`20261030_000012_push_prefs.sql`: cada dispositivo elige si recibe avisos personales, de Business o ambos (`set_push_prefs` / `get_push_prefs`). Los de Business llevan 💼 en el título y su propia etiqueta, así que no pisan a los personales.

### Vídeos, enlaces y vista previa
- Al publicar un vídeo (estado o Business) que dura más de 90 s, pesa más de 12 MB o es más nítido que 720p, se abre "Recorta tu vídeo": eliges el tramo y la app lo recodifica en el navegador a 720p con bitrate moderado (mp4 donde el navegador lo permite, webm si no). Va a la velocidad de reproducción y hay que dejar la pestaña abierta.
- Enlaces en estados y publicaciones: tarjeta con título, descripción e imagen vía `/api/link-preview` (solo usuarios con sesión, nunca redes privadas).
- Al compartir el enlace de la app salen las etiquetas Open Graph en inglés con `public/og.png`.

### Migración 13 · recordatorio 5 minutos antes de una cita
`20261031_000013_appointment_reminders.sql`: un trabajo de pg_cron (cada minuto) marca las citas que empiezan en ≤ 5 min y avisa a la función `/api/push` con `{appointment_id}`; reciben push quien creó la cita, la persona asignada y el cliente invitado (según sus avisos Personal/Business). Con la app abierta, `AppointmentReminders` muestra el aviso en pantalla. Mover una cita rearma el recordatorio.

### Migración 14 · recuperar la cuenta (olvidé mi contraseña)
- `20261101_000014_account_recovery.sql` + función Netlify `/api/recovery`: correo verificado con código de 6 dígitos (Brevo) y código de recuperación de un solo uso (XXXX-XXXX-XXXX). Todo se guarda con hash; 5 intentos por código, caducidad de 10 min, 5 envíos por hora, bloqueo de 15 min.
- Variables Netlify (scope Functions): `BREVO_API_KEY`, `MAIL_FROM_EMAIL` (remitente verificado en Brevo), opcional `MAIL_FROM_NAME`, `RECOVERY_PEPPER` (cadena larga al azar), y las que ya existen: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- En la app: «¿Olvidaste tu contraseña?» en Iniciar sesión; Ajustes → Seguridad de la cuenta; al entrar, quien no tenga código de recuperación ve el aviso (se puede posponer 3 días).

### Icono de la app y cabecera de la web
- Icono nuevo (dos burbujas) en 5 épocas: Moderno, Clásico B/N, Retro 70, Neón 80 y Y2K (`public/icons/<variante>/`, generadas por `scripts/make-icons.mjs`). Ajustes → Icono de la app: cambia el icono de la pestaña al instante; el de la pantalla de inicio se fija al añadir la app (enlace `/?icon=<variante>`).
- Expo (`output: "single"`) ignora `app/+html.tsx`, así que la cabecera real (viewport-fit, meta de iOS, manifest, iconos, Open Graph, colores base) vive en `scripts/head.html` y `scripts/inject-head.mjs` la inserta en `dist/index.html` al compilar (`scripts/build-web.sh`).

### Migración 15 · eliminar mi cuenta
`20261102_000015_delete_account.sql`: `delete_my_account()` borra a la persona (perfil, mensajes, estados, contactos, dispositivos de aviso) y los negocios que tiene ella sola; los chats compartidos se quedan para los demás (la creación pasa a otro miembro). Si es propietaria de un negocio con equipo, lo impide hasta que lo traspase o quite al equipo. En la app: Ajustes → Eliminar mi cuenta (pide contraseña y escribir ELIMINAR; antes borra sus archivos del almacenamiento).

### Migración 16 · Difusión (mensaje a todos los clientes)
`20261103_000016_broadcasts.sql`: `send_broadcast` (solo propietario, administradores y supervisores) envía un mensaje a los clientes con cuenta de CIFRA, en su chat normal con el negocio, marcado como difusión. Excluye al equipo, a quien se dio de baja (`broadcast_optout`, un toque en el mensaje) y a quien bloqueó al remitente. Límites: 3 por negocio cada 24 h y 500 destinatarios. En la app: Business → Difusión (accesos rápidos de la Bandeja, Más y barra lateral).

### Migraciones 17 y 18 · moderación y mensajes temporales
- `20261104_000017_moderation.sql`: panel de moderación (Ajustes → Moderación, solo para administradores de la plataforma). Para hacerte administrador, en el SQL Editor: `insert into public.platform_admins (user_id) select id from public.profiles where phone = '+TU_NUMERO';`. Permite revisar, descartar reportes y suspender/reactivar cuentas (`auth.users.banned_until`); todo queda en `moderation_log`.
- `20261105_000018_disappearing_messages.sql`: temporizador por chat directo o de grupo (24 h, 7 d, 90 d). Los mensajes caducados se ocultan al instante y un job de pg_cron los borra cada minuto.
- Control de errores: Sentry (`@sentry/react`, solo web) en `src/lib/monitoring.ts`; DSN público, sin datos personales, solo el id de cuenta.
