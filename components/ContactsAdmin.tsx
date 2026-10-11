"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_PHONES, normalizeVkUrl, parsePhone } from "@/lib/contacts";
import type { Dictionary } from "@/lib/i18n/translations";

// Phone numbers and VK links shown on the site (lib/contacts.ts).
export function ContactsAdmin({
  dict,
  phones,
  vkGroup,
  vkChat,
}: {
  dict: Dictionary;
  phones: string[];
  vkGroup: string;
  vkChat: string;
}) {
  const t = dict.admin;
  const router = useRouter();
  const [phonesText, setPhonesText] = useState(phones.join("\n"));
  const [group, setGroup] = useState(vkGroup);
  const [chat, setChat] = useState(vkChat);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const phoneList = phonesText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const valid =
    phoneList.length <= MAX_PHONES &&
    phoneList.every((p) => parsePhone(p)) &&
    normalizeVkUrl(group) !== null &&
    normalizeVkUrl(chat) !== null;

  const save = async () => {
    if (!valid) {
      setMessage({ text: t.contactsInvalid, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: { phones: phoneList, vkGroup: group, vkChat: chat } }),
    });
    setBusy(false);
    setMessage(res.ok ? { text: t.pricingSaved, error: false } : { text: t.contactsInvalid, error: true });
    if (res.ok) router.refresh();
  };

  return (
    <div className="card flex max-w-xl flex-col gap-5 p-5">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t.contactsPhonesLabel}
        <textarea
          value={phonesText}
          onChange={(e) => setPhonesText(e.target.value)}
          rows={3}
          placeholder="+7 900 000-00-00"
          className="px-3 py-2 text-sm"
        />
        <span className="text-xs">{t.contactsPhonesHint}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t.contactsVkGroupLabel}
        <input
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="https://vk.com/..."
          className="px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {t.contactsVkChatLabel}
        <input
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="https://vk.me/..."
          className="px-3 py-2 text-sm"
        />
        <span className="text-xs">{t.contactsVkChatHint}</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary px-4 py-1.5 text-sm">
          {busy ? t.saving : t.savePricing}
        </button>
        {message && <p className={`text-sm ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
