const idPattern = /^[a-z0-9_-]+$/;
export const maxIdLength = 32;

export function isValidPlotId(id) {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= maxIdLength &&
    id === id.toLowerCase() &&
    idPattern.test(id)
  );
}

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxIdLength);
}

export function uniqueIdFromName(name, exists) {
  let base = slugify(name);
  if (!base) base = generateId();
  if (!exists(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`.slice(0, maxIdLength);
    if (!exists(candidate)) return candidate;
  }
  return generateId();
}

export function generateId(prefix = "plot") {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e8).toString(36);
  return `${prefix}_${t}${r}`.slice(0, maxIdLength);
}
