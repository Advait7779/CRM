export const LEAD_GROUPS = ['All', 'GPS & Fuel Sensor', 'CCTV', 'Digital Services', 'Website Leads']

const DIGITAL_PRODUCTS = new Set([
  'SMS', 'WhatsApp WABA', 'RCS', 'Voice Call',
  'Website Development', 'Software Development', 'Digital Marketing'
])

export function leadMatchesGroup(lead, group) {
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

const leadDateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const leadTimeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' })

export function getLeadDate(lead) {
  if (lead.websiteLeadId && lead.websiteSubmittedAt) {
    const submittedAt = new Date(lead.websiteSubmittedAt)
    if (!Number.isNaN(submittedAt.getTime())) return {
      date: leadDateFormatter.format(submittedAt),
      time: leadTimeFormatter.format(submittedAt),
      title: 'Website enquiry date'
    }
  }
  const rawDate = lead.source === 'Justdial' ? lead.justdialPayload?.date : null
  const enquiryDate = typeof rawDate === 'string' ? rawDate.trim() : ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(enquiryDate)
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    if (date.toISOString().slice(0, 10) === enquiryDate) {
      const rawTime = lead.justdialPayload?.time
      const enquiryTime = typeof rawTime === 'string' ? rawTime.trim() : ''
      return {
        date: leadDateFormatter.format(date),
        time: /^\d{2}:\d{2}/.test(enquiryTime) ? enquiryTime.slice(0, 5) : '',
        title: 'Justdial enquiry date'
      }
    }
  }

  const createdAt = lead.createdAt ? new Date(lead.createdAt) : null
  if (!createdAt || Number.isNaN(createdAt.getTime())) return { date: '—', time: '', title: 'Lead date unavailable' }
  return {
    date: leadDateFormatter.format(createdAt),
    time: leadTimeFormatter.format(createdAt),
    title: lead.source === 'Justdial' ? 'Date received by CRM' : 'Date added to CRM'
  }
}
