let profile = null;
let lastScan = null;

const $ = (id) => document.getElementById(id);
const BCV_SUPABASE_URL = "https://fsdashpviavdlxyicibr.supabase.co";
const BCV_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZGFzaHB2aWF2ZGx4eWljaWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzI3MTksImV4cCI6MjA5NDE0ODcxOX0.vsPRG6YJTUVenmLZsD-txUtIFMuMvxR3RdMtFGZVc6w";
const BCV_SYNC_ENDPOINT = `${BCV_SUPABASE_URL}/functions/v1/bcv-profile-sync`;
const BCV_AUTH_ENDPOINT = `${BCV_SUPABASE_URL}/auth/v1`;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadProfile() {
  const stored = await chrome.storage.sync.get(["profile", "syncToken", "authSession"]);
  profile = stored.profile || {};
  $("profileName").textContent = profile.name || "未设置姓名";
  $("syncTokenInput").value = stored.syncToken || "";
  const email = stored.authSession?.user?.email || stored.authSession?.email || "";
  $("accountEmailInput").value = email;
  $("accountStatus").textContent = email ? `已登录：${email}` : "未登录，可使用同步码";
  $("logoutAccountButton").disabled = !email;
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

function renderFields(scan) {
  const list = $("fieldList");
  list.innerHTML = "";
  const recognizedCount = scan.fields.filter((field) => field.key && !field.blocked).length;
  $("matchCount").textContent = `${scan.matchedCount} 可填 / ${recognizedCount} 已识别 / ${scan.fields.length} 字段`;

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
        <p class="field-meta">${field.blocked ? "敏感或协议类字段，需要手动处理" : field.value ? escapeHtml(field.value) : "已识别字段，但本地资料里缺少对应值"}</p>
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

async function scanCurrentPage() {
  $("scanButton").disabled = true;
  $("scanStatus").textContent = "正在扫描当前页面字段...";
  try {
    const tab = await getActiveTab();
    $("pageTitle").textContent = tab?.title || "当前页面";
    lastScan = await sendToTab("BCV_SCAN", { profile });
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `已扫描：${lastScan.matchedCount} 个字段可填，${lastScan.blockedCount} 个字段需手动确认。`;
    renderFields(lastScan);
  } catch (error) {
    $("scanStatus").textContent = "无法在当前页面运行。请切换到 http、https 或已允许文件访问的招聘表单页面。";
    $("fieldList").innerHTML = '<div class="empty">当前页面不支持扫描。</div>';
  } finally {
    $("scanButton").disabled = false;
  }
}

async function fillSelectedFields() {
  const ids = Array.from(document.querySelectorAll("[data-field-id]:checked")).map((input) => input.dataset.fieldId);
  if (!ids.length) return;
  $("fillButton").disabled = true;
  $("fillButton").textContent = "填入中...";
  try {
    const result = await sendToTab("BCV_FILL", { ids, profile });
    $("scanStatus").textContent = `已填入 ${result.filled} 个字段。请在页面上检查后再提交。`;
  } catch (error) {
    $("scanStatus").textContent = "填入失败，请刷新页面后重试。";
  } finally {
    $("fillButton").textContent = "填入已选字段";
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
    await chrome.storage.sync.set({ profile });
    $("profileName").textContent = profile.name || "未设置姓名";
    $("scanStatus").textContent = "已从 Beyond CV 页面导入资料。";
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
    $("scanStatus").textContent = `登录失败：${error.message}`;
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
    const updates = { profile };
    if (result.token || token) updates.syncToken = result.token || token;
    await chrome.storage.sync.set(updates);
    $("profileName").textContent = profile.name || "未设置姓名";
    $("syncTokenInput").value = updates.syncToken || "";
    $("scanStatus").textContent = `已从云端同步资料：${profile.name || "未命名"}。`;
  } catch (error) {
    $("scanStatus").textContent = `云端同步失败：${error.message}`;
  } finally {
    $("cloudSyncButton").textContent = "从云端同步资料";
    $("cloudSyncButton").disabled = false;
  }
}

async function directFillPage() {
  $("directFillButton").disabled = true;
  $("directFillButton").textContent = "直填中...";
  try {
    const result = await directFillInPage(profile);
    $("statusDot").classList.add("ready");
    $("scanStatus").textContent = `已按页面字段直填 ${result.filled} 项；${result.skipped} 项未处理。请在页面检查后再保存。`;
    if (result.model?.fields) {
      lastScan = {
        fields: result.model.fields,
        matchedCount: result.model.fields.filter((field) => field.canFill).length,
        blockedCount: result.model.fields.filter((field) => field.blocked).length
      };
      renderFields(lastScan);
    }
  } catch (error) {
    $("scanStatus").textContent = "直填失败。请刷新招聘页面并重新加载扩展后再试。";
  } finally {
    $("directFillButton").textContent = "按页面字段直填";
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
  $("scanButton").addEventListener("click", scanCurrentPage);
  $("fillButton").addEventListener("click", fillSelectedFields);
  $("clearButton").addEventListener("click", clearMarks);
  $("importProfileButton").addEventListener("click", importProfile);
  $("loginAccountButton").addEventListener("click", loginAccount);
  $("logoutAccountButton").addEventListener("click", logoutAccount);
  $("cloudSyncButton").addEventListener("click", syncFromCloud);
  $("directFillButton").addEventListener("click", directFillPage);
  $("editProfileButton").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("fillButton").disabled = true;
  scanCurrentPage();
});
