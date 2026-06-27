export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="text-xs text-[var(--color-text-muted)]">
          © {new Date().getFullYear()} GridCalc
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]/70">
          ไม่ใช่คำแนะนำการลงทุน · ใช้ความเสี่ยงของคุณเอง
        </p>
      </div>
    </footer>
  );
}
