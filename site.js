async function injectHTML(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  el.innerHTML = await res.text();
}

function setActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll('[data-nav]');
  links.forEach(a => {
    if (a.getAttribute("data-nav") === path) a.classList.add("active");
  });
}

(async function main(){
  try {
    await injectHTML("#header-container", "header.html");
    await injectHTML("#sidebar-container", "sidebar.html");
    setActiveNav();
  } catch (e) {
    console.error(e);
  }
})();
