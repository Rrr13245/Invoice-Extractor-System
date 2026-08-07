import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to initialize GoogleGenAI lazily
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel of the AI Studio UI.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust retry wrapper with exponential backoff and model fallback for Gemini API calls to handle temporary 503, high demand, or rate limit errors
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 3, initialDelayMs = 1200) {
  const primaryModel = options.model || "gemini-2.5-flash";
  const modelsToTry = [primaryModel, "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"].filter((v, i, a) => v && a.indexOf(v) === i);
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Calling Gemini API with model '${modelName}' (Attempt ${attempt}/${maxRetries})...`);
        const currentOptions = { ...options, model: modelName };
        return await ai.models.generateContent(currentOptions);
      } catch (error: any) {
        lastError = error;
        const errorStr = String(error?.message || error);

        const isQuotaExceeded = errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota exceeded") || errorStr.includes("429") || errorStr.includes("rate-limits");
        if (isQuotaExceeded) {
          console.log(`[Gemini API] Quota or rate limit reached on model '${modelName}'. Switching to fallback model...`);
          if (modelsToTry.indexOf(modelName) < modelsToTry.length - 1) {
            await new Promise(r => setTimeout(r, 1500)); // 1.5s delay before fallback to allow RPM rate limit window to refresh
          }
          break; // Move to next fallback model
        }

        const isNotFound = errorStr.includes("404") || errorStr.includes("NOT_FOUND") || errorStr.includes("no longer available");
        if (isNotFound) {
          console.log(`[Gemini API] Model '${modelName}' is unavailable (404). Switching to fallback model...`);
          break; // move to next model in modelsToTry
        }

        const isTransient = 
          errorStr.includes("503") || 
          errorStr.includes("UNAVAILABLE") || 
          errorStr.includes("high demand") ||
          errorStr.includes("temporary") ||
          errorStr.includes("overloaded");

        if (!isTransient) {
          if (modelsToTry.indexOf(modelName) < modelsToTry.length - 1) {
            console.log(`[Gemini API] Non-transient error on model '${modelName}'. Trying fallback model...`);
            await new Promise(r => setTimeout(r, 1000));
            break;
          }
          throw error;
        }

        // If high demand persists on this model after 2 attempts, switch to fallback model
        if (attempt >= 2 && modelsToTry.indexOf(modelName) < modelsToTry.length - 1) {
          console.log(`[Gemini API] Model '${modelName}' busy. Switching to fallback model...`);
          break;
        }

        if (attempt === maxRetries && modelsToTry.indexOf(modelName) === modelsToTry.length - 1) {
          throw error;
        }

        const delay = initialDelayMs * Math.pow(1.8, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.log(`[Gemini API] Transient issue detected on '${modelName}'. Retrying in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Extract endpoint
app.post("/api/extract", async (req, res) => {
  try {
    const { fileName, fileType, base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: "Missing file data." });
    }

    const ai = getAiClient();

    // Prepare content part
    const filePart = {
      inlineData: {
        mimeType: fileType,
        data: base64Data,
      },
    };

    const promptPart = {
      text: `You are an expert accounts payable assistant for a hardware company. Analyze the uploaded invoice document (Source File Name: "${fileName}") and extract all relevant information exactly as structured in the response schema.

CRITICAL INSTRUCTIONS FOR ACCURACY & TRUTHFUL EXTRACTION:
1. Examine headers, footers, tables, fine print, and all pages for printed/written information.
2. Invoice Number: Extract the invoice number printed strictly inside the document text. If the printed invoice number is unreadable, ambiguous, or missing, leave \`invoiceNumber\` as an empty string "". Do NOT put a filename-derived code into \`invoiceNumber\`.
3. Suggested Invoice Number: If the filename "${fileName}" contains a clear invoice code pattern (e.g. "WSIS-2026-205" or "INV-9982"), return it separately in \`suggestedInvoiceNumber\`. Do NOT set \`invoiceNumber\` to it unless confirmed in document text.
4. Currency: Extract the currency code or symbol (e.g., SGD, USD, EUR, GBP, AUD, $, S$, €). If currency is not explicitly found, leave \`currency\` as an empty string "".
5. Payment Terms: Pay extra special attention to fine print, footers, headers, margin notes, and sections labeled 'Terms & Conditions', 'Terms of Payment', 'Terms of Sale', 'Notes', or 'Remittance Instructions'. Extract terms (e.g., 'Net 30', 'Net 15', 'Due on Receipt', '2% 10 Net 30', 'COD') into \`paymentTerms\` and late fees into \`latePaymentTerms\`. If not explicitly stated in document, leave as "".
6. AI Review Notes: Provide structured plain-language review notes in \`aiReviewNotes\` detailing what was found printed on the document vs calculated vs suggested vs missing.
7. Raw Document Text: Extract a readable text transcript of all visible text and details across the document into \`rawDocumentText\` for internal duplicate analysis.

If a field is not found anywhere in the invoice, leave it as an empty string (for strings) or 0 (for numbers). Make sure to extract all line items accurately. Ensure that sums are mathematically consistent.`
    };

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: { parts: [filePart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "The printed invoice number or invoice ID reference from inside the document text." },
            suggestedInvoiceNumber: { type: Type.STRING, description: "Possible invoice number suggested from filename if document text is unclear." },
            invoiceDate: { type: Type.STRING, description: "The date when the invoice was issued (usually YYYY-MM-DD or as written)." },
            paymentDueDate: { type: Type.STRING, description: "The deadline for payment (usually YYYY-MM-DD or as written)." },
            currency: { type: Type.STRING, description: "The currency code or symbol used (e.g., SGD, USD, EUR, GBP, $, S$, €). Empty string if unclear." },
            purchaseOrder: { type: Type.STRING, description: "The purchase order (PO) number if mentioned, otherwise empty." },
            grnReference: { type: Type.STRING, description: "The Goods Receipt Note (GRN) or Delivery Order (DO) reference if mentioned on document, otherwise empty." },
            supplierName: { type: Type.STRING, description: "The company or individual name of the supplier/sender as printed on document." },
            supplierAddress: { type: Type.STRING, description: "The full address of the supplier." },
            supplierContact: { type: Type.STRING, description: "Contact details of the supplier (phone, email, website, etc.)." },
            businessRegistrationOrTaxId: { type: Type.STRING, description: "The supplier's business registration number, VAT number, tax ID, or equivalent." },
            bankDetails: { type: Type.STRING, description: "Combined bank details (bank name, branch, SWIFT/BIC code, routing code, etc.) if provided." },
            bankAccount: { type: Type.STRING, description: "The specific bank account number, IBAN, or payment address if provided." },
            invoiceSubtotal: { type: Type.NUMBER, description: "The total amount of all items before taxes or discounts are applied." },
            totalDiscount: { type: Type.NUMBER, description: "The total discount amount applied to the invoice, if available (otherwise 0)." },
            totalTax: { type: Type.NUMBER, description: "The total tax amount applied to the invoice (otherwise 0)." },
            deliveryCharges: { type: Type.NUMBER, description: "Delivery, shipping, freight, or other additional service fees (otherwise 0)." },
            finalAmountPayable: { type: Type.NUMBER, description: "The final total outstanding amount that must be paid." },
            amountAlreadyPaid: { type: Type.NUMBER, description: "Any amount already paid or credited, if stated (otherwise 0)." },
            outstandingBalance: { type: Type.NUMBER, description: "The remaining unpaid balance if explicitly stated, or final amount minus amount already paid." },
            paymentTerms: { type: Type.STRING, description: "Payment terms stated in fine print, footers, or Terms & Conditions blocks." },
            acceptedPaymentMethod: { type: Type.STRING, description: "Accepted payment methods (e.g., Bank Transfer, Credit Card, PayPal, Check)." },
            latePaymentTerms: { type: Type.STRING, description: "Any fees, interest rates, or penalty terms regarding late/overdue payments." },
            rawDocumentText: { type: Type.STRING, description: "Full readable document text transcript or summary from the invoice for document comparison." },
            aiReviewNotes: {
              type: Type.ARRAY,
              description: "Audit review notes detailing extraction findings.",
              items: {
                type: Type.OBJECT,
                properties: {
                  field: { type: Type.STRING },
                  sourceType: { type: Type.STRING, description: "printed | calculated | suggested | not_found" },
                  message: { type: Type.STRING },
                  requiresConfirmation: { type: Type.BOOLEAN }
                },
                required: ["message"]
              }
            },
            lineItems: {
              type: Type.ARRAY,
              description: "A list of individual line items or products/services in the invoice.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Description of the product or service provided." },
                  quantity: { type: Type.NUMBER, description: "The quantity of items/hours." },
                  unitPrice: { type: Type.NUMBER, description: "The price per individual unit or hour." },
                  discount: { type: Type.NUMBER, description: "The discount amount or percentage applied specifically to this item (0 if none)." },
                  taxRate: { type: Type.NUMBER, description: "The tax rate percentage applied to this item, e.g. 15 for 15% (0 if none)." },
                  taxAmount: { type: Type.NUMBER, description: "The calculated tax amount for this specific item (0 if none)." },
                  totalAmount: { type: Type.NUMBER, description: "The total price for this item." }
                },
                required: ["description", "quantity", "unitPrice", "discount", "taxRate", "taxAmount", "totalAmount"]
              }
            }
          },
          required: [
            "invoiceNumber", "invoiceDate", "paymentDueDate", "currency", "purchaseOrder",
            "supplierName", "supplierAddress", "supplierContact", "businessRegistrationOrTaxId",
            "bankDetails", "bankAccount", "invoiceSubtotal", "totalDiscount", "totalTax",
            "deliveryCharges", "finalAmountPayable", "amountAlreadyPaid", "outstandingBalance",
            "paymentTerms", "acceptedPaymentMethod", "latePaymentTerms", "lineItems"
          ]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No readable text response received from Gemini.");
    }

    const extractedData = JSON.parse(text.trim());

    res.json(extractedData);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota exceeded") || errorMsg.includes("rate-limits")) {
      console.warn("Extraction API rate limited (429):", errorMsg);
      return res.status(429).json({ 
        error: "Gemini AI rate limit or daily quota reached (429). Please wait a moment and try again, or click '+ Manual Invoice' to enter details directly." 
      });
    }
    console.error("Extraction error:", error);
    if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("high demand") || errorMsg.includes("overloaded")) {
      return res.status(503).json({ 
        error: "The Gemini AI service is currently under temporary high load. Please wait a moment and click 'Retry Extraction' or upload the invoice again." 
      });
    }
    res.status(500).json({ error: errorMsg || "An error occurred during invoice extraction." });
  }
});

async function startServer() {
  // Serve frontend assets in production / dev server hookup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
