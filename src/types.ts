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

export type InvoiceValidationStatus = 
  | 'auto_validated'
  | 'human_verified'
  | 'needs_review'
  | 'duplicate'
  | 'extraction_failed'
  | 'rejected'
  | 'on_hold';

export interface AiReviewNote {
  field?: string;
  sourceType?: 'printed' | 'calculated' | 'suggested' | 'not_found';
  confidence?: 'High' | 'Medium' | 'Low';
  message: string;
  requiresConfirmation?: boolean;
}

export interface DuplicateReviewDecision {
  choice: 'confirmed_duplicate' | 'separate_invoice' | 'pending';
  reviewerName?: string;
  reviewReason?: string;
  reviewedAt?: string;
  snapshot?: {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    purchaseOrder: string;
    currency: string;
    invoiceSubtotal: number;
    totalTax: number;
    finalAmountPayable: number;
  };
}

export interface InvoiceData {
  id: string; // Internal unique ID
  fileName: string; // Name of the uploaded file
  fileType: string; // PDF, JPEG, PNG
  fileDataUrl?: string; // Optional base64 or blob URL of the uploaded document
  base64Data?: string; // Optional raw base64 data for retrying AI extraction
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  isVerified?: boolean; // User explicit verification flag
  isRejected?: boolean; // User explicit rejection flag
  rejectionReason?: string;
  isOnHold?: boolean; // User explicit on hold flag
  holdReason?: string;

  // Internal Audit & Review Fields (Not exported to Excel):
  suggestedInvoiceNumber?: string;
  aiReviewNotes?: AiReviewNote[];
  calcOverrideConfirmed?: boolean;
  calcOverrideReason?: string;
  isDuplicateDismissed?: boolean;
  duplicateReviewDecision?: DuplicateReviewDecision;
  fileFingerprint?: string;
  fileHash?: string; // Cryptographic SHA-256 hash of uploaded file content
  validationStatus?: InvoiceValidationStatus;

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
