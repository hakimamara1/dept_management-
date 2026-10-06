const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/**
 * Parses what a person typed into a number. Arabic keyboards can produce Arabic-Indic digits
 * (٣٫٥) and a decimal comma; both are normalised so "٣٬٥" never silently becomes NaN or 3.
 */
export function parseNumber(text: string): number {
  const normalised = text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[٬\s]/g, '')
  return normalised === '' ? NaN : Number(normalised)
}

export const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
