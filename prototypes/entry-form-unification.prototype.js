/*
 * THROWAWAY: three unified layouts on entry-view-modes.html?study=unified&variant=A/B/C.
 * Question: can logging, footer-free inline editing, and Food views feel like one record?
 * Synthetic fixtures only. "Saved" means committed in memory, never a real data mutation.
 */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("study") !== "unified") return;

  const layouts = [
    {
      key: "A",
      name: "Snapshot grid",
      description: "The existing compact snapshot, made writable.",
    },
    {
      key: "B",
      name: "Ruled ledger",
      description: "One field per line; labels and values share a quiet rule.",
    },
    {
      key: "C",
      name: "Focused record",
      description:
        "Primary details first; secondary details in expandable groups.",
    },
  ];
  const allergens = [
    "Milk",
    "Egg",
    "Peanut",
    "Tree nuts",
    "Soy",
    "Wheat",
    "Fish",
    "Shellfish",
    "Sesame",
  ];
  const textures = ["Purée", "Mashed", "Soft finger food", "Firm finger food"];
  const foods = ["Avocado", "Banana", "Egg", "Tahini", "Sesame", "Yogurt"];
  const field = (
    key,
    label,
    type,
    value,
    options = [],
    unit = "",
    required = false
  ) => ({ key, label, type, value, options, unit, required });
  const fixtures = {
    feed: {
      label: "Feed",
      verb: "feed",
      fields: [
        field("side", "Side", "choice", "Left", [
          "Not recorded",
          "Left",
          "Right",
        ]),
        field("duration", "Duration", "number", "18", [], "min"),
      ],
    },
    diaper_change: {
      label: "Diaper Change",
      verb: "diaper change",
      fields: [
        field(
          "change",
          "Change",
          "choice",
          "Wet",
          ["Wet", "Dirty", "Both"],
          "",
          true
        ),
        field("note", "Note", "note", ""),
      ],
    },
    sleep_session: {
      label: "Sleep Session",
      verb: "sleep",
      fields: [
        field("duration", "Duration", "derived", ""),
        field(
          "quality",
          "Quality",
          "choice",
          "Great",
          ["Poor", "Okay", "Great"],
          "",
          true
        ),
        field(
          "factors",
          "Factors",
          "multi",
          [],
          ["Many wakeups", "Illness", "Fussiness/cries", "Long awake time"]
        ),
      ],
    },
    meal: {
      label: "Meal",
      verb: "meal",
      fields: [
        field("name", "Meal name", "text", "Breakfast"),
        field(
          "amount",
          "Amount eaten",
          "choice",
          "4",
          ["1", "2", "3", "4", "5"],
          "of 5",
          true
        ),
        field(
          "categories",
          "Food categories",
          "multi",
          ["Grains & cereals", "Fruit"],
          [
            "Fruit",
            "Vegetables",
            "Grains & cereals",
            "Proteins",
            "Dairy",
            "Nuts & seeds",
            "Fish & shellfish",
            "Compound",
          ]
        ),
        field("allergens", "Allergens", "multi", ["Wheat"], allergens),
        field("textures", "Texture", "multi", ["Mashed"], textures),
        field(
          "styles",
          "Feeding style",
          "multi",
          ["Spoon-fed"],
          ["Spoon-fed", "Self-fed with hands", "Self-fed with utensils"]
        ),
        field("note", "Note", "note", ""),
      ],
    },
    introduction: {
      label: "Introduction",
      verb: "introduction",
      fields: [
        field("food", "Food", "choice", "Tahini", foods, "", true),
        field("texture", "Texture", "choice", "Mashed", [
          "Not recorded",
          ...textures,
        ]),
        field("note", "Note", "note", ""),
      ],
    },
    medical: {
      label: "Medical Entry",
      verb: "medical entry",
      fields: [],
    },
    reaction: {
      label: "Reaction",
      verb: "reaction",
      fields: [
        field(
          "foods",
          "Suspected foods",
          "multi",
          ["Tahini", "Sesame"],
          foods,
          "",
          true
        ),
        field(
          "severity",
          "Severity",
          "choice",
          "Moderate",
          ["Mild", "Moderate", "Severe"],
          "",
          true
        ),
        field(
          "symptoms",
          "Symptoms",
          "multi",
          ["Rash/hives"],
          ["Rash/hives", "Vomiting", "Diarrhea", "Swelling", "Breathing issues"]
        ),
        field("note", "Note", "note", ""),
      ],
    },
    growth: {
      label: "Growth Measurement",
      verb: "measurement",
      fields: [
        field("weight", "Weight", "number", "6.42", [], "kg"),
        field("height", "Height", "number", "62.1", [], "cm"),
        field("head", "Head circumference", "number", "", [], "cm"),
      ],
    },
  };
  const medicalFields = {
    medication: [
      field(
        "type",
        "Type",
        "choice",
        "Medication",
        ["Medication", "Vaccine", "Symptom", "Temperature"],
        "",
        true
      ),
      field("name", "Name", "text", "Vitamin D", [], "", true),
      field("dose", "Dose", "text", "400 IU"),
      field("note", "Note", "note", ""),
    ],
    vaccine: [
      field(
        "type",
        "Type",
        "choice",
        "Vaccine",
        ["Medication", "Vaccine", "Symptom", "Temperature"],
        "",
        true
      ),
      field("name", "Name", "text", "DTaP", [], "", true),
      field("note", "Note", "note", "First dose"),
    ],
    symptom: [
      field(
        "type",
        "Type",
        "choice",
        "Symptom",
        ["Medication", "Vaccine", "Symptom", "Temperature"],
        "",
        true
      ),
      field("description", "Description", "text", "Congestion", [], "", true),
      field("note", "Note", "note", ""),
    ],
    temperature: [
      field(
        "type",
        "Type",
        "choice",
        "Temperature",
        ["Medication", "Vaccine", "Symptom", "Temperature"],
        "",
        true
      ),
      field("temperature", "Temperature", "number", "38.1", [], "°C", true),
      field("unit", "Unit", "choice", "°C", ["°C", "°F"], "", true),
      field("note", "Note", "note", ""),
    ],
  };
  const defaultTimes = {
    when: "2026-11-04T08:05",
    start: "2026-11-03T23:18",
    end: "2026-11-04T06:42",
  };
  const state = {
    variant: layouts.some((layout) => layout.key === params.get("variant"))
      ? params.get("variant")
      : "A",
    kind: Object.hasOwn(fixtures, params.get("entry"))
      ? params.get("entry")
      : "meal",
    medical: Object.hasOwn(medicalFields, params.get("medical"))
      ? params.get("medical")
      : "medication",
    theme: params.get("theme") === "night" ? "night" : "day",
    foodStatus: ["untried", "trying", "safe", "avoid"].includes(
      params.get("status")
    )
      ? params.get("status")
      : "trying",
    foodIntroductions: params.get("status") === "untried" ? 0 : 2,
    manualSafe: false,
    draft: {},
    saved: {},
    activeField: null,
    pending: null,
    lastAction: "Ready. All values are fictional fixtures.",
  };
  const drafts = new Map();
  const records = new Map();
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]
    );
  const $ = (selector, root = document) => root.querySelector(selector);
  const kindKey = () =>
    state.kind === "medical" ? `medical:${state.medical}` : state.kind;
  const currentFixture = () =>
    state.kind === "medical"
      ? { ...fixtures.medical, fields: medicalFields[state.medical] }
      : fixtures[state.kind];
  function newRecord() {
    return {
      ...Object.fromEntries(
        currentFixture().fields.map((item) => [
          item.key,
          structuredClone(item.value),
        ])
      ),
      ...defaultTimes,
    };
  }
  function loadRecords() {
    const key = kindKey();
    if (!drafts.has(key)) drafts.set(key, newRecord());
    if (!records.has(key)) records.set(key, newRecord());
    state.draft = drafts.get(key);
    state.saved = records.get(key);
  }
  function duration(record) {
    const minutes = Math.round(
      (new Date(record.end) - new Date(record.start)) / 60000
    );
    if (!Number.isFinite(minutes) || minutes <= 0) return "Set start & end";
    return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  }
  function summary(record) {
    switch (state.kind) {
      case "feed":
        return `Breastfeeding${record.duration ? ` · ${record.duration} min` : ""}`;
      case "diaper_change":
        return `${record.change || "New"} diaper`;
      case "sleep_session":
        return `Sleep · ${duration(record)}`;
      case "meal":
        return `${record.name || "Meal"} · ${record.amount || "–"} of 5`;
      case "introduction":
        return record.food || "A new food";
      case "reaction":
        return `${record.severity || "New"} reaction`;
      case "growth":
        return (
          [
            record.weight && `${record.weight} kg`,
            record.height && `${record.height} cm`,
          ]
            .filter(Boolean)
            .join(" · ") || "Growth measurement"
        );
      case "medical":
        return record.type === "Temperature"
          ? `${record.temperature || "–"} ${record.unit}`
          : record.name || record.description || "Medical entry";
    }
  }
  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? "Choose date & time"
      : date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  }
  function valueMarkup(item, record) {
    const value = item.type === "derived" ? duration(record) : record[item.key];
    if (Array.isArray(value))
      return value.length
        ? `<span class="pill-list">${value.map((item) => `<span class="pill">${esc(item)}</span>`).join("")}</span>`
        : '<span class="missing">None recorded</span>';
    if (!value || value === "Not recorded")
      return '<span class="missing">Not recorded</span>';
    const unit = item.key === "temperature" ? record.unit : item.unit;
    return `${esc(value)}${unit ? ` <span>${esc(unit)}</span>` : ""}`;
  }
  function inputMarkup(item, record, mode) {
    const value = record[item.key];
    if (item.type === "derived")
      return `<span class="field-value" data-duration="${mode}">${duration(record)}</span>`;
    if (item.type === "choice" || item.type === "multi") {
      return `<div class="choice-list" role="group" aria-label="${esc(item.label)}">${item.options
        .map((option) => {
          const selected = Array.isArray(value)
            ? value.includes(option)
            : value === option || (!value && option === "Not recorded");
          return `<button type="button" class="choice" data-mode="${mode}" data-choice="${esc(item.key)}" data-value="${esc(option)}" aria-pressed="${selected}">${esc(option)}</button>`;
        })
        .join("")}</div>`;
    }
    const id = `${mode}-${item.key}`;
    if (item.type === "note")
      return `<textarea id="${id}" data-mode="${mode}" data-input="${item.key}" aria-label="${esc(item.label)}" placeholder="Add a note (optional)" rows="2">${esc(value)}</textarea>`;
    return `<div class="unit-input"><input id="${id}" data-mode="${mode}" data-input="${item.key}" aria-label="${esc(item.label)}" type="${item.type === "number" ? "number" : "text"}" ${item.type === "number" ? 'min="0.01" step="any" inputmode="decimal"' : ""} value="${esc(value)}" placeholder="${item.required ? esc(item.label) : "Not recorded"}" ${item.required ? "required" : ""}>${item.unit ? `<span>${esc(item.key === "temperature" ? record.unit : item.unit)}</span>` : ""}</div>`;
  }
  function cellMarkup(item, mode) {
    const wide = [
      "note",
      "factors",
      "categories",
      "allergens",
      "textures",
      "styles",
      "foods",
      "symptoms",
    ].includes(item.key);
    const label = `<span class="field-label">${esc(item.label)}${mode === "draft" && item.required ? " · required" : ""}</span>`;
    return `<div class="detail-cell${wide ? " wide" : ""}" data-cell="${mode}-${item.key}">
      ${
        mode === "draft"
          ? `<div class="cell-content">${label}${inputMarkup(item, state.draft, mode)}</div>`
          : item.type === "derived"
            ? `<div class="cell-content">${label}<span class="field-value">${valueMarkup(item, state.saved)}</span></div>`
            : `<button type="button" class="field-display" data-edit="${item.key}" aria-label="${esc(item.label)}: ${esc(Array.isArray(state.saved[item.key]) ? state.saved[item.key].join(", ") || "None recorded" : state.saved[item.key] || "Not recorded")}. Edit inline">${label}<span class="field-value">${valueMarkup(item, state.saved)}</span></button>`
      }
    </div>`;
  }
  function fieldsMarkup(mode) {
    const fields = currentFixture().fields;
    if (state.variant !== "C")
      return `<div class="detail-grid">${fields.map((item) => cellMarkup(item, mode)).join("")}</div>`;
    const primary = fields.filter(
      (item) =>
        ![
          "note",
          "factors",
          "allergens",
          "textures",
          "styles",
          "head",
          "dose",
        ].includes(item.key)
    );
    const secondary = fields.filter((item) => !primary.includes(item));
    return `<div class="detail-grid">${primary.map((item) => cellMarkup(item, mode)).join("")}</div>
      ${secondary.length ? `<details class="detail-fold" ${mode === "draft" ? "open" : ""}><summary>More details <span>${secondary.length} fields</span></summary><div class="detail-grid">${secondary.map((item) => cellMarkup(item, mode)).join("")}</div></details>` : ""}`;
  }
  function timeInputs(record, key, mode) {
    const [date, time] = record[key].split("T");
    return `<div class="date-inputs">
      <label><span class="field-label">Date</span><input type="date" data-time="${key}" data-part="date" data-mode="${mode}" aria-label="${key} date" value="${date}"></label>
      <label><span class="field-label">Time</span><input type="time" data-time="${key}" data-part="time" data-mode="${mode}" aria-label="${key} time" value="${time}"></label>
    </div>`;
  }
  function timestampsMarkup() {
    const times =
      state.kind === "sleep_session"
        ? [
            ["start", "Fell asleep"],
            ["end", "Woke up"],
          ]
        : [["when", "When"]];
    return `<div class="timestamp-block">${times
      .map(
        ([key, label]) => `<div class="time-row">
      <span><span class="time-label">${label}</span><span class="time-value" data-time-value="${key}">${formatTime(state.draft[key])}</span></span>
      <button class="text-action" type="button" data-expand-time="${key}" aria-expanded="false">Change</button>
    </div><div data-time-editor="${key}" hidden>${timeInputs(state.draft, key, "draft")}</div>`
      )
      .join("")}</div>`;
  }
  function contextMarkup() {
    if (state.kind === "introduction")
      return '<p class="context-note">Contains sesame. Allergen tags are informational. Food Status comes from Introductions and Reactions, not Meals.</p>';
    if (state.kind === "reaction")
      return '<p class="context-note">Record what you observed, not a diagnosis. Seek urgent care for severe symptoms.</p>';
    return "";
  }
  function loggingMarkup() {
    const fixture = currentFixture();
    return `<div class="nav"><button type="button" data-demo-back>← Home</button><span class="nav-status">New Entry</span></div>
      ${["meal", "introduction"].includes(state.kind) ? `<div class="food-tabs" aria-label="Food logging"><button type="button" data-kind="meal" aria-pressed="${state.kind === "meal"}">Meal</button><button type="button" data-kind="introduction" aria-pressed="${state.kind === "introduction"}">Introduction</button></div>` : ""}
      <header class="hero"><div class="hero-meta">${fixture.label}</div><h2>Log ${fixture.verb === "sleep" ? "sleep" : `a${fixture.verb === "introduction" ? "n" : ""} ${fixture.verb}`}</h2><p class="hero-subtitle">A little moment, kept.</p></header>
      <form class="body-content" id="logging-form" novalidate>
        <div class="section-heading"><h3>Entry details</h3><span>Optional unless marked</span></div>
        ${fieldsMarkup("draft")}${contextMarkup()}
        <p class="form-error" id="logging-error" role="alert" hidden></p>
        ${timestampsMarkup()}
        <div class="actions"><button type="submit" class="primary-action">Save ${fixture.verb}</button></div>
      </form>`;
  }
  function editingMarkup() {
    const fixture = currentFixture();
    return `<div class="nav"><button type="button" data-demo-back>← Ledger</button><span class="nav-status" id="save-status" role="status"><span class="saved-dot"></span>Saved</span></div>
      <header class="hero"><div class="hero-meta">${fixture.label}</div><h2 id="entry-summary">${esc(summary(state.saved))}</h2>
        <button type="button" class="hero-time" data-edit="timestamp" aria-label="Edit recorded time">${formatTime(state.saved[state.kind === "sleep_session" ? "end" : "when"])}${state.kind === "sleep_session" ? " · Woke up" : ""}<small>America/Los_Angeles · recorded timezone</small></button>
        <div id="timestamp-inline"></div>
      </header>
      <section class="body-content">
        <div class="section-heading"><h3>Recorded details</h3><span>Tap any field</span></div>
        ${fieldsMarkup("saved")}
        <p class="edit-hint">Choose to update. Text saves when you leave the field.<br>No separate edit screen. No Save / Cancel footer.</p>
        ${contextMarkup()}
        ${state.kind === "introduction" ? '<div class="actions"><button type="button" class="secondary-action" data-also-meal>Also log a meal</button></div>' : ""}
        <div class="food-reset"><small>Recorded Entry</small><button class="text-action" type="button" data-delete-entry>Delete Entry</button></div>
      </section>`;
  }
  function foodMarkup() {
    const status = state.foodStatus;
    const descriptions = {
      untried: "No Introductions recorded yet.",
      trying: "Watching until Nov 9 · 1:15 PM.",
      safe: state.manualSafe
        ? "Marked safe manually."
        : "Watch Period ended without a Reaction.",
      avoid: "Avoid for now. Log an Introduction to re-challenge.",
    };
    const count = state.foodIntroductions;
    const detail = (label, value, wide = false) =>
      `<div class="detail-cell${wide ? " wide" : ""}"><div class="cell-content"><span class="field-label">${label}</span><span class="field-value">${value}</span></div></div>`;
    const mainFields = [
      detail(
        "Food Status",
        `<span class="status-pill" data-status="${status}">${status[0].toUpperCase() + status.slice(1)}</span>`
      ),
      detail("Introductions", String(count)),
      detail("Category", "Nuts & seeds"),
      detail("Allergen tags", '<span class="pill">Sesame</span>'),
    ];
    return `<div class="nav"><button type="button" data-demo-back>← Foods</button><span class="nav-status">Food profile</span></div>
      <header class="hero"><div class="hero-meta">Food <span class="status-pill" data-status="${status}">${status[0].toUpperCase() + status.slice(1)}</span></div><h2>Tahini</h2><p class="hero-subtitle">${descriptions[status]}</p></header>
      <section class="body-content">
        <div class="section-heading"><h3>Food details</h3><span>Catalogue Food · read-only</span></div>
        <div class="detail-grid">${mainFields.join("")}</div>
        <p class="context-note">Status is specific to this Child. Meals don't count as exposure. Allergen tags are informational.</p>
        <div class="actions">
          <button class="primary-action" type="button" data-mark-safe ${["safe", "avoid"].includes(status) ? "disabled" : ""}>${status === "safe" ? "Marked safe" : "Mark safe"}</button>
          ${status === "avoid" ? '<p class="edit-hint">Cannot mark safe while in avoid. Re-challenge with an Introduction.</p>' : ""}
          <div class="action-pair"><button class="secondary-action" type="button" data-log-food="introduction">Log Introduction</button><button class="secondary-action danger-action" type="button" data-log-food="reaction">Log Reaction</button></div>
        </div>
        ${state.variant === "C" ? '<details class="detail-fold" open><summary>Introduction history</summary>' : '<div class="section-heading"><h3>Introduction history</h3></div>'}
        <div class="food-history">${count ? `<button class="history-row" type="button" data-history><span>Nov 6 · 1:15 PM<small>Mashed · Introduction</small></span><span aria-hidden="true">↗</span></button><button class="history-row" type="button" data-history><span>Nov 5 · 1:15 PM<small>First Introduction · No texture recorded</small></span><span aria-hidden="true">↗</span></button>` : '<p class="edit-hint">No Introduction history yet.</p>'}</div>
        ${state.variant === "C" ? "</details>" : ""}
        <div class="food-reset"><small>${status === "untried" ? "Nothing to reset" : "Start fresh for this Food"}</small><button class="text-action" type="button" data-reset-food ${status === "untried" ? "disabled" : ""}>Reset status</button></div>
      </section>`;
  }
  document.body.classList.add("unified-study");
  document.title = "Keepsake · One record, one visual language (prototype)";
  document.body.innerHTML = `<main class="stage">
    <header class="intro"><div class="eyebrow">Keepsake / Throwaway design study</div><h1>One record. <em>One visual language.</em></h1><p>The compact Entry view becomes the starting point for logging, in-place corrections, and Food profiles. Compare three structures in the same warm, ruled Keepsake language. Everything here is an in-memory demo, not the live app.</p></header>
    <div class="toolbar">
      <label class="control"><span class="label">Entry kind</span><select id="entry-select" aria-label="Choose Entry kind">${Object.entries(
        fixtures
      )
        .map(([key, entry]) => `<option value="${key}">${entry.label}</option>`)
        .join("")}</select></label>
      <label class="control" id="medical-control" hidden><span class="label">Medical type</span><select id="medical-select" aria-label="Choose Medical type">${Object.keys(
        medicalFields
      )
        .map(
          (key) =>
            `<option value="${key}">${key[0].toUpperCase() + key.slice(1)}</option>`
        )
        .join("")}</select></label>
      <label class="control"><span class="label">Food Status</span><select id="status-select" aria-label="Choose Food Status">${["untried", "trying", "safe", "avoid"].map((status) => `<option value="${status}">${status[0].toUpperCase() + status.slice(1)}</option>`).join("")}</select></label>
      <button class="theme-toggle" id="theme-toggle" type="button">Night mode</button><button class="theme-toggle" id="reset-demo" type="button">Reset demo</button><span class="prototype-note" id="layout-description"></span>
    </div>
    <div class="workspace">
      <section aria-label="Logging form design"><div class="panel-caption"><h2><span class="panel-number">01</span>Logging form</h2><span class="caption-meta">Create a record</span></div><div class="surface" id="logging-surface"></div></section>
      <section aria-label="Inline edit design"><div class="panel-caption"><h2><span class="panel-number">02</span>View + inline edit</h2><span class="caption-meta">Tap to correct</span></div><div class="surface" id="editing-surface"></div></section>
      <section aria-label="Food view design"><div class="panel-caption"><h2><span class="panel-number">03</span>Food view</h2><span class="caption-meta">The same record language</span></div><div class="surface" id="food-surface"></div></section>
    </div>
    <p class="toast" id="demo-feedback" role="status"></p>
    <div class="design-notes">
      <p><strong>Logging feels like a new record.</strong> The same labels, rules, and surfaces; writable values instead of a separate form style. “When” stays immediately above the create action.</p>
      <p><strong>Editing never leaves the record.</strong> Discrete choices commit on selection. Text and grouped times commit on leaving the field. Invalid values stay open with an explanation; valid changes can be corrected again.</p>
      <p><strong>Foods belong to the same family.</strong> A left-aligned serif title, quiet status context, recorded-detail structure, and ruled history. Tracking actions stay separate from catalogue data.</p>
    </div>
    <details class="state-inspector"><summary>Prototype state / no persistence</summary><pre id="prototype-state"></pre></details>
    <a class="original-link" href="./entry-view-modes.html?variant=C">← Original Entry view study (compact snapshot)</a>
  </main>
  <nav class="switcher" aria-label="Unified layout comparison"><button id="previous" type="button" aria-label="Previous layout">‹</button><span class="switch-label" id="switch-label"></span><button id="next" type="button" aria-label="Next layout">›</button></nav>
  <dialog id="confirmation" aria-labelledby="confirmation-title"><h2 id="confirmation-title"></h2><p id="confirmation-copy"></p><div class="action-pair"><button class="secondary-action" id="confirmation-keep" type="button"></button><button class="primary-action" id="confirmation-accept" type="button"></button></div></dialog>`;

  function updateUrl() {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({
      study: "unified",
      variant: state.variant,
      entry: state.kind,
      medical: state.medical,
      theme: state.theme,
      status: state.foodStatus,
    }))
      url.searchParams.set(key, value);
    history.replaceState(null, "", url);
  }
  function inspect(action) {
    if (action) state.lastAction = action;
    $("#prototype-state").textContent = JSON.stringify(
      {
        variant: state.variant,
        entry: state.kind,
        medical: state.kind === "medical" ? state.medical : null,
        theme: state.theme,
        activeField: state.activeField,
        pending: state.pending,
        draft: state.draft,
        saved: state.saved,
        food: {
          name: "Tahini",
          status: state.foodStatus,
          introductions: state.foodIntroductions,
          manualSafe: state.manualSafe,
        },
        lastAction: state.lastAction,
        persistence: "None. Reload discards all changes.",
      },
      null,
      2
    );
  }
  function announce(message) {
    $("#demo-feedback").textContent = message;
    inspect(message);
  }
  function render() {
    state.activeField = null;
    state.pending = null;
    const layout = layouts.find((item) => item.key === state.variant);
    document.body.dataset.variant = state.variant;
    document.body.dataset.theme = state.theme;
    $("#entry-select").value = state.kind;
    $("#medical-select").value = state.medical;
    $("#medical-control").hidden = state.kind !== "medical";
    $("#status-select").value = state.foodStatus;
    $("#theme-toggle").textContent =
      state.theme === "day" ? "Night mode" : "Day mode";
    $("#switch-label").innerHTML =
      `<strong>${layout.key}</strong> · ${layout.name}`;
    $("#layout-description").textContent = layout.description;
    $("#logging-surface").innerHTML = loggingMarkup();
    $("#editing-surface").innerHTML = editingMarkup();
    $("#food-surface").innerHTML = foodMarkup();
    bindSurfaces();
    updateUrl();
    inspect();
  }
  function validate(item, value) {
    if (
      item.required &&
      (Array.isArray(value) ? !value.length : !String(value).trim())
    )
      return `${item.label} is required.`;
    if (
      item.type === "number" &&
      value &&
      (!Number.isFinite(Number(value)) || Number(value) <= 0)
    )
      return `Enter a positive number for ${item.label.toLowerCase()}.`;
    return "";
  }
  function validateTimes(record) {
    const keys = state.kind === "sleep_session" ? ["start", "end"] : ["when"];
    for (const key of keys) {
      if (!record[key] || Number.isNaN(new Date(record[key]).valueOf()))
        return "Choose a valid date and time.";
      if (record[key] > "2026-11-07T04:26")
        return "Future times aren't supported in this demo.";
    }
    if (state.kind === "sleep_session" && record.end <= record.start)
      return "Woke up must be later than Fell asleep.";
    return "";
  }
  function saveStatus(message = "Saved just now") {
    $("#save-status").innerHTML =
      `<span class="saved-dot"></span>${esc(message)}`;
    $("#entry-summary").textContent = summary(state.saved);
  }
  function changeMedical(value, mode) {
    const previous = state[mode];
    if (mode === "draft") drafts.set(kindKey(), previous);
    else records.set(kindKey(), previous);
    state.medical = value.toLowerCase();
    loadRecords();
    state[mode].type = value;
    render();
  }
  function applyChoice(item, value, mode) {
    const record = state[mode];
    record[item.key] =
      item.type === "multi"
        ? record[item.key].includes(value)
          ? record[item.key].filter((choice) => choice !== value)
          : [...record[item.key], value]
        : value === "Not recorded"
          ? ""
          : value;
    if (item.key === "unit") {
      const temperature = Number(record.temperature);
      if (record.temperature && Number.isFinite(temperature))
        record.temperature = String(
          Math.round(
            (value === "°F"
              ? (temperature * 9) / 5 + 32
              : ((temperature - 32) * 5) / 9) * 10
          ) / 10
        );
    }
    if (item.key === "type") return changeMedical(value, mode);
    if (mode === "saved") saveStatus();
    inspect(
      `${item.label} ${mode === "saved" ? "committed in memory" : "draft changed"}.`
    );
  }
  function openEditor(key) {
    const panel = $("#editing-surface");
    const previous = panel.querySelector(".editor");
    if (previous && !previous.commit()) return;
    state.activeField = key;
    const item = currentFixture().fields.find((item) => item.key === key);
    const cell =
      key === "timestamp"
        ? $("#timestamp-inline")
        : $(`[data-cell="saved-${key}"]`, panel);
    const oldMarkup = cell.innerHTML;
    const pending = structuredClone(state.saved);
    state.pending = pending;
    cell.classList.add("is-editing");
    cell.innerHTML = `<div class="editor">
      <span class="field-label">${key === "timestamp" ? "Recorded time" : esc(item.label)}</span>
      ${key === "timestamp" ? (state.kind === "sleep_session" ? ["start", "end"] : ["when"]).map((timeKey) => `<div><span class="time-label">${timeKey === "start" ? "Fell asleep" : timeKey === "end" ? "Woke up" : "When"}</span>${timeInputs(pending, timeKey, "saved")}</div>`).join("") : inputMarkup(item, pending, "saved")}
      <p class="editor-help">${key === "timestamp" ? "Date and time update together when you leave. Recorded timezone stays unchanged." : item.type === "multi" ? "Each selection updates immediately. Tap another field to continue." : item.type === "choice" ? "Choose a value to update immediately." : "Saves when you leave this field. Press Enter for single-line text."}</p>
      <p class="field-error" role="alert" hidden></p>
    </div>`;
    const editor = $(".editor", cell);
    function close() {
      cell.classList.remove("is-editing");
      cell.innerHTML = oldMarkup;
      if (item) {
        $(".field-value", cell).innerHTML = valueMarkup(item, state.saved);
        const button = $("[data-edit]", cell);
        button.setAttribute(
          "aria-label",
          `${item.label}: ${Array.isArray(state.saved[key]) ? state.saved[key].join(", ") || "None recorded" : state.saved[key] || "Not recorded"}. Edit inline`
        );
        button.onclick = () => openEditor(key);
      } else {
        $(".hero-time", panel).innerHTML =
          `${formatTime(state.saved[state.kind === "sleep_session" ? "end" : "when"])}${state.kind === "sleep_session" ? " · Woke up" : ""}<small>America/Los_Angeles · recorded timezone</small>`;
        const durationCell = $(
          '[data-cell="saved-duration"] .field-value',
          panel
        );
        if (state.kind === "sleep_session" && durationCell)
          durationCell.textContent = duration(state.saved);
      }
      state.activeField = null;
      state.pending = null;
      if (item?.key === "unit") {
        $('[data-cell="saved-temperature"] .field-value', panel).innerHTML =
          valueMarkup(
            currentFixture().fields.find(
              (field) => field.key === "temperature"
            ),
            state.saved
          );
      }
      inspect();
    }
    editor.commit = () => {
      const error =
        key === "timestamp"
          ? validateTimes(pending)
          : validate(item, pending[key]) ||
            (state.kind === "growth" &&
            ![pending.weight, pending.height, pending.head].some(Boolean)
              ? "Keep at least one measurement recorded."
              : "");
      if (error) {
        const message = $(".field-error", editor);
        message.hidden = false;
        message.textContent = error;
        saveStatus("Not saved");
        inspect(error);
        return false;
      }
      Object.assign(state.saved, pending);
      saveStatus();
      close();
      return true;
    };
    editor.querySelectorAll("[data-input]").forEach((input) => {
      input.oninput = () => {
        pending[key] = input.value;
        inspect(`Editing ${item.label}; not committed yet.`);
      };
      input.onkeydown = (event) => {
        if (event.key === "Enter" && input.tagName !== "TEXTAREA") {
          event.preventDefault();
          editor.commit();
        }
      };
    });
    editor.querySelectorAll("[data-time]").forEach((input) => {
      input.oninput = () => {
        const [date, time] = pending[input.dataset.time].split("T");
        pending[input.dataset.time] =
          input.dataset.part === "date"
            ? `${input.value}T${time}`
            : `${date}T${input.value}`;
        inspect("Editing grouped date/time; not committed yet.");
      };
    });
    editor.querySelectorAll("[data-choice]").forEach((button) => {
      button.onclick = () => {
        const value = button.dataset.value;
        if (item.type === "multi") {
          const next = state.saved[key].includes(value)
            ? state.saved[key].filter((choice) => choice !== value)
            : [...state.saved[key], value];
          const error = validate(item, next);
          const message = $(".field-error", editor);
          message.hidden = !error;
          message.textContent = error;
          if (error) return;
        }
        applyChoice(item, value, "saved");
        Object.assign(pending, structuredClone(state.saved));
        if (item.type === "choice") {
          if (item.key !== "type") close();
          return;
        }
        editor
          .querySelectorAll("[data-choice]")
          .forEach((choice) =>
            choice.setAttribute(
              "aria-pressed",
              String(state.saved[key].includes(choice.dataset.value))
            )
          );
      };
    });
    editor.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !editor.contains(event.relatedTarget)) {
        editor.commit();
      } else if (!event.relatedTarget) {
        setTimeout(() => {
          if (editor.isConnected && !editor.contains(document.activeElement))
            editor.commit();
        }, 0);
      }
    });
    $("input, textarea, button", editor)?.focus({ preventScroll: true });
    inspect(`Opened ${key} inline.`);
  }
  function confirmAction(title, copy, keep, accept, action) {
    const dialog = $("#confirmation");
    $("#confirmation-title").textContent = title;
    $("#confirmation-copy").textContent = copy;
    $("#confirmation-keep").textContent = keep;
    $("#confirmation-accept").textContent = accept;
    $("#confirmation-keep").onclick = () => dialog.close();
    $("#confirmation-accept").onclick = () => {
      dialog.close();
      action();
    };
    dialog.showModal();
    $("#confirmation-keep").focus();
  }
  function selectKind(kind) {
    if (!settleEditor()) {
      $("#entry-select").value = state.kind;
      return;
    }
    state.kind = kind;
    loadRecords();
    render();
  }
  function bindSurfaces() {
    $("#logging-surface")
      .querySelectorAll("[data-input]")
      .forEach((input) => {
        input.oninput = () => {
          state.draft[input.dataset.input] = input.value;
          inspect("Logging draft changed.");
        };
      });
    $("#logging-surface")
      .querySelectorAll("[data-choice]")
      .forEach((button) => {
        button.onclick = () => {
          const item = currentFixture().fields.find(
            (item) => item.key === button.dataset.choice
          );
          applyChoice(item, button.dataset.value, "draft");
          if (item.key === "type") return;
          const cell = $(`[data-cell="draft-${item.key}"]`);
          cell.querySelectorAll("[data-choice]").forEach((choice) => {
            const value = state.draft[item.key];
            choice.setAttribute(
              "aria-pressed",
              String(
                Array.isArray(value)
                  ? value.includes(choice.dataset.value)
                  : value === choice.dataset.value ||
                      (!value && choice.dataset.value === "Not recorded")
              )
            );
          });
          if (item.key === "unit") {
            $("#draft-temperature").value = state.draft.temperature;
            $('[data-cell="draft-temperature"] .unit-input span').textContent =
              state.draft.unit;
          }
        };
      });
    $("#logging-surface")
      .querySelectorAll("[data-expand-time]")
      .forEach((button) => {
        button.onclick = () => {
          const editor = $(`[data-time-editor="${button.dataset.expandTime}"]`);
          editor.hidden = !editor.hidden;
          button.setAttribute("aria-expanded", String(!editor.hidden));
        };
      });
    $("#logging-surface")
      .querySelectorAll("[data-time]")
      .forEach((input) => {
        input.oninput = () => {
          const key = input.dataset.time;
          const [date, time] = state.draft[key].split("T");
          state.draft[key] =
            input.dataset.part === "date"
              ? `${input.value}T${time}`
              : `${date}T${input.value}`;
          $(`[data-time-value="${key}"]`).textContent = formatTime(
            state.draft[key]
          );
          if (state.kind === "sleep_session")
            $('[data-duration="draft"]').textContent = duration(state.draft);
          inspect("Draft timestamp changed.");
        };
      });
    $("#logging-form").onsubmit = (event) => {
      event.preventDefault();
      const error =
        currentFixture()
          .fields.map((item) => validate(item, state.draft[item.key]))
          .find(Boolean) ||
        validateTimes(state.draft) ||
        (state.kind === "growth" &&
        ![state.draft.weight, state.draft.height, state.draft.head].some(
          Boolean
        )
          ? "Record at least one measurement."
          : "");
      $("#logging-error").hidden = !error;
      $("#logging-error").textContent = error;
      if (error) return;
      Object.assign(state.saved, structuredClone(state.draft));
      render();
      announce(
        "Demo Entry created. Its recorded view is updated in panel 02; nothing was written to the app."
      );
    };
    $("#editing-surface")
      .querySelectorAll("[data-edit]")
      .forEach((button) => {
        button.onclick = () => openEditor(button.dataset.edit);
      });
    document.querySelectorAll("[data-kind]").forEach((button) => {
      button.onclick = () => selectKind(button.dataset.kind);
    });
    document.querySelectorAll("[data-demo-back]").forEach((button) => {
      button.onclick = () =>
        announce(
          "Demo navigation only. The comparison stays open; no app data changed."
        );
    });
    $("[data-also-meal]")?.addEventListener("click", () => {
      const when = state.saved.when;
      selectKind("meal");
      state.draft.when = when;
      render();
      announce(
        "Meal draft opened at the Introduction's recorded time. Meals use categories, not named Foods."
      );
    });
    $("[data-delete-entry]").onclick = () =>
      confirmAction(
        "Delete this Entry?",
        "In the app, its content is permanently removed with no restore path. This prototype will only show the confirmation, not delete real data.",
        "Keep Entry",
        "Delete demo Entry",
        () => announce("Demo deletion confirmed. No real Entry was deleted.")
      );
    $("[data-mark-safe]").onclick = () => {
      const mark = () => {
        state.foodStatus = "safe";
        state.manualSafe = true;
        render();
        announce("Demo Food marked safe. No new exposure was added.");
      };
      if (state.foodStatus === "trying")
        confirmAction(
          "Mark Tahini safe?",
          "This ends the current Watch Period early for this Child. Introduction history is preserved; no exposure is added.",
          "Keep watching",
          "Mark safe",
          mark
        );
      else mark();
    };
    $("[data-reset-food]").onclick = () =>
      confirmAction(
        "Reset Tahini's status?",
        "In the app, this permanently removes this Child's Introductions for Tahini, clears its manual-safe flag, and removes Tahini from linked Reactions. Shared Reactions remain for other Foods. No undo. This is a demo only.",
        "Keep status",
        "Reset status",
        () => {
          state.foodStatus = "untried";
          state.foodIntroductions = 0;
          state.manualSafe = false;
          render();
          announce("Demo reset: Tahini is untried, with zero Introductions.");
        }
      );
    document.querySelectorAll("[data-log-food]").forEach((button) => {
      button.onclick = () => {
        const kind = button.dataset.logFood;
        selectKind(kind);
        state.draft[kind === "introduction" ? "food" : "foods"] =
          kind === "introduction" ? "Tahini" : ["Tahini"];
        render();
        announce(`Demo ${kind} draft opened for Tahini.`);
      };
    });
    document.querySelectorAll("[data-history]").forEach((button) => {
      button.onclick = () => {
        selectKind("introduction");
        announce("Demo Introduction opened in the matching Entry view.");
      };
    });
  }
  function cycle(direction) {
    if (!settleEditor()) return;
    const index = layouts.findIndex((layout) => layout.key === state.variant);
    state.variant =
      layouts[(index + direction + layouts.length) % layouts.length].key;
    render();
  }
  function settleEditor() {
    const editor = $("#editing-surface .editor");
    return !editor || editor.commit();
  }
  $("#entry-select").onchange = (event) => selectKind(event.target.value);
  $("#medical-select").onchange = (event) => {
    if (!settleEditor()) {
      event.target.value = state.medical;
      return;
    }
    state.medical = event.target.value;
    loadRecords();
    render();
  };
  $("#status-select").onchange = (event) => {
    if (!settleEditor()) {
      event.target.value = state.foodStatus;
      return;
    }
    state.foodStatus = event.target.value;
    state.foodIntroductions = state.foodStatus === "untried" ? 0 : 2;
    state.manualSafe = false;
    render();
  };
  $("#theme-toggle").onclick = () => {
    if (!settleEditor()) return;
    state.theme = state.theme === "day" ? "night" : "day";
    render();
  };
  $("#reset-demo").onclick = () => {
    drafts.clear();
    records.clear();
    state.manualSafe = false;
    state.foodStatus = "trying";
    state.foodIntroductions = 2;
    loadRecords();
    render();
    announce("Synthetic fixtures restored. All edits discarded.");
  };
  $("#previous").onclick = () => cycle(-1);
  $("#next").onclick = () => cycle(1);
  document.addEventListener("keydown", (event) => {
    if (
      $("#confirmation").open ||
      (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]"))
    )
      return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      cycle(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  loadRecords();
  render();
})();
