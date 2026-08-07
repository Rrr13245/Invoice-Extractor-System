import { InvoiceData } from '../types';
import { 
  analyzeDuplicates, 
  computeInvoiceSimilarity,
  normalizeSupplierName,
  normalizeReference,
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
      invoiceNumber: '201',
      invoiceDate: '2026-07-15',
      paymentDueDate: '2026-08-15',
      currency: 'SGD',
      purchaseOrder: 'PO-9921',
      grnReference: 'GRN-4412',
      supplierName: 'Tan Brothers Metal Works Pte Ltd',
      supplierAddress: '12 Tuas Avenue 4, Singapore 639234',
      supplierContact: 'sales@tanbrothers.com',
      businessRegistrationOrTaxId: '200412345K',
      bankDetails: 'DBS Bank',
      bankAccount: '120-98765-4',
      invoiceSubtotal: 2500,
      totalDiscount: 0,
      totalTax: 225,
      deliveryCharges: 0,
      finalAmountPayable: 2725,
      amountAlreadyPaid: 0,
      outstandingBalance: 2725,
      paymentTerms: 'Net 30',
      acceptedPaymentMethod: 'Bank Transfer',
      latePaymentTerms: '',
      lineItems: [
        { id: 'item-1', description: 'Steel Angles 50x50x5mm', quantity: 200, unitPrice: 12.50, discount: 0, taxRate: 9, taxAmount: 225, totalAmount: 2500 }
      ],
      fileHash: 'tan-hash-201'
    };

    // Test 1: Tan Brothers 201 vs 218 - incomplete mandatory fields but matching transaction -> Possible Duplicate AND Missing Fields
    {
      const inv201: InvoiceData = { ...baseInv, id: 'tan-201', invoiceNumber: '201' };
      const inv218: InvoiceData = { ...baseInv, id: 'tan-218', invoiceNumber: '' }; // missing mandatory field!

      const analysis = analyzeDuplicates([inv201, inv218], []);
      const dup218 = analysis['tan-218'];
      const summary218 = getInvoiceValidationSummary(inv218, dup218);
      const missing218 = getInvoiceMissingFields(inv218);

      const isPossible = dup218?.isPossibleDuplicate === true && (dup218.similarityScore || 0) >= 90;
      const hasMissingWarn = summary218.reasonsForReview.some(r => r.toLowerCase().includes('invoice number'));
      const hasDupWarn = summary218.reasonsForReview.some(r => r.toLowerCase().includes('duplicate') || r.toLowerCase().includes('transaction match'));

      const passed = isPossible && missing218.length > 0 && hasMissingWarn && hasDupWarn;
      results.push({
        testNumber: 1,
        description: 'Tan Brothers 201 vs 218: incomplete invoice flagged as Possible Duplicate AND Missing Mandatory Fields independently',
        passed,
        message: passed
          ? `Passed: Score=${dup218?.similarityScore}%, both missing-field and duplicate warnings generated independently.`
          : `Failed: isPossible=${isPossible}, score=${dup218?.similarityScore}, missingWarn=${hasMissingWarn}, dupWarn=${hasDupWarn}`
      });
    }

    // Test 2: Weighted scoring weights verification (Supplier 20%, Date 15%, PO 20%, GRN 20%, Items 25%)
    {
      const invA: InvoiceData = { ...baseInv, id: 'weight-a' };
      const invB: InvoiceData = { ...baseInv, id: 'weight-b' };

      const breakdown = computeInvoiceSimilarity(invA, invB);
      const passed = breakdown.supplierNamePoints === 20 &&
                     breakdown.invoiceDatePoints === 15 &&
                     breakdown.poNumberPoints === 20 &&
                     breakdown.grnNumberPoints === 20 &&
                     breakdown.lineItemsPoints === 25 &&
                     breakdown.adjustedScore === 100;

      results.push({
        testNumber: 2,
        description: 'Weighted scoring weights verified (Supplier 20%, Date 15%, PO 20%, GRN 20%, Items 25%)',
        passed,
        message: passed
          ? 'Passed: Breakdown points match 20/15/20/20/25 allocation exactly.'
          : `Failed: ${JSON.stringify(breakdown)}`
      });
    }

    // Test 3: Supplier corporate suffix and formatting normalization (PTE LTD vs Pte. Ltd.)
    {
      const normA = normalizeSupplierName('Tan Brothers Metal Works PTE LTD');
      const normB = normalizeSupplierName('Tan Brothers Metal Works Pte. Ltd.');
      const normC = normalizeSupplierName('TAN BROTHERS METAL WORKS PRIVATE LIMITED');

      const passed = normA === 'tan brothers metal works' &&
                     normA === normB &&
                     normB === normC;

      results.push({
        testNumber: 3,
        description: 'Supplier corporate suffix normalization (PTE LTD vs Pte. Ltd. vs Private Limited)',
        passed,
        message: passed
          ? `Passed: All normalized to '${normA}'.`
          : `Failed: normA='${normA}', normB='${normB}', normC='${normC}'`
      });
    }

    // Test 4: PO and GRN reference normalization (PO-9921 vs PO/9921 vs PO 9921 vs 9921)
    {
      const normPO1 = normalizeReference('PO-9921');
      const normPO2 = normalizeReference('PO/9921');
      const normPO3 = normalizeReference('PO 9921');
      const normPO4 = normalizeReference('9921');

      const normGRN1 = normalizeReference('GRN-4412');
      const normGRN2 = normalizeReference('GRN/4412');

      const passed = normPO1 === '9921' &&
                     normPO1 === normPO2 &&
                     normPO2 === normPO3 &&
                     normPO3 === normPO4 &&
                     normGRN1 === '4412' &&
                     normGRN1 === normGRN2;

      results.push({
        testNumber: 4,
        description: 'PO and GRN reference normalization (ignores prefix, slashes, dashes, spaces)',
        passed,
        message: passed
          ? `Passed: PO normalized to '${normPO1}', GRN normalized to '${normGRN1}'.`
          : `Failed: normPO1='${normPO1}', normGRN1='${normGRN1}'`
      });
    }

    // Test 5: Exact supplier name and invoice number match -> Confirmed Duplicate
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: '201', fileHash: 'hash-1' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: '201', fileHash: 'hash-2' };

      const analysis = analyzeDuplicates([inv1, inv2], []);
      const isConfirmed = analysis['inv-2']?.isConfirmedDuplicate;
      const isDup = analysis['inv-2']?.isDuplicate;

      const passed = isConfirmed === true && isDup === true;
      results.push({
        testNumber: 5,
        description: 'Exact supplier and invoice number match -> Confirmed Duplicate',
        passed,
        message: passed
          ? 'Passed: Exact supplier and invoice number matched as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}, isDup=${isDup}`
      });
    }

    // Test 6: SHA-256 byte hash match -> Confirmed Duplicate
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: '201', fileHash: 'sha256-exact-bytes' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: '218', fileHash: 'sha256-exact-bytes' };

      const analysis = analyzeDuplicates([inv1, inv2], []);
      const isConfirmed = analysis['inv-2']?.isConfirmedDuplicate;

      const passed = isConfirmed === true;
      results.push({
        testNumber: 6,
        description: 'Exact SHA-256 file byte match -> Confirmed Duplicate',
        passed,
        message: passed
          ? 'Passed: SHA-256 match correctly flagged as confirmed duplicate.'
          : `Failed: isConfirmed=${isConfirmed}`
      });
    }

    // Test 7: Non-matching supplier -> cannot be a Possible Duplicate
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', supplierName: 'Apex Hardware Pte Ltd' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-2', supplierName: 'Tan Brothers Metal Works' };

      const breakdown = computeInvoiceSimilarity(inv1, inv2);
      const analysis = analyzeDuplicates([inv1, inv2], []);

      const passed = breakdown.supplierMatch === false && analysis['inv-2']?.isPossibleDuplicate === false;
      results.push({
        testNumber: 7,
        description: 'Non-matching suppliers prevent duplicate classification',
        passed,
        message: passed
          ? 'Passed: Different suppliers properly prevented duplicate match.'
          : `Failed: breakdown=${JSON.stringify(breakdown)}`
      });
    }

    // Test 8: Matching transaction details with different invoice numbers -> Possible Duplicate (score >= 90%)
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-201', invoiceNumber: '201' };
      const inv2: InvoiceData = { ...baseInv, id: 'inv-218', invoiceNumber: '218' };

      const breakdown = computeInvoiceSimilarity(inv1, inv2);
      const analysis = analyzeDuplicates([inv1, inv2], []);
      const detail = analysis['inv-218'];

      const passed = breakdown.adjustedScore === 100 && detail?.isPossibleDuplicate === true;
      results.push({
        testNumber: 8,
        description: 'Different invoice numbers with matching transaction -> Possible Duplicate (100% adjusted score)',
        passed,
        message: passed
          ? `Passed: Score=${detail?.similarityScore}%, reason='${detail?.reason}'`
          : `Failed: score=${detail?.similarityScore}, isPossible=${detail?.isPossibleDuplicate}`
      });
    }

    // Test 9: Two incomplete invoices with insufficient transaction evidence -> not flagged as duplicate
    {
      const inc1: InvoiceData = {
        ...baseInv,
        id: 'inc-1',
        supplierName: 'Tan Brothers',
        invoiceNumber: '',
        invoiceDate: '',
        purchaseOrder: '',
        grnReference: '',
        lineItems: []
      };
      const inc2: InvoiceData = {
        ...baseInv,
        id: 'inc-2',
        supplierName: 'Tan Brothers',
        invoiceNumber: '',
        invoiceDate: '',
        purchaseOrder: '',
        grnReference: '',
        lineItems: []
      };

      const analysis = analyzeDuplicates([inc1, inc2], []);
      const detail = analysis['inc-2'];

      const passed = detail?.isPossibleDuplicate === false && detail?.isDuplicate === false;
      results.push({
        testNumber: 9,
        description: 'Incomplete invoices with insufficient transaction evidence not flagged as duplicates',
        passed,
        message: passed
          ? 'Passed: Insufficient transaction evidence prevents false duplicate.'
          : `Failed: detail=${JSON.stringify(detail)}`
      });
    }

    // Test 10: Human review decision ('separate_invoice') removes duplicate blocker
    {
      const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: '201' };
      const inv2: InvoiceData = {
        ...baseInv,
        id: 'inv-2',
        invoiceNumber: '218',
        duplicateReviewDecision: {
          choice: 'separate_invoice',
          reviewerName: 'Madam Lim',
          reviewReason: 'Verified separate order delivered under different PO release.',
          snapshot: {
            supplierName: baseInv.supplierName,
            invoiceNumber: '218',
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
      const detail = analysis['inv-2'];

      const passed = detail?.isDuplicate === false;
      results.push({
        testNumber: 10,
        description: 'Human review decision choice="separate_invoice" removes duplicate blocker',
        passed,
        message: passed
          ? 'Passed: Reviewer decision separate_invoice correctly cleared duplicate status.'
          : `Failed: isDuplicate=${detail?.isDuplicate}`
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
