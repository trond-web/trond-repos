(function () {
  const STRENGTH_VALUES = ["Mild", "Medium", "Sterk"];
  const ADDON_CATEGORY_NAME = "Tillegg og sauser";
  const ADDON_CONTEXT_BY_CATEGORY = { Pizza: "pizza", Hamburgermeny: "burger", Kebabmeny: "kebab" };

  let menu = { categories: [] };
  let orders = [];
  let cart = []; // { itemId, sizeId, itemName, categoryName, sizeLabel, price, qty, strength, notes }
  let editingOrderId = null;

  const TOKENS_KEY = "casablanca_tokens";
  const NAME_KEY = "casablanca_name";

  function getTokens() {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
    } catch (err) {
      return {};
    }
  }
  function setToken(orderId, token) {
    const tokens = getTokens();
    tokens[orderId] = token;
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }
  function removeToken(orderId) {
    const tokens = getTokens();
    delete tokens[orderId];
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value);
      }
    }
    (children || []).forEach((child) => {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function findMenuItem(itemId) {
    for (const category of menu.categories) {
      const item = category.items.find((i) => i.id === itemId);
      if (item) return { item, category };
    }
    return null;
  }

  function getAddonsForCategory(categoryName) {
    const context = ADDON_CONTEXT_BY_CATEGORY[categoryName];
    if (!context) return [];
    const addonCategory = menu.categories.find((c) => c.name === ADDON_CATEGORY_NAME);
    if (!addonCategory) return [];
    const addons = [];
    addonCategory.items.forEach((item) => {
      if ((item.appliesTo || []).includes(context)) {
        const size = item.sizes[0];
        addons.push({ itemId: item.id, sizeId: size.id, itemName: item.name, price: size.price });
      }
    });
    return addons;
  }

  // ---------- Menu rendering ----------

  function renderMenu() {
    const container = document.getElementById("menuContainer");
    container.innerHTML = "";

    const updatedInfo = document.getElementById("menuUpdatedInfo");
    if (menu.updatedAt) {
      const d = new Date(menu.updatedAt);
      updatedInfo.textContent = "Meny sist oppdatert: " + d.toLocaleString("nb-NO");
    }

    menu.categories.forEach((category, idx) => {
      const details = el("details", { class: "category" });
      if (idx === 0) details.open = true;
      const summary = el("summary", {}, [
        el("span", { text: category.name }),
        category.note ? el("span", { class: "note", text: category.note }) : null,
      ]);
      details.appendChild(summary);

      if (category.imageUrl) {
        details.appendChild(el("img", { class: "category-image", src: category.imageUrl, alt: category.name, loading: "lazy" }));
      }

      category.items.forEach((item) => {
        details.appendChild(renderItemRow(item, category));
      });

      container.appendChild(details);
    });
  }

  function renderItemRow(item, category) {
    const hasMultipleSizes = item.sizes.length > 1;
    const sizeSelect = el("select", { "aria-label": "Størrelse for " + item.name });
    item.sizes.forEach((size) => {
      const opt = el("option", { value: size.id, text: (size.label || "Standard") + " – " + formatKr(size.price) });
      sizeSelect.appendChild(opt);
    });

    const strengthSelect = el("select", { "aria-label": "Styrke for " + item.name });
    STRENGTH_VALUES.forEach((value) => {
      const opt = el("option", { value, text: value });
      if (value === "Medium") opt.selected = true;
      strengthSelect.appendChild(opt);
    });

    const qtyInput = el("input", { type: "number", value: "1", min: "1", max: "50" });
    const decBtn = el("button", { type: "button", text: "−", onclick: () => {
      const v = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
      qtyInput.value = v;
    }});
    const incBtn = el("button", { type: "button", text: "+", onclick: () => {
      const v = Math.min(50, parseInt(qtyInput.value || "1", 10) + 1);
      qtyInput.value = v;
    }});

    const addons = getAddonsForCategory(category.name);
    const addonCheckboxes = addons.map((addon) => {
      const checkbox = el("input", { type: "checkbox" });
      return { addon, checkbox };
    });

    const addBtn = el("button", { class: "btn btn-primary btn-sm", type: "button", text: "Legg til" });
    addBtn.addEventListener("click", () => {
      const size = item.sizes.find((s) => s.id === sizeSelect.value) || item.sizes[0];
      const qty = Math.max(1, Math.min(50, parseInt(qtyInput.value || "1", 10)));
      addToCart({
        itemId: item.id,
        sizeId: size.id,
        itemName: item.name,
        categoryName: category.name,
        sizeLabel: size.label,
        price: size.price,
        strength: item.hasStrength ? strengthSelect.value : null,
      }, qty);
      let addedExtras = 0;
      addonCheckboxes.forEach(({ addon, checkbox }) => {
        if (!checkbox.checked) return;
        addToCart({
          itemId: addon.itemId,
          sizeId: addon.sizeId,
          itemName: addon.itemName,
          categoryName: ADDON_CATEGORY_NAME,
          sizeLabel: "",
          price: addon.price,
        }, qty);
        checkbox.checked = false;
        addedExtras += 1;
      });
      qtyInput.value = "1";
      showToast(`${item.name}${addedExtras ? " + tillegg" : ""} lagt til`);
    });

    const addonsRow = addonCheckboxes.length
      ? el("div", { class: "item-addons" }, addonCheckboxes.map(({ addon, checkbox }) =>
          el("label", { class: "addon-chip" }, [
            checkbox,
            document.createTextNode(`${addon.itemName} (+${formatKr(addon.price)})`),
          ])
        ))
      : null;

    const row = el("div", { class: "item-row" }, [
      el("div", { class: "item-row-main" }, [
        el("div", { class: "item-info" }, [
          el("div", { class: "name", text: item.name }),
          item.description ? el("div", { class: "desc", text: item.description }) : null,
          !hasMultipleSizes ? el("div", { class: "desc", text: formatKr(item.sizes[0].price) }) : null,
        ]),
        el("div", { class: "item-controls" }, [
          hasMultipleSizes ? sizeSelect : null,
          item.hasStrength ? strengthSelect : null,
          el("div", { class: "qty-stepper" }, [decBtn, qtyInput, incBtn]),
          addBtn,
        ]),
      ]),
      addonsRow,
    ]);
    return row;
  }

  // ---------- Cart ----------

  function lineLabel(line) {
    let label = line.sizeLabel ? `${line.itemName} (${line.sizeLabel})` : line.itemName;
    if (line.strength) label += ` – ${line.strength}`;
    return label;
  }

  function addToCart(line, qty) {
    const existing = cart.find((l) => l.itemId === line.itemId && l.sizeId === line.sizeId && l.strength === line.strength);
    if (existing) {
      existing.qty = Math.min(50, existing.qty + qty);
    } else {
      cart.push({ ...line, qty, notes: "" });
    }
    renderCart();
  }

  function renderCart() {
    const container = document.getElementById("cartLines");
    container.innerHTML = "";
    if (cart.length === 0) {
      container.appendChild(el("p", { class: "empty-hint", text: "Ingen retter valgt ennå." }));
    } else {
      cart.forEach((line, idx) => {
        const label = lineLabel(line);
        const lineTotal = line.price * line.qty;
        const row = el("div", { class: "cart-line" }, [
          el("span", { text: `${line.qty}× ${label}` }),
          el("span", {}, [
            el("span", { text: formatKr(lineTotal) + " " }),
            el("button", { class: "remove", type: "button", title: "Fjern", text: "✕", onclick: () => {
              cart.splice(idx, 1);
              renderCart();
            }}),
          ]),
        ]);
        container.appendChild(row);
      });
    }
    const total = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
    document.getElementById("cartTotal").textContent = formatKr(total);
  }

  function resetCartUI(keepName) {
    cart = [];
    editingOrderId = null;
    document.getElementById("orderComment").value = "";
    document.getElementById("submitOrderBtn").textContent = "Send bestilling";
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (cancelBtn) cancelBtn.remove();
    if (!keepName) document.getElementById("personName").value = "";
    renderCart();
  }

  // ---------- Orders / overview ----------

  async function loadOrders() {
    const data = await api("/api/orders");
    orders = data.orders;
    renderOrders();
  }

  function startEditOrder(order) {
    editingOrderId = order.id;
    document.getElementById("personName").value = order.person;
    document.getElementById("orderComment").value = order.comment || "";
    cart = order.lines.map((l) => ({
      itemId: l.itemId,
      sizeId: l.sizeId,
      itemName: l.itemName,
      categoryName: l.categoryName,
      sizeLabel: l.sizeLabel,
      price: l.price,
      qty: l.qty,
      strength: l.strength || null,
      notes: l.notes || "",
    }));
    renderCart();
    document.getElementById("submitOrderBtn").textContent = "Oppdater bestilling";
    if (!document.getElementById("cancelEditBtn")) {
      const cancelBtn = el("button", {
        id: "cancelEditBtn",
        type: "button",
        class: "btn btn-ghost btn-sm",
        text: "Avbryt redigering",
        style: "width:100%; margin-top:8px;",
        onclick: () => resetCartUI(true),
      });
      document.getElementById("submitOrderBtn").insertAdjacentElement("afterend", cancelBtn);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteOrder(order) {
    const tokens = getTokens();
    const token = tokens[order.id];
    if (!confirm(`Slette bestillingen til ${order.person}?`)) return;
    try {
      await api(`/api/orders/${order.id}`, { method: "DELETE", body: JSON.stringify({ token }) });
      removeToken(order.id);
      showToast("Bestilling slettet");
      await loadOrders();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function renderOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";
    document.getElementById("orderCountBadge").textContent = `${orders.length} bestilling${orders.length === 1 ? "" : "er"}`;

    if (orders.length === 0) {
      container.appendChild(el("p", { class: "empty-hint", text: "Ingen har bestilt ennå." }));
    } else {
      const tokens = getTokens();
      orders
        .slice()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .forEach((order) => {
          const isOwner = !!tokens[order.id];
          const lines = el("ul", {}, order.lines.map((l) => {
            return el("li", { text: `${l.qty}× ${lineLabel(l)} – ${formatKr(l.price * l.qty)}${l.notes ? " – " + l.notes : ""}` });
          }));

          const actions = el("div", { class: "row-actions" });
          if (isOwner) {
            actions.appendChild(el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Rediger", onclick: () => startEditOrder(order) }));
            actions.appendChild(el("button", { class: "btn btn-danger btn-sm", type: "button", text: "Slett", onclick: () => deleteOrder(order) }));
          }

          const card = el("div", { class: "order-card" }, [
            el("div", { class: "order-card-header" }, [
              el("span", { class: "name", text: order.person }),
              el("span", { class: "order-total", text: formatKr(order.total) }),
            ]),
            lines,
            order.comment ? el("div", { class: "comment", text: "Kommentar: " + order.comment }) : null,
            actions.children.length ? actions : null,
          ]);
          container.appendChild(card);
        });
    }

    renderPersonTotals();
    renderAggregate();
  }

  function renderPersonTotals() {
    const tbody = document.querySelector("#personTotalsTable tbody");
    tbody.innerHTML = "";
    const byPerson = new Map();
    orders.forEach((order) => {
      const key = order.person.trim();
      const entry = byPerson.get(key) || { name: key, count: 0, total: 0 };
      entry.count += order.lines.reduce((s, l) => s + l.qty, 0);
      entry.total += order.total;
      byPerson.set(key, entry);
    });
    [...byPerson.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .forEach((entry) => {
        tbody.appendChild(el("tr", {}, [
          el("td", { text: entry.name }),
          el("td", { text: String(entry.count) }),
          el("td", { text: formatKr(entry.total) }),
        ]));
      });
    if (byPerson.size === 0) {
      tbody.appendChild(el("tr", {}, [el("td", { colspan: "3", class: "muted", text: "Ingen bestillinger ennå." })]));
    }
  }

  function getAggregateRows() {
    const byLine = new Map();
    orders.forEach((order) => {
      order.lines.forEach((l) => {
        const key = `${l.itemId}:${l.sizeId}:${l.strength || ""}`;
        const entry = byLine.get(key) || {
          itemName: l.itemName,
          categoryName: l.categoryName,
          sizeLabel: l.sizeLabel,
          strength: l.strength,
          price: l.price,
          qty: 0,
        };
        entry.qty += l.qty;
        byLine.set(key, entry);
      });
    });
    return [...byLine.values()].sort((a, b) => {
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName, "nb");
      return a.itemName.localeCompare(b.itemName, "nb");
    });
  }

  function renderAggregate() {
    const tbody = document.querySelector("#aggregateTable tbody");
    tbody.innerHTML = "";
    const rows = getAggregateRows();
    let grand = 0;
    rows.forEach((row) => {
      const label = lineLabel(row);
      const sum = row.price * row.qty;
      grand += sum;
      tbody.appendChild(el("tr", {}, [
        el("td", { text: label }),
        el("td", { text: String(row.qty) }),
        el("td", { text: formatKr(row.price) }),
        el("td", { text: formatKr(sum) }),
      ]));
    });
    if (rows.length === 0) {
      tbody.appendChild(el("tr", {}, [el("td", { colspan: "4", class: "muted", text: "Ingen retter bestilt ennå." })]));
    }
    document.getElementById("grandTotal").textContent = formatKr(grand);
  }

  // ---------- Submit / update order ----------

  async function submitOrder() {
    const message = document.getElementById("cartMessage");
    message.textContent = "";
    const person = document.getElementById("personName").value.trim();
    const comment = document.getElementById("orderComment").value.trim();

    if (!person) {
      message.textContent = "Skriv inn navnet ditt.";
      return;
    }
    if (cart.length === 0) {
      message.textContent = "Legg til minst én rett fra menyen.";
      return;
    }

    const payload = {
      person,
      comment,
      lines: cart.map((l) => ({ itemId: l.itemId, sizeId: l.sizeId, qty: l.qty, strength: l.strength || null, notes: l.notes || "" })),
    };

    try {
      let order;
      if (editingOrderId) {
        const tokens = getTokens();
        order = await api(`/api/orders/${editingOrderId}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, token: tokens[editingOrderId] }),
        });
        showToast("Bestilling oppdatert");
      } else {
        order = await api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
        setToken(order.id, order.editToken);
        showToast("Bestilling sendt!");
      }
      localStorage.setItem(NAME_KEY, person);
      resetCartUI(true);
      await loadOrders();
    } catch (err) {
      message.textContent = err.message;
    }
  }

  // ---------- Summary ----------

  function buildAggregateText() {
    const rows = getAggregateRows();
    if (rows.length === 0) return "Ingen retter bestilt ennå.";
    let grand = 0;
    const lines = rows.map((row) => {
      const label = lineLabel(row);
      const sum = row.price * row.qty;
      grand += sum;
      return `${row.qty}x ${label} – ${formatKr(sum)}`;
    });
    lines.push("", `Totalt: ${formatKr(grand)}`);
    return lines.join("\n");
  }

  function buildInternalSummaryText() {
    const parts = ["SAMLET BESTILLING", buildAggregateText(), "", "PER PERSON"];
    const tbody = document.querySelectorAll("#personTotalsTable tbody tr");
    tbody.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length === 3) parts.push(`${cells[0].textContent}: ${cells[2].textContent}`);
    });
    return parts.join("\n");
  }

  async function closeRound() {
    if (orders.length === 0) {
      showToast("Ingen bestillinger å avslutte", true);
      return;
    }
    if (!confirm("Avslutte denne runden? Bestillingene arkiveres og listen tømmes for alle.")) return;
    try {
      const result = await api("/api/orders/close", { method: "POST" });
      result.archived.orders.forEach((o) => removeToken(o.id));
      showToast("Runde avsluttet og arkivert");
      resetCartUI(true);
      await loadOrders();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const ok = await requireAuth();
    if (!ok) return;

    document.getElementById("personName").value = localStorage.getItem(NAME_KEY) || "";
    document.getElementById("submitOrderBtn").addEventListener("click", submitOrder);
    document.getElementById("closeRoundBtn").addEventListener("click", closeRound);
    document.getElementById("copySummaryBtn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(buildInternalSummaryText());
      showToast("Oversikt kopiert");
    });

    try {
      menu = await api("/api/menu");
      renderMenu();
      await loadOrders();
    } catch (err) {
      showToast(err.message, true);
    }
  });
})();
