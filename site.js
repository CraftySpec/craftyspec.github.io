async function injectPartial(selector, filename) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(filename, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  el.innerHTML = await res.text();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await injectPartial("#site-header", "header.html");
    await injectPartial("#site-nav", "nav.html");
    await injectPartial("#mobile-nav", "nav.html"); // 👈 new

    setActiveNavLink();
    ensureNavUI();
  } catch (e) {
    console.error(e);
  }
});
