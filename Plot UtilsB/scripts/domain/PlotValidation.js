import { isValidPlotId } from "../utils/Ids.js";

export const maxDisplayName = 32;

export function validateDisplayName(name) {
  if (!name) return "plotutils.display_name_required";
  if (name.length > maxDisplayName) return "plotutils.display_name_length";
  if (name.includes("§")) return "plotutils.display_name_color";
  if (name.includes("%")) return "plotutils.display_name_percent";
  return null;
}

export function validatePlotId(id, exists) {
  if (!id) return "plotutils.plot_id_required";
  if (id !== id.toLowerCase()) return "plotutils.plot_id_lowercase";
  if (!isValidPlotId(id)) return "plotutils.plot_id_chars";
  if (exists(id)) return "plotutils.plot_id_exists";
  return null;
}
