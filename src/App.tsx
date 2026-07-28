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
  FileSearch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceData, InvoiceLineItem } from './types';
import { exportInvoicesToExcel } from './utils/excel';
import { getInvoiceMissingFields, analyzeDuplicates } from './utils/validation';
import { InvoiceDocumentPreview } from './components/InvoiceDocumentPreview';
import { generateInvoiceDocumentSvg } from './utils/documentSvgGenerator';

// Raw demo invoice data templates
const RAW_DEMO_INVOICES: InvoiceData[] = [
  {
    id: 'demo-1',
    fileName: 'apex_fasteners_inv_2049.pdf',
    fileType: 'application/pdf',
    status: 'success',
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
    totalTax: 119.00, // 10% tax rate average
    deliveryCharges: 35.00,
    finalAmountPayable: 1344.00,
    amountAlreadyPaid: 344.00,
    outstandingBalance: 1000.00,
    paymentTerms: 'Net 30',
    acceptedPaymentMethod: 'Bank Transfer, Credit Card',
    latePaymentTerms: '1.5% monthly interest applied after due date',
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
    totalTax: 62.30, // 7% state tax
    deliveryCharges: 15.00,
    finalAmountPayable: 967.30,
    amountAlreadyPaid: 967.30,
    outstandingBalance: 0.00,
    paymentTerms: 'Due on Receipt',
    acceptedPaymentMethod: 'Bank Transfer, Check, ACH',
    latePaymentTerms: 'Flat $25 fee for payments received over 5 days late',
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
    invoiceNumber: 'TS-4309-X',
    invoiceDate: '2026-07-14',
    paymentDueDate: '2026-08-13',
    currency: 'USD',
    purchaseOrder: '',
    supplierName: 'Northwest Pine Lumber & Timber',
    supplierAddress: '928 Fir Ridge Road, Portland, OR 97201',
    supplierContact: 'billing@nwpinetimber.com | +1 (503) 555-4309',
    businessRegistrationOrTaxId: 'OR-REG-5034',
    bankDetails: 'Pacific Northwest Federal Reserve (SWIFT: PACNW77)',
    bankAccount: 'OR88-3481-9920-5511',
    invoiceSubtotal: 3150.00,
    totalDiscount: 150.00,
    totalTax: 0, // No sales tax in OR
    deliveryCharges: 250.00,
    finalAmountPayable: 3250.00,
    amountAlreadyPaid: 0,
    outstandingBalance: 3250.00,
    paymentTerms: 'Net 30',
    acceptedPaymentMethod: 'Bank Wire Transfer',
    latePaymentTerms: '2% monthly compound interest begins after 30-day grace period',
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
    invoiceNumber: 'IP-8820',
    invoiceDate: '2026-07-15',
    paymentDueDate: '', // Intentionally missing payment due date to showcase 'Invoices that need attention'
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
  const [activeTab, setActiveTab] = useState<'preview' | 'supplier' | 'metadata' | 'banking' | 'totals'>('preview');
  const [viewLayout, setViewLayout] = useState<'tabbed' | 'split'>('tabbed');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed metrics
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let successfulCount = 0;

    invoices.forEach(inv => {
      if (inv.status === 'success') {
        totalInvoiced += inv.finalAmountPayable || 0;
        totalPaid += inv.amountAlreadyPaid || 0;
        totalOutstanding += inv.outstandingBalance || 0;
        successfulCount++;
      }
    });

    return { totalInvoiced, totalPaid, totalOutstanding, successfulCount };
  }, [invoices]);

  const selectedInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const duplicateAnalysis = useMemo(() => {
    return analyzeDuplicates(invoices);
  }, [invoices]);

  const duplicateCount = useMemo(() => {
    return Object.values(duplicateAnalysis).filter((x: any) => x.isDuplicate).length;
  }, [duplicateAnalysis]);

  const missingInfoCount = useMemo(() => {
    return invoices.filter(inv => inv.status === 'success' && getInvoiceMissingFields(inv).length > 0).length;
  }, [invoices]);

  const { attentionInvoices, cleanInvoices } = useMemo(() => {
    const attention: InvoiceData[] = [];
    const clean: InvoiceData[] = [];

    invoices.forEach(inv => {
      if (inv.status !== 'success') {
        attention.push(inv);
        return;
      }
      const isDuplicate = !!duplicateAnalysis[inv.id]?.isDuplicate;
      const hasMissingFields = getInvoiceMissingFields(inv).length > 0;
      const isExplicitlyVerified = inv.isVerified === true;

      // Clean (Ready & Verified) means: status is success, not a duplicate, and either no missing fields OR explicitly verified by user
      if (!isDuplicate && (!hasMissingFields || isExplicitlyVerified)) {
        clean.push(inv);
      } else {
        attention.push(inv);
      }
    });

    return { attentionInvoices: attention, cleanInvoices: clean };
  }, [invoices, duplicateAnalysis]);

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

  // Helper to call extraction API with client-side retry on 429 rate limit
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
        // Wait 3 seconds before retrying on 429 rate limit
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      throw new Error(errorMessage);
    }
  };

  // Convert files to base64 and process sequentially/concurrently
  const handleFiles = async (files: File[]) => {
    setIsUploading(true);

    const validFiles = files.filter(file => {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      return isPdf || isImage;
    });

    if (validFiles.length === 0) {
      alert("Please upload valid PDF, JPEG, or PNG invoice files.");
      setIsUploading(false);
      return;
    }

    // Create temporary entries in state
    const newInvoices: InvoiceData[] = validFiles.map(file => ({
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileType: file.type,
      status: 'pending',
      invoiceNumber: '',
      invoiceDate: '',
      paymentDueDate: '',
      currency: 'USD',
      purchaseOrder: '',
      supplierName: '',
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
        // Stagger requests slightly to keep rate limits clean
        await new Promise(r => setTimeout(r, 1200));
      }
      const file = validFiles[i];
      const placeholder = newInvoices[i];

      try {
        const { base64Data, fullDataUrl } = await convertFileToBase64(file);
        
        // Immediately attach source preview URL and base64Data so document is viewable even if extraction hits API quota
        setInvoices(prev => prev.map(inv => {
          if (inv.id === placeholder.id) {
            return {
              ...inv,
              fileDataUrl: fullDataUrl,
              base64Data: base64Data
            };
          }
          return inv;
        }));

        const data = await callExtractInvoiceApi(file.name, file.type, base64Data);

        // Ensure all extracted array lineItems have unique client-side IDs
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
              fileDataUrl: fullDataUrl,
              base64Data: base64Data,
              invoiceNumber: data.invoiceNumber || '',
              invoiceDate: data.invoiceDate || '',
              paymentDueDate: data.paymentDueDate || '',
              currency: data.currency || 'USD',
              purchaseOrder: data.purchaseOrder || '',
              supplierName: data.supplierName || 'Hardware Supplier',
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
              errorMessage: error.message || 'Verification or model parsing failed.'
            };
          }
          return inv;
        }));
      }
    }

    setIsUploading(false);
  };

  // Retry AI extraction for a specific invoice
  const handleRetryExtraction = async (invId: string) => {
    const target = invoices.find(inv => inv.id === invId);
    if (!target) return;

    let base64 = target.base64Data;
    if (!base64 && target.fileDataUrl && target.fileDataUrl.includes(',')) {
      base64 = target.fileDataUrl.split(',')[1];
    }

    if (!base64) {
      alert("Source document file data is unavailable to retry extraction. Please re-upload the document.");
      return;
    }

    // Set to pending state
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invId) {
        return {
          ...inv,
          status: 'pending',
          errorMessage: undefined
        };
      }
      return inv;
    }));

    try {
      const data = await callExtractInvoiceApi(target.fileName, target.fileType, base64);

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
        if (inv.id === invId) {
          return {
            ...inv,
            status: 'success',
            errorMessage: undefined,
            invoiceNumber: data.invoiceNumber || inv.invoiceNumber || '',
            invoiceDate: data.invoiceDate || inv.invoiceDate || '',
            paymentDueDate: data.paymentDueDate || inv.paymentDueDate || '',
            currency: data.currency || inv.currency || 'USD',
            purchaseOrder: data.purchaseOrder || inv.purchaseOrder || '',
            supplierName: data.supplierName || inv.supplierName || 'Hardware Supplier',
            supplierAddress: data.supplierAddress || inv.supplierAddress || '',
            supplierContact: data.supplierContact || inv.supplierContact || '',
            businessRegistrationOrTaxId: data.businessRegistrationOrTaxId || inv.businessRegistrationOrTaxId || '',
            bankDetails: data.bankDetails || inv.bankDetails || '',
            bankAccount: data.bankAccount || inv.bankAccount || '',
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
            lineItems: parsedLineItems
          };
        }
        return inv;
      }));

    } catch (error: any) {
      console.error("Retry extraction failed", target.fileName, error);
      setInvoices(prev => prev.map(inv => {
        if (inv.id === invId) {
          return {
            ...inv,
            status: 'error',
            errorMessage: error.message || 'Retry extraction failed.'
          };
        }
        return inv;
      }));
    }
  };

  // Convert a failed invoice into a manual draft so the user can type in details directly beside the PDF preview
  const handleConvertErrorToDraft = (invId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invId) {
        const derivedSupplier = inv.supplierName && inv.supplierName.trim() !== '' 
          ? inv.supplierName 
          : inv.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const today = new Date().toISOString().split('T')[0];
        const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return {
          ...inv,
          status: 'success',
          errorMessage: undefined,
          supplierName: derivedSupplier || 'Hardware Supplier Draft',
          invoiceNumber: inv.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
          invoiceDate: inv.invoiceDate || today,
          paymentDueDate: inv.paymentDueDate || thirtyDays,
          paymentTerms: inv.paymentTerms || 'Net 30',
          currency: inv.currency || 'USD',
          acceptedPaymentMethod: inv.acceptedPaymentMethod || 'Bank Transfer'
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

  // Add a blank invoice manually
  const handleAddManualInvoice = () => {
    const manualId = `manual-${Date.now()}`;
    const baseManual: InvoiceData = {
      id: manualId,
      fileName: 'manual_entry.pdf',
      fileType: 'application/pdf',
      status: 'success',
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'USD',
      purchaseOrder: '',
      supplierName: 'New Hardware Supplier',
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
      paymentTerms: 'Net 30',
      acceptedPaymentMethod: 'Bank Transfer',
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

  // Edit fields dynamically
  const handleUpdateField = (field: keyof InvoiceData, value: any) => {
    if (!selectedInvoiceId) return;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === selectedInvoiceId) {
        const updated = { ...inv, [field]: value };
        // Recalculate outstanding balance if we change amounts
        if (field === 'finalAmountPayable' || field === 'amountAlreadyPaid') {
          const finalAmt = field === 'finalAmountPayable' ? Number(value) : inv.finalAmountPayable;
          const paidAmt = field === 'amountAlreadyPaid' ? Number(value) : inv.amountAlreadyPaid;
          updated.outstandingBalance = Math.max(0, finalAmt - paidAmt);
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
            // Auto recalculate the line item total
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
            const disc = field === 'discount' ? Number(value) : item.discount;
            const taxR = field === 'taxRate' ? Number(value) : item.taxRate;
            
            // Item total formula: (Qty * Price) - Item-level discount + Item-level tax amount
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
          lineItems: updatedItems
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
      description: 'New Hardware Supply / Service',
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
          lineItems: [...inv.lineItems, newItem]
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
          lineItems: inv.lineItems.filter(item => item.id !== itemId)
        };
      }
      return inv;
    }));
  };

  // Recalculate Totals from Line Items
  const handleSyncTotals = () => {
    if (!selectedInvoice) return;

    // Sum of item totals before tax
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
          outstandingBalance: parseFloat(outstanding.toFixed(2))
        };
      }
      return inv;
    }));
  };

  // Single or Bulk Excel Export - Only Ready & Verified Invoices
  const handleExportAll = () => {
    if (cleanInvoices.length === 0) {
      alert("No ready and verified invoices available to download.\n\nInvoices with missing fields, duplicate flags, or processing errors must be reviewed and completed before exporting to Excel.");
      return;
    }

    const unverifiedCount = invoices.length - cleanInvoices.length;
    if (unverifiedCount > 0) {
      alert(`Consolidated Spreadsheet Export:\n\nExporting ${cleanInvoices.length} Ready & Verified invoice(s) to Excel.\n\nNote: ${unverifiedCount} invoice(s) that are incomplete, unverified, or flagged as duplicates were excluded from this download.`);
    }

    exportInvoicesToExcel(cleanInvoices, `Hardware_AP_Verified_Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportSelected = () => {
    if (!selectedInvoice) return;

    const isVerifiedAndReady = cleanInvoices.some(inv => inv.id === selectedInvoice.id);

    if (!isVerifiedAndReady) {
      const missingFields = getInvoiceMissingFields(selectedInvoice);
      const isDuplicate = !!duplicateAnalysis[selectedInvoice.id]?.isDuplicate;
      
      let message = `Cannot export "${selectedInvoice.supplierName || selectedInvoice.fileName}" because it is not ready & verified.\n\n`;
      if (selectedInvoice.status === 'pending') {
        message += "• The document is still analyzing.\n";
      } else if (selectedInvoice.status === 'error') {
        message += "• The document encountered an extraction error.\n";
      } else {
        if (isDuplicate) message += "• Flagged as a duplicate document in the ledger.\n";
        if (missingFields.length > 0) message += `• Missing mandatory fields: ${missingFields.join(', ')}.\n`;
      }
      message += "\nPlease fill in the missing fields or click 'Mark as Verified' before exporting to Excel.";
      alert(message);
      return;
    }

    exportInvoicesToExcel([selectedInvoice], `Verified_Invoice_${selectedInvoice.invoiceNumber || 'Detail'}.xlsx`);
  };

  const renderFormContent = (effectiveTab: 'supplier' | 'metadata' | 'banking' | 'totals') => {
    if (!selectedInvoice) return null;
    const dupInfo = duplicateAnalysis[selectedInvoice.id];
    const missingFields = getInvoiceMissingFields(selectedInvoice);

    return (
      <div className="space-y-6">
        {dupInfo?.isDuplicate && (
          <div className="bg-amber-500/10 border border-amber-300 border-l-4 border-l-amber-500 p-4 rounded-r-xl shadow-xs">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  Attention: Flagged as Duplicate Document
                </h4>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  This document shares an identical <span className="font-semibold text-amber-800">{dupInfo.reason === 'Filename' ? 'Filename' : 'Invoice Number & Supplier'}</span> with another invoice in the ledger. 
                  {dupInfo.primaryId && (
                    <span> The first/primary unique record is kept for consolidated exports. This item is fully editable, but will be excluded from the "Download All" spreadsheet to prevent redundant rows.</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {missingFields.length > 0 && !selectedInvoice.isVerified && (
          <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4 rounded-r-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                    Caution: Invoice is missing required AP details
                    <span className="text-[10px] bg-amber-200 text-amber-800 font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                      {missingFields.length} missing
                    </span>
                  </h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    The following mandatory accounts payable columns are empty or unpopulated. Populate them or mark as verified to include in Excel exports:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-[11px] text-amber-800 mt-2.5 font-medium list-disc pl-4">
                    {missingFields.map((field, idx) => (
                      <li key={idx}>{field}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleUpdateField('isVerified', true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer self-start sm:self-center"
                title="Manually verify this invoice so it can be exported to Excel"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark as Verified
              </button>
            </div>
          </div>
        )}

        {selectedInvoice.isVerified && (
          <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 p-3.5 rounded-r-xl shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">
                  Invoice Verified &amp; Ready for Excel Export
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  This document is marked as verified and will be included when downloading the Excel spreadsheet.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleUpdateField('isVerified', false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
            >
              Unverify
            </button>
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
                  !selectedInvoice.supplierName || selectedInvoice.supplierName.trim() === '' || selectedInvoice.supplierName === 'Unknown Supplier'
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Apex Fasteners / Acme Timber"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Supplier Corporate Address
              </label>
              <textarea
                value={selectedInvoice.supplierAddress}
                onChange={(e) => handleUpdateField('supplierAddress', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 min-h-[70px] ${
                  !selectedInvoice.supplierAddress || selectedInvoice.supplierAddress.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="123 Industrial Dr..."
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
                Invoice Number
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
                placeholder="INV-XXXX"
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
                Invoice Issue Date
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
                Payment Due Date
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
                Invoice Currency used
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
                placeholder="USD, EUR, GBP, CAD"
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
                placeholder="Trust Bank, Cleveland Branch (BIC: TRSTUS44)"
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
                placeholder="US10-2030-4050-6070"
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
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  !selectedInvoice.acceptedPaymentMethod || selectedInvoice.acceptedPaymentMethod.trim() === ''
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
                placeholder="Bank Transfer, ACH, Check"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center justify-between">
                <span>Standard Payment Terms</span>
                <span className="text-[10px] text-slate-400 font-normal">Parsed from fine print / T&amp;C</span>
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
                placeholder="e.g., Net 30, Due on Receipt, 2/10 Net 30"
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
                Invoice Subtotal ({selectedInvoice.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.invoiceSubtotal}
                onChange={(e) => handleUpdateField('invoiceSubtotal', Number(e.target.value))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  selectedInvoice.invoiceSubtotal === undefined || selectedInvoice.invoiceSubtotal === null || selectedInvoice.invoiceSubtotal <= 0
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
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
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  selectedInvoice.totalTax === undefined || selectedInvoice.totalTax === null
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
                }`}
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
                Final Amount Payable ({selectedInvoice.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={selectedInvoice.finalAmountPayable}
                onChange={(e) => handleUpdateField('finalAmountPayable', Number(e.target.value))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  selectedInvoice.finalAmountPayable === undefined || selectedInvoice.finalAmountPayable === null || selectedInvoice.finalAmountPayable <= 0
                    ? 'border-amber-300 bg-amber-50/10 focus:border-amber-500 focus:ring-amber-500 font-semibold'
                    : 'border-slate-800 bg-slate-100 focus:border-emerald-500 font-semibold'
                }`}
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
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition hover:scale-[1.01] cursor-pointer"
                title="Auto recalculate totals based on item rows"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recalculate Totals from Line Items
              </button>
            </div>
          </motion.div>
        )}

        {/* Granular Line Items Breakdown Section - Always Visible below tabs */}
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
                          className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition"
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
      </div>
    );
  };

  const renderInvoiceItem = (inv: InvoiceData, isAttentionSection: boolean) => {
    const isSelected = inv.id === selectedInvoiceId;
    const missingFields = inv.status === 'success' ? getInvoiceMissingFields(inv) : [];
    const hasMissingDetails = missingFields.length > 0;
    const dupMeta = duplicateAnalysis[inv.id];

    return (
      <div
        key={inv.id}
        id={`invoice-item-${inv.id}`}
        onClick={() => setSelectedInvoiceId(inv.id)}
        className={`p-3.5 transition cursor-pointer flex items-start justify-between gap-3 ${
          isSelected 
            ? 'bg-slate-100/95 border-l-4 border-slate-800' 
            : isAttentionSection 
              ? 'bg-amber-50/40 hover:bg-amber-100/60 border-l-4 border-amber-400' 
              : 'hover:bg-slate-50 border-l-4 border-transparent'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-bold text-slate-800 truncate block max-w-[160px]">
              {inv.supplierName || inv.fileName}
            </span>
            {inv.status === 'pending' && (
              <span className="flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Analyzing
              </span>
            )}
            {inv.status === 'success' && !hasMissingDetails && !dupMeta?.isDuplicate && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-medium">
                Ready
              </span>
            )}
            {dupMeta?.isDuplicate && (
              <span 
                className="flex items-center gap-0.5 text-[10px] bg-red-600 text-white border border-red-700 px-1.5 py-0.5 rounded-full font-bold"
                title={`Duplicate document detected by: ${dupMeta.reason}`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-white animate-bounce" style={{ animationDuration: '3s' }} />
                Duplicate
              </span>
            )}
            {inv.status === 'success' && hasMissingDetails && (
              <span 
                className="flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold"
                title={`Missing mandatory fields: ${missingFields.join(', ')}`}
              >
                <AlertCircle className="w-2.5 h-2.5 text-amber-700" />
                Missing Info
              </span>
            )}
            {inv.status === 'error' && (
              <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded-full font-medium">
                Failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>#{inv.invoiceNumber || 'No Number'}</span>
            <span>•</span>
            <span>{inv.invoiceDate || 'No Date'}</span>
          </div>

          {/* Issue summary details for attention section */}
          {isAttentionSection && (
            <div className="mt-2 text-[11px] rounded p-2 bg-white/80 border border-amber-200/80 shadow-2xs space-y-1">
              {dupMeta?.isDuplicate && (
                <p className="flex items-center gap-1 font-bold text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  Duplicate document ({dupMeta.reason})
                </p>
              )}
              {hasMissingDetails && (
                <p className="flex items-start gap-1 font-semibold text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-950 font-bold">Missing:</strong> {missingFields.join(', ')}
                  </span>
                </p>
              )}
              {inv.status === 'error' && (
                <div className="space-y-1.5 pt-1">
                  <p className="flex items-start gap-1 text-red-700 font-semibold text-[11px] leading-tight">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{inv.errorMessage || 'Extraction error'}</span>
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryExtraction(inv.id);
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded flex items-center gap-1 transition cursor-pointer"
                      title="Retry AI extraction for this invoice"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-400" />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertErrorToDraft(inv.id);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded flex items-center gap-1 transition cursor-pointer"
                      title="Enter details manually alongside the document preview"
                    >
                      <Plus className="w-3 h-3" />
                      Fill Manually
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {inv.status === 'success' && !isAttentionSection && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Total: {inv.currency} {inv.finalAmountPayable.toFixed(2)}
              </span>
              {inv.outstandingBalance > 0 ? (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                  Bal: ${inv.outstandingBalance.toFixed(2)}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                  Paid
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 self-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInvoiceId(inv.id);
              setActiveTab('preview');
            }}
            className="text-slate-500 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded transition flex items-center gap-1 text-[11px] font-bold border border-slate-200 hover:border-emerald-200"
            title="Preview invoice document next to ledger"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline text-slate-700 hover:text-emerald-700">Preview</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteInvoice(inv.id, e)}
            className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-200/50 rounded transition"
            title="Remove invoice"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="applet-root" className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased flex flex-col">
      {/* Top Professional Header Banner */}
      <header id="applet-header" className="bg-slate-900 text-white border-b border-slate-800 py-4 px-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-emerald-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Invoice Extractor to Excel
              <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-mono uppercase">
                AP Desk Assistant
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Accounts Payable hub for automated document extraction and structured spreadsheet mapping.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {cleanInvoices.length > 0 ? (
            <button
              id="btn-export-all-header"
              onClick={handleExportAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
              title="Download all ready and verified invoices into a consolidated multi-sheet Excel workbook"
            >
              <Download className="w-4 h-4 animate-bounce" style={{ animationDuration: '2.5s' }} />
              Download Verified Invoices ({cleanInvoices.length})
            </button>
          ) : (
            <button
              id="btn-export-all-header-disabled"
              onClick={() => alert("No ready and verified invoices available to export. Invoices with missing fields or duplicate flags must be reviewed and completed before downloading.")}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-400 rounded-lg text-sm font-medium border border-slate-700 cursor-pointer"
              title="No ready & verified invoices to export"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Download Verified Invoices (0)
            </button>
          )}

          <button
            id="btn-demo-data"
            onClick={handleLoadDemos}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-sm font-medium transition shadow-sm hover:bg-slate-700 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Load Sample Invoices
          </button>

          <button
            id="btn-add-manual"
            onClick={handleAddManualInvoice}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-sm font-medium transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Invoice Manually
          </button>
        </div>
      </header>

      {/* Main Aggregated Metrics Hub */}
      <section id="metrics-bar" className="bg-white border-b border-slate-200 py-4 px-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Row: Processed Invoices, Duplicates Detected, Missing Info */}
          <div id="metric-processed-invoices" className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="p-2.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Ready &amp; Verified for Excel</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{cleanInvoices.length} <span className="text-xs font-normal text-slate-500">/ {invoices.length} total</span></div>
            </div>
          </div>

          <div id="metric-duplicates-detected" className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors ${
            duplicateCount > 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div className={`p-2.5 rounded-full shrink-0 ${
              duplicateCount > 0 ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Duplicates Detected</div>
              <div className={`text-xl font-bold mt-0.5 ${duplicateCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {duplicateCount} {duplicateCount === 1 ? 'Invoice' : 'Invoices'}
              </div>
            </div>
          </div>

          <div id="metric-missing-info" className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors ${
            missingInfoCount > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div className={`p-2.5 rounded-full shrink-0 ${
              missingInfoCount > 0 ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              <AlertCircle className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Missing Info</div>
              <div className={`text-xl font-bold mt-0.5 ${missingInfoCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {missingInfoCount} {missingInfoCount === 1 ? 'Invoice' : 'Invoices'}
              </div>
            </div>
          </div>

          {/* Bottom Row: Total Invoiced AP, Total Amount Paid, Net AP Outstanding */}
          <div id="metric-total-invoiced" className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="p-2.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              <Coins className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Total Invoiced AP</div>
              <div className="text-xl font-bold text-slate-800 mt-0.5">
                ${stats.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div id="metric-total-paid" className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="p-2.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <CreditCard className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Total Amount Paid</div>
              <div className="text-xl font-bold text-slate-800 mt-0.5">
                ${stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div id="metric-net-outstanding" className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="p-2.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
              <DollarSign className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Net AP Outstanding</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">
                ${stats.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid Content Area */}
      <main id="main-content-layout" className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] w-full mx-auto">
        
        {/* Left Hand: Upload Area and Invoice Queue Panel */}
        <div id="left-pane" className="lg:col-span-4 flex flex-col gap-6">
          
          {/* File Upload Target Component */}
          <div 
            id="dropzone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[180px] bg-white hover:border-emerald-500 hover:bg-emerald-50/10 ${
              dragActive ? 'border-emerald-500 bg-emerald-50/30 scale-[0.98]' : 'border-slate-300 bg-white'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple 
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
            />
            
            <div className="bg-slate-100 text-slate-600 p-3 rounded-full mb-3.5 border border-slate-200">
              {isUploading ? (
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              ) : (
                <Upload className="w-7 h-7 text-slate-600" />
              )}
            </div>
            
            <h3 className="font-semibold text-slate-700 text-sm">
              {isUploading ? "Uploading & Extracting..." : "Drag & Drop Invoice Files Here"}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-[260px] mx-auto">
              Supports <strong className="text-slate-700">PDF, JPEG, and PNG</strong> formats. Multiple files accepted.
            </p>
            <button 
              type="button"
              className="mt-4 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Browse Files
            </button>
          </div>

          {/* Invoices List / Queue */}
          <div id="invoice-queue" className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 min-h-[350px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                AP Invoice Ledger
                <span className="text-[11px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                  {invoices.length}
                </span>
                <span 
                  className={`inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full ${
                    duplicateCount > 0 
                      ? 'bg-red-100 text-red-900 border-red-300' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`} 
                  title={`${duplicateCount} duplicate document(s) detected`}
                >
                  <AlertTriangle className={`w-3 h-3 shrink-0 ${duplicateCount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                  {duplicateCount} Duplicate{duplicateCount === 1 ? '' : 's'}
                </span>
                <span 
                  className={`inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full ${
                    missingInfoCount > 0 
                      ? 'bg-amber-100 text-amber-900 border-amber-300' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`} 
                  title={`${missingInfoCount} invoice(s) with missing required info`}
                >
                  <AlertCircle className={`w-3 h-3 shrink-0 ${missingInfoCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                  {missingInfoCount} Missing Info
                </span>
              </h2>
              <button
                id="btn-export-all"
                onClick={handleExportAll}
                className={`text-xs font-bold flex items-center gap-1 border px-2.5 py-1 rounded transition cursor-pointer ${
                  cleanInvoices.length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
                title="Export only ready & verified invoices to Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Excel Export ({cleanInvoices.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[580px]">
              {invoices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <FileText className="w-10 h-10 stroke-1 mb-2.5 text-slate-300" />
                  <p className="text-xs font-medium">No invoices loaded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                    Upload a local hardware supplier invoice file, or inject sample data above.
                  </p>
                </div>
              ) : (
                <div>
                  {/* SECTION 1: INVOICES THAT NEED ATTENTION */}
                  <div id="section-invoices-needing-attention" className="border-b border-slate-200">
                    <div className="bg-amber-50/90 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-bold text-amber-950 tracking-wide uppercase">
                          Invoices that need attention
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          attentionInvoices.length > 0 ? 'bg-amber-200 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {attentionInvoices.length}
                        </span>
                      </div>
                      {attentionInvoices.length === 0 && (
                        <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          No issues detected
                        </span>
                      )}
                    </div>

                    {attentionInvoices.length > 0 ? (
                      <div className="divide-y divide-amber-100/80 bg-amber-50/20">
                        {attentionInvoices.map(inv => renderInvoiceItem(inv, true))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-[11px] text-slate-400 bg-slate-50/30 italic">
                        All invoices have complete details with no duplicates.
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: READY & VERIFIED INVOICES */}
                  <div id="section-verified-invoices">
                    <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                          Ready & Verified Invoices
                        </span>
                        <span className="text-[11px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                          {cleanInvoices.length}
                        </span>
                      </div>
                    </div>

                    {cleanInvoices.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {cleanInvoices.map(inv => renderInvoiceItem(inv, false))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        No verified complete invoices in queue.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Hand: Interactive Detail Review Workspace */}
        <div id="right-pane" className="lg:col-span-8 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm min-h-[500px]">
          
          {selectedInvoice ? (
            <div className="flex flex-col h-full">
              
              {/* Workspace Header Panel */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 rounded-t-xl">
                <div>
                  <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    Review extracted: {selectedInvoice.supplierName || selectedInvoice.fileName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Source document: {selectedInvoice.fileName}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 mr-1">
                    <button
                      type="button"
                      onClick={() => setViewLayout('tabbed')}
                      className={`px-2.5 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        viewLayout === 'tabbed' 
                          ? 'bg-white text-slate-800 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Tabs View Mode"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Tabs View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewLayout('split');
                        if (activeTab === 'preview') setActiveTab('supplier');
                      }}
                      className={`px-2.5 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        viewLayout === 'split' 
                          ? 'bg-slate-800 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Side-by-Side Split View with live document preview"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Side-by-Side Split</span>
                    </button>
                  </div>

                  {selectedInvoice.status === 'success' && (
                    <button
                      id="btn-export-selected"
                      onClick={handleExportSelected}
                      className={`flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg border shadow-xs transition cursor-pointer ${
                        cleanInvoices.some(inv => inv.id === selectedInvoice.id)
                          ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-800'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                      title={cleanInvoices.some(inv => inv.id === selectedInvoice.id) ? "Download this verified invoice as an Excel spreadsheet" : "This invoice has missing details or duplicate flags"}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {cleanInvoices.some(inv => inv.id === selectedInvoice.id) ? "Download Excel" : "Export Invoice"}
                    </button>
                  )}
                  <button
                    id="btn-export-all-review-header"
                    onClick={handleExportAll}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition hover:scale-[1.02] cursor-pointer"
                    title="Download all ready and verified invoices into Excel"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Verified ({cleanInvoices.length})
                  </button>
                </div>
              </div>

              {/* Extraction Error Banner if Status is Error */}
              {selectedInvoice.status === 'error' && (
                <div className="bg-red-50/90 border border-red-200 border-l-4 border-l-red-500 p-4 m-4 mb-0 rounded-r-xl shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5.5 h-5.5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-red-950 text-sm flex items-center gap-2">
                          AI Document Extraction Unsuccessful
                          <span className="text-[10px] bg-red-200 text-red-900 font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                            Rate Limit / Quota
                          </span>
                        </h3>
                        <p className="text-xs text-red-800 mt-1 leading-relaxed">
                          {selectedInvoice.errorMessage || "The Gemini AI service is currently rate limited or temporarily busy."}
                        </p>
                        <p className="text-[11px] text-red-700 mt-1.5 font-medium">
                          You can click <strong>Retry Extraction</strong> to re-run AI parsing, or click <strong>Enter Details Manually</strong> to edit fields and line items directly beside the document preview.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleRetryExtraction(selectedInvoice.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        Retry Extraction
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConvertErrorToDraft(selectedInvoice.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Enter Details Manually
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 text-xs overflow-x-auto">
                <button
                  id="tab-preview"
                  onClick={() => {
                    setActiveTab('preview');
                    if (viewLayout === 'split') setViewLayout('tabbed');
                  }}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-center font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'preview' && viewLayout === 'tabbed'
                      ? 'border-emerald-600 text-emerald-800 bg-emerald-50/70 font-extrabold shadow-2xs' 
                      : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Document Preview</span>
                </button>

                <button
                  id="tab-supplier"
                  onClick={() => setActiveTab('supplier')}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-center font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'supplier' 
                      ? 'border-slate-800 text-slate-800 bg-white shadow-2xs font-bold' 
                      : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span>Supplier Profile</span>
                </button>

                <button
                  id="tab-metadata"
                  onClick={() => setActiveTab('metadata')}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-center font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'metadata' 
                      ? 'border-slate-800 text-slate-800 bg-white shadow-2xs font-bold' 
                      : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span>Invoice Metadata</span>
                </button>

                <button
                  id="tab-banking"
                  onClick={() => setActiveTab('banking')}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-center font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'banking' 
                      ? 'border-slate-800 text-slate-800 bg-white shadow-2xs font-bold' 
                      : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span>Banking &amp; Terms</span>
                </button>

                <button
                  id="tab-totals"
                  onClick={() => setActiveTab('totals')}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-center font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'totals' 
                      ? 'border-slate-800 text-slate-800 bg-white shadow-2xs font-bold' 
                      : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span>Financial Totals</span>
                </button>
              </div>

              {/* Inner Workspace Forms / Document Preview Panel */}
              {viewLayout === 'split' ? (
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 overflow-hidden border-t border-slate-100">
                  <div className="xl:col-span-6 p-6 overflow-y-auto max-h-[680px] border-b xl:border-b-0 xl:border-r border-slate-200">
                    {renderFormContent(activeTab === 'preview' ? 'supplier' : activeTab)}
                  </div>
                  <div className="xl:col-span-6 p-4 bg-slate-900/95 overflow-y-auto max-h-[680px]">
                    <InvoiceDocumentPreview 
                      invoice={selectedInvoice} 
                      duplicateInfo={duplicateAnalysis[selectedInvoice.id]} 
                    />
                  </div>
                </div>
              ) : activeTab === 'preview' ? (
                <div className="p-5 flex-1 overflow-y-auto max-h-[680px] bg-slate-900/95">
                  <InvoiceDocumentPreview 
                    invoice={selectedInvoice} 
                    duplicateInfo={duplicateAnalysis[selectedInvoice.id]} 
                  />
                </div>
              ) : (
                <div className="p-6 flex-1 overflow-y-auto max-h-[680px]">
                  {renderFormContent(activeTab)}
                </div>
              )}
            </div>
          ) : (
            <div id="workspace-fallback" className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <div className="bg-slate-100 p-4 rounded-full border border-slate-200 mb-4 text-slate-400">
                <FileSpreadsheet className="w-12 h-12 stroke-1" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Accounts Payable AP Dashboard</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                No active invoice loaded. Drag-and-drop your hardware supplier invoices on the left panel, or trigger the pre-configured sample database to explore spreadsheet organization.
              </p>

              {/* Little helpful summary box in vacant workspace */}
              <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-lg w-full">
                <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  Excel Workbook Categorization Columns
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Upon uploading an invoice, Gemini automatically extracts and maps metadata into separated worksheets:
                </p>
                <ul className="text-[10px] text-slate-500 mt-2.5 list-disc pl-4 space-y-1">
                  <li><strong>Worksheet 1 (Summaries)</strong>: Tracks supplier data, business registry tax IDs, bank accounts, subtotal, discount, shipping, tax rates, total balance, payment terms, and late charges.</li>
                  <li><strong>Worksheet 2 (Granular Items)</strong>: Detailed descriptions, quantities, unit prices, specific item discounts, tax rate calculations, and final ledger amounts for audits.</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer copyright */}
      <footer id="applet-footer" className="mt-auto bg-slate-900 border-t border-slate-800 text-slate-500 py-4 px-6 text-center text-xs">
        <p>© 2026 Hardware Supplies &amp; AP Desk. Powered by server-side Gemini AI extraction and SheetJS.</p>
      </footer>
    </div>
  );
}
