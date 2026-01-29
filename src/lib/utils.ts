import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { ROLE_TYPES } from './constants'
import type { RoleType, AttendanceStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: cs })
}

export function formatTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'HH:mm', { locale: cs })
}

export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  let end = typeof endDate === 'string' ? new Date(endDate) : endDate

  // Google Calendar sets end_time to midnight of the NEXT day for all-day events
  // If end is at exactly midnight (00:00:00), subtract 1 second to get the actual end date
  if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
    end = new Date(end.getTime() - 1000) // Subtract 1 second
  }

  const startStr = format(start, 'd. M. yyyy', { locale: cs })
  const endStr = format(end, 'd. M. yyyy', { locale: cs })

  if (startStr === endStr) {
    return startStr
  }

  return `${startStr} - ${endStr}`
}

export function getRoleTypeLabel(roleType: RoleType): string {
  const role = ROLE_TYPES.find((r) => r.value === roleType)
  return role?.label || roleType
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    pending: 'Čeká',
    accepted: 'Přijato',
    declined: 'Odmítnuto',
    tentative: 'Předběžně',
  }
  return labels[status] || status
}

export function getAttendanceStatusColor(status: AttendanceStatus): string {
  const colors: Record<AttendanceStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    tentative: 'bg-blue-100 text-blue-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
