// =====================================================
// MODULE SYSTEM TYPES
// =====================================================
// Types for the modular access system.
// To remove: delete this file and remove export from index.ts

export type ModuleCode = 'booking' | 'warehouse' | 'offers';

export interface AppModule {
  code: ModuleCode;
  name: string;
  description: string | null;
  icon: string;
  route: string;
  is_core: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface UserModuleAccess {
  id: string;
  user_id: string;
  module_code: ModuleCode;
  granted_at: string;
  granted_by: string | null;
}

export interface UserModule {
  user_id: string;
  auth_user_id: string | null;
  full_name: string;
  role: string;
  module_code: ModuleCode;
  module_name: string;
  icon: string;
  route: string;
  is_core: boolean;
  sort_order: number;
  has_access: boolean;
}

// API input types
export interface GrantModuleAccessInput {
  user_id: string;
  module_code: ModuleCode;
}

export interface RevokeModuleAccessInput {
  user_id: string;
  module_code: ModuleCode;
}

// For sidebar navigation
export interface AccessibleModule {
  code: ModuleCode;
  name: string;
  icon: string;
  route: string;
  is_core: boolean;
  sort_order: number;
}

// =====================================================
// PERMISSION SYSTEM TYPES
// =====================================================

// Permission codes by module
export type BookingPermission =
  | 'booking_view'
  | 'booking_invite'
  | 'booking_manage_events'
  | 'booking_manage_positions'
  | 'booking_manage_users'
  | 'booking_manage_folders'
  | 'booking_manage_roles';

export type WarehousePermission =
  | 'warehouse_view'
  | 'warehouse_reserve'
  | 'warehouse_manage_items'
  | 'warehouse_manage_kits';

export type OffersPermission =
  | 'offers_view'
  | 'offers_create'
  | 'offers_edit_own'
  | 'offers_edit_all'
  | 'offers_manage_templates';

export type PermissionCode = BookingPermission | WarehousePermission | OffersPermission;

export interface PermissionType {
  code: PermissionCode;
  name: string;
  description: string | null;
  module_code: ModuleCode;
  sort_order: number;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_code: PermissionCode;
  granted_at: string;
  granted_by: string | null;
}

export interface UserPermissionView {
  user_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: string;
  permission_code: PermissionCode;
  permission_name: string;
  module_code: ModuleCode;
  has_permission: boolean;
}

// User with all their permissions
export interface UserWithPermissions {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_supervisor: boolean;
  modules: {
    code: ModuleCode;
    name: string;
    has_access: boolean;
  }[];
  permissions: {
    code: PermissionCode;
    name: string;
    module_code: ModuleCode;
    has_permission: boolean;
  }[];
}

// API input types for permissions
export interface GrantPermissionInput {
  user_id: string;
  permission_code: PermissionCode;
}

export interface RevokePermissionInput {
  user_id: string;
  permission_code: PermissionCode;
}

export interface UpdateUserPermissionsInput {
  user_id: string;
  permissions: PermissionCode[];
}

// Permission labels for UI
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  // Booking
  booking_view: 'Zobrazit akce',
  booking_invite: 'Zvát na akce',
  booking_manage_events: 'Spravovat akce',
  booking_manage_positions: 'Spravovat pozice',
  booking_manage_users: 'Spravovat uživatele',
  booking_manage_folders: 'Spravovat složky',
  booking_manage_roles: 'Spravovat typy rolí',
  // Warehouse
  warehouse_view: 'Zobrazit sklad',
  warehouse_reserve: 'Rezervovat materiál',
  warehouse_manage_items: 'Spravovat položky',
  warehouse_manage_kits: 'Spravovat kity',
  // Offers
  offers_view: 'Zobrazit nabídky',
  offers_create: 'Vytvářet nabídky',
  offers_edit_own: 'Editovat vlastní',
  offers_edit_all: 'Editovat vše',
  offers_manage_templates: 'Spravovat ceník',
};

// Permissions grouped by module for UI
export const PERMISSIONS_BY_MODULE: Record<ModuleCode, PermissionCode[]> = {
  booking: [
    'booking_view',
    'booking_invite',
    'booking_manage_events',
    'booking_manage_positions',
    'booking_manage_users',
    'booking_manage_folders',
    'booking_manage_roles',
  ],
  warehouse: [
    'warehouse_view',
    'warehouse_reserve',
    'warehouse_manage_items',
    'warehouse_manage_kits',
  ],
  offers: [
    'offers_view',
    'offers_create',
    'offers_edit_own',
    'offers_edit_all',
    'offers_manage_templates',
  ],
};

// =====================================================
// ROLE PRESETS
// =====================================================
// Default modules and permissions for each role
// Admin has full access automatically (handled in code)

import type { UserRole } from './index';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrátor',
  manager: 'Správce',
  technician: 'Technik',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Plný přístup ke všem modulům a nastavením',
  manager: 'Plný přístup k Bookingu, volitelně další moduly',
  technician: 'Základní přístup - vidí své akce a může odpovídat',
};

export interface RolePreset {
  modules: ModuleCode[];
  permissions: PermissionCode[];
}

export const ROLE_PRESETS: Record<Exclude<UserRole, 'admin'>, RolePreset> = {
  manager: {
    modules: ['booking', 'warehouse', 'offers'],
    permissions: [
      // Booking - full access
      'booking_view',
      'booking_invite',
      'booking_manage_events',
      'booking_manage_positions',
      'booking_manage_folders',
      'booking_manage_roles',
      // Warehouse - view and reserve
      'warehouse_view',
      'warehouse_reserve',
      // Offers - view and create
      'offers_view',
      'offers_create',
      'offers_edit_own',
    ],
  },
  technician: {
    modules: ['booking'],
    permissions: [
      'booking_view',
    ],
  },
};
