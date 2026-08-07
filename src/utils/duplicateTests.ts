import { InvoiceData } from '../types';
import { 
  analyzeDuplicates, 
  HistoricalInvoiceRecordV3, 
  getHistoricalVerifiedInvoices, 
  saveVerifiedInvoiceToHistory, 
  clearHistoricalVerifiedInvoices,
  getInvoiceValidationSummary,
  getInvoiceMissingFields
} from './validation';

export interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  message: string;
}

export function runAllDuplicateTests(): { allPassed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];
  const snapshotV3 = typeof localStorage !== 'undefined' ? localStorage.getItem('invoice_duplicate_history_v3') : null;
  const snapshotV2 = typeof localStorage !== 'undefined' ? localStorage.getItem('invoice_duplicate_history_v2') : null;

  try {
    const baseInv: InvoiceData = {
      id: 'inv-base',
      fileName: 'invoice1.pdf',
      fileType: 'application/pdf',
      status: 'success',
      invoiceNumber: 'AA-2026-208',
      invoiceDate: '2026-07-20',
      paymentDueDate: '2026-08-20',
      currency: 'SGD',
      purchaseOrder: 'PO-100',
      supplierName: 'Apex Abrasives Pte Ltd',
      supplierAddress: '123 Industrial Park',
      supplierContact: 'sales@apex.com',
      businessRegistrationOrTaxId: 'TAX-123',
      bankDetails: 'Bank XYZ',
      bankAccount: 'ACC-123',
      invoiceSubtotal: 1000,
      totalDiscount: 0,
      totalTax: 80,
      deliveryCharges: 0,
      finalAmountPayable: 1080,
      amountAlreadyPaid: 0,
      outstandingBalance: 1080,
      paymentTerms: 'Net 30',
      acceptedPaymentMethod: 'Bank Transfer',
      latePaymentTerms: '',
      lineItems: [
        { id: 'item-1', description: 'Grinding Disc 100mm', quantity: 10, unitPrice: 100, discount: 0, taxRate: 8, taxAmount: 80, totalAmount: 1000 }
      ],
      fileHash: 'hash-bytes-208-aaa'
    };

    // Test 1: AA-2026-208 versus AA-2026-209, with all other fields identical
    {
      const invA: InvoiceData = { ...baseInv, id: 'apex-208', invoiceNumber: 'AA-2026-208', fileHash: 'hash-bytes-208' };
      const invB: InvoiceData = { ...baseInv, id: 'apex-209', invoiceNumber: 'AA-2026-209', fileHash: 'hash-bytes-209' };
      const analysis = analyzeDuplicates([invA, invB], []);
      const scoreB = analysis['apex-209']?.similarityScore || 0;
      const dupB = analysis['apex-209']?.isDuplicate;
      const passed = scoreB <= 70 && dupB === false;
      results.push({
        testNumber: 1,
        description: 'AA-2026-208 versus AA-2026-209 (max score 70%; separate invoice)',
        passed,
        message: passed 
          ? `Passed: Score is ${scoreB}% (<= 70%), not flagged as duplicate.` 
          : `Failed: scoreB=${scoreB}%, dupB=${dupB}`
      });
    }

    // Test 2: Same supplier and exact invoice number
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208', fileHash: 'hash-1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: 'AA-2026-208', fileHash: 'hash-2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const isConfirmed = analysis['inv-2']?.isConfirmedDuplicate;
      const isDup = analysis['inv-2']?.isDuplicate;
      const passed = isConfirmed === true && isDup === true;
      results.push({
        testNumber: 2,
        description: 'Same supplier and exact invoice number (confirmed duplicate)',
        passed,
        message: passed
          ? 'Passed: Exact supplier and invoice number matched as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}, isDup=${isDup}`
      });
    }

    // Test 3: Exact same file bytes but different filenames
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', fileName: 'docA.pdf', invoiceNumber: 'INV-201', fileHash: 'sha256-exact-bytes' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', fileName: 'scanB.pdf', invoiceNumber: 'INV-202', fileHash: 'sha256-exact-bytes' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const isConfirmed = analysis['inv-2']?.isConfirmedDuplicate;
      const isDup = analysis['inv-2']?.isDuplicate;
      const passed = isConfirmed === true && isDup === true;
      results.push({
        testNumber: 3,
        description: 'Exact same file bytes but different filenames (confirmed duplicate)',
        passed,
        message: passed
          ? 'Passed: SHA-256 byte hash match correctly flagged as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}, isDup=${isDup}`
      });
    }

    // Test 4: Same filename but different file contents and invoice numbers
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', fileName: 'invoice.pdf', invoiceNumber: 'INV-101', fileHash: 'hash-content-1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', fileName: 'invoice.pdf', invoiceNumber: 'INV-102', fileHash: 'hash-content-2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const dup1 = analysis['inv-1']?.isDuplicate;
      const dup2 = analysis['inv-2']?.isDuplicate;
      const passed = !dup1 && !dup2;
      results.push({
        testNumber: 4,
        description: 'Same filename but different file contents and invoice numbers (separate invoices)',
        passed,
        message: passed
          ? 'Passed: Different contents and numbers with same filename are treated as separate invoices.'
          : `Failed: dup1=${dup1}, dup2=${dup2}`
      });
    }

    // Test 5: Same supplier, number, date, PO, amounts and line items but a different scan
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208', fileHash: 'scan-hash-1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: 'AA-2026-208', fileHash: 'scan-hash-2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const dup2 = analysis['inv-2']?.isDuplicate;
      const passed = dup2 === true;
      results.push({
        testNumber: 5,
        description: 'Same supplier, number, date, PO, amounts and line items (different scan)',
        passed,
        message: passed
          ? 'Passed: Exact supplier and invoice number match flagged as duplicate.'
          : `Failed: dup2=${dup2}`
      });
    }

    // Test 6: Same supplier template but different number, date, amounts and items
    {
      const inv1: InvoiceData = { 
        ...baseInv, 
        id: 'inv-1', 
        invoiceNumber: 'AA-2026-001', 
        invoiceDate: '2026-01-01', 
        purchaseOrder: 'PO-001', 
        invoiceSubtotal: 100, 
        totalTax: 8, 
        finalAmountPayable: 108,
        lineItems: [{ id: '1', description: 'Wrench', quantity: 1, unitPrice: 100, discount: 0, taxRate: 8, taxAmount: 8, totalAmount: 100 }],
        fileHash: 'hash-template-1' 
      };
      const inv2: InvoiceData = { 
        ...baseInv, 
        id: 'inv-2', 
        invoiceNumber: 'AA-2026-002', 
        invoiceDate: '2026-02-01', 
        purchaseOrder: 'PO-002', 
        invoiceSubtotal: 500, 
        totalTax: 40, 
        finalAmountPayable: 540,
        lineItems: [{ id: '1', description: 'Safety Helmet', quantity: 5, unitPrice: 100, discount: 0, taxRate: 8, taxAmount: 40, totalAmount: 500 }],
        fileHash: 'hash-template-2' 
      };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const score2 = analysis['inv-2']?.similarityScore || 0;
      const dup2 = analysis['inv-2']?.isDuplicate;
      const passed = score2 < 90 && dup2 === false;
      results.push({
        testNumber: 6,
        description: 'Same supplier template but different number, date, amounts and items (low similarity)',
        passed,
        message: passed
          ? `Passed: Score is ${score2}% (< 90%), separate invoice.`
          : `Failed: score2=${score2}%, dup2=${dup2}`
      });
    }

    // Test 7: Minor supplier punctuation difference with all invoice information matching
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', supplierName: 'Apex Abrasives Pte Ltd', invoiceNumber: 'AA-2026-208', fileHash: 'hash-p1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', supplierName: 'APEX ABRASIVES PTE. LTD.', invoiceNumber: 'AA-2026-208', fileHash: 'hash-p2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const dup2 = analysis['inv-2']?.isDuplicate;
      const passed = dup2 === true;
      results.push({
        testNumber: 7,
        description: 'Minor supplier punctuation difference with all invoice info matching',
        passed,
        message: passed
          ? 'Passed: Harmless punctuation difference normalized, flagged as duplicate.'
          : `Failed: dup2=${dup2}`
      });
    }

    // Test 8: Different supplier with the same invoice number
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', supplierName: 'Supplier Delta', invoiceNumber: 'INV-888', fileHash: 'hash-d1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', supplierName: 'Supplier Echo', invoiceNumber: 'INV-888', fileHash: 'hash-d2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const isConfirmed = analysis['inv-2']?.isConfirmedDuplicate;
      const passed = isConfirmed === false;
      results.push({
        testNumber: 8,
        description: 'Different supplier with the same invoice number (not a confirmed duplicate)',
        passed,
        message: passed
          ? 'Passed: Different suppliers with same invoice number not marked as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}`
      });
    }

    // Test 9: Tan Brothers invoice 201 and 218 with missing mandatory fields but >= 90% document similarity
    {
      const tanText = "Tan Brothers Metal Works Pte Ltd 12 Tuas Avenue 4 Singapore 639234 TAX ID 200412345K INVOICE Date 2026-07-15 PO PO-9921 Item Steel Angles 50x50x5mm Qty 200 Unit $12.50 Total $2500.00 Subtotal $2500.00 GST $225.00 Total Payable $2725.00 Bank DBS 120-98765-4";
      const inv201: InvoiceData = {
        ...baseInv,
        id: 'tan-201',
        supplierName: 'Tan Brothers Metal Works Pte Ltd',
        invoiceNumber: '201',
        invoiceDate: '2026-07-15',
        purchaseOrder: 'PO-9921',
        finalAmountPayable: 2725,
        rawDocumentText: tanText,
        fileHash: 'tan-hash-201'
      };
      const inv218: InvoiceData = {
        ...baseInv,
        id: 'tan-218',
        supplierName: 'Tan Brothers Metal Works Pte Ltd',
        invoiceNumber: '', // missing mandatory field!
        invoiceDate: '2026-07-15',
        purchaseOrder: 'PO-9921',
        finalAmountPayable: 2725,
        rawDocumentText: tanText,
        fileHash: 'tan-hash-218'
      };

      const analysis = analyzeDuplicates([inv201, inv218], []);
      const dup218 = analysis['tan-218'];
      const summary218 = getInvoiceValidationSummary(inv218, dup218);
      const missing218 = getInvoiceMissingFields(inv218);

      const hasMissingWarn = summary218.reasonsForReview.some(r => r.includes('Invoice Number'));
      const hasDupWarn = summary218.reasonsForReview.some(r => r.includes('Possible Duplicate') || r.includes('Similar') || r.includes('matches'));
      const isPossible = dup218?.isPossibleDuplicate && (dup218.similarityScore || 0) >= 90;

      const passed = isPossible && missing218.length > 0 && hasMissingWarn && hasDupWarn;
      results.push({
        testNumber: 9,
        description: 'Tan Brothers 201 vs 218 with missing mandatory fields: possible duplicate and missing-field warnings both appear',
        passed,
        message: passed
          ? `Passed: Score=${dup218?.similarityScore}%, flagged as possible duplicate AND missing fields warning present.`
          : `Failed: isPossible=${isPossible}, score=${dup218?.similarityScore}, missingWarn=${hasMissingWarn}, dupWarn=${hasDupWarn}`
      });
    }

    // Test 10: Two incomplete invoices with insufficient comparable information
    {
      const inc1: InvoiceData = { 
        ...baseInv, 
        id: 'inc-1', 
        supplierName: 'Apex', 
        invoiceNumber: '', 
        invoiceDate: '', 
        purchaseOrder: '', 
        currency: '', 
        invoiceSubtotal: 0, 
        totalTax: 0, 
        finalAmountPayable: 0, 
        lineItems: [],
        rawDocumentText: 'Apex',
        fileHash: 'inc-hash-1' 
      };
      const inc2: InvoiceData = { 
        ...baseInv, 
        id: 'inc-2', 
        supplierName: 'Apex', 
        invoiceNumber: '', 
        invoiceDate: '', 
        purchaseOrder: '', 
        currency: '', 
        invoiceSubtotal: 0, 
        totalTax: 0, 
        finalAmountPayable: 0, 
        lineItems: [],
        rawDocumentText: 'Apex',
        fileHash: 'inc-hash-2' 
      };
      const analysis = analyzeDuplicates([inc1, inc2], []);
      const score2 = analysis['inc-2']?.similarityScore || 0;
      const dup2 = analysis['inc-2']?.isDuplicate;
      const passed = score2 < 90 && dup2 === false;
      results.push({
        testNumber: 10,
        description: 'Two incomplete invoices with insufficient comparable information (do not flag as duplicates)',
        passed,
        message: passed
          ? `Passed: Score is ${score2}% (< 90%), weak incomplete records are not flagged as duplicates.`
          : `Failed: score2=${score2}%, dup2=${dup2}`
      });
    }

    // Test 11: Exact same file with missing fields (confirmed duplicate)
    {
      const inc1: InvoiceData = { ...baseInv, id: 'file-1', invoiceNumber: '', fileHash: 'exact-sha256-hash-xyz' };
      const inc2: InvoiceData = { ...baseInv, id: 'file-2', invoiceNumber: '', fileHash: 'exact-sha256-hash-xyz' };
      const analysis = analyzeDuplicates([inc1, inc2], []);
      const isConfirmed = analysis['file-2']?.isConfirmedDuplicate;
      const isDup = analysis['file-2']?.isDuplicate;
      const passed = isConfirmed === true && isDup === true;
      results.push({
        testNumber: 11,
        description: 'Exact same file with missing fields (confirmed duplicate)',
        passed,
        message: passed
          ? 'Passed: SHA-256 byte hash match on incomplete document correctly flagged as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}, isDup=${isDup}`
      });
    }

    // Test 12: Different invoice numbers with >=90% document similarity and strongly matching transaction details
    {
      const textA = "Supplier Metal Works Invoice 301 Date 2026-07-15 PO-100 SGD Subtotal 1000 Tax 80 Total 1080 Grinding Disc";
      const textB = "Supplier Metal Works Invoice 302 Date 2026-07-15 PO-100 SGD Subtotal 1000 Tax 80 Total 1080 Grinding Disc";
      const inv1: InvoiceData = { ...baseInv, id: 'inv-301', invoiceNumber: '301', rawDocumentText: textA, fileHash: 'hash-301' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-302', invoiceNumber: '302', rawDocumentText: textB, fileHash: 'hash-302' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const score2 = analysis['inv-302']?.similarityScore || 0;
      const isPossible = analysis['inv-302']?.isPossibleDuplicate;
      const passed = score2 >= 90 && isPossible === true;
      results.push({
        testNumber: 12,
        description: 'Different invoice numbers with >= 90% document similarity (possible duplicate requiring human review)',
        passed,
        message: passed
          ? `Passed: Score is ${score2}% (>= 90%), flagged as possible duplicate for human review.`
          : `Failed: score2=${score2}%, isPossible=${isPossible}`
      });
    }

    // Test 13: Retain highest-scoring comparison candidate and score for debugging
    {
      const inv1: InvoiceData = { ...baseInv, id: 'debug-1', invoiceNumber: 'INV-101', fileHash: 'hash-dbg-1' };
      const inv2: InvoiceData = { ...baseInv, id: 'debug-2', invoiceNumber: 'INV-102', fileHash: 'hash-dbg-2' };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const detail = analysis['debug-2'];
      const passed = detail && detail.similarityScore !== undefined && detail.similarityBreakdown !== undefined;
      results.push({
        testNumber: 13,
        description: 'Highest-scoring comparison candidate and score are retained for debugging',
        passed,
        message: passed
          ? `Passed: Retained score=${detail?.similarityScore}%, breakdown present.`
          : `Failed: detail=${JSON.stringify(detail)}`
      });
    }

    // Test 14: Possible duplicate confirmed as separate by Madam Lim
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208', fileHash: 'hash-m1' };
      const inv2: InvoiceData = { 
        ...baseInv, 
        id: 'inv-2', 
        invoiceNumber: 'AA-2026-209', 
        fileHash: 'hash-m2',
        duplicateReviewDecision: {
          choice: 'separate_invoice',
          reviewerName: 'Madam Lim',
          reviewReason: 'Different invoice numbers and different goods; supplier used same template.',
          snapshot: {
            supplierName: baseInv.supplierName,
            invoiceNumber: 'AA-2026-209',
            invoiceDate: baseInv.invoiceDate,
            purchaseOrder: baseInv.purchaseOrder,
            currency: baseInv.currency,
            invoiceSubtotal: baseInv.invoiceSubtotal,
            totalTax: baseInv.totalTax,
            finalAmountPayable: baseInv.finalAmountPayable
          }
        }
      };
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const dup2 = analysis['inv-2']?.isDuplicate;
      const passed = dup2 === false;
      results.push({
        testNumber: 14,
        description: 'Possible duplicate confirmed as separate by Madam Lim (blocker removed)',
        passed,
        message: passed
          ? 'Passed: Review decision separate_invoice successfully removes duplicate blocker.'
          : `Failed: dup2=${dup2}`
      });
    }

    const allPassed = results.every(r => r.passed);
    return { allPassed, results };
  } finally {
    if (typeof localStorage !== 'undefined') {
      if (snapshotV3 !== null) {
        localStorage.setItem('invoice_duplicate_history_v3', snapshotV3);
      } else {
        localStorage.removeItem('invoice_duplicate_history_v3');
      }

      if (snapshotV2 !== null) {
        localStorage.setItem('invoice_duplicate_history_v2', snapshotV2);
      } else {
        localStorage.removeItem('invoice_duplicate_history_v2');
      }
    }
  }
}

