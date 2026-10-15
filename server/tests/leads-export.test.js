const test = require('node:test')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { LEAD_GROUPS, leadMatchesGroup, filterLeads, buildLeadsWorkbook } = require('../utils/leadWorkbook')

const leads = [
  { id: 1, name: 'Camera customer', phone: '0987654321', source: 'Justdial', service: 'Cctv Repair & Services', justdialProduct: 'CCTV', justdialPayload: { date: '2026-10-09', time: '09:35' }, createdAt: '2026-10-09T04:10:00Z', status: 'New' },
  { id: 2, name: 'Fleet customer', phone: '1234567890', source: 'Justdial', service: 'Gps Tracking', justdialProduct: 'GPS & Fuel Sensor', createdAt: '2026-10-09T04:11:00Z', status: 'New' },
  { id: 3, name: 'Digital customer', phone: '1234567891', source: 'Justdial', service: 'Bulk Sms', justdialProduct: 'SMS', createdAt: '2026-10-09T04:12:00Z', status: 'New' },
  { id: 4, name: 'Review customer', phone: '1234567892', source: 'Justdial', service: 'Unknown', justdialProduct: 'Unclassified', createdAt: '2026-10-09T04:13:00Z', status: 'New' },
  { id: 5, name: 'Website customer', phone: '1234567893', source: 'Website', service: 'CCTV Security', createdAt: '2026-10-09T04:14:00Z', status: 'New' }
]

test('product filters match the mobile grouping, including unclassified leads in All', () => {
  assert.deepEqual(LEAD_GROUPS, ['All', 'GPS & Fuel Sensor', 'CCTV', 'Digital Services', 'Website Leads'])
  assert.deepEqual(leads.filter(lead => leadMatchesGroup(lead, 'CCTV')).map(lead => lead.id), [1, 5])
  assert.deepEqual(leads.filter(lead => leadMatchesGroup(lead, 'GPS & Fuel Sensor')).map(lead => lead.id), [2])
  assert.deepEqual(leads.filter(lead => leadMatchesGroup(lead, 'Digital Services')).map(lead => lead.id), [3])
  assert.equal(leads.filter(lead => leadMatchesGroup(lead, 'All')).length, 5)
  assert.deepEqual(filterLeads(leads, 'CCTV', 'camera').map(lead => lead.id), [1])
})

test('Website Leads includes imported enquiries but excludes manually entered Website leads', async () => {
  const imported = {
    id: 6, name: 'Imported customer', phone: '1234567894', source: 'Website',
    service: 'SMS Package', websiteLeadId: '42', websiteFormSource: 'Popup Free Demo Modal',
    websiteSubmittedAt: '2026-10-09T04:30:00Z', createdAt: '2026-10-09T04:31:00Z', status: 'New'
  }
  const selected = filterLeads([...leads, imported], 'Website Leads', '')
  assert.deepEqual(selected.map(lead => lead.id), [6])
  const workbook = buildLeadsWorkbook(selected, 'Website Leads')
  const sheet = workbook.getWorksheet('Leads')
  assert.equal(sheet.getCell('O6').value, 'Popup Free Demo Modal')
  assert.equal(sheet.getCell('I6').value.toISOString(), '2026-10-09T10:00:00.000Z')
})

test('Excel export preserves visible leads, phone text, dates and full notes in a readable layout', async () => {
  const cctv = leads.filter(lead => leadMatchesGroup(lead, 'CCTV'))
  const longNote = `Justdial enquiry ID: ${'JDLOCAL-1234567890-'.repeat(18)}`
  cctv[0] = { ...cctv[0], name: '=HYPERLINK("https://example.invalid")', notes: longNote }
  const workbook = buildLeadsWorkbook(cctv, 'CCTV', new Date('2026-10-09T05:00:00Z'))
  const buffer = await workbook.xlsx.writeBuffer()
  const loaded = await new ExcelJS.Workbook().xlsx.load(buffer)
  const sheet = loaded.getWorksheet('Leads')
  assert.equal(sheet.getCell('A3').value.includes('CCTV  •  2 leads'), true)
  assert.deepEqual(sheet.views[0].state, 'frozen')
  assert.equal(sheet.getColumn('C').width, 19)
  assert.equal(sheet.getColumn('I').width, 23)
  assert.equal(sheet.getCell('B6').value, '=HYPERLINK("https://example.invalid")')
  assert.equal(sheet.getCell('B6').type, ExcelJS.ValueType.String)
  assert.equal(sheet.getCell('C6').value, '0987654321')
  assert.equal(sheet.getCell('C6').numFmt, '@')
  assert.equal(sheet.getCell('I6').value.toISOString(), '2026-10-09T09:35:00.000Z')
  assert.equal(sheet.getCell('I6').numFmt, 'dd mmm yyyy hh:mm')
  assert.equal(sheet.getCell('J6').value.toISOString(), '2026-10-09T09:40:00.000Z')
  assert.equal(sheet.getRow(6).height, 27)
  assert.equal(sheet.getCell('N6').value.endsWith('…'), true)
  assert.equal(loaded.getWorksheet('Notes').getCell('C5').value, longNote)
  assert.equal(sheet.getCell('B7').value, 'Website customer')
  assert.equal(sheet.getCell('B8').value, null)
})
