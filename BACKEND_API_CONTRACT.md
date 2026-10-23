# CIFRA — contrato de identidad y datos

La app usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (la Publishable key puede ir en el cliente; **nunca** la `service_role`).

## Identidad
- Registro/acceso con `supabase.auth` (`signUp`, `signInWithPassword`, sesión persistente; en móvil en `expo-secure-store`).
- Una cuenta por teléfono. En modo beta (`EXPO_PUBLIC_PHONE_VERIFICATION=none`) el cliente usa el alias `p<dígitos E.164>@phone.example.com`; el trigger `create_profile_for_new_user` deriva `profiles.phone` de ese alias en servidor y **rechaza** cualquier alta sin teléfono. En modo `sms` se usa `phone` nativo + `verifyOtp`.
- `profiles.phone` es único; `phone_verified` solo lo cambia el servidor.

## Acceso a datos
- Tablas con RLS; privilegios por columna (`profiles`, `businesses`, `messages`, `conversation_members`).
- Escritura solo vía RPC: `start_direct_chat`, `create_group`, `add_group_members`, `leave_conversation`, `mark_read`, `create_business`, `start_business_chat`, `update_business_conversation`, `add_business_member`, `set_business_member_role`, `remove_business_member`.
- Lectura vía RPC: `list_chats`, `get_profiles`, `find_user_by_phone` (limitada a 40/min), `search_businesses`, `get_business_public`, `list_business_team`.
- Storage: `chat-media` (privado, URL firmadas, acceso por pertenencia a la conversación) y `avatars` (público: fotos de perfil, logos y productos).
- Realtime: `postgres_changes` sobre `messages`, `message_reactions`, `conversation_members` (filtrado por RLS) y *broadcast* para “escribiendo…”.

## Pendiente de producción
CAPTCHA/rate limits de Auth, MFA, verificación SMS, copias de seguridad y restauración probadas, auditoría de eventos administrativos, E2EE.
