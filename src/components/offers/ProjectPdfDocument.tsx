// =====================================================
// OFFERS MODULE - Project (Large Offer) PDF Document
// =====================================================
// PDF template that looks like a single offer with sub-sections

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import {
  formatOfferNumber,
  formatCurrency,
  OFFER_CATEGORY_ORDER,
} from '@/types/offers';
import type { OfferWithItems, OfferItem } from '@/types/offers';

// Register fonts for Czech characters
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    padding: 30,
    paddingBottom: 50,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#0066b3',
  },
  logo: {
    width: 120,
    height: 'auto',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  offerNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  offerDate: {
    fontSize: 7,
    color: '#666666',
  },
  // Title
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333333',
  },
  // Event info
  eventBox: {
    backgroundColor: '#f0f4f8',
    padding: 8,
    marginBottom: 10,
    borderRadius: 3,
  },
  eventTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  eventDetail: {
    fontSize: 7,
    color: '#555555',
  },
  // Sub-offer section header
  subOfferHeader: {
    backgroundColor: '#0066b3',
    padding: 6,
    marginTop: 10,
    marginBottom: 0,
  },
  subOfferTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 9,
  },
  subOfferSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 7,
    marginTop: 1,
  },
  // Category
  categoryHeader: {
    backgroundColor: '#1e293b',
    padding: 4,
    marginTop: 0,
  },
  categoryTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableHeaderText: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  // Columns - adjusted widths
  colName: { width: '44%', paddingRight: 3 },
  colDays: { width: '10%', textAlign: 'center' },
  colQty: { width: '10%', textAlign: 'center' },
  colPrice: { width: '17%', textAlign: 'right' },
  colTotal: { width: '19%', textAlign: 'right' },
  // Item text
  itemName: { fontSize: 8 },
  itemSub: { fontSize: 7, color: '#64748b', marginTop: 1 },
  // Category total
  categoryTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 4,
    backgroundColor: '#f1f5f9',
  },
  categoryTotalText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Sub-offer subtotal
  subOfferTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 6,
    backgroundColor: '#e0f2fe',
    marginBottom: 3,
  },
  subOfferTotalLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  subOfferTotalValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  // Summary - same style as single offer
  summary: {
    marginTop: 15,
    marginLeft: 'auto',
    width: '55%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 8, color: '#475569' },
  summaryValue: { fontSize: 8, fontWeight: 'bold' },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    color: '#16a34a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 2,
    borderTopColor: '#0066b3',
  },
  totalLabel: { fontSize: 10, fontWeight: 'bold' },
  totalValue: { fontSize: 11, fontWeight: 'bold', color: '#0066b3' },
  // Notes
  notes: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fefce8',
    borderRadius: 3,
  },
  notesTitle: { fontSize: 7, fontWeight: 'bold', marginBottom: 2 },
  notesText: { fontSize: 7, color: '#713f12' },
  // Valid until
  validUntil: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
    textAlign: 'center',
  },
  validUntilText: { fontSize: 7, color: '#1e40af' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
  footerText: { fontSize: 6, color: '#94a3b8' },
  pageNumber: { fontSize: 6, color: '#94a3b8' },
  // Direct items section
  directItemsHeader: {
    backgroundColor: '#0066b3',
    padding: 6,
    marginTop: 10,
  },
  directItemsTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 9,
  },
});

interface OfferSet {
  id: string;
  name: string;
  description: string | null;
  offer_number: number;
  year: number;
  discount_percent: number;
  total_equipment: number;
  total_personnel: number;
  total_transport: number;
  total_discount: number;
  total_amount: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  event?: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
  } | null;
}

interface OfferSetItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit_price: number;
  quantity: number;
  days_hours: number;
  total_price: number;
}

interface ProjectPdfDocumentProps {
  project: OfferSet;
  offers: OfferWithItems[];
  directItems?: OfferSetItem[];
  logoBase64?: string;
}

function groupItemsByCategory(items: OfferItem[]): Record<string, OfferItem[]> {
  const grouped: Record<string, OfferItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

function groupDirectItemsByCategory(items: OfferSetItem[]): Record<string, OfferSetItem[]> {
  const grouped: Record<string, OfferSetItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProjectPdfDocument({ project, offers, directItems = [], logoBase64 }: ProjectPdfDocumentProps) {
  const createdDate = formatDate(project.created_at);
  const validUntilDate = project.valid_until ? formatDate(project.valid_until) : null;

  // Calculate grand totals from actual offers + direct items
  const offersTotals = offers.reduce(
    (acc, offer) => ({
      equipment: acc.equipment + (offer.subtotal_equipment || 0),
      personnel: acc.personnel + (offer.subtotal_personnel || 0),
      transport: acc.transport + (offer.subtotal_transport || 0),
      discount: acc.discount + (offer.discount_amount || 0),
    }),
    { equipment: 0, personnel: 0, transport: 0, discount: 0 }
  );

  // Direct items totals
  const directItemsTotals = directItems.reduce(
    (acc, item) => {
      const isEquipment = ['Ground support', 'Zvuková technika', 'Světelná technika', 'LED obrazovky + video'].includes(item.category);
      const isPersonnel = item.category === 'Technický personál';
      const isTransport = item.category === 'Doprava';
      return {
        equipment: acc.equipment + (isEquipment ? item.total_price : 0),
        personnel: acc.personnel + (isPersonnel ? item.total_price : 0),
        transport: acc.transport + (isTransport ? item.total_price : 0),
      };
    },
    { equipment: 0, personnel: 0, transport: 0 }
  );

  const totalEquipment = offersTotals.equipment + directItemsTotals.equipment;
  const totalPersonnel = offersTotals.personnel + directItemsTotals.personnel;
  const totalTransport = offersTotals.transport + directItemsTotals.transport;

  // Project-level discount on equipment
  const projectDiscountAmount = Math.round(totalEquipment * (project.discount_percent || 0) / 100);
  const totalDiscount = offersTotals.discount + projectDiscountAmount;
  const grandTotal = totalEquipment + totalPersonnel + totalTransport - totalDiscount;

  const directItemsByCategory = groupDirectItemsByCategory(directItems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Logo - same as single offer */}
        <View style={styles.header} fixed>
          {logoBase64 ? (
            <Image src={logoBase64} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0066b3' }}>DR Servis</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.offerNumber}>
              Nabídka č. {formatOfferNumber(project.offer_number || 1, project.year || new Date().getFullYear())}
            </Text>
            <Text style={styles.offerDate}>Vystaveno: {createdDate}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{project.name}</Text>

        {/* Event Info */}
        {project.event && (
          <View style={styles.eventBox}>
            <Text style={styles.eventTitle}>Akce: {project.event.title}</Text>
            <Text style={styles.eventDetail}>
              Termín: {formatDate(project.event.start_time)}
              {project.event.location && ` | Místo: ${project.event.location}`}
            </Text>
          </View>
        )}

        {/* Description */}
        {project.description && (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 9, color: '#555555' }}>{project.description}</Text>
          </View>
        )}

        {/* Direct Items Section (if any) */}
        {directItems.length > 0 && (
          <View>
            <View style={styles.directItemsHeader}>
              <Text style={styles.directItemsTitle}>Společné položky</Text>
            </View>
            {OFFER_CATEGORY_ORDER.map((categoryName) => {
              const items = directItemsByCategory[categoryName];
              if (!items || items.length === 0) return null;

              const catTotal = items.reduce((sum, item) => sum + item.total_price, 0);

              return (
                <View key={`direct-${categoryName}`}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{categoryName}</Text>
                  </View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colName]}>Položka</Text>
                    <Text style={[styles.tableHeaderText, styles.colDays]}>Dny</Text>
                    <Text style={[styles.tableHeaderText, styles.colQty]}>
                      {categoryName === 'Doprava' ? 'km' : 'Ks'}
                    </Text>
                    <Text style={[styles.tableHeaderText, styles.colPrice]}>
                      {categoryName === 'Doprava' ? 'Kč/km' : 'Kč/ks'}
                    </Text>
                    <Text style={[styles.tableHeaderText, styles.colTotal]}>Celkem</Text>
                  </View>
                  {items.map((item, idx) => (
                    <View
                      key={item.id}
                      style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                      wrap={false}
                    >
                      <View style={styles.colName}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.subcategory && <Text style={styles.itemSub}>{item.subcategory}</Text>}
                      </View>
                      <Text style={[styles.colDays, { fontSize: 8 }]}>{item.days_hours}</Text>
                      <Text style={[styles.colQty, { fontSize: 8 }]}>{item.quantity}</Text>
                      <Text style={[styles.colPrice, { fontSize: 8 }]}>{formatCurrency(item.unit_price)}</Text>
                      <Text style={[styles.colTotal, { fontSize: 8, fontWeight: 'bold' }]}>
                        {formatCurrency(item.total_price)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.categoryTotal}>
                    <Text style={styles.categoryTotalText}>
                      {categoryName}: {formatCurrency(catTotal)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Sub-offers */}
        {offers.map((offer) => {
          const itemsByCategory = groupItemsByCategory(offer.items || []);
          const categoryTotals: Record<string, number> = {};
          for (const [category, items] of Object.entries(itemsByCategory)) {
            categoryTotals[category] = items.reduce((sum, item) => sum + item.total_price, 0);
          }

          const label = (offer as any).set_label || offer.title;

          return (
            <View key={offer.id}>
              {/* Sub-offer header */}
              <View style={styles.subOfferHeader}>
                <Text style={styles.subOfferTitle}>{label}</Text>
                {(offer as any).set_label && offer.title !== (offer as any).set_label && (
                  <Text style={styles.subOfferSubtitle}>{offer.title}</Text>
                )}
              </View>

              {/* Categories and Items */}
              {OFFER_CATEGORY_ORDER.map((categoryName) => {
                const items = itemsByCategory[categoryName];
                if (!items || items.length === 0) return null;

                return (
                  <View key={categoryName}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryTitle}>{categoryName}</Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, styles.colName]}>Položka</Text>
                      <Text style={[styles.tableHeaderText, styles.colDays]}>Dny</Text>
                      <Text style={[styles.tableHeaderText, styles.colQty]}>
                        {categoryName === 'Doprava' ? 'km' : 'Ks'}
                      </Text>
                      <Text style={[styles.tableHeaderText, styles.colPrice]}>
                        {categoryName === 'Doprava' ? 'Kč/km' : 'Kč/ks'}
                      </Text>
                      <Text style={[styles.tableHeaderText, styles.colTotal]}>Celkem</Text>
                    </View>
                    {items.map((item, idx) => (
                      <View
                        key={item.id}
                        style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                        wrap={false}
                      >
                        <View style={styles.colName}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.subcategory && <Text style={styles.itemSub}>{item.subcategory}</Text>}
                        </View>
                        <Text style={[styles.colDays, { fontSize: 7 }]}>{item.days_hours}</Text>
                        <Text style={[styles.colQty, { fontSize: 7 }]}>{item.quantity}</Text>
                        <Text style={[styles.colPrice, { fontSize: 7 }]}>{formatCurrency(item.unit_price)}</Text>
                        <Text style={[styles.colTotal, { fontSize: 7, fontWeight: 'bold' }]}>
                          {formatCurrency(item.total_price)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.categoryTotal}>
                      <Text style={styles.categoryTotalText}>
                        {categoryName}: {formatCurrency(categoryTotals[categoryName] || 0)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Sub-offer subtotal */}
              <View style={styles.subOfferTotal}>
                <Text style={styles.subOfferTotalLabel}>
                  Mezisoučet {label}:
                </Text>
                <Text style={styles.subOfferTotalValue}>
                  {formatCurrency(offer.total_amount)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Summary Section Header - starts on new page */}
        <View style={{ backgroundColor: '#0066b3', padding: 6 }} break>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 10 }}>SOUHRN NABÍDKY</Text>
        </View>

        {/* Summary Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { width: '60%' }]}>Položka</Text>
          <Text style={[styles.tableHeaderText, { width: '40%', textAlign: 'right' }]}>Celkem</Text>
        </View>

        {/* Stages breakdown - only category totals */}
        {offers.map((offer) => {
          const label = (offer as any).set_label || formatOfferNumber(offer.offer_number, offer.year);
          const offerItemsByCategory = groupItemsByCategory(offer.items || []);

          return (
            <View key={`summary-${offer.id}`}>
              {/* Stage header */}
              <View style={styles.subOfferHeader}>
                <Text style={styles.subOfferTitle}>{label}</Text>
              </View>

              {/* Category totals only (no individual items) */}
              {OFFER_CATEGORY_ORDER.map((categoryName, idx) => {
                const items = offerItemsByCategory[categoryName];
                if (!items || items.length === 0) return null;
                const catTotal = items.reduce((sum, item) => sum + item.total_price, 0);

                return (
                  <View
                    key={`summary-${offer.id}-${categoryName}`}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                  >
                    <Text style={{ width: '60%', fontSize: 8 }}>{categoryName}</Text>
                    <Text style={{ width: '40%', fontSize: 8, fontWeight: 'bold', textAlign: 'right' }}>
                      {formatCurrency(catTotal)}
                    </Text>
                  </View>
                );
              })}

              {/* Stage discount if any */}
              {offer.discount_amount > 0 && (
                <View style={[styles.tableRow, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={{ width: '60%', fontSize: 8, color: '#16a34a' }}>
                    Sleva ({offer.discount_percent}%)
                  </Text>
                  <Text style={{ width: '40%', fontSize: 8, fontWeight: 'bold', textAlign: 'right', color: '#16a34a' }}>
                    -{formatCurrency(offer.discount_amount)}
                  </Text>
                </View>
              )}

              {/* Stage subtotal */}
              <View style={styles.subOfferTotal}>
                <Text style={styles.subOfferTotalLabel}>Mezisoučet {label}:</Text>
                <Text style={styles.subOfferTotalValue}>{formatCurrency(offer.total_amount)}</Text>
              </View>
            </View>
          );
        })}

        {/* Shared items in table format - no categories, just a flat list */}
        {directItems.length > 0 && (
          <View>
            <View style={styles.directItemsHeader}>
              <Text style={styles.directItemsTitle}>Společné položky</Text>
            </View>
            {/* Table header for shared items */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colName]}>Položka</Text>
              <Text style={[styles.tableHeaderText, styles.colDays]}>Dny</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Ks</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>Kč/ks</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal]}>Celkem</Text>
            </View>
            {/* All items in a flat list */}
            {directItems.map((item, idx) => (
              <View
                key={`summary-direct-item-${item.id}`}
                style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
              >
                <View style={styles.colName}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.subcategory && <Text style={styles.itemSub}>{item.subcategory}</Text>}
                </View>
                <Text style={[styles.colDays, { fontSize: 7 }]}>{item.days_hours}</Text>
                <Text style={[styles.colQty, { fontSize: 7 }]}>{item.quantity}</Text>
                <Text style={[styles.colPrice, { fontSize: 7 }]}>{formatCurrency(item.unit_price)}</Text>
                <Text style={[styles.colTotal, { fontSize: 7, fontWeight: 'bold' }]}>
                  {formatCurrency(item.total_price)}
                </Text>
              </View>
            ))}
            {/* Shared items subtotal */}
            <View style={[styles.subOfferTotal, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.subOfferTotalLabel, { color: '#1d4ed8' }]}>Mezisoučet Společné položky:</Text>
              <Text style={[styles.subOfferTotalValue, { color: '#1d4ed8' }]}>
                {formatCurrency(directItemsTotals.equipment + directItemsTotals.personnel + directItemsTotals.transport)}
              </Text>
            </View>
          </View>
        )}

        {/* Grand Total Summary */}
        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Technika celkem:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalEquipment)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Technický personál:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalPersonnel)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Doprava:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalTransport)}</Text>
          </View>

          {totalDiscount > 0 && (
            <View style={styles.discountRow}>
              <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>
                Sleva celkem:
              </Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                -{formatCurrency(totalDiscount)}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {(project as any).is_vat_payer !== false ? 'CELKEM BEZ DPH:' : 'CELKOVÁ CENA:'}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
          </View>

          {/* DPH section - only for VAT payers */}
          {(project as any).is_vat_payer !== false && (
            <>
              <View style={[styles.summaryRow, { marginTop: 6 }]}>
                <Text style={styles.summaryLabel}>DPH (21%):</Text>
                <Text style={styles.summaryValue}>{formatCurrency(Math.round(grandTotal * 0.21))}</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 4, paddingTop: 4 }]}>
                <Text style={styles.totalLabel}>CELKEM S DPH:</Text>
                <Text style={styles.totalValue}>{formatCurrency(Math.round(grandTotal * 1.21))}</Text>
              </View>
            </>
          )}
        </View>

        {/* Valid Until */}
        {validUntilDate && (
          <View style={styles.validUntil}>
            <Text style={styles.validUntilText}>
              Platnost nabídky do: {validUntilDate}
            </Text>
          </View>
        )}

        {/* Notes */}
        {project.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Poznámky:</Text>
            <Text style={styles.notesText}>{project.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DR Servis s.r.o. | www.drservis.cz</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
