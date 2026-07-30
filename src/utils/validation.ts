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

// Historical Verified Invoice Storage Ledger Version 2
const HISTORICAL_STORAGE_KEY_V2 = 'invoice_duplicate_history_v2';
const HISTORICAL_STORAGE_KEY_V1 = 'ap_verified_invoice_history_v1';

export interface HistoricalInvoiceRecordV2 {
  id: string;
  normalizedSupplierName: string;
  normalizedInvoiceNumber: string;
  supplierName: string;
  invoiceNumber: string;
  fileHash?: string;
  verifiedAt: string;
}

// Backward compatibility alias
export type HistoricalInvoiceRecord = HistoricalInvoiceRecordV2;

export function getHistoricalVerifiedInvoices(): HistoricalInvoiceRecordV2[] {
  try {
    const rawV2 = localStorage.getItem(HISTORICAL_STORAGE_KEY_V2);
    if (rawV2) {
      return JSON.parse(rawV2);
    }

    // Safely migrate from V1 IF AND ONLY IF V1 contains valid non-generic supplier & invoice number
    const rawV1 = localStorage.getItem(HISTORICAL_STORAGE_KEY_V1);
    if (rawV1) {
      const v1Records = JSON.parse(rawV1);
      const migrated: HistoricalInvoiceRecordV2[] = [];

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
              fileHash: rec.fileHash || rec.fileFingerprint,
              verifiedAt: rec.verifiedAt || new Date().toISOString()
            });
          }
        }
      }

      localStorage.setItem(HISTORICAL_STORAGE_KEY_V2, JSON.stringify(migrated));
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

    const record: HistoricalInvoiceRecordV2 = {
      id: invoice.id,
      normalizedSupplierName: normSup,
      normalizedInvoiceNumber: normNum,
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      fileHash: invoice.fileHash,
      verifiedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      history[existingIndex] = record;
    } else {
      history.push(record);
    }

    localStorage.setItem(HISTORICAL_STORAGE_KEY_V2, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save invoice to historical ledger:', e);
  }
}

export function clearHistoricalVerifiedInvoices(): void {
  try {
    localStorage.removeItem(HISTORICAL_STORAGE_KEY_V2);
    localStorage.removeItem(HISTORICAL_STORAGE_KEY_V1);
  } catch (e) {
    console.error('Failed to clear historical ledger:', e);
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

export interface DuplicateDetails {
  id: string;
  isDuplicate: boolean;
  isPrimary: boolean;
  primaryId?: string;
  matchType?: 'current_batch' | 'historical';
  reason?: string;
}

/**
 * Duplicate analysis comparing batch items and historical verified ledger.
 * Strictly enforces Rule 1 (Exact supplier & invoice number) and Rule 2 (Exact SHA-256 file content hash).
 */
export function analyzeDuplicates(
  invoices: InvoiceData[],
  historicalRecords: HistoricalInvoiceRecordV2[] = []
): Record<string, DuplicateDetails> {
  const results: Record<string, DuplicateDetails> = {};

  invoices.forEach(inv => {
    results[inv.id] = {
      id: inv.id,
      isDuplicate: false,
      isPrimary: true,
    };
  });

  // 1. Check against Historical Ledger
  for (const inv of invoices) {
    if (inv.isDuplicateDismissed) continue;
    if (inv.status !== 'success') continue;

    const normNumInv = normalizeInvoiceNumber(inv.invoiceNumber);
    const normSupInv = normalizeSupplierName(inv.supplierName);
    const isInvNumValid = normNumInv !== '' && !isGenericValue(inv.invoiceNumber);
    const isSupInvValid = normSupInv !== '' && !isGenericValue(inv.supplierName);
    const hasHashInv = Boolean(inv.fileHash && inv.fileHash.trim() !== '');

    for (const hist of historicalRecords) {
      if (hist.id === inv.id) continue;

      const normNumHist = hist.normalizedSupplierName ? hist.normalizedInvoiceNumber : normalizeInvoiceNumber(hist.invoiceNumber);
      const normSupHist = hist.normalizedSupplierName || normalizeSupplierName(hist.supplierName);
      const isHistNumValid = normNumHist !== '' && !isGenericValue(hist.invoiceNumber);
      const isHistSupValid = normSupHist !== '' && !isGenericValue(hist.supplierName);
      const hasHashHist = Boolean(hist.fileHash && hist.fileHash.trim() !== '');

      let isHistDup = false;
      let histReason = '';

      // Rule 1: Exact supplier AND exact invoice number match
      if (
        isInvNumValid && isHistNumValid && isSupInvValid && isHistSupValid &&
        normNumInv === normNumHist && normSupInv === normSupHist
      ) {
        isHistDup = true;
        histReason = `Exact supplier and invoice-number match with a previously verified invoice.`;
      }
      // Rule 2: Exact file content SHA-256 hash match
      else if (
        hasHashInv && hasHashHist &&
        inv.fileHash === hist.fileHash
      ) {
        isHistDup = true;
        histReason = `The exact same file content was uploaded more than once.`;
      }

      if (isHistDup) {
        results[inv.id] = {
          id: inv.id,
          isDuplicate: true,
          isPrimary: false,
          matchType: 'historical',
          reason: histReason
        };
        break;
      }
    }
  }

  // 2. Check within Current Batch
  for (let i = 0; i < invoices.length; i++) {
    const invA = invoices[i];
    if (invA.isDuplicateDismissed) continue;
    if (invA.status !== 'success') continue;
    if (results[invA.id]?.isDuplicate) continue;

    const normNumA = normalizeInvoiceNumber(invA.invoiceNumber);
    const normSupA = normalizeSupplierName(invA.supplierName);
    const isNumAValid = normNumA !== '' && !isGenericValue(invA.invoiceNumber);
    const isSupAValid = normSupA !== '' && !isGenericValue(invA.supplierName);
    const hasHashA = Boolean(invA.fileHash && invA.fileHash.trim() !== '');

    for (let j = i + 1; j < invoices.length; j++) {
      const invB = invoices[j];
      if (invB.isDuplicateDismissed) continue;
      if (invB.status !== 'success') continue;
      if (results[invB.id]?.isDuplicate) continue;

      const normNumB = normalizeInvoiceNumber(invB.invoiceNumber);
      const normSupB = normalizeSupplierName(invB.supplierName);
      const isNumBValid = normNumB !== '' && !isGenericValue(invB.invoiceNumber);
      const isSupBValid = normSupB !== '' && !isGenericValue(invB.supplierName);
      const hasHashB = Boolean(invB.fileHash && invB.fileHash.trim() !== '');

      let isBatchDup = false;
      let batchReason = '';

      // Rule 1: Exact supplier AND exact invoice number match
      if (
        isNumAValid && isNumBValid && isSupAValid && isSupBValid &&
        normNumA === normNumB && normSupA === normSupB
      ) {
        isBatchDup = true;
        batchReason = `Exact supplier and invoice-number match in the current batch.`;
      }
      // Rule 2: Exact file content SHA-256 hash match
      else if (
        hasHashA && hasHashB &&
        invA.fileHash === invB.fileHash
      ) {
        isBatchDup = true;
        batchReason = `The exact same file content was uploaded more than once.`;
      }

      if (isBatchDup) {
        results[invB.id] = {
          id: invB.id,
          isDuplicate: true,
          isPrimary: false,
          primaryId: invA.id,
          matchType: 'current_batch',
          reason: batchReason
        };
      }
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
  status: 'auto_validated' | 'human_verified' | 'needs_review' | 'duplicate' | 'extraction_failed';
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
