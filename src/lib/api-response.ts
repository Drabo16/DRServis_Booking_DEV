import { NextResponse } from 'next/server';

/**
 * Standard API success response.
 * All API routes should use this for consistent response format.
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/**
 * Standard API error response.
 * Returns generic message to client; internal details should be logged with console.error.
 */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
