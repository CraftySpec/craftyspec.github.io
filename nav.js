async function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const res = await fetch("sidebar.html", { cache: "no-store" });
  if (!res.ok) {
    console.error("Could not load sidebar.html", res.status);
    return;
  }
  container.innerHTML = await res.text();

  // Highlight active link
  const path = window.location.pathname.split("/").pop() || "index.html";
  const links = container.querySelectorAll(".nav a");
  links.forEach(a => {
    const href = (a.getAttribute("href") || "").trim();
    if (href === path) a.classList.add("active");
  });
}

function setupMobileNavUI() {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "nav-overlay";
  overlay.addEventListener("click", () => document.body.classList.remove("nav-open"));
  document.body.appendChild(overlay);

  // Create hamburger toggle
  const btn = document.createElement("button");
  btn.className = "nav-toggle";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open navigation menu");
  btn.innerHTML = "☰ <span style='font-weight:600'>Menu</span>";

  btn.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });

  document.body.appendChild(btn);

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.body.classList.remove("nav-open");
  });

  // Close drawer when a nav link is clicked (mobile quality-of-life)
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".sidebar .nav a");
    if (a) document.body.classList.remove("nav-open");
  });
}

(async function initNav() {
  await loadSidebar();
  setupMobileNavUI();
})();
