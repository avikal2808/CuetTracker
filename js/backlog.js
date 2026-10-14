/**
 * Backlog Vault Controller
 * Grouped missed tasks, historical date stamps, "Clear/Done",
 * "Reschedule to Today", and "Dismiss/Remove" options.
 */
class BacklogController {
  constructor() {
    this.filterSubject = 'all';
    this.init();
  }

  init() {
    Storage.on('change', () => this.render());
  }

  clearBacklogItem(backlogId) {
    const state = Storage.getState();
    const item = (state.backlog || []).find(b => b.id === backlogId);
    if (!item) return;

    item.status = 'cleared';
    item.clearedAt = new Date().toISOString();

    // If it has a subtopicId, mark it completed in syllabus progress
    if (item.subtopicId) {
      if (!state.syllabusProgress) state.syllabusProgress = {};
      state.syllabusProgress[item.subtopicId] = {
        completed: true,
        completedAt: new Date().toISOString(),
        preMarked: false
      };
    }

    Storage.updateState(state);

    if (window.confetti) {
      window.confetti({ particleCount: 35, spread: 45, colors: ['#4F8A68', '#4F9D69'] });
    }

    if (window.App) {
      window.App.showToast(`Cleared "${item.topic}" from Backlog Vault!`, 'success');
    }
  }

  dismissBacklogItem(backlogId) {
    const state = Storage.getState();
    const item = (state.backlog || []).find(b => b.id === backlogId);
    if (!item) return;

    item.status = 'dismissed';
    item.dismissedAt = new Date().toISOString();

    Storage.updateState(state);

    if (window.App) {
      window.App.showToast(`Dismissed task from backlog.`, 'info');
    }
  }

  rescheduleToToday(backlogId) {
    const state = Storage.getState();
    const item = (state.backlog || []).find(b => b.id === backlogId);
    if (!item) return;

    const today = Storage.getTodayString();
    if (!state.planner[today]) {
      state.planner[today] = Storage.generateTasksForDate(today);
    }

    // Append to today's planner
    state.planner[today].push({
      id: `task_from_bl_${Date.now()}`,
      blockId: 'secondary',
      blockTitle: `${item.blockTitle || 'Study Block'} (Rescheduled)`,
      duration: item.duration || 45,
      subject: item.subject,
      subjectId: item.subjectId,
      topic: item.topic,
      unitTitle: item.unitTitle || 'From Backlog Vault',
      subtopicId: item.subtopicId || null,
      status: 'pending',
      scheduledDate: today,
      completedAt: null,
      notes: `Restored from Backlog (originally ${item.originalDate})`
    });

    // Mark as cleared in backlog
    item.status = 'cleared';
    item.clearedAt = new Date().toISOString();

    Storage.updateState(state);

    if (window.App) {
      window.App.showToast(`Task rescheduled to Today's planner!`, 'success');
      window.App.navigateToTab('planner');
    }
  }

  clearAllPending() {
    const state = Storage.getState();
    const pendingList = (state.backlog || []).filter(b => b.status === 'pending');
    if (pendingList.length === 0) return;

    if (!confirm(`Are you sure you want to mark all ${pendingList.length} backlog tasks as completed?`)) return;

    pendingList.forEach(item => {
      item.status = 'cleared';
      item.clearedAt = new Date().toISOString();
      if (item.subtopicId) {
        if (!state.syllabusProgress) state.syllabusProgress = {};
        state.syllabusProgress[item.subtopicId] = {
          completed: true,
          completedAt: new Date().toISOString()
        };
      }
    });

    Storage.updateState(state);

    if (window.confetti) {
      window.confetti({ particleCount: 60, spread: 70 });
    }

    if (window.App) {
      window.App.showToast(`All backlog tasks cleared! Backlog Debt: 0 mins.`, 'success');
    }
  }

  formatGroupDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  render() {
    const container = document.getElementById('backlog-view-container');
    if (!container) return;

    const state = Storage.getState();
    const backlog = state.backlog || [];
    const pendingItems = backlog.filter(b => b.status === 'pending');
    const clearedItems = backlog.filter(b => b.status === 'cleared');

    const totalBacklogMinutes = pendingItems.reduce((acc, i) => acc + (i.duration || 45), 0);
    const totalBacklogHours = (totalBacklogMinutes / 60).toFixed(1);

    // Group pending items by original date
    const groupedByDate = {};
    pendingItems.forEach(item => {
      const dateKey = item.originalDate || 'Earlier Sessions';
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(item);
    });

    // Sort date keys descending
    const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    let html = `
      <div class="backlog-header-card card">
        <div class="backlog-header-top">
          <div>
            <h2>Backlog Vault</h2>
            <p class="section-subtitle">Automated rollover captures missed study blocks from past dates so nothing falls through the cracks.</p>
          </div>
          ${pendingItems.length > 0 ? `
            <button class="btn-clear-all" onclick="Backlog.clearAllPending()">
              <i data-lucide="check-check"></i> Clear All (${pendingItems.length})
            </button>
          ` : ''}
        </div>

        <div class="backlog-metrics-row">
          <div class="metric-chip">
            <span class="metric-label">Unresolved Backlog</span>
            <span class="metric-value ${pendingItems.length > 0 ? 'text-amber' : 'text-emerald'}">
              <strong>${pendingItems.length}</strong> Tasks
            </span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Estimated Debt Time</span>
            <span class="metric-value"><strong>${totalBacklogHours}</strong> Hours</span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Resolved / Cleared</span>
            <span class="metric-value text-emerald"><strong>${clearedItems.length}</strong> Completed</span>
          </div>
        </div>
      </div>
    `;

    if (pendingItems.length === 0) {
      html += `
        <div class="backlog-empty-hero card">
          <div class="empty-icon-circle">
            <i data-lucide="shield-check"></i>
          </div>
          <h3>Backlog Vault is Empty!</h3>
          <p>You have zero outstanding study debt. All planned blocks are completed or up-to-date.</p>
          <button class="btn-primary-action" onclick="App.navigateToTab('planner')">
            <i data-lucide="calendar"></i> View Today's Planner
          </button>
        </div>
      `;
    } else {
      html += `<div class="backlog-groups-stack">`;

      sortedDateKeys.forEach(dateKey => {
        const items = groupedByDate[dateKey];
        const groupDateFormatted = this.formatGroupDate(dateKey);

        html += `
          <div class="backlog-date-group card">
            <div class="group-header">
              <div class="group-date-badge">
                <i data-lucide="calendar-x"></i> Missed from ${groupDateFormatted}
              </div>
              <span class="group-items-count">${items.length} Task${items.length > 1 ? 's' : ''}</span>
            </div>

            <div class="group-items-list">
        `;

        items.forEach(item => {
          html += `
            <div class="backlog-item-row">
              <div class="item-left-col">
                <div class="item-header-meta">
                  <span class="subject-tag ${item.subjectId || 'accountancy'}">${item.subject}</span>
                  <span class="item-duration-tag"><i data-lucide="clock"></i> ${item.duration || 45}m</span>
                  <span class="item-reason-tag">${item.reason || 'Midnight Rollover'}</span>
                </div>
                <h4 class="item-topic-name">${item.topic}</h4>
                ${item.unitTitle ? `<span class="item-unit-subtitle">${item.unitTitle}</span>` : ''}
              </div>

              <div class="item-actions-col">
                <button class="btn-bl-action btn-bl-done" onclick="Backlog.clearBacklogItem('${item.id}')" title="Mark as Cleared / Done">
                  <i data-lucide="check"></i> Done
                </button>
                <button class="btn-bl-action btn-bl-reschedule" onclick="Backlog.rescheduleToToday('${item.id}')" title="Move to Today's planner">
                  <i data-lucide="calendar-plus"></i> Study Today
                </button>
                <button class="btn-bl-action btn-bl-dismiss" onclick="Backlog.dismissBacklogItem('${item.id}')" title="Dismiss / Remove">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `</div>`; // Close backlog-groups-stack
    }

    container.innerHTML = html;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

window.Backlog = new BacklogController();
