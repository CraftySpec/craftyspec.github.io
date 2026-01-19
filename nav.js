async function injectPartial(selector, filename) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(filename, { cache: "no-store" });
  if (!res.ok) {
    console.error(`FAILED to load ${filename} HTTP ${res.status}`);
    throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  }
  el.innerHTML = await res.text();
}

function setActiveNavLink() {
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(a => {
    const target = (a.getAttribute("href") || "").split("/").pop();
    if (target === here) a.classList.add("active");
  });
}

function ensureNavToggleButton() {
  if (document.querySelector(".nav-toggle")) return;

  const btn = document.createElement("button");
  btn.className = "nav-toggle";
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle navigation");
  btn.textContent = "☰";

  btn.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });

  document.body.appendChild(btn);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await injectPartial("#site-header", "header.html");
    await injectPartial("#site-nav", "nav.html");
    ensureNavToggleButton();
    setActiveNavLink();
  } catch (e) {
    // This will show a visible error on the page too
    const box = document.createElement("div");
    box.style.cssText = "max-width:1200px;margin:10px auto;padding:10px;background:#f8d7da;border:1px solid #f5c2c7;border-radius:6px;color:#842029;font-family:Arial;";
    box.textContent = `Site include error: ${e.message}`;
    document.body.prepend(box);
  }
});
