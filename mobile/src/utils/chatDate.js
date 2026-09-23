// Group by the viewer's local calendar day, using the original server timestamp.
function messageDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function chatDayKey(value) {
  const date = messageDate(value);
  if (!date) return 'unknown';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function chatDayLabel(value, now = new Date()) {
  const date = messageDate(value);
  if (!date) return 'Date unavailable';
  const fullDate = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\bSep\b/, 'Sept');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const key = chatDayKey(date);
  const relative = key === chatDayKey(now) ? 'Today' : key === chatDayKey(yesterday) ? 'Yesterday' : '';
  return relative ? relative + ' · ' + fullDate : fullDate;
}

export function chatTime(value) {
  const date = messageDate(value);
  return date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
}

export function chatTimestamp(value) {
  const date = messageDate(value);
  return date ? date.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'Date unavailable';
}

export function chatPreviewDate(value, now = new Date()) {
  const date = messageDate(value);
  if (!date) return '';
  if (chatDayKey(date) === chatDayKey(now)) return chatTime(date);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mergeChatPage(previous, page, older = false) {
  const retained = older ? previous : (page.length ? previous.filter(m => Number(m.id) < Math.min(...page.map(row => Number(row.id)))) : []);
  const byId = new Map([...retained, ...page].map(message => [message.id, message]));
  return sortChatMessages([...byId.values()]);
}

export function sortChatMessages(messages) {
  return [...messages].sort((a, b) => {
    const aTime = messageDate(a.createdAt)?.getTime() ?? -Infinity;
    const bTime = messageDate(b.createdAt)?.getTime() ?? -Infinity;
    return (aTime === bTime ? 0 : aTime < bTime ? -1 : 1) || Number(a.id) - Number(b.id);
  });
}
