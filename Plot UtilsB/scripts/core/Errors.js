export class PlotError extends Error {
  constructor(messageKey, params = []) {
    super(messageKey);
    this.name = this.constructor.name;
    this.messageKey = messageKey;
    this.params = params;
  }
}

export class ValidationError extends PlotError {}
export class PermissionError extends PlotError {}
export class NotFoundError extends PlotError {}

export function isPlotError(error) {
  return error instanceof PlotError;
}
