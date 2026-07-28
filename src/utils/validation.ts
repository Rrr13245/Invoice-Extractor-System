import { InvoiceData } from '../types';

/**
 * Validates an invoice against the accounts payable requirements.
 * Checks for missing fields that were NOT indicated as "if available", "if provided", "if stated", etc.
 * 
 * Required fields under the AP clerk specification:
 * - invoice number
 * - invoice date
 * - payment due date
 * - currency used
 * - supplier name
 * - supplier address
 * - invoice subtotal before tax
 * - total tax
 * - final amount payable
 * - payment terms
 * - accepted payment method
 * 
 * Required line items fields:
 * - product or service description
 * - quantity
 * - unit price
 * - tax rate and tax amount
 * - amount for each item
 * 
 * Optional fields (indicated with "if available/provided/stated"):
 * - supplier contact detail if available
 * - business registration or tax if available
 * - Purchase order if available
 * - bank details if provided
 * - discount if available
 * - total discount if available
 * - Delivery or additional charges if available
 * - amount already paid and outstanding balance if available
 * - bank account and late payment terms if stated
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

  // 5. Supplier Name
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

  // 10. Total Tax
  if (invoice.totalTax === undefined || invoice.totalTax === null) {
    missing.push('Total Tax');
  }

  // 11. Final Amount Payable
  if (invoice.finalAmountPayable === undefined || invoice.finalAmountPayable === null || invoice.finalAmountPayable <= 0) {
    missing.push('Final Amount Payable');
  }

  // 12. Payment Terms
  if (!invoice.paymentTerms || invoice.paymentTerms.trim() === '') {
    missing.push('Payment Terms');
  }

  // 13. Accepted Payment Method
  if (!invoice.acceptedPaymentMethod || invoice.acceptedPaymentMethod.trim() === '') {
    missing.push('Accepted Payment Method');
  }

  // 14. Line Items Validation
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

export interface DuplicateDetails {
  id: string;
  isDuplicate: boolean;
  isPrimary: boolean; // True for the first occurrence we keep, false for subsequent duplicates
  primaryId?: string; // The ID of the first invoice in the duplicate set
  reason?: 'Invoice Number and Supplier' | 'Filename';
}

/**
 * Analyzes a list of invoices and determines if there are duplicates.
 * An invoice is a duplicate of a previous invoice in the list if:
 * 1. Their filenames match (trimmed, case-insensitive, non-empty)
 * 2. OR, both are successfully processed, and their trimmed, case-insensitive invoice numbers AND supplier names match.
 */
export function analyzeDuplicates(invoices: InvoiceData[]): Record<string, DuplicateDetails> {
  const results: Record<string, DuplicateDetails> = {};
  
  // Initialize all as non-duplicates
  invoices.forEach(inv => {
    results[inv.id] = {
      id: inv.id,
      isDuplicate: false,
      isPrimary: true,
    };
  });

  // Pair-wise check to see if an invoice is a duplicate of a PREVIOUS invoice in the array
  for (let i = 0; i < invoices.length; i++) {
    const invA = invoices[i];
    
    // Check if invA is a duplicate of any previous invoice invB (where j < i)
    for (let j = 0; j < i; j++) {
      const invB = invoices[j];
      
      let isDup = false;
      let reason: 'Invoice Number and Supplier' | 'Filename' | undefined = undefined;

      // Rule 1: Filename match (if filename is not empty)
      if (
        invA.fileName && 
        invB.fileName && 
        invA.fileName.trim().toLowerCase() === invB.fileName.trim().toLowerCase()
      ) {
        isDup = true;
        reason = 'Filename';
      }
      
      // Rule 2: Invoice number and Supplier Name match (if both status are success and fields are not empty)
      if (!isDup && invA.status === 'success' && invB.status === 'success') {
        const numA = (invA.invoiceNumber || '').trim().toLowerCase();
        const numB = (invB.invoiceNumber || '').trim().toLowerCase();
        const supA = (invA.supplierName || '').trim().toLowerCase();
        const supB = (invB.supplierName || '').trim().toLowerCase();

        if (numA && numB && numA === numB && supA && supB && supA === supB) {
          isDup = true;
          reason = 'Invoice Number and Supplier';
        }
      }

      if (isDup) {
        // Find the primary of invB (it might itself be a duplicate, so resolve to its primary)
        let primaryId = invB.id;
        const bMeta = results[invB.id];
        if (bMeta && bMeta.isDuplicate && bMeta.primaryId) {
          primaryId = bMeta.primaryId;
        }

        results[invA.id] = {
          id: invA.id,
          isDuplicate: true,
          isPrimary: false,
          primaryId,
          reason,
        };
        break; // Found the earliest duplicate, move to next invoice
      }
    }
  }

  return results;
}
