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

function profileForAi(profileData = {}) {
  const knowledgeBase = profileData.knowledgeBase || {};
  return {
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
    fields: (model.fields || []).slice(0, 80).map((field) => ({
      id: field.id,
      tag: field.tag,
      type: field.type,
      name: field.name,
      domId: field.domId,
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
- 不要把邮箱填到工作地点、不要把姓名填到手机号、不要用字段当前值作为候选人事实。
- 如果字段是手机号国家区号且已显示 +86，可以跳过；手机号输入框才填手机号主体。
- select/combobox 字段必须优先匹配 options 中已有选项；没有合适选项就留空。
- 不填写密码、验证码、证件号、身份证/护照、薪资、政治宗教、婚育、隐私协议/同意勾选等敏感或协议字段。
- 工作经历、教育经历、开放题、BQ、动机类字段可以从完整资料库选择最相关真实经历；若缺少事实，留空。
- 输出 JSON，不要 Markdown。

JSON 结构：
{
  "fields": [
    {
      "id": "页面字段 id",
      "key": "name|phone|email|city|school|educationLevel|degree|major|college|educationStart|educationEnd|skills|summary|motivation|custom|skip",
      "label": "给用户看的中文字段名",
      "value": "准备填写的真实值，不能填则为空字符串",
      "confidence": 0.0,
      "blocked": false,
      "sensitive": false,
      "reason": "简短说明为什么这样匹配，或为什么跳过"
    }
  ]
}

页面字段模型：
${trimForAi(pageModelForAi(model), 12000)}

资料库：
${trimForAi(profileForAi(profileData), 14000)}
`;
}

function isSensitiveAiField(field) {
  const text = `${field.label || ""} ${field.key || ""} ${field.reason || ""}`.toLowerCase();
  return /password|captcha|verification|id\s*number|passport|salary|compensation|privacy|terms|consent|agree|身份证|护照|证件|验证码|密码|薪资|政治|宗教|婚育|婚姻|隐私|协议|同意/.test(text);
}

function normalizeAiScanResult(result, model) {
  const pageFields = new Map((model.fields || []).map((field) => [field.id, field]));
  const aiFields = Array.isArray(result.fields) ? result.fields : [];
  const normalized = aiFields
    .map((item) => {
      const base = pageFields.get(String(item.id || ""));
      if (!base) return null;
      const value = String(item.value || "").trim().slice(0, 3000);
      const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
      const blocked = Boolean(item.blocked || item.sensitive || isSensitiveAiField(item));
      const key = String(item.key || "");
      return {
        ...base,
        key: key === "skip" ? "" : key,
        matchLabel: String(item.label || item.key || "AI 识别字段").slice(0, 80),
        value,
        confidence,
        blocked,
        sensitive: Boolean(item.sensitive),
        reason: String(item.reason || "").slice(0, 180),
        source: "ai",
        canFill: Boolean(value && !blocked && confidence >= 0.55)
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

async function aiScanPageModel(model) {
  const result = await callDeepSeek("AI 字段识别", aiScanPrompt(model, profile || {}), {
    json: true,
    temperature: 0.12,
    maxTokens: 4200
  });
  return normalizeAiScanResult(result, model);
}

async function scanCurrentPage() {
  $("scanButton").disabled = true;
  $("scanStatus").textContent = "正在读取页面字段并交给 AI 判断...";
  try {
    const tab = await getActiveTab();
    $("pageTitle").textContent = tab?.title || "当前页面";
    const model = await sendToTab("BCV_PAGE_MODEL", { profile });
    lastScan = await aiScanPageModel(model);
    await sendToTab("BCV_MARK_FIELDS", { fields: lastScan.fields });
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `AI 已识别：${lastScan.matchedCount} 个字段可填，${lastScan.blockedCount} 个字段需手动处理。请检查后再填写。`;
    renderFields(lastScan);
  } catch (error) {
    $("scanStatus").textContent = `AI 识别失败：${error.message}`;
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
    $("scanStatus").textContent = `已填入 ${result.filled} 个 AI 字段。请在页面上检查后再提交。`;
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
  $("directFillButton").textContent = "AI 填入中...";
  try {
    const model = await sendToTab("BCV_PAGE_MODEL", { profile });
    lastScan = await aiScanPageModel(model);
    await sendToTab("BCV_MARK_FIELDS", { fields: lastScan.fields });
    renderFields(lastScan);
    const fillable = lastScan.fields.filter((field) => field.canFill);
    const result = await sendToTab("BCV_FILL", { fields: fillable, profile });
    if (result.error) throw new Error(result.error);
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `AI 已识别并填入 ${result.filled} 项。请逐项检查后再提交。`;
  } catch (error) {
    $("scanStatus").textContent = `AI 填入失败：${error.message}`;
  } finally {
    $("directFillButton").textContent = "AI 识别并填入";
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
