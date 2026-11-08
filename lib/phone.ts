// Russian phone as it is typed: "90" → "+7 90", "8900…" → "+7 900…", up to "+7 900 123-45-67".
// Nothing trails the last digit, so backspace erases digits rather than getting stuck on a separator.
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  // A leading 8 is the domestic prefix; anything else but 7 is the number itself.
  if (digits[0] === "8" && !value.trim().startsWith("+")) digits = `7${digits.slice(1)}`;
  else if (digits[0] !== "7") digits = `7${digits}`;
  const n = digits.slice(1, 11);
  const parts = [n.slice(0, 3), n.slice(3, 6), n.slice(6, 8), n.slice(8, 10)];
  let out = "+7";
  if (parts[0]) out += ` ${parts[0]}`;
  if (parts[1]) out += ` ${parts[1]}`;
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;
  return out;
}
