# Beyond CV

Languages: [中文](#beyond-cv-中文) | [English](#beyond-cv-english)

# Beyond CV 中文

Beyond CV 是一个面向真实求职投递流程的 AI 简历与申请辅助系统。它不是单纯把经历排版成一页简历，而是把用户完整的教育、实习、项目、获奖、技能、开放题素材等信息沉淀为长期可维护的求职资料库，再基于岗位 JD 生成定制化申请材料，并通过浏览器插件辅助填写真实招聘官网的申请表单。

在线 Demo：[https://varianli.github.io/Beyond-CV/](https://varianli.github.io/Beyond-CV/)

## 和普通简历生成器的区别

市面上大多数简历工具解决的是“简历长什么样”：选择模板、填写经历、导出 PDF。这个方向有价值，但它只覆盖了求职流程中的一小段。

真实投递里更消耗时间的部分往往是：

- 同一份经历要在不同公司官网反复填写。
- 官网表单会要求简历里没有的信息，比如开放题、求职动机、家庭信息、可入职时间、期望工作地等。
- 不同岗位需要强调不同经历，一份固定简历很难覆盖所有 JD。
- 很多学生或求职者的经历远不止一页简历能容纳，真正有价值的信息散落在过往项目、实习、竞赛、活动和自我复盘里。

Beyond CV 的核心思路是：先维护一份比简历更完整的个人资料库，再让 AI 根据岗位和网页场景调用这份资料，而不是每次重新写、重新复制、重新填写。

因此，Beyond CV 更接近一个“AI 求职资料库 + 岗位适配系统 + 官网申请助手”，而不只是一个“简历生成器”。

## 核心功能

### 1. 求职资料库

Beyond CV 会把用户信息整理成结构化资料库，范围超过最终展示在简历上的内容。

当前资料库覆盖：

- 基础信息：姓名、电话、邮箱、地址或期望城市
- 教育经历：学校、学历、学位、学院、专业、起止时间
- 实习与项目：公司或组织、职位、地点、时间段、工作内容、成果描述
- 在校活动与获奖经历
- 技能与语言能力
- 可选的家庭信息或敏感字段
- 用户粘贴的大段原始经历文本

一页简历只是资料库的一个输出结果。资料库本身可以保留更多经历细节，用于后续生成 Cover Letter、Behavior Question、短答和官网表单字段。

### 2. 简历制作与实时预览

原型内置简历编辑和实时预览能力。用户可以维护结构化字段，并在页面上看到简历样式的输出。

当前能力包括：

- 中文简历编辑与预览
- 简历导出相关操作
- 使用 AI 压缩过长经历描述
- 快速粘贴识别：用户可以粘贴完整经历文本，AI 会拆分出基础信息、教育、实习/项目、在校活动和技能等结构化内容

### 3. JD 理解与岗位材料生成

用户可以在岗位适配页面粘贴完整 JD。系统会调用 AI 理解岗位信息，并提取：

- 岗位名称
- 岗位关键词
- 硬性要求
- 加分项
- 后续材料生成方向

在 JD 和用户真实资料库的基础上，系统可以生成：

- 字段短答，例如可入职时间、经历摘要、为什么申请该岗位
- Cover Letter
- 用户输入 Behavior Question 后生成对应回答
- 针对 JD 的简历 bullet 和经历取舍建议

生成逻辑强调“不能编造”。系统提示词要求 AI 只能使用用户提供的真实资料、JD 和页面上下文；如果资料不足，应保守回答并提示需要补充的信息，而不是虚构公司、项目、奖项、学校、数据或成果。

### 4. 待补资料检索

项目里有“待补资料”模块，不只是静态提醒，而是根据当前资料库和 JD 做实质性检查。

例如：

- 项目或实习是否缺少量化成果
- 是否缺少冲突解决、团队合作、压力处理等 BQ 素材
- JD 关键词是否没有在资料库里命中
- 家庭信息、隐私字段是否应默认关闭

这个模块的目标是帮助用户知道“申请前还缺什么”，而不是泛泛展示待办事项。

### 5. 浏览器插件：辅助填写真实招聘官网

Beyond CV 包含一个 Manifest V3 Chrome 插件。用户可以从 Demo 页面下载插件包，在 Chrome 或 Edge 开发者模式下加载。

插件会读取真实招聘网站申请页，识别页面字段，预览匹配结果，并在用户确认后填入选中的字段。插件不会自动提交申请。

当前支持的页面控件包括：

- 普通输入框
- 多行文本框
- 原生 select 下拉框
- combobox 类型下拉框
- tree select / cascader 类型层级下拉框
- contenteditable 编辑区域

针对 `jobs.bytedance.com`，项目里实现了字节跳动申请页适配器，用于处理更复杂的自定义组件、重复经历模块和下拉选择控件。

### 6. 投递记录联动

插件可以记录当前页面的公司、岗位、投递状态和申请链接，并同步到 Beyond CV 页面中的投递管理区域。

这样，用户不仅能更快填写申请，还可以逐步沉淀自己的春招、秋招、实习投递记录，方便后续跟进。

## AI 自动填表逻辑

Beyond CV 的自动填表不是简单关键词匹配，也不是让 AI 无限制操作网页，而是结合页面读取、AI 判断和本地校验的混合流程。

1. 读取当前网页
   插件 content script 会扫描页面 DOM，收集表单控件，并读取 `label`、`aria-label`、`placeholder`、`name`、`id`、邻近可见文字、栏目标题和容器文本。

2. 构建整页字段模型
   系统会按视觉和语义上下文理解字段所属栏目，例如基本信息、工作经历、教育经历、获奖经历、语言能力等。对于字节跳动页面，会使用专门适配器识别公司名称、职位名称、起止时间、学校、学历、专业、奖项名称、语言等字段。

3. 构建候选人事实库
   插件不会只读取一页简历，而是从完整资料库中构建候选人事实，包括基础信息、教育、实习、项目、校园经历、获奖、技能和语言。

4. AI 匹配字段与事实
   DeepSeek 会接收网页字段模型和候选人事实库，判断每个字段应该使用哪个事实。对于下拉框，AI 会优先在页面已有选项中选择；没有合适选项时应留空。

5. 本地校验拦截错误匹配
   插件会校验 AI 返回的字段类型是否合理。例如，邮箱不能被用于期望工作地，手机号不能被用于奖项描述。如果 AI 没有引用资料库 factId、字段类型不匹配、涉及敏感字段或置信度不足，就会被拒绝。

6. 用户确认后填入
   插件会展示匹配结果、字段原因和可填状态。只有用户勾选并确认的字段才会写入网页。

7. 只填入，不提交
   插件会触发现代前端表单需要的 input/change 事件，让页面识别字段变化，但最终提交仍由用户手动完成。

这种方式比纯规则关键词匹配更灵活，也比让 AI 直接控制页面更安全。

## AI 与提示词原则

原型使用 DeepSeek 兼容的 Chat Completion 配置：

- 默认模型字段：`deepseek-v4-flash`
- 默认接口地址字段：`https://api.deepseek.com`
- API Key 由用户在页面或插件中输入
- API Key 存储在浏览器本地，不写入 HTML 文件，也不提交到 Git
- 页面提供接口测试按钮，用于确认 Key 是否可用

核心提示词原则：

- 不撒谎，不编造事实
- 只能基于用户资料、JD 和页面上下文生成
- 尽量返回结构化 JSON，方便页面继续处理
- 资料不足时保守表达，并提示用户需要补充什么
- 对申请材料生成，优先保证事实准确，而不是追求夸张包装

## 隐私与安全边界

当前实现包含以下边界：

- 不自动提交申请
- 不静默填写敏感字段
- API Key 只保存在浏览器本地
- 插件填入前展示匹配预览
- AI 字段匹配结果会经过本地校验
- 用户应在提交前检查所有生成内容和填入字段

需要说明的是，当前仓库仍是原型项目。若进入生产环境，还需要进一步完善后端权限、数据库 RLS、环境变量管理、隐私政策和安全审计。

## 云端同步

项目中包含 Supabase 账户和资料同步能力。用户可以创建账户或登录账户，将当前资料保存到云端，并在插件中同步最新资料。

这让插件可以使用 Beyond CV 页面中维护的完整资料库，而不是只依赖插件本地的小型 profile。

## 项目结构

```text
.
├── index.html                    # GitHub Pages 入口，与主原型同步
├── beyond-cv-prototype.html       # 主静态原型页面
├── beyond-cv-extension/           # Chrome 插件源码
├── beyond-cv-extension.zip        # 插件打包文件
├── demo-site/                     # Demo 部署副本
├── PRD/                           # 产品需求文档与功能说明
├── bytedance-form-test.html       # 字节跳动风格字段测试页
└── sample-recruiting-form.html    # 通用招聘表单测试页
```

## 使用方式

### 打开 Web 原型

可以直接访问在线 Demo：

[https://varianli.github.io/Beyond-CV/](https://varianli.github.io/Beyond-CV/)

也可以在本地浏览器打开 `beyond-cv-prototype.html`。

### 配置 AI

1. 打开工作台页面。
2. 输入 DeepSeek API Key、模型名称和接口地址。
3. 点击接口测试按钮。
4. 保存设置。

未保存 API Key 时，AI 功能不会调用模型。

### 安装插件

1. 从 Demo 页面下载 `beyond-cv-extension.zip`，或使用仓库中的插件包。
2. 解压 ZIP。
3. 打开 `chrome://extensions`。
4. 开启开发者模式。
5. 点击“加载已解压的扩展程序”。
6. 选择解压后的 `beyond-cv-extension` 文件夹。

如果要在本地 `file://` 页面测试，需要在扩展详情里允许访问文件网址。

### 填写申请表

1. 打开招聘官网申请页。
2. 打开 Beyond CV 插件弹窗。
3. 同步或导入候选人资料。
4. 执行页面扫描或 AI 字段识别。
5. 检查匹配结果。
6. 填入已选字段。
7. 回到网页人工检查，确认无误后再手动提交。

## 当前限制

- 当前是前端原型 + 浏览器插件，不是完整生产级 SaaS。
- 部分招聘网站使用复杂 iframe、反自动化机制或特殊上传控件，可能无法自动填入。
- 下拉框识别依赖网站在打开下拉层后暴露选项。
- AI 生成质量依赖用户资料库的完整度和准确度。
- Supabase 同步依赖配置好的项目和 Edge Function。
- 插件目前是开发者模式加载版本，尚未发布到 Chrome Web Store。

## 后续规划

可继续推进的方向包括：

- 增加更多招聘网站专属适配器
- 改进多页面申请流程识别
- 加强春招、秋招、实习投递管理
- 增加更多简历模板和排版控制
- 增加 Behavior Question 素材库的结构化编辑
- 将部署配置和密钥迁移到更生产安全的环境管理方式
- 为字段识别和表单填入增加自动化测试
- 完成正式浏览器插件发布流程

## 简历项目描述

Beyond CV 是一个区别于传统简历生成器的 AI 求职申请助手：项目通过维护完整候选人资料库，将教育、实习、项目、获奖、技能和开放题素材复用于简历生成、JD 解析、Cover Letter、Behavior Question 和官网申请表单填写；集成 DeepSeek 进行岗位语义理解与材料生成，并开发 Manifest V3 Chrome 插件读取招聘网站 DOM 与视觉字段上下文，将页面字段匹配到经过验证的候选人事实，在本地校验高风险 AI 匹配后，由用户确认并填入选中字段，从而减少重复填写并提升不同岗位申请材料的适配效率。

# Beyond CV English

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
