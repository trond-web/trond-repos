(function () {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("formMessage");

  // If already logged in, skip straight to the order page.
  fetch("/api/session")
    .then((r) => r.json())
    .then((data) => {
      if (data.authenticated) window.location.replace("index.html");
    })
    .catch(() => {});

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.textContent = data.error || "Kunne ikke logge inn.";
        return;
      }
      window.location.href = "index.html";
    } catch (err) {
      message.textContent = "Noe gikk galt. Prøv igjen.";
    }
  });
})();
