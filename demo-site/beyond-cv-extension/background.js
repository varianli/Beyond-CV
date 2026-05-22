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

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("profile");
  if (!existing.profile) {
    await chrome.storage.sync.set({ profile: DEFAULT_PROFILE });
  }
});
