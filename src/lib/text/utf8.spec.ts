import { looksBroken } from "./utf8";

describe("No mojibake in critical strings", () => {
  it("should detect mojibake reliably", () => {
    expect(looksBroken("HDR-Unterstützung")).toBe(false);
    expect(looksBroken("HDR-UnterstÃ¼tzung")).toBe(true);
    expect(looksBroken("50â¬ Geschenkkarte")).toBe(true);
  });
});
