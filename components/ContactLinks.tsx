import type { Contacts } from "@/lib/contacts";
import type { Dictionary } from "@/lib/i18n/translations";

/** Phone numbers and VK links as a plain list (footer and /contacts). */
export function ContactLinks({
  contacts,
  dict,
  className = "",
}: {
  contacts: Contacts;
  dict: Dictionary;
  className?: string;
}) {
  const link = "transition-colors hover:text-accent";

  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {contacts.phones.map((phone) => (
        <li key={phone.href}>
          <a href={phone.href} className={`whitespace-nowrap ${link}`}>
            {phone.label}
          </a>
        </li>
      ))}
      {contacts.vkGroup && (
        <li>
          <a href={contacts.vkGroup} target="_blank" rel="noopener noreferrer" className={link}>
            {dict.footer.vkGroup}
          </a>
        </li>
      )}
      {contacts.vkChat && (
        <li>
          <a href={contacts.vkChat} target="_blank" rel="noopener noreferrer" className={link}>
            {dict.footer.vkChat}
          </a>
        </li>
      )}
    </ul>
  );
}
