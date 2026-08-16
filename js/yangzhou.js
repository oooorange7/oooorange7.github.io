(() => {
  const page = document.querySelector("[data-yangzhou-page]");
  if (!page) return;

  const source = page.querySelector("[data-yangzhou-source]");
  const intro = page.querySelector("[data-yangzhou-intro]");
  const tierList = page.querySelector("[data-tier-list]");
  const tabs = page.querySelector("[data-category-tabs]");
  const dialog = document.querySelector("[data-entry-dialog]");
  const palette = ["#ef695e", "#51a9df", "#f2a93b", "#77b36a", "#9c7ac7"];
  const tiers = [
    { id: "hang", label: "夯", color: "#ff563f" },
    { id: "top", label: "顶级", color: "#ff9d2e" },
    { id: "good", label: "人上人", color: "#ffd84d" },
    { id: "npc", label: "NPC", color: "#b9d76c" },
    { id: "bad", label: "拉", color: "#8cc9c3" },
    { id: "unrated", label: "待吃", color: "#ddd7cb" }
  ];

  const plain = (value) => (value || "").replace(/\s+/g, " ").trim();
  const tierOf = (rating) => {
    if (!rating || rating === "/") return "unrated";
    if (rating.includes("夯")) return "hang";
    if (rating.includes("顶级")) return "top";
    if (rating.includes("人上人")) return "good";
    if (/npc/i.test(rating)) return "npc";
    if (rating.includes("拉")) return "bad";
    return "unrated";
  };

  function previousHeading(node, tag) {
    let current = node.previousElementSibling;
    while (current) {
      if (current.tagName === tag) return plain(current.textContent);
      current = current.previousElementSibling;
    }
    return "";
  }

  function renderIntroduction() {
    for (const node of source.children) {
      if (node.tagName === "H1") break;
      intro.appendChild(node.cloneNode(true));
    }
  }

  function readHeadingEntries() {
    const entries = [];
    let category = "其他";
    [...source.children].forEach((node, index, nodes) => {
      if (node.tagName === "H1") {
        category = plain(node.textContent);
        return;
      }
      if (node.tagName !== "H3") return;

      const name = plain(node.textContent);
      const details = [];
      let rating = "";
      for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
        const next = nodes[cursor];
        if (["H1", "H2", "H3"].includes(next.tagName)) break;
        const label = plain(next.textContent);
        if (next.tagName === "H4" && /^(评级|评)\s*[：:]/.test(label)) {
          rating = label.replace(/^(评级|评)\s*[：:]\s*/, "");
          continue;
        }
        details.push(next.cloneNode(true));
      }
      if (!rating) return;

      const wrapper = document.createElement("div");
      details.forEach((detail) => wrapper.appendChild(detail));
      const image = wrapper.querySelector("img");
      entries.push({
        name,
        category,
        rating,
        tier: tierOf(rating),
        image: image ? image.currentSrc || image.src : "",
        detailHTML: wrapper.innerHTML || "<p>详情待补充。</p>"
      });
    });
    return entries;
  }

  function readTableEntries() {
    const entries = [];
    source.querySelectorAll("table").forEach((table) => {
      const category = previousHeading(table, "H1") || "其他";
      const group = previousHeading(table, "H2");
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = [...row.cells].map((cell) => cell.innerHTML.trim());
        const name = plain(row.cells[0]?.textContent);
        if (!name) return;
        const rating = plain(row.cells[1]?.textContent);
        const notes = [];
        if (cells[2]) notes.push(`<p>${cells[2]}</p>`);
        if (cells[3]) notes.push(`<p><strong>备注：</strong>${cells[3]}</p>`);
        if (cells[4]) notes.push(`<p><strong>总店：</strong>${cells[4]}</p>`);
        entries.push({
          name,
          category,
          group,
          rating,
          tier: tierOf(rating),
          image: "",
          detailHTML: notes.join("") || "<p>详情待补充。</p>"
        });
      });
    });
    return entries;
  }

  const entries = [...readHeadingEntries(), ...readTableEntries()];
  let activeCategory = "全部";
  document.querySelector("[data-entry-count]").textContent = entries.length;

  const categories = ["全部", ...new Set(entries.map((entry) => entry.category))];
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.className = category === activeCategory ? "is-active" : "";
    button.addEventListener("click", () => {
      activeCategory = category;
      [...tabs.children].forEach((tab) => tab.classList.toggle("is-active", tab === button));
      render();
    });
    tabs.appendChild(button);
  });

  function cardFor(entry, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "yz-card";
    card.setAttribute("aria-label", `查看${entry.name}的评价详情`);
    const color = palette[index % palette.length];
    const cover = document.createElement("span");
    cover.className = "yz-card-cover";
    cover.dataset.initial = entry.name.slice(0, 1);
    cover.style.setProperty("--card-color", color);
    if (entry.image) cover.style.backgroundImage = `url("${entry.image.replace(/"/g, "%22")}")`;
    const copy = document.createElement("span");
    copy.className = "yz-card-copy";
    copy.innerHTML = `<strong>${entry.name}</strong><small>${entry.rating || "待评价"}</small>`;
    card.append(cover, copy);
    card.addEventListener("click", () => openDialog(entry, color));
    return card;
  }

  function render() {
    tierList.replaceChildren();
    const filtered = entries.filter((entry) =>
      activeCategory === "全部" || entry.category === activeCategory
    );
    tiers.forEach((tier) => {
      const row = document.createElement("section");
      row.className = "yz-tier-row";
      row.style.setProperty("--tier-color", tier.color);
      const title = document.createElement("h2");
      title.className = "yz-tier-name";
      title.textContent = tier.label;
      const cards = document.createElement("div");
      cards.className = "yz-tier-cards";
      const tierEntries = filtered.filter((entry) => entry.tier === tier.id);
      if (tierEntries.length) {
        tierEntries.forEach((entry, index) => cards.appendChild(cardFor(entry, index)));
      } else {
        cards.innerHTML = '<p class="yz-empty">这里还空着，等主包去吃。</p>';
      }
      row.append(title, cards);
      tierList.appendChild(row);
    });
  }

  function openDialog(entry, color) {
    dialog.querySelector("[data-dialog-title]").textContent = entry.name;
    dialog.querySelector("[data-dialog-meta]").textContent =
      `${entry.category}${entry.group ? ` · ${entry.group}` : ""} / ${entry.rating || "待评价"}`;
    dialog.querySelector("[data-dialog-content]").innerHTML = entry.detailHTML;
    const cover = dialog.querySelector("[data-dialog-cover]");
    cover.style.setProperty("--card-color", color);
    cover.style.backgroundImage = entry.image
      ? `url("${entry.image.replace(/"/g, "%22")}")`
      : "";
    dialog.showModal();
  }

  document.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  page.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      page.querySelectorAll("[data-view]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      page.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== view;
      });
      try {
        localStorage.setItem("yangzhou-view", view);
      } catch (_) {}
    });
  });

  try {
    const savedView = localStorage.getItem("yangzhou-view");
    if (savedView === "markdown") {
      page.querySelector('[data-view="markdown"]').click();
    }
  } catch (_) {}

  renderIntroduction();
  render();
})();
