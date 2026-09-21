// Shared helpers used by the order page and the menu admin page.

async function requireAuth() {
  const res = await fetch("/api/session");
  const data = await res.json();
  if (!data.authenticated) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `Feil (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function formatKr(amount) {
  return new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount) + " kr";
}

let toastTimer = null;
function showToast(message, isError) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("error", !!isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function uuid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function wireLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "login.html";
  });
}

document.addEventListener("DOMContentLoaded", wireLogout);
