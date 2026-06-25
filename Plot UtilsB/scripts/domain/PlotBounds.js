import { BlockVolume } from "@minecraft/server";
import { floorVec } from "../utils/Vec3.js";

export class PlotBounds {
  constructor(a, b) {
    const fa = floorVec(a);
    const fb = floorVec(b);
    this.min = { x: Math.min(fa.x, fb.x), y: Math.min(fa.y, fb.y), z: Math.min(fa.z, fb.z) };
    this.max = { x: Math.max(fa.x, fb.x), y: Math.max(fa.y, fb.y), z: Math.max(fa.z, fb.z) };
    this._volume = undefined;
  }

  static fromRecord(record) {
    const a = record?.from ?? record?.min;
    const b = record?.to ?? record?.max;
    if (!a || !b || typeof a.x !== "number" || typeof b.x !== "number") return undefined;
    return new PlotBounds(a, b);
  }

  get from() {
    return this.min;
  }
  get to() {
    return this.max;
  }

  get size() {
    return {
      x: this.max.x - this.min.x + 1,
      y: this.max.y - this.min.y + 1,
      z: this.max.z - this.min.z + 1,
    };
  }

  get center() {
    return {
      x: (this.min.x + this.max.x + 1) / 2,
      y: (this.min.y + this.max.y + 1) / 2,
      z: (this.min.z + this.max.z + 1) / 2,
    };
  }

  get maxAxisSpan() {
    const s = this.size;
    return Math.max(s.x, s.y, s.z);
  }

  get capacity() {
    const volume = this.toBlockVolume();
    if (volume) {
      try {
        return volume.getCapacity();
      } catch {}
    }
    const s = this.size;
    return s.x * s.y * s.z;
  }

  toBlockVolume() {
    if (this._volume === undefined) {
      try {
        this._volume = new BlockVolume(this.min, this.max);
      } catch {
        this._volume = null;
      }
    }
    return this._volume ?? undefined;
  }

  isInside(location) {
    const p = floorVec(location);
    return (
      p.x >= this.min.x && p.x <= this.max.x &&
      p.y >= this.min.y && p.y <= this.max.y &&
      p.z >= this.min.z && p.z <= this.max.z
    );
  }

  intersects(other) {
    return (
      this.min.x <= other.max.x && this.max.x >= other.min.x &&
      this.min.y <= other.max.y && this.max.y >= other.min.y &&
      this.min.z <= other.max.z && this.max.z >= other.min.z
    );
  }

  containsBounds(other) {
    return Boolean(
      other &&
      other.min.x >= this.min.x && other.max.x <= this.max.x &&
      other.min.y >= this.min.y && other.max.y <= this.max.y &&
      other.min.z >= this.min.z && other.max.z <= this.max.z
    );
  }

  toRecord() {
    return { from: { ...this.min }, to: { ...this.max } };
  }
}
