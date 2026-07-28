import { InvoiceData } from '../types';

/**
 * Generates an authentic, high-fidelity SVG data URL representing a physical 
 * printed/scanned hardware supplier invoice paper document.
 */
export function generateInvoiceDocumentSvg(invoice: InvoiceData): string {
  const supplierName = invoice.supplierName || 'Hardware Supplier Corp';
  const supplierAddress = invoice.supplierAddress || '100 Industrial Way, Suite A';
  const supplierContact = invoice.supplierContact || 'sales@supplier.com | (555) 019-2831';
  const taxId = invoice.businessRegistrationOrTaxId || 'TAX-ID-99201';
  const invNum = invoice.invoiceNumber || 'INV-000000';
  const invDate = invoice.invoiceDate || '2026-07-01';
  const dueDate = invoice.paymentDueDate || 'Net 30';
  const poNum = invoice.purchaseOrder || 'PO-NONE';
  const currency = invoice.currency || 'USD';

  const subtotal = (invoice.invoiceSubtotal || 0).toFixed(2);
  const discount = (invoice.totalDiscount || 0).toFixed(2);
  const tax = (invoice.totalTax || 0).toFixed(2);
  const delivery = (invoice.deliveryCharges || 0).toFixed(2);
  const finalTotal = (invoice.finalAmountPayable || 0).toFixed(2);
  const paid = (invoice.amountAlreadyPaid || 0).toFixed(2);
  const balance = (invoice.outstandingBalance || 0).toFixed(2);

  // Theme accent based on supplier name
  let brandColor = '#0f172a'; // dark slate default
  let accentColor = '#059669'; // emerald default
  if (supplierName.toLowerCase().includes('titan')) {
    brandColor = '#1e293b';
    accentColor = '#2563eb';
  } else if (supplierName.toLowerCase().includes('pine') || supplierName.toLowerCase().includes('timber') || supplierName.toLowerCase().includes('lumber')) {
    brandColor = '#14532d';
    accentColor = '#15803d';
  } else if (supplierName.toLowerCase().includes('paint')) {
    brandColor = '#312e81';
    accentColor = '#4f46e5';
  }

  // Generate line item rows SVG
  const lineItemsSvg = (invoice.lineItems || []).map((item, idx) => {
    const y = 370 + idx * 28;
    const desc = item.description.length > 45 ? item.description.substring(0, 42) + '...' : item.description;
    const bgFill = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `
      <rect x="40" y="${y - 18}" width="720" height="26" fill="${bgFill}" rx="2"/>
      <text x="50" y="${y}" font-family="monospace" font-size="11" fill="#64748b">${idx + 1}</text>
      <text x="80" y="${y}" font-family="sans-serif" font-size="11" font-weight="500" fill="#1e293b">${escapeXml(desc)}</text>
      <text x="440" y="${y}" font-family="monospace" font-size="11" fill="#334155" text-anchor="end">${item.quantity}</text>
      <text x="530" y="${y}" font-family="monospace" font-size="11" fill="#334155" text-anchor="end">$${item.unitPrice.toFixed(2)}</text>
      <text x="620" y="${y}" font-family="monospace" font-size="11" fill="#334155" text-anchor="end">${item.taxRate}%</text>
      <text x="740" y="${y}" font-family="monospace" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="end">$${item.totalAmount.toFixed(2)}</text>
    `;
  }).join('');

  const tableHeight = Math.max(120, (invoice.lineItems || []).length * 28 + 30);
  const totalsY = 370 + tableHeight + 20;

  // Barcode pattern SVG
  const barcodeLines = Array.from({ length: 42 }).map((_, i) => {
    const x = 50 + i * 4;
    const width = (i % 3 === 0 || i % 7 === 0) ? 2.5 : 1;
    return `<rect x="${x}" y="${totalsY + 160}" width="${width}" height="32" fill="#1e293b"/>`;
  }).join('');

  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <style>
      .hdr-title { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; font-size: 20px; fill: ${brandColor}; }
      .sub-hdr { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; fill: #64748b; }
      .label-sm { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 10px; fill: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
      .val-mono { font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: 12px; fill: #0f172a; }
      .val-bold { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 12px; fill: #0f172a; }
      .tbl-hdr { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 10px; fill: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; }
    </style>
  </defs>

  <!-- Paper Sheet Background -->
  <rect x="0" y="0" width="800" height="1050" fill="#fcfcfd"/>
  <rect x="15" y="15" width="770" height="1020" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" rx="4"/>
  
  <!-- Subtle Top Decorative Header Bar -->
  <rect x="15" y="15" width="770" height="12" fill="${brandColor}"/>

  <!-- Company Logo Icon + Letterhead -->
  <g transform="translate(40, 45)">
    <rect x="0" y="0" width="44" height="44" fill="${brandColor}" rx="8"/>
    <text x="22" y="28" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle">${escapeXml(supplierName.charAt(0))}</text>
    
    <text x="56" y="20" class="hdr-title">${escapeXml(supplierName)}</text>
    <text x="56" y="36" class="sub-hdr">${escapeXml(supplierAddress)}</text>
    <text x="56" y="49" class="sub-hdr">Contact: ${escapeXml(supplierContact)} | Tax ID: ${escapeXml(taxId)}</text>
  </g>

  <!-- Document Type Badge & Invoice Number -->
  <g transform="translate(540, 45)">
    <rect x="0" y="0" width="220" height="85" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="6"/>
    <text x="110" y="22" font-family="sans-serif" font-weight="800" font-size="12" fill="${accentColor}" text-anchor="middle" letter-spacing="1">ORIGINAL TAX INVOICE</text>
    <text x="110" y="42" font-family="monospace" font-weight="900" font-size="16" fill="#0f172a" text-anchor="middle">#${escapeXml(invNum)}</text>
    <line x1="20" y1="50" x2="200" y2="50" stroke="#cbd5e1" stroke-width="0.5"/>
    <text x="110" y="66" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">STATUS: ACCOUNTS PAYABLE LEDGER</text>
  </g>

  <!-- Divider line -->
  <line x1="40" y1="145" x2="760" y2="145" stroke="#e2e8f0" stroke-width="1"/>

  <!-- Invoice Meta Details Grid -->
  <g transform="translate(40, 160)">
    <!-- Billed To Box -->
    <rect x="0" y="0" width="350" height="130" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
    <rect x="0" y="0" width="350" height="24" fill="#e2e8f0" rx="6"/>
    <text x="12" y="16" class="label-sm">BILLED TO (CUSTOMER ACCOUNT)</text>
    <text x="12" y="44" class="val-bold">Hardware Company Operations LLC</text>
    <text x="12" y="60" class="sub-hdr">Accounts Payable Desk (Building B)</text>
    <text x="12" y="75" class="sub-hdr">100 Commercial Blvd, Cleveland, OH 44114</text>
    <text x="12" y="95" font-family="monospace" font-size="10" fill="#475569">PO Ref #: ${escapeXml(poNum)}</text>
    <text x="12" y="112" font-family="monospace" font-size="10" fill="#475569">Currency: ${escapeXml(currency)}</text>

    <!-- Invoice Dates & Payment Terms Box -->
    <rect x="370" y="0" width="350" height="130" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
    <rect x="370" y="0" width="350" height="24" fill="#e2e8f0" rx="6"/>
    <text x="382" y="16" class="label-sm">INVOICE DATES &amp; TERMS</text>
    
    <text x="382" y="44" class="sub-hdr">Invoice Issue Date:</text>
    <text x="520" y="44" class="val-mono">${escapeXml(invDate)}</text>
    
    <text x="382" y="64" class="sub-hdr">Payment Due Date:</text>
    <text x="520" y="64" class="val-mono" fill="#b91c1c">${escapeXml(dueDate)}</text>
    
    <text x="382" y="84" class="sub-hdr">Payment Terms:</text>
    <text x="520" y="84" class="val-mono">${escapeXml(invoice.paymentTerms || 'Net 30')}</text>

    <text x="382" y="104" class="sub-hdr">Method Accepted:</text>
    <text x="520" y="104" class="sub-hdr">${escapeXml(invoice.acceptedPaymentMethod || 'ACH / Check')}</text>
  </g>

  <!-- Line Items Table Header -->
  <g transform="translate(40, 310)">
    <rect x="0" y="0" width="720" height="28" fill="${brandColor}" rx="4"/>
    <text x="10" y="18" class="tbl-hdr">#</text>
    <text x="40" y="18" class="tbl-hdr">ITEM DESCRIPTION &amp; HARDWARE SKU</text>
    <text x="400" y="18" class="tbl-hdr" text-anchor="end">QTY</text>
    <text x="490" y="18" class="tbl-hdr" text-anchor="end">UNIT PRICE</text>
    <text x="580" y="18" class="tbl-hdr" text-anchor="end">TAX %</text>
    <text x="700" y="18" class="tbl-hdr" text-anchor="end">LINE TOTAL</text>
  </g>

  <!-- Line Items Rows -->
  <g>
    ${lineItemsSvg}
  </g>

  <!-- Financial Totals Summary Box -->
  <g transform="translate(40, ${totalsY})">
    <!-- Remittance Box -->
    <rect x="0" y="0" width="380" height="150" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
    <text x="15" y="22" class="label-sm">REMITTANCE &amp; BANK PAYMENT INSTRUCTIONS</text>
    <text x="15" y="42" class="sub-hdr">Bank Name: ${escapeXml(invoice.bankDetails || 'First National Bank')}</text>
    <text x="15" y="58" class="sub-hdr">Account / IBAN: ${escapeXml(invoice.bankAccount || 'US10-2030-4050')}</text>
    <text x="15" y="74" class="sub-hdr">Late Penalties: ${escapeXml(invoice.latePaymentTerms || '1.5% monthly late fee applies after due date')}</text>
    
    <!-- Signature Line -->
    <line x1="15" y1="120" x2="200" y2="120" stroke="#94a3b8" stroke-dasharray="3,3"/>
    <text x="15" y="134" font-family="sans-serif" font-size="9" fill="#64748b">AUTHORIZED ACCOUNTS SIGNATURE</text>

    <!-- Totals Breakdown Table -->
    <rect x="400" y="0" width="320" height="175" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" rx="6"/>
    
    <text x="415" y="25" class="sub-hdr">Subtotal:</text>
    <text x="705" y="25" class="val-mono" text-anchor="end">$${subtotal}</text>
    
    <text x="415" y="45" class="sub-hdr">Discounts Deducted:</text>
    <text x="705" y="45" class="val-mono" fill="#047857" text-anchor="end">-$${discount}</text>
    
    <text x="415" y="65" class="sub-hdr">Sales Tax Amount:</text>
    <text x="705" y="65" class="val-mono" text-anchor="end">+$${tax}</text>
    
    <text x="415" y="85" class="sub-hdr">Freight &amp; Delivery:</text>
    <text x="705" y="85" class="val-mono" text-anchor="end">+$${delivery}</text>
    
    <line x1="410" y1="98" x2="710" y2="98" stroke="#cbd5e1" stroke-width="1"/>

    <rect x="405" y="105" width="310" height="30" fill="${brandColor}" rx="4"/>
    <text x="415" y="125" font-family="sans-serif" font-weight="800" font-size="11" fill="#ffffff">TOTAL AMOUNT PAYABLE:</text>
    <text x="705" y="125" font-family="monospace" font-weight="900" font-size="14" fill="#34d399" text-anchor="end">$${finalTotal}</text>

    <text x="415" y="152" class="sub-hdr">Amount Paid To Date:</text>
    <text x="705" y="152" class="val-mono" text-anchor="end">$${paid}</text>

    <text x="415" y="168" font-family="sans-serif" font-weight="700" font-size="10" fill="#b91c1c">OUTSTANDING BALANCE:</text>
    <text x="705" y="168" font-family="monospace" font-weight="800" font-size="11" fill="#b91c1c" text-anchor="end">$${balance}</text>
  </g>

  <!-- Official Hardware Store Stamp Overlay -->
  <g transform="translate(560, ${totalsY + 195}) rotate(-8)">
    <rect x="0" y="0" width="180" height="40" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-dasharray="6,2" rx="4"/>
    <text x="90" y="24" font-family="sans-serif" font-weight="900" font-size="12" fill="${accentColor}" text-anchor="middle" letter-spacing="1">ORIGINAL INVOICE</text>
  </g>

  <!-- Footer Barcode & Page Tag -->
  <g transform="translate(40, ${totalsY + 180})">
    ${barcodeLines}
    <text x="50" y="200" font-family="monospace" font-size="9" fill="#64748b">DOC-HASH-${escapeXml(invNum)}-AP-VERIFIED</text>
    <text x="720" y="200" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="end">PAGE 1 OF 1 • OFFICIAL ACCOUNTS PAYABLE RECORD</text>
  </g>
</svg>
  `.trim();

  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
