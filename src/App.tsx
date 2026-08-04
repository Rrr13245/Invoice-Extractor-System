import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  Download, 
  FileText, 
  Coins,
  RefreshCw,
  Info,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  User,
  MapPin,
  PhoneCall,
  Hash,
  ShieldAlert,
  Percent,
  AlertTriangle,
  Eye,
  Columns,
  LayoutList,
  FileSearch,
  CheckSquare,
  History,
  X,
  HelpCircle,
  FileCheck,
  Check,
  Layers,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceData, InvoiceLineItem } from './types';
import { exportInvoicesToExcel } from './utils/excel';
import { 
  getInvoiceMissingFields, 
  analyzeDuplicates, 
  validateInvoiceMath, 
  CalculationWarning, 
  saveVerifiedInvoiceToHistory, 
  getHistoricalVerifiedInvoices, 
  clearHistoricalVerifiedInvoices,
  removeHistoricalVerifiedInvoice,
  HistoricalInvoiceRecordV2,
  getInvoiceValidationSummary,
  getInvoiceReviewReasons,
  InvoiceValidationSummary
} from './utils/validation';
import { InvoiceDocumentPreview } from './components/InvoiceDocumentPreview';
import { generateInvoiceDocumentSvg } from './utils/documentSvgGenerator';
import { calculateFileSha256 } from './utils/fileHash';
import { runAllDuplicateTests, TestResult } from './utils/duplicateTests';

// Raw demo invoice data templates with isVerified: false so human verification is required
const RAW_DEMO_INVOICES: InvoiceData[] = [
  {
    id: 'demo-1',
    fileName: 'apex_fasteners_inv_2049.pdf',
    fileType: 'application/pdf',
    status: 'success',
    isVerified: false,
    invoiceNumber: 'INV-2026-2049',
    invoiceDate: '2026-07-10',
    paymentDueDate: '2026-08-09',
    currency: 'USD',
    purchaseOrder: 'PO-99482',
    supplierName: 'Apex Fasteners & Bolts Corp',
    supplierAddress: '1048 Industrial Parkway, Suite E, Cleveland, OH 44114',
    supplierContact: 'sales@apexfasteners.com | +1 (216) 555-0182',
    businessRegistrationOrTaxId: 'US-94-1184920',
    bankDetails: 'Cleveland Trust Commerce Bank (SWIFT: CLTRUS33)',
    bankAccount: 'US89-1020-3040-5060-7080',
    invoiceSubtotal: 1240.00,
    totalDiscount: 50.00,
    totalTax: 119.00,
    deliveryCharges: 35.00,
    finalAmountPayable: 1344.00,
    amountAlreadyPaid: 344.00,
    outstandingBalance: 1000.00,
    paymentTerms: 'Net 30',
    acceptedPaymentMethod: 'Bank Transfer, Credit Card',
    latePaymentTerms: '1.5% monthly interest applied after due date',
    aiReviewNotes: [
      { field: 'invoiceNumber', sourceType: 'printed', message: 'Printed invoice number "INV-2026-2049" extracted from document header.' },
      { field: 'paymentTerms', sourceType: 'printed', message: 'Extracted payment terms "Net 30" from remittance footer.' }
    ],
    lineItems: [
      { id: 'li-1-1', description: 'Grade 8 Zinc-Plated Hex Cap Screws (3/8" x 2") - Bulk 500ct', quantity: 2, unitPrice: 150.00, discount: 0, taxRate: 10, taxAmount: 30.00, totalAmount: 330.00 },
      { id: 'li-1-2', description: 'Heavy Duty Toggle Bolts (1/4" x 4") - Box of 100', quantity: 5, unitPrice: 42.00, discount: 10.00, taxRate: 10, taxAmount: 20.00, totalAmount: 220.00 },
      { id: 'li-1-3', description: 'Nylon Lock Nuts Assortment Kit (600 pieces)', quantity: 3, unitPrice: 65.00, discount: 0, taxRate: 10, taxAmount: 19.50, totalAmount: 214.50 },
      { id: 'li-1-4', description: 'Stainless Steel Flat Washers (M10) - Box of 1000', quantity: 1, unitPrice: 495.00, discount: 40.00, taxRate: 10, taxAmount: 45.50, totalAmount: 500.50 }
    ]
  },
  {
    id: 'demo-2',
    fileName: 'titan_tools_inv_9983.jpg',
    fileType: 'image/jpeg',
    status: 'success',
    isVerified: false,
    invoiceNumber: 'TT-9983',
    invoiceDate: '2026-07-12',
    paymentDueDate: '2026-07-27',
    currency: 'USD',
    purchaseOrder: 'PO-99485',
    supplierName: 'Titan Premium Tools Ltd',
    supplierAddress: '55 Steelworks Way, Pittsburgh, PA 15201',
    supplierContact: 'ap@titantools.com | +1 (412) 555-0921',
    businessRegistrationOrTaxId: 'EIN-25-9988231',
    bankDetails: 'Steel Valley Credit Union (Branch Code: 250)',
    bankAccount: '1092-2394-4422-9981',
    invoiceSubtotal: 890.00,
    totalDiscount: 0,
    totalTax: 62.30,
    deliveryCharges: 15.00,
    finalAmountPayable: 967.30,
    amountAlreadyPaid: 967.30,
    outstandingBalance: 0.00,
    paymentTerms: 'Due on Receipt',
    acceptedPaymentMethod: 'Bank Transfer, Check, ACH',
    latePaymentTerms: 'Flat $25 fee for payments received over 5 days late',
    aiReviewNotes: [
      { field: 'currency', sourceType: 'printed', message: 'Extracted USD currency symbol ($).' }
    ],
    lineItems: [
      { id: 'li-2-1', description: '18V Brushless Impact Driver Kit with 2.0Ah Battery', quantity: 4, unitPrice: 135.00, discount: 0, taxRate: 7, taxAmount: 37.80, totalAmount: 577.80 },
      { id: 'li-2-2', description: 'Titan Professional 12-Piece Combination Wrench Set', quantity: 5, unitPrice: 70.00, discount: 0, taxRate: 7, taxAmount: 24.50, totalAmount: 374.50 }
    ]
  },
  {
    id: 'demo-3',
    fileName: 'timber_supplies_invoice_43.png',
    fileType: 'image/png',
    status: 'success',
    isVerified: false,
    invoiceNumber: 'TS-4309-X',
    invoiceDate: '2026-07-14',
    paymentDueDate: '2026-08-13',
    currency: 'SGD',
    purchaseOrder: '',
    supplierName: 'Northwest Pine Lumber & Timber',
    supplierAddress: '928 Fir Ridge Road, Portland, OR 97201',
    supplierContact: 'billing@nwpinetimber.com | +1 (503) 555-4309',
    businessRegistrationOrTaxId: 'OR-REG-5034',
    bankDetails: 'Pacific Northwest Federal Reserve (SWIFT: PACNW77)',
    bankAccount: 'OR88-3481-9920-5511',
    invoiceSubtotal: 3150.00,
    totalDiscount: 150.00,
    totalTax: 0,
    deliveryCharges: 250.00,
    finalAmountPayable: 3250.00,
    amountAlreadyPaid: 0,
    outstandingBalance: 3250.00,
    paymentTerms: 'Net 30',
    acceptedPaymentMethod: 'Bank Wire Transfer',
    latePaymentTerms: '2% monthly compound interest begins after 30-day grace period',
    aiReviewNotes: [
      { field: 'currency', sourceType: 'printed', message: 'Printed SGD currency explicitly extracted.' }
    ],
    lineItems: [
      { id: 'li-3-1', description: 'Premium Douglas Fir 2x4x8 Studs - Bundle of 100', quantity: 3, unitPrice: 450.00, discount: 50.00, taxRate: 0, taxAmount: 0, totalAmount: 1300.00 },
      { id: 'li-3-2', description: 'CDX Structural Pine Sheathing Plywood (15/32" x 4\' x 8\')', quantity: 40, unitPrice: 45.00, discount: 100.00, taxRate: 0, taxAmount: 0, totalAmount: 1700.00 }
    ]
  },
  {
    id: 'demo-4',
    fileName: 'industrial_paints_inv_882.pdf',
    fileType: 'application/pdf',
    status: 'success',
    isVerified: false,
    invoiceNumber: 'IP-8820',
    invoiceDate: '2026-07-15',
    paymentDueDate: '', // Intentionally missing payment due date
    currency: 'USD',
    purchaseOrder: 'PO-8812',
    supplierName: 'Midwest Industrial Paints & Coatings',
    supplierAddress: '720 Commerce Way, Chicago, IL 60607',
    supplierContact: 'ap@midwestpaints.com',
    businessRegistrationOrTaxId: 'IL-TAX-8899',
    bankDetails: 'First National Bank Chicago',
    bankAccount: '1102-4492-0012',
    invoiceSubtotal: 620.00,
    totalDiscount: 0,
    totalTax: 37.20,
    deliveryCharges: 0,
    finalAmountPayable: 657.20,
    amountAlreadyPaid: 0,
    outstandingBalance: 657.20,
    paymentTerms: '', // Intentionally missing payment terms
    acceptedPaymentMethod: 'Check, ACH',
    latePaymentTerms: '',
    aiReviewNotes: [
      { field: 'paymentDueDate', sourceType: 'not_found', message: 'Payment due date missing in document text.' },
      { field: 'paymentTerms', sourceType: 'not_found', message: 'Payment terms not found in document.' }
    ],
    lineItems: [
      { id: 'li-4-1', description: 'Anti-Rust Primer Grey (5 Gallon Pail)', quantity: 4, unitPrice: 155.00, discount: 0, taxRate: 6, taxAmount: 37.20, totalAmount: 657.20 }
    ]
  }
];

// Pre-populate with SVG document image URLs for original document preview
const DEMO_INVOICES: InvoiceData[] = RAW_DEMO_INVOICES.map(inv => ({
  ...inv,
  fileDataUrl: generateInvoiceDocumentSvg(inv)
}));

export default function App() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'supplier' | 'metadata' | 'banking' | 'totals' | 'history'>('preview');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<'tabbed' | 'split'>('tabbed');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Historical verified ledger state
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalInvoiceRecordV2[]>(getHistoricalVerifiedInvoices());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showClearHistoryConfirmModal, setShowClearHistoryConfirmModal] = useState(false);
  const [testModalResults, setTestModalResults] = useState<{ allPassed: boolean; results: TestResult[] } | null>(null);

  // Math override form state
  const [calcOverrideReason, setCalcOverrideReason] = useState<string>('');
  const [calcOverrideCheck, setCalcOverrideCheck] = useState<boolean>(false);

  // Selected invoice
  const selectedInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  // Duplicate Analysis against current batch & historical ledger
  const duplicateAnalysis = useMemo(() => {
    return analyzeDuplicates(invoices, historicalRecords);
  }, [invoices, historicalRecords]);

  // Math validation for selected invoice
  const selectedCalcWarnings = useMemo<CalculationWarning[]>(() => {
    if (!selectedInvoice || selectedInvoice.status !== 'success') return [];
    return validateInvoiceMath(selectedInvoice);
  }, [selectedInvoice]);

  // Duplicate details for selected invoice
  const selectedDupDetails = useMemo(() => {
    if (!selectedInvoice) return undefined;
    return duplicateAnalysis[selectedInvoice.id];
  }, [selectedInvoice, duplicateAnalysis]);

  // Missing fields for selected invoice
  const selectedMissingFields = useMemo(() => {
    if (!selectedInvoice || selectedInvoice.status !== 'success') return [];
    return getInvoiceMissingFields(selectedInvoice);
  }, [selectedInvoice]);

  // Validation Summary for selected invoice
  const selectedValidationSummary = useMemo<InvoiceValidationSummary | null>(() => {
    if (!selectedInvoice) return null;
    return getInvoiceValidationSummary(selectedInvoice, selectedDupDetails);
  }, [selectedInvoice, selectedDupDetails]);

  // Check if selected invoice can be explicitly human-verified
  const canVerifySelected = useMemo(() => {
    if (!selectedInvoice || selectedInvoice.status !== 'success') return false;
    if (selectedMissingFields.length > 0) return false;
    if (selectedDupDetails?.isDuplicate && !selectedInvoice.isDuplicateDismissed) return false;
    if (selectedCalcWarnings.length > 0 && !selectedInvoice.calcOverrideConfirmed) return false;
    return true;
  }, [selectedInvoice, selectedMissingFields, selectedDupDetails, selectedCalcWarnings]);

  // Verified & Ready for Three-Way Match invoices for Excel Export (Auto-Validated OR Human-Verified)
  const cleanInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const summary = getInvoiceValidationSummary(inv, dup);
      return summary.isReadyForExport;
    });
  }, [invoices, duplicateAnalysis]);

  // Invoices requiring human attention/review (Needs Review / Missing Info / Duplicates / Failed)
  const attentionInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const summary = getInvoiceValidationSummary(inv, dup);
      return !summary.isReadyForExport;
    });
  }, [invoices, duplicateAnalysis]);

  // Metric counts for dashboard
  const totalCount = invoices.length;
  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;

  const autoValidatedCount = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const s = getInvoiceValidationSummary(inv, dup);
      return s.status === 'auto_validated';
    }).length;
  }, [invoices, duplicateAnalysis]);

  const humanVerifiedCount = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const s = getInvoiceValidationSummary(inv, dup);
      return s.status === 'human_verified';
    }).length;
  }, [invoices, duplicateAnalysis]);

  const reviewRequiredCount = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const s = getInvoiceValidationSummary(inv, dup);
      return s.status === 'needs_review';
    }).length;
  }, [invoices, duplicateAnalysis]);

  const duplicatesCount = useMemo(() => {
    return invoices.filter(inv => {
      const dup = duplicateAnalysis[inv.id];
      const s = getInvoiceValidationSummary(inv, dup);
      return s.status === 'duplicate';
    }).length;
  }, [invoices, duplicateAnalysis]);

  const failedCount = useMemo(() => {
    return invoices.filter(inv => inv.status === 'error').length;
  }, [invoices]);

  // Invoice queue navigation
  const currentInvoiceIndex = useMemo(() => {
    return invoices.findIndex(i => i.id === selectedInvoiceId);
  }, [invoices, selectedInvoiceId]);

  const hasNextInvoice = currentInvoiceIndex >= 0 && currentInvoiceIndex < invoices.length - 1;
  const hasPrevInvoice = currentInvoiceIndex > 0;

  const handleGoNextInvoice = () => {
    if (hasNextInvoice) {
      setSelectedInvoiceId(invoices[currentInvoiceIndex + 1].id);
    }
  };

  const handleGoPrevInvoice = () => {
    if (hasPrevInvoice) {
      setSelectedInvoiceId(invoices[currentInvoiceIndex - 1].id);
    }
  };

  // Steps active states
  const step1Completed = invoices.length > 0;
  const step1Active = invoices.length === 0;
  const step2Completed = invoices.length > 0 && attentionInvoices.length === 0;
  const step2Active = invoices.length > 0 && attentionInvoices.length > 0;
  const step3Active = cleanInvoices.length > 0;

  // Load Demo Invoices
  const handleLoadDemos = () => {
    setInvoices(DEMO_INVOICES);
    setSelectedInvoiceId(DEMO_INVOICES[0].id);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Helper to call extraction API with retry on 429 rate limit
  const callExtractInvoiceApi = async (fileName: string, fileType: string, base64Data: string) => {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts++;
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileType, base64Data })
      });

      if (response.ok) {
        return await response.json();
      }

      const errData = await response.json().catch(() => ({}));
      const errorMessage = errData.error || 'Failed to extract data.';

      if (response.status === 429 && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      throw new Error(errorMessage);
    }
  };

  // Handle uploaded files strictly according to file rules
  const handleFiles = async (files: File[]) => {
    setIsUploading(true);

    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size === 0) {
        alert(`File "${file.name}" was rejected: The file is empty (0 bytes).`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert(`File "${file.name}" was rejected: File size exceeds 20MB limit.`);
        continue;
      }
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);
      if (!isPdf && !isImage) {
        alert(`File "${file.name}" was rejected: Unsupported format. Please upload PDF, JPEG, or PNG files.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    // Create temporary entries in state with isVerified: false and blank currency/supplier
    const newInvoices: InvoiceData[] = validFiles.map(file => ({
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      status: 'pending',
      isVerified: false,
      invoiceNumber: '',
      invoiceDate: '',
      paymentDueDate: '',
      currency: '', // Strictly leave blank if not found (NO USD DEFAULT!)
      purchaseOrder: '',
      supplierName: '', // Strictly leave blank if not found!
      supplierAddress: '',
      supplierContact: '',
      businessRegistrationOrTaxId: '',
      bankDetails: '',
      bankAccount: '',
      invoiceSubtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      deliveryCharges: 0,
      finalAmountPayable: 0,
      amountAlreadyPaid: 0,
      outstandingBalance: 0,
      paymentTerms: '',
      acceptedPaymentMethod: '',
      latePaymentTerms: '',
      lineItems: []
    }));

    setInvoices(prev => [...prev, ...newInvoices]);
    setSelectedInvoiceId(newInvoices[0].id);

    // Process each file
    for (let i = 0; i < validFiles.length; i++) {
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
      const file = validFiles[i];
      const placeholder = newInvoices[i];

      try {
        const { base64Data, fullDataUrl } = await convertFileToBase64(file);
        const computedFileHash = await calculateFileSha256(file);
        
        // Save file preview immediately so PDF/Image viewer stays available even if extraction fails
        setInvoices(prev => prev.map(inv => {
          if (inv.id === placeholder.id) {
            return {
              ...inv,
              fileDataUrl: fullDataUrl,
              base64Data: base64Data,
              fileHash: computedFileHash
            };
          }
          return inv;
        }));

        const data = await callExtractInvoiceApi(file.name, file.type, base64Data);

        const parsedLineItems: InvoiceLineItem[] = (data.lineItems || []).map((item: any, index: number) => ({
          id: `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          description: item.description || '',
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
          discount: typeof item.discount === 'number' ? item.discount : 0,
          taxRate: typeof item.taxRate === 'number' ? item.taxRate : 0,
          taxAmount: typeof item.taxAmount === 'number' ? item.taxAmount : 0,
          totalAmount: typeof item.totalAmount === 'number' ? item.totalAmount : 0,
        }));

        setInvoices(prev => prev.map(inv => {
          if (inv.id === placeholder.id) {
            return {
              ...inv,
              status: 'success',
              isVerified: false, // Explicit human verification mandatory
              fileDataUrl: fullDataUrl,
              base64Data: base64Data,
              invoiceNumber: data.invoiceNumber || '',
              suggestedInvoiceNumber: data.suggestedInvoiceNumber || '',
              invoiceDate: data.invoiceDate || '',
              paymentDueDate: data.paymentDueDate || '',
              currency: data.currency || '', // Blank if not found!
              purchaseOrder: data.purchaseOrder || '',
              supplierName: data.supplierName || '', // Blank if not found!
              supplierAddress: data.supplierAddress || '',
              supplierContact: data.supplierContact || '',
              businessRegistrationOrTaxId: data.businessRegistrationOrTaxId || '',
              bankDetails: data.bankDetails || '',
              bankAccount: data.bankAccount || '',
              invoiceSubtotal: data.invoiceSubtotal || 0,
              totalDiscount: data.totalDiscount || 0,
              totalTax: data.totalTax || 0,
              deliveryCharges: data.deliveryCharges || 0,
              finalAmountPayable: data.finalAmountPayable || 0,
              amountAlreadyPaid: data.amountAlreadyPaid || 0,
              outstandingBalance: data.outstandingBalance || 0,
              paymentTerms: data.paymentTerms || '',
              acceptedPaymentMethod: data.acceptedPaymentMethod || '',
              latePaymentTerms: data.latePaymentTerms || '',
              aiReviewNotes: data.aiReviewNotes || [],
              lineItems: parsedLineItems
            };
          }
          return inv;
        }));

      } catch (error: any) {
        console.error("Error processing file", file.name, error);
        setInvoices(prev => prev.map(inv => {
          if (inv.id === placeholder.id) {
            return {
              ...inv,
              status: 'error',
              errorMessage: error.message || 'Extraction failed. You can enter details manually using the document preview.'
            };
          }
          return inv;
        }));
      }
    }

    setIsUploading(false);
  };

  // Convert failed upload into manual draft (no inventing fake dates/numbers/currencies!)
  const handleConvertErrorToDraft = (invId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invId) {
        return {
          ...inv,
          status: 'success',
          isVerified: false,
          errorMessage: undefined,
          // String fields begin blank per Repair 3 & Repair 4!
          supplierName: inv.supplierName || '',
          invoiceNumber: inv.invoiceNumber || '',
          invoiceDate: inv.invoiceDate || '',
          paymentDueDate: inv.paymentDueDate || '',
          paymentTerms: inv.paymentTerms || '',
          currency: inv.currency || '',
          acceptedPaymentMethod: inv.acceptedPaymentMethod || ''
        };
      }
      return inv;
    }));
  };

  const convertFileToBase64 = (file: File): Promise<{ base64Data: string; fullDataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const fullDataUrl = reader.result as string;
        const base64Data = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;
        resolve({ base64Data, fullDataUrl });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Create a blank manual invoice entry (fields begin blank per Repair 3)
  const handleAddManualInvoice = () => {
    const manualId = `manual-${Date.now()}`;
    const baseManual: InvoiceData = {
      id: manualId,
      fileName: `Manual_Entry_${new Date().toISOString().slice(0, 10)}.pdf`,
      fileType: 'application/pdf',
      status: 'success',
      isVerified: false,
      invoiceNumber: '',
      invoiceDate: '',
      paymentDueDate: '',
      currency: '', // Blank
      purchaseOrder: '',
      supplierName: '', // Blank
      supplierAddress: '',
      supplierContact: '',
      businessRegistrationOrTaxId: '',
      bankDetails: '',
      bankAccount: '',
      invoiceSubtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      deliveryCharges: 0,
      finalAmountPayable: 0,
      amountAlreadyPaid: 0,
      outstandingBalance: 0,
      paymentTerms: '',
      acceptedPaymentMethod: '',
      latePaymentTerms: '',
      lineItems: []
    };

    const newManual: InvoiceData = {
      ...baseManual,
      fileDataUrl: generateInvoiceDocumentSvg(baseManual)
    };

    setInvoices(prev => [...prev, newManual]);
    setSelectedInvoiceId(manualId);
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (selectedInvoiceId === id) {
      const remaining = invoices.filter(inv => inv.id !== id);
      setSelectedInvoiceId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Clear all invoices with confirmation
  const handleConfirmClearAll = () => {
    setInvoices([]);
    setSelectedInvoiceId(null);
    setShowClearConfirmModal(false);
  };

  // Edit fields dynamically (resets verification & override confirmation)
  const handleUpdateField = (field: keyof InvoiceData, value: any) => {
    if (!selectedInvoiceId) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        const updated = { ...inv, [field]: value };
        
        // Recalculate outstanding balance if amounts change
        if (field === 'finalAmountPayable' || field === 'amountAlreadyPaid') {
          const finalAmt = field === 'finalAmountPayable' ? Number(value) : inv.finalAmountPayable;
          const paidAmt = field === 'amountAlreadyPaid' ? Number(value) : inv.amountAlreadyPaid;
          updated.outstandingBalance = Math.max(0, finalAmt - paidAmt);
        }

        // Whenever fields are edited (except explicit verification toggle), reset verification & override status
        if (field !== 'isVerified' && field !== 'calcOverrideConfirmed' && field !== 'isDuplicateDismissed') {
          updated.isVerified = false;
          updated.calcOverrideConfirmed = false;
        }

        return updated;
      }
      return inv;
    }));
  };

  // Edit line item fields dynamically
  const handleUpdateLineItem = (itemId: string, field: keyof InvoiceLineItem, value: any) => {
    if (!selectedInvoiceId) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        const updatedItems = inv.lineItems.map(item => {
          if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
            const disc = field === 'discount' ? Number(value) : item.discount;
            const taxR = field === 'taxRate' ? Number(value) : item.taxRate;
            
            const preTax = (qty * price) - disc;
            const calculatedTax = parseFloat((preTax * (taxR / 100)).toFixed(2));
            
            updatedItem.taxAmount = field === 'taxAmount' ? Number(value) : calculatedTax;
            updatedItem.totalAmount = parseFloat((preTax + updatedItem.taxAmount).toFixed(2));
            return updatedItem;
          }
          return item;
        });

        return {
          ...inv,
          lineItems: updatedItems,
          isVerified: false,
          calcOverrideConfirmed: false
        };
      }
      return inv;
    }));
  };

  // Add line item
  const handleAddLineItem = () => {
    if (!selectedInvoiceId) return;
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}`,
      description: 'Hardware Item / Service',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 0
    };

    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        return {
          ...inv,
          lineItems: [...inv.lineItems, newItem],
          isVerified: false,
          calcOverrideConfirmed: false
        };
      }
      return inv;
    }));
  };

  // Delete line item
  const handleDeleteLineItem = (itemId: string) => {
    if (!selectedInvoiceId) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        return {
          ...inv,
          lineItems: inv.lineItems.filter(item => item.id !== itemId),
          isVerified: false,
          calcOverrideConfirmed: false
        };
      }
      return inv;
    }));
  };

  // Recalculate Totals from Line Items
  const handleSyncTotals = () => {
    if (!selectedInvoice) return;

    let calcSubtotal = 0;
    let calcTax = 0;
    let calcDiscount = 0;

    selectedInvoice.lineItems.forEach(item => {
      calcSubtotal += (item.quantity * item.unitPrice);
      calcDiscount += item.discount;
      calcTax += item.taxAmount;
    });

    const delivery = selectedInvoice.deliveryCharges || 0;
    const finalAmount = Math.max(0, calcSubtotal - calcDiscount + calcTax + delivery);
    const outstanding = Math.max(0, finalAmount - selectedInvoice.amountAlreadyPaid);

    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        return {
          ...inv,
          invoiceSubtotal: parseFloat(calcSubtotal.toFixed(2)),
          totalDiscount: parseFloat(calcDiscount.toFixed(2)),
          totalTax: parseFloat(calcTax.toFixed(2)),
          finalAmountPayable: parseFloat(finalAmount.toFixed(2)),
          outstandingBalance: parseFloat(outstanding.toFixed(2)),
          isVerified: false,
          calcOverrideConfirmed: false
        };
      }
      return inv;
    }));
  };

  // Mark selected invoice as verified (saves to historical ledger)
  const handleMarkAsVerified = () => {
    if (!selectedInvoice) return;
    if (!canVerifySelected) {
      alert("Cannot verify invoice due to unhandled blockers (missing fields, duplicate flags, or calculation warnings).");
      return;
    }

    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoice.id) {
        const verifiedInv = { ...inv, isVerified: true };
        saveVerifiedInvoiceToHistory(verifiedInv);
        return verifiedInv;
      }
      return inv;
    }));

    setHistoricalRecords(getHistoricalVerifiedInvoices());
  };

  // Dismiss duplicate warning
  const handleDismissDuplicate = () => {
    if (!selectedInvoice) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoice.id) {
        return { ...inv, isDuplicateDismissed: true };
      }
      return inv;
    }));
  };

  // Confirm calculation override
  const handleConfirmCalcOverride = () => {
    if (!selectedInvoice) return;
    if (!calcOverrideCheck) {
      alert("Please check the box confirming you have verified the numbers against the source document.");
      return;
    }
    if (!calcOverrideReason.trim()) {
      alert("Please provide a brief reason or comment explaining why the calculation difference is accepted (e.g. 'Supplier round-off error on paper').");
      return;
    }

    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoice.id) {
        return {
          ...inv,
          calcOverrideConfirmed: true,
          calcOverrideReason: calcOverrideReason.trim()
        };
      }
      return inv;
    }));

    setCalcOverrideReason('');
    setCalcOverrideCheck(false);
  };

  // Apply suggested invoice number from filename
  const handleApplySuggestedInvoiceNumber = () => {
    if (!selectedInvoice || !selectedInvoice.suggestedInvoiceNumber) return;
    handleUpdateField('invoiceNumber', selectedInvoice.suggestedInvoiceNumber);
  };

  // Single or Bulk Excel Export
  const handleExportAll = () => {
    if (cleanInvoices.length === 0) {
      alert("No invoices ready for three-way matching.\n\nOnly invoices that pass all automated validation checks ('Auto-Validated') or have been resolved by Madam Lim ('Human-Verified') are included in Excel exports.");
      return;
    }

    const attentionCount = invoices.length - cleanInvoices.length;
    if (attentionCount > 0) {
      alert(`Excel Spreadsheet Export:\n\nExporting ${cleanInvoices.length} invoice(s) ready for three-way matching to Excel.\n\nNote: ${attentionCount} invoice(s) currently requiring human review were excluded.`);
    }

    exportInvoicesToExcel(cleanInvoices, `AP_Invoices_Ready_For_Matching_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportSelected = () => {
    if (!selectedInvoice) return;
    const dup = duplicateAnalysis[selectedInvoice.id];
    const summary = getInvoiceValidationSummary(selectedInvoice, dup);

    if (!summary.isReadyForExport) {
      alert(`Cannot export "${selectedInvoice.supplierName || selectedInvoice.fileName}" because it requires human review.\n\nPlease resolve all flagged issues or exceptions before exporting.`);
      return;
    }

    exportInvoicesToExcel([selectedInvoice], `Invoice_${selectedInvoice.invoiceNumber || selectedInvoice.id}.xlsx`);
  };

  // Open Clear Duplicate History confirmation modal
  const handleClearHistory = () => {
    setShowClearHistoryConfirmModal(true);
  };

  // Confirm Clear Duplicate History (removes version-2 historical records)
  const handleConfirmClearHistory = () => {
    clearHistoricalVerifiedInvoices();
    setHistoricalRecords([]);
    setShowClearHistoryConfirmModal(false);
  };

  // Remove individual record from historical ledger
  const handleRemoveIndividualHistory = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    removeHistoricalVerifiedInvoice(id);
    setHistoricalRecords(getHistoricalVerifiedInvoices());
  };

  // Render the Verified Ledger history tab inside the workspace review area
  const renderHistoryTabContent = () => {
    const filteredRecords = historicalRecords.filter(rec => {
      if (!historySearchTerm.trim()) return true;
      const term = historySearchTerm.toLowerCase().trim();
      return (
        (rec.supplierName || '').toLowerCase().includes(term) ||
        (rec.invoiceNumber || '').toLowerCase().includes(term) ||
        (rec.purchaseOrder || '').toLowerCase().includes(term) ||
        (rec.currency || '').toLowerCase().includes(term)
      );
    });

    const totalValue = historicalRecords.reduce((acc, curr) => acc + (curr.finalAmountPayable || 0), 0);

    return (
      <div className="space-y-5">
        {/* Ledger Banner */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-xl space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 text-indigo-300 p-2.5 rounded-lg border border-indigo-500/30">
                <History className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <span>Previously Verified Invoices Ledger</span>
                  <span className="bg-indigo-500/30 text-indigo-200 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                    {historicalRecords.length} Records
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Historical ledger of all previously verified invoices. Duplicate detection automatically cross-checks incoming documents against these records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={historicalRecords.length === 0}
                className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Remove all historical verified invoices"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Ledger Records ({historicalRecords.length})</span>
              </button>
            </div>
          </div>

          {/* Ledger Stats Bar */}
          <div className="pt-2.5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Total Verified</span>
              <span className="font-mono font-bold text-slate-100 text-sm">{historicalRecords.length} invoices</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Total Ledger Value</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">${totalValue.toFixed(2)}</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Duplicate Engine</span>
              <span className="text-emerald-300 font-semibold text-[11px] flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Active historical matching
              </span>
            </div>
          </div>
        </div>

        {/* Search Filter */}
        {historicalRecords.length > 0 && (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
            <Search className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
            <input
              type="text"
              value={historySearchTerm}
              onChange={(e) => setHistorySearchTerm(e.target.value)}
              placeholder="Search verified history by supplier, invoice #, PO #, currency..."
              className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            {historySearchTerm && (
              <button
                type="button"
                onClick={() => setHistorySearchTerm('')}
                className="text-xs text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Table View */}
        {historicalRecords.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-800 text-sm">No Previously Verified Invoices</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              When you verify supplier invoices during review, they are saved to this ledger to automatically flag duplicate uploads in future batches.
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-xs">
            No historical records match "{historySearchTerm}".
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-3">Verified Timestamp</th>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date / PO</th>
                    <th className="p-3 text-right">Final Amount</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(rec.verifiedAt).toLocaleDateString()} {new Date(rec.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {rec.supplierName}
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-900 whitespace-nowrap">
                        #{rec.invoiceNumber}
                      </td>
                      <td className="p-3 text-gray-600 text-[11px] whitespace-nowrap">
                        <div>{rec.invoiceDate || '—'}</div>
                        {rec.purchaseOrder && <div className="text-gray-400 font-mono">PO: {rec.purchaseOrder}</div>}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                        {rec.currency || ''} ${(rec.finalAmountPayable || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleRemoveIndividualHistory(rec.id, e)}
                          className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Remove this invoice from historical verified ledger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Execute the 12 required duplicate detection test scenarios
  const handleRunUnitTests = () => {
    const res = runAllDuplicateTests();
    setTestModalResults(res);
  };

  const renderFormContent = (effectiveTab: 'supplier' | 'metadata' | 'banking' | 'totals') => {
    if (!selectedInvoice) return null;

    return (
      <div className="space-y-6">
        {/* DUPLICATE WARNING CARD */}
        {selectedDupDetails?.isDuplicate && (
          <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 p-4 rounded-r-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2 flex-wrap">
                    <span>Duplicate Document Flagged</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                      {selectedDupDetails.matchType === 'historical' ? 'Previously Processed Invoice' : 'Duplicate in Current Batch'}
                    </span>
                  </h4>

                  {selectedDupDetails.matchType === 'historical' ? (
                    <div className="text-xs text-amber-800 space-y-1 pt-1">
                      <p className="font-semibold text-amber-900">
                        {selectedInvoice.invoiceNumber ? `#${selectedInvoice.invoiceNumber}` : 'Invoice'} matches a previously verified {selectedDupDetails.historicalMatch?.supplierName || 'supplier'} invoice stored in the local ledger.
                      </p>
                      <div className="bg-white/80 border border-amber-200 rounded-lg p-2.5 text-[11px] font-mono text-amber-900 space-y-0.5">
                        <p>• Matching Supplier: <strong>{selectedDupDetails.historicalMatch?.supplierName || 'N/A'}</strong></p>
                        <p>• Matching Invoice #: <strong>{selectedDupDetails.historicalMatch?.invoiceNumber || 'N/A'}</strong></p>
                        <p>• Ledger Verification Date: <strong>{selectedDupDetails.historicalMatch?.verifiedAt ? new Date(selectedDupDetails.historicalMatch.verifiedAt).toLocaleDateString() : 'Previous Session'}</strong></p>
                        <p>• Rule: {selectedDupDetails.reason}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 space-y-1 pt-1">
                      <p className="font-semibold text-amber-900">Duplicate in Current Batch</p>
                      <p className="bg-white/80 border border-amber-200 rounded-lg p-2.5 text-[11px] font-mono text-amber-900">
                        • {selectedDupDetails.reason || 'Shares duplicate parameters with another document in this batch.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {!selectedInvoice.isDuplicateDismissed ? (
                <button
                  type="button"
                  onClick={handleDismissDuplicate}
                  className="shrink-0 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg transition cursor-pointer self-start sm:self-center"
                >
                  Confirm Unique / Dismiss Flag
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 shrink-0">
                  Duplicate Flag Dismissed
                </span>
              )}
            </div>
          </div>
        )}

        {/* CALCULATION WARNINGS CARD */}
        {selectedCalcWarnings.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-4 rounded-r-xl shadow-xs">
            <div className="flex gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="font-bold text-rose-900 text-sm flex items-center justify-between">
                  <span>Independent Math Check Warnings ({selectedCalcWarnings.length})</span>
                  {selectedInvoice.calcOverrideConfirmed && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                      Human Override Confirmed
                    </span>
                  )}
                </h4>

                <p className="text-xs text-rose-800 leading-relaxed">
                  The amounts printed on the invoice do not match independent mathematical formulas:
                </p>

                <ul className="space-y-1.5 text-xs text-rose-900 bg-white/80 p-3 rounded-lg border border-rose-200 font-mono">
                  {selectedCalcWarnings.map((warn, idx) => (
                    <li key={idx} className="flex flex-col gap-0.5">
                      <div className="font-bold text-rose-800">
                        • [{warn.type === 'line_item_mismatch' ? 'Line Item Math' : 'Header Total Math'}] {warn.description}
                      </div>
                      <div className="text-[11px] text-slate-600 pl-3">
                        Document states: <span className="font-bold text-slate-800">${warn.documentValue.toFixed(2)}</span> | Formula yields: <span className="font-bold text-slate-800">${warn.calculatedValue.toFixed(2)}</span> (Diff: ${warn.difference.toFixed(2)})
                      </div>
                    </li>
                  ))}
                </ul>

                {!selectedInvoice.calcOverrideConfirmed ? (
                  <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-2 mt-3">
                    <h5 className="font-bold text-xs text-slate-800">Human Review &amp; Calculation Override</h5>
                    <p className="text-[11px] text-slate-600">
                      If the discrepancy is due to a physical document typo or supplier rounding rule, verify the document and confirm an override below:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="calc-override-check"
                        checked={calcOverrideCheck}
                        onChange={(e) => setCalcOverrideCheck(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="calc-override-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        I have verified these values against the original source document.
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Reason for override (e.g. 'Supplier printed rounding difference on paper')"
                      value={calcOverrideReason}
                      onChange={(e) => setCalcOverrideReason(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmCalcOverride}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-md transition cursor-pointer"
                    >
                      Confirm Calculation Override
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800 italic bg-emerald-50 p-2 rounded border border-emerald-200">
                    Override Reason Logged: "{selectedInvoice.calcOverrideReason || 'Verified against document'}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MISSING MANDATORY FIELDS CARD */}
        {selectedMissingFields.length > 0 && !selectedInvoice.isVerified && (
          <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4 rounded-r-xl shadow-xs">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  Missing Mandatory AP Fields ({selectedMissingFields.length})
                </h4>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  The following required fields must be filled before verification:
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-[11px] text-amber-800 mt-2 font-medium list-disc pl-4">
                  {selectedMissingFields.map((field, idx) => (
                    <li key={idx}>{field}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SUGGESTED INVOICE NUMBER CARD */}
        {selectedInvoice.suggestedInvoiceNumber && selectedInvoice.invoiceNumber !== selectedInvoice.suggestedInvoiceNumber && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Filename contains suggested code: <strong>{selectedInvoice.suggestedInvoiceNumber}</strong></span>
            </div>
            <button
              type="button"
              onClick={handleApplySuggestedInvoiceNumber}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded transition cursor-pointer"
            >
              Apply to Invoice Number
            </button>
          </div>
        )}

        {/* AI REVIEW NOTES PANEL */}
        {selectedInvoice.aiReviewNotes && selectedInvoice.aiReviewNotes.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs space-y-1.5">
            <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
              <FileSearch className="w-4 h-4 text-slate-500" />
              AI Review &amp; Extraction Notes
            </h5>
            <ul className="space-y-1 text-slate-600 text-[11px]">
              {selectedInvoice.aiReviewNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-slate-400">•</span>
                  <span>{note.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* VERIFICATION STATUS & ACTION BAR */}
        {selectedValidationSummary && (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs ${
            selectedValidationSummary.status === 'auto_validated'
              ? 'bg-blue-50 border-blue-300'
              : selectedValidationSummary.status === 'human_verified'
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-amber-50 border-amber-300'
          }`}>
            <div className="flex items-start gap-3">
              {selectedValidationSummary.status === 'auto_validated' ? (
                <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
              ) : selectedValidationSummary.status === 'human_verified' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className={`font-bold text-sm ${
                    selectedValidationSummary.status === 'auto_validated'
                      ? 'text-blue-950'
                      : selectedValidationSummary.status === 'human_verified'
                        ? 'text-emerald-950'
                        : 'text-amber-950'
                  }`}>
                    {selectedValidationSummary.statusLabel}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedValidationSummary.statusBadgeClass}`}>
                    {selectedValidationSummary.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  {selectedValidationSummary.status === 'auto_validated' && (
                    "This invoice passed all automated checks (mandatory fields present, PO available, math balanced, no duplicates). It is ready for three-way matching and included in Excel export."
                  )}
                  {selectedValidationSummary.status === 'human_verified' && (
                    "Madam Lim resolved exceptions and explicitly verified this invoice. It is ready for three-way matching and included in Excel export."
                  )}
                  {selectedValidationSummary.status === 'needs_review' && (
                    "Exceptions detected. Madam Lim should review and correct the flagged issues below before three-way matching:"
                  )}
                  {selectedValidationSummary.status === 'duplicate' && (
                    "Duplicate document detected. Please review against historical ledger or current batch."
                  )}
                  {selectedValidationSummary.status === 'extraction_failed' && (
                    "Document extraction failed. Please review file or enter details manually."
                  )}
                </p>

                {selectedValidationSummary.reasonsForReview.length > 0 && selectedValidationSummary.status !== 'auto_validated' && selectedValidationSummary.status !== 'human_verified' && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-900 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200 list-disc pl-5">
                    {selectedValidationSummary.reasonsForReview.map((reason, idx) => (
                      <li key={idx} className="font-medium">{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {selectedInvoice.isVerified ? (
                <button
                  type="button"
                  onClick={() => handleUpdateField('isVerified', false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition cursor-pointer"
                >
                  Unverify
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkAsVerified}
                  disabled={!canVerifySelected}
                  className={`px-4 py-2 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition ${
                    canVerifySelected 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                  title={canVerifySelected ? 'Explicitly mark invoice as human-verified' : 'Cannot verify while mandatory fields or blockers remain unresolved'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Verified
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. Supplier Profile Tab */}
        {effectiveTab === 'supplier' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Supplier Name *
              </label>
              <input
                type="text"
                value={selectedInvoice.supplierName}
                onChange={(e) => handleUpdateField('supplierName', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.supplierName || selectedInvoice.supplierName.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Apex Fasteners / Titan Tools"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Supplier Address
              </label>
              <textarea
                value={selectedInvoice.supplierAddress}
                onChange={(e) => handleUpdateField('supplierAddress', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                placeholder="1048 Industrial Parkway, Suite E..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5" />
                Supplier Contact Details
              </label>
              <input
                type="text"
                value={selectedInvoice.supplierContact}
                onChange={(e) => handleUpdateField('supplierContact', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="sales@supplier.com / (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" />
                Business Registration / Tax ID
              </label>
              <input
                type="text"
                value={selectedInvoice.businessRegistrationOrTaxId}
                onChange={(e) => handleUpdateField('businessRegistrationOrTaxId', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="VAT-193402 / EIN-XX-XXX"
              />
            </div>
          </motion.div>
        )}

        {/* 2. Invoice Metadata Tab */}
        {effectiveTab === 'metadata' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Invoice Number *
              </label>
              <input
                type="text"
                value={selectedInvoice.invoiceNumber}
                onChange={(e) => handleUpdateField('invoiceNumber', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.invoiceNumber || selectedInvoice.invoiceNumber.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="INV-2026-2049"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Purchase Order (PO) Number
              </label>
              <input
                type="text"
                value={selectedInvoice.purchaseOrder}
                onChange={(e) => handleUpdateField('purchaseOrder', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="PO-XXXXXX"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Invoice Issue Date *
              </label>
              <input
                type="date"
                value={selectedInvoice.invoiceDate}
                onChange={(e) => handleUpdateField('invoiceDate', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.invoiceDate || selectedInvoice.invoiceDate.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Payment Due Date *
              </label>
              <input
                type="date"
                value={selectedInvoice.paymentDueDate}
                onChange={(e) => handleUpdateField('paymentDueDate', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.paymentDueDate || selectedInvoice.paymentDueDate.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Invoice Currency *
              </label>
              <input
                type="text"
                value={selectedInvoice.currency}
                onChange={(e) => handleUpdateField('currency', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.currency || selectedInvoice.currency.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="e.g. USD, SGD, EUR, GBP"
              />
            </div>
          </motion.div>
        )}

        {/* 3. Banking & Payment Terms Tab */}
        {effectiveTab === 'banking' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Bank Branch &amp; BIC/SWIFT Details
              </label>
              <textarea
                value={selectedInvoice.bankDetails}
                onChange={(e) => handleUpdateField('bankDetails', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[60px]"
                placeholder="Cleveland Trust Commerce Bank (SWIFT: CLTRUS33)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Bank Account Number / IBAN
              </label>
              <input
                type="text"
                value={selectedInvoice.bankAccount}
                onChange={(e) => handleUpdateField('bankAccount', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="US89-1020-3040-5060"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Accepted Payment Methods
              </label>
              <input
                type="text"
                value={selectedInvoice.acceptedPaymentMethod}
                onChange={(e) => handleUpdateField('acceptedPaymentMethod', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Bank Transfer, Credit Card"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Standard Payment Terms *
              </label>
              <input
                type="text"
                value={selectedInvoice.paymentTerms}
                onChange={(e) => handleUpdateField('paymentTerms', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.paymentTerms || selectedInvoice.paymentTerms.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Net 30, Due on Receipt, 2/10 Net 30"
              />
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                {['Net 30', 'Net 15', 'Net 60', 'Due on Receipt', '2/10 Net 30'].map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleUpdateField('paymentTerms', term)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 text-[10px] font-semibold rounded border border-slate-200 transition cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1 text-amber-700">
                <ShieldAlert className="w-3.5 h-3.5" />
                Late Payment Penalties / Terms
              </label>
              <input
                type="text"
                value={selectedInvoice.latePaymentTerms}
                onChange={(e) => handleUpdateField('latePaymentTerms', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="1.5% interest per month"
              />
            </div>
          </motion.div>
        )}

        {/* 4. Financial Totals Tab */}
        {effectiveTab === 'totals' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5"
          >
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Invoice Subtotal ({selectedInvoice.currency || 'Unspecified'})
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.invoiceSubtotal}
                onChange={(e) => handleUpdateField('invoiceSubtotal', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 text-rose-700">
                Total Discount Deductions
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.totalDiscount}
                onChange={(e) => handleUpdateField('totalDiscount', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 text-blue-800">
                Total Combined Tax
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.totalTax}
                onChange={(e) => handleUpdateField('totalTax', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Delivery &amp; Freight Charges
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.deliveryCharges}
                onChange={(e) => handleUpdateField('deliveryCharges', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 font-bold text-slate-900">
                Final Amount Payable * ({selectedInvoice.currency || 'Unspecified'})
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.finalAmountPayable}
                onChange={(e) => handleUpdateField('finalAmountPayable', Number(e.target.value))}
                className="w-full border border-slate-800 bg-slate-100 font-semibold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 text-emerald-800">
                Amount Already Paid
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.amountAlreadyPaid}
                onChange={(e) => handleUpdateField('amountAlreadyPaid', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 text-amber-800 font-bold">
                Outstanding AP Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.outstandingBalance}
                disabled
                className="w-full border border-amber-300 bg-amber-50/50 text-amber-900 font-bold rounded-lg px-3 py-2 text-sm focus:outline-none cursor-not-allowed"
              />
            </div>

            <div className="col-span-1 sm:col-span-2 md:col-span-3 flex items-end justify-end mt-2">
              <button
                type="button"
                onClick={handleSyncTotals}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                title="Auto recalculate totals based on item rows"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recalculate Totals from Line Items
              </button>
            </div>
          </motion.div>
        )}

        {/* Granular Line Items Breakdown Section */}
        <div id="line-items-section" className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-slate-500" />
                Extracted Line Items List
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Organized pricing data including quantities, discounts, and item tax rates.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddLineItem}
              className="self-start sm:self-auto flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-md border border-slate-200 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          {selectedInvoice.lineItems.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400">
              <p className="text-xs">No items currently associated with this invoice.</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Use the "Add Item" button to manually insert product rows.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 w-20">Qty</th>
                    <th className="p-3 w-28">Unit Price</th>
                    <th className="p-3 w-24">Discount</th>
                    <th className="p-3 w-20">Tax Rate</th>
                    <th className="p-3 w-24">Tax Amount</th>
                    <th className="p-3 w-28 text-right">Total</th>
                    <th className="p-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedInvoice.lineItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateLineItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', Number(e.target.value))}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => handleUpdateLineItem(item.id, 'discount', Number(e.target.value))}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={item.taxRate}
                            onChange={(e) => handleUpdateLineItem(item.id, 'taxRate', Number(e.target.value))}
                            className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none font-mono text-center"
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.taxAmount}
                          onChange={(e) => handleUpdateLineItem(item.id, 'taxAmount', Number(e.target.value))}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-emerald-500 px-1 py-1 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-800 font-mono">
                        ${item.totalAmount.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteLineItem(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AUDIT & SUPPLIER FAIRNESS DISCLAIMER */}
        <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Supplier Validation Standard:</strong> The same validation rules are applied to every supplier. An invoice is flagged only because of information in the document, missing fields, calculation differences or a specific duplicate match.
          </span>
        </div>
      </div>
    );
  };

  const renderInvoiceItem = (inv: InvoiceData, isAttentionSection: boolean) => {
    const isSelected = inv.id === selectedInvoiceId;
    const dupMeta = duplicateAnalysis[inv.id];
    const summary = getInvoiceValidationSummary(inv, dupMeta);

    return (
      <div
        key={inv.id}
        id={`invoice-item-${inv.id}`}
        onClick={() => setSelectedInvoiceId(inv.id)}
        className={`group p-3 rounded-xl border transition cursor-pointer relative ${
          isSelected 
            ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs ring-1 ring-indigo-200' 
            : 'bg-white hover:bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
              inv.status === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : summary.status === 'extraction_failed'
                  ? 'bg-rose-100 text-rose-700'
                  : summary.status === 'auto_validated'
                    ? 'bg-emerald-100 text-emerald-800'
                    : summary.status === 'human_verified'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-amber-100 text-amber-800'
            }`}>
              {inv.status === 'pending' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : summary.status === 'extraction_failed' ? (
                <AlertCircle className="w-4 h-4" />
              ) : summary.status === 'auto_validated' ? (
                <FileCheck className="w-4 h-4 text-emerald-700" />
              ) : summary.status === 'human_verified' ? (
                <CheckCircle2 className="w-4 h-4 text-indigo-700" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700" />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="font-bold text-xs text-gray-900 truncate">
                {inv.supplierName || inv.fileName}
              </h4>
              <p className="text-[11px] text-gray-500 truncate font-mono mt-0.5">
                {inv.invoiceNumber ? `#${inv.invoiceNumber}` : inv.fileName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => handleDeleteInvoice(inv.id, e)}
            className="text-gray-300 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Delete invoice entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status badges */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          {inv.status === 'pending' && (
            <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
              Analyzing Document...
            </span>
          )}

          {summary.status === 'auto_validated' && (
            <span className="bg-emerald-50 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-emerald-600" />
              Auto-Validated
            </span>
          )}

          {summary.status === 'human_verified' && (
            <span className="bg-indigo-50 text-indigo-900 font-bold px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
              Human-Verified
            </span>
          )}

          {summary.status === 'needs_review' && (
            <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Needs Review
            </span>
          )}

          {summary.status === 'duplicate' && (
            <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              {dupMeta?.matchType === 'historical'
                ? 'Historical Duplicate'
                : (dupMeta?.reason?.toLowerCase().includes('file content') || dupMeta?.reason?.toLowerCase().includes('re-upload') || dupMeta?.reason?.toLowerCase().includes('bytes'))
                  ? 'Exact File Re-upload'
                  : 'Batch Duplicate'}
            </span>
          )}

          {summary.status === 'extraction_failed' && (
            <span className="bg-rose-50 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
              Extraction Failed
            </span>
          )}

          <span className="ml-auto font-mono font-bold text-gray-800 text-xs">
            {inv.currency ? `${inv.currency} ` : ''}${inv.finalAmountPayable ? inv.finalAmountPayable.toFixed(2) : '0.00'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 flex flex-col font-sans antialiased">
      {/* 1. Header Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-gray-900">
                InvoiceGuard
              </h1>
              <p className="text-[10px] font-mono font-bold tracking-wider text-gray-500 uppercase">
                AP DOCUMENT INTAKE SYSTEM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200/80 items-center gap-1.5 hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SECURE SYSTEM</span>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>Verified Ledger ({historicalRecords.length})</span>
            </button>

            <button
              type="button"
              onClick={handleRunUnitTests}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer hidden md:flex"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Run 12 Tests</span>
            </button>

            <button
              type="button"
              onClick={handleExportAll}
              disabled={cleanInvoices.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel ({cleanInvoices.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* 2. Step Progress Tracker */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                step1Completed ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white ring-4 ring-indigo-100'
              }`}>
                {step1Completed ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div>
                <p className={`text-xs font-bold ${step1Active || step1Completed ? 'text-gray-900' : 'text-gray-400'}`}>
                  1. Upload Invoices
                </p>
                <p className="text-[10px] text-gray-500">Drop or select supplier invoices</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                step2Completed ? 'bg-indigo-600 text-white' : step2Active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-100 text-gray-400'
              }`}>
                {step2Completed ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <div>
                <p className={`text-xs font-bold ${step2Active || step2Completed ? 'text-gray-900' : 'text-gray-400'}`}>
                  2. Validate &amp; Review
                </p>
                <p className="text-[10px] text-gray-500">Resolve exceptions &amp; fields</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                step3Active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-100 text-gray-400'
              }`}>
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-xs font-bold ${step3Active ? 'text-gray-900' : 'text-gray-400'}`}>
                  3. Export Register
                </p>
                <p className="text-[10px] text-gray-500">Ready for Three-Way Match</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Dashboard Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Invoices</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalCount}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-emerald-600" />
              Auto-Validated
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{autoValidatedCount}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
              Human-Verified
            </p>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">{humanVerifiedCount}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Review Required
            </p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{reviewRequiredCount}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-600" />
              Duplicates
            </p>
            <p className="text-2xl font-extrabold text-amber-800 mt-1">{duplicatesCount}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-600" />
              Extraction Failed
            </p>
            <p className="text-2xl font-extrabold text-rose-700 mt-1">{failedCount}</p>
          </div>
        </div>

        {/* 4. Main Section Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          {/* Header Bar inside Section Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl shrink-0">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-gray-900">
                  Invoice Extraction Review
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload supplier invoices, review validation exceptions and prepare reliable invoice data for three-way matching.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {invoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  className="bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-2 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Clear all invoices"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Clear All</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAddManualInvoice}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Manual Invoice</span>
              </button>

              <button
                type="button"
                onClick={handleLoadDemos}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Load Sample Batch</span>
              </button>
            </div>
          </div>

          {/* Active Batch Banner */}
          {invoices.length > 0 && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Active Invoice Batch</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-indigo-900">
                <span>Total Documents: <strong className="font-bold">{invoices.length}</strong></span>
                {pendingCount > 0 && <span>Processing: <strong className="font-bold text-amber-700">{pendingCount}</strong></span>}
                <span>Requiring Review: <strong className="font-bold text-amber-700">{attentionInvoices.length}</strong></span>
                <span>Ready for Export: <strong className="font-bold text-emerald-700">{cleanInvoices.length}</strong></span>
              </div>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer relative ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50/20' 
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/80 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-gray-900">
                Select or Drop Supplier Invoices Here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports PDF, JPEG and PNG invoice documents. (Max 20MB per file)
              </p>
            </div>
          </div>

          {/* Main Grid: Queue on Left, Workspace on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            
            {/* Document Queue Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Document Queue ({invoices.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {invoices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowClearConfirmModal(true)}
                        className="text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Clear all invoices"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear All
                      </button>
                    )}
                    <span className="text-[11px] text-gray-500 font-mono font-semibold">
                      {cleanInvoices.length} Ready
                    </span>
                  </div>
                </div>

                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 text-gray-400">
                    <FileSearch className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-600">No invoices loaded yet</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                      Upload supplier PDFs or click "Load Sample Batch" to begin extraction.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {/* Needs Attention / Human Review Section */}
                    {attentionInvoices.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Needs Human Review ({attentionInvoices.length})
                        </h4>
                        <div className="space-y-2">
                          {attentionInvoices.map(inv => renderInvoiceItem(inv, true))}
                        </div>
                      </div>
                    )}

                    {/* Ready for Matching Section */}
                    {cleanInvoices.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Ready for Three-Way Match ({cleanInvoices.length})
                        </h4>
                        <div className="space-y-2">
                          {cleanInvoices.map(inv => renderInvoiceItem(inv, false))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Workflow Policy Box */}
              <div className="bg-gray-900 text-white p-4 rounded-xl text-xs space-y-1.5 shadow-xs border border-gray-800">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <Info className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span>Exception-Based AP Review</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Routine invoices with no missing fields, math errors, or duplicate flags proceed automatically to three-way matching. Madam Lim reviews only invoices containing exceptions.
                </p>
              </div>
            </div>

            {/* Right Column: Invoice Workspace */}
            <div className="lg:col-span-8 flex flex-col">
              {!selectedInvoice ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400 flex flex-col items-center justify-center min-h-[500px]">
                  <FileSpreadsheet className="w-16 h-16 text-gray-200 mb-3" />
                  <h3 className="font-bold text-gray-700 text-sm">Select an invoice from the queue</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    Choose an item on the left to inspect original PDF documents, review extracted field data, and verify accounts payable entries.
                  </p>
                </div>
              ) : selectedInvoice.status === 'error' ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 mb-6">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-rose-900 text-sm">Extraction Error</h4>
                      <p className="text-xs text-rose-700 mt-1">{selectedInvoice.errorMessage}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleConvertErrorToDraft(selectedInvoice.id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      Enter Details Manually
                    </button>
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-6 min-h-[400px]">
                    <InvoiceDocumentPreview invoice={selectedInvoice} />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                  {/* Workspace Header Bar & Tabs */}
                  <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                        {selectedInvoice.supplierName || selectedInvoice.fileName}
                        {selectedInvoice.invoiceNumber && (
                          <span className="font-mono text-xs font-semibold text-gray-500">
                            #{selectedInvoice.invoiceNumber}
                          </span>
                        )}
                      </h2>
                      <p className="text-[11px] text-gray-500 font-mono">
                        File: {selectedInvoice.fileName}
                      </p>
                    </div>

                    {/* Main View Tabs */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs text-xs overflow-x-auto">
                      {[
                        { id: 'preview', label: 'Document View', icon: Eye },
                        { id: 'supplier', label: 'Supplier', icon: Building2 },
                        { id: 'metadata', label: 'Invoice Details', icon: Calendar },
                        { id: 'banking', label: 'Banking & Terms', icon: CreditCard },
                        { id: 'totals', label: 'Totals', icon: Coins },
                        { id: 'history', label: `Verified Ledger (${historicalRecords.length})`, icon: History },
                      ].map(tab => {
                        const IconComp = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                              isActive
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 font-bold border'
                                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Prev / Next Quick Nav Controls */}
                      <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={handleGoPrevInvoice}
                          disabled={!hasPrevInvoice}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Previous Invoice"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-mono font-bold px-2 text-gray-600 border-x border-gray-100 min-w-[55px] text-center">
                          {currentInvoiceIndex >= 0 ? currentInvoiceIndex + 1 : 0} / {invoices.length}
                        </span>
                        <button
                          type="button"
                          onClick={handleGoNextInvoice}
                          disabled={!hasNextInvoice}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Next Invoice"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportSelected}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Export This Invoice</span>
                      </button>
                    </div>
                  </div>

                  {/* Form & Tab Content */}
                  <div className="p-5 sm:p-6 min-h-[500px]">
                    {activeTab === 'preview' ? (
                      <div className="space-y-6">
                        <InvoiceDocumentPreview 
                          invoice={selectedInvoice} 
                          duplicateInfo={selectedDupDetails}
                        />
                        {renderFormContent('supplier')}
                      </div>
                    ) : activeTab === 'history' ? (
                      renderHistoryTabContent()
                    ) : (
                      renderFormContent(activeTab)
                    )}
                  </div>

                  {/* Review Navigation Footer */}
                  <div className="bg-gray-50/90 border-t border-gray-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleGoPrevInvoice}
                      disabled={!hasPrevInvoice}
                      className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                      <span>Previous Invoice</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-gray-500 hidden sm:inline mr-2">
                        Invoice {currentInvoiceIndex >= 0 ? currentInvoiceIndex + 1 : 0} of {invoices.length}
                      </span>

                      <button
                        type="button"
                        onClick={handleGoNextInvoice}
                        disabled={!hasNextInvoice}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                      >
                        <span>Next Invoice</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase mt-auto">
        BOON HUAT HARDWARE &amp; SUPPLIES • INVOICEGUARD AP SYSTEM
      </footer>

      {/* Historical Ledger Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-gray-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gray-50 text-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm">Verified Invoice Ledger History</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-xs text-gray-600">
                This table contains all invoices previously verified and saved in local browser storage. Duplicate detection automatically checks against these records to prevent double-processing.
              </p>

              {historicalRecords.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No verified invoice history recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-3">Verified Date</th>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Supplier Name</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Currency</th>
                        <th className="p-3">File Name</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historicalRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-400 font-mono">{new Date(rec.verifiedAt).toLocaleDateString()}</td>
                          <td className="p-3 font-bold font-mono text-gray-900">#{rec.invoiceNumber}</td>
                          <td className="p-3 text-gray-800 font-medium">{rec.supplierName}</td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">${rec.finalAmountPayable.toFixed(2)}</td>
                          <td className="p-3 font-mono text-gray-600">{rec.currency}</td>
                          <td className="p-3 text-gray-500 truncate max-w-[150px]">{rec.fileName}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => handleRemoveIndividualHistory(rec.id, e)}
                              className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded border border-rose-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Remove record"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={historicalRecords.length === 0}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear History Ledger
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Invoices Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Clear All Invoices?</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  This action will remove all {invoices.length} currently loaded invoice document(s) from your active workspace.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Unsaved verification status or edits in the current queue will be lost.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Workspace Invoices ({invoices.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Duplicate History Confirmation Modal */}
      {showClearHistoryConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Clear Duplicate History?</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  This action will permanently erase all locally stored verified invoice records from browser key <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">invoice_duplicate_history_v2</code>.
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                Storage Clearance Distinctions:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-indigo-800">
                <li><strong>Clear All Invoices:</strong> Clears visible working batch items in your active workspace queue.</li>
                <li><strong>Clear Duplicate History:</strong> Erases saved historical records used for cross-batch duplicate detection.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirmModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearHistory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Duplicate History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12 Duplicate Tests Results Modal */}
      {testModalResults && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm">12 Duplicate Detection Suite Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalResults(null)}
                className="text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                testModalResults.allPassed ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                {testModalResults.allPassed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-extrabold text-xs">
                    {testModalResults.allPassed ? 'All 12 Mandatory Tests Passed Successfully!' : 'Some Duplicate Verification Tests Failed'}
                  </h4>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {testModalResults.allPassed 
                      ? 'Definitive duplicate detection logic verified against all required edge cases.'
                      : 'Please review individual failing test cases below.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {testModalResults.results.map(t => (
                  <div key={t.testNumber} className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    t.passed ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                      t.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {t.testNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">{t.description}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{t.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setTestModalResults(null)}
                className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
