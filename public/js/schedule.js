/**
 * Study Schedule Controller
 * Manages the dedicated "Schedule" tab as a free-form, day-by-day planner:
 * - Pick any date and build your own blocks (no weekday template, no fixed subjects)
 * - Every block holds: subject + duration + topic
 * - Optional "Pull next topic" hands a block the next uncompleted syllabus subtopic
 * - Full offline-first LocalStorage & Supabase Cloud Sync
 */
class ScheduleController {
  constructor() {
    this.currentDate = Storage.getTodayString();
    this.init();
  }

  init() {
    Storage.on('change', () => {
      if (window.App && window.App.activeTab === 'schedule') {
        this.render();
      }
    });

    Storage.on('syncStatus', () => {
      if (window.App && window.App.activeTab === 'schedule') {
        this.renderSyncBadge();
      }
    });
  }

  /* ----------------------------- date handling ----------------------------- */

  setDate(dateStr) {
    if (!dateStr) return;
    this.currentDate = dateStr;
    this.render();
  }

  shiftDate(dateStr, deltaDays) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  goToPreviousDay() {
    this.setDate(this.shiftDate(this.currentDate, -1));
  }

  goToNextDay() {
    this.setDate(this.shiftDate(this.currentDate, 1));
  }

  goToToday() {
    this.setDate(Storage.getTodayString());
  }

  formatDateLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return dateStr === Storage.getTodayString() ? `Today &bull; ${formatted}` : formatted;
  }

  formatTimeDisplay(timeStr) {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    if (Number.isNaN(h)) return timeStr;
    const m = parseInt(parts[1], 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  escapeHtml(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ------------------------------ block editing ---------------------------- */

  addBlock() {
    const subjectSelect = document.getElementById('new-block-subject');
    const topicInput = document.getElementById('new-block-topic');
    const durationInput = document.getElementById('new-block-duration');
    const startInput = document.getElementById('new-block-start');

    const duration = Math.max(15, Math.min(180, parseInt(durationInput?.value, 10) || 45));
    const startTime = startInput?.value || '';
    const endTime = startTime ? this.calcEndTime(startTime, duration) : '';

    Storage.addScheduleBlock(this.currentDate, {
      subjectId: subjectSelect?.value || Storage.getDefaultSubjectId(),
      topic: (topicInput?.value || '').trim(),
      duration: duration,
      startTime: startTime,
      endTime: endTime
    });

    if (window.App) {
      window.App.showToast(`Block added to ${this.currentDate}.`, 'success');
    }
    this.render();
  }

  updateBlockSubject(blockId, subjectId) {
    Storage.updateScheduleBlock(this.currentDate, blockId, { subjectId: subjectId });
    if (window.App) {
      window.App.showToast(`Block moved to ${Storage.getSubjectName(subjectId)}.`, 'success');
    }
  }

  updateBlockTopic(blockId, topic) {
    const value = (topic || '').trim();
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    // A hand-typed topic replaces whatever the bot had pulled in.
    const stillLinked = block && block.topic === value;
    Storage.updateScheduleBlock(this.currentDate, blockId, {
      topic: value,
      subtopicId: stillLinked ? block.subtopicId : null,
      autoAssigned: stillLinked ? block.autoAssigned : false
    });
  }

  updateBlockDuration(blockId, duration) {
    const mins = Math.max(15, Math.min(180, parseInt(duration, 10) || 45));
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    const updates = { duration: mins };
    if (block?.startTime) {
      updates.endTime = this.calcEndTime(block.startTime, mins);
    }
    Storage.updateScheduleBlock(this.currentDate, blockId, updates);
  }

  adjustBlockDuration(blockId, delta) {
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    this.updateBlockDuration(blockId, (parseInt(block?.duration, 10) || 45) + delta);
  }

  updateBlockStartTime(blockId, startTime) {
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    Storage.updateScheduleBlock(this.currentDate, blockId, {
      startTime: startTime,
      endTime: startTime ? this.calcEndTime(startTime, block?.duration || 45) : ''
    });
  }

  removeBlock(blockId) {
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    if (!block) return;
    if (!confirm(`Delete "${block.topic || 'this block'}"?`)) return;

    Storage.removeScheduleBlock(this.currentDate, blockId);
    if (window.App) {
      window.App.showToast('Block deleted.', 'info');
    }
  }

  pullNextTopic(blockId) {
    const block = Storage.getDaySchedule(this.currentDate).find(b => b.id === blockId);
    if (!block) return;

    const assignedIds = new Set();
    Storage.getDaySchedule(this.currentDate).forEach(b => {
      if (b.subtopicId && b.id !== blockId) assignedIds.add(b.subtopicId);
    });

    const topicObj = Storage.getNextUncompletedTopic(block.subjectId, assignedIds);
    if (!topicObj) {
      if (window.App) {
        window.App.showToast(`Could not find an uncompleted topic for ${Storage.getSubjectName(block.subjectId)}.`, 'info');
      }
      return;
    }

    Storage.updateScheduleBlock(this.currentDate, blockId, {
      topic: topicObj.title,
      unitTitle: topicObj.unitTitle,
      subtopicId: topicObj.id,
      autoAssigned: true
    });

    if (window.App) {
      window.App.showToast(`Pulled "${topicObj.title}" into this block.`, 'success');
    }
  }

  fillDayTopics() {
    const filled = Storage.fillDayTopics(this.currentDate, false);
    if (window.App) {
      window.App.showToast(
        filled > 0 ? `Filled ${filled} empty block${filled > 1 ? 's' : ''} with the next syllabus topics.` : 'Every block already has a topic.',
        filled > 0 ? 'success' : 'info'
      );
    }
  }

  clearDay() {
    const blocks = Storage.getDaySchedule(this.currentDate);
    if (blocks.length === 0) return;
    if (!confirm(`Remove all ${blocks.length} block(s) from ${this.currentDate}?`)) return;

    blocks.slice().forEach(block => Storage.removeScheduleBlock(this.currentDate, block.id));
    if (window.App) {
      window.App.showToast('Day cleared.', 'info');
    }
  }

  calcEndTime(startTimeStr, durationMinutes) {
    const parts = String(startTimeStr || '07:00').split(':');
    const totalM = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0) + (parseInt(durationMinutes, 10) || 0);
    const endH = Math.floor(totalM / 60) % 24;
    const endM = totalM % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  /* -------------------------------- rendering ------------------------------ */

  render() {
    const container = document.getElementById('schedule-view-container');
    if (!container) return;

    const blocks = Storage.getDaySchedule(this.currentDate);
    const totalMinutes = blocks.reduce((sum, b) => sum + (parseInt(b.duration, 10) || 0), 0);
    const doneCount = blocks.filter(b => b.status === 'done').length;
    const isToday = this.currentDate === Storage.getTodayString();
    const routine = Storage.getRoutineSettings();
    const subjectsList = Storage.getSubjects();
    const defaultSubjectId = Storage.getDefaultSubjectId();

    const notify = Storage.getNotificationSettings();
    const notifyPerm = window.Notifier ? window.Notifier.getPermissionState() : 'unsupported';
    const notifyHint = notify.enabled === false
      ? 'System alerts are currently turned off. In-app alerts still work.'
      : (notifyPerm === 'granted' || notifyPerm === 'native')
        ? 'Permission granted — alerts will reach this device.'
        : notifyPerm === 'denied'
          ? 'Blocked in device settings. Re-allow notifications to receive alerts.'
          : 'Use "Send Test Alert" to allow notifications on this device.';

    let html = `
      <!-- 1. Hero Header -->
      <div class="schedule-hero-card card">
        <div class="schedule-hero-top">
          <div class="schedule-hero-title-group">
            <div class="schedule-icon-badge">
              <i data-lucide="calendar-range"></i>
            </div>
            <div>
              <div class="schedule-headline-row">
                <h2>Study Schedule</h2>
                <span class="badge-rotational-rhythm"><i data-lucide="sparkles"></i> Free-Form Blocks</span>
              </div>
              <p class="schedule-hero-subtitle">
                Build your own day: pick a date and add as many blocks as you like, each with its own subject, duration and topic.
                Nothing is fixed — mix subjects freely and let "Pull next topic" bring in the next uncompleted subtopic.
              </p>
            </div>
          </div>
          <div class="schedule-hero-actions">
            <button class="btn-schedule-action btn-apply-today" onclick="Schedule.fillDayTopics()" title="Give every empty block the next uncompleted topic from its subject">
              <i data-lucide="sparkles"></i> <span>Auto-Fill Topics</span>
            </button>
            <button class="btn-schedule-action btn-save-routine" onclick="Schedule.saveSchedule()" title="Back up to Supabase Cloud">
              <i data-lucide="save"></i> <span>Sync Now</span>
            </button>
            <button class="btn-schedule-action btn-reset-defaults" onclick="Schedule.clearDay()" title="Remove every block from this day">
              <i data-lucide="eraser"></i> <span>Clear Day</span>
            </button>
          </div>
        </div>

        <div class="schedule-stats-grid">
          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-emerald">
              <i data-lucide="layers"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${blocks.length} <span class="stat-unit">block${blocks.length === 1 ? '' : 's'}</span></span>
              <span class="stat-lbl">Planned for this day</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-blue">
              <i data-lucide="hourglass"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${(totalMinutes / 60).toFixed(1)}h <span class="stat-unit">(${totalMinutes}m)</span></span>
              <span class="stat-lbl">Study time planned</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-amber">
              <i data-lucide="check-circle-2"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${doneCount} / ${blocks.length}</span>
              <span class="stat-lbl">Blocks completed</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div id="schedule-cloud-indicator" class="stat-icon-wrap bg-cloud">
              <i data-lucide="cloud"></i>
            </div>
            <div class="stat-meta">
              <span id="schedule-cloud-text" class="stat-num" style="font-size: 13px;">${Storage.syncMessage || 'Auto-Sync Active'}</span>
              <span class="stat-lbl">Supabase Cloud Sync</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Date Navigation -->
      <div class="weekly-selector-card card">
        <div class="planner-date-nav">
          <button class="nav-arrow-btn" onclick="Schedule.goToPreviousDay()" title="Previous Day" aria-label="Previous Day">
            <i data-lucide="chevron-left"></i>
          </button>
          <div class="date-display-wrapper">
            <h2 class="current-date-title">${this.formatDateLabel(this.currentDate)}</h2>
            <div class="date-controls">
              <input type="date" class="date-picker-inline" value="${this.currentDate}" onchange="Schedule.setDate(this.value)" />
              ${!isToday ? `<button class="btn-today-pill" onclick="Schedule.goToToday()">Jump to Today</button>` : `<span class="badge-live">Today</span>`}
            </div>
          </div>
          <button class="nav-arrow-btn" onclick="Schedule.goToNextDay()" title="Next Day" aria-label="Next Day">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- 3. Add a Block -->
      <div class="schedule-block-card card">
        <div class="schedule-block-card-header">
          <div class="block-header-left">
            <span class="block-type-badge">
              <i data-lucide="plus-circle"></i> New Block
            </span>
          </div>
          <span class="block-header-purpose-tag">Subject &bull; Duration &bull; Topic</span>
        </div>

        <div class="schedule-block-card-body">
          <div class="form-row-2">
            <div class="form-group">
              <label for="new-block-subject"><i data-lucide="book"></i> Subject</label>
              <select id="new-block-subject" class="form-control">
                ${subjectsList.map(sub => `
                  <option value="${sub.id}" ${defaultSubjectId === sub.id ? 'selected' : ''}>${sub.name} (${sub.code})</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="new-block-duration"><i data-lucide="timer"></i> Duration (Minutes)</label>
              <input type="number" id="new-block-duration" class="form-control" value="45" min="15" max="180" step="5">
            </div>
          </div>

          <div class="form-group">
            <label for="new-block-topic"><i data-lucide="align-left"></i> Topic (optional — you can pull one later)</label>
            <input type="text" id="new-block-topic" class="form-control" placeholder="e.g. Admission of a Partner — sacrifice ratio">
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="new-block-start"><i data-lucide="clock"></i> Start Time (optional)</label>
              <input type="time" id="new-block-start" class="form-control">
            </div>
            <div class="form-group form-group-action">
              <label>&nbsp;</label>
              <button class="btn-primary" onclick="Schedule.addBlock()">
                <i data-lucide="plus"></i> Add Block
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Blocks for the selected day -->
      <div class="section-title-wrap">
        <div class="title-with-icon">
          <i data-lucide="layout-list" class="text-primary"></i>
          <h3>${blocks.length} Block${blocks.length === 1 ? '' : 's'} on ${this.currentDate}</h3>
        </div>
        <p class="section-subtitle">
          Edit any block inline — change its subject, topic or duration, or pull the next uncompleted topic straight from the syllabus.
        </p>
      </div>
    `;

    if (blocks.length === 0) {
      html += `
        <div class="empty-block-card card">
          <p>No blocks on this day yet. Add your first block above.</p>
        </div>
      `;
    } else {
      html += `<div class="schedule-blocks-grid">`;
      blocks.forEach(block => {
        html += this.renderBlockCard(block, subjectsList);
      });
      html += `</div>`;
    }

    html += `
      <!-- 5. Study Pacing Settings -->
      <div class="routine-settings-card card">
        <div class="card-section-header">
          <div class="title-with-icon">
            <i data-lucide="settings" class="text-primary"></i>
            <h3>Routine & Study Pacing Settings</h3>
          </div>
          <span class="card-subtitle-tag">Daily Habit Configuration</span>
        </div>

        <div class="routine-controls-grid">
          <div class="form-group">
            <label for="setting-wake-time"><i data-lucide="sunrise"></i> Wake-Up Target Time</label>
            <input type="time" id="setting-wake-time" class="form-control" value="${routine.wakeUpTime || '06:30'}" onchange="Schedule.updateRoutineSetting('wakeUpTime', this.value)">
          </div>

          <div class="form-group">
            <label for="setting-study-start"><i data-lucide="play-circle"></i> Study Session Start</label>
            <input type="time" id="setting-study-start" class="form-control" value="${routine.studyStartTime || '07:00'}" onchange="Schedule.updateRoutineSetting('studyStartTime', this.value)">
          </div>

          <div class="form-group">
            <label for="setting-break-mins"><i data-lucide="coffee"></i> Inter-Block Buffer Break</label>
            <select id="setting-break-mins" class="form-control" onchange="Schedule.updateRoutineSetting('breakBetweenBlocksMinutes', parseInt(this.value, 10))">
              <option value="10" ${routine.breakBetweenBlocksMinutes === 10 ? 'selected' : ''}>10 Minutes Short Reset</option>
              <option value="15" ${routine.breakBetweenBlocksMinutes === 15 ? 'selected' : ''}>15 Minutes Recommended</option>
              <option value="20" ${routine.breakBetweenBlocksMinutes === 20 ? 'selected' : ''}>20 Minutes Deep Break</option>
              <option value="30" ${routine.breakBetweenBlocksMinutes === 30 ? 'selected' : ''}>30 Minutes Full Meal/Walk</option>
            </select>
          </div>
        </div>

        <div class="routine-toggle-list">
          <label class="routine-toggle-item">
            <div class="toggle-meta">
              <strong>Auto Midnight Rollover Engine</strong>
              <span>Automatically sweeps unfinished daily blocks into the Backlog Vault at 23:59 without breaking streak.</span>
            </div>
            <input type="checkbox" class="routine-checkbox" ${routine.autoMidnightRollover !== false ? 'checked' : ''} onchange="Schedule.updateRoutineSetting('autoMidnightRollover', this.checked)">
          </label>

          <label class="routine-toggle-item">
            <div class="toggle-meta">
              <strong>Study Timer Bell & Chime</strong>
              <span>Play soft audio chime alert when a focus block timer countdown completes.</span>
            </div>
            <input type="checkbox" class="routine-checkbox" ${routine.reminderAlerts !== false ? 'checked' : ''} onchange="Schedule.updateRoutineSetting('reminderAlerts', this.checked)">
          </label>
        </div>

        <!-- Today Alerts & Notifications -->
        <div class="notify-settings-block">
          <div class="notify-settings-header">
            <div class="title-with-icon">
              <i data-lucide="bell-ring" class="text-primary"></i>
              <h4>Today Alerts &amp; Notifications</h4>
            </div>
            <span class="card-subtitle-tag">${window.Notifier ? window.Notifier.getPlatformLabel() : 'In-app alerts only'}</span>
          </div>

          <div class="routine-controls-grid">
            <div class="form-group">
              <label for="setting-digest-time"><i data-lucide="sunrise"></i> Daily Plan Alert Time</label>
              <input type="time" id="setting-digest-time" class="form-control" value="${notify.digestTime || '07:00'}" onchange="Schedule.updateNotificationSetting('digestTime', this.value)">
            </div>
          </div>

          <div class="routine-toggle-list">
            <label class="routine-toggle-item">
              <div class="toggle-meta">
                <strong>Today's Plan Briefing</strong>
                <span>One alert at the time above listing exactly what to study today.</span>
              </div>
              <input type="checkbox" class="routine-checkbox" ${notify.dailyDigest !== false ? 'checked' : ''} onchange="Schedule.updateNotificationSetting('dailyDigest', this.checked)">
            </label>

            <label class="routine-toggle-item">
              <div class="toggle-meta">
                <strong>Per-Block Reminders</strong>
                <span>Nudges you when a block with a start time is about to begin.</span>
              </div>
              <input type="checkbox" class="routine-checkbox" ${notify.blockReminders !== false ? 'checked' : ''} onchange="Schedule.updateNotificationSetting('blockReminders', this.checked)">
            </label>

            <label class="routine-toggle-item">
              <div class="toggle-meta">
                <strong>Enable System Alerts</strong>
                <span>Turn device notifications on or off. In-app alerts stay available either way.</span>
              </div>
              <input type="checkbox" class="routine-checkbox" ${notify.enabled !== false ? 'checked' : ''} onchange="Schedule.toggleNotifications(this.checked)">
            </label>
          </div>

          <div class="notify-action-row">
            <button class="btn-secondary" onclick="Schedule.testNotifications()">
              <i data-lucide="send"></i> Send Test Alert
            </button>
            <span class="notify-permission-hint">${notifyHint}</span>
          </div>
        </div>
      </div>

      <!-- 6. Bottom Cloud Sync Bar -->
      <div class="schedule-cloud-bar card">
        <div class="cloud-bar-left">
          <i data-lucide="shield-check" class="text-emerald"></i>
          <div>
            <strong>Your schedule is stored locally and backed up to Supabase Cloud</strong>
            <p>Every block you add or edit is saved on this device instantly and synced in the background.</p>
          </div>
        </div>
        <div class="cloud-bar-right">
          <button class="btn-primary" onclick="Schedule.saveSchedule()">
            <i data-lucide="refresh-cw"></i> Sync Now
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderBlockCard(block, subjectsList) {
    const duration = parseInt(block.duration, 10) || 45;
    const subjectMeta = Storage.getSubject(block.subjectId);
    const presets = [30, 45, 60, 75, 90];
    const statusBadge = block.status === 'done'
      ? `<span class="task-status-badge done"><i data-lucide="check-circle-2"></i> Completed</span>`
      : (block.autoAssigned ? `<span class="task-status-badge"><i data-lucide="sparkles"></i> Pulled from syllabus</span>` : '');

    return `
      <div class="schedule-block-card card">
        <div class="schedule-block-card-header">
          <div class="block-header-left">
            <span class="block-type-badge">
              <i data-lucide="${subjectMeta?.icon || 'book'}"></i> ${Storage.getSubjectName(block.subjectId) || 'Subject'}
            </span>
            <span class="block-duration-pill">${duration} mins</span>
            ${block.startTime ? `<span class="block-duration-pill">${this.formatTimeDisplay(block.startTime)}${block.endTime ? ` – ${this.formatTimeDisplay(block.endTime)}` : ''}</span>` : ''}
            ${statusBadge}
          </div>
          <button class="btn-block-delete" onclick="Schedule.removeBlock('${block.id}')" title="Delete block">
            <i data-lucide="trash-2"></i>
          </button>
        </div>

        <div class="schedule-block-card-body">
          <div class="form-group">
            <label for="blk-sub-${block.id}"><i data-lucide="book"></i> Subject</label>
            <select id="blk-sub-${block.id}" class="form-control" onchange="Schedule.updateBlockSubject('${block.id}', this.value)">
              ${subjectsList.map(sub => `
                <option value="${sub.id}" ${block.subjectId === sub.id ? 'selected' : ''}>${sub.name} (${sub.code})</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="blk-topic-${block.id}"><i data-lucide="align-left"></i> Topic</label>
            <div class="end-time-wrapper">
              <input
                type="text"
                id="blk-topic-${block.id}"
                class="form-control"
                value="${this.escapeHtml(block.topic)}"
                placeholder="What will you study in this block?"
                onchange="Schedule.updateBlockTopic('${block.id}', this.value)"
              >
              <button type="button" class="btn-auto-calc" onclick="Schedule.pullNextTopic('${block.id}')" title="Pull the next uncompleted topic from this subject's syllabus">
                <i data-lucide="sparkles"></i>
              </button>
            </div>
            ${block.unitTitle ? `<p class="parser-summary">${this.escapeHtml(block.unitTitle)}</p>` : ''}
          </div>

          <div class="form-group duration-form-group">
            <label><i data-lucide="timer"></i> Duration (Minutes)</label>
            <div class="duration-controls-row">
              <div class="duration-stepper">
                <button type="button" class="btn-stepper" onclick="Schedule.adjustBlockDuration('${block.id}', -5)" title="Decrease 5 minutes">
                  <i data-lucide="minus"></i>
                </button>
                <input
                  type="number"
                  id="blk-dur-${block.id}"
                  class="form-control stepper-input"
                  value="${duration}"
                  min="15"
                  max="180"
                  step="5"
                  onchange="Schedule.updateBlockDuration('${block.id}', this.value)"
                >
                <button type="button" class="btn-stepper" onclick="Schedule.adjustBlockDuration('${block.id}', 5)" title="Increase 5 minutes">
                  <i data-lucide="plus"></i>
                </button>
              </div>

              <div class="duration-presets-group">
                ${presets.map(mins => `
                  <button
                    type="button"
                    class="btn-preset ${duration === mins ? 'active' : ''}"
                    onclick="Schedule.updateBlockDuration('${block.id}', ${mins})"
                  >
                    ${mins}m
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="blk-start-${block.id}"><i data-lucide="clock"></i> Start Time</label>
            <input
              type="time"
              id="blk-start-${block.id}"
              class="form-control"
              value="${block.startTime || ''}"
              onchange="Schedule.updateBlockStartTime('${block.id}', this.value)"
            >
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------- settings -------------------------------- */

  updateRoutineSetting(key, value) {
    Storage.updateRoutineSettings({ [key]: value });
    if (window.App) {
      window.App.showToast('Routine setting updated', 'info');
    }
  }

  updateNotificationSetting(key, value) {
    Storage.updateNotificationSettings({ [key]: value });
    if (window.App) {
      window.App.showToast('Alert setting updated', 'info');
    }
    this.render();
  }

  async toggleNotifications(enable) {
    if (!window.Notifier) return;

    if (enable) {
      const result = await window.Notifier.enable();
      if (window.App) {
        const messages = {
          granted: ['System alerts are on.', 'success'],
          unsupported: ['No system notifications on this device. In-app alerts still work.', 'info'],
          denied: ['Notifications were blocked. Allow them in your device settings.', 'info']
        };
        const [message, type] = messages[result] || ['System alerts are on.', 'success'];
        window.App.showToast(message, type);
      }
    } else {
      await window.Notifier.disable();
      if (window.App) {
        window.App.showToast('System alerts turned off.', 'info');
      }
    }
    this.render();
  }

  async testNotifications() {
    if (!window.Notifier) return;
    const result = await window.Notifier.sendTest();
    if (window.App) {
      const messages = {
        sent: ['Test alert sent!', 'success'],
        scheduled: ['Test alert scheduled — it arrives in a few seconds.', 'success'],
        denied: ['Notifications are blocked for this app.', 'error'],
        unsupported: ['System notifications are not available here.', 'info'],
        error: ['Could not send the test alert.', 'error']
      };
      const [message, type] = messages[result] || ['Could not send the test alert.', 'error'];
      window.App.showToast(message, type);
    }
    this.render();
  }

  saveSchedule() {
    Storage.pushToCloud();
    if (window.App) {
      window.App.showToast('Schedule saved & synced with cloud!', 'success');
    }
  }

  renderSyncBadge() {
    const el = document.getElementById('schedule-cloud-text');
    if (el) {
      el.textContent = Storage.syncMessage || 'Auto-Sync Active';
    }
  }
}

// Global instance
window.Schedule = new ScheduleController();
