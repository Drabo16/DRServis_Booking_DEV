// =====================================================
// OFFERS MODULE - PDF Document Component
// =====================================================
// Professional PDF template for offers using @react-pdf/renderer

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
  getCategoryGroup,
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
  offerNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  offerDate: {
    fontSize: 8,
    color: '#666666',
  },
  // Title
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333333',
  },
  // Event info
  eventBox: {
    backgroundColor: '#f0f4f8',
    padding: 10,
    marginBottom: 15,
    borderRadius: 3,
  },
  eventTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  eventDetail: {
    fontSize: 8,
    color: '#555555',
  },
  // Category
  categoryHeader: {
    backgroundColor: '#1e293b',
    padding: 6,
    marginTop: 8,
  },
  categoryTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 5,
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
    padding: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 18,
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
  itemName: { fontSize: 8 },
  itemSub: { fontSize: 7, color: '#64748b', marginTop: 1 },
  // Category total
  categoryTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 5,
    backgroundColor: '#f1f5f9',
  },
  categoryTotalText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Summary
  summary: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '55%',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: { fontSize: 9, color: '#475569' },
  summaryValue: { fontSize: 9, fontWeight: 'bold' },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    color: '#16a34a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#0066b3',
  },
  totalLabel: { fontSize: 11, fontWeight: 'bold' },
  totalValue: { fontSize: 12, fontWeight: 'bold', color: '#0066b3' },
  // Notes
  notes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fefce8',
    borderRadius: 3,
  },
  notesTitle: { fontSize: 8, fontWeight: 'bold', marginBottom: 3 },
  notesText: { fontSize: 8, color: '#713f12' },
  // Valid until
  validUntil: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
    textAlign: 'center',
  },
  validUntilText: { fontSize: 8, color: '#1e40af' },
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

interface OfferPdfDocumentProps {
  offer: OfferWithItems;
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

export function OfferPdfDocument({ offer, logoBase64 }: OfferPdfDocumentProps) {
  const itemsByCategory = groupItemsByCategory(offer.items || []);
  const createdDate = formatDate(offer.created_at);
  const validUntilDate = offer.valid_until ? formatDate(offer.valid_until) : null;

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  for (const [category, items] of Object.entries(itemsByCategory)) {
    categoryTotals[category] = items.reduce((sum, item) => sum + item.total_price, 0);
  }

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
            <Text style={styles.offerNumber}>
              Nabídka č. {formatOfferNumber(offer.offer_number, offer.year)}
            </Text>
            <Text style={styles.offerDate}>Vystaveno: {createdDate}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{offer.title}</Text>

        {/* Event Info */}
        {offer.event && (
          <View style={styles.eventBox}>
            <Text style={styles.eventTitle}>Akce: {offer.event.title}</Text>
            <Text style={styles.eventDetail}>
              Termín: {formatDate(offer.event.start_time)}
              {offer.event.location && ` | Místo: ${offer.event.location}`}
            </Text>
          </View>
        )}

        {/* Items by Category */}
        {OFFER_CATEGORY_ORDER.map((categoryName) => {
          const items = itemsByCategory[categoryName];
          if (!items || items.length === 0) return null;

          return (
            <View key={categoryName} wrap={false}>
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{categoryName}</Text>
              </View>

              {/* Table Header */}
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

              {/* Items */}
              {items.map((item, idx) => (
                <View
                  key={item.id}
                  style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
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

              {/* Category Total */}
              <View style={styles.categoryTotal}>
                <Text style={styles.categoryTotalText}>
                  {categoryName}: {formatCurrency(categoryTotals[categoryName] || 0)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Summary */}
        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Technika celkem:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_equipment)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Technický personál:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_personnel)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Doprava:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(offer.subtotal_transport)}</Text>
          </View>

          {offer.discount_percent > 0 && (
            <View style={styles.discountRow}>
              <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>
                Sleva na techniku ({offer.discount_percent}%):
              </Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                -{formatCurrency(offer.discount_amount)}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {offer.is_vat_payer !== false ? 'CELKEM BEZ DPH:' : 'CELKOVÁ CENA:'}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(offer.total_amount)}</Text>
          </View>

          {/* DPH section - only for VAT payers */}
          {offer.is_vat_payer !== false && (
            <>
              <View style={[styles.summaryRow, { marginTop: 6 }]}>
                <Text style={styles.summaryLabel}>DPH (21%):</Text>
                <Text style={styles.summaryValue}>{formatCurrency(Math.round(offer.total_amount * 0.21))}</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 4, paddingTop: 4 }]}>
                <Text style={styles.totalLabel}>CELKEM S DPH:</Text>
                <Text style={styles.totalValue}>{formatCurrency(Math.round(offer.total_amount * 1.21))}</Text>
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
        {offer.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Poznámky:</Text>
            <Text style={styles.notesText}>{offer.notes}</Text>
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
