(function () {
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

  function buildSizeBlock(size) {
    const block = el("div", { class: "admin-size" });
    block.dataset.sizeId = size.id || uuid();
    const labelInput = el("input", { type: "text", class: "label", placeholder: "Størrelse", value: size.label || "" });
    const priceInput = el("input", { type: "number", class: "price", min: "0", step: "1", value: size.price ?? 0 });
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn-ghost btn-sm",
      text: "✕",
      title: "Fjern pris/størrelse",
      onclick: () => block.remove(),
    });
    block.append(labelInput, el("span", { class: "muted", text: "kr" }), priceInput, removeBtn);
    return block;
  }

  function buildItemBlock(item) {
    const block = el("div", { class: "admin-item" });
    block.dataset.itemId = item.id || uuid();

    const nameInput = el("input", { type: "text", class: "item-name-input", placeholder: "Navn på rett", value: item.name || "" });
    const descInput = el("input", { type: "text", class: "item-desc-input", placeholder: "Beskrivelse (valgfritt)", value: item.description || "" });
    const removeBtn = el("button", { type: "button", class: "btn btn-danger btn-sm", text: "Slett rett", onclick: () => block.remove() });

    const sizesContainer = el("div", { class: "admin-sizes" });
    (item.sizes && item.sizes.length ? item.sizes : [{ label: "", price: 0 }]).forEach((size) => {
      sizesContainer.appendChild(buildSizeBlock(size));
    });
    const addSizeBtn = el("button", {
      type: "button",
      class: "btn btn-ghost btn-sm",
      text: "+ Pris/størrelse",
      onclick: () => sizesContainer.insertBefore(buildSizeBlock({ label: "", price: 0 }), addSizeBtn),
    });
    sizesContainer.appendChild(addSizeBtn);

    const strengthCheckbox = el("input", { type: "checkbox", class: "item-strength-checkbox" });
    strengthCheckbox.checked = !!item.hasStrength;
    const strengthLabel = el("label", { class: "muted", style: "display:flex; align-items:center; gap:6px; margin-top:8px;" }, [
      strengthCheckbox,
      document.createTextNode("Kunden velger styrke (mild/medium/sterk)"),
    ]);

    block.append(
      el("div", { class: "admin-item-row" }, [nameInput, descInput, removeBtn]),
      sizesContainer,
      strengthLabel
    );
    return block;
  }

  function buildCategoryBlock(category) {
    const block = el("div", { class: "admin-category" });
    block.dataset.categoryId = category.id || uuid();

    const nameInput = el("input", { type: "text", placeholder: "Kategorinavn", value: category.name || "" });
    const noteInput = el("input", { type: "text", placeholder: "Notat (valgfritt)", value: category.note || "" });
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn-danger btn-sm",
      text: "Slett kategori",
      onclick: () => {
        if (confirm(`Slette kategorien "${nameInput.value || category.name}" med alle retter?`)) block.remove();
      },
    });

    const itemsContainer = el("div", { class: "items" });
    (category.items || []).forEach((item) => itemsContainer.appendChild(buildItemBlock(item)));

    const addItemBtn = el("button", {
      type: "button",
      class: "btn btn-secondary btn-sm",
      text: "+ Ny rett",
      onclick: () => itemsContainer.appendChild(buildItemBlock({ name: "", description: "", sizes: [{ label: "", price: 0 }] })),
    });

    block.append(
      el("div", { class: "admin-category-header" }, [nameInput, noteInput, removeBtn]),
      itemsContainer,
      addItemBtn
    );
    return block;
  }

  function renderMenu(menu) {
    const container = document.getElementById("categoriesContainer");
    container.innerHTML = "";
    menu.categories.forEach((category) => container.appendChild(buildCategoryBlock(category)));

    if (menu.updatedAt) {
      document.getElementById("updatedInfo").textContent =
        "Sist oppdatert: " + new Date(menu.updatedAt).toLocaleString("nb-NO");
    }
  }

  function collectMenu() {
    const categories = [];
    document.querySelectorAll("#categoriesContainer > .admin-category").forEach((catBlock) => {
      const [nameInput, noteInput] = catBlock.querySelectorAll(".admin-category-header input");
      const items = [];
      catBlock.querySelectorAll(".admin-item").forEach((itemBlock) => {
        const itemNameInput = itemBlock.querySelector(".item-name-input");
        const itemDescInput = itemBlock.querySelector(".item-desc-input");
        const sizes = [];
        itemBlock.querySelectorAll(".admin-size").forEach((sizeBlock) => {
          sizes.push({
            id: sizeBlock.dataset.sizeId,
            label: sizeBlock.querySelector(".label").value.trim(),
            price: Number(sizeBlock.querySelector(".price").value),
          });
        });
        items.push({
          id: itemBlock.dataset.itemId,
          name: itemNameInput.value.trim(),
          description: itemDescInput.value.trim(),
          sizes,
          hasStrength: itemBlock.querySelector(".item-strength-checkbox").checked,
        });
      });
      categories.push({
        id: catBlock.dataset.categoryId,
        name: nameInput.value.trim(),
        note: noteInput.value.trim(),
        items,
      });
    });
    return { categories };
  }

  async function saveMenu() {
    const message = document.getElementById("saveMessage");
    message.textContent = "";
    message.classList.remove("success");
    const payload = collectMenu();

    if (payload.categories.length === 0) {
      message.textContent = "Legg til minst én kategori.";
      return;
    }
    for (const category of payload.categories) {
      if (!category.name) {
        message.textContent = "Alle kategorier må ha et navn.";
        return;
      }
      for (const item of category.items) {
        if (!item.name) {
          message.textContent = `En rett i "${category.name}" mangler navn.`;
          return;
        }
        if (item.sizes.length === 0) {
          message.textContent = `"${item.name}" må ha minst én pris.`;
          return;
        }
        for (const size of item.sizes) {
          if (!Number.isFinite(size.price) || size.price < 0) {
            message.textContent = `Ugyldig pris for "${item.name}".`;
            return;
          }
        }
      }
    }

    try {
      const saveBtn = document.getElementById("saveMenuBtn");
      saveBtn.disabled = true;
      const menu = await api("/api/menu", { method: "PUT", body: JSON.stringify(payload) });
      document.getElementById("updatedInfo").textContent =
        "Sist oppdatert: " + new Date(menu.updatedAt).toLocaleString("nb-NO");
      message.textContent = "Menyen er lagret.";
      message.classList.add("success");
      showToast("Meny lagret");
    } catch (err) {
      message.textContent = err.message;
    } finally {
      document.getElementById("saveMenuBtn").disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const ok = await requireAuth();
    if (!ok) return;

    document.getElementById("addCategoryBtn").addEventListener("click", () => {
      document.getElementById("categoriesContainer").appendChild(
        buildCategoryBlock({ name: "", note: "", items: [] })
      );
    });
    document.getElementById("saveMenuBtn").addEventListener("click", saveMenu);

    try {
      const menu = await api("/api/menu");
      renderMenu(menu);
    } catch (err) {
      showToast(err.message, true);
    }
  });
})();
