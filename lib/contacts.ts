// Contacts shown in the header, the footer and on /contacts; edited in the admin (/admin/contacts).
// Stored in the Setting table — see getContacts() in lib/settings.ts. No server imports here:
// the admin form validates with the same functions in the browser.

export const MAX_PHONES = 5;

const VK_HOSTS = new Set(["vk.com", "www.vk.com", "m.vk.com", "vk.ru", "www.vk.ru", "m.vk.ru", "vk.me"]);

export type Phone = { label: string; href: string };
export type Contacts = { phones: Phone[]; vkGroup: string; vkChat: string };

/** "" stays "", "vk.com/lab3d" becomes "https://vk.com/lab3d"; null = not a VK link. */
export function normalizeVkUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!VK_HOSTS.has(url.hostname.toLowerCase()) || url.pathname.length < 2) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

/** The number as typed for display plus a tel: link; null = not a phone number. */
export function parsePhone(raw: string): Phone | null {
  const label = raw.trim();
  if (!/^\+?[\d\s()-]{5,25}$/.test(label)) return null;
  let digits = label.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 15) return null;
  // Russian numbers are usually written with a leading 8, which only dials inside the country.
  if (digits.length === 11 && digits[0] === "8") digits = `7${digits.slice(1)}`;
  const international = label.startsWith("+") || (digits.length === 11 && digits[0] === "7");
  return { label, href: `tel:${international ? "+" : ""}${digits}` };
}

export function hasContacts(contacts: Contacts): boolean {
  return contacts.phones.length > 0 || Boolean(contacts.vkGroup) || Boolean(contacts.vkChat);
}
