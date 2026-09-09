(function () {
  const storageKey = 'yycl_v2_admin_token';
  const scenes = [
    { id: 'pre', title: '课前进线', desc: '用户刚进线或预约体验前，重点解决信任、时间、孩子适配和到课意愿。', tone: '轻解释，重确认' },
    { id: 'mid', title: '课中推进', desc: '体验课进行中或刚结束，重点推动家长理解孩子表现和课程价值。', tone: '多观察，少催促' },
    { id: 'close', title: '结转促单', desc: '结转报名阶段，重点处理价格、犹豫、对比、决策人和付款节奏。', tone: '给证据，给下一步' },
  ];
  const aiProviderLabels = {
    deepseek: 'DeepSeek',
    kimi: 'Kimi / Moonshot',
    openai: 'OpenAI',
    qwen: '通义千问',
    glm: '智谱 GLM',
    doubao: '豆包',
    custom: '其他兼容接口',
  };
  const pageSizes = {
    objections: 8,
    topics: 4,
    users: 8,
    sessions: 3,
  };

  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    module: 'content',
    scene: 'pre',
    objections: [],
    selectedObjectionId: '',
    topics: [],
    teams: [],
    users: [],
    selectedTeacherIds: [],
    trainingSessionsByUser: {},
    expandedTrainingUserId: '',
    pages: {
      objections: 1,
      topics: 1,
      users: 1,
      sessionsByUser: {},
    },
    aiConfig: null,
    appSettings: null,
    scripts: [],
    materials: [],
    materialType: 'LINK',
  };

  const nodes = {
    authScreen: document.getElementById('adminAuthScreen'),
    workspace: document.getElementById('adminWorkspace'),
    loginForm: document.getElementById('adminLoginForm'),
    loginStatus: document.getElementById('adminLoginStatus'),
    profileChip: document.getElementById('adminProfileChip'),
    moduleButtons: Array.from(document.querySelectorAll('[data-module]')),
    contentModule: document.getElementById('contentModule'),
    trainingModule: document.getElementById('trainingModule'),
    accountModule: document.getElementById('accountModule'),
    aiModule: document.getElementById('aiModule'),
    contentMetrics: document.getElementById('adminContentMetrics'),
    sceneList: document.getElementById('adminSceneList'),
    libraryTitle: document.getElementById('adminLibraryTitle'),
    objectionSearchInput: document.getElementById('adminObjectionSearchInput'),
    objectionStatusFilter: document.getElementById('adminObjectionStatusFilter'),
    objectionList: document.getElementById('adminObjectionList'),
    objectionPagination: document.getElementById('adminObjectionPagination'),
    objectionForm: document.getElementById('adminObjectionForm'),
    editorTitle: document.getElementById('adminEditorTitle'),
    editorStatus: document.getElementById('adminEditorStatus'),
    toggleObjectionStatusButton: document.getElementById('adminToggleObjectionStatusButton'),
    newObjectionButton: document.getElementById('adminNewObjectionButton'),
    objectionFormStatus: document.getElementById('adminObjectionFormStatus'),
    importForm: document.getElementById('adminObjectionImportForm'),
    importStatus: document.getElementById('adminObjectionImportStatus'),
    downloadObjectionTemplateButton: document.getElementById('adminDownloadObjectionTemplateButton'),
    trainingMetrics: document.getElementById('adminTrainingMetrics'),
    trainingTopicList: document.getElementById('adminTrainingTopicList'),
    trainingTopicPagination: document.getElementById('adminTrainingTopicPagination'),
    trainingTopicSelect: document.getElementById('adminTrainingTopicSelect'),
    trainingImportForm: document.getElementById('adminTrainingImportForm'),
    trainingImportStatus: document.getElementById('adminTrainingImportStatus'),
    refreshTrainingButton: document.getElementById('adminRefreshTrainingButton'),
    downloadTrainingTemplateButton: document.getElementById('adminDownloadTrainingTemplateButton'),
    accountMetrics: document.getElementById('adminAccountMetrics'),
    teamManagement: document.getElementById('adminTeamManagement'),
    teamForm: document.getElementById('adminTeamForm'),
    teamStatus: document.getElementById('adminTeamStatus'),
    teamList: document.getElementById('adminTeamList'),
    accountSearchInput: document.getElementById('adminAccountSearchInput'),
    roleFilter: document.getElementById('adminRoleFilter'),
    accountList: document.getElementById('adminAccountList'),
    accountPagination: document.getElementById('adminAccountPagination'),
    selectPageTeachers: document.getElementById('adminSelectPageTeachers'),
    selectedTeacherCount: document.getElementById('adminSelectedTeacherCount'),
    batchTeamField: document.getElementById('adminBatchTeamField'),
    batchTeamSelect: document.getElementById('adminBatchTeamSelect'),
    batchAssignTeamButton: document.getElementById('adminBatchAssignTeamButton'),
    batchDeleteUsersButton: document.getElementById('adminBatchDeleteUsersButton'),
    batchAccountStatus: document.getElementById('adminBatchAccountStatus'),
    accountForm: document.getElementById('adminAccountForm'),
    accountRoleField: document.getElementById('adminAccountRoleField'),
    accountTeamField: document.getElementById('adminAccountTeamField'),
    accountTeamSelect: document.getElementById('adminAccountTeamSelect'),
    accountStatus: document.getElementById('adminAccountStatus'),
    teacherImportForm: document.getElementById('adminTeacherImportForm'),
    teacherImportStatus: document.getElementById('adminTeacherImportStatus'),
    teacherImportHelp: document.getElementById('adminTeacherImportHelp'),
    downloadTeacherTemplateButton: document.getElementById('adminDownloadTeacherTemplateButton'),
    aiMetrics: document.getElementById('adminAiMetrics'),
    aiConfigForm: document.getElementById('adminAiConfigForm'),
    aiTeamField: document.getElementById('adminAiTeamField'),
    aiTeamSelect: document.getElementById('adminAiTeamSelect'),
    aiConfigStatus: document.getElementById('adminAiConfigStatus'),
    aiConfigSaveStatus: document.getElementById('adminAiConfigSaveStatus'),
    aiConfigTestButton: document.getElementById('adminAiConfigTestButton'),
    aiKeyState: document.getElementById('adminAiKeyState'),
    aiKeyPreview: document.getElementById('adminAiKeyPreview'),
    teacherScoreToggle: document.getElementById('adminTeacherScoreToggle'),
    teacherScoreStatus: document.getElementById('adminTeacherScoreStatus'),
    teacherScoreSaveStatus: document.getElementById('adminTeacherScoreSaveStatus'),
    scriptDraftInput: document.getElementById('adminScriptDraftInput'),
    scriptList: document.getElementById('adminScriptList'),
    addScriptButton: document.getElementById('adminAddScriptButton'),
    materialTypeButtons: Array.from(document.querySelectorAll('[data-material-type]')),
    materialTitleInput: document.getElementById('adminMaterialTitleInput'),
    materialUrlInput: document.getElementById('adminMaterialUrlInput'),
    materialImageInput: document.getElementById('adminMaterialImageInput'),
    materialDescriptionInput: document.getElementById('adminMaterialDescriptionInput'),
    materialList: document.getElementById('adminMaterialList'),
    addLinkMaterialButton: document.getElementById('adminAddLinkMaterialButton'),
    uploadImageMaterialButton: document.getElementById('adminUploadImageMaterialButton'),
    logoutButton: document.getElementById('adminLogoutButton'),
  };

  nodes.teacherImportForm.querySelector('button[type="submit"]').textContent = '上传表格并导入';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return map[char];
    });
  }

  function sceneName(sceneId) {
    return scenes.find((scene) => scene.id === sceneId)?.title || sceneId;
  }

  function roleLabel(role, isSuperAdmin) {
    if (isSuperAdmin) return '超级管理员';
    return role === 'TRAINER' ? '团队管理员' : '老师';
  }

  function formatDateTime(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function paginate(items, requestedPage, pageSize) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      page,
      totalPages,
      totalItems: items.length,
      start,
    };
  }

  function paginationPages(page, totalPages) {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  function renderPagination(container, pageData, onPageChange) {
    if (!container) return;
    if (!pageData.totalItems) {
      container.innerHTML = '';
      return;
    }

    const end = Math.min(pageData.start + pageData.items.length, pageData.totalItems);
    container.innerHTML = `
      <span class="pagination-summary">第 ${pageData.start + 1}-${end} 条，共 ${pageData.totalItems} 条</span>
      ${
        pageData.totalPages > 1
          ? `<div class="pagination-actions">
              <button class="pagination-btn" type="button" data-page="${pageData.page - 1}" ${pageData.page === 1 ? 'disabled' : ''}>上一页</button>
              ${paginationPages(pageData.page, pageData.totalPages)
                .map(
                  (page) => `<button class="pagination-btn ${page === pageData.page ? 'active' : ''}" type="button" data-page="${page}" aria-label="第 ${page} 页" ${page === pageData.page ? 'aria-current="page"' : ''}>${page}</button>`
                )
                .join('')}
              <button class="pagination-btn" type="button" data-page="${pageData.page + 1}" ${pageData.page === pageData.totalPages ? 'disabled' : ''}>下一页</button>
            </div>`
          : ''
      }
    `;
    container.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => onPageChange(Number(button.dataset.page)));
    });
  }

  function formatDateTimeFull(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return `${formatDateTime(value)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function trainingStatusLabel(status) {
    const map = {
      ACTIVE: '训练中',
      ENDED: '已结束',
      COMPLETED: '已完成',
    };
    return map[status] || status || '未知';
  }

  function scoreLevel(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return '未评分';
    if (value >= 90) return '优秀';
    if (value >= 80) return '良好';
    if (value >= 70) return '达标';
    if (value >= 60) return '需提升';
    return '重点辅导';
  }

  function parseScriptsText(text) {
    const value = String(text || '').trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeScripts(parsed) : [];
    } catch {
      return value
        .split(/\n{2,}/)
        .map((item) => ({ text: item.trim(), materials: [] }))
        .filter((item) => item.text);
    }
  }

  function normalizeMaterial(material) {
    if (!material || typeof material !== 'object') return null;
    const title = String(material.title || '').trim();
    const url = String(material.url || '').trim();
    if (!title || !url) return null;
    return {
      type: material.type === 'IMAGE' ? 'IMAGE' : 'LINK',
      title,
      url,
      description: String(material.description || '').trim(),
    };
  }

  function normalizeScript(script) {
    if (typeof script === 'string') {
      const text = script.trim();
      return text ? { text, materials: [] } : null;
    }
    if (!script || typeof script !== 'object') return null;
    const text = String(script.text || '').trim();
    if (!text) return null;
    const materials = Array.isArray(script.materials)
      ? script.materials.map(normalizeMaterial).filter(Boolean)
      : [];
    return { text, materials };
  }

  function normalizeScripts(scripts) {
    return Array.isArray(scripts) ? scripts.map(normalizeScript).filter(Boolean) : [];
  }

  function syncScriptsInput() {
    state.scripts = normalizeScripts(state.scripts);
    nodes.objectionForm.scripts.value = JSON.stringify(state.scripts);
  }

  function renderScriptEditor() {
    syncScriptsInput();
    nodes.scriptList.innerHTML = state.scripts.length
      ? state.scripts
          .map(
            (script, index) => `
              <article class="script-row rich-script-row">
                <div class="tag">${index + 1}</div>
                <p>${escapeHtml(script.text)}</p>
                <div class="script-material-box">
                  <div class="script-material-head">
                    <span>该话术配套物料</span>
                    <small>可添加链接，也可上传本地图片</small>
                  </div>
                  <div class="material-list nested-material-list">
                    ${(script.materials || []).length
                      ? script.materials
                          .map(
                            (material, materialIndex) => `
                              <article class="material-row nested-material-row">
                                <div class="${material.type === 'IMAGE' ? 'tag-good' : 'tag'}">${material.type === 'IMAGE' ? '图片' : '链接'}</div>
                                <div>
                                  <h3>${escapeHtml(material.title)}</h3>
                                  <p>${escapeHtml(material.description || material.url)}</p>
                                </div>
                                <button class="secondary-btn compact-btn" type="button" data-script-index="${index}" data-remove-script-material="${materialIndex}">移除</button>
                              </article>
                            `
                          )
                          .join('')
                      : '<div class="empty-state compact-empty">暂无该话术专属物料。</div>'}
                  </div>
                  <div class="script-material-form">
                    <input data-script-material-title="${index}" placeholder="物料名称，例如：作品示例图" />
                    <input data-script-material-url="${index}" placeholder="链接地址，例如：https://..." />
                    <input data-script-material-image="${index}" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                    <input data-script-material-description="${index}" placeholder="使用说明，可选" />
                  </div>
                  <div class="row-actions">
                    <button class="secondary-btn compact-btn" type="button" data-add-script-link="${index}">添加链接物料</button>
                    <button class="secondary-btn compact-btn" type="button" data-upload-script-image="${index}">上传图片物料</button>
                  </div>
                </div>
                <button class="secondary-btn compact-btn" type="button" data-remove-script="${index}">移除</button>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state compact-empty">暂无推荐话术。填写一条话术后点击“添加话术”。</div>';

    nodes.scriptList.querySelectorAll('[data-remove-script]').forEach((button) => {
      button.addEventListener('click', () => {
        state.scripts.splice(Number(button.dataset.removeScript), 1);
        renderScriptEditor();
      });
    });

    nodes.scriptList.querySelectorAll('[data-remove-script-material]').forEach((button) => {
      button.addEventListener('click', () => {
        const scriptIndex = Number(button.dataset.scriptIndex);
        const materialIndex = Number(button.dataset.removeScriptMaterial);
        state.scripts[scriptIndex]?.materials?.splice(materialIndex, 1);
        renderScriptEditor();
      });
    });

    nodes.scriptList.querySelectorAll('[data-add-script-link]').forEach((button) => {
      button.addEventListener('click', () => {
        const scriptIndex = Number(button.dataset.addScriptLink);
        const title = nodes.scriptList.querySelector(`[data-script-material-title="${scriptIndex}"]`)?.value.trim() || '';
        const url = nodes.scriptList.querySelector(`[data-script-material-url="${scriptIndex}"]`)?.value.trim() || '';
        const description = nodes.scriptList.querySelector(`[data-script-material-description="${scriptIndex}"]`)?.value.trim() || '';
        if (!title || !url) {
          nodes.objectionFormStatus.textContent = '请填写该话术物料的名称和链接地址';
          return;
        }
        state.scripts[scriptIndex].materials.push({ type: 'LINK', title, url, description });
        nodes.objectionFormStatus.textContent = '';
        renderScriptEditor();
      });
    });

    nodes.scriptList.querySelectorAll('[data-upload-script-image]').forEach((button) => {
      button.addEventListener('click', async () => {
        const scriptIndex = Number(button.dataset.uploadScriptImage);
        const fileInput = nodes.scriptList.querySelector(`[data-script-material-image="${scriptIndex}"]`);
        const file = fileInput?.files?.[0];
        if (!file) {
          nodes.objectionFormStatus.textContent = '请先选择该话术要上传的本地图片';
          return;
        }
        const title = nodes.scriptList.querySelector(`[data-script-material-title="${scriptIndex}"]`)?.value.trim() || file.name;
        const description = nodes.scriptList.querySelector(`[data-script-material-description="${scriptIndex}"]`)?.value.trim() || '';
        const formData = new FormData();
        formData.set('image', file);
        formData.set('title', title);
        formData.set('description', description);
        nodes.objectionFormStatus.textContent = '正在上传该话术图片物料...';
        try {
          const material = await uploadApi('/api/admin/materials/upload', formData);
          state.scripts[scriptIndex].materials.push(material);
          nodes.objectionFormStatus.textContent = '该话术图片物料已上传';
          renderScriptEditor();
        } catch (error) {
          nodes.objectionFormStatus.textContent = error.message;
        }
      });
    });
  }

  function parseMaterialsText(text) {
    const value = String(text || '').trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title, url, description = ''] = line.split(/[|｜]/).map((cell) => cell.trim());
          return {
            type: /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url || title) ? 'IMAGE' : 'LINK',
            title: title || '配套物料',
            url: url || title,
            description,
          };
        });
    }
  }

  function syncMaterialsInput() {
    if (nodes.objectionForm.materials) {
      nodes.objectionForm.materials.value = JSON.stringify(state.materials);
    }
  }

  function renderMaterialEditor() {
    syncMaterialsInput();
    if (!nodes.materialList) return;
    nodes.materialTypeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.materialType === state.materialType);
    });
    nodes.materialUrlInput.classList.toggle('hidden', state.materialType !== 'LINK');
    nodes.materialImageInput.classList.toggle('hidden', state.materialType !== 'IMAGE');
    nodes.addLinkMaterialButton.classList.toggle('hidden', state.materialType !== 'LINK');
    nodes.uploadImageMaterialButton.classList.toggle('hidden', state.materialType !== 'IMAGE');
    nodes.materialList.innerHTML = state.materials.length
      ? state.materials
          .map(
            (material, index) => `
              <article class="material-row">
                <div class="${material.type === 'IMAGE' ? 'tag-good' : 'tag'}">${material.type === 'IMAGE' ? '图片' : '链接'}</div>
                <div>
                  <h3>${escapeHtml(material.title)}</h3>
                  <p>${escapeHtml(material.description || material.url)}</p>
                </div>
                <button class="secondary-btn compact-btn" type="button" data-remove-material="${index}">移除</button>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state compact-empty">暂无配套物料，可添加链接或上传图片。</div>';

    nodes.materialList.querySelectorAll('[data-remove-material]').forEach((button) => {
      button.addEventListener('click', () => {
        state.materials.splice(Number(button.dataset.removeMaterial), 1);
        renderMaterialEditor();
      });
    });
  }

  function resetMaterialDraft() {
    if (!nodes.materialTitleInput) return;
    nodes.materialTitleInput.value = '';
    nodes.materialUrlInput.value = '';
    nodes.materialImageInput.value = '';
    nodes.materialDescriptionInput.value = '';
  }

  function validateObjectionPayload(payload) {
    const missing = [];
    if (!payload.title) missing.push('异议问题');
    if (missing.length) {
      throw new Error(`请先补充：${missing.join('、')}`);
    }
  }

  function downloadCsv(filename, rows) {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setToken(token) {
    state.token = token;
    if (token) localStorage.setItem(storageKey, token);
    else localStorage.removeItem(storageKey);
  }

  function toggleApp(isAuthed) {
    nodes.authScreen.classList.toggle('hidden', isAuthed);
    nodes.workspace.classList.toggle('hidden', !isAuthed);
    if (!isAuthed) nodes.loginForm.reset();
  }

  async function api(path, options) {
    const request = options || {};
    const headers = { 'Content-Type': 'application/json', ...(request.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, { ...request, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 0) throw new Error(payload.message || '请求失败，请稍后重试');
    return payload.data;
  }

  async function uploadApi(path, formData) {
    const headers = {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, { method: 'POST', headers, body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 0) throw new Error(payload.message || '上传失败，请稍后重试');
    return payload.data;
  }

  function selectedObjection() {
    return state.objections.find((item) => item.id === state.selectedObjectionId) || null;
  }

  function renderModules() {
    nodes.contentModule.classList.toggle('hidden', state.module !== 'content');
    nodes.trainingModule.classList.toggle('hidden', state.module !== 'training');
    nodes.accountModule.classList.toggle('hidden', state.module !== 'accounts');
    nodes.aiModule.classList.toggle('hidden', state.module !== 'ai');
    nodes.moduleButtons.forEach((button) => button.classList.toggle('active', button.dataset.module === state.module));
  }

  function renderAiConfig() {
    const config = state.aiConfig || {
      provider: 'deepseek',
      teamId: nodes.aiTeamSelect.value || null,
      teamName: state.profile?.teamName || null,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      thinking: 'disabled',
      maxConcurrentUsers: 10,
      isEnabled: false,
      hasApiKey: false,
      apiKeyPreview: '',
      updatedAt: '',
    };
    const isReady = config.isEnabled && config.hasApiKey;

    nodes.aiConfigStatus.textContent = isReady ? '已启用' : config.hasApiKey ? '已保存未启用' : '未配置';
    nodes.aiConfigStatus.className = isReady ? 'tag-good' : config.hasApiKey ? 'tag-warn' : 'tag-danger';
    nodes.aiKeyState.textContent = config.hasApiKey ? '已配置' : '未配置';
    nodes.aiKeyPreview.textContent = config.apiKeyPreview
      ? `当前密钥：${config.apiKeyPreview}，完整 Key 不会回显。`
      : '保存后仅展示脱敏预览，不展示完整 Key。';

    nodes.aiMetrics.innerHTML = [
      ['运行状态', isReady ? '启用中' : '未启用', isReady ? '训练会调用当前 AI 模型' : '训练暂不请求大模型'],
      [
        '服务商',
        aiProviderLabels[config.provider] || '其他兼容接口',
        `${config.teamName || '未选择团队'} · ${config.model || '请填写模型名称'}`,
      ],
      ['同时训练', `${config.maxConcurrentUsers || 10} 人`, '管理员配置的同时训练人数上限，最多 30 人'],
    ]
      .map(
        ([label, value, desc]) => `
          <article class="metric-card"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><p>${escapeHtml(desc)}</p></article>
        `
      )
      .join('');

    nodes.aiConfigForm.elements.isEnabled.checked = Boolean(config.isEnabled);
    nodes.aiConfigForm.elements.provider.value = config.provider || 'deepseek';
    if (config.teamId) nodes.aiTeamSelect.value = config.teamId;
    nodes.aiConfigForm.elements.apiKey.value = '';
    nodes.aiConfigForm.elements.baseUrl.value = config.baseUrl || '';
    nodes.aiConfigForm.elements.model.value = config.model || '';
    nodes.aiConfigForm.elements.thinking.value = config.thinking || 'disabled';
    nodes.aiConfigForm.elements.thinking.disabled = config.provider !== 'deepseek';
    nodes.aiConfigForm.elements.maxConcurrentUsers.value = config.maxConcurrentUsers || 10;
  }

  function renderAppSettings() {
    const showTeacherScores = Boolean(state.appSettings?.showTeacherScores);
    nodes.teacherScoreToggle.checked = showTeacherScores;
    nodes.teacherScoreStatus.textContent = showTeacherScores ? '显示分数' : '隐藏分数';
    nodes.teacherScoreStatus.className = showTeacherScores ? 'tag-good' : 'tag-warn';
  }

  function difficultyLabel(value) {
    const map = { BASIC: '基础', STANDARD: '标准', ADVANCED: '进阶' };
    return map[value] || '标准';
  }

  function renderTrainingManagement() {
    const scenarioCount = state.topics.reduce((sum, topic) => sum + (topic.scenarioCount || 0), 0);
    const stepCount = state.topics.reduce(
      (sum, topic) =>
        sum +
        (topic.scenarios || []).reduce((scenarioSum, scenario) => scenarioSum + (scenario.steps || []).length, 0),
      0
    );
    nodes.trainingMetrics.innerHTML = [
      ['训练主题', state.topics.length, '后台维护的训练主题数量'],
      ['训练场景', scenarioCount, '老师端可选择的模拟训练场景'],
      ['异议步骤', stepCount, 'AI 内部推进的多轮异议链路'],
    ]
      .map(
        ([label, value, desc]) => `
          <article class="metric-card"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><p>${escapeHtml(desc)}</p></article>
        `
      )
      .join('');

    nodes.trainingTopicSelect.innerHTML = [
      '<option value="">创建新训练主题</option>',
      ...state.topics.map((topic) => `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</option>`),
    ].join('');

    const pageData = paginate(state.topics, state.pages.topics, pageSizes.topics);
    state.pages.topics = pageData.page;
    nodes.trainingTopicList.innerHTML = pageData.items.length
      ? pageData.items
          .map(
            (topic) => `
              <article class="training-topic-card">
                <div class="training-topic-head">
                  <div>
                    <p class="eyebrow">${topic.status === 'ACTIVE' ? 'Active Topic' : 'Inactive Topic'}</p>
                    <h3>${escapeHtml(topic.title)}</h3>
                    <p>${escapeHtml(topic.description)}</p>
                  </div>
                  <div class="training-actions">
                    <span class="${topic.status === 'ACTIVE' ? 'tag-good' : 'tag-danger'}">${topic.status === 'ACTIVE' ? '已启用' : '已停用'}</span>
                    <button class="secondary-btn compact-btn danger-action" type="button" data-delete-topic="${escapeHtml(topic.id)}" data-topic-title="${escapeHtml(topic.title)}">删除主题</button>
                  </div>
                </div>
                <div class="training-scenario-list">
                  ${(topic.scenarios || []).length
                    ? topic.scenarios
                        .map(
                          (scenario) => `
                            <article class="training-scenario-row">
                              <div>
                                <h4>${escapeHtml(scenario.title)}</h4>
                                <p>${escapeHtml(scenario.description)}</p>
                                <div class="tag-row">
                                  <span class="tag">${escapeHtml(difficultyLabel(scenario.difficulty))}</span>
                                  <span class="tag-warn">${escapeHtml((scenario.steps || []).length)} 步异议</span>
                                  <span class="${scenario.status === 'ACTIVE' ? 'tag-good' : 'tag-danger'}">${scenario.status === 'ACTIVE' ? '已上架' : '已下架'}</span>
                                </div>
                              </div>
                              <button class="secondary-btn compact-btn danger-action" type="button" data-delete-scenario="${escapeHtml(scenario.id)}" data-scenario-title="${escapeHtml(scenario.title)}">删除</button>
                            </article>
                          `
                        )
                        .join('')
                    : '<div class="empty-state compact-empty">该主题下暂无训练场景。</div>'}
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state">暂无训练主题，请先上传训练场景表格导入。</div>';

    renderPagination(nodes.trainingTopicPagination, pageData, (page) => {
      state.pages.topics = page;
      renderTrainingManagement();
      nodes.trainingTopicList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    nodes.trainingTopicList.querySelectorAll('[data-delete-topic]').forEach((button) => {
      button.addEventListener('click', async () => {
        const title = button.dataset.topicTitle || '该训练主题';
        if (!window.confirm(`确认删除「${title}」吗？主题下没有训练记录的场景会一起删除。`)) return;
        try {
          await api(`/api/admin/topics/${button.dataset.deleteTopic}`, { method: 'DELETE' });
          await loadTrainingTopics();
        } catch (error) {
          alert(error.message);
        }
      });
    });

    nodes.trainingTopicList.querySelectorAll('[data-delete-scenario]').forEach((button) => {
      button.addEventListener('click', async () => {
        const title = button.dataset.scenarioTitle || '该训练场景';
        if (!window.confirm(`确认删除「${title}」吗？已有训练记录的场景不能删除。`)) return;
        try {
          await api(`/api/admin/scenarios/${button.dataset.deleteScenario}`, { method: 'DELETE' });
          await loadTrainingTopics();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  async function loadTrainingTopics() {
    state.topics = await api('/api/admin/topics');
    renderTrainingManagement();
  }

  function renderContentMetrics() {
    const activeCount = state.objections.filter((item) => item.status === 'ACTIVE').length;
    const inactiveCount = state.objections.filter((item) => item.status === 'INACTIVE').length;
    const metrics = [
      ['当前场景内容', state.objections.length, `${sceneName(state.scene)}下全部异议内容`],
      ['已上架', activeCount, '老师端可查询使用的内容'],
      ['已下架', inactiveCount, '暂不进入老师端仓库'],
    ];
    nodes.contentMetrics.innerHTML = metrics
      .map(
        ([label, value, desc]) => `
          <article class="metric-card">
            <p class="eyebrow">${escapeHtml(label)}</p>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(desc)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderScenes() {
    nodes.sceneList.innerHTML = scenes
      .map(
        (scene) => `
          <button class="scene-card ${scene.id === state.scene ? 'active' : ''}" type="button" data-scene="${escapeHtml(scene.id)}">
            <p class="eyebrow">${escapeHtml(scene.tone)}</p>
            <h3>${escapeHtml(scene.title)}</h3>
            <p>${escapeHtml(scene.desc)}</p>
          </button>
        `
      )
      .join('');
    nodes.sceneList.querySelectorAll('[data-scene]').forEach((button) => {
      button.addEventListener('click', async () => {
        state.scene = button.dataset.scene;
        state.pages.objections = 1;
        await loadObjections();
      });
    });
  }

  function renderObjections() {
    nodes.libraryTitle.textContent = `${sceneName(state.scene)}内容库`;
    const pageData = paginate(state.objections, state.pages.objections, pageSizes.objections);
    state.pages.objections = pageData.page;
    if (!state.objections.length) {
      nodes.objectionList.innerHTML = '<div class="empty-state">当前没有匹配内容，可以新增或上传文档导入。</div>';
      renderPagination(nodes.objectionPagination, pageData, () => {});
      fillObjectionForm(null);
      return;
    }
    if (!pageData.items.some((item) => item.id === state.selectedObjectionId)) {
      state.selectedObjectionId = pageData.items[0]?.id || '';
    }
    nodes.objectionList.innerHTML = pageData.items
      .map(
        (item) => `
          <article class="objection-card ${item.id === state.selectedObjectionId ? 'active' : ''}" data-objection="${escapeHtml(item.id)}">
            <p class="eyebrow">${escapeHtml(sceneName(item.scene))}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.concern)}</p>
            <div class="tag-row">
              <span class="${item.status === 'ACTIVE' ? 'tag-good' : 'tag-danger'}">${item.status === 'ACTIVE' ? '已上架' : '已下架'}</span>
              ${(item.keywords || []).map((keyword) => `<span class="tag-warn">${escapeHtml(keyword)}</span>`).join('')}
            </div>
          </article>
        `
      )
      .join('');
    renderPagination(nodes.objectionPagination, pageData, (page) => {
      state.pages.objections = page;
      state.selectedObjectionId = '';
      renderObjections();
      nodes.objectionList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nodes.objectionList.querySelectorAll('[data-objection]').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedObjectionId = card.dataset.objection;
        renderObjections();
        fillObjectionForm(selectedObjection());
      });
    });
    fillObjectionForm(selectedObjection());
  }

  function fillObjectionForm(item) {
    nodes.objectionForm.reset();
    if (!item) {
      nodes.editorTitle.textContent = '新增异议';
      nodes.editorStatus.textContent = '草稿';
      nodes.editorStatus.className = 'tag-warn';
      nodes.toggleObjectionStatusButton.textContent = '下架';
      nodes.objectionForm.id.value = '';
      nodes.objectionForm.id.defaultValue = '';
      nodes.objectionForm.scene.value = state.scene;
      state.scripts = [];
      renderScriptEditor();
      state.materials = [];
      renderMaterialEditor();
      return;
    }
    nodes.editorTitle.textContent = '编辑异议';
    nodes.editorStatus.textContent = item.status === 'ACTIVE' ? '已上架' : '已下架';
    nodes.editorStatus.className = item.status === 'ACTIVE' ? 'tag-good' : 'tag-danger';
    nodes.toggleObjectionStatusButton.textContent = item.status === 'ACTIVE' ? '下架' : '上架';
    nodes.objectionForm.id.value = item.id;
    nodes.objectionForm.scene.value = item.scene;
    nodes.objectionForm.title.value = item.title;
    nodes.objectionForm.keywords.value = (item.keywords || []).join(', ');
    nodes.objectionForm.concern.value = item.concern;
    nodes.objectionForm.thinking.value = (item.thinking || []).join('\n');
    state.scripts = [...(item.scripts || [])];
    renderScriptEditor();
    state.materials = [...(item.materials || [])];
    renderMaterialEditor();
    nodes.objectionForm.avoid.value = item.avoid;
  }

  async function loadObjections(preferredId) {
    const previousSelectedId = preferredId || state.selectedObjectionId;
    const params = new URLSearchParams({ scene: state.scene, status: nodes.objectionStatusFilter.value });
    const keyword = nodes.objectionSearchInput.value.trim();
    if (keyword) params.set('keyword', keyword);
    state.objections = await api(`/api/admin/objections?${params.toString()}`);
    if (preferredId) {
      const preferredIndex = state.objections.findIndex((item) => item.id === preferredId);
      if (preferredIndex >= 0) {
        state.pages.objections = Math.floor(preferredIndex / pageSizes.objections) + 1;
      }
    }
    state.selectedObjectionId = state.objections.some((item) => item.id === previousSelectedId)
      ? previousSelectedId
      : state.objections[0]?.id || '';
    renderContentMetrics();
    renderScenes();
    renderObjections();
  }

  function renderTeacherTrainingSessions(user) {
    if (state.expandedTrainingUserId !== user.id) return '';

    const sessions = state.trainingSessionsByUser[user.id];
    if (!sessions) {
      return '<div class="training-session-panel"><div class="empty-state compact-empty">正在加载训练记录...</div></div>';
    }

    const pageData = paginate(sessions, state.pages.sessionsByUser[user.id], pageSizes.sessions);
    state.pages.sessionsByUser[user.id] = pageData.page;

    return `
      <div class="training-session-panel">
        <div class="training-session-head">
          <strong>每次训练分数</strong>
          <span>${escapeHtml(sessions.length)} 条记录</span>
        </div>
        ${
          sessions.length
            ? `<div class="training-session-list">
                ${pageData.items
                  .map(
                    (session) => `
                      <article class="training-session-row">
                        <div class="training-session-main">
                          <div>
                            <h4>${escapeHtml(session.scenarioTitle || '未命名训练')}</h4>
                            <p>${escapeHtml(session.topicTitle || '训练主题')} · ${escapeHtml(formatDateTimeFull(session.startedAt))}</p>
                            <small>${escapeHtml(trainingStatusLabel(session.status))}</small>
                          </div>
                          <strong>${session.score === null || session.score === undefined ? '未评分' : `${escapeHtml(session.score)} 分`}</strong>
                        </div>
                        ${renderTrainingEvaluation(session)}
                      </article>
                    `
                  )
                  .join('')}
              </div>
              ${
                pageData.totalPages > 1
                  ? `<div class="pagination session-pagination">
                      <span class="pagination-summary">第 ${pageData.page}/${pageData.totalPages} 页</span>
                      <div class="pagination-actions">
                        <button class="pagination-btn" type="button" data-session-page="${pageData.page - 1}" data-session-user="${escapeHtml(user.id)}" ${pageData.page === 1 ? 'disabled' : ''}>上一页</button>
                        <button class="pagination-btn" type="button" data-session-page="${pageData.page + 1}" data-session-user="${escapeHtml(user.id)}" ${pageData.page === pageData.totalPages ? 'disabled' : ''}>下一页</button>
                      </div>
                    </div>`
                  : ''
              }`
            : '<div class="empty-state compact-empty">该老师暂无训练记录。</div>'
        }
      </div>
    `;
  }

  function renderTrainingEvaluation(session) {
    if (!session.review) {
      return '<div class="training-evaluation empty-evaluation">本次训练尚未生成 AI 评价。</div>';
    }

    const dimensions = session.review.dimensions || {};
    const dimensionLabels = [
      ['empathy', '共情'],
      ['standard', '建立标准'],
      ['enablement', '赋能'],
      ['caseProof', '给案例'],
      ['close', '缔结'],
    ];

    return `
      <section class="training-evaluation">
        <div class="evaluation-score-card">
          <div>
            <p class="eyebrow">评分情况</p>
            <strong>${escapeHtml(session.score ?? 0)} 分</strong>
            <span>${escapeHtml(scoreLevel(session.score))}</span>
          </div>
          <div class="evaluation-score-list">
            ${dimensionLabels
              .map(([key, label]) => {
                const item = dimensions[key] || {};
                return `<span>${escapeHtml(label)} ${escapeHtml(item.score ?? 0)}/20</span>`;
              })
              .join('')}
          </div>
        </div>
        <div class="evaluation-summary-grid">
          <article>
            <p class="eyebrow">AI 总评</p>
            <p>${escapeHtml(session.review.summary || '暂无总评')}</p>
          </article>
          <article>
            <p class="eyebrow">下一步建议</p>
            <p>${escapeHtml(session.review.nextAction || '暂无下一步建议')}</p>
          </article>
          <article>
            <p class="eyebrow">做得好的地方</p>
            <p>${escapeHtml(session.review.strengths || '暂无优势说明')}</p>
          </article>
          <article>
            <p class="eyebrow">需要提升</p>
            <p>${escapeHtml(session.review.weaknesses || '暂无问题说明')}</p>
          </article>
        </div>
        <div class="evaluation-dimensions">
          ${dimensionLabels
            .map(([key, label]) => {
              const item = dimensions[key] || {};
              return `
                <article>
                  <strong>${escapeHtml(label)}：${escapeHtml(item.score ?? 0)}/20</strong>
                  <p>${escapeHtml(item.reason || '暂无评价说明')}</p>
                  <small>${escapeHtml(item.suggestion || '暂无改进建议')}</small>
                </article>
              `;
            })
            .join('')}
        </div>
        ${
          (session.review.steps || []).length
            ? `
              <div class="evaluation-steps">
                <p class="eyebrow">分步骤评价</p>
                ${(session.review.steps || [])
                  .map(
                    (step) => `
                      <article>
                        <strong>${escapeHtml(step.stepOrder || '')}. ${escapeHtml(step.stepTitle || '训练步骤')}：${escapeHtml(step.score ?? 0)} 分</strong>
                        <p>${escapeHtml(step.verdict || '暂无判断')}</p>
                        <small>优势：${escapeHtml(step.strengths || '暂无')} ｜ 问题：${escapeHtml(step.issue || '暂无')} ｜ 建议：${escapeHtml(
                          step.recommendation || '暂无'
                        )}</small>
                      </article>
                    `
                  )
                  .join('')}
              </div>
            `
            : ''
        }
      </section>
    `;
  }

  function renderTeamAccess() {
    const isSuperAdmin = Boolean(state.profile?.isSuperAdmin);
    nodes.teamManagement.classList.toggle('hidden', !isSuperAdmin);
    nodes.accountRoleField.classList.toggle('hidden', !isSuperAdmin);
    nodes.accountForm.elements.role.value = isSuperAdmin ? nodes.accountForm.elements.role.value : 'TEACHER';
    nodes.roleFilter.querySelector('option[value="TRAINER"]').hidden = !isSuperAdmin;
    if (!isSuperAdmin && nodes.roleFilter.value === 'TRAINER') nodes.roleFilter.value = 'TEACHER';

    nodes.accountTeamSelect.innerHTML = state.teams.length
      ? state.teams
          .filter((team) => team.isActive)
          .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
          .join('')
      : '<option value="">请先创建团队</option>';
    nodes.accountTeamSelect.disabled = !isSuperAdmin;
    nodes.accountTeamField.querySelector('span').textContent = isSuperAdmin ? '所属团队' : '当前团队';
    const previousBatchTeamId = nodes.batchTeamSelect.value;
    nodes.batchTeamSelect.innerHTML = state.teams.length
      ? state.teams
          .filter((team) => team.isActive)
          .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
          .join('')
      : '<option value="">请先创建团队</option>';
    if (state.teams.some((team) => team.id === previousBatchTeamId)) {
      nodes.batchTeamSelect.value = previousBatchTeamId;
    }
    nodes.batchTeamField.classList.toggle('hidden', !isSuperAdmin);
    nodes.batchAssignTeamButton.classList.toggle('hidden', !isSuperAdmin);
    const previousAiTeamId = nodes.aiTeamSelect.value;
    nodes.aiTeamSelect.innerHTML = state.teams.length
      ? state.teams
          .filter((team) => team.isActive)
          .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
          .join('')
      : '<option value="">请先创建团队</option>';
    if (state.teams.some((team) => team.id === previousAiTeamId)) {
      nodes.aiTeamSelect.value = previousAiTeamId;
    }
    nodes.aiTeamSelect.disabled = !isSuperAdmin;
    nodes.aiTeamField.querySelector('span').textContent = isSuperAdmin ? '配置团队' : '当前团队';
    nodes.teacherImportHelp.textContent = isSuperAdmin
      ? '请上传 Excel 或 CSV 表格，第一行为表头：工号,姓名,密码,团队。团队名称需与已配置团队一致。'
      : `请上传 Excel 或 CSV 表格，第一行为表头：工号,姓名,密码,团队。团队列统一填写“${state.profile?.teamName || ''}”。`;
  }

  function renderTeams() {
    nodes.teamList.innerHTML = state.teams.length
      ? state.teams
          .map(
            (team) => `
              <article class="account-card">
                <div>
                  <p class="eyebrow">${team.isActive ? '启用中' : '已停用'}</p>
                  <h3>${escapeHtml(team.name)}</h3>
                  <p>${escapeHtml(team.teacherCount || 0)} 位老师 · ${escapeHtml(team.adminCount || 0)} 位团队管理员</p>
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state compact-empty">尚未创建团队。</div>';
    renderTeamAccess();
  }

  function renderAccounts() {
    const keyword = nodes.accountSearchInput.value.trim().toLowerCase();
    const role = nodes.roleFilter.value;
    const teacherUsers = state.users.filter((user) => user.role === 'TEACHER');
    const scoredTeachers = teacherUsers.filter((user) => typeof user.averageScore === 'number');
    const totalSessions = teacherUsers.reduce((sum, user) => sum + (user.sessionCount || 0), 0);
    const totalScoredSessions = teacherUsers.reduce((sum, user) => sum + (user.scoredCount || 0), 0);
    const teamAverageScore = scoredTeachers.length
      ? Math.round(scoredTeachers.reduce((sum, user) => sum + (user.averageScore || 0), 0) / scoredTeachers.length)
      : null;
    const users = state.users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (!keyword) return true;
      return [user.username, user.displayName, roleLabel(user.role, user.isSuperAdmin), user.teamName]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
    const pageData = paginate(users, state.pages.users, pageSizes.users);
    state.pages.users = pageData.page;
    const selectedIds = new Set(state.selectedTeacherIds);
    const pageTeacherIds = pageData.items
      .filter((user) => user.role === 'TEACHER')
      .map((user) => user.id);
    const selectedPageTeacherCount = pageTeacherIds.filter((userId) => selectedIds.has(userId)).length;
    nodes.selectPageTeachers.disabled = pageTeacherIds.length === 0;
    nodes.selectPageTeachers.checked = pageTeacherIds.length > 0 && selectedPageTeacherCount === pageTeacherIds.length;
    nodes.selectPageTeachers.indeterminate = selectedPageTeacherCount > 0 && selectedPageTeacherCount < pageTeacherIds.length;
    nodes.selectedTeacherCount.textContent = `已选择 ${selectedIds.size} 位老师`;
    nodes.batchDeleteUsersButton.disabled = selectedIds.size === 0;
    nodes.batchAssignTeamButton.disabled = selectedIds.size === 0 || !nodes.batchTeamSelect.value;
    nodes.accountMetrics.innerHTML = [
      ['账号总数', state.users.length, state.profile?.isSuperAdmin ? '系统内老师和管理员账号' : `${state.profile?.teamName || '本团队'}老师账号`],
      ['训练总次数', totalSessions, '所有老师累计进入训练次数'],
      ['团队平均分', teamAverageScore === null ? '暂无' : `${teamAverageScore}`, `已评分训练 ${totalScoredSessions} 次`],
    ]
      .map(
        ([label, value, desc]) => `
          <article class="metric-card"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><p>${escapeHtml(desc)}</p></article>
        `
      )
      .join('');
    nodes.accountList.innerHTML = pageData.items.length
      ? pageData.items
          .map(
            (user) => `
              <article class="account-card ${selectedIds.has(user.id) ? 'is-selected' : ''}">
                <div>
                  ${
                    user.role === 'TEACHER'
                      ? `<label class="account-select"><input type="checkbox" data-select-user="${escapeHtml(user.id)}" ${
                          selectedIds.has(user.id) ? 'checked' : ''
                        } /><span>选择老师</span></label>`
                      : ''
                  }
                  <p class="eyebrow">${escapeHtml(roleLabel(user.role, user.isSuperAdmin))}</p>
                  <h3>${escapeHtml(user.displayName || user.username)}</h3>
                  <p>账号：${escapeHtml(user.username)}</p>
                  <p>团队：${escapeHtml(user.teamName || '未分配')}</p>
                  ${
                    user.role === 'TEACHER'
                      ? `
                        <div class="training-stat-grid">
                          <div><strong>${escapeHtml(user.sessionCount || 0)}</strong><span>训练次数</span></div>
                          <div><strong>${escapeHtml(user.completedCount || 0)}</strong><span>完成次数</span></div>
                          <div><strong>${user.averageScore === null || user.averageScore === undefined ? '暂无' : escapeHtml(user.averageScore)}</strong><span>平均分</span></div>
                        </div>
                        <p>最近训练：${escapeHtml(formatDateTime(user.lastTrainedAt))}</p>
                      `
                      : '<p>管理员账号不参与老师训练统计。</p>'
                  }
                  <div class="tag-row">
                    <span class="${user.isActive ? 'tag-good' : 'tag-danger'}">${user.isActive ? '启用中' : '已停用'}</span>
                    ${
                      user.role === 'TEACHER'
                        ? `<span class="tag">${escapeHtml(user.scoredCount || 0)} 次已评分</span>`
                        : ''
                    }
                  </div>
                  ${user.role === 'TEACHER' ? renderTeacherTrainingSessions(user) : ''}
                </div>
                <div class="account-actions">
                  ${
                    state.profile?.isSuperAdmin && !user.isSuperAdmin
                      ? `<select class="compact-select" data-user-team-select="${escapeHtml(user.id)}" data-original-team-id="${escapeHtml(
                          user.teamId || ''
                        )}" aria-label="调整所属团队">
                          ${state.teams
                            .filter((team) => team.isActive)
                            .map(
                              (team) => `<option value="${escapeHtml(team.id)}" ${team.id === user.teamId ? 'selected' : ''}>${escapeHtml(team.name)}</option>`
                            )
                            .join('')}
                         </select>`
                      : ''
                  }
                  ${
                    user.role === 'TEACHER'
                      ? `<button class="secondary-btn compact-btn" type="button" data-view-training-sessions="${escapeHtml(user.id)}">${
                          state.expandedTrainingUserId === user.id ? '收起记录' : '查看训练记录'
                        }</button>`
                      : ''
                  }
                  ${
                    user.isSuperAdmin
                      ? ''
                      : `<button class="secondary-btn compact-btn" type="button" data-toggle-user="${escapeHtml(user.id)}" data-next="${user.isActive ? 'false' : 'true'}">${user.isActive ? '停用' : '启用'}</button>
                         <button class="secondary-btn compact-btn danger-action" type="button" data-delete-user="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.displayName || user.username)}">删除</button>`
                  }
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state">暂无匹配账号。</div>';
    renderPagination(nodes.accountPagination, pageData, (page) => {
      state.pages.users = page;
      state.expandedTrainingUserId = '';
      renderAccounts();
      nodes.accountList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nodes.accountList.querySelectorAll('[data-session-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.dataset.sessionUser;
        if (!userId) return;
        state.pages.sessionsByUser[userId] = Number(button.dataset.sessionPage) || 1;
        renderAccounts();
      });
    });
    nodes.accountList.querySelectorAll('[data-view-training-sessions]').forEach((button) => {
      button.addEventListener('click', async () => {
        const userId = button.dataset.viewTrainingSessions;
        if (!userId) return;
        if (state.expandedTrainingUserId === userId) {
          state.expandedTrainingUserId = '';
          renderAccounts();
          return;
        }

        state.expandedTrainingUserId = userId;
        renderAccounts();

        if (!state.trainingSessionsByUser[userId]) {
          try {
            state.trainingSessionsByUser[userId] = await api(`/api/admin/users/${userId}/training-sessions`);
          } catch (error) {
            state.trainingSessionsByUser[userId] = [];
            alert(error.message);
          }
          renderAccounts();
        }
      });
    });
    nodes.accountList.querySelectorAll('[data-toggle-user]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api(`/api/admin/users/${button.dataset.toggleUser}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: button.dataset.next === 'true' }),
        });
        await loadUsers();
      });
    });
    nodes.accountList.querySelectorAll('[data-select-user]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const nextSelectedIds = new Set(state.selectedTeacherIds);
        if (checkbox.checked) nextSelectedIds.add(checkbox.dataset.selectUser);
        else nextSelectedIds.delete(checkbox.dataset.selectUser);
        state.selectedTeacherIds = Array.from(nextSelectedIds);
        renderAccounts();
      });
    });
    nodes.accountList.querySelectorAll('[data-user-team-select]').forEach((select) => {
      select.addEventListener('change', async () => {
        const userId = select.dataset.userTeamSelect;
        const previousTeamId = select.dataset.originalTeamId || '';
        if (!userId || !select.value || select.value === previousTeamId) return;
        select.disabled = true;
        nodes.batchAccountStatus.textContent = '正在保存账号所属团队...';
        try {
          await api(`/api/admin/users/${userId}/team`, {
            method: 'PATCH',
            body: JSON.stringify({ teamId: select.value }),
          });
          await Promise.all([loadUsers(), loadTeams()]);
          nodes.batchAccountStatus.textContent = '所属团队已保存，刷新页面后仍会保留。';
        } catch (error) {
          select.value = previousTeamId;
          select.disabled = false;
          nodes.batchAccountStatus.textContent = error.message;
        }
      });
    });
    nodes.accountList.querySelectorAll('[data-delete-user]').forEach((button) => {
      button.addEventListener('click', async () => {
        const userName = button.dataset.userName || '该账号';
        if (!window.confirm(`确认删除「${userName}」吗？账号将立即无法登录，历史训练记录、评分和已创建内容会保留。`)) return;
        try {
          const result = await api(`/api/admin/users/${button.dataset.deleteUser}`, { method: 'DELETE' });
          delete state.trainingSessionsByUser[button.dataset.deleteUser];
          if (state.expandedTrainingUserId === button.dataset.deleteUser) {
            state.expandedTrainingUserId = '';
          }
          await loadUsers();
          if (result.preservedTrainingRecords > 0) {
            alert(`账号已删除，${result.preservedTrainingRecords} 条历史训练记录已保留。`);
          }
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  async function loadUsers() {
    state.users = await api('/api/admin/users');
    const teacherIds = new Set(state.users.filter((user) => user.role === 'TEACHER').map((user) => user.id));
    state.selectedTeacherIds = state.selectedTeacherIds.filter((userId) => teacherIds.has(userId));
    renderAccounts();
  }

  async function loadTeams() {
    state.teams = await api('/api/admin/teams');
    renderTeams();
    if (state.users.length) renderAccounts();
  }

  async function loadAiConfig(provider) {
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    const teamId = nodes.aiTeamSelect.value || state.profile?.teamId || '';
    if (teamId) params.set('teamId', teamId);
    const query = params.toString() ? `?${params.toString()}` : '';
    state.aiConfig = await api(`/api/admin/ai-config${query}`);
    renderAiConfig();
  }

  async function loadAppSettings() {
    state.appSettings = await api('/api/admin/app-settings');
    renderAppSettings();
  }

  async function loadProfile() {
    state.profile = await api('/api/admin/me');
    const identity = state.profile.isSuperAdmin
      ? '超级管理员'
      : `${state.profile.teamName || '未配置团队'} · ${state.profile.role === 'TRAINER' ? '团队管理员' : '老师'}`;
    nodes.profileChip.textContent = `${state.profile.displayName || state.profile.username} · ${identity}`;
  }

  async function refreshAll() {
    await loadProfile();
    await loadTeams();
    await Promise.all([loadObjections(), loadTrainingTopics(), loadUsers(), loadAiConfig(), loadAppSettings()]);
    renderModules();
  }

  nodes.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    nodes.loginStatus.textContent = '正在登录...';
    const formData = new FormData(nodes.loginForm);
    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: String(formData.get('username') || ''),
          password: String(formData.get('password') || ''),
        }),
      });
      if (result.user.role !== 'TRAINER') throw new Error('当前账号不是管理员，无法进入后台');
      setToken(result.token);
      toggleApp(true);
      nodes.loginStatus.textContent = '';
      await refreshAll();
    } catch (error) {
      nodes.loginStatus.textContent = error.message;
    }
  });

  nodes.moduleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.module = button.dataset.module;
      renderModules();
    });
  });
  nodes.logoutButton.addEventListener('click', () => {
    setToken('');
    toggleApp(false);
  });
  nodes.objectionSearchInput.addEventListener('input', () => {
    state.pages.objections = 1;
    window.setTimeout(loadObjections, 180);
  });
  nodes.objectionStatusFilter.addEventListener('change', () => {
    state.pages.objections = 1;
    loadObjections();
  });
  nodes.accountSearchInput.addEventListener('input', () => {
    state.pages.users = 1;
    state.expandedTrainingUserId = '';
    renderAccounts();
  });
  nodes.roleFilter.addEventListener('change', () => {
    state.pages.users = 1;
    state.expandedTrainingUserId = '';
    renderAccounts();
  });
  nodes.selectPageTeachers.addEventListener('change', () => {
    const keyword = nodes.accountSearchInput.value.trim().toLowerCase();
    const role = nodes.roleFilter.value;
    const visibleUsers = state.users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (!keyword) return true;
      return [user.username, user.displayName, roleLabel(user.role, user.isSuperAdmin), user.teamName]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
    const pageData = paginate(visibleUsers, state.pages.users, pageSizes.users);
    const pageTeacherIds = pageData.items.filter((user) => user.role === 'TEACHER').map((user) => user.id);
    const selectedIds = new Set(state.selectedTeacherIds);
    pageTeacherIds.forEach((userId) => {
      if (nodes.selectPageTeachers.checked) selectedIds.add(userId);
      else selectedIds.delete(userId);
    });
    state.selectedTeacherIds = Array.from(selectedIds);
    renderAccounts();
  });
  nodes.batchAssignTeamButton.addEventListener('click', async () => {
    if (!state.selectedTeacherIds.length || !nodes.batchTeamSelect.value) return;
    nodes.batchAccountStatus.textContent = '正在批量调整老师所属团队...';
    nodes.batchAssignTeamButton.disabled = true;
    try {
      const result = await api('/api/admin/users/batch/team', {
        method: 'PATCH',
        body: JSON.stringify({
          userIds: state.selectedTeacherIds,
          teamId: nodes.batchTeamSelect.value,
        }),
      });
      state.selectedTeacherIds = [];
      await Promise.all([loadUsers(), loadTeams()]);
      nodes.batchAccountStatus.textContent = `已将 ${result.updatedCount} 位老师调整到“${result.teamName}”。`;
    } catch (error) {
      nodes.batchAccountStatus.textContent = error.message;
      renderAccounts();
    }
  });
  nodes.batchDeleteUsersButton.addEventListener('click', async () => {
    const selectedIds = [...state.selectedTeacherIds];
    if (!selectedIds.length) return;
    if (!window.confirm(`确认删除已选择的 ${selectedIds.length} 位老师吗？账号将无法登录，历史训练记录和评分会继续保留。`)) return;
    nodes.batchAccountStatus.textContent = '正在批量删除老师账号...';
    nodes.batchDeleteUsersButton.disabled = true;
    try {
      const result = await api('/api/admin/users/batch/delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedIds }),
      });
      selectedIds.forEach((userId) => delete state.trainingSessionsByUser[userId]);
      if (selectedIds.includes(state.expandedTrainingUserId)) state.expandedTrainingUserId = '';
      state.selectedTeacherIds = [];
      await Promise.all([loadUsers(), loadTeams()]);
      nodes.batchAccountStatus.textContent = `已删除 ${result.deletedCount} 位老师，保留 ${result.preservedTrainingRecords} 条历史训练记录。`;
    } catch (error) {
      nodes.batchAccountStatus.textContent = error.message;
      renderAccounts();
    }
  });
  nodes.newObjectionButton.addEventListener('click', () => {
    state.selectedObjectionId = '';
    nodes.objectionSearchInput.value = '';
    fillObjectionForm(null);
  });
  nodes.addScriptButton.addEventListener('click', () => {
    const script = nodes.scriptDraftInput.value.trim();
    if (!script) {
      nodes.objectionFormStatus.textContent = '请先输入一条推荐话术';
      return;
    }
    state.scripts.push({ text: script, materials: [] });
    nodes.scriptDraftInput.value = '';
    nodes.objectionFormStatus.textContent = '';
    renderScriptEditor();
  });
  nodes.materialTypeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.materialType = button.dataset.materialType || 'LINK';
      renderMaterialEditor();
    });
  });
  nodes.addLinkMaterialButton.addEventListener('click', () => {
    const title = nodes.materialTitleInput.value.trim();
    const url = nodes.materialUrlInput.value.trim();
    const description = nodes.materialDescriptionInput.value.trim();
    if (!title || !url) {
      nodes.objectionFormStatus.textContent = '请填写链接物料的名称和链接地址';
      return;
    }
    state.materials.push({ type: 'LINK', title, url, description });
    resetMaterialDraft();
    nodes.objectionFormStatus.textContent = '';
    renderMaterialEditor();
  });
  nodes.uploadImageMaterialButton.addEventListener('click', async () => {
    const file = nodes.materialImageInput.files?.[0];
    if (!file) {
      nodes.objectionFormStatus.textContent = '请先选择本地图片';
      return;
    }
    const formData = new FormData();
    formData.set('image', file);
    formData.set('title', nodes.materialTitleInput.value.trim() || file.name);
    formData.set('description', nodes.materialDescriptionInput.value.trim());
    nodes.objectionFormStatus.textContent = '正在上传图片物料...';
    try {
      const material = await uploadApi('/api/admin/materials/upload', formData);
      state.materials.push(material);
      resetMaterialDraft();
      nodes.objectionFormStatus.textContent = '图片物料已上传';
      renderMaterialEditor();
    } catch (error) {
      nodes.objectionFormStatus.textContent = error.message;
    }
  });
  nodes.toggleObjectionStatusButton.addEventListener('click', async () => {
    const item = selectedObjection();
    if (!item) return;
    await api(`/api/admin/objections/${item.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    });
    await loadObjections();
  });
  nodes.objectionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.objectionForm);
    const id = String(formData.get('id') || '');
    const payload = {
      scene: String(formData.get('scene') || state.scene),
      title: String(formData.get('title') || '').trim(),
      concern: String(formData.get('concern') || '').trim(),
      keywords: String(formData.get('keywords') || '').split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean),
      thinking: String(formData.get('thinking') || '').split(/\n+/).map((item) => item.trim()).filter(Boolean),
      scripts: parseScriptsText(String(formData.get('scripts') || '')),
      materials: parseMaterialsText(String(formData.get('materials') || '')),
      avoid: String(formData.get('avoid') || '').trim(),
      status: selectedObjection()?.status || 'ACTIVE',
    };
    try {
      validateObjectionPayload(payload);
      const saved = await api(id ? `/api/admin/objections/${id}` : '/api/admin/objections', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      state.scene = saved.scene;
      state.selectedObjectionId = saved.id;
      nodes.objectionFormStatus.textContent = '内容已保存';
      nodes.objectionSearchInput.value = '';
      await loadObjections(saved.id);
    } catch (error) {
      nodes.objectionFormStatus.textContent = error.message;
    }
  });
  nodes.importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.importForm);
    nodes.importStatus.textContent = '正在上传并导入...';
    try {
      const result = await uploadApi('/api/admin/objections/import/document', formData);
      nodes.importStatus.textContent = `导入完成：${result.created} 条`;
      nodes.importForm.reset();
      state.pages.objections = 1;
      await loadObjections();
    } catch (error) {
      nodes.importStatus.textContent = error.message;
    }
  });
  nodes.downloadObjectionTemplateButton.addEventListener('click', () => {
    downloadCsv('异议内容导入模板.csv', [
      ['场景', '异议问题', '真实顾虑', '关键词', '解决思路', '推荐话术', '配套物料', '禁忌提醒', '状态'],
      [
        '课前进线',
        '孩子坐不住，担心体验课没效果',
        '家长担心孩子专注力不足，体验课浪费时间，也担心老师无法控场。',
        '坐不住、专注力、没效果',
        '先承认担心；再说明体验课会观察孩子适配度；最后给家长明确观察标准',
        '您这个担心很正常，体验课就是用来观察孩子能不能被老师带起来，以及他对课程有没有兴趣。',
        '孩子作品示例|https://example.com/work.png|家长担心效果时可配合发送',
        '不要直接保证一定有效，也不要评价孩子不配合。',
        'ACTIVE',
      ],
    ]);
  });
  nodes.refreshTrainingButton.addEventListener('click', loadTrainingTopics);
  nodes.trainingImportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.trainingImportForm);
    const file = formData.get('document');
    nodes.trainingImportStatus.textContent = '正在导入训练场景...';
    try {
      if (!(file instanceof File) || !file.size) {
        throw new Error('请先选择训练场景表格');
      }
      const result = await uploadApi('/api/admin/scenarios/import/document', formData);
      nodes.trainingImportStatus.textContent = `导入完成：创建 ${result.created} 个训练场景`;
      nodes.trainingImportForm.reset();
      state.pages.topics = 1;
      await loadTrainingTopics();
    } catch (error) {
      nodes.trainingImportStatus.textContent = error.message;
    }
  });
  nodes.downloadTrainingTemplateButton.addEventListener('click', () => {
    downloadCsv('异议训练导入模板.csv', [
      ['场景标题', '场景说明', '家长情况', '开场话术', '难度', '异议顺序', '异议标题', '异议内容', '评估重点', '状态'],
      [
        '体验课新人训-价格敏感家长',
        '家长认可体验课，但对正式课价格和效果仍有顾虑。',
        '李妈妈，孩子 7 岁，体验课后孩子兴趣不错，但家长担心投入产出。',
        '李妈妈：老师，孩子今天玩得挺开心，但正式课价格是不是有点高？',
        'STANDARD',
        '1',
        '价格偏高',
        '你们课程太贵了。',
        '判断老师是否先共情价格顾虑，再建立比较标准并说明孩子收获。',
        'ACTIVE',
      ],
      [
        '体验课新人训-价格敏感家长',
        '家长认可体验课，但对正式课价格和效果仍有顾虑。',
        '李妈妈，孩子 7 岁，体验课后孩子兴趣不错，但家长担心投入产出。',
        '李妈妈：老师，孩子今天玩得挺开心，但正式课价格是不是有点高？',
        'STANDARD',
        '2',
        '要和家人商量',
        '我还得和孩子爸爸商量一下。',
        '判断老师是否识别真实决策点，并推动明确下一步反馈时间。',
        'ACTIVE',
      ],
    ]);
  });
  nodes.teamForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.teamForm);
    nodes.teamStatus.textContent = '正在创建团队...';
    try {
      await api('/api/admin/teams', {
        method: 'POST',
        body: JSON.stringify({ name: String(formData.get('name') || '').trim() }),
      });
      nodes.teamForm.reset();
      nodes.teamStatus.textContent = '团队已创建，现在可以为该团队添加管理员和老师。';
      await loadTeams();
    } catch (error) {
      nodes.teamStatus.textContent = error.message;
    }
  });
  nodes.accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.accountForm);
    nodes.accountStatus.textContent = '正在创建...';
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: String(formData.get('username') || ''),
          displayName: String(formData.get('displayName') || ''),
          password: String(formData.get('password') || ''),
          role: String(formData.get('role') || 'TEACHER'),
          teamId: String(formData.get('teamId') || nodes.accountTeamSelect.value || ''),
        }),
      });
      nodes.accountForm.reset();
      nodes.accountStatus.textContent = '账号已创建';
      state.pages.users = 1;
      await loadUsers();
      await loadTeams();
    } catch (error) {
      nodes.accountStatus.textContent = error.message;
    }
  });
  nodes.teacherImportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.teacherImportForm);
    nodes.teacherImportStatus.textContent = '正在导入老师账号...';
    try {
      const file = formData.get('usersFile');
      if (!(file instanceof File) || !file.size) {
        throw new Error('请先选择老师账号 Excel 或 CSV 表格');
      }
      const result = await uploadApi('/api/admin/users/import/document', formData);
      nodes.teacherImportStatus.textContent = `导入完成：创建 ${result.created} 个，跳过 ${result.skipped} 个`;
      nodes.teacherImportForm.reset();
      state.pages.users = 1;
      await loadUsers();
      await loadTeams();
    } catch (error) {
      nodes.teacherImportStatus.textContent = error.message;
    }
  });
  nodes.downloadTeacherTemplateButton.addEventListener('click', () => {
    const sampleTeamName = state.profile?.isSuperAdmin
      ? state.teams.find((team) => team.isActive)?.name || '示例团队'
      : state.profile?.teamName || '本团队';
    downloadCsv('老师账号导入模板.csv', [
      ['工号', '姓名', '密码', '团队'],
      ['teacher001', '张老师', '123456', sampleTeamName],
      ['teacher002', '李老师', '123456', sampleTeamName],
    ]);
  });
  nodes.aiConfigForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(nodes.aiConfigForm);
    let configSaved = false;
    nodes.aiConfigSaveStatus.textContent = '正在保存 AI 配置...';
    try {
      state.aiConfig = await api('/api/admin/ai-config', {
        method: 'PUT',
        body: JSON.stringify({
          isEnabled: Boolean(formData.get('isEnabled')),
          teamId: String(formData.get('teamId') || nodes.aiTeamSelect.value || ''),
          provider: String(formData.get('provider') || 'deepseek'),
          apiKey: String(formData.get('apiKey') || '').trim(),
          baseUrl: String(formData.get('baseUrl') || '').trim(),
          model: String(formData.get('model') || '').trim(),
          thinking: String(formData.get('thinking') || 'disabled'),
          maxConcurrentUsers: Number(formData.get('maxConcurrentUsers') || 10),
        }),
      });
      configSaved = true;
      renderAiConfig();
      if (state.aiConfig.hasApiKey) {
        nodes.aiConfigSaveStatus.textContent = '配置已保存，正在测试模型连接...';
        const tested = await api('/api/admin/ai-config/test', {
          method: 'POST',
          body: JSON.stringify({ provider: state.aiConfig.provider, teamId: state.aiConfig.teamId }),
        });
        nodes.aiConfigSaveStatus.textContent = `配置已保存，模型连接成功（${tested.latencyMs} ms）`;
      } else {
        nodes.aiConfigSaveStatus.textContent = 'AI 配置已保存，尚未填写 API Key';
      }
    } catch (error) {
      nodes.aiConfigSaveStatus.textContent = configSaved
        ? `配置已保存，但连接测试失败：${error.message}`
        : error.message;
    }
  });
  nodes.aiConfigTestButton.addEventListener('click', async () => {
    const provider = nodes.aiConfigForm.elements.provider.value || 'deepseek';
    nodes.aiConfigSaveStatus.textContent = '正在测试已保存的模型配置...';
    nodes.aiConfigTestButton.disabled = true;
    try {
      const tested = await api('/api/admin/ai-config/test', {
        method: 'POST',
        body: JSON.stringify({ provider, teamId: nodes.aiTeamSelect.value || state.profile?.teamId || '' }),
      });
      nodes.aiConfigSaveStatus.textContent = `模型连接成功（${tested.latencyMs} ms）`;
    } catch (error) {
      nodes.aiConfigSaveStatus.textContent = `连接测试失败：${error.message}`;
    } finally {
      nodes.aiConfigTestButton.disabled = false;
    }
  });
  nodes.teacherScoreToggle.addEventListener('change', async () => {
    const showTeacherScores = nodes.teacherScoreToggle.checked;
    nodes.teacherScoreToggle.disabled = true;
    nodes.teacherScoreSaveStatus.textContent = '正在保存显示设置...';
    try {
      state.appSettings = await api('/api/admin/app-settings', {
        method: 'PUT',
        body: JSON.stringify({ showTeacherScores }),
      });
      renderAppSettings();
      nodes.teacherScoreSaveStatus.textContent = showTeacherScores
        ? '已开启，老师重新打开复盘后可查看分数。'
        : '已关闭，老师端仅展示复盘建议。';
    } catch (error) {
      nodes.teacherScoreToggle.checked = !showTeacherScores;
      nodes.teacherScoreSaveStatus.textContent = error.message;
    } finally {
      nodes.teacherScoreToggle.disabled = false;
    }
  });
  nodes.aiConfigForm.elements.provider.addEventListener('change', async (event) => {
    const provider = event.target.value || 'deepseek';
    nodes.aiConfigSaveStatus.textContent = '正在读取该服务商配置...';
    try {
      await loadAiConfig(provider);
      nodes.aiConfigSaveStatus.textContent = '';
    } catch (error) {
      nodes.aiConfigSaveStatus.textContent = error.message;
    }
  });
  nodes.aiTeamSelect.addEventListener('change', async () => {
    nodes.aiConfigSaveStatus.textContent = '正在读取该团队的模型配置...';
    try {
      await loadAiConfig(nodes.aiConfigForm.elements.provider.value || 'deepseek');
      nodes.aiConfigSaveStatus.textContent = '';
    } catch (error) {
      nodes.aiConfigSaveStatus.textContent = error.message;
    }
  });

  async function bootstrap() {
    if (!state.token) {
      toggleApp(false);
      return;
    }
    try {
      toggleApp(true);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setToken('');
      toggleApp(false);
    }
  }

  bootstrap();
})();
