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

  // Check if this is an all-day event (midnight UTC times)
  const isAllDayEvent =
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    end.getUTCHours() === 0 &&
    end.getUTCMinutes() === 0

  let startStr: string
  let endStr: string

  if (isAllDayEvent) {
    // For all-day events, use UTC date components to avoid timezone issues
    // Google Calendar sets end_time to midnight UTC of the NEXT day (exclusive)
    // So we subtract 1 day to get the actual end date
    const endMinusOneDay = new Date(end.getTime() - 86400000)

    // Format using UTC components directly
    startStr = `${start.getUTCDate()}. ${start.getUTCMonth() + 1}. ${start.getUTCFullYear()}`
    endStr = `${endMinusOneDay.getUTCDate()}. ${endMinusOneDay.getUTCMonth() + 1}. ${endMinusOneDay.getUTCFullYear()}`
  } else {
    // For timed events, use local time formatting
    startStr = format(start, 'd. M. yyyy', { locale: cs })
    endStr = format(end, 'd. M. yyyy', { locale: cs })
  }

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
