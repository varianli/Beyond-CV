const DEFAULT_PROFILE = {
  name: "",
  firstName: "",
  lastName: "",
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
  major: "",
  college: "",
  lab: "",
  researchArea: "",
  advisor: "",
  graduation: "",
  skills: "",
  summary: "",
  motivation: ""
};

const form = document.getElementById("profileForm");
const status = document.getElementById("saveStatus");

async function load() {
  const stored = await chrome.storage.sync.get("profile");
  const profile = { ...DEFAULT_PROFILE, ...(stored.profile || {}) };
  Object.entries(profile).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const profile = {};
  for (const [key, value] of data.entries()) {
    profile[key] = String(value).trim();
  }
  await chrome.storage.sync.set({ profile });
  status.textContent = "已保存";
  setTimeout(() => {
    status.textContent = "";
  }, 1800);
});

load();
