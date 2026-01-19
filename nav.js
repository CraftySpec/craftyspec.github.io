async function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const res = await fetch("sidebar.html", { cache: "no-store" });
  if (!res.ok) {
    container.innerHTML = "<!-- sidebar failed to load -->";
    return;
  }

  container.innerHTML = await res.text();

  // Set active link automatically
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("#siteNav a").forEach(a => {
    const href = a.getAttribute("href");
    if (href === path) a.classList.add("active");
  });

  // Mobile menu toggle
  const sidebar = document.getElementById("sidebar");
  const btn = document.getElementById("menuToggle");
  if (sidebar && btn) {
    btn.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Menu (close)" : "Menu";
    });
  }
}

document.addEventListener("DOMContentLoaded", loadSidebar);
