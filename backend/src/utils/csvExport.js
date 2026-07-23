const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toCsv = (headers = [], rows = []) => {
  const escape = (value) => `"${csvCell(value).replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
};

const sendCsv = (res, filename, headers, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(toCsv(headers, rows));
};

const dateStamp = () => new Date().toISOString().slice(0, 10);

const displayName = (user = {}) => (
  user?.businessName ||
  user?.fullName ||
  user?.name ||
  user?.email ||
  user?.phone ||
  ''
);

const docId = (value) => String(value?._id || value?.id || value || '');

module.exports = {
  dateStamp,
  displayName,
  docId,
  sendCsv,
};
