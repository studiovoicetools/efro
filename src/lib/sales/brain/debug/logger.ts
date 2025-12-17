import type { LogPayload } from "../types";

export function logInfo(label: string, payload?: LogPayload): void {
  if (typeof payload === "undefined") {
    console.log(label);
    return;
  }

  console.log(label, payload);
}

export function logWarn(label: string, payload?: LogPayload): void {
  if (typeof payload === "undefined") {
    console.warn(label);
    return;
  }

  console.warn(label, payload);
}
