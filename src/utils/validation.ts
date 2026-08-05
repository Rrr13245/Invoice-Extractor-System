import { InvoiceData } from '../types';

/**
 * Validates an invoice against the accounts payable requirements.
 * Checks for missing fields that were NOT indicated as optional.
 */
export function getInvoiceMissingFields(invoice: InvoiceData): string[] {
  const missing: string[] = [];

  // 1. Invoice Number
  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim() === '') {
    missing.push('Invoice Number');
  }

  // 2. Invoice Date
  if (!invoice.invoiceDate || invoice.invoiceDate.trim() === '') {
    missing.push('Invoice Date');
  }

  // 3. Payment Due Date
  if (!invoice.paymentDueDate || invoice.paymentDueDate.trim() === '') {
    missing.push('Payment Due Date');
  }

  // 4. Currency
  if (!invoice.currency || invoice.currency.trim() === '') {
    missing.push('Currency Used');
  }

  // 5. Purchase Order (PO) Number (Mandatory for Three-Way Matching)
  if (!invoice.purchaseOrder || invoice.purchaseOrder.trim() === '') {
    missing.push('Purchase Order (PO) Number');
  }

  // 6. Supplier Name
  if (!invoice.supplierName || invoice.supplierName.trim() === '' || invoice.supplierName.toLowerCase() === 'unknown supplier') {
    missing.push('Supplier Name');
  }

  // 6. Supplier Address
  if (!invoice.supplierAddress || invoice.supplierAddress.trim() === '') {
    missing.push('Supplier Address');
  }

  // 7. Invoice Subtotal
  if (invoice.invoiceSubtotal === undefined || invoice.invoiceSubtotal === null || invoice.invoiceSubtotal <= 0) {
    missing.push('Invoice Subtotal');
  }

  // 8. Total Tax
  if (invoice.totalTax === undefined || invoice.totalTax === null) {
    missing.push('Total Tax');
  }

  // 9. Final Amount Payable
  if (invoice.finalAmountPayable === undefined || invoice.finalAmountPayable === null || invoice.finalAmountPayable <= 0) {
    missing.push('Final Amount Payable');
  }

  // 10. Payment Terms
  if (!invoice.paymentTerms || invoice.paymentTerms.trim() === '') {
    missing.push('Payment Terms');
  }

  // 11. Accepted Payment Method
  if (!invoice.acceptedPaymentMethod || invoice.acceptedPaymentMethod.trim() === '') {
    missing.push('Accepted Payment Method');
  }

  // 12. Line Items Validation
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    missing.push('Line Items (List is empty)');
  } else {
    invoice.lineItems.forEach((item, index) => {
      const num = index + 1;
      const itemDesc = item.description && item.description.trim() !== '' ? `"${item.description}"` : `Item #${num}`;
      
      if (!item.description || item.description.trim() === '') {
        missing.push(`Line Item #${num}: Product/Service Description`);
      }
      if (item.quantity === undefined || item.quantity === null || item.quantity <= 0) {
        missing.push(`Line Item #${num} (${itemDesc}): Quantity`);
      }
      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        missing.push(`Line Item #${num} (${itemDesc}): Unit Price`);
      }
      if (item.taxRate === undefined || item.taxRate === null || item.taxRate < 0) {
        missing.push(`Line Item #${num} (${itemDesc}): Tax Rate (%)`);
      }
      if (item.taxAmount === undefined || item.taxAmount === null || item.taxAmount < 0) {
        missing.push(`Line Item #${num} (${itemDesc}): Tax Amount`);
      }
      if (item.totalAmount === undefined || item.totalAmount === null || item.totalAmount <= 0) {
        missing.push(`Line Item #${num} (${itemDesc}): Item Total Amount`);
      }
    });
  }

  return missing;
}

export interface CalculationWarning {
  id: string;
  type: 'total' | 'lineItem' | 'outstanding';
  field: string;
  expected: number;
  extracted: number;
  difference: number;
  message: string;
}

/**
 * Mathematical Validation
 * Checks:
 * 1. Subtotal - Discount + Tax + Delivery = Final Amount Payable
 * 2. Quantity * Unit Price - Item Discount + Item Tax = Line Item Total
 * 3. Final Amount Payable - Amount Already Paid = Outstanding Balance
 * Uses 0.02 tolerance for standard currency rounding.
 */
export function validateInvoiceMath(invoice: InvoiceData): CalculationWarning[] {
  const warnings: CalculationWarning[] = [];
  const round2 = (num: number) => Math.round((num || 0) * 100) / 100;
  const tolerance = 0.02;

  // 1. Header Total Check
  const subtotal = round2(invoice.invoiceSubtotal);
  const discount = round2(invoice.totalDiscount);
  const tax = round2(invoice.totalTax);
  const delivery = round2(invoice.deliveryCharges);
  const statedFinal = round2(invoice.finalAmountPayable);

  const expectedFinal = round2(subtotal - discount + tax + delivery);
  const finalDiff = round2(Math.abs(expectedFinal - statedFinal));

  if (finalDiff > tolerance) {
    warnings.push({
      id: 'warn-total',
      type: 'total',
      field: 'Final Amount Payable',
      expected: expectedFinal,
      extracted: statedFinal,
      difference: finalDiff,
      message: `Header Total Mismatch: Subtotal (${subtotal}) - Discount (${discount}) + Tax (${tax}) + Delivery (${delivery}) = Expected ${expectedFinal}, but document states ${statedFinal} (Diff: ${finalDiff}).`
    });
  }

  // 2. Line Items Check
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    invoice.lineItems.forEach((item, index) => {
      const num = index + 1;
      const qty = item.quantity || 0;
      const uPrice = item.unitPrice || 0;
      const iDiscount = item.discount || 0;
      const iTaxAmt = item.taxAmount || 0;
      const statedLineTotal = round2(item.totalAmount);

      const expectedLineTotal = round2((qty * uPrice) - iDiscount + iTaxAmt);
      const itemDiff = round2(Math.abs(expectedLineTotal - statedLineTotal));

      if (itemDiff > tolerance) {
        const desc = item.description ? `"${item.description}"` : `Line Item #${num}`;
        warnings.push({
          id: `warn-line-${index}`,
          type: 'lineItem',
          field: `Line Item #${num}`,
          expected: expectedLineTotal,
          extracted: statedLineTotal,
          difference: itemDiff,
          message: `${desc}: Qty (${qty}) × Unit Price (${uPrice}) - Discount (${iDiscount}) + Tax (${iTaxAmt}) = Expected ${expectedLineTotal}, but document states ${statedLineTotal} (Diff: ${itemDiff}).`
        });
      }
    });
  }

  // 3. Outstanding Balance Check
  const paid = round2(invoice.amountAlreadyPaid);
  const statedBalance = round2(invoice.outstandingBalance);
  const expectedBalance = round2(statedFinal - paid);
  const balanceDiff = round2(Math.abs(expectedBalance - statedBalance));

  if (balanceDiff > tolerance) {
    warnings.push({
      id: 'warn-balance',
      type: 'outstanding',
      field: 'Outstanding Balance',
      expected: expectedBalance,
      extracted: statedBalance,
      difference: balanceDiff,
      message: `Outstanding Balance Mismatch: Final Amount Payable (${statedFinal}) - Amount Paid (${paid}) = Expected ${expectedBalance}, but document states ${statedBalance} (Diff: ${balanceDiff}).`
    });
  }

  return warnings;
}

// Historical Verified Invoice Storage Ledger Version 3
const HISTORICAL_STORAGE_KEY_V3 = 'invoice_duplicate_history_v3';
const HISTORICAL_STORAGE_KEY_V2 = 'invoice_duplicate_history_v2';
const HISTORICAL_STORAGE_KEY_V1 = 'ap_verified_invoice_history_v1';

export interface LineItemSignature {
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface HistoricalInvoiceRecordV3 {
  id: string;
  normalizedSupplierName: string;
  normalizedInvoiceNumber: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate?: string;
  purchaseOrder?: string;
  currency?: string;
  invoiceSubtotal?: number;
  totalTax?: number;
  finalAmountPayable?: number;
  lineItemSignatures?: LineItemSignature[];
  fileHash?: string;
  verifiedAt: string;
}

// Backward compatibility aliases
export type HistoricalInvoiceRecord = HistoricalInvoiceRecordV3;
export type HistoricalInvoiceRecordV2 = HistoricalInvoiceRecordV3;

export function getHistoricalVerifiedInvoices(): HistoricalInvoiceRecordV3[] {
  try {
    const rawV3 = localStorage.getItem(HISTORICAL_STORAGE_KEY_V3);
    if (rawV3) {
      return JSON.parse(rawV3);
    }

    // Safely migrate from V2 if exists
    const rawV2 = localStorage.getItem(HISTORICAL_STORAGE_KEY_V2);
    if (rawV2) {
      const v2Records = JSON.parse(rawV2);
      const migrated: HistoricalInvoiceRecordV3[] = [];

      if (Array.isArray(v2Records)) {
        for (const rec of v2Records) {
          const normSup = rec.normalizedSupplierName || normalizeSupplierName(rec.supplierName);
          const normNum = rec.normalizedInvoiceNumber || normalizeInvoiceNumber(rec.invoiceNumber);

          if (normSup && normNum && !isGenericValue(rec.supplierName) && !isGenericValue(rec.invoiceNumber)) {
            migrated.push({
              id: rec.id || `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              normalizedSupplierName: normSup,
              normalizedInvoiceNumber: normNum,
              supplierName: rec.supplierName,
              invoiceNumber: rec.invoiceNumber,
              invoiceDate: rec.invoiceDate || '',
              purchaseOrder: rec.purchaseOrder || '',
              currency: rec.currency || '',
              invoiceSubtotal: typeof rec.invoiceSubtotal === 'number' ? rec.invoiceSubtotal : 0,
              totalTax: typeof rec.totalTax === 'number' ? rec.totalTax : 0,
              finalAmountPayable: typeof rec.finalAmountPayable === 'number' ? rec.finalAmountPayable : 0,
              lineItemSignatures: Array.isArray(rec.lineItemSignatures) ? rec.lineItemSignatures : [],
              fileHash: rec.fileHash,
              verifiedAt: rec.verifiedAt || new Date().toISOString()
            });
          }
        }
      }

      localStorage.setItem(HISTORICAL_STORAGE_KEY_V3, JSON.stringify(migrated));
      localStorage.removeItem(HISTORICAL_STORAGE_KEY_V2);
      return migrated;
    }

    // Safely migrate from V1 if exists
    const rawV1 = localStorage.getItem(HISTORICAL_STORAGE_KEY_V1);
    if (rawV1) {
      const v1Records = JSON.parse(rawV1);
      const migrated: HistoricalInvoiceRecordV3[] = [];

      if (Array.isArray(v1Records)) {
        for (const rec of v1Records) {
          const normSup = normalizeSupplierName(rec.supplierName);
          const normNum = normalizeInvoiceNumber(rec.invoiceNumber);

          if (normSup && normNum && !isGenericValue(rec.supplierName) && !isGenericValue(rec.invoiceNumber)) {
            migrated.push({
              id: rec.id || `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              normalizedSupplierName: normSup,
              normalizedInvoiceNumber: normNum,
              supplierName: rec.supplierName,
              invoiceNumber: rec.invoiceNumber,
              invoiceDate: rec.invoiceDate || '',
              purchaseOrder: rec.purchaseOrder || '',
              currency: rec.currency || '',
              invoiceSubtotal: typeof rec.invoiceSubtotal === 'number' ? rec.invoiceSubtotal : 0,
              totalTax: typeof rec.totalTax === 'number' ? rec.totalTax : 0,
              finalAmountPayable: typeof rec.finalAmountPayable === 'number' ? rec.finalAmountPayable : 0,
              lineItemSignatures: [],
              fileHash: rec.fileHash || rec.fileFingerprint,
              verifiedAt: rec.verifiedAt || new Date().toISOString()
            });
          }
        }
      }

      localStorage.setItem(HISTORICAL_STORAGE_KEY_V3, JSON.stringify(migrated));
      localStorage.removeItem(HISTORICAL_STORAGE_KEY_V1);
      return migrated;
    }

    return [];
  } catch (e) {
    console.error('Failed to parse historical verified invoices:', e);
    return [];
  }
}

export function saveVerifiedInvoiceToHistory(invoice: InvoiceData): void {
  try {
    const normSup = normalizeSupplierName(invoice.supplierName);
    const normNum = normalizeInvoiceNumber(invoice.invoiceNumber);

    const isSupValid = normSup !== '' && !isGenericValue(invoice.supplierName);
    const isNumValid = normNum !== '' && !isGenericValue(invoice.invoiceNumber);

    if (!isSupValid || !isNumValid) {
      return;
    }

    const history = getHistoricalVerifiedInvoices();

    const existingIndex = history.findIndex(h => 
      h.normalizedSupplierName === normSup && 
      h.normalizedInvoiceNumber === normNum
    );

    const lineItemSignatures: LineItemSignature[] = (invoice.lineItems || []).map(item => ({
      description: (item.description || '').trim(),
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      totalAmount: Number(item.totalAmount) || 0
    }));

    const record: HistoricalInvoiceRecordV3 = {
      id: invoice.id,
      normalizedSupplierName: normSup,
      normalizedInvoiceNumber: normNum,
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate || '',
      purchaseOrder: invoice.purchaseOrder || '',
      currency: invoice.currency || '',
      invoiceSubtotal: typeof invoice.invoiceSubtotal === 'number' ? invoice.invoiceSubtotal : 0,
      totalTax: typeof invoice.totalTax === 'number' ? invoice.totalTax : 0,
      finalAmountPayable: typeof invoice.finalAmountPayable === 'number' ? invoice.finalAmountPayable : 0,
      lineItemSignatures,
      fileHash: invoice.fileHash,
      verifiedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.push(record);
    }

    localStorage.setItem(HISTORICAL_STORAGE_KEY_V3, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save invoice to historical ledger:', e);
  }
}

export function clearHistoricalVerifiedInvoices(): void {
  try {
    localStorage.removeItem(HISTORICAL_STORAGE_KEY_V3);
    localStorage.removeItem(HISTORICAL_STORAGE_KEY_V2);
    localStorage.removeItem(HISTORICAL_STORAGE_KEY_V1);
  } catch (e) {
    console.error('Failed to clear historical ledger:', e);
  }
}

export function removeHistoricalVerifiedInvoice(id: string): void {
  try {
    const history = getHistoricalVerifiedInvoices();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORICAL_STORAGE_KEY_V3, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to remove individual historical record:', e);
  }
}

// Common generic / placeholder values that must NEVER trigger a duplicate match
const GENERIC_PLACEHOLDERS = new Set([
  '', 'n/a', 'na', 'none', 'unknown', 'unknown supplier', 'supplier',
  'pending', 'draft', 'null', 'undefined', '0', '0000', 'invoice', 'doc',
  'manual', 'manual_invoice', 'manual entry', 'inv', 'inv-000', 'inv-001',
  'tbd', 'to be determined', 'not specified', 'unspecified'
]);

// Generic filenames that must NEVER trigger a duplicate match on filename alone
const GENERIC_FILENAMES = new Set([
  'invoice.pdf', 'invoice.png', 'invoice.jpg', 'invoice.jpeg',
  'document.pdf', 'document.png', 'document.jpg',
  'scan.pdf', 'scan.png', 'scan.jpg',
  'file.pdf', 'file.png', 'file.jpg',
  'receipt.pdf', 'receipt.png', 'receipt.jpg',
  'upload.pdf', 'upload.png', 'upload.jpg',
  'image.pdf', 'image.png', 'image.jpg',
  'manual_invoice.pdf', 'manual_invoice.png',
  'download.pdf', 'download.png', 'download.jpg',
  'doc.pdf', 'doc.png', 'doc.jpg'
]);

export function isGenericValue(str: string | undefined | null): boolean {
  if (!str) return true;
  const clean = str.trim().toLowerCase();
  return GENERIC_PLACEHOLDERS.has(clean) || clean.length < 2;
}

export function isGenericFilename(fileName: string | undefined | null): boolean {
  if (!fileName) return true;
  const clean = fileName.trim().toLowerCase();
  return GENERIC_FILENAMES.has(clean) || clean.length < 4;
}

export function normalizeInvoiceNumber(num: string | undefined | null): string {
  if (!num) return '';
  return num
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeSupplierName(sup: string | undefined | null): string {
  if (!sup) return '';
  return sup
    .trim()
    .toLowerCase()
    .replace(/[.,'"`()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDateToYMD(dateStr?: string | null): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const clean = dateStr.trim();

  const matchYMD = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2].padStart(2, '0')}-${matchYMD[3].padStart(2, '0')}`;
  }

  const matchDMY = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function compareLineItems(itemsA?: any[], itemsB?: any[]): number {
  if (!itemsA || !itemsB || itemsA.length === 0 || itemsB.length === 0) {
    return 0;
  }

  const normA = itemsA.map(item => ({
    desc: (item.description || '').toLowerCase().replace(/[.,'"`()-]/g, ' ').replace(/\s+/g, ' ').trim(),
    qty: Number(item.quantity) || 0,
    price: Number(item.unitPrice) || 0,
    total: Number(item.totalAmount) || 0,
  }));

  const normB = itemsB.map(item => ({
    desc: (item.description || '').toLowerCase().replace(/[.,'"`()-]/g, ' ').replace(/\s+/g, ' ').trim(),
    qty: Number(item.quantity) || 0,
    price: Number(item.unitPrice) || 0,
    total: Number(item.totalAmount) || 0,
  }));

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 0;

  const usedB = new Set<number>();
  let totalMatchScore = 0;

  for (const a of normA) {
    let bestMatchIdx = -1;
    let bestScore = -1;

    for (let j = 0; j < normB.length; j++) {
      if (usedB.has(j)) continue;
      const b = normB[j];

      let descScore = 0;
      if (a.desc && b.desc && a.desc === b.desc) {
        descScore = 1.0;
      } else if (a.desc && b.desc) {
        const tokensA = new Set(a.desc.split(' ').filter(t => t.length > 2));
        const tokensB = new Set(b.desc.split(' ').filter(t => t.length > 2));
        if (tokensA.size > 0 && tokensB.size > 0) {
          let intersection = 0;
          tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
          const union = new Set([...tokensA, ...tokensB]).size;
          descScore = intersection / union;
        }
      }

      const qtyMatch = Math.abs(a.qty - b.qty) <= 0.01 ? 1 : 0;
      const priceMatch = Math.abs(a.price - b.price) <= 0.02 ? 1 : 0;
      const totalMatch = Math.abs(a.total - b.total) <= 0.02 ? 1 : 0;

      const itemScore = (descScore * 0.4) + (qtyMatch * 0.2) + (priceMatch * 0.2) + (totalMatch * 0.2);

      if (itemScore > bestScore) {
        bestScore = itemScore;
        bestMatchIdx = j;
      }
    }

    if (bestMatchIdx >= 0 && bestScore > 0.3) {
      usedB.add(bestMatchIdx);
      totalMatchScore += bestScore;
    }
  }

  const score = Math.round((totalMatchScore / maxLen) * 10);
  return Math.min(10, Math.max(0, score));
}

export interface SimilarityScoreBreakdown {
  score: number; // 0-100
  invoiceNumberPoints: number; // 0 or 30
  supplierNamePoints: number; // 0 or 15
  invoiceDatePoints: number; // 0 or 10
  poNumberPoints: number; // 0 or 10
  currencyPoints: number; // 0 or 5
  subtotalPoints: number; // 0 or 5
  taxPoints: number; // 0 or 5
  finalAmountPoints: number; // 0 or 10
  lineItemsPoints: number; // 0 to 10
}

export function computeInvoiceSimilarity(invA: any, invB: any): SimilarityScoreBreakdown {
  // 1. Complete invoice number (30 pts)
  const normNumA = normalizeInvoiceNumber(invA.invoiceNumber);
  const normNumB = normalizeInvoiceNumber(invB.invoiceNumber);
  const isNumAValid = normNumA !== '' && !isGenericValue(invA.invoiceNumber);
  const isNumBValid = normNumB !== '' && !isGenericValue(invB.invoiceNumber);

  let invoiceNumberPoints = 0;
  if (isNumAValid && isNumBValid && normNumA === normNumB) {
    invoiceNumberPoints = 30;
  }

  // 2. Supplier name (15 pts)
  const normSupA = normalizeSupplierName(invA.supplierName);
  const normSupB = normalizeSupplierName(invB.supplierName);
  const isSupAValid = normSupA !== '' && !isGenericValue(invA.supplierName);
  const isSupBValid = normSupB !== '' && !isGenericValue(invB.supplierName);

  let supplierNamePoints = 0;
  if (isSupAValid && isSupBValid && normSupA === normSupB) {
    supplierNamePoints = 15;
  }

  // 3. Invoice date (10 pts)
  const dateA = normalizeDateToYMD(invA.invoiceDate);
  const dateB = normalizeDateToYMD(invB.invoiceDate);

  let invoiceDatePoints = 0;
  if (dateA && dateB && dateA === dateB) {
    invoiceDatePoints = 10;
  }

  // 4. Purchase order number (10 pts)
  const poA = invA.purchaseOrder || invA.poNumber;
  const poB = invB.purchaseOrder || invB.poNumber;
  const normPoA = normalizeInvoiceNumber(poA);
  const normPoB = normalizeInvoiceNumber(poB);
  const isPoAValid = normPoA !== '' && !isGenericValue(poA);
  const isPoBValid = normPoB !== '' && !isGenericValue(poB);

  let poNumberPoints = 0;
  if (isPoAValid && isPoBValid && normPoA === normPoB) {
    poNumberPoints = 10;
  }

  // 5. Currency (5 pts)
  const currA = (invA.currency || '').trim().toUpperCase();
  const currB = (invB.currency || '').trim().toUpperCase();

  let currencyPoints = 0;
  if (currA !== '' && currB !== '' && currA === currB && !isGenericValue(currA)) {
    currencyPoints = 5;
  }

  // 6. Subtotal (5 pts)
  const subA = typeof invA.invoiceSubtotal === 'number' ? invA.invoiceSubtotal : (parseFloat(invA.invoiceSubtotal) || 0);
  const subB = typeof invB.invoiceSubtotal === 'number' ? invB.invoiceSubtotal : (parseFloat(invB.invoiceSubtotal) || 0);
  const hasSubA = Boolean(invA.invoiceSubtotal !== undefined && invA.invoiceSubtotal !== null && invA.invoiceSubtotal !== '');
  const hasSubB = Boolean(invB.invoiceSubtotal !== undefined && invB.invoiceSubtotal !== null && invB.invoiceSubtotal !== '');

  let subtotalPoints = 0;
  if (hasSubA && hasSubB && subA > 0 && subB > 0 && Math.abs(subA - subB) <= 0.02) {
    subtotalPoints = 5;
  }

  // 7. Total Tax (5 pts)
  const taxA = typeof invA.totalTax === 'number' ? invA.totalTax : (parseFloat(invA.totalTax) || 0);
  const taxB = typeof invB.totalTax === 'number' ? invB.totalTax : (parseFloat(invB.totalTax) || 0);
  const hasTaxA = Boolean(invA.totalTax !== undefined && invA.totalTax !== null && invA.totalTax !== '');
  const hasTaxB = Boolean(invB.totalTax !== undefined && invB.totalTax !== null && invB.totalTax !== '');

  let taxPoints = 0;
  if (hasTaxA && hasTaxB && Math.abs(taxA - taxB) <= 0.02) {
    taxPoints = 5;
  }

  // 8. Final Amount Payable (10 pts)
  const finalA = typeof invA.finalAmountPayable === 'number' ? invA.finalAmountPayable : (parseFloat(invA.finalAmountPayable) || 0);
  const finalB = typeof invB.finalAmountPayable === 'number' ? invB.finalAmountPayable : (parseFloat(invB.finalAmountPayable) || 0);
  const hasFinalA = Boolean(invA.finalAmountPayable !== undefined && invA.finalAmountPayable !== null && invA.finalAmountPayable !== '');
  const hasFinalB = Boolean(invB.finalAmountPayable !== undefined && invB.finalAmountPayable !== null && invB.finalAmountPayable !== '');

  let finalAmountPoints = 0;
  if (hasFinalA && hasFinalB && finalA > 0 && finalB > 0 && Math.abs(finalA - finalB) <= 0.02) {
    finalAmountPoints = 10;
  }

  // 9. Line Items (10 pts)
  const lineItemsA = invA.lineItems || invA.lineItemSignatures || [];
  const lineItemsB = invB.lineItems || invB.lineItemSignatures || [];

  let lineItemsPoints = compareLineItems(lineItemsA, lineItemsB);

  const score = invoiceNumberPoints + supplierNamePoints + invoiceDatePoints +
    poNumberPoints + currencyPoints + subtotalPoints + taxPoints +
    finalAmountPoints + lineItemsPoints;

  return {
    score: Math.min(100, Math.max(0, score)),
    invoiceNumberPoints,
    supplierNamePoints,
    invoiceDatePoints,
    poNumberPoints,
    currencyPoints,
    subtotalPoints,
    taxPoints,
    finalAmountPoints,
    lineItemsPoints
  };
}

export interface DuplicateDetails {
  id: string;
  isDuplicate: boolean;
  isConfirmedDuplicate: boolean;
  isPossibleDuplicate: boolean;
  similarityScore?: number;
  similarityBreakdown?: SimilarityScoreBreakdown;
  isPrimary: boolean;
  primaryId?: string;
  matchType?: 'current_batch' | 'historical';
  reason?: string;
  historicalMatch?: HistoricalInvoiceRecordV3;
  batchMatch?: InvoiceData;
  possibleMatchRecord?: {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate?: string;
    purchaseOrder?: string;
    finalAmountPayable?: number;
    verifiedAt?: string;
  };
  reviewDecision?: 'confirmed_duplicate' | 'separate_invoice' | 'pending';
  reviewerName?: string;
  reviewReason?: string;
}

/**
 * Duplicate analysis supporting:
 * 1. Confirmed Duplicate (Exact file hash or exact normalized supplier & invoice number)
 * 2. Possible Duplicate – 90%+ Similar (Weighted 100-pt whole-invoice scoring)
 * 3. Separate Invoice (< 90% score)
 */
export function analyzeDuplicates(
  invoices: InvoiceData[],
  historicalRecords: HistoricalInvoiceRecordV3[] = []
): Record<string, DuplicateDetails> {
  const results: Record<string, DuplicateDetails> = {};

  invoices.forEach(inv => {
    results[inv.id] = {
      id: inv.id,
      isDuplicate: false,
      isConfirmedDuplicate: false,
      isPossibleDuplicate: false,
      isPrimary: true,
    };
  });

  const isDecisionValid = (inv: InvoiceData): boolean => {
    if (!inv.duplicateReviewDecision || inv.duplicateReviewDecision.choice !== 'separate_invoice') {
      return false;
    }
    const snap = inv.duplicateReviewDecision.snapshot;
    if (!snap) return true;

    return (
      snap.supplierName === inv.supplierName &&
      snap.invoiceNumber === inv.invoiceNumber &&
      snap.invoiceDate === inv.invoiceDate &&
      snap.purchaseOrder === inv.purchaseOrder &&
      snap.currency === inv.currency &&
      snap.invoiceSubtotal === inv.invoiceSubtotal &&
      snap.totalTax === inv.totalTax &&
      snap.finalAmountPayable === inv.finalAmountPayable
    );
  };

  for (const inv of invoices) {
    if (inv.isDuplicateDismissed) continue;
    if (inv.status !== 'success') continue;

    const normNumInv = normalizeInvoiceNumber(inv.invoiceNumber);
    const normSupInv = normalizeSupplierName(inv.supplierName);
    const isInvNumValid = normNumInv !== '' && !isGenericValue(inv.invoiceNumber);
    const isSupInvValid = normSupInv !== '' && !isGenericValue(inv.supplierName);
    const hasHashInv = Boolean(inv.fileHash && inv.fileHash.trim() !== '');

    // 1. Check Confirmed Duplicate vs Historical Ledger
    let confirmedHistMatch: HistoricalInvoiceRecordV3 | null = null;
    let confirmedHistReason = '';

    for (const hist of historicalRecords) {
      if (hist.id === inv.id) continue;

      const normNumHist = hist.normalizedInvoiceNumber || normalizeInvoiceNumber(hist.invoiceNumber);
      const normSupHist = hist.normalizedSupplierName || normalizeSupplierName(hist.supplierName);
      const isHistNumValid = normNumHist !== '' && !isGenericValue(hist.invoiceNumber);
      const isHistSupValid = normSupHist !== '' && !isGenericValue(hist.supplierName);
      const hasHashHist = Boolean(hist.fileHash && hist.fileHash.trim() !== '');

      if (
        isInvNumValid && isHistNumValid && isSupInvValid && isHistSupValid &&
        normNumInv === normNumHist && normSupInv === normSupHist
      ) {
        confirmedHistMatch = hist;
        confirmedHistReason = `Exact supplier and invoice-number match with previously verified invoice #${hist.invoiceNumber} (${hist.supplierName}).`;
        break;
      } else if (hasHashInv && hasHashHist && inv.fileHash === hist.fileHash) {
        confirmedHistMatch = hist;
        confirmedHistReason = `Exact SHA-256 file content match with previously verified document #${hist.invoiceNumber || hist.id}.`;
        break;
      }
    }

    if (confirmedHistMatch) {
      results[inv.id] = {
        id: inv.id,
        isDuplicate: true,
        isConfirmedDuplicate: true,
        isPossibleDuplicate: false,
        isPrimary: false,
        matchType: 'historical',
        reason: confirmedHistReason,
        historicalMatch: confirmedHistMatch
      };
      continue;
    }

    // 2. Check Confirmed Duplicate vs Current Batch
    let confirmedBatchMatch: InvoiceData | null = null;
    let confirmedBatchReason = '';

    for (const otherInv of invoices) {
      if (otherInv.id === inv.id) continue;
      if (otherInv.status !== 'success') continue;

      const normNumOther = normalizeInvoiceNumber(otherInv.invoiceNumber);
      const normSupOther = normalizeSupplierName(otherInv.supplierName);
      const isNumOtherValid = normNumOther !== '' && !isGenericValue(otherInv.invoiceNumber);
      const isSupOtherValid = normSupOther !== '' && !isGenericValue(otherInv.supplierName);
      const hasHashOther = Boolean(otherInv.fileHash && otherInv.fileHash.trim() !== '');

      if (
        isInvNumValid && isNumOtherValid && isSupInvValid && isSupOtherValid &&
        normNumInv === normNumOther && normSupInv === normSupOther
      ) {
        confirmedBatchMatch = otherInv;
        confirmedBatchReason = `Exact supplier and invoice-number match with #${otherInv.invoiceNumber} in the current batch.`;
        break;
      } else if (hasHashInv && hasHashOther && inv.fileHash === otherInv.fileHash) {
        confirmedBatchMatch = otherInv;
        confirmedBatchReason = `Exact SHA-256 file content match with #${otherInv.invoiceNumber || otherInv.fileName} in the current batch.`;
        break;
      }
    }

    if (confirmedBatchMatch) {
      results[inv.id] = {
        id: inv.id,
        isDuplicate: true,
        isConfirmedDuplicate: true,
        isPossibleDuplicate: false,
        isPrimary: false,
        primaryId: confirmedBatchMatch.id,
        matchType: 'current_batch',
        reason: confirmedBatchReason,
        batchMatch: confirmedBatchMatch
      };
      continue;
    }

    // 3. Calculate Weighted Similarity Score (0-100) for Possible Duplicate Detection
    let maxScore = 0;
    let maxBreakdown: SimilarityScoreBreakdown | undefined;
    let maxHistMatch: HistoricalInvoiceRecordV3 | undefined;
    let maxBatchMatch: InvoiceData | undefined;
    let maxMatchType: 'historical' | 'current_batch' = 'current_batch';

    for (const hist of historicalRecords) {
      if (hist.id === inv.id) continue;
      const breakdown = computeInvoiceSimilarity(inv, hist);
      if (breakdown.score > maxScore) {
        maxScore = breakdown.score;
        maxBreakdown = breakdown;
        maxHistMatch = hist;
        maxMatchType = 'historical';
      }
    }

    for (const otherInv of invoices) {
      if (otherInv.id === inv.id) continue;
      if (otherInv.status !== 'success') continue;

      const breakdown = computeInvoiceSimilarity(inv, otherInv);
      if (breakdown.score > maxScore) {
        maxScore = breakdown.score;
        maxBreakdown = breakdown;
        maxBatchMatch = otherInv;
        maxMatchType = 'current_batch';
      }
    }

    if (maxScore >= 90) {
      const decisionOverridden = isDecisionValid(inv);
      const targetSupplier = maxMatchType === 'historical' ? maxHistMatch?.supplierName : maxBatchMatch?.supplierName;
      const targetNum = maxMatchType === 'historical' ? maxHistMatch?.invoiceNumber : maxBatchMatch?.invoiceNumber;

      results[inv.id] = {
        id: inv.id,
        isDuplicate: !decisionOverridden,
        isConfirmedDuplicate: false,
        isPossibleDuplicate: true,
        similarityScore: maxScore,
        similarityBreakdown: maxBreakdown,
        isPrimary: false,
        primaryId: maxBatchMatch?.id,
        matchType: maxMatchType,
        reason: `Possible Duplicate – ${maxScore}% Similar to ${targetSupplier || 'invoice'} #${targetNum || ''}`,
        historicalMatch: maxHistMatch,
        batchMatch: maxBatchMatch,
        possibleMatchRecord: maxMatchType === 'historical' ? {
          supplierName: maxHistMatch?.supplierName || '',
          invoiceNumber: maxHistMatch?.invoiceNumber || '',
          invoiceDate: maxHistMatch?.invoiceDate,
          purchaseOrder: maxHistMatch?.purchaseOrder,
          finalAmountPayable: maxHistMatch?.finalAmountPayable,
          verifiedAt: maxHistMatch?.verifiedAt
        } : {
          supplierName: maxBatchMatch?.supplierName || '',
          invoiceNumber: maxBatchMatch?.invoiceNumber || '',
          invoiceDate: maxBatchMatch?.invoiceDate,
          purchaseOrder: maxBatchMatch?.purchaseOrder,
          finalAmountPayable: maxBatchMatch?.finalAmountPayable,
        },
        reviewDecision: inv.duplicateReviewDecision?.choice || 'pending',
        reviewerName: inv.duplicateReviewDecision?.reviewerName,
        reviewReason: inv.duplicateReviewDecision?.reviewReason
      };
    } else {
      results[inv.id] = {
        id: inv.id,
        isDuplicate: false,
        isConfirmedDuplicate: false,
        isPossibleDuplicate: false,
        similarityScore: maxScore,
        similarityBreakdown: maxBreakdown,
        isPrimary: true
      };
    }
  }

  return results;
}

/**
 * Calculates all plain-language reasons why an invoice requires human review.
 */
export function getInvoiceReviewReasons(
  invoice: InvoiceData,
  duplicateDetails?: DuplicateDetails
): string[] {
  const reasons: string[] = [];

  // 1. Extraction Error / Unreadable File
  if (invoice.status === 'error') {
    reasons.push(invoice.errorMessage || "Review required because AI document extraction failed or file is unreadable.");
    return reasons;
  }

  // 2. Missing Mandatory Fields (including PO Number)
  const missingFields = getInvoiceMissingFields(invoice);
  if (missingFields.length > 0) {
    missingFields.forEach(field => {
      reasons.push(`Review required because mandatory field '${field}' is missing.`);
    });
  }

  // 3. Duplicate Match
  if (duplicateDetails?.isDuplicate && !invoice.isDuplicateDismissed) {
    reasons.push(`Review required because ${duplicateDetails.reason || 'this invoice matches a previously processed document.'}`);
  }

  // 4. Calculation Differences
  const mathWarnings = validateInvoiceMath(invoice);
  if (mathWarnings.length > 0 && !invoice.calcOverrideConfirmed) {
    mathWarnings.forEach(warn => {
      const curr = invoice.currency ? `${invoice.currency} ` : '';
      if (warn.type === 'total') {
        reasons.push(`Review required because calculated final amount (${curr}${warn.expected.toFixed(2)}) differs from printed final amount (${curr}${warn.extracted.toFixed(2)}) by ${curr}${warn.difference.toFixed(2)}.`);
      } else if (warn.type === 'lineItem') {
        reasons.push(`Review required because line item calculated total (${curr}${warn.expected.toFixed(2)}) differs from printed total (${curr}${warn.extracted.toFixed(2)}).`);
      } else if (warn.type === 'outstanding') {
        reasons.push(`Review required because calculated outstanding balance (${curr}${warn.expected.toFixed(2)}) differs from printed balance (${curr}${warn.extracted.toFixed(2)}).`);
      }
    });
  }

  // 5. Filename-derived Suggested Invoice Number
  if (invoice.suggestedInvoiceNumber && invoice.invoiceNumber !== invoice.suggestedInvoiceNumber) {
    reasons.push(`Review required because the invoice number '${invoice.suggestedInvoiceNumber}' was suggested from the filename and differs from extracted text ('${invoice.invoiceNumber || 'None'}').`);
  }

  // 6. Unclear Currency
  if (!invoice.currency || invoice.currency.trim() === '') {
    if (!missingFields.includes('Currency Used')) {
      reasons.push("Review required because the invoice currency was not shown clearly.");
    }
  }

  // 7. AI Review Notes / Low Confidence / Handwritten / Ambiguous
  if (invoice.aiReviewNotes && invoice.aiReviewNotes.length > 0) {
    invoice.aiReviewNotes.forEach(note => {
      if (note.confidence === 'Low') {
        reasons.push(`Review required because critical field '${note.field || 'information'}' has low extraction confidence.`);
      }
      if (note.requiresConfirmation) {
        if (!reasons.includes(`Review required: ${note.message}`)) {
          reasons.push(`Review required: ${note.message}`);
        }
      }
      const msgLower = (note.message || '').toLowerCase();
      if (msgLower.includes('handwritten') || msgLower.includes('blurry') || msgLower.includes('unclear') || msgLower.includes('ambiguous')) {
        const msg = `Review required because document text appears unclear or handwritten: ${note.message}`;
        if (!reasons.includes(msg)) {
          reasons.push(msg);
        }
      }
    });
  }

  return reasons;
}

export interface InvoiceValidationSummary {
  status: 'auto_validated' | 'human_verified' | 'needs_review' | 'duplicate' | 'extraction_failed' | 'rejected' | 'on_hold';
  statusLabel: string;
  statusBadgeClass: string;
  isAutoValidated: boolean;
  isHumanVerified: boolean;
  isReadyForExport: boolean;
  reasonsForReview: string[];
}

/**
 * Computes the overall exception-based validation summary for an invoice.
 */
export function getInvoiceValidationSummary(
  invoice: InvoiceData,
  duplicateDetails?: DuplicateDetails
): InvoiceValidationSummary {
  if (invoice.status === 'error') {
    return {
      status: 'extraction_failed',
      statusLabel: 'Extraction Failed',
      statusBadgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      isAutoValidated: false,
      isHumanVerified: false,
      isReadyForExport: false,
      reasonsForReview: [invoice.errorMessage || 'AI document extraction failed.']
    };
  }

  // Explicit Rejected status takes precedence
  if (invoice.isRejected) {
    return {
      status: 'rejected',
      statusLabel: 'Invoice Rejected',
      statusBadgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-semibold',
      isAutoValidated: false,
      isHumanVerified: false,
      isReadyForExport: false,
      reasonsForReview: [invoice.rejectionReason ? `Rejected: ${invoice.rejectionReason}` : 'Invoice rejected by Accounts Payable operator.']
    };
  }

  // Explicit On-Hold status takes precedence
  if (invoice.isOnHold) {
    return {
      status: 'on_hold',
      statusLabel: 'Invoice On Hold',
      statusBadgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-semibold',
      isAutoValidated: false,
      isHumanVerified: false,
      isReadyForExport: false,
      reasonsForReview: [invoice.holdReason ? `On Hold: ${invoice.holdReason}` : 'Invoice placed on hold pending vendor or document resolution.']
    };
  }

  const reasons = getInvoiceReviewReasons(invoice, duplicateDetails);
  const isDup = duplicateDetails?.isDuplicate && !invoice.isDuplicateDismissed;

  // Human verified path
  if (invoice.isVerified) {
    const missing = getInvoiceMissingFields(invoice);
    const mathWarns = validateInvoiceMath(invoice);
    const hasUnresolvedMath = mathWarns.length > 0 && !invoice.calcOverrideConfirmed;

    if (missing.length === 0 && !isDup && !hasUnresolvedMath) {
      return {
        status: 'human_verified',
        statusLabel: 'Human-Verified – Ready for Three-Way Match',
        statusBadgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold',
        isAutoValidated: false,
        isHumanVerified: true,
        isReadyForExport: true,
        reasonsForReview: []
      };
    }
  }

  // Duplicate path
  if (isDup) {
    return {
      status: 'duplicate',
      statusLabel: 'Duplicate Invoice',
      statusBadgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
      isAutoValidated: false,
      isHumanVerified: false,
      isReadyForExport: false,
      reasonsForReview: reasons
    };
  }

  // Auto-validated path
  if (reasons.length === 0) {
    return {
      status: 'auto_validated',
      statusLabel: 'Auto-Validated – Ready for Three-Way Match',
      statusBadgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-semibold',
      isAutoValidated: true,
      isHumanVerified: false,
      isReadyForExport: true,
      reasonsForReview: []
    };
  }

  // Needs human review path
  return {
    status: 'needs_review',
    statusLabel: 'Needs Human Review',
    statusBadgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
    isAutoValidated: false,
    isHumanVerified: false,
    isReadyForExport: false,
    reasonsForReview: reasons
  };
}
