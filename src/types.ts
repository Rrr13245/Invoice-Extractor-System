export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Discount amount or percentage for this item, if available (0 if none)
  taxRate: number;   // Tax rate percentage, e.g., 15 for 15% (0 if none)
  taxAmount: number; // Tax amount for this item
  totalAmount: number; // Final amount for this item (qty * unitPrice - discount + taxAmount, or as stated)
}

export interface InvoiceData {
  id: string; // Internal unique ID
  fileName: string; // Name of the uploaded file
  fileType: string; // PDF, JPEG, PNG
  fileDataUrl?: string; // Optional base64 or blob URL of the uploaded document
  base64Data?: string; // Optional raw base64 data for retrying AI extraction
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  isVerified?: boolean; // User or automatic verification flag

  // Extracted Fields:
  invoiceNumber: string;
  invoiceDate: string;
  paymentDueDate: string;
  currency: string;
  purchaseOrder: string;
  supplierName: string;
  supplierAddress: string;
  supplierContact: string;
  businessRegistrationOrTaxId: string;
  bankDetails: string; // Combined bank details if provided
  bankAccount: string; // Specific bank account if provided
  invoiceSubtotal: number;
  totalDiscount: number;
  totalTax: number;
  deliveryCharges: number;
  finalAmountPayable: number;
  amountAlreadyPaid: number;
  outstandingBalance: number;
  paymentTerms: string;
  acceptedPaymentMethod: string;
  latePaymentTerms: string;

  // Line Items:
  lineItems: InvoiceLineItem[];
}
