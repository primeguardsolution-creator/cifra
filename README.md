# CIFRA

Mensajería privada con dos espacios a un toque: **Personal** y **Business**. Expo (React Native + web) sobre Supabase.

- **App web de pruebas:** https://cifra-mensajeria.netlify.app (PWA: se puede “instalar” desde el navegador del móvil)
- **Identidad:** el número de teléfono. Una cuenta por número, garantizado por el servidor.
- **Espacios:** el botón *Personal | Business* (arriba en la lista de chats, o en la barra lateral en escritorio) cambia de espacio al instante, con tema, bandeja y pestañas propias.

## Qué incluye
| Personal | Business |
| --- | --- |
| Chats 1:1 y grupos en tiempo real; fijar, archivar, marcar como no leído, silenciar | Perfil de negocio con logo, categoría, contacto y visibilidad |
| Enviado / leído, “escribiendo…”, respuestas, reacciones, editar/eliminar | Bandeja compartida: estados, asignación, filtros, notas internas |
| Fotos, vídeos y documentos (hasta 25 MB) | Catálogo con fotos y precios (público para clientes) |
| **Programar mensajes** (los envía el servidor aunque cierres la app) | Saludo automático, mensaje de ausencia, respuestas rápidas |
| **@usuario** para chatear sin dar tu teléfono; opción de ocultar tu número | Perfil público `/b/<identificador>` con botón “Enviar mensaje” |
| Búsqueda en todos los mensajes (salta al mensaje), mensajes destacados | Equipo con roles y asignación |
| Mensajes de voz (grabar, reproducir a 1×/1,5×/2×) | |
| Llamadas de voz y videollamadas por internet (WebRTC) + pestaña **Llamadas** con historial y perdidas | |
| Estados de 24 h (texto o foto) | |
| Bloqueo con PIN (6 dígitos), 5 colores de acento, 6 fondos de chat, modo claro/oscuro | |
| Contactos, bloqueo, silenciar, descubrir por número o por @usuario | Roles: propietario, admin, supervisor, agente, solo lectura |
| Perfil editable con foto, tema claro/oscuro | Perfil público `/b/<identificador>` con botón “Enviar mensaje” |

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
- Perfiles: `/user/[id]` (personas) y `/b/[id]` (negocios) con su propia cabecera; el teléfono del negocio es opcional (`show_phone`).
- Reproductor de vídeo interno (`VideoPlayer.tsx`) y búsqueda por `@` que también encuentra negocios.

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
