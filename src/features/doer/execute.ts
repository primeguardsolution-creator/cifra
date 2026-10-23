import { Chat, addQuickReply, saveCatalogItem, scheduleMessage, updateBusiness } from '../../lib/api';
import { Customer, Stage, addCustomer, addTask, createAppointment, listCustomers, stages, updateCustomer } from '../../lib/biz';
import { DoerAction, norm } from './actions';
import { loc, t, tr } from '../../i18n';

export type ExecCtx = {
  businessId: string; me: string; chats: Chat[]; refreshBusinesses: () => Promise<void> | void;
  customers: Customer[]; go: (path: string) => void;
};
export type ExecResult = { ok: boolean; text: string; href?: string };

const stageKey = (s?: string): Stage | undefined => (s && stages.some((x) => x.key === s) ? (s as Stage) : undefined);
const find = (ctx: ExecCtx, name?: string) => (name ? ctx.customers.find((c) => norm(c.name).includes(norm(name)) || norm(name).includes(norm(c.name))) : undefined);

/** Human description shown in the plan card before anything happens. */
export function describe(a: DoerAction): { icon: string; title: string; detail?: string } {
  const fmt = (iso: string) => new Date(iso).toLocaleString(loc(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  switch (a.type) {
    case 'quick_reply': return { icon: 'flash', title: t('Respuesta rápida /{s}', { s: a.shortcut }), detail: a.body };
    case 'greeting': return { icon: 'hand-right', title: tr('Saludo de bienvenida'), detail: a.text };
    case 'away': return { icon: 'moon', title: tr(a.enabled ? 'Activar mensaje de ausencia' : 'Desactivar mensaje de ausencia'), detail: a.text };
    case 'appointment': return { icon: 'calendar', title: t('Cita: {title}', { title: a.title }), detail: t('{when} · {n} min{who}', { when: fmt(a.start), n: a.minutes, who: a.customer ? t(' · con {name}', { name: a.customer }) : '' }) };
    case 'task': return { icon: 'checkbox', title: t('Tarea: {title}', { title: a.title }), detail: [a.due && fmt(a.due), a.customer].filter(Boolean).join(' · ') || tr('Sin fecha') };
    case 'product': return { icon: 'pricetags', title: t('Producto: {name}', { name: a.name }), detail: [a.price != null && `${a.price} ${a.currency ?? 'EUR'}`, a.description].filter(Boolean).join(' · ') || tr('Sin precio') };
    case 'customer': return { icon: 'person-add', title: t('Cliente nuevo: {name}', { name: a.name }), detail: [a.phone, a.notes].filter(Boolean).join(' · ') || undefined };
    case 'customer_update': return { icon: 'create', title: t('Actualizar a {name}', { name: a.customer }), detail: [a.stage && t('etapa → {stage}', { stage: tr(stages.find((s) => s.key === a.stage)?.label ?? a.stage) }), a.tag && t('etiqueta #{tag}', { tag: a.tag }), a.note && t('nota: {note}', { note: a.note })].filter(Boolean).join(' · ') };
    case 'scheduled_message': return { icon: 'time', title: t('Mensaje a {name}', { name: a.customer }), detail: `${fmt(a.when)} · «${a.text}»` };
    case 'open': return { icon: 'open', title: t('Abrir {what}', { what: tr({ agenda: 'la agenda', clients: 'clientes', catalog: 'el catálogo', business: 'el negocio', inbox: 'la bandeja' }[a.screen]) }) };
  }
}

const ROUTES = { agenda: '/agenda', clients: '/clients', catalog: '/catalog', business: '/business', inbox: '/inbox' } as const;

export async function execute(a: DoerAction, ctx: ExecCtx): Promise<ExecResult> {
  try {
    switch (a.type) {
      case 'quick_reply': await addQuickReply(ctx.businessId, a.shortcut, a.body); return { ok: true, text: t('Respuesta rápida /{s} guardada. Úsala con el ⚡ en cualquier chat.', { s: a.shortcut }) };
      case 'greeting': await updateBusiness(ctx.businessId, { greeting: a.text }); await ctx.refreshBusinesses(); return { ok: true, text: tr('Saludo guardado: lo recibirá cada cliente nuevo.') };
      case 'away': await updateBusiness(ctx.businessId, { away_enabled: a.enabled, ...(a.text ? { away_message: a.text } : {}) }); await ctx.refreshBusinesses(); return { ok: true, text: tr(a.enabled ? 'Ausencia activada.' : 'Ausencia desactivada.') };
      case 'appointment': {
        const cu = find(ctx, a.customer);
        const start = new Date(a.start);
        if (Number.isNaN(start.getTime())) return { ok: false, text: tr('No entendí la fecha de la cita.') };
        await createAppointment({ business: ctx.businessId, customer: cu?.id ?? null, title: a.title, start, end: new Date(start.getTime() + (a.minutes || 30) * 60000) });
        return { ok: true, text: t('Cita agendada{who}.{card}', { who: cu ? t(' con {name}', { name: cu.name }) : '', card: cu?.user_id ? tr(' Le llegó una tarjeta al chat.') : '' }), href: '/agenda' };
      }
      case 'task': { const cu = find(ctx, a.customer); await addTask(ctx.businessId, { title: a.title, due_at: a.due ? new Date(a.due).toISOString() : null, customer_id: cu?.id ?? null }); return { ok: true, text: tr('Tarea creada.'), href: '/clients' }; }
      case 'product': await saveCatalogItem({ business_id: ctx.businessId, name: a.name, description: a.description ?? null, price_minor: a.price != null ? Math.round(a.price * 100) : null, currency: a.currency ?? 'EUR', is_published: true }); return { ok: true, text: t('«{name}» ya está en tu catálogo.', { name: a.name }), href: '/catalog' };
      case 'customer': await addCustomer(ctx.businessId, { name: a.name, phone: a.phone, notes: a.notes, stage: stageKey(a.stage) }); return { ok: true, text: t('{name} añadido a clientes.', { name: a.name }), href: '/clients' };
      case 'customer_update': {
        const cu = find(ctx, a.customer);
        if (!cu) return { ok: false, text: t('No encuentro a «{name}» en tus clientes.', { name: a.customer }) };
        await updateCustomer(cu.id, { ...(stageKey(a.stage) ? { stage: stageKey(a.stage) } : {}), ...(a.tag ? { tags: [...new Set([...cu.tags, norm(a.tag).replace(/[^a-z0-9_-]/g, '')])] } : {}), ...(a.note ? { notes: [cu.notes, a.note].filter(Boolean).join('\n') } : {}) });
        return { ok: true, text: t('{name} actualizado.', { name: cu.name }), href: '/clients' };
      }
      case 'scheduled_message': {
        const cu = find(ctx, a.customer);
        const chat = cu?.user_id ? ctx.chats.find((c) => c.peer_id === cu.user_id) : undefined;
        if (!chat) return { ok: false, text: t('{name} aún no tiene un chat contigo, así que no puedo escribirle.', { name: cu ? cu.name : a.customer }) };
        await scheduleMessage(ctx.me, { conversation_id: chat.id, body: a.text, send_at: new Date(a.when).toISOString() });
        return { ok: true, text: t('Mensaje programado para {name}.', { name: cu!.name }), href: `/chat/${chat.id}` };
      }
      case 'open': ctx.go(ROUTES[a.screen]); return { ok: true, text: tr('Abierto.') };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return { ok: false, text: tr(/duplicate key/i.test(msg) ? 'Eso ya existe (nombre repetido).' : /appointment_overlap/.test(msg) ? 'Esa persona ya tiene una cita a esa hora.' : msg || 'No se pudo hacer.') };
  }
}

export const reloadCustomers = listCustomers;
