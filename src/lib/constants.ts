import { RoleType, AttendanceStatus, UserRole } from '@/types';

export const ROLE_TYPES: { value: RoleType; label: string }[] = [
  { value: 'sound', label: 'Zvukař' },
  { value: 'lights', label: 'Osvětlovač' },
  { value: 'stage', label: 'Stage' },
  { value: 'video', label: 'Video' },
  { value: 'other', label: 'Ostatní' },
];

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: 'pending', label: 'Čeká na odpověď' },
  { value: 'accepted', label: 'Přijato' },
  { value: 'declined', label: 'Odmítnuto' },
  { value: 'tentative', label: 'Možná' },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrátor' },
  { value: 'technician', label: 'Technik' },
];

export const SPECIALIZATIONS = [
  'sound',
  'lights',
  'stage',
  'video',
  'rigging',
  'led',
  'pyrotechnics',
  'camera',
  'streaming',
];
