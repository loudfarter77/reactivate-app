import Papa from 'papaparse'
import { z } from 'zod'

export interface ParsedLead {
  name: string
  email?: string
  phone?: string
}

export interface CsvParseResult {
  leads: ParsedLead[]
  errors: string[]
  duplicatesRemoved: number
  totalRows: number
}

const MAX_ROWS = 1000

const emailSchema = z.string().email()
// Phone: 7–20 chars, digits + optional leading +
const phoneSchema = z.string().min(7).max(20).regex(/^\+?[\d\s\-().]+$/, 'Invalid phone format')

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, '_')
}

function normalizeValue(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Parses a CSV string into validated leads.
 * Works in both browser and Node.js (PapaParse supports both).
 */
export function parseLeadsCsv(
  csvContent: string,
  channel: 'email' | 'sms' | 'both'
): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
    transform: normalizeValue,
  })

  const totalRows = result.data.length
  const errors: string[] = []
  const validLeads: ParsedLead[] = []

  // Track dedup keys: email for email/both, phone for sms/both
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()
  let duplicatesRemoved = 0

  if (result.errors.length > 0) {
    errors.push(`CSV parse error on row ${result.errors[0].row ?? '?'}: ${result.errors[0].message}`)
  }

  if (totalRows > MAX_ROWS) {
    errors.push(`CSV contains ${totalRows} rows — capped at ${MAX_ROWS}. Last ${totalRows - MAX_ROWS} rows were skipped.`)
  }

  const rowsToProcess = result.data.slice(0, MAX_ROWS)

  rowsToProcess.forEach((row, i) => {
    const rowNum = i + 2 // 1-indexed + header row

    // Accept common column name variants
    const name = (row.name ?? row.full_name ?? row.first_name ?? '').trim()
    const email = (row.email ?? row.email_address ?? '').trim().toLowerCase()
    const phone = (row.phone ?? row.phone_number ?? row.mobile ?? row.telephone ?? '').trim()

    if (!name) {
      errors.push(`Row ${rowNum}: missing name`)
      return
    }

    // Validate email if required
    if (channel === 'email' || channel === 'both') {
      if (!email) {
        errors.push(`Row ${rowNum} (${name}): missing email`)
        return
      }
      if (!emailSchema.safeParse(email).success) {
        errors.push(`Row ${rowNum} (${name}): invalid email "${email}"`)
        return
      }
    }

    // Validate phone if required
    if (channel === 'sms' || channel === 'both') {
      if (!phone) {
        errors.push(`Row ${rowNum} (${name}): missing phone`)
        return
      }
      if (!phoneSchema.safeParse(phone).success) {
        errors.push(`Row ${rowNum} (${name}): invalid phone "${phone}"`)
        return
      }
    }

    // Dedup within the CSV itself
    let isDuplicate = false
    if (email && seenEmails.has(email)) {
      isDuplicate = true
    }
    if (phone && seenPhones.has(phone)) {
      isDuplicate = true
    }

    if (isDuplicate) {
      duplicatesRemoved++
      return
    }

    if (email) seenEmails.add(email)
    if (phone) seenPhones.add(phone)

    validLeads.push({
      name,
      email: email || undefined,
      phone: phone || undefined,
    })
  })

  return {
    leads: validLeads,
    errors,
    duplicatesRemoved,
    totalRows,
  }
}
