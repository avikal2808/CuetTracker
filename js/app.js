/**
 * Main Application Orchestrator
 * Tab routing, bottom navigation bar badges, modals, toasts, and event hooks.
 */
class AppOrchestrator {
  constructor() {
    this.activeTab = 'planner';
    this.toastTimeout = null;
    this.init();
  }

  init() {
    // Setup bottom nav listeners
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          this.navigateToTab(targetTab);
        }
      });
    });

    // Setup Storage listeners
    Storage.on('change', () => this.updateNavBadges());
    Storage.on('syncStatus', (status) => this.updateSyncChip(status));

    // Handle ESC key for modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Initial render
    this.navigateToTab('planner');
    this.updateNavBadges();
  }

  navigateToTab(tabName) {
    this.activeTab = tabName;

    // Update bottom nav button active states
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isTarget);
    });

    // Update view containers visibility
    document.querySelectorAll('.view-tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`view-${tabName}`);
    if (activePane) {
      activePane.classList.add('active');
    }

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger render for that specific controller
    if (tabName === 'planner' && window.Planner) window.Planner.render();
    if (tabName === 'schedule' && window.Schedule) window.Schedule.render();
    if (tabName === 'queue' && window.Queue) window.Queue.render();
    if (tabName === 'mocks' && window.Mocks) window.Mocks.render();
    if (tabName === 'backlog' && window.Backlog) window.Backlog.render();
    if (tabName === 'dashboard' && window.Dashboard) window.Dashboard.render();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  navigateToSyllabusSubject(subjectKey) {
    this.navigateToTab('queue');
    if (window.Queue) {
      window.Queue.setSubject(subjectKey);
    }
  }

  updateNavBadges() {
    const state = Storage.getState();
    const today = Storage.getTodayString();
    const todayTasks = state.planner[today] || [];
    const pendingToday = todayTasks.filter(t => t.status === 'pending').length;
    const pendingBacklog = (state.backlog || []).filter(b => b.status === 'pending').length;

    // Today badge
    const todayBadge = document.getElementById('nav-badge-today');
    if (todayBadge) {
      if (pendingToday > 0) {
        todayBadge.textContent = pendingToday;
        todayBadge.style.display = 'inline-flex';
      } else {
        todayBadge.style.display = 'none';
      }
    }

    // Backlog badge
    const backlogBadge = document.getElementById('nav-badge-backlog');
    if (backlogBadge) {
      if (pendingBacklog > 0) {
        backlogBadge.textContent = pendingBacklog;
        backlogBadge.style.display = 'inline-flex';
      } else {
        backlogBadge.style.display = 'none';
      }
    }
  }

  updateSyncChip(syncInfo) {
    const chip = document.getElementById('header-sync-chip');
    if (!chip) return;

    let icon = 'cloud';
    let text = syncInfo.message || 'Local Storage Active';
    let cssClass = 'sync-local';

    if (syncInfo.status === 'synced') {
      icon = 'check-circle';
      cssClass = 'sync-live';
    } else if (syncInfo.status === 'syncing') {
      icon = 'refresh-cw';
      cssClass = 'sync-busy';
    } else if (syncInfo.status === 'offline') {
      icon = 'wifi-off';
      cssClass = 'sync-offline';
    } else if (syncInfo.status === 'rls_warning') {
      icon = 'shield-alert';
      cssClass = 'sync-warning';
    }

    chip.className = `header-status-chip ${cssClass}`;
    chip.innerHTML = `<i data-lucide="${icon}"></i> <span>${text}</span>`;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    toast.className = `app-toast-container toast-${type} active`;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span class="toast-message">${message}</span>
    `;

    if (window.lucide) {
      window.lucide.createIcons();
    }

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 3200);
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  openCloudStatusModal() {
    const modal = document.getElementById('cloud-info-modal');
    if (modal) modal.classList.add('active');
  }

  closeCloudStatusModal() {
    const modal = document.getElementById('cloud-info-modal');
    if (modal) modal.classList.remove('active');
  }

  async runConnectionTest() {
    const btn = document.getElementById('btn-run-connection-test');
    const outputEl = document.getElementById('connection-test-results');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Testing Connection...';
      if (window.lucide) window.lucide.createIcons();
    }

    if (outputEl) {
      outputEl.style.display = 'block';
      outputEl.innerHTML = `
        <div class="test-running-box">
          <div class="spinner-small"></div>
          <span>Testing Supabase endpoint reachability, table read, and write permissions...</span>
        </div>
      `;
    }

    try {
      const results = await Storage.testConnection();

      if (outputEl) {
        const pingStatus = results.ping.ok
          ? `<span class="badge-success">PASS (${results.ping.latencyMs}ms)</span>`
          : `<span class="badge-danger">FAIL (${results.ping.message})</span>`;

        const readStatus = results.read.ok
          ? `<span class="badge-success">PASS (${results.read.latencyMs}ms &bull; ${results.read.count} rows)</span>`
          : `<span class="badge-danger">FAIL (${results.read.message})</span>`;

        let writeStatus = '';
        if (results.write.ok) {
          writeStatus = `<span class="badge-success">PASS (${results.write.latencyMs}ms &bull; Upsert OK)</span>`;
        } else if (results.write.isRlsBlocked) {
          writeStatus = `<span class="badge-warning">RLS PROTECTED (Read-Only)</span>`;
        } else {
          writeStatus = `<span class="badge-danger">FAIL</span>`;
        }

        let rlsNoticeHtml = '';
        if (results.write.isRlsBlocked) {
          rlsNoticeHtml = `
            <div class="rls-notice-panel">
              <div class="rls-notice-title">
                <i data-lucide="shield-alert"></i>
                <strong>PostgreSQL Row-Level Security (RLS) Active</strong>
              </div>
              <p class="rls-notice-desc">
                The connection and READ operations succeed, but writes from the <code>anon</code> key are restricted by Supabase RLS.
                The app is safely using <strong>instant LocalStorage</strong>. To allow direct cloud writes:
              </p>
              <div class="rls-code-box">
                <pre id="rls-sql-code">ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON public.student_progress FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON public.student_progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON public.student_progress FOR UPDATE TO anon USING (true);</pre>
                <button class="btn-copy-sql" onclick="App.copyRlsSql()">
                  <i data-lucide="copy"></i> Copy SQL
                </button>
              </div>
            </div>
          `;
        }

        const bannerClass = results.allPassed ? 'alert-success' : (results.write.isRlsBlocked ? 'alert-warning' : 'alert-danger');
        const bannerIcon = results.allPassed ? 'check-circle-2' : (results.write.isRlsBlocked ? 'alert-circle' : 'x-circle');
        const bannerTitle = results.allPassed 
          ? 'Connection Verified: Live Cloud Sync Active!' 
          : (results.write.isRlsBlocked 
              ? 'Connected & Reading Successfully (Writes Require RLS Policy)' 
              : 'Connection Error to Supabase');

        outputEl.innerHTML = `
          <div class="test-result-banner ${bannerClass}">
            <i data-lucide="${bannerIcon}"></i>
            <span>${bannerTitle}</span>
          </div>

          <div class="test-steps-grid">
            <div class="test-step-row">
              <span class="test-step-name"><i data-lucide="globe"></i> API Endpoint Reachability:</span>
              <span class="test-step-val">${pingStatus}</span>
            </div>
            <div class="test-step-row">
              <span class="test-step-name"><i data-lucide="database"></i> Table Read (<code>student_progress</code>):</span>
              <span class="test-step-val">${readStatus}</span>
            </div>
            <div class="test-step-row">
              <span class="test-step-name"><i data-lucide="arrow-up-right"></i> Table Write / Upsert:</span>
              <span class="test-step-val">${writeStatus}</span>
            </div>
          </div>

          ${rlsNoticeHtml}
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      if (results.allPassed) {
        this.showToast('Supabase connection verified: Live read & write active!', 'success');
      } else if (results.write.isRlsBlocked) {
        this.showToast('Supabase reachable: Reading OK, write blocked by RLS', 'warning');
      } else {
        this.showToast('Supabase connection test encountered errors', 'error');
      }

    } catch (e) {
      if (outputEl) {
        outputEl.innerHTML = `<div class="test-result-banner alert-danger"><i data-lucide="x-circle"></i> <span>Error executing test: ${e.message}</span></div>`;
        if (window.lucide) window.lucide.createIcons();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="play"></i> Test Connection Again';
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  copyRlsSql() {
    const code = `ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON public.student_progress FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON public.student_progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON public.student_progress FOR UPDATE TO anon USING (true);`;
    navigator.clipboard.writeText(code).then(() => {
      this.showToast('SQL copied to clipboard! Paste in Supabase SQL Editor.', 'success');
    }).catch(() => {
      this.showToast('Failed to copy to clipboard', 'warning');
    });
  }

  openEditPlannerTaskModal(taskId, dateStr) {
    const modal = document.getElementById('edit-planner-task-modal');
    if (!modal) return;

    const state = Storage.getState();
    const tasks = state.planner[dateStr] || [];
    const task = tasks.find(t => t.id === taskId);

    const titleInput = document.getElementById('modal-task-topic-input');
    const subjectSelect = document.getElementById('modal-task-subject-select');
    const durationInput = document.getElementById('modal-task-duration-input');
    const hiddenTaskId = document.getElementById('modal-task-id-hidden');
    const hiddenDate = document.getElementById('modal-task-date-hidden');

    if (hiddenTaskId) hiddenTaskId.value = taskId;
    if (hiddenDate) hiddenDate.value = dateStr;

    if (task) {
      if (titleInput) titleInput.value = task.topic;
      if (subjectSelect) subjectSelect.value = task.subjectId || 'accountancy';
      if (durationInput) durationInput.value = task.duration || 45;
    } else {
      if (titleInput) titleInput.value = '';
      if (subjectSelect) subjectSelect.value = 'accountancy';
      if (durationInput) durationInput.value = 45;
    }

    // Populate queue suggestions
    this.renderQueueSuggestionsInModal(subjectSelect ? subjectSelect.value : 'accountancy');

    modal.classList.add('active');
  }

  renderQueueSuggestionsInModal(subjectKey) {
    const suggestionsList = document.getElementById('modal-task-queue-suggestions');
    if (!suggestionsList) return;

    const state = Storage.getState();
    const queue = state.queues[subjectKey] || [];
    const uncompleted = queue.filter(item => !Storage.isSubtopicDone(item.id)).slice(0, 5);

    if (uncompleted.length === 0) {
      suggestionsList.innerHTML = `<p class="empty-hint">No pending queue items for this subject.</p>`;
      return;
    }

    suggestionsList.innerHTML = uncompleted.map(item => `
      <div class="suggestion-item" onclick="App.applySuggestionToModal('${item.title.replace(/'/g, "\\'")}', '${item.unitTitle.replace(/'/g, "\\'")}', ${item.duration || 45}, '${item.id}')">
        <span class="suggestion-title">${item.title}</span>
        <span class="suggestion-duration">${item.duration || 45}m</span>
      </div>
    `).join('');
  }

  applySuggestionToModal(title, unitTitle, duration, subtopicId) {
    const titleInput = document.getElementById('modal-task-topic-input');
    const durationInput = document.getElementById('modal-task-duration-input');
    const hiddenSubtopicId = document.getElementById('modal-subtopic-id-hidden');

    if (titleInput) titleInput.value = title;
    if (durationInput) durationInput.value = duration;
    if (hiddenSubtopicId) hiddenSubtopicId.value = subtopicId;
  }

  saveEditPlannerTask() {
    const hiddenTaskId = document.getElementById('modal-task-id-hidden').value;
    const dateStr = document.getElementById('modal-task-date-hidden').value;
    const titleInput = document.getElementById('modal-task-topic-input').value.trim();
    const subjectSelect = document.getElementById('modal-task-subject-select').value;
    const durationInput = parseInt(document.getElementById('modal-task-duration-input').value, 10) || 45;
    const hiddenSubtopicId = document.getElementById('modal-subtopic-id-hidden')?.value || null;

    if (!titleInput) {
      this.showToast('Please specify a topic name', 'warning');
      return;
    }

    const state = Storage.getState();
    if (!state.planner[dateStr]) {
      state.planner[dateStr] = Storage.generateTasksForDate(dateStr);
    }

    const tasks = state.planner[dateStr];

    if (hiddenTaskId.startsWith('new_')) {
      const blockId = hiddenTaskId.replace('new_', '');
      tasks.push({
        id: `task_${Date.now()}`,
        blockId: blockId,
        blockTitle: `${blockId.toUpperCase()} Block (${durationInput}m)`,
        duration: durationInput,
        subject: CONFIG.subjects[subjectSelect]?.name || subjectSelect,
        subjectId: subjectSelect,
        topic: titleInput,
        unitTitle: 'Custom Study Plan',
        subtopicId: hiddenSubtopicId,
        status: 'pending',
        scheduledDate: dateStr,
        completedAt: null
      });
    } else {
      const target = tasks.find(t => t.id === hiddenTaskId);
      if (target) {
        target.topic = titleInput;
        target.subject = CONFIG.subjects[subjectSelect]?.name || subjectSelect;
        target.subjectId = subjectSelect;
        target.duration = durationInput;
        if (hiddenSubtopicId) target.subtopicId = hiddenSubtopicId;
      }
    }

    Storage.updateState(state);
    this.closeAllModals();
    this.showToast('Study block updated!', 'success');
  }

  handleBackupUpload(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = Storage.importBackupJson(e.target.result);
      if (res.success) {
        this.showToast('Backup restored successfully!', 'success');
        this.navigateToTab('dashboard');
      } else {
        this.showToast(`Import failed: ${res.error}`, 'error');
      }
    };
    reader.readAsText(file);
  }
}

// Bootstrap when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.App = new AppOrchestrator();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
