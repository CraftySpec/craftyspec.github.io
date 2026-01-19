async function injectPartial(selector, filename) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(filename, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  el.innerHTML = await res.text();
}

function setActiveNavLink() {
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(a => {
    const target = (a.getAttribute("href") || "").split("/").pop();
    if (target === here) a.classList.add("active");
  });
}

function ensureNavUI() {
  // hamburger
  if (!document.querySelector(".nav-toggle")) {
    const btn = document.createElement("button");
    btn.className = "nav-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Open navigation menu");
    btn.textContent = "☰";
    btn.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
    document.body.appendChild(btn);
  }

  // backdrop
  if (!document.querySelector(".nav-backdrop")) {
    const bd = document.createElement("div");
    bd.className = "nav-backdrop";
    bd.addEventListener("click", () => document.body.classList.remove("nav-open"));
    document.body.appendChild(bd);
  }

  // close drawer when a link is clicked (mobile usability)
  document.querySelectorAll(".nav a").forEach(a => {
    a.addEventListener("click", () => document.body.classList.remove("nav-open"));
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await injectPartial("#site-header", "header.html");
    await injectPartial("#site-nav", "nav.html");
    setActiveNavLink();
    ensureNavUI();
  } catch (e) {
    console.error(e);
  }
});
