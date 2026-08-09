(function () {
  const storageKey = 'yycl_v2_admin_token';
  const scenes = [
    { id: 'pre', title: '课前进线', desc: '用户刚进线或预约体验前，重点解决信任、时间、孩子适配和到课意愿。', tone: '轻解释，重确认' },
    { id: 'mid', title: '课中推进', desc: '体验课进行中或刚结束，重点推动家长理解孩子表现和课程价值。', tone: '多观察，少催促' },
    { id: 'close', title: '结转促单', desc: '结转报名阶段，重点处理价格、犹豫、对比、决策人和付款节奏。', tone: '给证据，给下一步' },
  ];

  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    module: 'content',
    scene: 'pre',
    objections: [],
    selectedObjectionId: '',
    topics: [],
    users: [],
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
    contentMetrics: document.getElementById('adminContentMetrics'),
    sceneList: document.getElementById('adminSceneList'),
    libraryTitle: document.getElementById('adminLibraryTitle'),
    objectionSearchInput: document.getElementById('adminObjectionSearchInput'),
    objectionStatusFilter: document.getElementById('adminObjectionStatusFilter'),
    objectionList: document.getElementById('adminObjectionList'),
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
    trainingTopicSelect: document.getElementById('adminTrainingTopicSelect'),
    trainingImportForm: document.getElementById('adminTrainingImportForm'),
    trainingImportStatus: document.getElementById('adminTrainingImportStatus'),
    refreshTrainingButton: document.getElementById('adminRefreshTrainingButton'),
    downloadTrainingTemplateButton: document.getElementById('adminDownloadTrainingTemplateButton'),
    accountMetrics: document.getElementById('adminAccountMetrics'),
    accountSearchInput: document.getElementById('adminAccountSearchInput'),
    roleFilter: document.getElementById('adminRoleFilter'),
    accountList: document.getElementById('adminAccountList'),
    accountForm: document.getElementById('adminAccountForm'),
    accountStatus: document.getElementById('adminAccountStatus'),
    teacherImportForm: document.getElementById('adminTeacherImportForm'),
    teacherImportStatus: document.getElementById('adminTeacherImportStatus'),
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

  function roleLabel(role) {
    return role === 'TRAINER' ? '管理员' : '老师';
  }

  function formatDateTime(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseCommaLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if ((char === ',' || char === '，') && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  }

  function parseTeacherImportText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^账号[,，]/.test(line) && !/^username[,，]/i.test(line))
      .map((line, index) => {
        const [username, displayName, password] = parseCommaLine(line);
        if (!username || !displayName || !password) {
          throw new Error(`第 ${index + 1} 行格式不正确，请使用：账号,姓名,初始密码`);
        }
        return { username, displayName, password };
      });
  }

  function parseTeacherImportText(text) {
    const rows = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length < 2) {
      throw new Error('请上传包含表头和账号数据的 CSV 表格');
    }

    const headers = parseCommaLine(rows[0]).map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
    const usernameIndex = headers.findIndex((header) => ['工号', '账号', '登录账号', 'username'].includes(header));
    const displayNameIndex = headers.findIndex((header) => ['姓名', '老师姓名', 'displayname', 'name'].includes(header));
    const passwordIndex = headers.findIndex((header) => ['密码', '初始密码', 'password'].includes(header));
    if (usernameIndex < 0 || displayNameIndex < 0 || passwordIndex < 0) {
      throw new Error('表头必须包含：工号,姓名,密码');
    }

    return rows.slice(1).map((line, index) => {
      const cells = parseCommaLine(line);
      const username = (cells[usernameIndex] || '').trim();
      const displayName = (cells[displayNameIndex] || '').trim();
      const password = (cells[passwordIndex] || '').trim();
      if (!username || !displayName || !password) {
        throw new Error(`第 ${index + 2} 行缺少工号、姓名或密码`);
      }
      return { username, displayName, password };
    });
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
    nodes.moduleButtons.forEach((button) => button.classList.toggle('active', button.dataset.module === state.module));
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

    nodes.trainingTopicList.innerHTML = state.topics.length
      ? state.topics
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
        await loadObjections();
      });
    });
  }

  function renderObjections() {
    nodes.libraryTitle.textContent = `${sceneName(state.scene)}内容库`;
    if (!state.objections.length) {
      nodes.objectionList.innerHTML = '<div class="empty-state">当前没有匹配内容，可以新增或上传文档导入。</div>';
      fillObjectionForm(null);
      return;
    }
    if (!state.objections.some((item) => item.id === state.selectedObjectionId)) {
      state.selectedObjectionId = state.objections[0].id;
    }
    nodes.objectionList.innerHTML = state.objections
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
    state.selectedObjectionId = state.objections.some((item) => item.id === previousSelectedId)
      ? previousSelectedId
      : state.objections[0]?.id || '';
    renderContentMetrics();
    renderScenes();
    renderObjections();
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
      return [user.username, user.displayName, roleLabel(user.role)].join(' ').toLowerCase().includes(keyword);
    });
    nodes.accountMetrics.innerHTML = [
      ['账号总数', state.users.length, '系统内老师和管理员账号'],
      ['训练总次数', totalSessions, '所有老师累计进入训练次数'],
      ['团队平均分', teamAverageScore === null ? '暂无' : `${teamAverageScore}`, `已评分训练 ${totalScoredSessions} 次`],
    ]
      .map(
        ([label, value, desc]) => `
          <article class="metric-card"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><p>${escapeHtml(desc)}</p></article>
        `
      )
      .join('');
    nodes.accountList.innerHTML = users.length
      ? users
          .map(
            (user) => `
              <article class="account-card">
                <div>
                  <p class="eyebrow">${escapeHtml(roleLabel(user.role))}</p>
                  <h3>${escapeHtml(user.displayName || user.username)}</h3>
                  <p>账号：${escapeHtml(user.username)}</p>
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
                </div>
                <div class="account-actions">
                  <button class="secondary-btn compact-btn" type="button" data-toggle-user="${escapeHtml(user.id)}" data-next="${user.isActive ? 'false' : 'true'}">${user.isActive ? '停用' : '启用'}</button>
                  <button class="secondary-btn compact-btn danger-action" type="button" data-delete-user="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.displayName || user.username)}">删除</button>
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-state">暂无匹配账号。</div>';
    nodes.accountList.querySelectorAll('[data-toggle-user]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api(`/api/admin/users/${button.dataset.toggleUser}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: button.dataset.next === 'true' }),
        });
        await loadUsers();
      });
    });
    nodes.accountList.querySelectorAll('[data-delete-user]').forEach((button) => {
      button.addEventListener('click', async () => {
        const userName = button.dataset.userName || '该账号';
        if (!window.confirm(`确认删除「${userName}」吗？已有训练记录或创建过内容的账号将无法删除。`)) return;
        try {
          await api(`/api/admin/users/${button.dataset.deleteUser}`, { method: 'DELETE' });
          await loadUsers();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  async function loadUsers() {
    state.users = await api('/api/admin/users');
    renderAccounts();
  }

  async function loadProfile() {
    state.profile = await api('/api/admin/me');
    nodes.profileChip.textContent = `${state.profile.displayName || state.profile.username} · ${
      state.profile.role === 'TRAINER' ? '管理员' : '老师'
    }`;
  }

  async function refreshAll() {
    await Promise.all([loadProfile(), loadObjections(), loadTrainingTopics(), loadUsers()]);
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
  nodes.objectionSearchInput.addEventListener('input', () => window.setTimeout(loadObjections, 180));
  nodes.objectionStatusFilter.addEventListener('change', loadObjections);
  nodes.accountSearchInput.addEventListener('input', renderAccounts);
  nodes.roleFilter.addEventListener('change', renderAccounts);
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
        }),
      });
      nodes.accountForm.reset();
      nodes.accountStatus.textContent = '账号已创建';
      await loadUsers();
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
        throw new Error('请先选择老师账号 CSV 表格');
      }
      const result = await uploadApi('/api/admin/users/import/document', formData);
      nodes.teacherImportStatus.textContent = `导入完成：创建 ${result.created} 个，跳过 ${result.skipped} 个`;
      nodes.teacherImportForm.reset();
      await loadUsers();
    } catch (error) {
      nodes.teacherImportStatus.textContent = error.message;
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
