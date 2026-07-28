import React, { useState } from 'react';
import { 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Printer, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  FileCode,
  Sparkles,
  Download
} from 'lucide-react';
import { InvoiceData } from '../types';
import { getInvoiceMissingFields } from '../utils/validation';
import { generateInvoiceDocumentSvg } from '../utils/documentSvgGenerator';

interface InvoiceDocumentPreviewProps {
  invoice: InvoiceData;
  duplicateInfo?: { isDuplicate: boolean; reason?: string };
  onClose?: () => void;
}

export const InvoiceDocumentPreview: React.FC<InvoiceDocumentPreviewProps> = ({
  invoice,
  duplicateInfo,
  onClose
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('raw');

  const missingFields = invoice.status === 'success' ? getInvoiceMissingFields(invoice) : [];
  const isDuplicate = duplicateInfo?.isDuplicate;

  const getEffectiveFileDataUrl = (inv: InvoiceData) => {
    if (inv.fileDataUrl && inv.fileDataUrl.trim() !== '') {
      if (inv.fileDataUrl.startsWith('data:')) {
        return inv.fileDataUrl;
      }
      const mime = inv.fileType || 'image/png';
      return `data:${mime};base64,${inv.fileDataUrl}`;
    }
    return generateInvoiceDocumentSvg(inv);
  };

  const effectiveFileDataUrl = getEffectiveFileDataUrl(invoice);
  const fallbackDocumentSvg = generateInvoiceDocumentSvg(invoice);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 15, 70));
  const handleResetZoom = () => setZoomLevel(100);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
      {/* Document Viewer Toolbar */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-slate-200 truncate max-w-[200px]" title={invoice.fileName}>
            {invoice.fileName}
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded border border-slate-700">
            {invoice.fileType.split('/')[1]?.toUpperCase() || invoice.fileType || 'PDF'}
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 rounded-md font-semibold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'raw' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-300" />
            <span>Original Document</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('rendered')}
            className={`px-3 py-1 rounded-md font-semibold text-[11px] transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'rendered' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Digital Sheet</span>
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 px-1 py-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-300 px-2 min-w-[40px] text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition border-l border-slate-800 ml-0.5 cursor-pointer"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition flex items-center gap-1 text-[11px] cursor-pointer"
            title="Print Preview Document"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition ml-1 cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Warning Bar inside document viewer if duplicate or missing fields */}
      {(isDuplicate || missingFields.length > 0) && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 flex items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2 text-amber-200 font-semibold truncate">
            {isDuplicate ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate">
              {isDuplicate && `Flagged: Duplicate document (${duplicateInfo?.reason || 'Identical record'})`}
              {isDuplicate && missingFields.length > 0 && ' | '}
              {missingFields.length > 0 && `Missing required info: ${missingFields.join(', ')}`}
            </span>
          </div>
          <span className="text-[10px] bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded border border-amber-700/60 font-bold shrink-0">
            Attention Needed
          </span>
        </div>
      )}

      {/* Main Preview Container Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900/90 flex justify-center items-start min-h-[450px]">
        {viewMode === 'raw' ? (
          <div 
            className="transition-transform duration-200 origin-top bg-white rounded shadow-2xl overflow-hidden max-w-full"
            style={{ transform: `scale(${zoomLevel / 100})`, width: '100%', minHeight: '600px' }}
          >
            {effectiveFileDataUrl.startsWith('data:application/pdf') ? (
              <object
                data={effectiveFileDataUrl}
                type="application/pdf"
                className="w-full h-[750px]"
              >
                <div className="p-4 text-center bg-white">
                  <p className="text-xs text-slate-500 font-semibold mb-2">
                    PDF Browser Plugin Fallback Preview:
                  </p>
                  <img 
                    src={fallbackDocumentSvg} 
                    alt={`Original Document - ${invoice.fileName}`}
                    className="w-full h-auto object-contain mx-auto max-h-[700px] bg-white mb-4 border border-slate-200 rounded"
                  />
                  <a 
                    href={effectiveFileDataUrl} 
                    download={invoice.fileName}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Original PDF File ({invoice.fileName})
                  </a>
                </div>
              </object>
            ) : (
              <img 
                src={effectiveFileDataUrl} 
                alt={`Original Document - ${invoice.fileName}`}
                className="w-full h-auto object-contain mx-auto max-h-[850px] bg-white shadow-sm"
              />
            )}
          </div>
        ) : (
          /* Rendered Digital Invoice Sheet */
          <div 
            className="transition-transform duration-200 origin-top bg-white text-slate-800 p-8 sm:p-10 rounded-lg shadow-2xl max-w-[780px] w-full border border-slate-200 font-sans text-xs relative select-text"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          >
            {/* Watermark / Status Stamp */}
            {isDuplicate && (
              <div className="absolute top-10 right-10 rotate-[-12deg] border-4 border-red-600 text-red-600 font-extrabold text-lg px-4 py-1.5 rounded uppercase tracking-widest opacity-80 select-none pointer-events-none">
                DUPLICATE FLAGGED
              </div>
            )}
            {!isDuplicate && invoice.outstandingBalance === 0 && invoice.finalAmountPayable > 0 && (
              <div className="absolute top-10 right-10 rotate-[-12deg] border-4 border-emerald-600 text-emerald-600 font-extrabold text-lg px-4 py-1.5 rounded uppercase tracking-widest opacity-80 select-none pointer-events-none">
                PAID IN FULL
              </div>
            )}

            {/* Document Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center tracking-tight shadow-sm">
                    {invoice.supplierName ? invoice.supplierName.charAt(0) : 'H'}
                  </div>
                  <h1 className="font-extrabold text-slate-900 text-base tracking-tight">
                    {invoice.supplierName || 'Supplier Hardware Vendor'}
                  </h1>
                </div>
                <p className="text-slate-500 text-[11px] max-w-[280px] leading-relaxed">
                  {invoice.supplierAddress || 'Address not specified'}
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  Contact: {invoice.supplierContact || 'N/A'}
                </p>
                {invoice.businessRegistrationOrTaxId && (
                  <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                    Tax / Tax ID: {invoice.businessRegistrationOrTaxId}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax Invoice / Bill</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  #{invoice.invoiceNumber || 'UNASSIGNED'}
                </div>
                
                <div className="mt-3 space-y-1 text-[11px]">
                  <div className="flex sm:justify-end gap-2 text-slate-600">
                    <span className="text-slate-400">Invoice Date:</span>
                    <span className="font-semibold text-slate-800 font-mono">{invoice.invoiceDate || 'Missing'}</span>
                  </div>
                  <div className="flex sm:justify-end gap-2 text-slate-600">
                    <span className="text-slate-400">Payment Due:</span>
                    <span className={`font-semibold font-mono ${!invoice.paymentDueDate ? 'text-amber-600 bg-amber-50 px-1 rounded' : 'text-slate-800'}`}>
                      {invoice.paymentDueDate || 'MISSING'}
                    </span>
                  </div>
                  {invoice.purchaseOrder && (
                    <div className="flex sm:justify-end gap-2 text-slate-600">
                      <span className="text-slate-400">PO Ref #:</span>
                      <span className="font-semibold text-slate-800 font-mono">{invoice.purchaseOrder}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Customer / Billed To Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To (Customer):</h3>
                <p className="font-bold text-slate-800">Accounts Payable Dept.</p>
                <p className="text-slate-600 text-[11px] mt-0.5">Hardware Company Operations LLC</p>
                <p className="text-slate-500 text-[11px]">100 Commercial Blvd, Building B</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment &amp; Terms:</h3>
                <p className="text-slate-700 font-semibold">
                  Terms: <span className={!invoice.paymentTerms ? 'text-amber-600 bg-amber-100 px-1 rounded font-bold' : 'font-mono'}>{invoice.paymentTerms || 'NOT SPECIFIED'}</span>
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Method: {invoice.acceptedPaymentMethod || 'Check / ACH'}
                </p>
                {invoice.latePaymentTerms && (
                  <p className="text-[10px] text-slate-400 italic mt-1">
                    Note: {invoice.latePaymentTerms}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                    <th className="py-2 px-1">#</th>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-2 text-right">Discount</th>
                    <th className="py-2 px-2 text-right">Tax</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.lineItems && invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-1 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                        <td className="py-2.5 px-2 font-medium text-slate-800 max-w-[220px]">
                          {item.description || 'Unnamed Hardware Item'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700">{item.quantity}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700">${item.unitPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {item.discount > 0 ? `-$${item.discount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {item.taxAmount > 0 ? `$${item.taxAmount.toFixed(2)}` : '0.00'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">${item.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                        No individual line items parsed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-slate-200 pt-4 mb-6">
              <div className="flex-1 text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Remittance &amp; Banking Details</p>
                <p><span className="text-slate-400">Bank Name:</span> {invoice.bankDetails || 'N/A'}</p>
                <p><span className="text-slate-400">Account / IBAN:</span> <span className="font-mono text-slate-700">{invoice.bankAccount || 'N/A'}</span></p>
              </div>

              <div className="w-full sm:w-64 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">${invoice.invoiceSubtotal.toFixed(2)}</span>
                </div>
                {invoice.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono font-semibold">-${invoice.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.totalTax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax:</span>
                    <span className="font-mono font-semibold">${invoice.totalTax.toFixed(2)}</span>
                  </div>
                )}
                {invoice.deliveryCharges > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping / Freight:</span>
                    <span className="font-mono font-semibold">${invoice.deliveryCharges.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-300 pt-2">
                  <span>Total Amount Due:</span>
                  <span className="font-mono">${invoice.finalAmountPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-mono">${invoice.amountAlreadyPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono">${invoice.outstandingBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Document Footer Audit Tag */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2">
              <div className="flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                <span>Digitized &amp; Verified by AP Hardware Automation System</span>
              </div>
              <div className="font-mono text-slate-300">
                DOC-REF-ID: {invoice.id}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
