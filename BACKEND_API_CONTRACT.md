# CIFRA — contrato de identidad y datos

La app usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (la Publishable key puede ir en el cliente; **nunca** la `service_role`).

## Identidad
- Registro/acceso con `supabase.auth` (`signUp`, `signInWithPassword`, sesión persistente; en móvil en `expo-secure-store`).
- Una cuenta por teléfono. En modo beta (`EXPO_PUBLIC_PHONE_VERIFICATION=none`) el cliente usa el alias `p<dígitos E.164>@phone.example.com`; el trigger `create_profile_for_new_user` deriva `profiles.phone` de ese alias en servidor y **rechaza** cualquier alta sin teléfono. En modo `sms` se usa `phone` nativo + `verifyOtp`.
- `profiles.phone` es único; `phone_verified` solo lo cambia el servidor.

## Acceso a datos
- Tablas con RLS; privilegios por columna (`profiles`, `businesses`, `messages`, `conversation_members`).
- Escritura solo vía RPC: `start_direct_chat`, `start_incognito_chat(p_other, p_title)`, `request_incognito_destroy(p_conv, p_cancel)`, `create_group`, `add_group_members`, `leave_conversation`, `mark_read`, `create_business`, `start_business_chat`, `start_customer_chat(p_customer)` (equipo → cliente del CRM), `update_business_conversation`, `add_business_member`, `set_business_member_role`, `remove_business_member`, `create_appointment(…, p_user)` (invita a cualquier cuenta), `respond_appointment`, `mark_delivered(p_conv?)` (acuse de entrega: la app lo llama al recibir mensajes).
- Lectura vía RPC: `list_chats` (incluye `incognito`, `expires_at`, `destroy_mine`, `destroy_peer`, `last_delivered`, `last_read`), `get_profiles` (con `cover_path`), `find_user_by_phone` (limitada a 40/min), `find_user_by_username`, `search_users` (prefijo de @usuario, 8 resultados, nunca el teléfono), `search_businesses`, `get_business_public` (con `cover_path`, `accent`), `list_business_team`, `my_appointments`.
- Tablas con escritura directa bajo RLS: `statuses` (estado personal 24 h o publicación de negocio con `business_id`, hasta 7 días, `kind` text/image/video), `reports` (solo inserción propia y lectura propia), `contacts`, `profiles.cover_path`, `businesses.cover_path` / `accent` (gestores).
- Storage: `chat-media` (privado, URL firmadas, acceso por pertenencia a la conversación; `status/<usuario>/` y `status/biz/<negocio>/` para estados y publicaciones) y `avatars` (público: fotos de perfil, portadas, logos y productos).
- Realtime: `postgres_changes` sobre `messages`, `message_reactions`, `conversation_members`, `conversations` (DELETE = incógnito destruido; filtrado por RLS) y *broadcast* para “escribiendo…”.
- Incógnito: `conversations.incognito` + `expires_at` (3 h desde el último mensaje, trigger `touch_incognito`); `purge_incognito()` borra los caducados (pg_cron `cifra-purge-incognito`, cada 5 min). Las salas incógnito no cuentan para `shares_conversation_with` (no desbloquean teléfono ni estados).

## Pendiente de producción
CAPTCHA/rate limits de Auth, MFA, verificación SMS, copias de seguridad y restauración probadas, auditoría de eventos administrativos, E2EE.
