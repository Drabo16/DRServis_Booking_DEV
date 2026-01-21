// =====================================================
// OFFERS MODULE - Project PDF Document Component
// =====================================================
// Combined PDF template for all offers in a project

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
    padding: 40,
    paddingBottom: 60,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#0066b3',
  },
  logo: {
    width: 140,
    height: 'auto',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  projectName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  projectDate: {
    fontSize: 8,
    color: '#666666',
  },
  // Project Summary Section
  projectSummary: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f0f4f8',
    borderRadius: 4,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#0066b3',
  },
  projectDesc: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 12,
  },
  offersOverview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  offerBadge: {
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 4,
  },
  offerBadgeLabel: {
    fontSize: 7,
    color: '#64748b',
  },
  offerBadgeNumber: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  offerBadgeAmount: {
    fontSize: 8,
    color: '#0066b3',
    marginTop: 1,
  },
  // Offer Section
  offerSection: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  offerHeader: {
    backgroundColor: '#1e293b',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerLabel: {
    backgroundColor: '#0066b3',
    color: '#ffffff',
    padding: '3 8',
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 'bold',
  },
  offerTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  offerNumber: {
    color: '#94a3b8',
    fontSize: 8,
  },
  offerAmount: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Category
  categoryHeader: {
    backgroundColor: '#334155',
    padding: 5,
  },
  categoryTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 9,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 16,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  // Columns
  colName: { width: '46%', paddingRight: 4 },
  colDays: { width: '10%', textAlign: 'center' },
  colQty: { width: '10%', textAlign: 'center' },
  colPrice: { width: '16%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },
  // Item text
  itemName: { fontSize: 7 },
  itemSub: { fontSize: 6, color: '#64748b', marginTop: 1 },
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
  // Offer Summary
  offerSummary: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  offerSummaryBox: {
    width: '45%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  summaryLabel: { fontSize: 8, color: '#475569' },
  summaryValue: { fontSize: 8, fontWeight: 'bold' },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    color: '#16a34a',
  },
  offerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#0066b3',
  },
  offerTotalLabel: { fontSize: 9, fontWeight: 'bold' },
  offerTotalValue: { fontSize: 10, fontWeight: 'bold', color: '#0066b3' },
  // Grand Total
  grandTotal: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#0066b3',
    borderRadius: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  grandTotalLabel: { fontSize: 10, color: '#ffffff' },
  grandTotalValue: { fontSize: 10, color: '#ffffff', fontWeight: 'bold' },
  grandTotalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  grandTotalFinalLabel: { fontSize: 14, color: '#ffffff', fontWeight: 'bold' },
  grandTotalFinalValue: { fontSize: 16, color: '#ffffff', fontWeight: 'bold' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
  pageNumber: { fontSize: 7, color: '#94a3b8' },
});

interface OfferSet {
  id: string;
  name: string;
  description: string | null;
  total_equipment: number;
  total_personnel: number;
  total_transport: number;
  total_discount: number;
  total_amount: number;
  created_at: string;
}

interface ProjectPdfDocumentProps {
  project: OfferSet;
  offers: OfferWithItems[];
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProjectPdfDocument({ project, offers, logoBase64 }: ProjectPdfDocumentProps) {
  const createdDate = formatDate(project.created_at);

  // Calculate grand totals from actual offers
  const grandTotals = offers.reduce(
    (acc, offer) => ({
      equipment: acc.equipment + (offer.subtotal_equipment || 0),
      personnel: acc.personnel + (offer.subtotal_personnel || 0),
      transport: acc.transport + (offer.subtotal_transport || 0),
      discount: acc.discount + (offer.discount_amount || 0),
      total: acc.total + (offer.total_amount || 0),
    }),
    { equipment: 0, personnel: 0, transport: 0, discount: 0, total: 0 }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Logo */}
        <View style={styles.header} fixed>
          {logoBase64 ? (
            <Image src={logoBase64} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0066b3' }}>DR Servis</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.projectName}>Projekt: {project.name}</Text>
            <Text style={styles.projectDate}>Vystaveno: {createdDate}</Text>
          </View>
        </View>

        {/* Project Summary */}
        <View style={styles.projectSummary}>
          <Text style={styles.projectTitle}>{project.name}</Text>
          {project.description && (
            <Text style={styles.projectDesc}>{project.description}</Text>
          )}
          <View style={styles.offersOverview}>
            {offers.map((offer) => (
              <View key={offer.id} style={styles.offerBadge}>
                <Text style={styles.offerBadgeLabel}>
                  {(offer as any).set_label || formatOfferNumber(offer.offer_number, offer.year)}
                </Text>
                <Text style={styles.offerBadgeNumber}>{offer.title}</Text>
                <Text style={styles.offerBadgeAmount}>{formatCurrency(offer.total_amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Individual Offers */}
        {offers.map((offer) => {
          const itemsByCategory = groupItemsByCategory(offer.items || []);
          const categoryTotals: Record<string, number> = {};
          for (const [category, items] of Object.entries(itemsByCategory)) {
            categoryTotals[category] = items.reduce((sum, item) => sum + item.total_price, 0);
          }

          return (
            <View key={offer.id} style={styles.offerSection} wrap={false}>
              {/* Offer Header */}
              <View style={styles.offerHeader}>
                <View style={styles.offerHeaderLeft}>
                  {(offer as any).set_label && (
                    <Text style={styles.offerLabel}>{(offer as any).set_label}</Text>
                  )}
                  <View>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    <Text style={styles.offerNumber}>
                      Nabídka č. {formatOfferNumber(offer.offer_number, offer.year)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.offerAmount}>{formatCurrency(offer.total_amount)}</Text>
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

              {/* Offer Summary */}
              <View style={styles.offerSummary}>
                <View style={styles.offerSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Technika:</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_equipment)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Personál:</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_personnel)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Doprava:</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_transport)}</Text>
                  </View>
                  {offer.discount_percent > 0 && (
                    <View style={styles.discountRow}>
                      <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>
                        Sleva ({offer.discount_percent}%):
                      </Text>
                      <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                        -{formatCurrency(offer.discount_amount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.offerTotalRow}>
                    <Text style={styles.offerTotalLabel}>Celkem:</Text>
                    <Text style={styles.offerTotalValue}>{formatCurrency(offer.total_amount)}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {/* Grand Total */}
        <View style={styles.grandTotal} wrap={false}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Technika celkem:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotals.equipment)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Personál celkem:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotals.personnel)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Doprava celkem:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotals.transport)}</Text>
          </View>
          {grandTotals.discount > 0 && (
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Slevy celkem:</Text>
              <Text style={styles.grandTotalValue}>-{formatCurrency(grandTotals.discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalFinal}>
            <Text style={styles.grandTotalFinalLabel}>CELKOVÁ CENA BEZ DPH:</Text>
            <Text style={styles.grandTotalFinalValue}>{formatCurrency(grandTotals.total)}</Text>
          </View>
        </View>

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
