// Convierte strings tipo "30m", "2h", "1d", "1w" a minutos (número)
export function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)\s*([mhdw])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case "m": return value;
    case "h": return value * 60;
    case "d": return value * 60 * 24;
    case "w": return value * 60 * 24 * 7;
    default: return null;
  }
}

// Convierte minutos a texto humano legible
export function humanizeDuration(minutes) {
  if (minutes == null) return "-";
  if (minutes % (60 * 24 * 7) === 0) {
    const w = minutes / (60 * 24 * 7);
    return w === 1 ? "1 semana" : `${w} semanas`;
  }
  if (minutes % (60 * 24) === 0) {
    const d = minutes / (60 * 24);
    return d === 1 ? "1 día" : `${d} días`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}