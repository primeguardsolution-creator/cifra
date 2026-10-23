import { BusinessRole } from './api';

export const roleLabel: Record<BusinessRole, string> = { owner: 'Propietario', admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente', viewer: 'Solo lectura' };
export const roleRank: Record<BusinessRole, number> = { owner: 5, admin: 4, supervisor: 3, agent: 2, viewer: 1 };
export const canManage = (role?: BusinessRole) => !!role && roleRank[role] >= 3;
export const categories = ['Restauración', 'Tienda', 'Belleza y bienestar', 'Salud', 'Educación', 'Servicios profesionales', 'Hogar y reformas', 'Eventos', 'Tecnología', 'Moda', 'Viajes', 'Otro'];
export const currencies = ['EUR', 'USD', 'MXN', 'GBP', 'COP', 'ARS', 'CLP', 'PEN'];
