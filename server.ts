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
      text: "You are an expert accounts payable assistant for a hardware company. Analyze the uploaded invoice document and extract all relevant information exactly as structured in the response schema.\n\n" +
            "CRITICAL INSTRUCTION FOR PAYMENT TERMS & CONDITIONS:\n" +
            "1. Pay extra special attention to fine print, footers, headers, margin notes, and sections labeled 'Terms & Conditions', 'Terms of Payment', 'Terms of Sale', 'Notes', or 'Remittance Instructions'.\n" +
            "2. Suppliers very commonly embed payment terms (such as 'Net 30', 'Net 15', 'Net 60', 'Due on Receipt', '2% 10 Net 30', 'Payment due within 30 days', 'COD', or '100% in Advance') and late payment fees/interest (e.g. '1.5% interest per month on overdue balances') inside paragraph text or fine print at the bottom of the page.\n" +
            "3. You MUST thoroughly parse and extract these into `paymentTerms` and `latePaymentTerms` even if they appear in narrative fine print rather than a top-level labeled form field.\n\n" +
            "If a field is not found anywhere in the invoice, leave it as an empty string (for strings) or 0 (for numbers). Make sure to extract all line items accurately. Ensure that sums are mathematically consistent. " +
            "For bankDetails, combine any available bank name, branch, SWIFT/BIC, or payment instructions. For bankAccount, extract the specific account number or IBAN."
    };

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: { parts: [filePart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "The invoice number or invoice ID reference." },
            invoiceDate: { type: Type.STRING, description: "The date when the invoice was issued (usually YYYY-MM-DD or as written)." },
            paymentDueDate: { type: Type.STRING, description: "The deadline for payment (usually YYYY-MM-DD or as written)." },
            currency: { type: Type.STRING, description: "The currency code or symbol used (e.g., USD, EUR, GBP, CAD, AUD, $, €, £)." },
            purchaseOrder: { type: Type.STRING, description: "The purchase order (PO) number if mentioned, otherwise empty." },
            supplierName: { type: Type.STRING, description: "The company or individual name of the supplier/sender." },
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
            outstandingBalance: { type: Type.NUMBER, description: "The remaining unpaid balance if explicitly stated, or the final amount minus amount already paid." },
            paymentTerms: { type: Type.STRING, description: "Payment terms and credit terms (e.g., Net 30, Due on Receipt, Net 15, Net 60, 2/10 Net 30, Payment due within 30 days). Thoroughly scan fine print, footers, and Terms & Conditions blocks." },
            acceptedPaymentMethod: { type: Type.STRING, description: "Accepted payment methods (e.g., Bank Transfer, Credit Card, PayPal, Check)." },
            latePaymentTerms: { type: Type.STRING, description: "Any fees, interest rates, or penalty terms regarding late/overdue payments if stated in the fine print or Terms & Conditions (e.g., '1.5% late fee per month')." },
            lineItems: {
              type: Type.ARRAY,
              description: "A list of individual line items or products/services in the invoice.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Description of the product or service provided." },
                  quantity: { type: Type.NUMBER, description: "The quantity of items/hours (default to 1 if not specified)." },
                  unitPrice: { type: Type.NUMBER, description: "The price per individual unit or hour." },
                  discount: { type: Type.NUMBER, description: "The discount amount or percentage applied specifically to this item (0 if none)." },
                  taxRate: { type: Type.NUMBER, description: "The tax rate percentage applied to this item, e.g. 15 for 15% (0 if none)." },
                  taxAmount: { type: Type.NUMBER, description: "The calculated tax amount for this specific item (0 if none)." },
                  totalAmount: { type: Type.NUMBER, description: "The total price for this item (usually quantity * unitPrice - discount + tax)." }
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

    // Smart fallback inference for paymentTerms if empty or unpopulated
    if (!extractedData.paymentTerms || extractedData.paymentTerms.trim() === '') {
      const late = extractedData.latePaymentTerms || '';
      const termMatches = late.match(/\b(Net\s*\d+|Due\s*(?:on|upon)\s*Receipt|COD|Cash\s*on\s*Delivery|\d+\/\d+\s*Net\s*\d+)\b/i);
      if (termMatches) {
        extractedData.paymentTerms = termMatches[0];
      } else if (extractedData.invoiceDate && extractedData.paymentDueDate) {
        try {
          const d1 = new Date(extractedData.invoiceDate);
          const d2 = new Date(extractedData.paymentDueDate);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              extractedData.paymentTerms = "Due on Receipt";
            } else if (diffDays >= 14 && diffDays <= 16) {
              extractedData.paymentTerms = "Net 15";
            } else if (diffDays >= 28 && diffDays <= 32) {
              extractedData.paymentTerms = "Net 30";
            } else if (diffDays >= 58 && diffDays <= 62) {
              extractedData.paymentTerms = "Net 60";
            } else if (diffDays >= 88 && diffDays <= 92) {
              extractedData.paymentTerms = "Net 90";
            } else if (diffDays > 1) {
              extractedData.paymentTerms = `Net ${diffDays}`;
            }
          }
        } catch (e) {
          // Ignore date parse errors
        }
      }
    }

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
