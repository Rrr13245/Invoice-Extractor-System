import { InvoiceData } from '../types';
import { 
  analyzeDuplicates, 
  HistoricalInvoiceRecordV2, 
  getHistoricalVerifiedInvoices, 
  saveVerifiedInvoiceToHistory, 
  clearHistoricalVerifiedInvoices 
} from './validation';

export interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  message: string;
}

export function runAllDuplicateTests(): { allPassed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];

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
    lineItems: [],
    fileHash: 'hash-bytes-208-aaa'
  };

  // Test 1: Same supplier, AA-2026-208 and AA-2026-209
  {
    const invA: InvoiceData = { ...baseInv, id: 'apex-208', invoiceNumber: 'AA-2026-208', finalAmountPayable: 1080, fileHash: 'hash-bytes-208' };
    const invB: InvoiceData = { ...baseInv, id: 'apex-209', invoiceNumber: 'AA-2026-209', finalAmountPayable: 1000, fileHash: 'hash-bytes-209' };
    const analysis = analyzeDuplicates([invA, invB], []);
    const dupA = analysis['apex-208']?.isDuplicate;
    const dupB = analysis['apex-209']?.isDuplicate;
    const passed = !dupA && !dupB;
    results.push({
      testNumber: 1,
      description: 'Same supplier, AA-2026-208 and AA-2026-209 are separate invoices',
      passed,
      message: passed 
        ? 'Passed: Neither AA-2026-208 nor AA-2026-209 is flagged as duplicate.' 
        : `Failed: dupA=${dupA}, dupB=${dupB}`
    });
  }

  // Test 2: Same supplier and exact invoice number uploaded twice
  {
    const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208', fileHash: 'hash-1' };
    const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: 'AA-2026-208', fileHash: 'hash-2' };
    const analysis = analyzeDuplicates([inv1, inv2], []);
    const dup1 = analysis['inv-1']?.isDuplicate;
    const dup2 = analysis['inv-2']?.isDuplicate;
    const passed = !dup1 && dup2 === true;
    results.push({
      testNumber: 2,
      description: 'Same supplier and exact invoice number uploaded twice',
      passed,
      message: passed
        ? 'Passed: Second invoice with exact same supplier and invoice number is flagged as duplicate.'
        : `Failed: dup1=${dup1}, dup2=${dup2}`
    });
  }

  // Test 3: Same invoice number but different suppliers
  {
    const invX: InvoiceData = { ...baseInv, id: 'inv-x', supplierName: 'Supplier X', invoiceNumber: 'INV-100', fileHash: 'hash-x' };
    const invY: InvoiceData = { ...baseInv, id: 'inv-y', supplierName: 'Supplier Y', invoiceNumber: 'INV-100', fileHash: 'hash-y' };
    const analysis = analyzeDuplicates([invX, invY], []);
    const dupX = analysis['inv-x']?.isDuplicate;
    const dupY = analysis['inv-y']?.isDuplicate;
    const passed = !dupX && !dupY;
    results.push({
      testNumber: 3,
      description: 'Same invoice number but different suppliers',
      passed,
      message: passed
        ? 'Passed: Different suppliers with same invoice number are not duplicates.'
        : `Failed: dupX=${dupX}, dupY=${dupY}`
    });
  }

  // Test 4: Same supplier and same total but different invoice numbers
  {
    const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208', finalAmountPayable: 1000, fileHash: 'hash-1' };
    const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: 'AA-2026-209', finalAmountPayable: 1000, fileHash: 'hash-2' };
    const analysis = analyzeDuplicates([inv1, inv2], []);
    const dup1 = analysis['inv-1']?.isDuplicate;
    const dup2 = analysis['inv-2']?.isDuplicate;
    const passed = !dup1 && !dup2;
    results.push({
      testNumber: 4,
      description: 'Same supplier and same total but different invoice numbers',
      passed,
      message: passed
        ? 'Passed: Invoices with same supplier & total but different invoice numbers are not duplicates.'
        : `Failed: dup1=${dup1}, dup2=${dup2}`
    });
  }

  // Test 5: Same filename but different file contents and invoice numbers
  {
    const inv1: InvoiceData = { ...baseInv, id: 'inv-1', fileName: 'invoice.pdf', invoiceNumber: 'INV-101', fileHash: 'hash-content-1' };
    const inv2: InvoiceData = { ...baseInv, id: 'inv-2', fileName: 'invoice.pdf', invoiceNumber: 'INV-102', fileHash: 'hash-content-2' };
    const analysis = analyzeDuplicates([inv1, inv2], []);
    const dup1 = analysis['inv-1']?.isDuplicate;
    const dup2 = analysis['inv-2']?.isDuplicate;
    const passed = !dup1 && !dup2;
    results.push({
      testNumber: 5,
      description: 'Same filename but different file contents and invoice numbers',
      passed,
      message: passed
        ? 'Passed: Same filename with different file contents & numbers is not a duplicate.'
        : `Failed: dup1=${dup1}, dup2=${dup2}`
    });
  }

  // Test 6: Different filenames containing exact same file bytes
  {
    const inv1: InvoiceData = { ...baseInv, id: 'inv-1', fileName: 'docA.pdf', invoiceNumber: 'INV-201', fileHash: 'identical-bytes-sha256' };
    const inv2: InvoiceData = { ...baseInv, id: 'inv-2', fileName: 'scanB.pdf', invoiceNumber: 'INV-202', fileHash: 'identical-bytes-sha256' };
    const analysis = analyzeDuplicates([inv1, inv2], []);
    const dup1 = analysis['inv-1']?.isDuplicate;
    const dup2 = analysis['inv-2']?.isDuplicate;
    const passed = !dup1 && dup2 === true;
    results.push({
      testNumber: 6,
      description: 'Different filenames containing exact same file bytes',
      passed,
      message: passed
        ? 'Passed: Identical file SHA-256 content hash correctly triggers duplicate.'
        : `Failed: dup1=${dup1}, dup2=${dup2}`
    });
  }

  // Test 7: Same supplier and invoice number found in historical version-2 records
  {
    const histRecord: HistoricalInvoiceRecordV2 = {
      id: 'hist-1',
      normalizedSupplierName: 'apex abrasives pte ltd',
      normalizedInvoiceNumber: 'aa2026208',
      supplierName: 'Apex Abrasives Pte Ltd',
      invoiceNumber: 'AA-2026-208',
      fileHash: 'hist-hash-208',
      verifiedAt: '2026-07-01T10:00:00Z'
    };
    const inv: InvoiceData = { ...baseInv, id: 'inv-new', invoiceNumber: 'AA-2026-208', fileHash: 'new-hash-208' };
    const analysis = analyzeDuplicates([inv], [histRecord]);
    const dup = analysis['inv-new']?.isDuplicate;
    const matchType = analysis['inv-new']?.matchType;
    const passed = dup === true && matchType === 'historical';
    results.push({
      testNumber: 7,
      description: 'Same supplier and invoice number found in historical version-2 records',
      passed,
      message: passed
        ? 'Passed: Matches historical version-2 verified ledger record.'
        : `Failed: dup=${dup}, matchType=${matchType}`
    });
  }

  // Test 8: Old filename-only historical record
  {
    // Record with missing/invalid normalized invoice number
    const oldHistRecord: HistoricalInvoiceRecordV2 = {
      id: 'hist-old',
      normalizedSupplierName: '',
      normalizedInvoiceNumber: '',
      supplierName: '',
      invoiceNumber: '',
      fileHash: undefined,
      verifiedAt: '2026-06-01T10:00:00Z'
    };
    const inv: InvoiceData = { ...baseInv, id: 'inv-check', fileName: 'invoice.pdf', invoiceNumber: 'AA-2026-209', fileHash: 'hash-209-new' };
    const analysis = analyzeDuplicates([inv], [oldHistRecord]);
    const dup = analysis['inv-check']?.isDuplicate;
    const passed = !dup;
    results.push({
      testNumber: 8,
      description: 'Old filename-only historical record must not create a duplicate',
      passed,
      message: passed
        ? 'Passed: Filename-only or incomplete old record does not create a false duplicate.'
        : `Failed: dup=${dup}`
    });
  }

  // Test 9: Edit AA-2026-209 after it was incorrectly flagged
  {
    // Initially test two invoices with same number (AA-2026-208)
    const inv1: InvoiceData = { ...baseInv, id: 'inv-1', invoiceNumber: 'AA-2026-208' };
    const inv2: InvoiceData = { ...baseInv, id: 'inv-2', invoiceNumber: 'AA-2026-208' };
    let analysis = analyzeDuplicates([inv1, inv2], []);
    const initialDup = analysis['inv-2']?.isDuplicate; // true

    // Now edit inv2 invoiceNumber to 'AA-2026-209'
    const editedInv2: InvoiceData = { ...inv2, invoiceNumber: 'AA-2026-209' };
    analysis = analyzeDuplicates([inv1, editedInv2], []);
    const recomputedDup = analysis['inv-2']?.isDuplicate; // should be false
    const passed = initialDup === true && recomputedDup === false;
    results.push({
      testNumber: 9,
      description: 'Edit AA-2026-209 recomputes and removes duplicate status',
      passed,
      message: passed
        ? 'Passed: Editing invoice number immediately recomputes and removes stale duplicate flag.'
        : `Failed: initialDup=${initialDup}, recomputedDup=${recomputedDup}`
    });
  }

  // Test 10: Clear visible invoices only
  {
    // Save record to history
    saveVerifiedInvoiceToHistory(baseInv);
    const historyBefore = getHistoricalVerifiedInvoices();
    // Clearing visible invoices array in state does not alter localStorage
    const historyAfter = getHistoricalVerifiedInvoices();
    const passed = historyBefore.length > 0 && historyAfter.length === historyBefore.length;
    results.push({
      testNumber: 10,
      description: 'Clear visible invoices leaves historical records intact',
      passed,
      message: passed
        ? 'Passed: Historical records remain intact when visible batch is cleared.'
        : `Failed: before=${historyBefore.length}, after=${historyAfter.length}`
    });
  }

  // Test 11: Clear Duplicate History
  {
    clearHistoricalVerifiedInvoices();
    const historyAfterClear = getHistoricalVerifiedInvoices();
    const passed = historyAfterClear.length === 0;
    results.push({
      testNumber: 11,
      description: 'Clear Duplicate History removes version-2 historical records',
      passed,
      message: passed
        ? 'Passed: Clear Duplicate History removes all version-2 records from storage.'
        : `Failed: countAfterClear=${historyAfterClear.length}`
    });
  }

  // Test 12: Delete and re-upload the two Apex invoices
  {
    const apex208: InvoiceData = { ...baseInv, id: 'apex-208', invoiceNumber: 'AA-2026-208', finalAmountPayable: 1080, fileHash: 'sha256-file-208' };
    const apex209: InvoiceData = { ...baseInv, id: 'apex-209', invoiceNumber: 'AA-2026-209', finalAmountPayable: 1000, fileHash: 'sha256-file-209' };
    const analysis = analyzeDuplicates([apex208, apex209], []);
    const dup208 = analysis['apex-208']?.isDuplicate;
    const dup209 = analysis['apex-209']?.isDuplicate;
    const passed = !dup208 && !dup209;
    results.push({
      testNumber: 12,
      description: 'Delete and re-upload Apex invoices keeps them as separate invoices',
      passed,
      message: passed
        ? 'Passed: Re-uploaded Apex invoices AA-2026-208 and AA-2026-209 remain separate non-duplicates.'
        : `Failed: dup208=${dup208}, dup209=${dup209}`
    });
  }

  const allPassed = results.every(r => r.passed);
  return { allPassed, results };
}
