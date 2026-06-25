import { PlotBounds } from "./PlotBounds.js";
import { Dimensions } from "../core/Constants.js";
import { normalizeGroupRules } from "./PlotSchema.js";

export class PlotGroup {
  constructor(data) {
    this.id = data.id;
    this.name = data.name ?? data.id;
    this.dimensionId = data.dimensionId ?? Dimensions.overworld;
    this.bounds = data.bounds instanceof PlotBounds ? data.bounds : PlotBounds.fromRecord(data.bounds);
    this.plotIds = Array.isArray(data.plotIds) ? data.plotIds.filter((id) => typeof id === "string") : [];
    this.rules = normalizeGroupRules(data.rules);
    this.createdAt = typeof data.createdAt === "number" ? data.createdAt : Date.now();
    this.updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : this.createdAt;
    this.metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  }

  setRule(key, value) {
    if (!(key in this.rules)) return false;
    this.rules[key] = Boolean(value);
    this.updatedAt = Date.now();
    return true;
  }

  allows(rule) {
    return Boolean(this.rules[rule]);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      dimensionId: this.dimensionId,
      bounds: this.bounds ? this.bounds.toRecord() : undefined,
      plotIds: this.plotIds,
      rules: this.rules,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata,
    };
  }
}
