# Beyond CV

Beyond CV is an AI-powered job application workspace for candidates who need more than a one-page resume generator. It treats the resume as only one output of a larger personal knowledge base, then connects that knowledge base to JD analysis, tailored application materials, and real recruiting website form filling through a Chrome extension.

Demo: [https://varianli.github.io/Beyond-CV/](https://varianli.github.io/Beyond-CV/)

## Why This Is Different

Most resume tools stop at formatting a document: choose a template, paste experiences, export a PDF. That solves presentation, but it does not solve the repetitive and fragmented work that happens during real applications.

Beyond CV focuses on the full application workflow:

- A candidate may have far more experience than can fit on one A4 page, so the product stores education, internships, projects, campus activities, awards, skills, family fields, and open-ended question material as a reusable knowledge base.
- Different jobs require different positioning, so the product uses the JD to select what should be emphasized instead of generating the same resume or cover letter for every role.
- Recruiting websites often ask candidates to re-enter information that already exists in their profile, so the browser extension reads actual application forms and fills matched fields after user confirmation.
- Cover letters, short answers, and behavior questions are generated from the candidate's real facts and the JD context, with prompts that explicitly forbid fabricated schools, companies, awards, projects, metrics, or achievements.

In short: Beyond CV is not only "generate a resume"; it is "maintain a complete candidate profile once, then reuse it intelligently across resumes, job-specific materials, and official application forms."

## Core Features

### 1. Candidate Knowledge Base

The product keeps a structured profile that can be larger than the final resume:

- Basic information: name, phone, email, address or preferred city
- Education: school, degree, major, college, start and end dates
- Internships and projects: company or organization, role, location, time range, responsibilities, achievements, and description
- Campus activities and awards
- Skills and languages
- Optional family or sensitive fields, kept visible and controllable
- Raw long-form input from the user, used for AI parsing and future reuse

This is the foundation of the product. The resume is generated from the knowledge base, but the knowledge base is not limited by the resume page.

### 2. Resume Builder

The prototype includes a resume editor with live preview. Users can edit structured fields and generate a resume-style output while keeping the full profile available for other workflows.

Current capabilities include:

- Chinese resume editing and preview
- Export actions for document-style outputs
- AI compression for long experience descriptions
- Smart paste: users can paste long experience text, and AI parses it into profile, education, experience, campus activity, and skills sections

### 3. JD Understanding and Job-Specific Materials

Users can paste a full job description into the job matching page. Beyond CV then uses AI to extract and structure:

- Role name
- Job keywords
- Hard requirements
- Bonus requirements
- Material generation direction

Based on the JD and candidate knowledge base, it can generate:

- Field short answers, such as availability, experience summary, or why this role
- Cover Letter
- Behavior Question answers from a user-entered question
- Resume advice, such as which experiences or bullets should be emphasized for this JD

The system prompt is designed around a strict rule: use only the candidate facts, JD, and page context provided by the user. If there is not enough evidence, the output should stay conservative and ask for missing information instead of inventing facts.

### 4. Substantive Gap Check

The dashboard includes a "missing information" area that is intended to be more than a static checklist. It checks the current profile and JD context to identify material gaps, for example:

- Missing quantified achievements in projects or internships
- Missing conflict-resolution or cross-team behavior question material
- JD keywords that do not appear in the current knowledge base
- Sensitive or family fields that should remain disabled unless explicitly needed

The goal is to tell the user what information to add before applying, not merely display generic reminders.

### 5. Chrome Extension for Real Application Forms

Beyond CV includes a Manifest V3 Chrome extension. It can be downloaded from the demo page and loaded in Chrome or Edge developer mode.

The extension scans recruiting websites, previews matched fields, and fills selected fields only after user confirmation. It does not submit applications automatically.

Supported interaction types include:

- Text inputs
- Textareas
- Native selects
- Combobox-style dropdowns
- Tree select / cascader-style dropdowns
- Contenteditable fields

The extension also includes a ByteDance-specific adapter for `jobs.bytedance.com`, because that site uses complex custom components and repeated resume sections.

### 6. Application Tracking Bridge

The extension can record the current company, role, status, and application URL. Those records are reflected back into the Beyond CV application management area, making the product a lightweight tracker for internship, spring recruitment, and autumn recruitment applications.

This connects form filling with later follow-up management instead of leaving every application as an isolated browser tab.

## AI Autofill Logic

The autofill flow combines deterministic page reading, AI reasoning, and local validation.

1. The content script reads the current page.
   It scans the DOM for form controls and gathers labels from `label`, `aria-label`, `placeholder`, `name`, `id`, nearby visible text, section headings, and container text.

2. It builds a full-page field model.
   Fields are grouped by visual and semantic context, such as basic information, work experience, education, awards, and language sections. For ByteDance pages, a dedicated adapter maps repeated sections such as company name, position name, start/end time, school, degree, major, award name, and language fields.

3. The popup builds candidate facts.
   Instead of passing only a one-page resume, it builds facts from the full knowledge base: profile, education, experience, campus activities, awards, skills, and language data.

4. AI matches page fields to candidate facts.
   DeepSeek receives the page field model and candidate facts. For dropdowns, the prompt instructs the model to prefer available options and leave a field blank if no option fits.

5. Local validation rejects risky matches.
   The extension checks whether the AI-selected fact type matches the expected field type. For example, an email fact should not be accepted for a preferred city field. If the AI returns no fact ID, mismatched slot, sensitive field, or low-confidence mapping, the field is blocked.

6. User confirms before filling.
   The extension shows the matched fields and reasons. Only selected, fillable fields are written into the page.

7. The page is filled without auto-submit.
   The extension dispatches standard input/change events so modern frontend forms can detect the change, but the final application submission remains manual.

This hybrid approach is more accurate than simple keyword matching, while safer than letting AI directly control the page without constraints.

## AI and Prompting

The prototype uses DeepSeek-compatible chat completion settings:

- Default model field: `deepseek-v4-flash`
- Default base URL field: `https://api.deepseek.com`
- API key is entered by the user in the browser UI
- API key is saved in browser storage, not written into the HTML file or Git repository
- The app includes an API test button to verify whether the saved key works

Prompting principles:

- Do not fabricate facts
- Only use candidate profile, JD, and page context
- Return structured JSON where possible
- Be conservative when facts are missing
- For application answers, mention missing information instead of inventing evidence

## Privacy and Safety Boundaries

Beyond CV is designed with several guardrails:

- It does not automatically submit applications.
- It does not silently fill sensitive fields.
- API keys are stored locally in the browser rather than committed to the project.
- The extension previews matches before filling.
- AI output is checked by local validation before being accepted for form filling.
- The user is expected to review every generated answer and filled field before submission.

The current repository is still a prototype, so production deployment would require stronger backend security, database rules, environment-variable based configuration, and a formal privacy policy.

## Cloud Sync

The prototype includes Supabase-based account and profile sync. Users can create or log in to an account, save the current profile, and then sync the latest profile into the browser extension.

This allows the extension to use the same knowledge base maintained in the Beyond CV workspace instead of relying only on a small local profile.

## Repository Structure

```text
.
├── index.html                    # GitHub Pages entry, synced with the prototype
├── beyond-cv-prototype.html       # Main static prototype
├── beyond-cv-extension/           # Chrome extension source
├── beyond-cv-extension.zip        # Packaged extension download
├── demo-site/                     # Demo deployment copy
├── PRD/                           # Product requirement notes
├── bytedance-form-test.html       # Local test page for ByteDance-style fields
└── sample-recruiting-form.html    # Local generic recruiting form test page
```

## How to Use

### Open the web prototype

Use the hosted demo:

[https://varianli.github.io/Beyond-CV/](https://varianli.github.io/Beyond-CV/)

Or open `beyond-cv-prototype.html` locally in a browser.

### Configure AI

1. Open the dashboard.
2. Enter the DeepSeek API key, model, and base URL.
3. Click the API test button.
4. Save settings.

Without a saved API key, the AI functions will not call the model.

### Install the extension

1. Download `beyond-cv-extension.zip` from the demo page or use the repository package.
2. Unzip it.
3. Open `chrome://extensions`.
4. Enable Developer Mode.
5. Choose "Load unpacked".
6. Select the unzipped `beyond-cv-extension` folder.

For local `file://` tests, enable file URL access for the extension.

### Fill an application form

1. Open a recruiting website application page.
2. Open the Beyond CV extension popup.
3. Sync or import the candidate profile.
4. Run page scan or AI field recognition.
5. Review the matched fields.
6. Fill selected fields.
7. Manually check the page and submit only when ready.

## Current Limitations

- This is a front-end prototype plus browser extension, not a production SaaS.
- Some recruiting sites use complex iframes, anti-bot protections, or custom upload controls that may not be fillable.
- Dropdown matching depends on whether the site exposes options in the DOM after opening the dropdown.
- AI generation quality depends on the completeness and accuracy of the user's knowledge base.
- Supabase sync requires the configured project and Edge Function to be available.
- The extension is packaged as a developer-mode extension, not yet published to the Chrome Web Store.

## Roadmap

Potential next steps:

- Add more recruiting-site adapters beyond ByteDance
- Improve multi-page application flow detection
- Add stronger application pipeline management for autumn and spring recruitment
- Add richer resume template support
- Add structured fact editing for behavior question examples
- Move deployment configuration and secrets into production-safe environment management
- Add automated tests for field recognition and form filling
- Publish the extension through a formal browser extension release process

## Resume-Style Summary

Beyond CV is an AI job application assistant that goes beyond traditional resume generation by maintaining a full candidate knowledge base and reusing it across resume creation, JD-specific material generation, and real recruiting website autofill. It integrates DeepSeek-based JD parsing, cover letter and behavior question generation, profile gap checking, Supabase profile sync, and a Manifest V3 Chrome extension that reads DOM and visual field context, matches fields to verified candidate facts, validates risky AI mappings locally, and fills selected application fields only after user confirmation.
