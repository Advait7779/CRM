const ExcelJS = require('exceljs')
const { jsonReplacer } = require('./prismaData')

const LEAD_GROUPS = ['All', 'GPS & Fuel Sensor', 'CCTV', 'Digital Services', 'Website Leads']
const DIGITAL_PRODUCTS = new Set([
  'SMS', 'WhatsApp WABA', 'RCS', 'Voice Call',
  'Website Development', 'Software Development', 'Digital Marketing'
])

function leadMatchesGroup(lead, group) {
  if (group === 'All') return true
  if (group === 'Website Leads') return Boolean(lead.websiteLeadId)
  if (lead.justdialProduct) {
    if (group === 'GPS & Fuel Sensor') return lead.justdialProduct === 'GPS & Fuel Sensor'
    if (group === 'CCTV') return lead.justdialProduct === 'CCTV'
    return DIGITAL_PRODUCTS.has(lead.justdialProduct)
  }
  const service = String(lead.service || '')
  if (group === 'GPS & Fuel Sensor') return /\b(gps|fuel sensor|fuel monitoring|vehicle tracking|fleet tracking)\b/i.test(service)
  if (group === 'CCTV') return /\b(cctv|camera|surveillance)\b/i.test(service)
  return /\b(sms|rcs|whatsapp|waba|voice|ivr|website|web design|web development|software|app development|digital marketing|seo)\b/i.test(service)
}

function filterLeads(leads, group, search) {
  const term = String(search || '').trim().toLowerCase()
  return leads.filter(lead => {
    const matchSearch = !term || [lead.name, lead.phone, lead.company, lead.service, lead.justdialProduct]
      .some(value => String(value || '').toLowerCase().includes(term))
    return matchSearch && leadMatchesGroup(lead, group)
  })
}

const ZONE = 'Asia/Kolkata'
const DATE_TIME_FORMAT = 'dd mmm yyyy hh:mm'
const DATE_FORMAT = 'dd mmm yyyy'
const datePartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})
const exportTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})

const columns = [
  { title: 'Lead ID', key: 'id', width: 12 },
  { title: 'Name', key: 'name', width: 25 },
  { title: 'Phone', key: 'phone', width: 19 },
  { title: 'Email', key: 'email', width: 34 },
  { title: 'Company', key: 'company', width: 32 },
  { title: 'Service Interest', key: 'service', width: 35 },
  { title: 'Justdial Product Group', key: 'product', width: 26 },
  { title: 'Source', key: 'source', width: 17 },
  { title: 'Lead Date', key: 'leadDate', width: 23 },
  { title: 'Received by CRM', key: 'receivedAt', width: 23 },
  { title: 'Status', key: 'status', width: 18 },
  { title: 'Executive', key: 'exec', width: 25 },
  { title: 'Follow-up Date', key: 'followUp', width: 21 },
  { title: 'Notes Preview', key: 'notes', width: 58 },
  { title: 'Website Form', key: 'websiteFormSource', width: 30 }
]

function localExcelDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(datePartsFormatter.formatToParts(date).map(({ type, value: part }) => [type, Number(part)]))
  // Excel dates have no timezone. Store the IST wall-clock fields as a UTC Date
  // so ExcelJS writes the date and time that the CRM shows to the user.
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute))
}

function isoExcelDate(value, time = '') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = /^(\d{2}):(\d{2})/.exec(String(time || '').trim())
  const hour = hours ? Number(hours[1]) : 0
  const minute = hours ? Number(hours[2]) : 0
  if (hour > 23 || minute > 59) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute))
  return date.toISOString().slice(0, 10) === match[0] ? date : null
}

function leadExcelDate(lead) {
  if (lead.websiteLeadId && lead.websiteSubmittedAt) {
    const submittedAt = localExcelDate(lead.websiteSubmittedAt)
    if (submittedAt) return submittedAt
  }
  if (lead.source === 'Justdial') {
    const enquiryDate = isoExcelDate(lead.justdialPayload?.date, lead.justdialPayload?.time)
    if (enquiryDate) return enquiryDate
  }
  return localExcelDate(lead.createdAt)
}

function cellText(value) {
  return String(value ?? '').replaceAll('\0', '')
}

function notesPreview(value) {
  const note = cellText(value).replace(/\s+/g, ' ').trim()
  return note.length > 95 ? `${note.slice(0, 94)}…` : note
}

function fill(color) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
}

function addHeading(sheet, lastColumn, title, detail, headerRow) {
  sheet.mergeCells(`A1:${lastColumn}2`)
  sheet.mergeCells(`A3:${lastColumn}3`)
  sheet.getRow(1).height = 24
  sheet.getRow(2).height = 24
  sheet.getRow(3).height = 28
  sheet.getRow(headerRow - 1).height = 12
  for (let row = 1; row <= 2; row += 1) {
    for (let col = 1; col <= sheet.columnCount; col += 1) sheet.getRow(row).getCell(col).fill = fill('FF172554')
  }
  const titleCell = sheet.getCell('A1')
  titleCell.value = title
  titleCell.font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', indent: 1 }
  const detailCell = sheet.getCell('A3')
  detailCell.value = detail
  detailCell.font = { name: 'Aptos', size: 11, color: { argb: 'FF334155' } }
  detailCell.fill = fill('FFEFF6FF')
  detailCell.alignment = { vertical: 'middle', indent: 1 }
}

function styleHeader(sheet, rowNumber, labels) {
  const row = sheet.getRow(rowNumber)
  row.values = labels
  row.height = 36
  row.eachCell(cell => {
    cell.fill = fill('FF1E3A8A')
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })
}

function styleDataRow(row, index) {
  row.height = 27
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF172554' } }
    cell.fill = fill(index % 2 ? 'FFF3F7FC' : 'FFFFFFFF')
    cell.alignment = { vertical: 'middle', wrapText: false, indent: 1 }
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
  })
}

function buildLeadsWorkbook(leads, group = 'All', exportedAt = new Date()) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CRM-KGSOFTWARE'
  workbook.created = exportedAt

  const sheet = workbook.addWorksheet('Leads', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5, topLeftCell: 'C6' }],
    properties: { tabColor: { argb: 'FF6366F1' } },
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  })
  sheet.columns = columns.map(({ key, width }) => ({ key, width }))
  addHeading(sheet, 'O', 'LEAD MANAGEMENT', `${group}  •  ${leads.length} leads  •  Exported ${exportTimeFormatter.format(exportedAt)} IST  •  Full notes on the Notes tab`, 5)
  styleHeader(sheet, 5, columns.map(column => column.title))

  leads.forEach((lead, index) => {
    const row = sheet.addRow({
      id: lead.id ?? '',
      name: cellText(lead.name),
      phone: cellText(lead.phone),
      email: cellText(lead.email),
      company: cellText(lead.company),
      service: cellText(lead.service),
      product: lead.source === 'Justdial' ? cellText(lead.justdialProduct || 'Unclassified') : '',
      source: cellText(lead.source),
      websiteFormSource: cellText(lead.websiteFormSource),
      leadDate: leadExcelDate(lead),
      receivedAt: localExcelDate(lead.createdAt),
      status: cellText(jsonReplacer('status', lead.status)),
      exec: cellText(lead.exec),
      followUp: isoExcelDate(lead.followUp),
      notes: notesPreview(lead.notes)
    })
    styleDataRow(row, index)
    row.getCell('phone').numFmt = '@'
    row.getCell('leadDate').numFmt = DATE_TIME_FORMAT
    row.getCell('receivedAt').numFmt = DATE_TIME_FORMAT
    row.getCell('followUp').numFmt = DATE_FORMAT
    if (lead.status === 'New') row.getCell('status').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF2563EB' } }
    if (lead.status === 'Converted' || lead.status === 'Won') row.getCell('status').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF059669' } }
  })
  sheet.autoFilter = `A5:O${Math.max(6, sheet.lastRow.number)}`
  sheet.pageSetup.printTitlesRow = '1:5'

  const notesSheet = workbook.addWorksheet('Notes', {
    views: [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5' }],
    properties: { tabColor: { argb: 'FF94A3B8' } }
  })
  notesSheet.columns = [{ width: 14 }, { width: 30 }, { width: 110 }]
  addHeading(notesSheet, 'C', 'FULL LEAD NOTES', 'Use Lead ID to match these notes with the Leads tab.', 4)
  styleHeader(notesSheet, 4, ['Lead ID', 'Name', 'Full Notes'])
  leads.filter(lead => cellText(lead.notes).trim()).forEach((lead, index) => {
    const row = notesSheet.addRow([lead.id ?? '', cellText(lead.name), cellText(lead.notes)])
    styleDataRow(row, index)
    row.height = Math.min(150, Math.max(27, Math.ceil(cellText(lead.notes).length / 100) * 17))
    row.getCell(3).alignment = { vertical: 'top', wrapText: true, indent: 1 }
  })
  notesSheet.autoFilter = `A4:C${Math.max(5, notesSheet.lastRow.number)}`

  return workbook
}

module.exports = { LEAD_GROUPS, leadMatchesGroup, filterLeads, buildLeadsWorkbook }
