import * as XLSX from 'xlsx';
import { InvoiceData } from '../types';

export function exportInvoicesToExcel(invoices: InvoiceData[], fileName: string = 'Invoices_Export.xlsx') {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // 1. Prepare Invoice Summary Sheet Data
  const summaryRows = invoices.map(inv => ({
    'Invoice Number': inv.invoiceNumber || 'N/A',
    'Invoice Date': inv.invoiceDate || 'N/A',
    'Payment Due Date': inv.paymentDueDate || 'N/A',
    'Currency': inv.currency || 'N/A',
    'Purchase Order (PO)': inv.purchaseOrder || 'N/A',
    'Supplier Name': inv.supplierName || 'N/A',
    'Supplier Address': inv.supplierAddress || 'N/A',
    'Supplier Contact Details': inv.supplierContact || 'N/A',
    'Business Reg / Tax ID': inv.businessRegistrationOrTaxId || 'N/A',
    'Invoice Subtotal': inv.invoiceSubtotal || 0,
    'Total Discount': inv.totalDiscount || 0,
    'Total Tax': inv.totalTax || 0,
    'Delivery/Additional Charges': inv.deliveryCharges || 0,
    'Final Amount Payable': inv.finalAmountPayable || 0,
    'Amount Already Paid': inv.amountAlreadyPaid || 0,
    'Outstanding Balance': inv.outstandingBalance || 0,
    'Payment Terms': inv.paymentTerms || 'N/A',
    'Accepted Payment Method': inv.acceptedPaymentMethod || 'N/A',
    'Bank Details': inv.bankDetails || 'N/A',
    'Bank Account / IBAN': inv.bankAccount || 'N/A',
    'Late Payment Terms': inv.latePaymentTerms || 'N/A',
    'Source File Name': inv.fileName
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  // Set column widths for summary sheet to make it highly readable
  const summaryWidths = [
    { wch: 18 }, // Invoice Number
    { wch: 14 }, // Invoice Date
    { wch: 18 }, // Payment Due Date
    { wch: 10 }, // Currency
    { wch: 18 }, // PO
    { wch: 25 }, // Supplier Name
    { wch: 30 }, // Supplier Address
    { wch: 25 }, // Supplier Contact
    { wch: 20 }, // Tax ID
    { wch: 16 }, // Subtotal
    { wch: 14 }, // Discount
    { wch: 12 }, // Tax
    { wch: 18 }, // Delivery
    { wch: 20 }, // Final Amount
    { wch: 18 }, // Amount Paid
    { wch: 20 }, // Outstanding
    { wch: 16 }, // Payment Terms
    { wch: 22 }, // Accepted Payment Method
    { wch: 30 }, // Bank Details
    { wch: 25 }, // Bank Account
    { wch: 25 }, // Late Payment Terms
    { wch: 25 }  // File Name
  ];
  summarySheet['!cols'] = summaryWidths;

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Invoices Summary');

  // 2. Prepare Detailed Line Items Sheet Data
  const itemRows: any[] = [];
  invoices.forEach(inv => {
    if (inv.lineItems && inv.lineItems.length > 0) {
      inv.lineItems.forEach(item => {
        itemRows.push({
          'Invoice Number': inv.invoiceNumber || 'N/A',
          'Supplier Name': inv.supplierName || 'N/A',
          'Product / Service Description': item.description || 'N/A',
          'Quantity': item.quantity || 1,
          'Unit Price': item.unitPrice || 0,
          'Discount (Item)': item.discount || 0,
          'Tax Rate (%)': item.taxRate || 0,
          'Tax Amount (Item)': item.taxAmount || 0,
          'Total Amount': item.totalAmount || 0,
          'Currency': inv.currency || 'N/A'
        });
      });
    } else {
      // Create a fallback empty row if an invoice has no items, just to be safe
      itemRows.push({
        'Invoice Number': inv.invoiceNumber || 'N/A',
        'Supplier Name': inv.supplierName || 'N/A',
        'Product / Service Description': 'No line items extracted',
        'Quantity': 0,
        'Unit Price': 0,
        'Discount (Item)': 0,
        'Tax Rate (%)': 0,
        'Tax Amount (Item)': 0,
        'Total Amount': 0,
        'Currency': inv.currency || 'N/A'
      });
    }
  });

  const itemsSheet = XLSX.utils.json_to_sheet(itemRows);

  // Set column widths for line items sheet
  const itemsWidths = [
    { wch: 18 }, // Invoice Number
    { wch: 25 }, // Supplier Name
    { wch: 40 }, // Description
    { wch: 10 }, // Quantity
    { wch: 14 }, // Unit Price
    { wch: 16 }, // Discount
    { wch: 12 }, // Tax Rate
    { wch: 16 }, // Tax Amount
    { wch: 16 }, // Total Amount
    { wch: 10 }  // Currency
  ];
  itemsSheet['!cols'] = itemsWidths;

  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Granular Line Items');

  // Trigger the browser file save dialog
  XLSX.writeFile(wb, fileName);
}
