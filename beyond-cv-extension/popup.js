let profile = null;
let lastScan = null;

const $ = (id) => document.getElementById(id);
const BCV_SUPABASE_URL = "https://fsdashpviavdlxyicibr.supabase.co";
const BCV_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZGFzaHB2aWF2ZGx4eWljaWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzI3MTksImV4cCI6MjA5NDE0ODcxOX0.vsPRG6YJTUVenmLZsD-txUtIFMuMvxR3RdMtFGZVc6w";
const BCV_SYNC_ENDPOINT = `${BCV_SUPABASE_URL}/functions/v1/bcv-profile-sync`;
const BCV_AUTH_ENDPOINT = `${BCV_SUPABASE_URL}/auth/v1`;
const BCV_APPLICATIONS_KEY = "applicationRecords";
const BCV_PROFILE_KNOWLEDGE_KEY = "profileKnowledgeBase";
const BCV_AI_CONFIG_KEY = "beyondCvAiConfig";
const BCV_AI_DEFAULT_CONFIG = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  apiKey: ""
};
const BCV_AI_SYSTEM_PROMPT = [
  "你是一个招聘大师，最懂候选人与招聘方之间的业务对接需求。",
  "你必须只根据用户资料库、页面字段和招聘页面上下文输出内容。",
  "不能撒谎，不能捏造事实，不能编造学校、经历、项目、证书、技能、数据或成果。",
  "如果资料库里没有明确答案，就返回空值并说明缺少信息。",
  "不得自动同意协议，不得填写验证码、密码、证件号、薪资、政治宗教、婚育等敏感字段。"
].join("\n");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadProfile() {
  const [stored, localStored] = await Promise.all([
    chrome.storage.sync.get(["profile", "syncToken", "authSession"]),
    chrome.storage.local.get(BCV_PROFILE_KNOWLEDGE_KEY)
  ]);
  profile = {
    ...(stored.profile || {}),
    ...(localStored[BCV_PROFILE_KNOWLEDGE_KEY] ? { knowledgeBase: localStored[BCV_PROFILE_KNOWLEDGE_KEY] } : {})
  };
  $("profileName").textContent = profile.name || "未设置姓名";
  $("syncTokenInput").value = stored.syncToken || "";
  const email = stored.authSession?.user?.email || stored.authSession?.email || "";
  $("accountEmailInput").value = email;
  $("accountStatus").textContent = email ? `已登录：${email}` : "未登录，可使用同步码";
  $("logoutAccountButton").disabled = !email;
}

async function loadAiSettings() {
  const stored = await chrome.storage.local.get(BCV_AI_CONFIG_KEY);
  const config = { ...BCV_AI_DEFAULT_CONFIG, ...(stored[BCV_AI_CONFIG_KEY] || {}) };
  $("aiApiKeyInput").value = config.apiKey || "";
  $("aiModelInput").value = config.model || BCV_AI_DEFAULT_CONFIG.model;
  $("aiBaseUrlInput").value = config.baseUrl || BCV_AI_DEFAULT_CONFIG.baseUrl;
  updateAiSettingsStatus(config.apiKey ? "AI Key 已保存" : "未保存 Key");
}

function updateAiSettingsStatus(message) {
  $("aiSettingsStatus").textContent = message;
}

function readAiSettingsFromForm() {
  return {
    apiKey: $("aiApiKeyInput").value.trim(),
    model: $("aiModelInput").value.trim() || BCV_AI_DEFAULT_CONFIG.model,
    baseUrl: $("aiBaseUrlInput").value.trim().replace(/\/+$/, "") || BCV_AI_DEFAULT_CONFIG.baseUrl
  };
}

async function saveAiSettings(config = readAiSettingsFromForm()) {
  await chrome.storage.local.set({ [BCV_AI_CONFIG_KEY]: config });
  updateAiSettingsStatus(config.apiKey ? "AI Key 已保存" : "未保存 Key");
  return config;
}

async function requireAiSettings() {
  const stored = await chrome.storage.local.get(BCV_AI_CONFIG_KEY);
  const config = { ...BCV_AI_DEFAULT_CONFIG, ...(stored[BCV_AI_CONFIG_KEY] || {}) };
  if (!config.apiKey) {
    throw new Error("请先保存 DeepSeek API Key，或在 Beyond CV 页面导入 AI 设置。");
  }
  return {
    ...config,
    baseUrl: String(config.baseUrl || BCV_AI_DEFAULT_CONFIG.baseUrl).replace(/\/+$/, "")
  };
}

async function callDeepSeek(task, prompt, options = {}) {
  const config = await requireAiSettings();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: BCV_AI_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: options.temperature ?? 0.15,
      max_tokens: options.maxTokens ?? 2400,
      response_format: options.json ? { type: "json_object" } : undefined,
      thinking: { type: "disabled" }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error?.message || result.message || `${task}失败：HTTP ${response.status}`);
  }
  const content = result.choices?.[0]?.message?.content || "";
  if (!options.json) return content.trim();
  try {
    return JSON.parse(content);
  } catch (_error) {
    throw new Error(`${task}失败：AI 没有返回有效 JSON`);
  }
}

async function testAiSettings() {
  $("testAiSettingsButton").disabled = true;
  updateAiSettingsStatus("正在测试...");
  try {
    await saveAiSettings();
    const result = await callDeepSeek("AI 设置测试", "请只回复 JSON：{\"ok\":true}", {
      json: true,
      temperature: 0,
      maxTokens: 80
    });
    updateAiSettingsStatus(result.ok ? "AI 连接正常" : "AI 已响应，请继续使用");
  } catch (error) {
    updateAiSettingsStatus(`测试失败：${error.message}`);
  } finally {
    $("testAiSettingsButton").disabled = false;
  }
}

function profileForSyncStorage(profileData) {
  const { knowledgeBase: _knowledgeBase, ...syncProfile } = profileData || {};
  return syncProfile;
}

async function persistProfile(profileData, syncExtras = {}) {
  const syncProfile = profileForSyncStorage(profileData);
  await chrome.storage.sync.set({ ...syncExtras, profile: syncProfile });
  if (profileData?.knowledgeBase) {
    await chrome.storage.local.set({ [BCV_PROFILE_KNOWLEDGE_KEY]: profileData.knowledgeBase });
  } else {
    await chrome.storage.local.remove(BCV_PROFILE_KNOWLEDGE_KEY);
  }
}

async function sendToTab(type, payload = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("没有可用标签页");
  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }
}

function cloudErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return `无法连接云端服务：${BCV_SUPABASE_URL} 当前不可访问，请检查 Supabase 项目、Edge Function 和 CORS 配置。`;
  }
  return message || "云端请求失败";
}

function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function guessRoleFromTitle(title) {
  return compact(title.match(/([^｜|_\-—–,，。]{2,36}(?:实习生|管培生|分析师|工程师|设计师|产品经理|运营|助理|专员|顾问|Intern|Analyst|Engineer|Designer|Manager|Assistant|Specialist|Consultant|Trainee))/i)?.[1] || title.split(/[-｜|_]/)[0] || "");
}

function guessCompanyFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.split(".").filter((part) => !/^(www|jobs|career|careers|campus|apply|ats|hr)$/i.test(part))[0] || "";
  } catch (_error) {
    return "";
  }
}

function applicationId(record) {
  return `${record.company || "company"}-${record.role || "role"}-${record.url || ""}`
    .toLowerCase()
    .replace(/\W+/g, "-")
    .slice(0, 120);
}

async function loadApplicationDraft() {
  const tab = await getActiveTab();
  $("applicationPageHint").textContent = tab?.title || "当前页面";
  let context = {};
  try {
    context = await sendToTab("BCV_APPLICATION_CONTEXT");
  } catch (_error) {
    context = {};
  }
  const company = compact(context.company) || guessCompanyFromUrl(tab?.url || "");
  const role = compact(context.role) || guessRoleFromTitle(tab?.title || "");
  $("applicationCompanyInput").value = company;
  $("applicationRoleInput").value = role;

  const stored = await chrome.storage.local.get(BCV_APPLICATIONS_KEY);
  const records = Array.isArray(stored[BCV_APPLICATIONS_KEY]) ? stored[BCV_APPLICATIONS_KEY] : [];
  $("applicationCount").textContent = String(records.length);
  $("applicationStatus").textContent = records.length ? `已记录 ${records.length} 条投递。` : "记录后会同步到 Beyond CV 投递管理。";
}

async function recordApplication() {
  const tab = await getActiveTab();
  const company = compact($("applicationCompanyInput").value);
  const role = compact($("applicationRoleInput").value);
  if (!company || !role) {
    $("applicationStatus").textContent = "请先确认公司和岗位。";
    return;
  }
  $("recordApplicationButton").disabled = true;
  try {
    const stored = await chrome.storage.local.get(BCV_APPLICATIONS_KEY);
    const records = Array.isArray(stored[BCV_APPLICATIONS_KEY]) ? stored[BCV_APPLICATIONS_KEY] : [];
    const now = new Date().toISOString();
    const record = {
      id: applicationId({ company, role, url: tab?.url }),
      company,
      role,
      status: $("applicationStatusInput").value,
      url: tab?.url || "",
      title: tab?.title || "",
      source: "extension",
      appliedAt: now,
      updatedAt: now
    };
    const existingIndex = records.findIndex((item) => item.id === record.id || (item.url && item.url === record.url));
    const next = existingIndex >= 0
      ? records.map((item, index) => index === existingIndex ? { ...item, ...record, appliedAt: item.appliedAt || record.appliedAt } : item)
      : [record, ...records];
    await chrome.storage.local.set({ [BCV_APPLICATIONS_KEY]: next.slice(0, 200) });
    $("applicationCount").textContent = String(next.length);
    $("applicationStatus").textContent = `已记录：${company} · ${role}`;
  } catch (error) {
    $("applicationStatus").textContent = `记录失败：${error.message}`;
  } finally {
    $("recordApplicationButton").disabled = false;
  }
}

function renderFields(scan) {
  const list = $("fieldList");
  list.innerHTML = "";
  const recognizedCount = scan.fields.filter((field) => field.key && !field.blocked).length;
  const modeLabel = scan.source === "ai" ? "AI" : "规则";
  $("matchCount").textContent = `${scan.matchedCount} 可填 / ${recognizedCount} 已识别 / ${scan.fields.length} 字段 · ${modeLabel}`;

  const usefulFields = scan.fields.filter((field) => field.key || field.blocked);
  if (!usefulFields.length) {
    list.innerHTML = '<div class="empty">没有识别到可自动填入的字段。</div>';
    $("fillButton").disabled = true;
    return;
  }

  usefulFields.forEach((field) => {
    const row = document.createElement("label");
    row.className = `field${field.blocked ? " blocked" : ""}`;
    const checked = field.canFill ? "checked" : "";
    const disabled = field.canFill ? "" : "disabled";
    row.innerHTML = `
      <input type="checkbox" data-field-id="${field.id}" ${checked} ${disabled} />
      <span>
        <p class="field-title">${field.matchLabel}</p>
        <p class="field-meta">${escapeHtml(field.labelText)}</p>
        <p class="field-meta">${field.blocked ? "敏感或协议类字段，需要手动处理" : field.value ? escapeHtml(field.value) : "已识别字段，但资料库里缺少对应值"}</p>
        ${field.reason ? `<p class="field-meta">${escapeHtml(field.reason)}</p>` : ""}
        ${field.confidence ? `<p class="field-meta">置信度 ${Math.round(Number(field.confidence) * 100)}%</p>` : ""}
      </span>
    `;
    list.appendChild(row);
  });
  $("fillButton").disabled = usefulFields.every((field) => !field.canFill);
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function trimForAi(value, limit = 6000) {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  return text.length > limit ? `${text.slice(0, limit)}\n...[已截断]` : text;
}

function addFact(facts, id, slot, label, value, source = "profile") {
  const text = String(value || "").trim();
  if (!text || /^\[[^\]]+\]$/.test(text) || /^xx$/i.test(text)) return;
  if (facts.some((fact) => fact.id === id || (fact.slot === slot && fact.value === text))) return;
  facts.push({ id, slot, label, value: text, source });
}

function splitPhoneFacts(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  const body = digits.replace(/^\+?86/, "");
  return {
    countryCode: raw || body ? "+86" : "",
    number: body || raw
  };
}

function inferEducationLevel(text) {
  const value = String(text || "");
  if (/博士|PhD|Doctor/i.test(value)) return "博士";
  if (/硕士|研究生|Master/i.test(value)) return "硕士";
  if (/本科|学士|Bachelor/i.test(value)) return "本科";
  if (/大专|专科|Associate/i.test(value)) return "大专";
  return "";
}

function itemText(item = {}) {
  return [item.org, item.role, item.city, item.date, item.detail].filter(Boolean).join(" | ");
}

function buildCandidateFacts(profileData = {}) {
  const knowledgeBase = profileData.knowledgeBase || {};
  const kbProfile = knowledgeBase.profile || {};
  const facts = [];
  const name = profileData.name || kbProfile.name || "";
  const phone = profileData.phone || kbProfile.phone || "";
  const phoneParts = splitPhoneFacts(phone);

  addFact(facts, "profile.name", "name", "姓名", name);
  if (name.length > 1) {
    addFact(facts, "profile.lastName", "lastName", "姓", profileData.lastName || name.slice(0, 1));
    addFact(facts, "profile.firstName", "firstName", "名", profileData.firstName || name.slice(1));
  }
  addFact(facts, "profile.email", "email", "邮箱", profileData.email || kbProfile.email);
  addFact(facts, "profile.phoneCountryCode", "phoneCountryCode", "手机国家区号", phoneParts.countryCode);
  addFact(facts, "profile.phoneNumber", "phoneNumber", "手机号主体", phoneParts.number);
  addFact(facts, "profile.cityPreference", "cityPreference", "期望/当前城市", profileData.city || profileData.address || kbProfile.address);
  addFact(facts, "profile.address", "address", "地址", profileData.address || kbProfile.address);

  const education = Array.isArray(knowledgeBase.education) ? knowledgeBase.education : [];
  const primaryEducation = education.find((item) => item.included) || education[0] || {};
  addFact(facts, "education.0.school", "school", "学校名称", profileData.school || primaryEducation.org, "education");
  addFact(facts, "education.0.degree", "degree", "学位", profileData.degree || primaryEducation.role, "education");
  addFact(facts, "education.0.educationLevel", "educationLevel", "学历", profileData.educationLevel || inferEducationLevel(primaryEducation.role), "education");
  addFact(facts, "education.0.college", "college", "学院", profileData.college, "education");
  addFact(facts, "education.0.major", "major", "专业", profileData.major, "education");
  addFact(facts, "education.0.start", "educationStart", "教育开始时间", profileData.educationStart, "education");
  addFact(facts, "education.0.end", "educationEnd", "教育结束时间", profileData.educationEnd || profileData.graduation, "education");
  education.slice(0, 8).forEach((item, index) => {
    addFact(facts, `education.${index}.school`, "school", `学校 ${index + 1}`, item.org, "education");
    addFact(facts, `education.${index}.degree`, "degree", `学历/学位 ${index + 1}`, item.role, "education");
    addFact(facts, `education.${index}.date`, "educationDate", `教育时间 ${index + 1}`, item.date, "education");
    addFact(facts, `education.${index}.summary`, "educationSummary", `教育经历 ${index + 1}`, itemText(item), "education");
  });

  const experience = Array.isArray(knowledgeBase.experience) ? knowledgeBase.experience : [];
  experience.slice(0, 12).forEach((item, index) => {
    addFact(facts, `experience.${index}.company`, "company", `公司 ${index + 1}`, item.org, "experience");
    addFact(facts, `experience.${index}.role`, "role", `岗位 ${index + 1}`, item.role, "experience");
    addFact(facts, `experience.${index}.date`, "experienceDate", `工作时间 ${index + 1}`, item.date, "experience");
    addFact(facts, `experience.${index}.summary`, "summary", `工作经历 ${index + 1}`, itemText(item), "experience");
  });

  const campus = Array.isArray(knowledgeBase.campus) ? knowledgeBase.campus : [];
  campus.slice(0, 8).forEach((item, index) => {
    addFact(facts, `campus.${index}.summary`, "summary", `校园/项目经历 ${index + 1}`, itemText(item), "campus");
  });

  const skills = knowledgeBase.skills || {};
  const skillLines = [
    ...(Array.isArray(skills.selected) ? skills.selected : []),
    ...(Array.isArray(skills.all) ? skills.all : []),
    profileData.skills,
    skills.technical,
    skills.certs,
    skills.languages,
    skills.activities,
    skills.interests
  ].filter(Boolean);
  addFact(facts, "profile.skills", "skills", "技能", [...new Set(skillLines)].join("\n"));
  return facts;
}

function profileForAi(profileData = {}) {
  const knowledgeBase = profileData.knowledgeBase || {};
  const facts = buildCandidateFacts(profileData);
  return {
    facts,
    profile: {
      name: profileData.name || knowledgeBase.profile?.name || "",
      firstName: profileData.firstName || "",
      lastName: profileData.lastName || "",
      email: profileData.email || knowledgeBase.profile?.email || "",
      phone: profileData.phone || knowledgeBase.profile?.phone || "",
      city: profileData.city || profileData.address || knowledgeBase.profile?.address || "",
      address: profileData.address || knowledgeBase.profile?.address || "",
      school: profileData.school || "",
      degree: profileData.degree || "",
      educationLevel: profileData.educationLevel || "",
      educationStart: profileData.educationStart || "",
      educationEnd: profileData.educationEnd || "",
      college: profileData.college || "",
      major: profileData.major || "",
      skills: profileData.skills || ""
    },
    knowledgeBase: {
      rawText: trimForAi(knowledgeBase.rawText || "", 8000),
      education: knowledgeBase.education || [],
      experience: knowledgeBase.experience || [],
      campus: knowledgeBase.campus || [],
      skills: knowledgeBase.skills || {},
      familyInfo: knowledgeBase.familyInfo || []
    }
  };
}

function pageModelForAi(model) {
  return {
    url: model.url,
    title: model.title,
    sections: model.sections || [],
    fields: (model.fields || []).slice(0, 80).map((field) => ({
      id: field.id,
      tag: field.tag,
      type: field.type,
      name: field.name,
      domId: field.domId,
      section: field.section || "",
      label: field.label || "",
      containerText: trimForAi(field.containerText || "", 500),
      controlIndex: field.controlIndex || 0,
      controlCount: field.controlCount || 1,
      inputRole: field.inputRole || "",
      labelText: trimForAi(field.labelText, 500),
      placeholder: field.placeholder,
      ariaLabel: field.ariaLabel,
      currentValue: trimForAi(field.currentValue, 240),
      required: field.required,
      options: field.options || [],
      rect: field.rect
    }))
  };
}

function aiScanPrompt(model, profileData) {
  return `
请分析招聘网站申请表字段，并从候选人在 Beyond CV 中维护的完整资料库里选择真实可填内容。

硬性规则：
- 只能使用“资料库”里已经存在的信息，不要猜测、不要编造。
- 识别字段时优先看 section、label、containerText、controlIndex 和 inputRole；不要只看 input 的 placeholder/name/id。
- 每个栏目要分别理解：基本信息只填基础联系方式，工作经历/教育经历只填对应经历字段，开放题/BQ 才使用长文本经历素材。
- 不要把邮箱填到工作地点、不要把姓名填到手机号、不要用字段当前值作为候选人事实。
- 如果字段是手机号国家区号且已显示 +86，可以跳过；手机号输入框才填手机号主体。
- 如果同一个表单项有多个控件，例如“手机号码”的国家区号和号码主体，只给号码主体字段返回手机号，国家区号字段 value 留空。
- select/combobox 字段必须优先匹配 options 中已有选项；没有合适选项就留空。
- 不填写密码、验证码、证件号、身份证/护照、薪资、政治宗教、婚育、隐私协议/同意勾选等敏感或协议字段。
- 工作经历、教育经历、开放题、BQ、动机类字段可以从完整资料库选择最相关真实经历；若缺少事实，留空。
- 输出 JSON，不要 Markdown。

JSON 结构：
{
  "fields": [
    {
      "id": "页面字段 id",
      "slot": "name|phoneCountryCode|phoneNumber|email|cityPreference|school|educationLevel|degree|major|college|educationStart|educationEnd|skills|summary|motivation|custom|skip",
      "factId": "必须引用资料库 facts 里的 id；不能填写则为空",
      "label": "给用户看的中文字段名",
      "value": "可选；必须与 factId 对应事实一致，不能填则为空字符串",
      "confidence": 0.0,
      "blocked": false,
      "sensitive": false,
      "reason": "简短说明为什么这样匹配，或为什么跳过"
    }
  ]
}

页面字段模型：
${trimForAi(pageModelForAi(model), 12000)}

资料库和可引用 facts：
${trimForAi(profileForAi(profileData), 14000)}
`;
}

function isSensitiveAiField(field) {
  const text = `${field.label || ""} ${field.key || ""} ${field.reason || ""}`.toLowerCase();
  return /password|captcha|verification|id\s*number|passport|salary|compensation|privacy|terms|consent|agree|身份证|护照|证件|验证码|密码|薪资|政治|宗教|婚育|婚姻|隐私|协议|同意/.test(text);
}

function normalizeSlot(slot) {
  const value = String(slot || "").trim();
  const aliases = {
    phone: "phoneNumber",
    mobile: "phoneNumber",
    phoneNumber: "phoneNumber",
    telephone: "phoneNumber",
    phoneCountryCode: "phoneCountryCode",
    countryCode: "phoneCountryCode",
    email: "email",
    mail: "email",
    city: "cityPreference",
    location: "cityPreference",
    workLocation: "cityPreference",
    expectedLocation: "cityPreference",
    school: "school",
    university: "school",
    education: "educationLevel",
    educationLevel: "educationLevel",
    degree: "degree",
    major: "major",
    college: "college",
    department: "college",
    educationStart: "educationStart",
    educationEnd: "educationEnd",
    graduation: "educationEnd",
    skills: "skills",
    summary: "summary",
    motivation: "motivation",
    name: "name",
    firstName: "firstName",
    lastName: "lastName"
  };
  return aliases[value] || value;
}

function fieldStrongText(field) {
  return [
    field.visualLabel,
    field.label,
    field.placeholder,
    field.name,
    field.domId,
    field.ariaLabel
  ].filter(Boolean).join(" ");
}

function validationText(field) {
  return [
    field.section,
    fieldStrongText(field),
    field.labelText,
    field.containerText
  ].filter(Boolean).join(" ");
}

function hasFieldSignal(text) {
  return /手机|电话|邮箱|电子邮件|姓名|真实姓名|中文名|工作地点|期望地点|期望工作地|城市|地点|学校|院校|大学|毕业院校|学历|最高学历|学位|学院|院系|专业|入学|开始|起始|毕业|结束|终止|技能|能力|经历|介绍|总结|开放题|问题|动机|优势|mobile|phone|tel|email|e-mail|mail|name|location|city|school|university|education|degree|department|faculty|college|major|start|from|end|to|graduat|skills|summary|motivation|question/i.test(String(text || ""));
}

function isChoiceLikeField(field) {
  return field.tag === "select"
    || field.inputRole === "choice"
    || /combobox|listbox/i.test(`${field.role || ""} ${field.ariaRole || ""}`)
    || Boolean(field.options?.length);
}

function citySignal(text) {
  return /期望工作地点|工作地点|期望地点|期望工作地|城市|地点|location|city|上海|北京|深圳|广州|杭州|成都|南京|苏州|武汉|西安|重庆|天津|厦门|长沙|郑州|青岛|合肥|宁波|佛山|无锡|东莞|shanghai|beijing|shenzhen|guangzhou|hangzhou|chengdu/i.test(String(text || ""));
}

function fieldLooksLikeCityChoice(field) {
  const text = [
    validationText(field),
    field.currentValue,
    ...(Array.isArray(field.options) ? field.options : [])
  ].filter(Boolean).join(" ");
  return isChoiceLikeField(field) && citySignal(text);
}

function expectedSlotsForField(field) {
  const strongText = fieldStrongText(field);
  const broadText = validationText(field);
  const text = hasFieldSignal(strongText) ? strongText : broadText;
  if (/密码|验证码|证件|身份证|护照|薪资|隐私|协议|同意|password|captcha|passport|salary|privacy|terms|agree/i.test(broadText)) return ["blocked"];
  if (field.inputRole === "phone_country_code") return ["phoneCountryCode"];
  if (field.inputRole === "phone_number") return ["phoneNumber"];
  if (fieldLooksLikeCityChoice(field)) return ["cityPreference"];
  if (field.controlCount > 1 && (/手机|电话|mobile|phone|tel/i.test(text) || /手机|电话|mobile|phone|tel/i.test(broadText))) {
    return Number(field.controlIndex) === 0 ? ["phoneCountryCode"] : ["phoneNumber"];
  }
  if (/手机|电话|mobile|phone|tel/i.test(text)) return ["phoneNumber", "phoneCountryCode"];
  if (citySignal(text)) return ["cityPreference"];
  if (/邮箱|电子邮件|email|e-mail|mail/i.test(text)) return ["email"];
  if (/姓名|真实姓名|中文名|name/i.test(text) && !/公司|学校|联系人|紧急/i.test(text)) return ["name"];
  if (/学校|院校|大学|毕业院校|school|university/i.test(text)) return ["school"];
  if (/学历|最高学历|education level/i.test(text) && !/学历类型|培养方式/i.test(text)) return ["educationLevel"];
  if (/学位|degree/i.test(text)) return ["degree"];
  if (/学院|院系|department|faculty|college/i.test(text)) return ["college"];
  if (/专业|major/i.test(text)) return ["major"];
  if (/入学|开始|起始|start|from/i.test(text) && /教育|学校|学历|education/i.test(text)) return ["educationStart"];
  if (/毕业|结束|终止|end|to|graduat/i.test(text) && /教育|学校|学历|education/i.test(text)) return ["educationEnd"];
  if (/技能|能力|skills|tool/i.test(text)) return ["skills"];
  if (/经历|介绍|总结|开放题|问题|动机|优势|summary|motivation|question/i.test(text)) return ["summary", "motivation"];
  return [];
}

function optionMatch(options = [], value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || !options.length) return value;
  const match = options.find((option) => {
    const text = String(option || "").trim().toLowerCase();
    return text === normalized || text.includes(normalized) || normalized.includes(text);
  });
  return match || "";
}

function normalizeValidatedValue(slot, value, field) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (slot === "phoneNumber") {
    const body = text.replace(/[^\d+]/g, "").replace(/^\+?86/, "");
    return /^1[3-9]\d{9}$/.test(body) ? body : "";
  }
  if (slot === "phoneCountryCode") {
    if (/^\+?86$/.test(text) || String(field.currentValue || "").includes("+86")) return "+86";
    return "";
  }
  if (slot === "email") return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text) ? text : "";
  if (slot === "cityPreference") {
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text) || /^1[3-9]\d{9}$/.test(text)) return "";
    return optionMatch(field.options, text) || (!field.options?.length ? text : "");
  }
  if (field.options?.length && (field.tag === "select" || field.inputRole === "choice")) {
    return optionMatch(field.options, text);
  }
  return text;
}

function validateAiAssignment(item, base, factsById, factsBySlot) {
  const requestedSlot = normalizeSlot(item.slot || item.key);
  if (!requestedSlot || requestedSlot === "skip") {
    return { slot: "", value: "", blocked: false, canFill: false, reason: item.reason || "AI 选择跳过" };
  }
  if (isSensitiveAiField(item)) {
    return { slot: requestedSlot, value: "", blocked: true, canFill: false, reason: "敏感或协议类字段，已阻止自动填写" };
  }
  const expectedSlots = expectedSlotsForField(base);
  if (expectedSlots.includes("blocked")) {
    return { slot: requestedSlot, value: "", blocked: true, canFill: false, reason: "本地规则判定为敏感字段" };
  }
  if (expectedSlots.length && !expectedSlots.includes(requestedSlot)) {
    return {
      slot: requestedSlot,
      value: "",
      blocked: false,
      canFill: false,
      reason: `本地校验拒绝：该字段期望 ${expectedSlots.join("/")}，AI 返回 ${requestedSlot}`
    };
  }
  if (isChoiceLikeField(base) && ["email", "phoneNumber", "name", "firstName", "lastName"].includes(requestedSlot)) {
    return {
      slot: requestedSlot,
      value: "",
      blocked: false,
      canFill: false,
      reason: "本地校验拒绝：下拉/选择控件不能填入联系方式或姓名"
    };
  }
  if (fieldLooksLikeCityChoice(base) && requestedSlot !== "cityPreference") {
    return {
      slot: requestedSlot,
      value: "",
      blocked: false,
      canFill: false,
      reason: "本地校验拒绝：地点控件只能填入城市/地点事实"
    };
  }
  let fact = factsById.get(String(item.factId || ""));
  if (!fact && item.value) {
    fact = (factsBySlot.get(requestedSlot) || []).find((candidate) => candidate.value === String(item.value).trim());
  }
  if (fact && normalizeSlot(fact.slot) !== requestedSlot) {
    return {
      slot: requestedSlot,
      value: "",
      blocked: false,
      canFill: false,
      reason: `本地校验拒绝：fact ${fact.id} 属于 ${fact.slot}，不能填入 ${requestedSlot}`
    };
  }
  if (!fact && !["phoneCountryCode"].includes(requestedSlot)) {
    return { slot: requestedSlot, value: "", blocked: false, canFill: false, reason: "AI 未引用资料库 factId，已拒绝" };
  }
  const factValue = fact?.value || item.value || "";
  const value = normalizeValidatedValue(requestedSlot, factValue, base);
  if (!value) {
    return { slot: requestedSlot, value: "", blocked: false, canFill: false, reason: "本地格式/选项校验未通过" };
  }
  if (requestedSlot === "phoneCountryCode" && String(base.currentValue || "").includes(value)) {
    return { slot: requestedSlot, value: "", blocked: false, canFill: false, reason: "国家区号已存在，无需填写" };
  }
  return { slot: requestedSlot, value, blocked: false, canFill: true, reason: item.reason || `引用 ${fact?.id || "本地事实"}` };
}

function normalizeAiScanResult(result, model, facts = []) {
  const pageFields = new Map((model.fields || []).map((field) => [field.id, field]));
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const factsBySlot = facts.reduce((map, fact) => {
    const slot = normalizeSlot(fact.slot);
    if (!map.has(slot)) map.set(slot, []);
    map.get(slot).push(fact);
    return map;
  }, new Map());
  const aiFields = Array.isArray(result.fields) ? result.fields : [];
  const normalized = aiFields
    .map((item) => {
      const base = pageFields.get(String(item.id || ""));
      if (!base) return null;
      const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
      const validated = validateAiAssignment(item, base, factsById, factsBySlot);
      const acceptedKey = validated.canFill || validated.blocked ? validated.slot : "";
      return {
        ...base,
        key: acceptedKey,
        factId: String(item.factId || ""),
        matchLabel: String(acceptedKey ? (item.label || validated.slot || "AI 识别字段") : "本地校验已拒绝").slice(0, 80),
        value: validated.value.slice(0, 3000),
        confidence,
        blocked: Boolean(item.blocked || item.sensitive || validated.blocked),
        sensitive: Boolean(item.sensitive),
        reason: String(validated.reason || item.reason || "").slice(0, 180),
        source: "ai",
        canFill: Boolean(validated.canFill && confidence >= 0.55)
      };
    })
    .filter(Boolean);
  const byId = new Map(normalized.map((field) => [field.id, field]));
  const fields = (model.fields || []).map((field) => byId.get(field.id) || {
    ...field,
    key: "",
    matchLabel: "AI 未匹配",
    value: "",
    confidence: 0,
    blocked: false,
    canFill: false,
    source: "ai"
  });
  return {
    source: "ai",
    url: model.url,
    title: model.title,
    fields,
    matchedCount: fields.filter((field) => field.canFill).length,
    blockedCount: fields.filter((field) => field.blocked).length
  };
}

function normalizeSemanticScanResult(model) {
  const fields = (model.fields || []).map((field) => ({
    ...field,
    source: "semantic",
    confidence: Number(field.confidence) || 0,
    canFill: Boolean(field.canFill && field.value && !field.blocked)
  }));
  return {
    source: "semantic",
    strategy: model.strategy || "semantic-full-page",
    url: model.url,
    title: model.title,
    fields,
    matchedCount: fields.filter((field) => field.canFill).length,
    blockedCount: fields.filter((field) => field.blocked).length
  };
}

async function scanFullPageModel() {
  const model = await sendToTab("BCV_DEEP_PAGE_MODEL", { profile });
  if (model?.error) throw new Error(model.error);
  if (model?.strategy === "semantic-full-page") return normalizeSemanticScanResult(model);
  return aiScanPageModel(model);
}

async function aiScanPageModel(model) {
  const facts = buildCandidateFacts(profile || {});
  const result = await callDeepSeek("AI 字段识别", aiScanPrompt(model, profile || {}), {
    json: true,
    temperature: 0.12,
    maxTokens: 4200
  });
  return normalizeAiScanResult(result, model, facts);
}

async function scanCurrentPage() {
  $("scanButton").disabled = true;
  $("scanStatus").textContent = "正在滚动读取整页表单，并建立语义字段图谱...";
  try {
    const tab = await getActiveTab();
    $("pageTitle").textContent = tab?.title || "当前页面";
    lastScan = await scanFullPageModel();
    await sendToTab("BCV_MARK_FIELDS", { fields: lastScan.fields });
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `整页扫描完成：${lastScan.matchedCount} 个字段可填，${lastScan.blockedCount} 个字段需手动处理。请检查后再填写。`;
    renderFields(lastScan);
  } catch (error) {
    $("scanStatus").textContent = `整页扫描失败：${error.message}`;
    $("fieldList").innerHTML = '<div class="empty">当前页面暂未生成可填字段。</div>';
  } finally {
    $("scanButton").disabled = false;
  }
}

async function fillSelectedFields() {
  const ids = Array.from(document.querySelectorAll("[data-field-id]:checked")).map((input) => input.dataset.fieldId);
  if (!ids.length) return;
  const selectedFields = (lastScan?.fields || []).filter((field) => ids.includes(field.id) && field.canFill);
  $("fillButton").disabled = true;
  $("fillButton").textContent = "填入中...";
  try {
    const result = await sendToTab("BCV_FILL", { fields: selectedFields, profile });
    if (result.error) throw new Error(result.error);
    $("scanStatus").textContent = `已填入 ${result.filled} 个字段。请在页面上检查后再提交。`;
  } catch (error) {
    $("scanStatus").textContent = `填入失败：${error.message}`;
  } finally {
    $("fillButton").textContent = "填入已选 AI 字段";
    $("fillButton").disabled = false;
  }
}

async function clearMarks() {
  await sendToTab("BCV_CLEAR");
  $("scanStatus").textContent = "页面标记已清除。";
}

async function importProfile() {
  $("importProfileButton").disabled = true;
  try {
    const result = await sendToTab("BCV_EXPORT_PROFILE");
    if (!result?.profile) {
      $("scanStatus").textContent = "当前页不是 Beyond CV 简历工作台，未找到可导入资料。";
      return;
    }
    profile = { ...profile, ...result.profile };
    await persistProfile(profile);
    if (result.aiConfig?.apiKey) {
      await saveAiSettings({ ...BCV_AI_DEFAULT_CONFIG, ...result.aiConfig });
      $("aiApiKeyInput").value = result.aiConfig.apiKey;
      $("aiModelInput").value = result.aiConfig.model || BCV_AI_DEFAULT_CONFIG.model;
      $("aiBaseUrlInput").value = result.aiConfig.baseUrl || BCV_AI_DEFAULT_CONFIG.baseUrl;
    }
    $("profileName").textContent = profile.name || "未设置姓名";
    $("scanStatus").textContent = result.aiConfig?.apiKey
      ? "已从 Beyond CV 页面导入资料和 AI 设置。"
      : "已从 Beyond CV 页面导入资料。";
  } finally {
    $("importProfileButton").disabled = false;
  }
}

async function supabaseAuth(path, body) {
  const response = await fetch(`${BCV_AUTH_ENDPOINT}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: BCV_SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.msg || result.error_description || result.error || "账户请求失败");
  return result;
}

async function loginAccount() {
  const email = $("accountEmailInput").value.trim();
  const password = $("accountPasswordInput").value;
  if (!email || !password) {
    $("scanStatus").textContent = "请输入账户邮箱和密码。";
    return;
  }
  $("loginAccountButton").disabled = true;
  try {
    const authSession = await supabaseAuth("/token?grant_type=password", { email, password });
    await chrome.storage.sync.set({ authSession: { ...authSession, email } });
    $("accountStatus").textContent = `已登录：${email}`;
    $("logoutAccountButton").disabled = false;
    $("scanStatus").textContent = "账户已登录，可以从云端同步资料。";
  } catch (error) {
    $("scanStatus").textContent = `登录失败：${cloudErrorMessage(error)}`;
  } finally {
    $("loginAccountButton").disabled = false;
  }
}

async function logoutAccount() {
  await chrome.storage.sync.remove("authSession");
  $("accountPasswordInput").value = "";
  $("accountStatus").textContent = "未登录，可使用同步码";
  $("logoutAccountButton").disabled = true;
  $("scanStatus").textContent = "已退出账户。";
}

async function syncFromCloud() {
  $("cloudSyncButton").disabled = true;
  $("cloudSyncButton").textContent = "同步中...";
  try {
    const stored = await chrome.storage.sync.get(["authSession", "syncToken"]);
    const typedToken = $("syncTokenInput").value.trim();
    const token = typedToken || stored.syncToken || "";
    const accessToken = stored.authSession?.access_token || "";
    if (!accessToken && !token) {
      $("scanStatus").textContent = "请先登录账户，或粘贴同步码。";
      return;
    }
    const response = await fetch(BCV_SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: BCV_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken || BCV_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ action: "get", token })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "同步失败");
    profile = { ...profile, ...(result.profile || {}) };
    const updates = {};
    if (result.token || token) updates.syncToken = result.token || token;
    await persistProfile(profile, updates);
    $("profileName").textContent = profile.name || "未设置姓名";
    $("syncTokenInput").value = updates.syncToken || "";
    $("scanStatus").textContent = `已从云端同步资料：${profile.name || "未命名"}。`;
  } catch (error) {
    $("scanStatus").textContent = `云端同步失败：${cloudErrorMessage(error)}`;
  } finally {
    $("cloudSyncButton").textContent = "从云端同步资料";
    $("cloudSyncButton").disabled = false;
  }
}

async function directFillPage() {
  $("directFillButton").disabled = true;
  $("directFillButton").textContent = "全表扫描中...";
  try {
    lastScan = await scanFullPageModel();
    await sendToTab("BCV_MARK_FIELDS", { fields: lastScan.fields });
    renderFields(lastScan);
    const fillable = lastScan.fields.filter((field) => field.canFill);
    const result = await sendToTab("BCV_FILL", { fields: fillable, profile });
    if (result.error) throw new Error(result.error);
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `整页扫描并填入 ${result.filled} 项。请逐项检查后再提交。`;
  } catch (error) {
    $("scanStatus").textContent = `整页填入失败：${error.message}`;
  } finally {
    $("directFillButton").textContent = "全表扫描并填入";
    $("directFillButton").disabled = false;
  }
}

async function directFillInPage(profileData) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("没有可用标签页");
  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: [profileData],
    func: async (rawProfile) => {
      const fallback = {
        name: "",
        email: "",
        phone: "",
        city: "",
        school: "",
        educationType: "",
        educationLevel: "",
        degree: "",
        college: "",
        major: "",
        educationStart: "",
        educationEnd: ""
      };
      const profile = { ...fallback, ...(rawProfile || {}) };
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const compact = (text) => String(text || "").replace(/\s+/g, " ").trim();
      const clean = (text) => compact(text)
        .replace(/\*/g, "")
        .replace(/为必填|必填|请选择|请填写|请输入/g, "")
        .trim();
      const visible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const isTextInput = (el) => /INPUT|TEXTAREA/.test(el.tagName) || el.isContentEditable;
      const isSelectLike = (el) => el.tagName === "SELECT"
        || (!isTextInput(el) && (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox"));
      const overlaps = (aStart, aEnd, bStart, bEnd) => Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
      const nativeSet = (el, value) => {
        if (el.isContentEditable) {
          el.textContent = value;
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
        return true;
      };
      const fieldSelector = [
        "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='file'])",
        "textarea",
        "select",
        "[contenteditable='true']",
        "[role='combobox']",
        "[aria-haspopup='listbox']"
      ].join(",");
      const labels = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = clean(node.nodeValue);
        const parent = node.parentElement;
        if (parent && visible(parent) && text && text.length <= 64 && /[\u4e00-\u9fa5A-Za-z]/.test(text)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          range.detach();
          if (rect.width > 0 && rect.height > 0) labels.push({ text, rect });
        }
        node = walker.nextNode();
      }
      const controls = () => Array.from(document.querySelectorAll(fieldSelector))
        .filter((el) => !el.disabled && !el.readOnly && visible(el));
      const add = (items, value) => {
        const text = clean(value);
        if (text && !items.includes(text)) items.push(text);
      };
      const textOf = (node, limit = 160) => clean(node?.innerText || node?.textContent || "").slice(0, limit);
      const domLabelText = (el) => {
        const parts = [];
        add(parts, el.getAttribute("aria-label"));
        add(parts, el.getAttribute("placeholder"));
        add(parts, el.getAttribute("title"));
        add(parts, el.getAttribute("data-label") || el.getAttribute("data-name"));

        const labelledBy = clean(el.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
        labelledBy.forEach((id) => add(parts, textOf(document.getElementById(id))));

        if (el.id) {
          add(parts, textOf(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)));
        }

        const wrappedLabel = el.closest("label");
        if (wrappedLabel) add(parts, textOf(wrappedLabel, 220));

        let formItem = el.closest([
          ".ant-form-item",
          ".el-form-item",
          ".arco-form-item",
          ".semi-form-field",
          ".form-item",
          ".form-group",
          ".field",
          "[class*='formItem']",
          "[class*='FormItem']",
          "[class*='form-item']",
          "[class*='field']",
          "[class*='Field']"
        ].join(","));
        if (!formItem) {
          let ancestor = el.parentElement;
          for (let depth = 0; ancestor && ancestor !== document.body && depth < 4; depth += 1) {
            const labelLike = ancestor.querySelector(":scope > label, :scope > .field-label, :scope > [class*='label'], :scope > [class*='Label'], :scope > [class*='title'], :scope > [class*='Title']");
            if (labelLike) {
              formItem = ancestor;
              break;
            }
            ancestor = ancestor.parentElement;
          }
        }
        if (formItem) {
          const labelLike = formItem.querySelector("label, .field-label, [class*='label'], [class*='Label'], [class*='title'], [class*='Title']");
          add(parts, textOf(labelLike, 180));
          const itemText = textOf(formItem, 260);
          if (itemText.length <= 260) add(parts, itemText);
        }

        let current = el;
        for (let depth = 0; current && current !== document.body && depth < 5; depth += 1) {
          if (formItem && current === formItem) break;
          let prev = current.previousElementSibling;
          for (let step = 0; prev && step < 4; step += 1) {
            const prevText = textOf(prev, 160);
            if (prevText.length <= 80) add(parts, prevText);
            prev = prev.previousElementSibling;
          }
          const parent = current.parentElement;
          if (parent) {
            const nodes = Array.from(parent.childNodes);
            const index = nodes.indexOf(current);
            nodes.slice(Math.max(0, index - 5), index).reverse().forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) add(parts, node.textContent);
              if (node.nodeType === Node.ELEMENT_NODE) {
                const text = textOf(node, 120);
                if (text.length <= 80) add(parts, text);
              }
            });
          }
          current = current.parentElement;
        }

        add(parts, el.getAttribute("name"));
        add(parts, el.getAttribute("id"));
        return parts.join(" ");
      };
      const fieldModel = () => controls().map((el, index) => {
        const rect = el.getBoundingClientRect();
        const domText = domLabelText(el);
        const visualText = labels
          .filter((label) => {
            const sameRowLeft = overlaps(label.rect.top, label.rect.bottom, rect.top - 10, rect.bottom + 10)
              && label.rect.right <= rect.left + 14
              && rect.left - label.rect.right <= 520;
            const above = rect.top >= label.rect.bottom - 8
              && rect.top - label.rect.bottom <= 180
              && (overlaps(label.rect.left, label.rect.right, rect.left - 50, rect.right + 50)
                || Math.abs(rect.left - label.rect.left) <= 180);
            return sameRowLeft || above;
          })
          .slice(0, 6)
          .map((label) => label.text)
          .join(" ");
        return {
          el,
          index,
          rect,
          type: el.tagName.toLowerCase(),
          currentValue: compact(el.value || el.textContent || ""),
          domText,
          visualText,
          text: `${domText} ${visualText}`
        };
      });
      const matchLabel = (labelText, aliases, excludes = []) => {
        const text = clean(labelText);
        if (excludes.some((item) => text.includes(item))) return false;
        return aliases.some((alias) => text === alias || text.includes(alias));
      };
      const candidatesFromModel = (target, model) => model
        .filter((item) => matchLabel(item.text, target.aliases, target.excludes || []))
        .filter((item) => target.select || !isSelectLike(item.el))
        .map((item) => {
          const domHit = matchLabel(item.domText, target.aliases, target.excludes || []);
          return {
            el: item.el,
            rect: item.rect,
            label: item.text,
            score: (domHit ? 0 : 45) + item.index * 0.01 + (item.currentValue && item.currentValue !== "+86" ? 8 : 0)
          };
        });
      const candidatesNear = (target) => {
        const matchedLabels = labels.filter((label) => matchLabel(label.text, target.aliases, target.excludes || []));
        const out = [];
        matchedLabels.forEach((label) => {
          controls().forEach((el) => {
            if (!target.select && isSelectLike(el)) return;
            const rect = el.getBoundingClientRect();
            if (label.rect.width > rect.width * 1.8 && !target.allowWideLabel) return;
            const sameRowLeft = overlaps(label.rect.top, label.rect.bottom, rect.top - 10, rect.bottom + 10)
              && label.rect.right <= rect.left + 14
              && rect.left - label.rect.right <= 520;
            const below = rect.top >= label.rect.bottom - 8
              && rect.top - label.rect.bottom <= 180
              && (overlaps(label.rect.left, label.rect.right, rect.left - 50, rect.right + 50)
                || Math.abs(rect.left - label.rect.left) <= 180);
            const rangeBelow = target.index !== undefined
              && rect.top >= label.rect.bottom - 8
              && rect.top - label.rect.bottom <= 180
              && rect.left >= label.rect.left - 24
              && rect.left - label.rect.left <= 920;
            if (!sameRowLeft && !below && !rangeBelow) return;
            const existing = compact(el.value || el.textContent || "");
            const score = (sameRowLeft ? 0 : rangeBelow ? 35 : 70)
              + Math.abs(rect.left - label.rect.left) * 0.25
              + Math.abs(rect.top - label.rect.bottom)
              + (existing && existing !== "+86" ? 12 : 0);
            out.push({ el, rect, score, label: label.text });
          });
        });
        const seen = new Set();
        return out.sort((a, b) => a.score - b.score).filter((item) => {
          if (seen.has(item.el)) return false;
          seen.add(item.el);
          return true;
        });
      };
      const choose = (items, target) => {
        if (!items.length) return null;
        if (target.index !== undefined) {
          const minTop = Math.min(...items.map((item) => item.rect.top));
          const sameRow = items
            .filter((item) => Math.abs(item.rect.top - minTop) <= 18)
            .sort((a, b) => a.rect.left - b.rect.left);
          return sameRow[target.index]?.el || null;
        }
        if (target.widest) {
          return [...items]
            .filter((item) => compact(item.el.value || item.el.textContent || "") !== "+86")
            .sort((a, b) => b.rect.width - a.rect.width)[0]?.el || null;
        }
        return items[0].el;
      };
      const chooseOption = async (el, value) => {
        if (el.tagName === "SELECT") {
          const option = Array.from(el.options).find((item) => item.textContent.includes(value) || value.includes(item.textContent.trim()) || item.value === value);
          if (!option) return false;
          el.value = option.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        if (compact(el.textContent || el.value).includes(value)) return true;
        el.click();
        await sleep(160);
        const options = Array.from(document.querySelectorAll("[role='option'], li, div, span"))
          .filter(visible)
          .filter((item) => {
            const text = clean(item.textContent);
            return text && (text === value || text.includes(value) || value.includes(text));
          })
          .sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width);
        const option = options[0];
        if (!option) return false;
        option.click();
        await sleep(80);
        const updated = compact(el.value || el.textContent || "");
        return Boolean(updated) && (updated.includes(value) || value.includes(updated));
      };
      const targets = [
        { label: "姓名", key: "name", aliases: ["姓名"], excludes: ["姓名为"] },
        { label: "手机号码", key: "phone", aliases: ["手机号码", "联系电话", "电话"] },
        { label: "邮箱", key: "email", aliases: ["邮箱", "电子邮件", "Email"] },
        { label: "期望工作地点", key: "city", aliases: ["期望工作地点", "工作地点"], optional: true, select: true },
        { label: "教育起始时间", key: "educationStart", aliases: ["起止时间", "开始时间", "入学时间"], index: 0 },
        { label: "教育结束时间", key: "educationEnd", aliases: ["起止时间", "结束时间", "毕业时间"], index: 1 },
        { label: "学历类型", key: "educationType", aliases: ["学历类型"], select: true },
        { label: "学校名称", key: "school", aliases: ["学校名称", "学校"] },
        { label: "学历", key: "educationLevel", aliases: ["学历"], excludes: ["学历类型"], select: true },
        { label: "学院", key: "college", aliases: ["学院", "院系"] },
        { label: "专业", key: "major", aliases: ["专业"] },
        { label: "学位", key: "degree", aliases: ["学位"], optional: true, select: true }
      ];
      const filled = [];
      const skipped = [];
      const model = fieldModel();
      for (const target of targets) {
        const value = compact(profile[target.key]);
        if (!value) {
          if (!target.optional) skipped.push({ label: target.label, reason: "资料缺失" });
          continue;
        }
        const visualCandidates = candidatesNear(target);
        const modelCandidates = target.index !== undefined ? [] : candidatesFromModel(target, model);
        const el = choose([...modelCandidates, ...visualCandidates].sort((a, b) => a.score - b.score), target);
        if (!el) {
          if (!target.optional) skipped.push({ label: target.label, reason: "字段未找到" });
          continue;
        }
        let ok = false;
        if (target.select || isSelectLike(el)) {
          ok = await chooseOption(el, value);
          if (!ok && /INPUT|TEXTAREA/.test(el.tagName)) ok = nativeSet(el, value);
        } else {
          ok = nativeSet(el, value);
        }
        if (ok) filled.push({ label: target.label, value });
        else if (!target.optional) skipped.push({ label: target.label, reason: "写入失败" });
      }
      return { filled: filled.length, skipped: skipped.length, filledFields: filled, skippedFields: skipped };
    }
  });
  return execution?.result || { filled: 0, skipped: 0 };
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadAiSettings();
  await loadApplicationDraft();
  const tab = await getActiveTab();
  $("pageTitle").textContent = tab?.title || "当前页面";
  $("scanButton").addEventListener("click", scanCurrentPage);
  $("fillButton").addEventListener("click", fillSelectedFields);
  $("clearButton").addEventListener("click", clearMarks);
  $("importProfileButton").addEventListener("click", importProfile);
  $("saveAiSettingsButton").addEventListener("click", () => saveAiSettings());
  $("testAiSettingsButton").addEventListener("click", testAiSettings);
  $("recordApplicationButton").addEventListener("click", recordApplication);
  $("loginAccountButton").addEventListener("click", loginAccount);
  $("logoutAccountButton").addEventListener("click", logoutAccount);
  $("cloudSyncButton").addEventListener("click", syncFromCloud);
  $("directFillButton").addEventListener("click", directFillPage);
  $("editProfileButton").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("fillButton").disabled = true;
});
