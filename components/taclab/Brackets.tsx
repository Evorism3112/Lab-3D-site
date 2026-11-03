/** The HUD corner brackets around a product photo (approved TACLAB mockup). Parent: position relative. */
export function Brackets({ size = 24, inset = 14 }: { size?: number; inset?: number }) {
  const common = { position: "absolute", width: size, height: size, borderColor: "var(--tl-accent)" } as const;
  return (
    <>
      <span aria-hidden style={{ ...common, left: inset, top: inset, borderLeft: "2px solid", borderTop: "2px solid" }} />
      <span aria-hidden style={{ ...common, right: inset, top: inset, borderRight: "2px solid", borderTop: "2px solid" }} />
      <span aria-hidden style={{ ...common, left: inset, bottom: inset, borderLeft: "2px solid", borderBottom: "2px solid" }} />
      <span aria-hidden style={{ ...common, right: inset, bottom: inset, borderRight: "2px solid", borderBottom: "2px solid" }} />
    </>
  );
}
