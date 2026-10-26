// Automated isolation / security tests for the CIFRA schema.
// Runs both migrations on an embedded Postgres (pglite) with minimal Supabase stubs.
//   npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const migration = (name) => readFileSync(join(dir, '..', 'migrations', name), 'utf8');

const db = new PGlite();

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique, phone text unique,
  raw_user_meta_data jsonb not null default '{}', phone_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
create schema realtime;
create table realtime.sent (payload jsonb, event text, topic text, private boolean);
create table realtime.messages (id serial primary key, topic text, extension text);
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.sent values (payload, event, topic, private) $$;
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated; grant select on realtime.messages to authenticated;
grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

let passed = 0;
let failed = 0;
const ids = {};

async function as(name, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ids[name]}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function fails(promise) { try { await promise; return null; } catch (e) { return e.message; } }

async function check(label, fn) {
  try {
    const ok = await fn();
    if (ok === false) throw new Error('assertion returned false');
    passed++; console.log(`  ✓ ${label}`);
  } catch (e) { failed++; console.log(`  ✗ ${label}\n      ${e.message}`); }
}
const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const denied = async (promise, what) => { const m = await fails(promise); if (!m) throw new Error(`${what} should have been rejected`); };

await db.exec(stubs);
await db.exec(migration('20261021_000001_cifra_foundation.sql').replace(/create extension if not exists pgcrypto;/, ''));
await db.exec(migration('20261022_000002_cifra_messaging.sql'));
// idempotency: the migrations must be safely re-runnable
await db.exec(migration('20261022_000002_cifra_messaging.sql'));
await db.exec(migration('20261022_000003_phone_alias_identity.sql'));
await db.exec(migration('20261022_000003_phone_alias_identity.sql'));
await db.exec(migration('20261023_000005_voice_and_calls.sql'));
await db.exec(migration('20261023_000005_voice_and_calls.sql'));
await db.exec(migration('20261024_000006_organize_schedule_username.sql'));
await db.exec(migration('20261024_000006_organize_schedule_username.sql'));
await db.exec(migration('20261025_000007_reserved_usernames.sql'));
await db.exec(migration('20261025_000007_reserved_usernames.sql'));
await db.exec(migration('20261026_000008_crm_agenda_profiles.sql'));
await db.exec(migration('20261026_000008_crm_agenda_profiles.sql'));
await db.exec(migration('20261027_000009_social_incognito_covers.sql'));
await db.exec(migration('20261027_000009_social_incognito_covers.sql'));
await db.exec(migration('20261028_000010_delivery_receipts.sql'));
await db.exec(migration('20261028_000010_delivery_receipts.sql'));
await db.exec(migration('20261029_000011_greeting_push.sql'));
await db.exec(migration('20261029_000011_greeting_push.sql'));
await db.exec(migration('20261030_000012_push_prefs.sql'));
await db.exec(migration('20261030_000012_push_prefs.sql'));
await db.exec(migration('20261031_000013_appointment_reminders.sql'));
await db.exec(migration('20261031_000013_appointment_reminders.sql'));
await db.exec(migration('20261101_000014_account_recovery.sql'));
await db.exec(migration('20261101_000014_account_recovery.sql'));

const phones = { ana: '34600000001', ben: '34600000002', cleo: '34600000003', dani: '34600000004' };
for (const [name, phone] of Object.entries(phones)) {
  const [{ id }] = await q(`insert into auth.users (phone, raw_user_meta_data, phone_confirmed_at) values ($1, $2, now()) returning id`, [phone, JSON.stringify({ display_name: name })]);
  ids[name] = id;
}

console.log('\nIdentidad por teléfono');
await check('el perfil se crea con el teléfono en formato E.164', async () => {
  eq((await q(`select phone from public.profiles where id = $1`, [ids.ana]))[0].phone, '+34600000001');
});
await check('un segundo registro con el mismo teléfono es rechazado', async () => {
  await denied(db.query(`insert into auth.users (phone) values ('34600000001')`), 'duplicate phone');
});
await check('el perfil no admite el mismo teléfono dos veces (defensa en profundidad)', async () => {
  const [{ id }] = await q(`insert into auth.users (email, raw_user_meta_data) values ('p34633333333@phone.example.com', '{}') returning id`);
  await denied(db.query(`update public.profiles set phone = '+34600000001' where id = $1`, [id]), 'profile dup phone');
});
await check('un usuario no puede marcarse como verificado ni cambiar su teléfono', async () => {
  await as('ana', async () => {
    await denied(db.query(`update public.profiles set phone_verified = true where id = auth.uid()`), 'phone_verified');
    await denied(db.query(`update public.profiles set phone = '+34999999999' where id = auth.uid()`), 'phone');
    await db.query(`update public.profiles set display_name = 'Ana María' where id = auth.uid()`);
  });
});

console.log('\nIdentidad por alias (sin SMS)');
await check('un alta con alias de teléfono crea el perfil con el número derivado del servidor', async () => {
  const [{ id }] = await q(`insert into auth.users (email, raw_user_meta_data) values ('p34611111111@phone.example.com', $1) returning id`, [JSON.stringify({ display_name: 'Alias', phone_e164: '+34999999999' })]);
  const [p] = await q(`select phone, phone_verified from public.profiles where id = $1`, [id]);
  eq(p, { phone: '+34611111111', phone_verified: false }); // metadata claim '+34999999999' is ignored
});
await check('el mismo número no puede registrarse dos veces por alias', async () => {
  await denied(db.query(`insert into auth.users (email) values ('p34611111111@phone.example.com')`), 'duplicate alias');
});
await check('no se admite una alta sin teléfono (correo normal) ni alias de otro dominio', async () => {
  await denied(db.query(`insert into auth.users (email) values ('persona@gmail.com')`), 'plain email');
  await denied(db.query(`insert into auth.users (email) values ('p34622222222@evil.example.org')`), 'foreign alias domain');
});

console.log('\nAislamiento de perfiles');
await check('solo ve su propio perfil en la tabla', async () => {
  await as('ana', async () => eq((await q(`select id from public.profiles`)).length, 1));
});
await check('buscar por teléfono encuentra a la persona exacta (con o sin formato)', async () => {
  await as('ana', async () => eq((await q(`select id from public.find_user_by_phone('+34 600-000-002')`))[0].id, ids.ben));
});
await check('un perfil no descubrible no aparece en la búsqueda', async () => {
  await as('dani', () => db.query(`update public.profiles set discoverable = false where id = auth.uid()`));
  await as('ana', async () => eq((await q(`select id from public.find_user_by_phone('+34600000004')`)).length, 0));
});
await check('la búsqueda por teléfono tiene límite de frecuencia', async () => {
  await as('cleo', async () => {
    let err = null;
    for (let i = 0; i < 45 && !err; i++) err = await fails(db.query(`select * from public.find_user_by_phone('+34111111111')`));
    if (!err || !/rate_limited/.test(err)) throw new Error('expected rate_limited, got ' + err);
  });
  await db.exec(`delete from public.rate_events`);
});

console.log('\nChats 1:1');
let direct;
await check('start_direct_chat crea una sola conversación para el par, desde ambos lados', async () => {
  direct = await as('ana', async () => (await q(`select public.start_direct_chat($1) as id`, [ids.ben]))[0].id);
  const again = await as('ana', async () => (await q(`select public.start_direct_chat($1) as id`, [ids.ben]))[0].id);
  const fromBen = await as('ben', async () => (await q(`select public.start_direct_chat($1) as id`, [ids.ana]))[0].id);
  eq([again, fromBen], [direct, direct]);
});
await check('no puede abrir un chat consigo mismo', async () => {
  await as('ana', async () => denied(db.query(`select public.start_direct_chat($1)`, [ids.ana]), 'self chat'));
});
await check('Ana envía y Ben lee; Cleo (ajena) no ve nada y no puede escribir', async () => {
  await as('ana', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hola Ben')`, [direct, ids.ana]));
  await as('ben', async () => eq((await q(`select body from public.messages where conversation_id = $1`, [direct])).map((r) => r.body), ['hola Ben']));
  await as('cleo', async () => {
    eq((await q(`select * from public.messages`)).length, 0);
    eq((await q(`select * from public.conversations`)).length, 0);
    eq((await q(`select * from public.conversation_members`)).length, 0);
    await denied(db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'intruso')`, [direct, ids.cleo]), 'outsider insert');
  });
});
await check('no se puede suplantar al remitente', async () => {
  await as('ana', async () => denied(db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'soy Ben')`, [direct, ids.ben]), 'spoof'));
});
await check('no se puede mover un mensaje a otra conversación ni editar el de otro', async () => {
  await as('ana', async () => denied(db.query(`update public.messages set conversation_id = gen_random_uuid() where sender_id = auth.uid()`), 'move message'));
  await as('ben', async () => {
    await db.query(`update public.messages set body = 'editado por Ben' where conversation_id = $1`, [direct]);
    eq((await q(`select body from public.messages where conversation_id = $1`, [direct]))[0].body, 'hola Ben');
  });
});
await check('no leídos y lectura: Ben ve 1, tras mark_read ve 0 y Ana ve el visto', async () => {
  await as('ben', async () => eq((await q(`select unread from public.list_chats() where id = $1`, [direct]))[0].unread, 1));
  await as('ben', () => db.query(`select public.mark_read($1)`, [direct]));
  await as('ben', async () => eq((await q(`select unread from public.list_chats() where id = $1`, [direct]))[0].unread, 0));
  await as('ana', async () => {
    const [{ last_read_at }] = await q(`select last_read_at from public.conversation_members where conversation_id = $1 and user_id = $2`, [direct, ids.ben]);
    if (!last_read_at) throw new Error('Ana should see Ben read state');
  });
});
await check('list_chats muestra el nombre del otro participante', async () => {
  await as('ana', async () => eq((await q(`select peer_name from public.list_chats() where id = $1`, [direct]))[0].peer_name, 'ben'));
});
await check('borrar un mensaje elimina su contenido y no se puede deshacer', async () => {
  await as('ana', async () => {
    const [{ id }] = await q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'secreto') returning id`, [direct, ids.ana]);
    await db.query(`update public.messages set deleted_at = now() where id = $1`, [id]);
    const [row] = await q(`select body, deleted_at from public.messages where id = $1`, [id]);
    if (row.body !== null || !row.deleted_at) throw new Error('body should be wiped');
    await db.query(`update public.messages set deleted_at = null, body = 'volvió' where id = $1`, [id]);
    eq((await q(`select body from public.messages where id = $1`, [id]))[0].body, null);
  });
});
await check('get_profiles solo devuelve personas con las que compartes chat', async () => {
  await as('ana', async () => eq((await q(`select id from public.get_profiles($1)`, [[ids.ben, ids.cleo]])).map((r) => r.id), [ids.ben]));
});
await check('el bloqueo impide escribir en ambos sentidos', async () => {
  await as('ben', () => db.query(`insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)`, [ids.ben, ids.ana]));
  await as('ana', async () => denied(db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'x')`, [direct, ids.ana]), 'blocked send'));
  await as('ben', async () => denied(db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'x')`, [direct, ids.ben]), 'blocker send'));
  await as('ben', () => db.query(`delete from public.user_blocks`));
  await as('ana', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'de vuelta')`, [direct, ids.ana]));
});
await check('las reacciones requieren acceso a la conversación', async () => {
  const [{ id }] = await q(`select id from public.messages where conversation_id = $1 limit 1`, [direct]);
  await as('ben', () => db.query(`insert into public.message_reactions (message_id, user_id, emoji) values ($1, $2, '👍')`, [id, ids.ben]));
  await as('cleo', async () => {
    eq((await q(`select * from public.message_reactions`)).length, 0);
    await denied(db.query(`insert into public.message_reactions (message_id, user_id, emoji) values ($1, $2, '👎')`, [id, ids.cleo]), 'outsider reaction');
  });
});

console.log('\nGrupos');
let group;
await check('crear grupo, los miembros ven mensajes y los ajenos no', async () => {
  group = await as('ana', async () => (await q(`select public.create_group('Equipo', $1) as id`, [[ids.ben, ids.cleo]]))[0].id);
  await as('ana', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'bienvenidos')`, [group, ids.ana]));
  await as('cleo', async () => eq((await q(`select body from public.messages where conversation_id = $1`, [group])).length, 1));
  await as('dani', async () => eq((await q(`select * from public.messages where conversation_id = $1`, [group])).length, 0));
});
await check('un miembro no admin no puede añadir gente; salir del grupo corta el acceso', async () => {
  await as('ben', async () => denied(db.query(`select public.add_group_members($1, $2)`, [group, [ids.dani]]), 'non-admin add'));
  await as('cleo', () => db.query(`select public.leave_conversation($1)`, [group]));
  await as('cleo', async () => eq((await q(`select * from public.messages where conversation_id = $1`, [group])).length, 0));
});
await check('un usuario no puede auto-añadirse a un grupo ajeno vía conversation_members', async () => {
  await as('dani', async () => denied(db.query(`insert into public.conversation_members (conversation_id, user_id) values ($1, $2)`, [group, ids.dani]), 'self join'));
  await as('ben', async () => denied(db.query(`update public.conversation_members set conversation_id = $1 where user_id = auth.uid()`, [group]), 'move membership'));
});

console.log('\nNegocio');
let biz, bizChat;
await check('crear negocio asigna al creador como propietario', async () => {
  biz = await as('ana', async () => (await q(`select public.create_business('Café Aurora', 'cafe-aurora', 'Cafetería', 'Café de especialidad', '+34600000001') as id`))[0].id);
  eq((await q(`select role from public.business_members where business_id = $1 and user_id = $2`, [biz, ids.ana]))[0].role, 'owner');
});
await check('el handle del negocio es único', async () => {
  await as('ben', async () => denied(db.query(`select public.create_business('Otro', 'cafe-aurora', null, null, null)`), 'dup handle'));
});
await check('los negocios son invisibles para quien no es del equipo, pero se encuentran públicamente', async () => {
  await as('ben', async () => {
    eq((await q(`select * from public.businesses`)).length, 0);
    eq((await q(`select name from public.search_businesses('aurora')`))[0].name, 'Café Aurora');
    eq((await q(`select public.get_business_public($1) ->> 'name' as n`, [biz]))[0].n, 'Café Aurora');
  });
});
await check('un miembro no puede cambiar el propietario ni insertarse como owner', async () => {
  await as('ana', () => db.query(`select public.add_business_member($1, '+34 600 000 003', 'agent')`, [biz]));
  await as('cleo', async () => {
    await denied(db.query(`update public.businesses set owner_id = auth.uid() where id = $1`, [biz]), 'owner change');
    await denied(db.query(`insert into public.business_members (business_id, user_id, role) values ($1, auth.uid(), 'owner')`, [biz]), 'direct insert');
    await denied(db.query(`select public.add_business_member($1, '+34600000004', 'agent')`, [biz]), 'agent adding');
    await denied(db.query(`select public.set_business_member_role($1, $2, 'owner')`, [biz, ids.cleo]), 'self promote');
  });
  await as('ben', async () => denied(db.query(`select public.add_business_member($1, '+34600000004', 'agent')`, [biz]), 'outsider adding'));
});
await check('solo los gestores pueden cambiar el logo del negocio y las fotos públicas', async () => {
  const can = async (who, name) => as(who, async () => (await q(`select public.avatar_can_write($1) as ok`, [name]))[0].ok);
  eq(await can('ana', `business/${biz}/logo.png`), true);
  eq(await can('cleo', `business/${biz}/logo.png`), false); // agent
  eq(await can('ben', `business/${biz}/logo.png`), false);
  eq(await can('ana', `${ids.ana}/avatar.png`), true);
  eq(await can('ben', `${ids.ana}/avatar.png`), false);
  await as('ana', () => db.query(`update public.businesses set logo_path = 'business/x/logo.png' where id = $1`, [biz]));
  await as('cleo', () => db.query(`update public.businesses set logo_path = 'evil' where id = $1`, [biz]));
  eq((await q(`select logo_path from public.businesses where id = $1`, [biz]))[0].logo_path, 'business/x/logo.png');
  await as('ben', async () => eq((await q(`select public.get_business_public($1) ->> 'logo_path' as l`, [biz]))[0].l, 'business/x/logo.png'));
});
await check('el propietario no puede ser eliminado ni degradado', async () => {
  await as('ana', async () => denied(db.query(`select public.remove_business_member($1, $2)`, [biz, ids.ana]), 'remove owner'));
  await as('ana', async () => denied(db.query(`select public.set_business_member_role($1, $2, 'viewer')`, [biz, ids.ana]), 'demote owner'));
});
await check('un cliente abre conversación con el negocio y recibe el saludo automático', async () => {
  await as('ana', () => db.query(`update public.businesses set greeting = '¡Hola! ¿En qué podemos ayudarte?' where id = $1`, [biz]));
  bizChat = await as('ben', async () => (await q(`select public.start_business_chat($1) as id`, [biz]))[0].id);
  await as('ben', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Hola, ¿abren hoy?')`, [bizChat, ids.ben]));
  await as('ben', async () => eq((await q(`select is_automated from public.messages where conversation_id = $1 order by created_at, is_automated`, [bizChat])).length, 2));
});
await check('el equipo ve la bandeja del negocio sin ser miembro de la conversación', async () => {
  await as('cleo', async () => {
    const rows = await q(`select peer_name, perspective, unread from public.list_chats($1)`, [biz]);
    eq(rows.length, 1); eq(rows[0].perspective, 'agent'); eq(rows[0].peer_name, 'ben'); eq(rows[0].unread, 1);
    eq((await q(`select * from public.list_chats()`)).length, 0); // not in their personal list
  });
});
await check('el cliente ve el negocio como contacto en su lista personal', async () => {
  await as('ben', async () => {
    const rows = await q(`select peer_name, perspective from public.list_chats() where id = $1`, [bizChat]);
    eq(rows[0], { peer_name: 'Café Aurora', perspective: 'personal' });
  });
});
await check('las notas internas nunca llegan al cliente', async () => {
  await as('cleo', async () => {
    await db.query(`select public.mark_read($1)`, [bizChat]);
    await db.query(`insert into public.messages (conversation_id, sender_id, body, is_internal) values ($1, $2, 'cliente VIP', true)`, [bizChat, ids.cleo]);
    await db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Sí, abrimos hasta las 20h')`, [bizChat, ids.cleo]);
    eq((await q(`select body from public.messages where conversation_id = $1 and is_internal`, [bizChat])).length, 1);
  });
  await as('ben', async () => {
    eq((await q(`select * from public.messages where conversation_id = $1 and is_internal`, [bizChat])).length, 0);
    await denied(db.query(`insert into public.messages (conversation_id, sender_id, body, is_internal) values ($1, $2, 'nota', true)`, [bizChat, ids.ben]), 'customer internal note');
    const last = (await q(`select last_body from public.list_chats() where id = $1`, [bizChat]))[0].last_body;
    if (last === 'cliente VIP') throw new Error('internal note leaked via list_chats');
  });
});
await check('un cliente no puede fingir mensajes automáticos', async () => {
  await as('ben', async () => denied(db.query(`insert into public.messages (conversation_id, sender_id, body, is_automated) values ($1, $2, 'x', true)`, [bizChat, ids.ben]), 'automated'));
});
await check('solo el equipo cambia estado/asignación; resolver y reabrir al escribir el cliente', async () => {
  await as('ben', async () => denied(db.query(`select public.update_business_conversation($1, 'resolved')`, [bizChat]), 'customer resolving'));
  await as('cleo', () => db.query(`select public.update_business_conversation($1, 'resolved', $2)`, [bizChat, ids.cleo]));
  eq((await q(`select state, assigned_to from public.conversations where id = $1`, [bizChat]))[0], { state: 'resolved', assigned_to: ids.cleo });
  await as('ben', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'una duda más')`, [bizChat, ids.ben]));
  eq((await q(`select state from public.conversations where id = $1`, [bizChat]))[0].state, 'open');
});
await check('ajenos al negocio no ven la conversación ni la bandeja', async () => {
  await as('dani', async () => {
    eq((await q(`select * from public.messages where conversation_id = $1`, [bizChat])).length, 0);
    await denied(db.query(`select * from public.list_chats($1)`, [biz]), 'inbox of foreign business');
  });
});
await check('no se puede chatear con el propio negocio como cliente', async () => {
  await as('ana', async () => denied(db.query(`select public.start_business_chat($1)`, [biz]), 'own business chat'));
});
await check('el catálogo publicado es público y el borrador no', async () => {
  await as('ana', async () => {
    await db.query(`insert into public.catalog_items (business_id, name, price_minor, currency, is_published) values ($1, 'Flat white', 350, 'EUR', true), ($1, 'Borrador', 100, 'EUR', false)`, [biz]);
  });
  await as('ben', async () => {
    eq((await q(`select jsonb_array_length(public.get_business_public($1) -> 'catalog') as n`, [biz]))[0].n, 1);
    eq((await q(`select name from public.catalog_items`)).map((r) => r.name), ['Flat white']);
  });
  await as('dani', async () => denied(db.query(`insert into public.catalog_items (business_id, name) values ($1, 'x')`, [biz]), 'outsider catalog write'));
});
await check('respuestas rápidas: lectura para el equipo, escritura para gestores', async () => {
  await as('ana', () => db.query(`insert into public.quick_replies (business_id, shortcut, body) values ($1, 'horario', 'Abrimos de 8 a 20h')`, [biz]));
  await as('cleo', async () => {
    eq((await q(`select shortcut from public.quick_replies`)).length, 1);
    await denied(db.query(`insert into public.quick_replies (business_id, shortcut, body) values ($1, 'x', 'y')`, [biz]), 'agent writes quick reply');
  });
  await as('ben', async () => eq((await q(`select * from public.quick_replies`)).length, 0));
});

console.log('\nEstados (24 h) y archivos');
await check('los estados solo los ven tus contactos de chat', async () => {
  await as('ana', () => db.query(`insert into public.statuses (user_id, kind, body) values ($1, 'text', 'Hola mundo')`, [ids.ana]));
  await as('ben', async () => eq((await q(`select body from public.statuses`)).length, 1));
  await as('cleo', async () => eq((await q(`select body from public.statuses`)).length, 0));
});
await check('un estado caducado deja de verse', async () => {
  await db.query(`update public.statuses set expires_at = now() - interval '1 minute'`);
  await as('ben', async () => eq((await q(`select * from public.statuses`)).length, 0));
});
await check('las reglas de almacenamiento respetan la pertenencia a la conversación', async () => {
  const can = async (who, fn, name) => as(who, async () => (await q(`select public.${fn}($1) as ok`, [name]))[0].ok);
  eq(await can('ben', 'storage_can_read', `${direct}/a.png`), true);
  eq(await can('cleo', 'storage_can_read', `${direct}/a.png`), false);
  eq(await can('cleo', 'storage_can_write', `${direct}/a.png`), false);
  eq(await can('ana', 'storage_can_write', `${direct}/a.png`), true);
  eq(await can('ben', 'storage_can_read', `status/${ids.ana}/s.png`), true);
  eq(await can('cleo', 'storage_can_read', `status/${ids.ana}/s.png`), false);
  eq(await can('ben', 'storage_can_write', `status/${ids.ana}/s.png`), false);
  eq(await can('ben', 'storage_can_read', `not-a-uuid/x.png`), false);
  eq(await can('cleo', 'storage_can_read', `${bizChat}/f.png`), true); // agent of that business
  eq(await can('dani', 'storage_can_read', `${bizChat}/f.png`), false);
});
await check('las funciones internas no son invocables por usuarios anónimos', async () => {
  await db.exec(`set role anon`);
  const m = await fails(db.query(`select * from public.find_user_by_phone('+34600000001')`));
  await db.exec(`reset role`);
  if (!m) throw new Error('anon could call RPC');
});

console.log('\nVoz y llamadas');
await check('un audio guarda su duración y no admite duraciones absurdas', async () => {
  await as('ana', async () => {
    await db.query(`insert into public.messages (conversation_id, sender_id, attachment_path, attachment_type, attachment_duration_ms) values ($1, $2, 'x/voz.wav', 'audio/wav', 4200)`, [direct, ids.ana]);
    await denied(db.query(`insert into public.messages (conversation_id, sender_id, attachment_path, attachment_type, attachment_duration_ms) values ($1, $2, 'x/v.wav', 'audio/wav', 99999999)`, [direct, ids.ana]), 'huge duration');
  });
});
await check('Ana puede llamar a Ben (tienen chat); la señal llega a SU canal con el remitente estampado por el servidor', async () => {
  await db.query(`delete from realtime.sent`);
  await as('ana', async () => {
    await db.query(`select public.send_call_signal($1, 'invite', $2::jsonb)`, [ids.ben, JSON.stringify({ callId: 'c1', kind: 'audio', from: ids.cleo })]);
  });
  const [row] = await q(`select payload, topic, private from realtime.sent`);
  eq([row.topic, row.private, row.payload.from], ['call:' + ids.ben, true, ids.ana]); // spoofed "from" overwritten
});
await check('Ana NO puede señalizar a quien no conoce (Dani), ni a sí misma, ni con eventos inventados', async () => {
  await as('ana', async () => {
    await denied(db.query(`select public.send_call_signal($1, 'invite', '{}')`, [ids.dani]), 'stranger');
    await denied(db.query(`select public.send_call_signal($1, 'invite', '{}')`, [ids.ana]), 'self');
    await denied(db.query(`select public.send_call_signal($1, 'hack', '{}')`, [ids.ben]), 'event');
  });
});
await check('un bloqueo corta las llamadas en ambos sentidos', async () => {
  await as('ben', () => db.query(`insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)`, [ids.ben, ids.ana]));
  await as('ana', async () => denied(db.query(`select public.send_call_signal($1, 'invite', '{}')`, [ids.ben]), 'blocked caller'));
  await as('ben', async () => denied(db.query(`select public.send_call_signal($1, 'invite', '{}')`, [ids.ana]), 'blocker caller'));
  await as('ben', () => db.query(`delete from public.user_blocks`));
});
await check('solo se puede escuchar el propio canal de llamadas', async () => {
  const can = async (who, topic) => as(who, async () => (await q(`select public.can_receive_call_topic($1) as ok`, [topic]))[0].ok);
  eq(await can('ben', 'call:' + ids.ben), true);
  eq(await can('ben', 'call:' + ids.ana), false);
  eq(await can('ana', 'call:otro'), false);
});

console.log('\nOrganización, @usuario, programados, destacados, búsqueda');
await check('@usuario: se encuentra a alguien sin saber su teléfono; con hide_phone no se le ve el número', async () => {
  await as('ben', () => db.query(`update public.profiles set username = 'ben_cifra', hide_phone = true where id = auth.uid()`));
  await as('dani', async () => {
    const [r] = await q(`select id, phone from public.find_user_by_username('@Ben_Cifra')`);
    eq([r.id, r.phone], [ids.ben, null]);
    eq((await q(`select id from public.find_user_by_username('nadie_existe')`)).length, 0);
  });
  await as('ana', async () => {
    eq((await q(`select phone from public.get_profiles($1)`, [[ids.ben]]))[0].phone, null);
    eq((await q(`select peer_phone from public.list_chats() where id = $1`, [direct]))[0].peer_phone, null);
  });
});
await check('no se puede cambiar el username a otro formato ni hacerse con el de otra persona', async () => {
  await as('cleo', async () => {
    await denied(db.query(`update public.profiles set username = 'ben_cifra' where id = auth.uid()`), 'dup username');
    await denied(db.query(`update public.profiles set username = 'x' where id = auth.uid()`), 'bad username');
  });
});
await check('fijar, archivar y marcar como no leído; fijados primero; mark_read limpia la marca', async () => {
  await as('ana', async () => {
    await db.query(`select public.set_chat_flags($1, true, null, true)`, [direct]);
    const [r] = await q(`select pinned_at is not null as pinned, marked_unread from public.list_chats() where id = $1`, [direct]);
    eq(r, { pinned: true, marked_unread: true });
    eq((await q(`select id from public.list_chats()`))[0].id, direct);
    await db.query(`select public.mark_read($1)`, [direct]);
    eq((await q(`select marked_unread from public.list_chats() where id = $1`, [direct]))[0].marked_unread, false);
    await db.query(`select public.set_chat_flags($1, false, true)`, [direct]);
    eq((await q(`select archived, pinned_at from public.list_chats() where id = $1`, [direct]))[0], { archived: true, pinned_at: null });
    await db.query(`select public.set_chat_flags($1, null, false)`, [direct]);
  });
});
await check('nadie puede fijar/archivar chats ajenos ni tocar las banderas de otros', async () => {
  await as('cleo', async () => denied(db.query(`select public.set_chat_flags($1, true)`, [direct]), 'foreign chat'));
  await as('ana', async () => {
    await db.query(`update public.conversation_members set archived = true where user_id = auth.uid()`);
    await denied(db.query(`update public.conversation_members set conversation_id = conversation_id where user_id = auth.uid()`), 'column grant');
    await db.query(`update public.conversation_members set archived = false where user_id = auth.uid()`);
  });
});
let starMsg;
await check('destacar mensajes: solo los propios y solo de chats a los que tienes acceso', async () => {
  starMsg = (await q(`select id from public.messages where conversation_id = $1 and body = 'hola Ben'`, [direct]))[0].id;
  await as('ben', () => db.query(`insert into public.starred_messages (user_id, message_id) values ($1, $2)`, [ids.ben, starMsg]));
  await as('ben', async () => eq((await q(`select * from public.starred_messages`)).length, 1));
  await as('ana', async () => eq((await q(`select * from public.starred_messages`)).length, 0));
  await as('cleo', async () => denied(db.query(`insert into public.starred_messages (user_id, message_id) values ($1, $2)`, [ids.cleo, starMsg]), 'outsider star'));
  await as('ana', async () => denied(db.query(`insert into public.starred_messages (user_id, message_id) values ($1, $2)`, [ids.ben, starMsg]), 'star as someone else'));
});
await check('mensajes programados: se envían al vencer, como su autor; bloqueados o ajenos no se envían', async () => {
  const future = new Date(Date.now() + 3600e3).toISOString();
  await as('ana', async () => {
    await db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'te escribo luego', $3)`, [direct, ids.ana, future]);
    await denied(db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'x', $3)`, [direct, ids.ben, future]), 'as someone else');
    await denied(db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'x', now() + interval '40 days')`, [direct, ids.ana]), 'too far');
  });
  await as('cleo', async () => denied(db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'x', $3)`, [direct, ids.cleo, future]), 'outsider schedule'));
  await as('ben', async () => eq((await q(`select * from public.scheduled_messages`)).length, 0)); // others cannot see it
  await db.query(`update public.scheduled_messages set send_at = now() - interval '1 second'`);
  eq((await q(`select public.dispatch_scheduled_messages() as n`))[0].n, 1);
  await as('ben', async () => eq((await q(`select sender_id from public.messages where body = 'te escribo luego'`))[0].sender_id, ids.ana));
  // blocked sender: dropped, not delivered
  await as('ana', () => db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'bloqueado', now() + interval '1 hour')`, [direct, ids.ana]));
  await as('ben', () => db.query(`insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)`, [ids.ben, ids.ana]));
  await db.query(`update public.scheduled_messages set send_at = now() - interval '1 second'`);
  await q(`select public.dispatch_scheduled_messages()`);
  eq((await q(`select * from public.messages where body = 'bloqueado'`)).length, 0);
  await as('ben', () => db.query(`delete from public.user_blocks`));
});
await check('programar y cancelar: el autor puede cancelar el suyo; los demás no', async () => {
  const future = new Date(Date.now() + 7200e3).toISOString();
  await as('ana', () => db.query(`insert into public.scheduled_messages (conversation_id, sender_id, body, send_at) values ($1, $2, 'cancelar', $3)`, [direct, ids.ana, future]));
  await as('ben', async () => { await db.query(`delete from public.scheduled_messages`); });
  eq((await q(`select * from public.scheduled_messages`)).length, 1);
  await as('ana', () => db.query(`delete from public.scheduled_messages`));
  eq((await q(`select * from public.scheduled_messages`)).length, 0);
});
await check('búsqueda de mensajes: solo en tus chats, sin comodines y sin notas internas ajenas', async () => {
  await as('ben', async () => {
    eq((await q(`select body from public.search_messages('hola Ben')`)).length > 0, true);
    eq((await q(`select * from public.search_messages('%')`)).length, 0);
  });
  await as('cleo', async () => {
    const hits = await q(`select body from public.search_messages('hola')`);
    if (hits.some((r) => r.body === 'hola Ben')) throw new Error('outsider found private message');
  });
  await as('ben', async () => { // internal notes of the business must never come up for the customer
    const hits = await q(`select body from public.search_messages('clienta habitual')`);
    eq(hits.length, 0);
  });
});
await check('usernames reservados: nadie puede registrar @maestro ni nombres oficiales, los demás sí', async () => {
  for (const name of ['maestro', 'Maestro', 'cifra', 'soporte']) {
    await as('ana', async () => {
      const err = await fails(db.query(`update public.profiles set username = $1 where id = $2`, [name, ids.ana]));
      if (!err || !/username_reserved/.test(err)) throw new Error(`"${name}" should be reserved, got: ${err}`);
    });
  }
  await as('ana', () => db.query(`update public.profiles set username = 'ana_ok' where id = $1`, [ids.ana]));
  eq((await q(`select username from public.profiles where id = $1`, [ids.ana]))[0].username, 'ana_ok');
  await as('ana', () => db.query(`update public.profiles set username = null where id = $1`, [ids.ana]));
});
await check('límite del asistente IA: 40 consultas por hora y usuario, y solo para sesiones iniciadas', async () => {
  await db.query(`delete from public.rate_events where bucket = 'assistant'`);
  await as('ana', async () => { for (let i = 0; i < 40; i++) await db.query(`select public.check_assistant_rate()`); });
  await as('ana', async () => {
    const err = await fails(db.query(`select public.check_assistant_rate()`));
    if (!err || !/rate_limited/.test(err)) throw new Error(`41st call should be limited, got: ${err}`);
  });
  await as('ben', async () => { await db.query(`select public.check_assistant_rate()`); }); // someone else is unaffected
  await db.exec(`reset role; set role anon;`);
  try { const err = await fails(db.query(`select public.check_assistant_rate()`)); if (!err) throw new Error('anon must not call it'); } finally { await db.exec('reset role'); }
});

console.log('\nCRM, agenda y perfiles (v8)');
let custBen, apptId;
await check('get_profiles incluye @username y fecha de alta; el teléfono oculto sigue oculto', async () => {
  await as('ben', () => db.query(`update public.profiles set username = 'ben_cli', hide_phone = true where id = $1`, [ids.ben]));
  await as('ana', async () => {
    const r = (await q(`select * from public.get_profiles($1)`, [[ids.ben]]))[0];
    eq(r.username, 'ben_cli'); eq(r.phone, null); eq(!!r.created_at, true);
  });
  await as('ben', () => db.query(`update public.profiles set hide_phone = false where id = $1`, [ids.ben]));
});
await check('teléfono del negocio: oculto al público salvo que el dueño lo active', async () => {
  await as('ben', async () => eq((await q(`select public.get_business_public($1) ->> 'phone' as p`, [biz]))[0].p, null));
  await as('ana', async () => eq((await q(`select public.get_business_public($1) ->> 'phone' as p`, [biz]))[0].p, '+34600000001')); // el equipo sí lo ve
  await as('ana', () => db.query(`update public.businesses set show_phone = true where id = $1`, [biz]));
  await as('ben', async () => eq((await q(`select public.get_business_public($1) ->> 'phone' as p`, [biz]))[0].p, '+34600000001'));
  await as('ben', async () => { await db.query(`update public.businesses set show_phone = false where id = $1`, [biz]); }); // RLS: touches 0 rows
  eq((await q(`select show_phone from public.businesses where id = $1`, [biz]))[0].show_phone, true);
  await as('ana', () => db.query(`update public.businesses set show_phone = false where id = $1`, [biz]));
});
await check('crm_sync convierte a quien escribió al negocio en cliente; solo el equipo lo ve', async () => {
  await as('ben', async () => { const c = (await q(`select public.start_business_chat($1) as id`, [biz]))[0].id; await db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hola, quiero cita')`, [c, ids.ben]); });
  await as('cleo', async () => { eq((await q(`select public.crm_sync($1) as n`, [biz]))[0].n >= 1, true); });
  await as('cleo', async () => { const rows = await q(`select id, name, phone, stage from public.customers where business_id = $1`, [biz]); custBen = rows.find((r) => r.name.length)?.id; eq(rows.length >= 1, true); eq(rows[0].stage, 'lead'); });
  await as('ben', async () => { eq((await q(`select * from public.customers`)).length, 0); await denied(db.query(`select public.crm_sync($1)`, [biz]), 'outsider sync'); });
  await as('dani', async () => eq((await q(`select * from public.customers`)).length, 0));
});
await check('clientes: agentes editan; no se puede enlazar user_id a mano ni tocar otro negocio', async () => {
  await as('cleo', async () => {
    await db.query(`update public.customers set stage = 'proposal', tags = '{vip}', notes = 'prefiere tardes' where id = $1`, [custBen]);
    eq((await q(`select stage from public.customers where id = $1`, [custBen]))[0].stage, 'proposal');
    await denied(db.query(`update public.customers set user_id = $1 where id = $2`, [ids.dani, custBen]), 'relink user');
    await denied(db.query(`insert into public.customers (business_id, user_id, name) values ($1, $2, 'x')`, [biz, ids.dani]), 'insert with user_id');
    await db.query(`insert into public.customers (business_id, name, phone) values ($1, 'Cliente manual', '600111222')`, [biz]);
    await denied(db.query(`update public.customers set stage = 'imaginary' where id = $1`, [custBen]), 'bad stage');
  });
  await as('ben', async () => { await db.query(`update public.customers set stage = 'won' where id = $1`, [custBen]); eq((await q(`select stage from public.customers`)).length, 0); });
  eq((await q(`select stage from public.customers where id = $1`, [custBen]))[0].stage, 'proposal');
});
await check('tareas del CRM: el equipo las gestiona, los de fuera no las ven', async () => {
  await as('cleo', async () => {
    await db.query(`insert into public.crm_tasks (business_id, customer_id, title, due_at) values ($1, $2, 'Llamar a Ben', now() + interval '1 day')`, [biz, custBen]);
    await db.query(`update public.crm_tasks set done = true, done_at = now()`);
  });
  await as('ben', async () => eq((await q(`select * from public.crm_tasks`)).length, 0));
  await as('cleo', async () => denied(db.query(`insert into public.crm_tasks (business_id, customer_id, title) values ($1, $2, 'x')`, [ids.cleo === ids.ben ? biz : '00000000-0000-0000-0000-000000000000', custBen]), 'foreign business'));
});
await check('agenda: el equipo crea citas, el cliente recibe la tarjeta en su chat y puede confirmar/cancelar', async () => {
  const start = new Date(Date.now() + 86400e3).toISOString(); const end = new Date(Date.now() + 86400e3 + 1800e3).toISOString();
  apptId = await as('cleo', async () => (await q(`select public.create_appointment($1, $2, 'Corte de pelo', $3, $4, 'primera vez', $5) as id`, [biz, custBen, start, end, ids.cleo]))[0].id);
  await as('ben', async () => {
    eq((await q(`select * from public.my_appointments()`)).length, 1);
    const card = await q(`select body from public.messages where body like '📅%' order by created_at desc limit 1`); eq(/Invitación a cita/.test(card[0].body), true);
    await db.query(`select public.respond_appointment($1, 'confirmed')`, [apptId]);
    eq((await q(`select status from public.appointments where id = $1`, [apptId]))[0].status, 'confirmed');
    await denied(db.query(`update public.appointments set status = 'done' where id = $1`, [apptId]), 'customer direct update');
    await denied(db.query(`select public.update_appointment($1, 'done')`, [apptId]), 'customer team action');
  });
  await as('cleo', async () => denied(db.query(`select public.create_appointment($1, $2, 'Choque', $3, $4, null, $5)`, [biz, custBen, start, end, ids.cleo]), 'overlap'));
  await as('dani', async () => { eq((await q(`select * from public.appointments`)).length, 0); eq((await q(`select * from public.my_appointments()`)).length, 0); await denied(db.query(`select public.respond_appointment($1, 'cancelled')`, [apptId]), 'stranger'); });
  await as('cleo', async () => { await db.query(`select public.update_appointment($1, null, $2)`, [apptId, new Date(Date.now() + 2 * 86400e3).toISOString()]); });
  await as('ben', async () => eq(/reprogramada/.test((await q(`select body from public.messages where body like '📅%' order by created_at desc limit 1`))[0].body), true));
});
await check('solicitud de cita del cliente: queda «requested», avisa en el chat y el equipo la acepta', async () => {
  const when = new Date(Date.now() + 3 * 86400e3).toISOString();
  const rid = await as('ben', async () => (await q(`select public.request_appointment($1, $2, 'por la tarde') as id`, [biz, when]))[0].id);
  await as('cleo', async () => { eq((await q(`select status from public.appointments where id = $1`, [rid]))[0].status, 'requested'); await db.query(`select public.update_appointment($1, 'scheduled')`, [rid]); });
  await as('ben', async () => { eq((await q(`select status from public.appointments where id = $1`, [rid]))[0].status, 'scheduled'); await denied(db.query(`select public.request_appointment($1, $2, null)`, [biz, new Date(Date.now() - 3600e3).toISOString()]), 'past'); });
  await as('cleo', async () => denied(db.query(`select public.request_appointment($1, $2, null)`, [biz, when]), 'own business'));
});
await check('viewer del negocio: puede leer la agenda pero no escribir', async () => {
  await as('ana', () => db.query(`select public.add_business_member($1, '+34600000004', 'viewer')`, [biz]));
  await as('dani', async () => {
    eq((await q(`select * from public.appointments`)).length >= 1, true);
    await denied(db.query(`select public.create_appointment($1, null, 'x', now() + interval '5 days', now() + interval '5 days 1 hour')`, [biz]), 'viewer create');
    await denied(db.query(`insert into public.customers (business_id, name) values ($1, 'x')`, [biz]), 'viewer customer');
  });
});

console.log('\nInvitaciones, @usuario, CRM → chat, publicaciones, portadas, incógnito y reportes (v9)');
await check('invitar a cualquier usuario a una cita lo convierte en cliente y le deja la tarjeta para aceptar', async () => {
  const start = new Date(Date.now() + 4 * 86400e3).toISOString(); const end = new Date(Date.now() + 4 * 86400e3 + 1800e3).toISOString();
  const id = await as('cleo', async () => (await q(`select public.create_appointment($1, null, 'Demo', $2, $3, null, null, $4) as id`, [biz, start, end, ids.ben]))[0].id);
  eq((await q(`select user_id from public.customers where business_id = $1 and user_id = $2`, [biz, ids.ben])).length, 1);
  await as('ben', async () => {
    const mine = await q(`select id, status, conversation_id from public.my_appointments() where id = $1`, [id]);
    eq(mine.length, 1); eq(mine[0].status, 'scheduled'); eq(!!mine[0].conversation_id, true);
    await db.query(`select public.respond_appointment($1, 'confirmed')`, [id]);
    eq((await q(`select status from public.appointments where id = $1`, [id]))[0].status, 'confirmed');
  });
  await as('cleo', async () => denied(db.query(`select public.create_appointment($1, null, 'Yo', $2, $3, null, null, auth.uid())`, [biz, start, end]), 'self invite'));
  await as('cleo', async () => denied(db.query(`select public.create_appointment($1, null, 'Equipo', $2, $3, null, null, $4)`, [biz, start, end, ids.dani]), 'team member (viewer) invite'));
});
await check('search_users encuentra cuentas por prefijo de @usuario y dice si ya son contacto', async () => {
  await as('cleo', () => db.query(`update public.profiles set username = 'cleo_x' where id = auth.uid()`));
  await as('ana', async () => {
    const rows = await q(`select username, is_self, is_contact from public.search_users('@CLE')`);
    eq(rows.map((r) => r.username), ['cleo_x']); eq(rows[0].is_self, false);
    eq((await q(`select * from public.search_users('x')`)).length, 0); // too short
    await denied(db.query(`select phone from public.search_users('ben')`), 'phone column'); // the phone is never part of the result
  });
});
await check('el equipo puede escribir a un cliente desde el CRM (crea el chat de negocio) y no a quien no está en CIFRA', async () => {
  const cid = await as('cleo', async () => (await q(`select public.start_customer_chat($1) as id`, [custBen]))[0].id);
  eq((await q(`select customer_id from public.conversations where id = $1`, [cid]))[0].customer_id, ids.ben);
  const ghost = await as('cleo', async () => (await q(`insert into public.customers (business_id, name, phone) values ($1, 'Fantasma', '+34 699 999 999') returning id`, [biz]))[0].id);
  await as('cleo', async () => denied(db.query(`select public.start_customer_chat($1)`, [ghost]), 'not on cifra'));
  await as('dani', async () => denied(db.query(`select public.start_customer_chat($1)`, [custBen]), 'viewer'));
  await as('ben', async () => denied(db.query(`select public.start_customer_chat($1)`, [custBen]), 'outsider'));
});
await check('publicaciones: un negocio público publica vídeo a 7 días visible para todos; nadie más publica en su nombre', async () => {
  await as('ana', async () => {
    await db.query(`insert into public.statuses (user_id, kind, body, media_path, business_id, expires_at) values (auth.uid(), 'video', 'Nuevo menú', 'status/biz/${biz}/v.mp4', $1, now() + interval '7 days')`, [biz]);
    await denied(db.query(`insert into public.statuses (user_id, kind, body, business_id, expires_at) values (auth.uid(), 'text', 'x', $1, now() + interval '30 days')`, [biz]), 'too long');
    eq((await q(`select public.storage_can_write($1) as ok`, [`status/biz/${biz}/v.mp4`]))[0].ok, true);
  });
  await as('dani', async () => {
    eq((await q(`select kind from public.statuses where business_id = $1`, [biz])).map((r) => r.kind), ['video']);
    eq((await q(`select public.storage_can_read($1) as ok`, [`status/biz/${biz}/v.mp4`]))[0].ok, true);
    await denied(db.query(`insert into public.statuses (user_id, kind, body, business_id) values (auth.uid(), 'text', 'spam', $1)`, [biz]), 'outsider posting as business');
    await db.query(`delete from public.statuses where business_id = $1`, [biz]); eq((await q(`select 1 from public.statuses where business_id = $1`, [biz])).length, 1); // RLS: nothing deleted
  });
  await as('ben', () => db.query(`insert into public.statuses (user_id, kind, media_path) values (auth.uid(), 'video', 'status/' || auth.uid() || '/v.mp4')`));
});
await check('portadas: cada uno cambia la suya; el color del negocio solo lo cambian los gestores y entre 5 opciones', async () => {
  await as('ben', () => db.query(`update public.profiles set cover_path = auth.uid() || '/cover.jpg' where id = auth.uid()`));
  await as('ana', async () => {
    eq((await q(`select cover_path from public.get_profiles(array[$1::uuid])`, [ids.ben]))[0].cover_path, `${ids.ben}/cover.jpg`);
    await db.query(`update public.businesses set accent = 'cobalt', cover_path = 'business/${biz}/cover.jpg' where id = $1`, [biz]);
    await denied(db.query(`update public.businesses set accent = 'neon' where id = $1`, [biz]), 'unknown accent');
  });
  await as('cleo', async () => { await db.query(`update public.businesses set accent = 'jade' where id = $1`, [biz]); eq((await q(`select accent from public.businesses where id = $1`, [biz]))[0].accent, 'cobalt'); }); // agents: RLS blocks the update
  await as('dani', async () => eq((await q(`select public.get_business_public($1) ->> 'accent' as a`, [biz]))[0].a, 'cobalt'));
});
await check('chat incógnito: con nombre, sin teléfono, se destruye cuando ambos lo piden y no deja rastro', async () => {
  const cid = await as('ana', async () => (await q(`select public.start_incognito_chat($1, 'Operación Lince') as id`, [ids.dani]))[0].id);
  await as('dani', async () => {
    const [row] = await q(`select peer_name, peer_phone, incognito, expires_at, destroy_mine, destroy_peer from public.list_chats(null, $1)`, [cid]);
    eq(row.peer_name, 'Operación Lince'); eq(row.peer_phone, null); eq(row.incognito, true); eq(!!row.expires_at, true); eq(row.destroy_peer, false);
    await db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'hola')`, [cid]);
    eq((await q(`select phone from public.get_profiles(array[$1::uuid])`, [ids.ana]))[0].phone, null); // incognito never unlocks the number
    eq((await q(`select public.request_incognito_destroy($1) as gone`, [cid]))[0].gone, false);
  });
  await as('ana', async () => {
    const [row] = await q(`select destroy_mine, destroy_peer from public.list_chats(null, $1)`, [cid]); eq(row.destroy_mine, false); eq(row.destroy_peer, true);
    eq((await q(`select public.request_incognito_destroy($1) as gone`, [cid]))[0].gone, true);
  });
  eq((await q(`select 1 from public.conversations where id = $1`, [cid])).length, 0);
  eq((await q(`select 1 from public.messages where conversation_id = $1`, [cid])).length, 0);
  await as('ben', async () => denied(db.query(`select public.request_incognito_destroy($1)`, [bizChat]), 'not incognito'));
  const old = await as('ana', async () => (await q(`select public.start_incognito_chat($1, 'Caduco') as id`, [ids.ben]))[0].id);
  await db.query(`update public.conversations set expires_at = now() - interval '1 minute' where id = $1`, [old]);
  await as('ben', async () => eq((await q(`select 1 from public.list_chats(null, $1)`, [old])).length, 0));
  eq((await q(`select public.purge_incognito() as n`))[0].n, 1);
});
await check('reportes: cada uno archiva los suyos, nunca a sí mismo, y nadie lee los de otros', async () => {
  await as('ben', async () => {
    await db.query(`insert into public.reports (reporter_id, reported_id, reason) values (auth.uid(), $1, 'desconocido, spam')`, [ids.dani]);
    await denied(db.query(`insert into public.reports (reporter_id, reported_id, reason) values (auth.uid(), auth.uid(), 'yo')`), 'self report');
    await denied(db.query(`insert into public.reports (reporter_id, reported_id, reason) values ($1, $2, 'falso')`, [ids.ana, ids.dani]), 'as someone else');
  });
  await as('dani', async () => eq((await q(`select * from public.reports`)).length, 0));
});

console.log('\nAcuses de entrega (v10)');
await check('un tick al enviar, dos cuando llega al otro dispositivo, dos de color al leer; tambien en la lista de chats', async () => {
  const cid = await as('ana', async () => (await q(`select public.start_direct_chat($1) as id`, [ids.cleo]))[0].id);
  await as('ana', async () => {
    await db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'ping')`, [cid]);
    const [row] = await q(`select last_delivered, last_read from public.list_chats(null, $1)`, [cid]); eq(row, { last_delivered: false, last_read: false });
  });
  await as('cleo', async () => { eq((await q(`select public.mark_delivered() as n`))[0].n >= 1, true); });
  await as('ana', async () => { const [row] = await q(`select last_delivered, last_read from public.list_chats(null, $1)`, [cid]); eq(row, { last_delivered: true, last_read: false }); });
  await as('cleo', async () => db.query(`select public.mark_read($1)`, [cid]));
  await as('ana', async () => { const [row] = await q(`select last_delivered, last_read from public.list_chats(null, $1)`, [cid]); eq(row, { last_delivered: true, last_read: true }); });
  await as('dani', async () => eq((await q(`select public.mark_delivered($1) as n`, [cid]))[0].n, 0)); // not a member: nothing to mark
});


console.log('\nSaludo solo si escribe primero el cliente, remitente en la lista y Web Push (v11)');
let evaId;
await check('el saludo automatico no sale si el negocio escribio primero; si el cliente escribe primero, si', async () => {
  [{ id: evaId }] = await q(`insert into auth.users (phone, raw_user_meta_data, phone_confirmed_at) values ('34600000005', '{"display_name":"Eva"}', now()) returning id`);
  ids.eva = evaId;
  const evaCard = await as('cleo', async () => (await q(`insert into public.customers (business_id, name, phone) values ($1, 'Eva', '+34 600 000 005') returning id`, [biz]))[0].id);
  const conv = await as('cleo', async () => (await q(`select public.start_customer_chat($1) as id`, [evaCard]))[0].id);
  await as('cleo', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'Hola Eva, te escribo yo')`, [conv]));
  await as('eva', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'Hola, gracias')`, [conv]));
  eq((await q(`select count(*)::int as n from public.messages where conversation_id = $1 and is_automated`, [conv]))[0].n, 0);
  // a brand new customer who writes first still gets the greeting
  const [{ id: ferId }] = await q(`insert into auth.users (phone, raw_user_meta_data, phone_confirmed_at) values ('34600000006', '{"display_name":"Fer"}', now()) returning id`); ids.fer = ferId;
  const conv2 = await as('fer', async () => (await q(`select public.start_business_chat($1) as id`, [biz]))[0].id);
  await as('fer', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'Buenas')`, [conv2]));
  eq((await q(`select count(*)::int as n from public.messages where conversation_id = $1 and is_automated`, [conv2]))[0].n, 1);
  ids._evaConv = conv;
});
await check('la lista de chats dice quien escribio el ultimo mensaje (nombre y foto)', async () => {
  await as('cleo', async () => { const [r] = await q(`select last_sender_name from public.list_chats(null, $1)`, [ids._evaConv]); eq(r.last_sender_name, 'Eva'); });
  await as('eva', async () => { const [r] = await q(`select last_sender_name from public.list_chats(null, $1)`, [ids._evaConv]); eq(r.last_sender_name, 'Eva'); });
  await as('cleo', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'Te llamo manana')`, [ids._evaConv]));
  await as('eva', async () => { const [r] = await q(`select last_sender_name from public.list_chats(null, $1)`, [ids._evaConv]); eq(r.last_sender_name, 'cleo'); });
});
await check('Web Push: suscribirse, titulos/cuerpos por caso y nadie mas puede pedir los datos', async () => {
  const sub = (who, ep) => as(who, () => db.query(`select public.save_push_subscription($1, 'BPkey', 'authkey', 'iPhone')`, [ep]));
  await sub('eva', 'https://push.example/eva'); await sub('cleo', 'https://push.example/cleo'); await sub('ana', 'https://push.example/ana'); await sub('ben', 'https://push.example/ben');
  await as('ben', async () => denied(db.query(`select public.save_push_subscription('http://insecure/x', 'a', 'b')`), 'insecure endpoint'));
  await as('ben', async () => denied(db.query(`select * from public.push_subscriptions`), 'table is private'));
  // team -> customer: title is the business, body carries the author's name
  const [{ id: m1 }] = await q(`select id from public.messages where conversation_id = $1 and body = 'Te llamo manana'`, [ids._evaConv]);
  const r1 = await q(`select title, body, endpoint from public.push_payloads($1)`, [m1]);
  eq(r1.map((r) => [r.title, r.body, r.endpoint]), [['Café Aurora', 'cleo: Te llamo manana', 'https://push.example/eva']]);
  // customer -> business: every agent without assignment (owner ana + agent cleo), title names the customer and the business
  const [{ id: m2 }] = await q(`select id from public.messages where conversation_id = $1 and body = 'Hola, gracias'`, [ids._evaConv]);
  const r2 = await q(`select title, body, endpoint from public.push_payloads($1) order by endpoint`, [m2]);
  eq(r2.map((r) => [r.title, r.body, r.endpoint]), [['\u{1F4BC} Eva · Café Aurora', 'Hola, gracias', 'https://push.example/ana'], ['\u{1F4BC} Eva · Café Aurora', 'Hola, gracias', 'https://push.example/cleo']]);
  // each device chooses per space: cleo turns Business off -> only ana is notified; the customer side (personal) is unaffected
  await as('cleo', () => db.query(`select public.set_push_prefs('https://push.example/cleo', true, false)`));
  eq((await q(`select endpoint, tag from public.push_payloads($1)`, [m2])).map((r) => r.endpoint), ['https://push.example/ana']);
  eq((await q(`select tag from public.push_payloads($1)`, [m2]))[0].tag.startsWith('biz-'), true);
  eq((await q(`select tag from public.push_payloads($1)`, [m1]))[0].tag.startsWith('chat-'), true);
  await as('eva', () => db.query(`select public.set_push_prefs('https://push.example/eva', false, true)`));
  eq((await q(`select * from public.push_payloads($1)`, [m1])).length, 0);
  eq(await as('eva', () => q(`select notify_personal, notify_business from public.get_push_prefs('https://push.example/eva')`)), [{ notify_personal: false, notify_business: true }]);
  eq(await as('ben', () => q(`select * from public.get_push_prefs('https://push.example/eva')`)), []); // not someone else's device
  await as('eva', () => db.query(`select public.set_push_prefs('https://push.example/eva', true, true)`));
  await as('cleo', () => db.query(`select public.set_push_prefs('https://push.example/cleo', true, true)`));
  // incognito: nothing readable travels
  const inc = await as('ana', async () => (await q(`select public.start_incognito_chat($1, 'X') as id`, [ids.ben]))[0].id);
  await as('ana', () => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'secreto')`, [inc]));
  const [{ id: m3 }] = await q(`select id from public.messages where conversation_id = $1 and body = 'secreto'`, [inc]);
  const r3 = await q(`select title, body from public.push_payloads($1)`, [m3]); eq(r3, [{ title: 'CIFRA', body: 'Mensaje nuevo' }]);
  // muted chats and blocked senders stay silent
  await as('ben', () => db.query(`update public.conversation_members set muted_until = now() + interval '1 day' where conversation_id = $1 and user_id = auth.uid()`, [inc]));
  eq((await q(`select * from public.push_payloads($1)`, [m3])).length, 0);
  // only the server can ask for payloads
  await as('ben', async () => denied(db.query(`select * from public.push_payloads($1)`, [m3]), 'push_payloads as user'));
  await as('ben', async () => denied(db.query(`select public.drop_push_endpoint('https://push.example/ben')`), 'drop endpoint as user'));
  await as('ben', () => db.query(`select public.delete_push_subscription('https://push.example/ben')`));
  eq((await q(`select count(*)::int as n from public.push_subscriptions where endpoint = 'https://push.example/ben'`))[0].n, 0);
});

await check('Clientes: el equipo anade una cuenta de CIFRA como cliente (sin chat) y ve su foto; un ajeno no', async () => {
  const [{ id: gus }] = await q(`insert into auth.users (phone, raw_user_meta_data, phone_confirmed_at) values ('34600000007', '{"display_name":"Gus"}', now()) returning id`); ids.gus = gus;
  await as('gus', () => db.query(`update public.profiles set avatar_path = auth.uid() || '/me.jpg', username = 'gus_x' where id = auth.uid()`));
  const cid = await as('cleo', async () => (await q(`select public.add_customer_from_user($1, $2) as id`, [biz, ids.gus]))[0].id);
  eq((await as('cleo', () => q(`select user_id, name from public.customers where id = $1`, [cid])))[0], { user_id: ids.gus, name: 'Gus' });
  eq((await as('cleo', () => q(`select public.add_customer_from_user($1, $2) as id`, [biz, ids.gus])))[0].id, cid); // idempotent
  eq((await as('cleo', () => q(`select avatar_path, username from public.get_profiles(array[$1::uuid])`, [ids.gus])))[0], { avatar_path: `${ids.gus}/me.jpg`, username: 'gus_x' });
  eq((await as('ben', () => q(`select * from public.get_profiles(array[$1::uuid])`, [ids.gus]))).length, 0); // strangers still see nothing
  await as('dani', async () => denied(db.query(`select public.add_customer_from_user($1, $2)`, [biz, ids.ben]), 'viewer'));
  await as('ben', async () => denied(db.query(`select public.add_customer_from_user($1, $2)`, [biz, ids.gus]), 'outsider'));
  await as('cleo', async () => denied(db.query(`select public.add_customer_from_user($1, $2)`, [biz, ids.ana]), 'team member'));
  await as('cleo', () => db.query(`update public.customers set name = 'Gustavo', phone = '+34 600 000 007', email = 'gus@example.com' where id = $1`, [cid])); // edit contact
  eq((await as('cleo', () => q(`select name from public.customers where id = $1`, [cid])))[0].name, 'Gustavo');
});

await check('Recordatorio 5 min antes: creador, asignado e invitado; una sola vez; respeta Business/Personal', async () => {
  const sub = (who, ep) => as(who, () => db.query(`select public.save_push_subscription($1, 'BPkey', 'authkey', 'iPhone')`, [ep]));
  await sub('ben', 'https://push.example/ben2');
  const aid = await as('cleo', async () => (await q(`select public.create_appointment($1, null, 'Revision', now() + interval '3 minutes', now() + interval '33 minutes', null, $2, $3) as id`, [biz, ids.cleo, ids.ben]))[0].id);
  const far = await as('cleo', async () => (await q(`select public.create_appointment($1, null, 'Lejos', now() + interval '2 hours', now() + interval '3 hours', null, $2, null) as id`, [biz, ids.cleo]))[0].id);
  eq((await q(`select public.dispatch_appointment_reminders() as n`))[0].n, 1); // only the one inside 5 minutes
  eq((await q(`select public.dispatch_appointment_reminders() as n`))[0].n, 0); // never twice
  eq((await q(`select reminded_at is not null as r from public.appointments where id = $1`, [aid]))[0].r, true);
  eq((await q(`select reminded_at is null as r from public.appointments where id = $1`, [far]))[0].r, true);
  const rows = await q(`select endpoint, title, body, url, tag from public.reminder_payloads($1) order by endpoint`, [aid]);
  eq(rows.map((r) => [r.endpoint, r.url]), [['https://push.example/ben2', '/my-appointments'], ['https://push.example/cleo', '/agenda']]);
  eq(rows[0].title.endsWith('Revision'), true);
  eq(rows[0].body.startsWith('En 5 minutos'), true);
  eq(rows[0].tag, `appt-${aid}`);
  // Business alerts off for cleo -> only the invited customer is reminded
  await as('cleo', () => db.query(`select public.set_push_prefs('https://push.example/cleo', true, false)`));
  eq((await q(`select endpoint from public.reminder_payloads($1)`, [aid])).map((r) => r.endpoint), ['https://push.example/ben2']);
  await as('cleo', () => db.query(`select public.set_push_prefs('https://push.example/cleo', true, true)`));
  // moving the appointment re-arms the reminder; cancelled ones are never reminded
  await q(`update public.appointments set starts_at = now() + interval '4 minutes', ends_at = now() + interval '34 minutes' where id = $1`, [aid]);
  eq((await q(`select reminded_at is null as r from public.appointments where id = $1`, [aid]))[0].r, true);
  await q(`update public.appointments set status = 'cancelled' where id = $1`, [aid]);
  eq((await q(`select public.dispatch_appointment_reminders() as n`))[0].n, 0);
  eq((await q(`select * from public.reminder_payloads($1)`, [aid])).length, 0);
  await as('ben', async () => denied(db.query(`select * from public.reminder_payloads($1)`, [aid]), 'reminder_payloads as user'));
  await as('ben', async () => denied(db.query(`select public.dispatch_appointment_reminders()`), 'dispatch as user'));
});

await check('Recuperacion de cuenta: correo con codigo, codigo de recuperacion de un solo uso, limites y privacidad', async () => {
  const u = ids.ben;
  // nothing set yet
  eq((await q(`select user_id, has_email, has_code from public.recovery_lookup('+34600000002')`))[0], { user_id: u, has_email: false, has_code: false });
  eq((await q(`select count(*)::int as n from public.recovery_lookup('+34999999999')`))[0].n, 0);
  // verify an e-mail with a 6-digit code (stored hashed): wrong code fails, right one verifies
  await q(`select public.recovery_begin_email($1, 'Ben@Example.com', 'h-123456', 'verify')`, [u]);
  eq((await q(`select public.recovery_check_otp($1, 'h-000000', 'verify') as ok`, [u]))[0].ok, false);
  eq((await q(`select public.recovery_check_otp($1, 'h-123456', 'reset') as ok`, [u]))[0].ok, false); // a verify code does not reset passwords
  eq((await q(`select public.recovery_check_otp($1, 'h-123456', 'verify') as ok`, [u]))[0].ok, true);
  eq((await q(`select public.recovery_check_otp($1, 'h-123456', 'verify') as ok`, [u]))[0].ok, false); // one use
  eq((await q(`select has_email, email from public.recovery_lookup('+34600000002')`))[0], { has_email: true, email: 'ben@example.com' });
  eq((await as('ben', () => q(`select email_masked, email_verified, has_code from public.my_recovery_status()`)))[0], { email_masked: 'be***@example.com', email_verified: true, has_code: false });
  // sends: 60 s apart, 5 per hour
  await q(`update public.account_recovery set last_sent_at = now() - interval '2 minutes' where user_id = $1`, [u]);
  await q(`select public.recovery_begin_email($1, null, 'h-111111', 'reset')`, [u]);
  let limited = false; try { await q(`select public.recovery_begin_email($1, null, 'h-222222', 'reset')`, [u]); } catch { limited = true; }
  eq(limited, true);
  await q(`update public.account_recovery set last_sent_at = now() - interval '2 minutes' where user_id = $1`, [u]);
  // 5 wrong tries burn the reset code even if the right one comes later
  for (let i = 0; i < 5; i++) await q(`select public.recovery_check_otp($1, 'h-bad', 'reset')`, [u]);
  eq((await q(`select public.recovery_check_otp($1, 'h-111111', 'reset') as ok`, [u]))[0].ok, false);
  // expired codes fail
  await q(`update public.account_recovery set last_sent_at = now() - interval '2 minutes' where user_id = $1`, [u]);
  await q(`select public.recovery_begin_email($1, null, 'h-333333', 'reset')`, [u]);
  await q(`update public.account_recovery set otp_expires_at = now() - interval '1 second' where user_id = $1`, [u]);
  eq((await q(`select public.recovery_check_otp($1, 'h-333333', 'reset') as ok`, [u]))[0].ok, false);
  // recovery code: consumed on use, locked after 5 failures
  await q(`select public.recovery_set_code($1, 'c-hash')`, [u]);
  eq((await as('ben', () => q(`select has_code from public.my_recovery_status()`)))[0].has_code, true);
  for (let i = 0; i < 5; i++) eq((await q(`select public.recovery_check_code($1, 'c-wrong') as ok`, [u]))[0].ok, false);
  eq((await q(`select public.recovery_check_code($1, 'c-hash') as ok`, [u]))[0].ok, false); // locked for 15 minutes
  await q(`update public.account_recovery set locked_until = null where user_id = $1`, [u]);
  eq((await q(`select public.recovery_check_code($1, 'c-hash') as ok`, [u]))[0].ok, true);
  eq((await q(`select public.recovery_check_code($1, 'c-hash') as ok`, [u]))[0].ok, false); // single use
  // privacy: nobody reads the table or calls the server functions
  await as('ben', async () => denied(db.query(`select * from public.account_recovery`), 'table is private'));
  await as('ben', async () => denied(db.query(`select * from public.recovery_lookup('+34600000001')`), 'lookup as user'));
  await as('ben', async () => denied(db.query(`select public.recovery_check_code($1, 'x')`, [u]), 'check as user'));
  await as('ana', async () => eq((await q(`select email_masked from public.my_recovery_status()`))[0].email_masked, null)); // sees only their own
});

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
