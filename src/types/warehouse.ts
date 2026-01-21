// =====================================================
// WAREHOUSE MODULE TYPES
// =====================================================

export interface WarehouseCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  quantity_total: number;
  is_rent: boolean;
  unit: string;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseItemWithCategory extends WarehouseItem {
  category: WarehouseCategory | null;
}

export interface WarehouseKit {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseKitItem {
  id: string;
  kit_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
}

export interface WarehouseKitWithItems extends WarehouseKit {
  items: (WarehouseKitItem & {
    item: WarehouseItem;
  })[];
}

export interface WarehouseReservation {
  id: string;
  event_id: string | null;
  item_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  kit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseReservationWithDetails extends WarehouseReservation {
  item: WarehouseItem;
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
  } | null;
  kit: WarehouseKit | null;
  creator: {
    id: string;
    full_name: string;
  } | null;
}

// Statistics types
export interface WarehouseItemStats {
  item_id: string;
  item_name: string;
  total_reservations: number;
  total_quantity_reserved: number;
  upcoming_reservations: number;
  utilization_percentage: number;
}

export interface WarehouseOverallStats {
  total_items: number;
  total_categories: number;
  total_kits: number;
  total_reservations: number;
  items_by_ownership: {
    ours: number;
    rent: number;
  };
  active_reservations: number;
  rent_utilization: {
    item_id: string;
    item_name: string;
    reservation_count: number;
  }[];
  // Purchase recommendations for frequently rented items
  purchase_recommendations: RentPurchaseRecommendation[];
}

export interface RentPurchaseRecommendation {
  item_id: string;
  item_name: string;
  sku: string | null;
  category_name: string | null;
  total_reservations: number;           // Total historical reservations
  reservations_last_30_days: number;    // Recent activity
  reservations_last_90_days: number;    // Quarterly activity
  total_days_rented: number;            // Sum of all rental days
  avg_days_per_reservation: number;     // Average rental duration
  utilization_score: number;            // 0-100, higher = more used
  recommendation_level: 'high' | 'medium' | 'low';  // How strongly we recommend purchase
  recommendation_reason: string;        // Human-readable explanation
}

// Form input types for mutations
export interface CreateWarehouseCategoryInput {
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateWarehouseCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface CreateWarehouseItemInput {
  category_id?: string;
  name: string;
  description?: string;
  sku?: string;
  quantity_total: number;
  is_rent?: boolean;
  unit?: string;
  notes?: string;
  image_url?: string;
}

export interface UpdateWarehouseItemInput {
  category_id?: string | null;
  name?: string;
  description?: string | null;
  sku?: string | null;
  quantity_total?: number;
  is_rent?: boolean;
  unit?: string;
  notes?: string | null;
  image_url?: string | null;
}

export interface CreateWarehouseKitInput {
  name: string;
  description?: string;
  items: { item_id: string; quantity: number }[];
}

export interface UpdateWarehouseKitInput {
  name?: string;
  description?: string;
  items?: { item_id: string; quantity: number }[];
}

export interface CreateWarehouseReservationInput {
  event_id?: string;
  item_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface ReserveWarehouseKitInput {
  kit_id: string;
  event_id?: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

// Filter types
export interface WarehouseItemsFilter {
  category_id?: string;
  is_rent?: boolean;
  search?: string;
}

export interface WarehouseReservationsFilter {
  event_id?: string;
  item_id?: string;
  kit_id?: string;
  start_date?: string;
  end_date?: string;
}

// =====================================================
// AVAILABILITY CHECK TYPES
// =====================================================

export interface AvailabilityCheckInput {
  start_date: string;
  end_date: string;
  item_ids?: string[];      // Optional: check specific items only
  category_id?: string;     // Optional: filter by category
}

export interface ItemAvailability {
  item_id: string;
  item_name: string;
  sku: string | null;
  category_name: string | null;
  category_color: string | null;
  is_rent: boolean;
  quantity_total: number;
  quantity_reserved: number;
  quantity_available: number;
  conflicting_reservations: {
    reservation_id: string;
    event_title: string | null;
    event_id: string | null;
    quantity: number;
    start_date: string;
    end_date: string;
  }[];
}

export interface AvailabilityCheckResult {
  start_date: string;
  end_date: string;
  items: ItemAvailability[];
  summary: {
    total_items_checked: number;
    fully_available: number;
    partially_available: number;
    unavailable: number;
  };
}
