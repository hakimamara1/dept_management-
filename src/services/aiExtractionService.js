// services/aiExtractionService.js
const Replicate = require('replicate');

const MODEL = 'google/gemini-3.1-pro';

// Verbatim extraction prompt — the output schema here matches
// invoiceProcessor.processOcrResult()'s expected input field-for-field
// (invoice_number, invoice_date, invoice_time, supplier.name,
// previous_balance, invoice_amount, discount, tax, new_balance,
// payment_method, notes, items[].{line_number,product_name,package,unit,
// quantity,unit_price,discount,tax,total_price}), so the parsed result is
// handed to processOcrResult() completely unmodified. Extra fields it
// doesn't read yet (customer, per-item barcode/category) are just ignored.
const EXTRACTION_PROMPT = `You are an enterprise invoice extraction engine. Your task is to analyze the attached invoice image and extract all available information into a JSON object.
# Rules
You MUST follow these rules exactly.
1. Return ONLY valid JSON.
2. Do NOT wrap the JSON inside Markdown.
3. Do NOT explain your answer.
4. Do NOT include any extra text.
5. Do NOT hallucinate.
6. Never invent missing values.
7. If a value is missing, use null.
8. Preserve Arabic text exactly as written.
9. Preserve product names exactly as written.
10. Preserve all numbers exactly as written.
11. Preserve decimal values.
12. Preserve the order of products exactly as they appear on the invoice.
13. Every invoice row must become one object inside "items".
14. Never merge rows.
15. Never split rows.
16. Never calculate missing values.
17. Never translate text.
18. Return empty arrays instead of removing properties.
19. Every property in the schema must exist.
20. The output MUST match the following JSON schema exactly.

############################
JSON SCHEMA
############################

{
  "invoice_number": "",
  "invoice_date": "",
  "invoice_time": null,
  "supplier": {
    "name": "",
    "phone": null,
    "email": null,
    "address": null,
    "tax_number": null,
    "commercial_register": null
  },
  "customer": {
    "name": null,
    "phone": null,
    "address": null,
    "tax_number": null
  },
  "currency": null,
  "previous_balance": null,
  "invoice_amount": null,
  "discount": null,
  "tax": null,
  "new_balance": null,
  "payment_method": null,
  "notes": null,
  "items": [
    {
      "line_number": 1,
      "product_name": "",
      "package": null,
      "barcode": null,
      "category": null,
      "unit": null,
      "quantity": 0,
      "unit_price": 0,
      "discount": null,
      "tax": null,
      "total_price": 0,
      "notes": null
    }
  ]
}

############################
Extraction Rules
############################

Invoice Number: Read the official invoice number.
Invoice Date: Extract exactly as written.
Invoice Time: Extract if present.
Supplier: Extract every available supplier field.
Customer: Extract every available customer field.
Currency: Extract exactly as written.
Previous Balance: The customer's balance before this invoice.
Invoice Amount: The value of this invoice only.
New Balance: Customer balance after this invoice.

Items:
For every product row extract:
- line_number
- product_name
- package
- barcode
- category
- unit
- quantity
- unit_price
- discount
- tax
- total_price
- notes

Packaging examples:
12x2
20x4
5+(25x1)
must be stored inside package
Do NOT move them into quantity.

############################
Validation Rules
############################

If there are 22 product rows, the JSON must contain exactly 22 objects.
Do not skip rows.
Do not reorder rows.
Do not create extra rows.
If a value is unreadable, return null.

Return ONLY the JSON.`;

function getClient() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN غير مُعدّ — أضفه في ملف .env');
  }
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
}

// Strips a ```json ... ``` fence if the model wraps its output despite
// being told not to — model outputs aren't 100% deterministic even with
// strict instructions.
function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

async function extractInvoiceData(imageBuffer, mimeType) {
  const replicate = getClient();
  const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  // ── DEBUG Step 3: is the data URI well-formed? ──
  console.log('[extract][3] data URI first 120 chars:', dataUri.slice(0, 120));
  console.log('[extract][3] data URI total length:', dataUri.length, '| mimeType passed in:', mimeType);

  let output;
  try {
    output = await replicate.run(MODEL, {
      input: {
        prompt: EXTRACTION_PROMPT,
        images: [dataUri]
      }
    });
  } catch (err) {
    throw new Error(`فشل الاتصال بخدمة الاستخراج: ${err.message}`);
  }

  // replicate.run() may return a string, or an array of strings for
  // models that stream output in chunks — normalize either shape.
  const rawText = Array.isArray(output) ? output.join('') : String(output);

  // ── DEBUG Step 5: exactly what Replicate returned, before any parsing ──
  console.log('[extract][5] raw Replicate output (first 2000 chars):', rawText.slice(0, 2000));

  let parsed;
  try {
    parsed = JSON.parse(stripMarkdownFence(rawText));
  } catch {
    throw new Error('فشل استخراج بيانات الفاتورة — حاول مرة أخرى أو أدخلها يدوياً');
  }

  return parsed;
}

module.exports = { extractInvoiceData, EXTRACTION_PROMPT };
