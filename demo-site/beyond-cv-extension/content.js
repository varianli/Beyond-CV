(function () {
  const CONTENT_VERSION = "0.1.6";
  if (window.__beyondCvContentVersion === CONTENT_VERSION) return;
  window.__beyondCvContentVersion = CONTENT_VERSION;

  const APPLICATIONS_KEY = "applicationRecords";
  const MARKER_CLASS = "bcv-field-marker";
  const FIELD_SELECTOR = [
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='file'])",
    "textarea",
    "select",
    "[contenteditable='true']"
  ].join(",");
  let visualTextCache = [];

  const KEYWORDS = [
    { key: "lastName", label: "姓", confidence: 0.96, patterns: [/^姓$/, /last\s*name/i, /family\s*name/i, /surname/i] },
    { key: "firstName", label: "名", confidence: 0.96, patterns: [/^名$/, /first\s*name/i, /given\s*name/i] },
    { key: "name", label: "姓名", confidence: 0.94, patterns: [/姓名|中文名|全名|真实姓名|name/i] },
    { key: "email", label: "邮箱", confidence: 0.96, patterns: [/邮箱|电子邮件|mail|e-mail|email/i] },
    { key: "phone", label: "电话", confidence: 0.95, patterns: [/电话|手机|联系电话|mobile|phone|tel/i] },
    { key: "educationStart", label: "教育起始时间", confidence: 0.9, patterns: [/起止时间|开始时间|入学时间|start\s*date|\bfrom\b/i] },
    { key: "educationEnd", label: "教育结束时间", confidence: 0.86, patterns: [/结束时间|毕业时间|预计毕业|end\s*date|\bto\b|graduat/i] },
    { key: "educationType", label: "学历类型", confidence: 0.9, patterns: [/学历类型|培养方式|学习形式|education\s*type/i] },
    { key: "educationLevel", label: "学历", confidence: 0.9, patterns: [/(^|\s)学历\s*($|[*＊\s])|学历层次|最高学历|education\s*level/i] },
    { key: "school", label: "学校名称", confidence: 0.92, patterns: [/学校名称|学校|院校|大学|毕业院校|school|university|college/i] },
    { key: "college", label: "学院", confidence: 0.88, patterns: [/学院|院系|department|faculty/i] },
    { key: "degree", label: "学位", confidence: 0.86, patterns: [/学位|degree/i] },
    { key: "major", label: "专业", confidence: 0.84, patterns: [/专业|major|field\s*of\s*study/i] },
    { key: "lab", label: "实验室", confidence: 0.76, patterns: [/实验室|lab/i] },
    { key: "researchArea", label: "研究方向", confidence: 0.76, patterns: [/研究方向|研究领域|research/i] },
    { key: "advisor", label: "导师", confidence: 0.74, patterns: [/导师|supervisor|advisor/i] },
    { key: "graduation", label: "毕业时间", confidence: 0.78, patterns: [/毕业|graduat|completion/i] },
    { key: "address", label: "地址", confidence: 0.82, patterns: [/地址|所在地|居住地|常住|address|location|current\s*city/i] },
    { key: "city", label: "城市", confidence: 0.78, patterns: [/城市|地区|期望工作地点|工作地点|地点|city|work\s*location/i] },
    { key: "skills", label: "技能", confidence: 0.82, patterns: [/技能|技术栈|skills|tool|能力/i] },
    { key: "summary", label: "经历摘要", confidence: 0.8, patterns: [/经历摘要|个人简介|自我介绍|summary|profile|resume\s*summary|experience\s*summary/i] },
    { key: "motivation", label: "申请动机", confidence: 0.84, patterns: [/申请动机|求职动机|为什么|开放题|cover\s*letter|motivation|why\s*(us|role|company)|personal\s*statement/i] }
  ];

  const BLOCKED_PATTERNS = [
    /身份证|护照|证件|id\s*number|passport/i,
    /密码|password/i,
    /验证码|verification|captcha/i,
    /同意|协议|隐私|条款|consent|agree|privacy|terms/i,
    /期望薪资|薪水|salary|compensation/i,
    /政治|宗教|婚姻|家庭|gender|marital|religion/i
  ];

  const FALLBACK_PROFILE = {
    name: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    school: "",
    degree: "",
    educationType: "",
    educationLevel: "",
    educationStart: "",
    educationEnd: "",
    graduation: "",
    college: "",
    major: "",
    skills: ""
  };

  const DIRECT_TARGETS = [
    { label: "姓名", key: "name", patterns: [/^姓名$/] },
    { label: "手机号码", key: "phone", patterns: [/^手机号码$/, /^联系电话$/, /^电话$/], choose: "widest" },
    { label: "邮箱", key: "email", patterns: [/^邮箱$/, /^电子邮件$/, /^Email$/i] },
    { label: "期望工作地点", key: "city", patterns: [/^期望工作地点$/, /^工作地点$/, /^地点$/], optional: true },
    { label: "教育起始时间", key: "educationStart", patterns: [/^起止时间$/, /^开始时间$/, /^入学时间$/], index: 0 },
    { label: "教育结束时间", key: "educationEnd", patterns: [/^起止时间$/, /^结束时间$/, /^毕业时间$/], index: 1 },
    { label: "学历类型", key: "educationType", patterns: [/^学历类型$/], allowSelect: true },
    { label: "学校名称", key: "school", patterns: [/^学校名称$/, /^学校$/] },
    { label: "学历", key: "educationLevel", patterns: [/^学历$/], allowSelect: true },
    { label: "学院", key: "college", patterns: [/^学院$/, /^院系$/] },
    { label: "专业", key: "major", patterns: [/^专业$/] },
    { label: "学位", key: "degree", patterns: [/^学位$/], optional: true },
    { label: "实验室", key: "lab", patterns: [/^实验室$/], optional: true },
    { label: "研究方向", key: "researchArea", patterns: [/^研究方向$/, /^领域方向$/], optional: true },
    { label: "导师", key: "advisor", patterns: [/^导师$/], optional: true }
  ];

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function compact(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function textOf(node, limit = 120) {
    return compact(node?.innerText || node?.textContent || "").slice(0, limit);
  }

  function cleanLabelText(text) {
    return compact(text)
      .replace(/\*/g, "")
      .replace(/为必填|必填|请选择|请填写|请输入/g, "")
      .trim();
  }

  function isUsefulVisualText(text) {
    const cleaned = cleanLabelText(text);
    return cleaned.length > 0
      && cleaned.length <= 48
      && /[\u4e00-\u9fa5A-Za-z]/.test(cleaned)
      && !/^\d{4}[-./]\d{1,2}/.test(cleaned)
      && !/^[+＋]?\d[\d\s-]{2,}$/.test(cleaned);
  }

  function buildVisualTextCache() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const cache = [];
    let node = walker.nextNode();
    while (node) {
      const text = cleanLabelText(node.nodeValue);
      const parent = node.parentElement;
      if (parent && isUsefulVisualText(text) && isVisible(parent)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        range.detach();
        if (rect.width > 0 && rect.height > 0) {
          cache.push({ text, rect, parent });
        }
      }
      node = walker.nextNode();
    }
    return cache;
  }

  function addUnique(parts, value, limit = 140) {
    const text = cleanLabelText(value).slice(0, limit);
    if (text && !parts.includes(text)) parts.push(text);
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
  }

  function nearbyVisualLabelText(el) {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const candidates = [];

    visualTextCache.forEach((item) => {
      if (item.parent.contains(el) || el.contains(item.parent)) return;
      const labelRect = item.rect;
      const labelCenterX = labelRect.left + labelRect.width / 2;
      const labelCenterY = labelRect.top + labelRect.height / 2;
      const sameRow = overlaps(labelRect.top, labelRect.bottom, rect.top - 8, rect.bottom + 8);
      const leftLabel = sameRow && labelRect.right <= rect.left + 8 && rect.left - labelRect.right <= 360;
      const aboveLabel = labelRect.bottom <= rect.top + 10
        && rect.top - labelRect.bottom <= 120
        && overlaps(labelRect.left, labelRect.right, rect.left - 28, rect.right + 28);
      const topLeftLabel = labelRect.bottom <= rect.top + 12
        && rect.top - labelRect.bottom <= 120
        && labelRect.left <= rect.left + 16
        && rect.left - labelRect.left <= 120;
      if (!leftLabel && !aboveLabel && !topLeftLabel) return;

      const score = Math.abs(centerY - labelCenterY) * (leftLabel ? 2 : 1)
        + Math.abs(centerX - labelCenterX) * (leftLabel ? 0.3 : 0.12)
        + (leftLabel ? rect.left - labelRect.right : rect.top - labelRect.bottom);
      candidates.push({ text: item.text, score });
    });

    return candidates
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((item) => item.text)
      .join(" ");
  }

  function labelledByText(el) {
    const ids = compact(el.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
    return ids.map((id) => textOf(document.getElementById(id), 120)).filter(Boolean).join(" ");
  }

  function previousSiblingText(el) {
    const parts = [];
    let current = el;
    for (let depth = 0; current && current !== document.body && depth < 5; depth += 1) {
      let prev = current.previousElementSibling;
      for (let step = 0; prev && step < 3; step += 1) {
        addUnique(parts, textOf(prev, 100));
        prev = prev.previousElementSibling;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.childNodes);
        const index = siblings.indexOf(current);
        siblings.slice(Math.max(0, index - 4), index).reverse().forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) addUnique(parts, node.textContent, 80);
          if (node.nodeType === Node.ELEMENT_NODE) addUnique(parts, textOf(node, 100));
        });
      }
      current = current.parentElement;
    }
    return parts.join(" ");
  }

  function closestFieldContainerText(el) {
    const selectors = [
      "label",
      ".ant-form-item",
      ".el-form-item",
      ".form-item",
      ".form-group",
      ".field",
      "[class*='form-item']",
      "[class*='FormItem']",
      "[class*='field']",
      "[class*='Field']"
    ].join(",");
    const container = el.closest(selectors);
    const text = textOf(container, 220);
    if (text && text.length <= 220) return text;
    return "";
  }

  function fieldText(el) {
    const parts = [];
    addUnique(parts, nearbyVisualLabelText(el), 220);
    addUnique(parts, el.getAttribute("aria-label"));
    addUnique(parts, labelledByText(el));
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      addUnique(parts, label?.innerText);
    }
    const wrappedLabel = el.closest("label");
    if (wrappedLabel) addUnique(parts, wrappedLabel.innerText);
    addUnique(parts, closestFieldContainerText(el), 220);
    addUnique(parts, previousSiblingText(el), 220);
    addUnique(parts, el.getAttribute("placeholder"));
    addUnique(parts, el.getAttribute("title"));
    addUnique(parts, el.getAttribute("data-label") || el.getAttribute("data-name"));
    addUnique(parts, el.getAttribute("name"));
    addUnique(parts, el.getAttribute("id"));
    return compact(parts.join(" "));
  }

  function classify(labelText) {
    if (!labelText) return null;
    const keywordMatch = KEYWORDS.find((entry) => entry.patterns.some((pattern) => pattern.test(labelText)));
    if (keywordMatch) return keywordMatch;
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(labelText))) {
      return {
        key: "blocked",
        label: "需手动确认",
        confidence: 0,
        blocked: true
      };
    }
    return null;
  }

  function classifyField(el, labelText) {
    if (/起止时间|教育时间|在校时间|学习时间/i.test(labelText)) {
      return dateRangeSide(el) === "end"
        ? { key: "educationEnd", label: "教育结束时间", confidence: 0.88, patterns: [] }
        : { key: "educationStart", label: "教育起始时间", confidence: 0.9, patterns: [] };
    }
    const byLabel = classify(labelText);
    if (byLabel) return byLabel;
    return classifyByExistingValue(el);
  }

  function dateRangeSide(el) {
    const rect = el.getBoundingClientRect();
    const sameRowFields = Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .filter((item) => item !== el && isVisible(item))
      .map((item) => ({ item, rect: item.getBoundingClientRect() }))
      .filter((entry) => Math.abs((entry.rect.top + entry.rect.bottom) / 2 - (rect.top + rect.bottom) / 2) <= 14)
      .filter((entry) => Math.abs(entry.rect.left - rect.left) <= 520 || Math.abs(entry.rect.right - rect.right) <= 520)
      .concat([{ item: el, rect }])
      .sort((a, b) => a.rect.left - b.rect.left);
    return sameRowFields.findIndex((entry) => entry.item === el) > 0 ? "end" : "start";
  }

  function classifyByExistingValue(el) {
    const value = compact(el.value || el.textContent || "");
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
      return { key: "email", label: "邮箱", confidence: 0.72, patterns: [] };
    }
    if (/^(?:\+?86)?1[3-9]\d{9}$/.test(value.replace(/\s|-/g, ""))) {
      return { key: "phone", label: "电话", confidence: 0.7, patterns: [] };
    }
    return null;
  }

  function valueFor(profile, key) {
    const aliases = {
      educationStart: ["educationStart", "startDate", "educationDate"],
      educationEnd: ["educationEnd", "graduation", "endDate"],
      educationType: ["educationType", "admissionType", "studyType"],
      educationLevel: ["educationLevel", "degreeLevel", "degree"],
      college: ["college", "department", "faculty"],
      lab: ["lab", "laboratory"],
      researchArea: ["researchArea", "researchDirection"],
      advisor: ["advisor", "supervisor"]
    }[key] || [key];

    for (const source of [profile || {}, FALLBACK_PROFILE]) {
      for (const alias of aliases) {
        const cleaned = cleanProfileValue(source?.[alias]);
        if (!cleaned) continue;
        if (key === "educationLevel") return normalizeEducationType(cleaned);
        if (key === "educationStart") return normalizeMonth(firstDate(cleaned) || cleaned);
        if (key === "educationEnd") return normalizeMonth(lastDate(cleaned) || cleaned);
        return cleaned;
      }
    }

    return "";
  }

  function cleanProfileValue(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || /^\[[^\]]+\]$/.test(text) || /^xx$/i.test(text)) return "";
    return text;
  }

  function normalizeEducationType(value) {
    if (/博士|phd|doctor/i.test(value)) return "博士";
    if (/硕士|研究生|master/i.test(value)) return "硕士";
    if (/本科|学士|bachelor/i.test(value)) return "本科";
    if (/专科|associate/i.test(value)) return "专科";
    return value;
  }

  function normalizeMonth(value) {
    const text = compact(value);
    const match = text.match(/\d{4}[./-]\d{1,2}/);
    return (match?.[0] || text).replace(/[./]/g, "-");
  }

  function firstDate(value) {
    return compact(value).match(/\d{4}[./-]\d{1,2}/)?.[0] || "";
  }

  function lastDate(value) {
    const matches = [...compact(value).matchAll(/\d{4}[./-]\d{1,2}/g)].map((match) => match[0]);
    return matches.at(-1) || "";
  }

  function ensureFieldId(el, index = 0) {
    const id = el.dataset.bcvFieldId || `bcv-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
    el.dataset.bcvFieldId = id;
    return id;
  }

  function rectData(rect) {
    return {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function fieldDescriptor(el, index, profile) {
    const labelText = fieldText(el);
    const match = classifyField(el, labelText);
    const id = ensureFieldId(el, index);
    const value = match && !match.blocked ? valueFor(profile, match.key) : "";
    return {
      id,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      labelText: labelText || "未识别字段",
      key: match?.key || "",
      matchLabel: match?.label || "未匹配",
      value,
      currentValue: compact(el.value || el.textContent || ""),
      confidence: match?.confidence || 0,
      blocked: Boolean(match?.blocked),
      canFill: Boolean(match && !match.blocked && value),
      rect: rectData(el.getBoundingClientRect())
    };
  }

  function collectPageFields(profile) {
    return Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .filter((el) => !el.disabled && !el.readOnly && isVisible(el))
      .map((el, index) => fieldDescriptor(el, index, profile))
      .filter((field) => field.key || /input|textarea|select/i.test(field.tag));
  }

  function buildPageModel(profile) {
    visualTextCache = buildVisualTextCache();
    const fields = collectPageFields(profile);
    return {
      url: location.href,
      title: document.title,
      fields,
      labels: visualTextCache.map((item) => ({ text: item.text, rect: rectData(item.rect) })),
      matchedCount: fields.filter((field) => field.canFill).length,
      recognizedCount: fields.filter((field) => field.key && !field.blocked).length,
      blockedCount: fields.filter((field) => field.blocked).length
    };
  }

  function scan(profile) {
    clearMarkers();
    const model = buildPageModel(profile);
    const fields = model.fields;

    fields.forEach(markField);
    return {
      url: model.url,
      title: model.title,
      fields,
      matchedCount: model.matchedCount,
      blockedCount: model.blockedCount
    };
  }

  function markField(field) {
    const el = document.querySelector(`[data-bcv-field-id="${CSS.escape(field.id)}"]`);
    if (!el) return;
    el.style.outline = field.canFill ? "2px solid #007aff" : field.blocked ? "2px solid #ff9500" : field.key ? "2px dashed #60a5fa" : "1px dashed #94a3b8";
    el.style.outlineOffset = "2px";

    const marker = document.createElement("span");
    marker.className = MARKER_CLASS;
    marker.textContent = field.blocked ? "手动确认" : field.canFill ? `Beyond CV: ${field.matchLabel}` : field.key ? `资料缺失: ${field.matchLabel}` : "未匹配";
    marker.style.cssText = [
      "position:absolute",
      "z-index:2147483647",
      "border-radius:6px",
      "padding:3px 6px",
      "font:600 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "color:#fff",
      `background:${field.blocked ? "#ff9500" : field.canFill ? "#007aff" : field.key ? "#2563eb" : "#64748b"}`,
      "box-shadow:0 8px 20px rgba(15,23,42,.18)",
      "pointer-events:none"
    ].join(";");

    const rect = el.getBoundingClientRect();
    marker.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
    marker.style.top = `${Math.max(8, rect.top + window.scrollY - 24)}px`;
    document.documentElement.appendChild(marker);
  }

  function clearMarkers() {
    document.querySelectorAll(`.${MARKER_CLASS}`).forEach((marker) => marker.remove());
    document.querySelectorAll("[data-bcv-field-id]").forEach((el) => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    });
  }

  function setNativeValue(el, value) {
    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      return;
    }

    const prototype = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(el, value) {
    const normalized = value.toLowerCase();
    const option = Array.from(el.options).find((item) => {
      const optionValue = item.value.toLowerCase();
      const optionText = item.textContent.trim().toLowerCase();
      return optionValue === normalized
        || optionText === normalized
        || optionText.includes(normalized)
        || normalized.includes(optionText);
    });
    if (option) {
      el.value = option.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  function fill(ids, profile) {
    let filled = 0;
    ids.forEach((id) => {
      const el = document.querySelector(`[data-bcv-field-id="${CSS.escape(id)}"]`);
      if (!el) return;
      const labelText = fieldText(el);
      const match = classifyField(el, labelText);
      if (!match || match.blocked) return;
      const value = valueFor(profile, match.key);
      if (!value) return;
      if (el.tagName === "SELECT") {
        if (fillSelect(el, value)) filled += 1;
        return;
      }
      if (el.type === "checkbox" || el.type === "radio") return;
      setNativeValue(el, value);
      filled += 1;
    });
    return { filled };
  }

  function labelMatches(text, patterns) {
    const cleaned = cleanLabelText(text);
    return patterns.some((pattern) => pattern.test(cleaned));
  }

  function fieldsNearLabel(patterns) {
    const labels = visualTextCache.filter((item) => labelMatches(item.text, patterns));
    const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .filter((el) => !el.disabled && !el.readOnly && isVisible(el));
    const candidates = [];

    labels.forEach((label) => {
      fields.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const labelRect = label.rect;
        const sameRowLeft = overlaps(labelRect.top, labelRect.bottom, rect.top - 8, rect.bottom + 8)
          && labelRect.right <= rect.left + 12
          && rect.left - labelRect.right <= 440;
        const below = rect.top >= labelRect.bottom - 10
          && rect.top - labelRect.bottom <= 150
          && (overlaps(labelRect.left, labelRect.right, rect.left - 36, rect.right + 36)
            || Math.abs(rect.left - labelRect.left) <= 140);
        if (!sameRowLeft && !below) return;
        const score = (sameRowLeft ? 0 : 80)
          + Math.abs(rect.left - labelRect.left) * 0.35
          + Math.abs(rect.top - labelRect.bottom)
          + Math.abs(rect.top - labelRect.top) * 0.08;
        candidates.push({ el, rect, label: label.text, score });
      });
    });

    const seen = new Set();
    return candidates
      .sort((a, b) => a.score - b.score)
      .filter((entry) => {
        if (seen.has(entry.el)) return false;
        seen.add(entry.el);
        return true;
      });
  }

  function chooseDirectField(candidates, target) {
    if (!candidates.length) return null;
    if (target.index !== undefined) {
      const sorted = [...candidates].sort((a, b) => a.rect.left - b.rect.left);
      return sorted[target.index]?.el || null;
    }
    if (target.choose === "widest") {
      return [...candidates]
        .filter((entry) => !/^\+?86$/.test(compact(entry.el.value || entry.el.textContent || "")))
        .sort((a, b) => b.rect.width - a.rect.width)[0]?.el || null;
    }
    return candidates[0].el;
  }

  function fillElement(el, value) {
    if (!el || !value) return false;
    if (el.tagName === "SELECT") return fillSelect(el, value);
    if (el.type === "checkbox" || el.type === "radio" || el.type === "file") return false;
    setNativeValue(el, value);
    el.focus?.();
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Unidentified" }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
    el.blur?.();
    return true;
  }

  function directFill(profile) {
    clearMarkers();
    visualTextCache = buildVisualTextCache();
    const filled = [];
    const skipped = [];

    DIRECT_TARGETS.forEach((target) => {
      const value = valueFor(profile, target.key);
      if (!value) {
        if (!target.optional) skipped.push({ label: target.label, reason: "资料缺失" });
        return;
      }
      const candidates = fieldsNearLabel(target.patterns);
      const field = chooseDirectField(candidates, target);
      if (!field) {
        if (!target.optional) skipped.push({ label: target.label, reason: "页面字段未找到" });
        return;
      }
      const ok = fillElement(field, value);
      if (ok) {
        const id = ensureFieldId(field);
        markField({
          id,
          canFill: true,
          blocked: false,
          key: target.key,
          matchLabel: target.label
        });
        filled.push({ label: target.label, value });
      } else if (!target.optional) {
        skipped.push({ label: target.label, reason: "控件不支持直接写入" });
      }
    });

    return {
      filled: filled.length,
      skipped: skipped.length,
      filledFields: filled,
      skippedFields: skipped,
      model: {
        url: location.href,
        title: document.title,
        fields: collectPageFields(profile)
      }
    };
  }

  function exportBeyondCvProfile() {
    const byId = (id) => document.getElementById(id)?.value?.trim() || "";
    const name = byId("candidateName");
    if (!name) return null;
    const contact = byId("candidateContact");
    const email = contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = contact.match(/(?:\+?86[\s-]?)?1[3-9]\d{9}/)?.[0]?.replace(/^(\+?86)?\s*/, "") || "";
    const rawDegree = document.querySelector(".item-degree")?.value?.trim() || "";
    const rawDate = document.querySelector(".item-date")?.value?.trim() || "";
    const parsedEducation = parseEducationFields(rawDegree, rawDate);
    return {
      name,
      firstName: name.length > 1 ? name.slice(1) : name,
      lastName: name.length > 1 ? name.slice(0, 1) : "",
      email: byId("candidateEmail") || email,
      phone: byId("candidatePhone") || phone,
      city: byId("candidateAddress"),
      address: byId("candidateAddress"),
      school: safeResumeField(document.querySelector(".item-school")?.value),
      degree: parsedEducation.degree,
      educationType: parsedEducation.educationType,
      educationLevel: parsedEducation.educationLevel,
      educationStart: parsedEducation.educationStart,
      educationEnd: parsedEducation.educationEnd,
      graduation: parsedEducation.educationEnd,
      college: parsedEducation.college,
      major: parsedEducation.major,
      lab: "",
      researchArea: "",
      advisor: "",
      skills: collectBeyondCvSkills(),
      summary:
        document.querySelector(".resume-item[data-type='experience'] .item-detail")?.value?.trim() || "",
      motivation: ""
    };
  }

  function collectBeyondCvSkills() {
    const rows = [...document.querySelectorAll(".skill-item")]
      .filter((row) => row.querySelector(".skill-include")?.checked)
      .map((row) => row.querySelector(".skill-input")?.value?.trim() || "")
      .filter(Boolean);
    if (rows.length) return rows.join("\n");
    const byId = (id) => document.getElementById(id)?.value?.trim() || "";
    return [
      byId("skillsTechnical"),
      byId("skillsCerts"),
      byId("skillsLanguages")
    ].filter(Boolean).join("\n");
  }

  function safeResumeField(value) {
    return cleanProfileValue(value);
  }

  function parseEducationFields(rawDegree, rawDate) {
    const parts = rawDegree.split(/[｜|]/).map((part) => compact(part)).filter(Boolean);
    const degreePart = parts.find((part) => /(博士|硕士|本科|学士|Master|Bachelor|PhD)/i.test(part)) || parts[0] || "";
    const college = parts.find((part) => /学院|School|College|Faculty/i.test(part)) || "";
    const major = degreePart.replace(/博士|硕士|本科|学士|Master|Bachelor|PhD/gi, "").trim() || parts.find((part) => part !== college && part !== degreePart) || "";
    return {
      degree: degreePart || "",
      educationType: "",
      educationLevel: normalizeEducationType(degreePart || rawDegree || ""),
      college: college || "",
      major,
      educationStart: normalizeMonth(firstDate(rawDate) || ""),
      educationEnd: normalizeMonth(lastDate(rawDate) || "")
    };
  }

  function guessRoleFromText(text) {
    const source = compact(text);
    const roleMatch = source.match(/([^｜|_\-—–,，。]{2,36}(?:实习生|管培生|分析师|工程师|设计师|产品经理|运营|助理|专员|顾问|Intern|Analyst|Engineer|Designer|Manager|Assistant|Specialist|Consultant|Trainee))/i);
    return compact(roleMatch?.[1] || "");
  }

  function guessCompanyFromText(text) {
    const source = compact(text);
    const companyMatch = source.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,24}(?:公司|集团|科技|电商|银行|证券|基金|咨询|事务所|Company|Group|Bank|Capital|Securities|Consulting|Technology))/i);
    return compact(companyMatch?.[1] || "");
  }

  function applicationContext() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, [class*='title'], [class*='Title']"))
      .filter(isVisible)
      .map((item) => textOf(item, 120))
      .filter(Boolean)
      .slice(0, 8);
    const title = document.title || "";
    const combined = [title, ...headings].join(" ");
    const hostParts = location.hostname.split(".").filter((part) => !/^(www|jobs|career|careers|campus|apply|ats|hr)$/i.test(part));
    const hostCompany = hostParts[0] || "";
    return {
      url: location.href,
      title,
      role: guessRoleFromText(combined),
      company: guessCompanyFromText(combined) || hostCompany,
      headings
    };
  }

  function normalizeApplicationRecord(record) {
    const now = new Date().toISOString();
    const company = compact(record?.company).slice(0, 80);
    const role = compact(record?.role).slice(0, 120);
    const url = compact(record?.url || location.href).slice(0, 1000);
    return {
      id: compact(record?.id) || `${company || "unknown"}-${role || "role"}-${url}`.toLowerCase().replace(/\W+/g, "-").slice(0, 120),
      company,
      role,
      status: compact(record?.status || "已投递").slice(0, 24),
      url,
      title: compact(record?.title || document.title).slice(0, 160),
      source: "extension",
      appliedAt: record?.appliedAt || now,
      updatedAt: now
    };
  }

  async function getApplicationRecords() {
    const stored = await chrome.storage.local.get(APPLICATIONS_KEY);
    return Array.isArray(stored[APPLICATIONS_KEY]) ? stored[APPLICATIONS_KEY] : [];
  }

  async function upsertApplicationRecord(record) {
    const normalized = normalizeApplicationRecord(record);
    const records = await getApplicationRecords();
    const existingIndex = records.findIndex((item) => item.id === normalized.id || (item.url && item.url === normalized.url));
    const next = existingIndex >= 0
      ? records.map((item, index) => index === existingIndex ? { ...item, ...normalized, appliedAt: item.appliedAt || normalized.appliedAt } : item)
      : [normalized, ...records];
    await chrome.storage.local.set({ [APPLICATIONS_KEY]: next.slice(0, 200) });
    return next.slice(0, 200);
  }

  function postApplicationRecords(records) {
    window.postMessage({
      source: "beyond-cv-extension",
      type: "BCV_APPLICATION_RECORDS",
      records
    }, "*");
  }

  async function syncApplicationRecordsToPage() {
    postApplicationRecords(await getApplicationRecords());
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "beyond-cv-page") return;
    if (event.data.type === "BCV_GET_APPLICATION_RECORDS") {
      syncApplicationRecordsToPage();
    }
    if (event.data.type === "BCV_UPSERT_APPLICATION_RECORD") {
      upsertApplicationRecord(event.data.record || {}).then(postApplicationRecords);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[APPLICATIONS_KEY]) {
      postApplicationRecords(changes[APPLICATIONS_KEY].newValue || []);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "BCV_SCAN") {
      sendResponse(scan(message.profile || {}));
      return true;
    }
    if (message?.type === "BCV_PAGE_MODEL") {
      clearMarkers();
      sendResponse(buildPageModel(message.profile || {}));
      return true;
    }
    if (message?.type === "BCV_FILL") {
      sendResponse(fill(message.ids || [], message.profile || {}));
      return true;
    }
    if (message?.type === "BCV_DIRECT_FILL") {
      sendResponse(directFill(message.profile || {}));
      return true;
    }
    if (message?.type === "BCV_CLEAR") {
      clearMarkers();
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === "BCV_EXPORT_PROFILE") {
      sendResponse({ profile: exportBeyondCvProfile() });
      return true;
    }
    if (message?.type === "BCV_APPLICATION_CONTEXT") {
      sendResponse(applicationContext());
      return true;
    }
    return false;
  });

  window.postMessage({ source: "beyond-cv-extension", type: "READY" }, "*");
})();
