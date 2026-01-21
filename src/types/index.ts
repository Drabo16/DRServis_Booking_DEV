// =====================================================
// ZÁKLADNÍ TYPY PRO APLIKACI
// =====================================================

export type UserRole = 'admin' | 'technician';

export type RoleType = 'sound' | 'lights' | 'stage' | 'video' | 'other';

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

export type AttendanceStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export type SyncType = 'calendar_ingest' | 'status_check' | 'attendee_update';

export type SyncStatus = 'success' | 'partial' | 'failed';

// =====================================================
// DATABASE TYPES
// =====================================================

export interface Profile {
  id: string;
  auth_user_id: string | null; // Linked to auth.users when user logs in via OAuth
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  specialization: string[] | null;
  avatar_url: string | null;
  is_active: boolean;
  has_warehouse_access: boolean; // Access to warehouse module
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  google_event_id: string;
  google_calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  status: EventStatus;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  calendar_attachment_synced: boolean;
  html_link: string | null;
  created_by: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  event_id: string;
  title: string;
  role_type: RoleType;
  requirements: string[] | null;
  shift_start: string | null;
  shift_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  position_id: string;
  event_id: string;
  technician_id: string;
  attendance_status: AttendanceStatus;
  response_time: string | null;
  notes: string | null;
  assigned_by: string | null;
  assigned_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: SyncType;
  status: SyncStatus;
  events_processed: number;
  errors_count: number;
  error_details: any | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// =====================================================
// EXTENDED TYPES (s relacemi)
// =====================================================

export interface EventWithAssignments extends Event {
  positions: (Position & {
    assignments: (Assignment & {
      technician: Profile;
    })[];
  })[];
}

export interface AssignmentWithDetails extends Assignment {
  position: Position;
  event: Event;
  technician: Profile;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// =====================================================
// MODULE SYSTEM TYPES
// =====================================================
export * from './modules';

// =====================================================
// WAREHOUSE MODULE TYPES
// =====================================================
export * from './warehouse';
