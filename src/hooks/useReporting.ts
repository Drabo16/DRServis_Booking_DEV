'use client';

import { useQuery } from '@tanstack/react-query';

export interface ReportingData {
  offers: {
    total: number;
    thisYear: number;
    byStatus: Record<string, number>;
    revenueByStatus: Record<string, number>;
    totalRevenue: number;
    avgOfferValue: number;
    conversionRate: number;
    revenueByCategory: {
      equipment: number;
      personnel: number;
      transport: number;
      discounts: number;
    };
    monthlyRevenue: {
      month: string;
      revenue: number;
      expenses: number;
      count: number;
    }[];
    topClients: {
      name: string;
      revenue: number;
      count: number;
    }[];
  };
  events: {
    total: number;
    upcoming: number;
    past: number;
    confirmed: number;
    byMonth: {
      month: string;
      count: number;
      confirmed: number;
    }[];
  };
  technicians: {
    totalAssignments: number;
    acceptanceRate: number;
    utilizationByTech: {
      technicianId: string;
      total: number;
      accepted: number;
      declined: number;
      pending: number;
    }[];
  };
  warehouse: {
    totalItems: number;
    ownedItems: number;
    rentItems: number;
  };
}

export function useReporting() {
  return useQuery<ReportingData>({
    queryKey: ['reporting'],
    queryFn: async () => {
      const response = await fetch('/api/reporting');
      if (!response.ok) {
        if (response.status === 403) throw new Error('Forbidden');
        throw new Error('Failed to fetch reporting data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - dashboard data doesn't need to be real-time
  });
}
