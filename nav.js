document.addEventListener("DOMContentLoaded", () => {
  fetch("nav.html")
    .then(r => r.text())
    .then(html => {
      document.getElementById("nav-mount").innerHTML = html;

      // Mobile toggle button
      const btn = document.createElement("button");
      btn.className = "nav-toggle";
      btn.innerHTML = "☰";
      btn.onclick = () => {
        document.body.classList.toggle("nav-open");
      };
      document.body.appendChild(btn);
    });
});
