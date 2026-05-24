(function () {
  const CONTENT_VERSION = "0.3.1";
  if (window.__beyondCvContentVersion === CONTENT_VERSION) return;
  window.__beyondCvContentVersion = CONTENT_VERSION;

  const APPLICATIONS_KEY = "applicationRecords";
  const MARKER_CLASS = "bcv-field-marker";
  const FIELD_SELECTOR = [
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='file'])",
    "textarea",
    "select",
    "[contenteditable='true']",
    "[role='combobox']",
    "[aria-haspopup='listbox']",
    "[aria-haspopup='tree']"
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

  const FORM_ITEM_SELECTOR = [
    ".ant-form-item",
    ".arco-form-item",
    ".atsx-form-item",
    ".el-form-item",
    ".semi-form-field",
    ".form-item",
    ".form-group",
    ".field",
    "[class*='form-item']",
    "[class*='FormItem']",
    "[class*='formItem']",
    "[class*='field']",
    "[class*='Field']"
  ].join(",");

  const DROPDOWN_POPUP_SELECTOR = [
    "[role='listbox']",
    "[role='tree']",
    "[role='menu']",
    ".ant-select-dropdown",
    ".ant-cascader-dropdown",
    ".arco-select-popup",
    ".arco-cascader-popup",
    ".semi-select-dropdown",
    ".semi-cascader",
    ".el-select-dropdown",
    "[class*='dropdown']",
    "[class*='Dropdown']",
    "[class*='popup']",
    "[class*='Popup']"
  ].join(",");

  const SELECTABLE_OPTION_SELECTOR = [
    "[role='option']",
    "[role='treeitem']",
    "[role='menuitem']",
    "li",
    "[class*='option']",
    "[class*='Option']",
    "[class*='item']",
    "[class*='Item']"
  ].join(",");

  const SECTION_TITLE_SELECTOR = [
    "h1",
    "h2",
    "h3",
    "h4",
    "legend",
    "[class*='section-title']",
    "[class*='SectionTitle']",
    "[class*='sectionTitle']",
    "[class*='module-title']",
    "[class*='ModuleTitle']",
    "[class*='block-title']",
    "[class*='BlockTitle']",
    "[class*='card-title']",
    "[class*='CardTitle']",
    "[class*='panel-title']",
    "[class*='PanelTitle']",
    "[class*='title']",
    "[class*='Title']"
  ].join(",");

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
      .slice(0, 1)
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

  function cleanContainerText(root, limit = 360) {
    if (!root) return "";
    const clone = root.cloneNode(true);
    clone.querySelectorAll("input, textarea, select, option, [role='combobox'], [aria-haspopup='listbox'], [aria-haspopup='tree'], [contenteditable='true'], script, style, svg, .bcv-field-marker").forEach((node) => node.remove());
    return compact(clone.innerText || clone.textContent || "").slice(0, limit);
  }

  function fieldRoot(el) {
    let current = el;
    for (let depth = 0; current && current !== document.body && depth < 8; depth += 1) {
      if (current.matches?.(FORM_ITEM_SELECTOR)) {
        const text = cleanContainerText(current, 520);
        if (text && text.length <= 520) return current;
      }
      current = current.parentElement;
    }
    return el.closest("label") || el.parentElement;
  }

  function directLabelText(root) {
    if (!root) return "";
    const label = root.querySelector([
      "label",
      "[class*='label']",
      "[class*='Label']",
      "[class*='form-label']",
      "[class*='FormLabel']"
    ].join(","));
    const text = textOf(label, 120);
    if (text) return text;
    return cleanContainerText(root, 160).split(/\s{2,}|：|:/)[0]?.trim().slice(0, 80) || "";
  }

  function nearestSectionText(el) {
    const rect = el.getBoundingClientRect();
    const domTitles = Array.from(document.querySelectorAll(SECTION_TITLE_SELECTOR))
      .filter(isVisible)
      .map((node) => ({ text: textOf(node, 80), rect: node.getBoundingClientRect(), node }))
      .filter((item) => item.text && item.text.length <= 80 && item.rect.bottom <= rect.top + 8);
    const visualTitles = visualTextCache
      .map((item) => {
        const style = window.getComputedStyle(item.parent);
        return {
          text: item.text,
          rect: item.rect,
          scoreBoost: (parseFloat(style.fontSize) >= 16 || Number(style.fontWeight) >= 600) ? -60 : 0
        };
      })
      .filter((item) => item.text.length <= 48 && item.rect.bottom <= rect.top + 8)
      .filter((item) => /信息|经历|经歴|教育|工作|实习|项目|校园|求职|申请|附件|问题|简历|Resume|Experience|Education|Basic|Profile/i.test(item.text));
    return [...domTitles, ...visualTitles]
      .map((item) => ({
        text: item.text,
        score: (rect.top - item.rect.bottom) + Math.abs(rect.left - item.rect.left) * 0.08 + (item.scoreBoost || 0)
      }))
      .sort((a, b) => a.score - b.score)[0]?.text || "";
  }

  function controlSiblings(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FIELD_SELECTOR))
      .filter((item) => !item.disabled && !item.readOnly && isVisible(item));
  }

  function inputRole(el, root, index) {
    const value = compact(el.value || el.textContent || "");
    const text = `${directLabelText(root)} ${cleanContainerText(root, 220)} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("name") || ""} ${el.id || ""}`;
    if (/^\+?\d{1,4}$/.test(value) && /手机|电话|mobile|phone|tel/i.test(text)) return "phone_country_code";
    if (index > 0 && /手机|电话|mobile|phone|tel/i.test(text)) return "phone_number";
    if (el.tagName === "SELECT" || el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox" || el.getAttribute("aria-haspopup") === "tree") return "choice";
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return "long_text";
    return "text";
  }

  function fieldContext(el) {
    const root = fieldRoot(el);
    const siblings = controlSiblings(root);
    const controlIndex = Math.max(0, siblings.indexOf(el));
    const containerText = cleanContainerText(root, 420);
    const visualLabel = nearbyVisualLabelText(el).split(" ").slice(0, 4).join(" ");
    const label = directLabelText(root) || visualLabel;
    return {
      section: nearestSectionText(el),
      label,
      visualLabel,
      containerText,
      controlIndex,
      controlCount: siblings.length || 1,
      inputRole: inputRole(el, root, controlIndex)
    };
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

  function firstKnowledgeItem(profile, type) {
    const items = profile?.knowledgeBase?.[type];
    if (!Array.isArray(items)) return {};
    return items.find((item) => item.included) || items[0] || {};
  }

  function profileFromKnowledgeBase(profile) {
    const knowledgeBase = profile?.knowledgeBase || {};
    const education = firstKnowledgeItem(profile, "education");
    const experience = firstKnowledgeItem(profile, "experience");
    const campus = firstKnowledgeItem(profile, "campus");
    const parsedEducation = parseEducationFields(education.role || "", education.date || "");
    const skills = knowledgeBase.skills || {};
    return {
      name: knowledgeBase.profile?.name || "",
      email: knowledgeBase.profile?.email || "",
      phone: knowledgeBase.profile?.phone || "",
      city: knowledgeBase.profile?.address || "",
      address: knowledgeBase.profile?.address || "",
      school: education.org || "",
      degree: parsedEducation.degree,
      educationType: parsedEducation.educationType,
      educationLevel: parsedEducation.educationLevel,
      educationStart: parsedEducation.educationStart,
      educationEnd: parsedEducation.educationEnd,
      graduation: parsedEducation.educationEnd,
      college: parsedEducation.college,
      major: parsedEducation.major,
      skills: Array.isArray(skills.selected) && skills.selected.length
        ? skills.selected.join("\n")
        : [
          ...(Array.isArray(skills.all) ? skills.all : []),
          skills.technical,
          skills.certs,
          skills.languages
        ].filter(Boolean).join("\n"),
      summary: experience.detail || campus.detail || ""
    };
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

    for (const source of [profile || {}, profileFromKnowledgeBase(profile), FALLBACK_PROFILE]) {
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

  function fieldOptions(el) {
    if (el.tagName === "SELECT") {
      return Array.from(el.options)
        .map((option) => compact(option.textContent || option.value))
        .filter(Boolean)
        .slice(0, 40);
    }
    const ariaOwns = compact(el.getAttribute("aria-owns") || el.getAttribute("aria-controls"));
    const ownedOptions = ariaOwns
      .split(/\s+/)
      .flatMap((id) => Array.from(document.getElementById(id)?.querySelectorAll("[role='option'], li") || []))
      .map((option) => compact(option.textContent))
      .filter(Boolean)
      .slice(0, 40);
    return ownedOptions;
  }

  function controlValue(el) {
    return compact(el?.value || el?.innerText || el?.textContent || "");
  }

  function isSelectLike(el) {
    return el?.tagName === "SELECT"
      || el?.getAttribute("role") === "combobox"
      || el?.getAttribute("aria-haspopup") === "listbox"
      || el?.getAttribute("aria-haspopup") === "tree"
      || /select|cascader|dropdown/i.test(`${el?.className || ""} ${el?.parentElement?.className || ""}`);
  }

  function isTreeLike(el, labelText = "") {
    const text = `${labelText} ${el?.className || ""} ${el?.parentElement?.className || ""}`;
    return /cascader|tree|地区|地点|城市|工作地|location|city/i.test(text);
  }

  function isBytedancePage() {
    return /(^|\.)jobs\.bytedance\.com$/i.test(location.hostname);
  }

  function dropdownPopups() {
    return Array.from(document.querySelectorAll(DROPDOWN_POPUP_SELECTOR)).filter(isVisible);
  }

  function popupOptions() {
    return dropdownPopups()
      .flatMap((popup) => Array.from(popup.querySelectorAll(SELECTABLE_OPTION_SELECTOR)))
      .filter(isVisible)
      .map((node) => ({ node, text: cleanLabelText(node.innerText || node.textContent || "") }))
      .filter((item) => item.text && item.text.length <= 120);
  }

  function closeDropdowns() {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape", code: "Escape" }));
    document.activeElement?.dispatchEvent?.(new KeyboardEvent("keydown", { bubbles: true, key: "Escape", code: "Escape" }));
  }

  async function readDynamicOptions(el) {
    if (!isSelectLike(el)) return fieldOptions(el);
    const existing = fieldOptions(el);
    if (existing.length) return existing;
    const before = document.activeElement;
    el.click();
    await sleep(180);
    const options = popupOptions().map((item) => item.text);
    closeDropdowns();
    before?.focus?.();
    await sleep(40);
    return [...new Set(options)].slice(0, 80);
  }

  async function scrollWholePageForScan() {
    const originalX = window.scrollX;
    const originalY = window.scrollY;
    const viewport = Math.max(360, window.innerHeight || 720);
    const maxY = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    );
    for (let y = 0; y <= maxY; y += Math.floor(viewport * 0.85)) {
      window.scrollTo(originalX, y);
      await sleep(70);
    }
    window.scrollTo(originalX, originalY);
    await sleep(80);
  }

  function semanticLabelText(root, controls) {
    const labelled = directLabelText(root);
    if (labelled) return labelled;
    const first = controls[0];
    const visual = first ? nearbyVisualLabelText(first) : "";
    if (visual) return visual;
    const lines = (root?.innerText || root?.textContent || "")
      .split(/\n+/)
      .map((line) => cleanLabelText(line))
      .filter((line) => line && line.length <= 80);
    return lines[0] || "";
  }

  function semanticSlot(labelText, control, controlIndex = 0, controlCount = 1) {
    const label = cleanLabelText(labelText);
    const text = label.replace(/\s+/g, "");
    if (!text) return null;
    if (/密码|验证码|证件|身份证|护照|薪资|隐私|协议|同意|password|captcha|passport|salary|privacy|terms|agree/i.test(text)) {
      return { key: "blocked", label: "手动确认", blocked: true, confidence: 0 };
    }
    if (/手机|电话|联系电话|mobile|phone|tel/i.test(text)) {
      return controlCount > 1 && controlIndex === 0
        ? { key: "phoneCountryCode", label: "手机国家区号", confidence: 0.96 }
        : { key: "phoneNumber", label: "电话", confidence: 0.97 };
    }
    if (/^邮箱|电子邮件|Email|E-mail|mail/i.test(text)) return { key: "email", label: "邮箱", confidence: 0.98 };
    if (/姓名|真实姓名|中文名|全名|name/i.test(text) && !/获奖|奖项|学校|公司|项目|专业|联系人|紧急/i.test(text)) {
      return { key: "name", label: "姓名", confidence: 0.98 };
    }
    if (/期望工作地点|工作地点|期望地点|期望工作地|城市|地点|location|city/i.test(text)) {
      return { key: "cityPreference", label: "期望工作地点", confidence: 0.95 };
    }
    if (/学校名称|学校|院校|大学|毕业院校|school|university/i.test(text)) return { key: "school", label: "学校名称", confidence: 0.96 };
    if (/学历类型|培养方式|学习形式/i.test(text)) return { key: "educationType", label: "学历类型", confidence: 0.92 };
    if (/^学历$|最高学历|学历层次|educationlevel/i.test(text)) return { key: "educationLevel", label: "学历", confidence: 0.96 };
    if (/^专业|所学专业|major/i.test(text)) return { key: "major", label: "专业", confidence: 0.96 };
    if (/学院|院系|department|faculty|college/i.test(text)) return { key: "college", label: "学院", confidence: 0.9 };
    if (/学位|degree/i.test(text)) return { key: "degree", label: "学位", confidence: 0.9 };
    if (/起止时间|教育时间|在校时间|学习时间|入学时间|开始时间|毕业时间/i.test(text)) {
      return controlCount > 1 && controlIndex > 0
        ? { key: "educationEnd", label: "教育结束时间", confidence: 0.9 }
        : { key: "educationStart", label: "教育起始时间", confidence: 0.9 };
    }
    if (/获奖名称|获奖时间|奖项|奖励|荣誉|证书|语言|描述|工作经历|教育经历|实习|项目/i.test(text)) {
      return null;
    }
    return null;
  }

  function semanticValueFor(profile, key, currentValue = "") {
    if (key === "phoneCountryCode") return /\+?86/.test(currentValue) ? "" : "+86";
    if (key === "phoneNumber") return valueFor(profile, "phone").replace(/^\+?86/, "");
    if (key === "cityPreference") return valueFor(profile, "city") || valueFor(profile, "address");
    return valueFor(profile, key);
  }

  function itemAt(profile, type, index = 0, predicate = null) {
    const items = profile?.knowledgeBase?.[type];
    const list = Array.isArray(items) ? items : [];
    const filtered = predicate ? list.filter(predicate) : list;
    return filtered[index] || list.filter((item) => item.included)[index] || list[index] || {};
  }

  function dateParts(dateText) {
    const matches = [...compact(dateText).matchAll(/\d{4}[./-]\d{1,2}|\d{4}/g)].map((match) => match[0]);
    return {
      start: normalizeMonth(matches[0] || ""),
      end: normalizeMonth(matches[matches.length - 1] || "")
    };
  }

  function compactItemText(item = {}) {
    return [item.org, item.role, item.city, item.date, item.detail]
      .filter(Boolean)
      .map((part) => compact(part))
      .filter(Boolean)
      .join(" | ");
  }

  function isAwardItem(item = {}) {
    return /奖|荣誉|奖学金|冠军|亚军|季军|Scholarship|Award|Honor|Prize/i.test(`${item.org || ""} ${item.role || ""} ${item.detail || ""}`);
  }

  function languageFromProfile(profile) {
    const skills = profile?.knowledgeBase?.skills || {};
    const text = [skills.languages, profile?.skills].filter(Boolean).join("\n");
    if (/英语|English|CET|雅思|托福|IELTS|TOEFL/i.test(text)) return "英语";
    if (/中文|Mandarin|Chinese/i.test(text)) return "中文";
    return "";
  }

  function splitStructuredLine(text) {
    return compact(text)
      .split(/\s*[|｜]\s*/)
      .map((part) => compact(part))
      .filter(Boolean);
  }

  function normalizeExperienceLikeItem(item = {}) {
    const next = {
      org: cleanProfileValue(item.org || item.company || item.school),
      role: cleanProfileValue(item.role || item.title || item.degree),
      city: cleanProfileValue(item.city),
      date: cleanProfileValue(item.date),
      detail: cleanProfileValue(item.detail || item.description)
    };
    const detailParts = splitStructuredLine(next.detail);
    if (detailParts.length >= 4) {
      next.org ||= detailParts[0] || "";
      next.role ||= detailParts[1] || "";
      next.city ||= detailParts[2] || "";
      next.date ||= detailParts[3] || "";
      next.detail = detailParts.slice(4).join(" | ") || next.detail;
    }
    const allText = [next.org, next.role, next.city, next.date, next.detail].filter(Boolean).join(" ");
    next.date ||= allText.match(/\d{4}[./-]\d{1,2}\s*[-至到~—–]\s*(?:\d{4}[./-]\d{1,2}|至今|Present|Now)|\d{4}\s*[-至到~—–]\s*(?:\d{4}|至今|Present|Now)/i)?.[0] || "";
    return next;
  }

  function bytedanceValueFor(profile, key, index = 0) {
    const experience = normalizeExperienceLikeItem(itemAt(profile, "experience", index));
    const experienceDates = dateParts(experience.date || "");
    const award = normalizeExperienceLikeItem(itemAt(profile, "campus", index, isAwardItem));
    const awardDates = dateParts(award.date || "");
    const values = {
      experienceCompany: experience.org || "",
      experienceRole: experience.role || "",
      experienceStart: experienceDates.start,
      experienceEnd: experienceDates.end,
      experienceSummary: experience.detail || compactItemText(experience),
      awardName: award.org || award.role || "",
      awardDate: awardDates.end || awardDates.start,
      awardSummary: award.detail || compactItemText(award),
      language: languageFromProfile(profile)
    };
    if (Object.prototype.hasOwnProperty.call(values, key)) return cleanProfileValue(values[key]);
    return semanticValueFor(profile, key);
  }

  function bytedanceSlotFor(labelText, sectionText, controlIndex = 0, controlCount = 1) {
    const label = cleanLabelText(labelText).replace(/\s+/g, "");
    const section = cleanLabelText(sectionText).replace(/\s+/g, "");
    if (!label) return null;
    if (/公司名称|公司|单位名称|雇主|Employer|Company/i.test(label)) return { key: "experienceCompany", label: "公司名称", confidence: 0.99, repeatGroup: "experience" };
    if (/职位名称|职位|岗位名称|岗位|Role|Position|Title/i.test(label)) return { key: "experienceRole", label: "职位名称", confidence: 0.99, repeatGroup: "experience" };
    if (/描述|工作内容|职责|成果|Description/i.test(label) && /工作经历|实习|经历|Experience/i.test(section)) {
      return { key: "experienceSummary", label: "工作经历描述", confidence: 0.96, repeatGroup: "experience" };
    }
    if (/起止时间|工作时间|开始时间|结束时间|入职|离职|Time|Date/i.test(label) && /工作经历|实习|经历|Experience/i.test(section)) {
      return controlCount > 1 && controlIndex > 0
        ? { key: "experienceEnd", label: "工作结束时间", confidence: 0.96, repeatGroup: "experienceDate" }
        : { key: "experienceStart", label: "工作起始时间", confidence: 0.96, repeatGroup: "experienceDate" };
    }
    if (/获奖名称|奖项名称|奖励名称|荣誉名称|Award|Honor/i.test(label)) return { key: "awardName", label: "获奖名称", confidence: 0.92, repeatGroup: "award" };
    if (/获奖时间|奖励时间|AwardDate|HonorDate/i.test(label)) return { key: "awardDate", label: "获奖时间", confidence: 0.9, repeatGroup: "awardDate" };
    if (/描述|说明|Description/i.test(label) && /获奖|奖励|荣誉|证书|Award|Honor/i.test(section)) return { key: "awardSummary", label: "获奖描述", confidence: 0.88, repeatGroup: "award" };
    if (/语言|语种|Language/i.test(label)) return { key: "language", label: "语言", confidence: 0.86 };
    if (/精通程度|熟练程度|语言能力|Level|Proficiency/i.test(label)) return null;
    return semanticSlot(label, null, controlIndex, controlCount);
  }

  function bytedanceFieldLabel(el) {
    const rect = el.getBoundingClientRect();
    const candidates = visualTextCache
      .map((item) => {
        const labelRect = item.rect;
        const text = cleanLabelText(item.text);
        if (!/姓名|手机|电话|邮箱|工作地点|期望|学校|学历|专业|学院|学位|公司|职位|起止|时间|描述|获奖|奖励|荣誉|语言|Language|Company|Position|Description|Date/i.test(text)) return null;
        const sameRowLeft = overlaps(labelRect.top, labelRect.bottom, rect.top - 10, rect.bottom + 10)
          && labelRect.right <= rect.left + 18
          && rect.left - labelRect.right <= 620;
        const above = labelRect.bottom <= rect.top + 12
          && rect.top - labelRect.bottom <= 96
          && (overlaps(labelRect.left, labelRect.right, rect.left - 48, rect.right + 48)
            || Math.abs(labelRect.left - rect.left) <= 180);
        if (!sameRowLeft && !above) return null;
        return {
          text,
          score: (sameRowLeft ? 0 : 40)
            + Math.abs(labelRect.left - rect.left) * 0.18
            + Math.abs(labelRect.bottom - rect.top)
            + Math.max(0, text.length - 16)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);
    return candidates[0]?.text || "";
  }

  function bytedanceSectionFor(el) {
    const rect = el.getBoundingClientRect();
    return visualTextCache
      .filter((item) => item.rect.bottom <= rect.top + 8)
      .filter((item) => /基本信息|工作经历|实习经历|教育经历|获奖|奖励|语言能力|项目经历|校园|Experience|Education|Award|Language/i.test(item.text))
      .map((item) => ({
        text: item.text,
        score: rect.top - item.rect.bottom + Math.abs(rect.left - item.rect.left) * 0.04
      }))
      .sort((a, b) => a.score - b.score)[0]?.text || nearestSectionText(el);
  }

  function bytedanceControls() {
    const controls = Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .filter((el) => !el.disabled && !el.readOnly && isVisible(el))
      .filter((el) => !el.closest(DROPDOWN_POPUP_SELECTOR))
      .filter((el) => el.type !== "checkbox" && el.type !== "radio" && el.type !== "password" && el.type !== "file");
    return controls.filter((el) => !controls.some((other) => other !== el && other.contains(el) && isSelectLike(other)));
  }

  function bytedanceOccurrence(slot, counters) {
    if (!slot) return 0;
    if (/^experience/.test(slot.repeatGroup || "")) {
      if (slot.key === "experienceCompany") {
        const next = counters.get("experienceNext") || 0;
        counters.set("experienceCurrent", next);
        counters.set("experienceNext", next + 1);
        return next;
      }
      return counters.get("experienceCurrent") || 0;
    }
    if (/^award/.test(slot.repeatGroup || "")) {
      if (slot.key === "awardName") {
        const next = counters.get("awardNext") || 0;
        counters.set("awardCurrent", next);
        counters.set("awardNext", next + 1);
        return next;
      }
      return counters.get("awardCurrent") || 0;
    }
    const key = slot.repeatGroup || slot.key || "default";
    const next = counters.get(key) || 0;
    counters.set(key, next + 1);
    return next;
  }

  async function bytedanceFieldDescriptor(control, index, profile, counters) {
    const root = semanticRoot(control);
    const group = semanticControls(root);
    const groupIndex = Math.max(0, group.indexOf(control));
    const label = bytedanceFieldLabel(control) || semanticLabelText(root, group);
    const section = bytedanceSectionFor(control);
    const labelText = compact([section, label, cleanContainerText(root, 320), fieldText(control)].filter(Boolean).join(" "));
    const slot = bytedanceSlotFor(label || labelText, section, groupIndex, group.length || 1);
    const occurrence = bytedanceOccurrence(slot, counters);
    const id = ensureFieldId(control, index);
    const currentValue = controlValue(control);
    const options = await readDynamicOptions(control);
    const inputKind = isSelectLike(control)
      ? isTreeLike(control, `${section} ${labelText}`) ? "tree_select" : "choice"
      : control.tagName === "TEXTAREA" || control.isContentEditable ? "long_text" : inputRole(control, root, groupIndex);
    const value = slot ? bytedanceValueFor(profile, slot.key, occurrence) : "";
    return {
      id,
      semantic: true,
      adapter: "bytedance",
      tag: control.tagName.toLowerCase(),
      type: control.getAttribute("type") || "",
      name: control.getAttribute("name") || "",
      domId: control.id || "",
      placeholder: control.getAttribute("placeholder") || "",
      ariaLabel: control.getAttribute("aria-label") || "",
      required: Boolean(control.required || control.getAttribute("aria-required") === "true" || /\*/.test(labelText)),
      options,
      section,
      label,
      visualLabel: label,
      containerText: cleanContainerText(root, 420),
      controlIndex: groupIndex,
      controlCount: group.length || 1,
      inputRole: inputKind,
      labelText: labelText || "未识别字段",
      key: slot?.key || "",
      matchLabel: slot?.label || "未匹配",
      value,
      currentValue,
      confidence: slot?.confidence || 0,
      blocked: Boolean(slot?.blocked),
      canFill: Boolean(slot && !slot.blocked && value),
      rect: rectData(control.getBoundingClientRect())
    };
  }

  async function collectBytedancePageFields(profile) {
    const controls = bytedanceControls();
    const counters = new Map();
    const fields = [];
    for (let index = 0; index < controls.length; index += 1) {
      const field = await bytedanceFieldDescriptor(controls[index], index, profile, counters);
      if (field.key || field.blocked) fields.push(field);
    }
    return fields;
  }

  function semanticControls(root) {
    return Array.from(root.querySelectorAll(FIELD_SELECTOR))
      .filter((item) => !item.disabled && !item.readOnly && isVisible(item))
      .filter((item) => !item.closest(DROPDOWN_POPUP_SELECTOR));
  }

  function semanticRoot(el) {
    let current = el;
    let fallback = el.closest("label") || el.parentElement || el;
    for (let depth = 0; current && current !== document.body && depth < 8; depth += 1) {
      const controls = semanticControls(current);
      const text = cleanContainerText(current, 360);
      if (controls.length >= 1 && controls.length <= 2 && text && text.length <= 260) return current;
      if (controls.length >= 1 && controls.length <= 2 && current.matches?.(FORM_ITEM_SELECTOR)) return current;
      if (controls.length > 2) return fallback;
      if (text && text.length <= 160) fallback = current;
      current = current.parentElement;
    }
    return fallback;
  }

  async function semanticFieldDescriptor(root, control, controls, index, profile, serial) {
    const label = semanticLabelText(root, controls);
    const section = nearestSectionText(control);
    const containerText = cleanContainerText(root, 500);
    const labelText = compact([section, label, containerText, fieldText(control)].filter(Boolean).join(" "));
    const match = semanticSlot(label || labelText, control, index, controls.length);
    const id = ensureFieldId(control, serial);
    const currentValue = controlValue(control);
    const options = await readDynamicOptions(control);
    const inputKind = isSelectLike(control)
      ? isTreeLike(control, labelText) ? "tree_select" : "choice"
      : control.tagName === "TEXTAREA" || control.isContentEditable ? "long_text" : inputRole(control, root, index);
    const alreadySatisfied = match?.key === "phoneCountryCode" && /\+?86/.test(currentValue);
    const value = match && !match.blocked && !alreadySatisfied ? semanticValueFor(profile, match.key, currentValue) : "";
    return {
      id,
      semantic: true,
      tag: control.tagName.toLowerCase(),
      type: control.getAttribute("type") || "",
      name: control.getAttribute("name") || "",
      domId: control.id || "",
      placeholder: control.getAttribute("placeholder") || "",
      ariaLabel: control.getAttribute("aria-label") || "",
      required: Boolean(control.required || control.getAttribute("aria-required") === "true" || /\*/.test(labelText)),
      options,
      section,
      label,
      visualLabel: nearbyVisualLabelText(control),
      containerText,
      controlIndex: index,
      controlCount: controls.length || 1,
      inputRole: inputKind,
      labelText: labelText || "未识别字段",
      key: match?.blocked || alreadySatisfied ? "" : match?.key || "",
      matchLabel: match?.label || "未匹配",
      value,
      currentValue,
      confidence: match?.confidence || 0,
      blocked: Boolean(match?.blocked),
      canFill: Boolean(match && !match.blocked && value),
      rect: rectData(control.getBoundingClientRect())
    };
  }

  async function collectSemanticPageFields(profile) {
    const controls = Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .filter((el) => !el.disabled && !el.readOnly && isVisible(el))
      .filter((el) => !el.closest(DROPDOWN_POPUP_SELECTOR));
    const roots = [];
    const seenRoots = new Set();
    controls.forEach((control) => {
      const root = semanticRoot(control);
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root);
      roots.push(root);
    });

    const fields = [];
    let serial = 0;
    for (const root of roots) {
      const group = semanticControls(root);
      if (!group.length) continue;
      const label = semanticLabelText(root, group);
      const labelText = compact([label, cleanContainerText(root, 260)].join(" "));
      const isPhone = /手机|电话|mobile|phone|tel/i.test(labelText);
      const isDateRange = /起止时间|教育时间|在校时间|学习时间/i.test(labelText) && group.length > 1;
      const chosen = (isPhone || isDateRange)
        ? group.slice(0, 2)
        : [group.find((control) => isSelectLike(control)) || group.find((control) => control.tagName === "TEXTAREA") || group[0]];
      for (const control of chosen) {
        const index = Math.max(0, group.indexOf(control));
        fields.push(await semanticFieldDescriptor(root, control, group, index, profile, serial));
        serial += 1;
      }
    }
    return fields;
  }

  async function buildDeepPageModel(profile) {
    clearMarkers();
    await scrollWholePageForScan();
    visualTextCache = buildVisualTextCache();
    const adapter = isBytedancePage() ? "bytedance" : "generic";
    const fields = adapter === "bytedance"
      ? await collectBytedancePageFields(profile)
      : await collectSemanticPageFields(profile);
    return {
      strategy: "semantic-full-page",
      adapter,
      url: location.href,
      title: document.title,
      fields,
      sections: [...new Set(fields.map((field) => field.section).filter(Boolean))].slice(0, 32),
      labels: visualTextCache.map((item) => ({ text: item.text, rect: rectData(item.rect) })),
      matchedCount: fields.filter((field) => field.canFill).length,
      recognizedCount: fields.filter((field) => field.key && !field.blocked).length,
      blockedCount: fields.filter((field) => field.blocked).length
    };
  }

  function fieldDescriptor(el, index, profile) {
    const context = fieldContext(el);
    const labelText = compact([
      context.section ? `栏目:${context.section}` : "",
      context.label ? `字段:${context.label}` : "",
      context.visualLabel ? `最近标签:${context.visualLabel}` : "",
      context.containerText ? `表单项:${context.containerText}` : "",
      fieldText(el)
    ].filter(Boolean).join(" "));
    const match = classifyField(el, labelText);
    const id = ensureFieldId(el, index);
    const value = match && !match.blocked ? valueFor(profile, match.key) : "";
    return {
      id,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      name: el.getAttribute("name") || "",
      domId: el.id || "",
      placeholder: el.getAttribute("placeholder") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
      required: Boolean(el.required || el.getAttribute("aria-required") === "true" || /\*/.test(labelText)),
      options: fieldOptions(el),
      section: context.section,
      label: context.label,
      visualLabel: context.visualLabel,
      containerText: context.containerText,
      controlIndex: context.controlIndex,
      controlCount: context.controlCount,
      inputRole: context.inputRole,
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
      .map((el, index) => fieldDescriptor(el, index, profile));
  }

  function buildPageModel(profile) {
    visualTextCache = buildVisualTextCache();
    const fields = collectPageFields(profile);
    return {
      url: location.href,
      title: document.title,
      fields,
      sections: [...new Set(fields.map((field) => field.section).filter(Boolean))].slice(0, 24),
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function dropdownSearchInputs() {
    const popupInputs = dropdownPopups()
      .flatMap((popup) => Array.from(popup.querySelectorAll([
        "input:not([type='hidden']):not([type='checkbox']):not([type='radio'])",
        "textarea",
        "[contenteditable='true']"
      ].join(","))));
    const active = document.activeElement;
    if (active && (active.matches?.("input, textarea, [contenteditable='true']"))) {
      popupInputs.unshift(active);
    }
    return [...new Set(popupInputs)].filter((item) => !item.disabled && !item.readOnly && isVisible(item));
  }

  async function searchDropdownForValue(value) {
    const searchInput = dropdownSearchInputs()[0];
    if (!searchInput) return false;
    if (searchInput.isContentEditable) {
      searchInput.textContent = value;
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      setNativeValue(searchInput, value);
    }
    await sleep(260);
    return true;
  }

  async function fillComboBox(el, value) {
    const current = compact(el.textContent || el.value || "");
    if (current && (current.includes(value) || value.includes(current))) return true;
    el.click();
    await sleep(150);
    const normalized = value.toLowerCase();
    let option = popupOptions()
      .find((item) => optionMatchesValue(item.text, value));
    if (!option) {
      await searchDropdownForValue(value);
      option = popupOptions().find((item) => optionMatchesValue(item.text, value));
    }
    if (!option) {
      option = Array.from(document.querySelectorAll("[role='option'], li, div, span"))
      .filter(isVisible)
      .map((node) => ({ node, text: compact(node.textContent || "") }))
      .filter((item) => item.text && item.text.length <= 80)
      .find((item) => {
        const text = item.text.toLowerCase();
        return text === normalized || text.includes(normalized) || normalized.includes(text);
      });
    }
    if (!option) return false;
    option.node.click();
    await sleep(80);
    return true;
  }

  function optionMatchesValue(optionText, value) {
    const text = cleanLabelText(optionText).toLowerCase();
    const normalized = cleanLabelText(value).toLowerCase();
    return text === normalized || text.includes(normalized) || normalized.includes(text);
  }

  function clickOptionNode(node) {
    const checkbox = node.querySelector?.("input[type='checkbox'], [role='checkbox'], .ant-checkbox, .arco-checkbox, .semi-checkbox");
    const clickable = checkbox || node.querySelector?.("[class*='content'], [class*='label'], [class*='title']") || node;
    clickable.click();
  }

  async function expandLikelyTreeParent(value) {
    const parentHints = /上海|北京|深圳|广州|杭州|成都|南京|苏州|武汉|西安|重庆|天津|厦门|长沙|郑州|青岛|合肥|宁波|佛山|无锡|东莞/i.test(value)
      ? ["中国大陆", "中国", "Mainland China", "China"]
      : [];
    for (const hint of parentHints) {
      const parent = popupOptions().find((item) => item.text.includes(hint));
      if (!parent) continue;
      const arrow = parent.node.querySelector?.("[class*='arrow'], [class*='expand'], svg") || parent.node;
      arrow.click();
      await sleep(180);
      if (popupOptions().some((item) => optionMatchesValue(item.text, value))) return true;
    }
    return false;
  }

  async function fillTreeSelect(el, value) {
    const current = controlValue(el);
    if (current && (current.includes(value) || value.includes(current))) return true;
    el.click();
    await sleep(180);
    let option = popupOptions().find((item) => optionMatchesValue(item.text, value));
    if (!option) {
      await expandLikelyTreeParent(value);
      option = popupOptions().find((item) => optionMatchesValue(item.text, value));
    }
    if (!option) {
      await searchDropdownForValue(value);
      option = popupOptions().find((item) => optionMatchesValue(item.text, value));
    }
    if (!option) {
      await expandLikelyTreeParent(value);
      option = popupOptions().find((item) => optionMatchesValue(item.text, value));
    }
    if (!option) {
      closeDropdowns();
      return false;
    }
    clickOptionNode(option.node);
    await sleep(120);
    closeDropdowns();
    return true;
  }

  async function fill(fieldsOrIds, profile) {
    let filled = 0;
    const aiFields = Array.isArray(fieldsOrIds) && typeof fieldsOrIds[0] === "object";
    const entries = aiFields
      ? fieldsOrIds
      : (fieldsOrIds || []).map((id) => {
        const el = document.querySelector(`[data-bcv-field-id="${CSS.escape(id)}"]`);
        if (!el) return null;
        const labelText = fieldText(el);
        const match = classifyField(el, labelText);
        return {
          id,
          key: match?.key || "",
          matchLabel: match?.label || "",
          value: match && !match.blocked ? valueFor(profile, match.key) : "",
          blocked: Boolean(match?.blocked)
        };
      }).filter(Boolean);

    for (const field of entries) {
      const id = field.id;
      const el = document.querySelector(`[data-bcv-field-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      if (field.blocked || field.sensitive) continue;
      const value = cleanProfileValue(field.value);
      if (!value) continue;
      if (field.inputRole === "tree_select") {
        if (await fillTreeSelect(el, value)) filled += 1;
        continue;
      }
      if (el.tagName === "SELECT") {
        if (fillSelect(el, value)) filled += 1;
        continue;
      }
      if (field.inputRole === "choice" || el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox") {
        if (await fillComboBox(el, value)) filled += 1;
        continue;
      }
      if (el.type === "checkbox" || el.type === "radio" || el.type === "password" || el.type === "file") continue;
      setNativeValue(el, value);
      markField({ ...field, canFill: true });
      filled += 1;
    }
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

  function beyondCvValue(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function collectBeyondCvItems(type) {
    return [...document.querySelectorAll(`.resume-item[data-type="${type}"]`)]
      .map((item) => ({
        included: Boolean(item.querySelector(".include-check")?.checked),
        org: item.querySelector(".item-school, .item-company")?.value?.trim() || "",
        city: item.querySelector(".item-city")?.value?.trim() || "",
        role: item.querySelector(".item-degree, .item-role")?.value?.trim() || "",
        date: item.querySelector(".item-date")?.value?.trim() || "",
        detail: item.querySelector(".item-detail")?.value?.trim() || ""
      }))
      .filter((item) => item.org || item.city || item.role || item.date || item.detail);
  }

  function collectBeyondCvSkillLines(onlyIncluded = false) {
    return [...document.querySelectorAll(".skill-item")]
      .filter((row) => !onlyIncluded || row.querySelector(".skill-include")?.checked)
      .map((row) => row.querySelector(".skill-input")?.value?.trim() || "")
      .filter(Boolean);
  }

  function collectBeyondCvFamilyRows() {
    return [...document.querySelectorAll(".family-row")]
      .map((row) => ({
        name: row.querySelector(".family-name")?.value?.trim() || "",
        relation: row.querySelector(".family-relation")?.value?.trim() || "",
        position: row.querySelector(".family-position")?.value?.trim() || ""
      }))
      .filter((row) => row.name || row.relation || row.position);
  }

  function collectBeyondCvKnowledgeBase(profile) {
    return {
      source: "beyond-cv-page",
      profile: { ...profile },
      rawText: beyondCvValue("smartPasteText"),
      education: collectBeyondCvItems("education"),
      experience: collectBeyondCvItems("experience"),
      campus: collectBeyondCvItems("campus"),
      skills: {
        selected: collectBeyondCvSkillLines(true),
        all: collectBeyondCvSkillLines(false),
        languages: beyondCvValue("skillsLanguages"),
        technical: beyondCvValue("skillsTechnical"),
        certs: beyondCvValue("skillsCerts"),
        activities: beyondCvValue("skillsActivities"),
        interests: beyondCvValue("skillsInterests")
      },
      familyInfo: document.getElementById("familyInfoToggle")?.checked ? collectBeyondCvFamilyRows() : [],
      updatedAt: new Date().toISOString()
    };
  }

  function exportBeyondCvAiConfig() {
    try {
      const raw = localStorage.getItem("beyondCvAiConfig");
      if (!raw) return null;
      const config = JSON.parse(raw);
      return {
        apiKey: String(config.apiKey || ""),
        model: String(config.model || "deepseek-v4-flash"),
        baseUrl: String(config.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "")
      };
    } catch (_error) {
      return null;
    }
  }

  function exportBeyondCvProfile() {
    const byId = beyondCvValue;
    const name = byId("candidateName");
    if (!name) return null;
    const contact = byId("candidateContact");
    const email = contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = contact.match(/(?:\+?86[\s-]?)?1[3-9]\d{9}/)?.[0]?.replace(/^(\+?86)?\s*/, "") || "";
    const baseProfile = {
      name,
      phone: byId("candidatePhone") || phone,
      email: byId("candidateEmail") || email,
      address: byId("candidateAddress"),
      contact
    };
    const knowledgeBase = collectBeyondCvKnowledgeBase(baseProfile);
    const primaryEducation = knowledgeBase.education.find((item) => item.included) || knowledgeBase.education[0] || {};
    const primaryExperience = knowledgeBase.experience.find((item) => item.included) || knowledgeBase.experience[0] || {};
    const primaryCampus = knowledgeBase.campus.find((item) => item.included) || knowledgeBase.campus[0] || {};
    const rawDegree = primaryEducation.role || "";
    const rawDate = primaryEducation.date || "";
    const parsedEducation = parseEducationFields(rawDegree, rawDate);
    return {
      profileVersion: 2,
      name,
      firstName: name.length > 1 ? name.slice(1) : name,
      lastName: name.length > 1 ? name.slice(0, 1) : "",
      email: baseProfile.email,
      phone: baseProfile.phone,
      city: baseProfile.address,
      address: baseProfile.address,
      school: safeResumeField(primaryEducation.org),
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
      summary: primaryExperience.detail || primaryCampus.detail || "",
      motivation: "",
      knowledgeBase
    };
  }

  function collectBeyondCvSkills() {
    const rows = collectBeyondCvSkillLines(true);
    if (rows.length) return rows.join("\n");
    const byId = beyondCvValue;
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
    if (message?.type === "BCV_DEEP_PAGE_MODEL") {
      buildDeepPageModel(message.profile || {})
        .then(sendResponse)
        .catch((error) => sendResponse({ strategy: "semantic-full-page", fields: [], error: error.message }));
      return true;
    }
    if (message?.type === "BCV_MARK_FIELDS") {
      clearMarkers();
      (message.fields || []).filter((field) => field.canFill || field.blocked || field.key).forEach(markField);
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === "BCV_FILL") {
      fill(message.fields || message.ids || [], message.profile || {})
        .then(sendResponse)
        .catch((error) => sendResponse({ filled: 0, error: error.message }));
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
      sendResponse({ profile: exportBeyondCvProfile(), aiConfig: exportBeyondCvAiConfig() });
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
