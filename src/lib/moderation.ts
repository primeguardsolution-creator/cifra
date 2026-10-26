import { rpc } from './api';

export type ReportRow = {
  id: string; reason: string; status: 'open' | 'reviewed' | 'dismissed' | 'actioned'; created_at: string; note: string | null;
  reporter_id: string; reporter_name: string | null; reported_id: string | null; reported_name: string | null; reported_phone: string | null; reported_username: string | null;
  reports_against: number; business_name: string | null; suspended: boolean;
};
export const isPlatformAdmin = () => rpc<boolean>('is_platform_admin');
export const adminListReports = (status: ReportRow['status'] | null) => rpc<ReportRow[]>('admin_list_reports', { p_status: status });
export const adminReviewReport = (id: string, status: ReportRow['status'], note?: string) => rpc<void>('admin_review_report', { p_id: id, p_status: status, p_note: note ?? null });
export const adminSetSuspended = (user: string, suspended: boolean, note?: string) => rpc<void>('admin_set_suspended', { p_user: user, p_suspended: suspended, p_note: note ?? null });
