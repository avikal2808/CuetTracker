/**
 * "Today" Daily Planner View
 * Fixed time blocks: Primary (60m), Secondary (45m), Revision (30m)
 * [Done] and [Reschedule] buttons, historical date-stamping, and timer integration.
 */
class PlannerController {
  constructor() {
    this.currentDate = Storage.getTodayString();
    this.timer = {
      interval: null,
      secondsRemaining: 0,
      totalSeconds: 0,
      activeTaskId: null,
      isRunning: false
    };

    this.init();
  }

  init() {
    Storage.on('change', () => this.render());
  }

  setCurrentDate(dateStr) {
    this.currentDate = dateStr;
    const state = Storage.getState();
    if (!Array.isArray(state.planner[dateStr])) {
      state.planner[dateStr] = Storage.ensureDaySchedule(dateStr);
      Storage.saveLocally(state);
    }
    this.render();
  }

  goToPreviousDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 1);
    this.setCurrentDate(d.toISOString().split('T')[0]);
  }

  goToNextDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    this.setCurrentDate(d.toISOString().split('T')[0]);
  }

  goToToday() {
    this.setCurrentDate(Storage.getTodayString());
  }

  formatDateLabel(dateStr) {
    const today = Storage.getTodayString();
    const d = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const formatted = d.toLocaleDateString('en-US', options);

    if (dateStr === today) {
      return `Today, ${formatted}`;
    }
    
    // Check yesterday
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().split('T')[0];
    if (dateStr === yesterday) {
      return `Yesterday, ${formatted}`;
    }

    return formatted;
  }

  markTaskDone(taskId) {
    const state = Storage.getState();
    const tasks = state.planner[this.currentDate] || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'done';
    task.completedAt = new Date().toISOString();

    // Also mark subtopic as completed in syllabus progress
    if (task.subtopicId) {
      if (!state.syllabusProgress) state.syllabusProgress = {};
      state.syllabusProgress[task.subtopicId] = {
        completed: true,
        completedAt: new Date().toISOString(),
        preMarked: false
      };
    }

    Storage.updateState(state);

    // Trigger visual confetti celebration if available
    if (window.confetti) {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#4F8A68', '#4F9D69', '#DCEBDD', '#35634A']
      });
    }

    if (window.App) {
      window.App.showToast(`Completed "${task.topic}"! Great progress!`, 'success');
    }
  }

  rescheduleTask(taskId) {
    const state = Storage.getState();
    const tasks = state.planner[this.currentDate] || [];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];

    // Calculate tomorrow's date
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    const tomorrowStr = d.toISOString().split('T')[0];

    // Ensure tomorrow exists
    if (!Array.isArray(state.planner[tomorrowStr])) {
      state.planner[tomorrowStr] = Storage.ensureDaySchedule(tomorrowStr);
    }

    // Append or replace next day
    const rescheduledTask = {
      ...task,
      id: `task_resched_${Date.now()}`,
      status: 'pending',
      scheduledDate: tomorrowStr,
      notes: `Rescheduled from ${this.currentDate}`
    };

    state.planner[tomorrowStr].push(rescheduledTask);

    // Mark current day task as rescheduled
    task.status = 'rescheduled';
    task.rescheduledTo = tomorrowStr;

    Storage.updateState(state);

    if (window.App) {
      window.App.showToast(`Rescheduled to tomorrow (${tomorrowStr})`, 'info');
    }
  }

  startFocusTimer(taskId, durationMinutes, title) {
    if (this.timer.isRunning && this.timer.activeTaskId === taskId) {
      this.pauseTimer();
      return;
    }

    if (this.timer.interval) {
      clearInterval(this.timer.interval);
    }

    if (this.timer.activeTaskId !== taskId || this.timer.secondsRemaining <= 0) {
      this.timer.totalSeconds = durationMinutes * 60;
      this.timer.secondsRemaining = this.timer.totalSeconds;
      this.timer.activeTaskId = taskId;
    }

    this.timer.isRunning = true;
    this.timer.activeTitle = title;

    this.timer.interval = setInterval(() => {
      this.timer.secondsRemaining--;
      if (this.timer.secondsRemaining <= 0) {
        clearInterval(this.timer.interval);
        this.timer.isRunning = false;
        this.timer.secondsRemaining = 0;
        this.playChime();
        this.markTaskDone(taskId);
        if (window.App) {
          window.App.showToast(`Time's up! ${title} completed!`, 'success');
        }
      }
      this.updateTimerUI();
    }, 1000);

    this.render();
  }

  pauseTimer() {
    if (this.timer.interval) {
      clearInterval(this.timer.interval);
    }
    this.timer.isRunning = false;
    this.render();
  }

  resetTimer() {
    if (this.timer.interval) {
      clearInterval(this.timer.interval);
    }
    this.timer.isRunning = false;
    this.timer.secondsRemaining = this.timer.totalSeconds;
    this.render();
  }

  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.warn('Audio chime not allowed:', e);
    }
  }

  updateTimerUI() {
    const displayEl = document.getElementById('timer-countdown-display');
    const barEl = document.getElementById('timer-progress-fill');
    if (displayEl && this.timer.secondsRemaining >= 0) {
      const mins = Math.floor(this.timer.secondsRemaining / 60);
      const secs = this.timer.secondsRemaining % 60;
      displayEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (barEl && this.timer.totalSeconds > 0) {
      const pct = ((this.timer.totalSeconds - this.timer.secondsRemaining) / this.timer.totalSeconds) * 100;
      barEl.style.width = `${pct}%`;
    }
  }

  openChangeTopicModal(taskId) {
    if (window.App) {
      window.App.openEditPlannerTaskModal(taskId, this.currentDate);
    }
  }

  render() {
    const container = document.getElementById('planner-view-container');
    if (!container) return;

    const state = Storage.getState();
    const tasks = state.planner[this.currentDate] || [];
    const isToday = this.currentDate === Storage.getTodayString();

    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalMinutesPlanned = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const completedMinutes = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.duration || 0), 0);
    const progressPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    // Rollover notice check
    const backlogCount = (state.backlog || []).filter(b => b.status === 'pending').length;

    const daySubjectIds = [...new Set(tasks.map(t => t.subjectId).filter(Boolean))];

    let html = `
      <div class="planner-header-card card">
        <div class="planner-date-nav">
          <button class="nav-arrow-btn" onclick="Planner.goToPreviousDay()" title="Previous Day" aria-label="Previous Day">
            <i data-lucide="chevron-left"></i>
          </button>
          <div class="date-display-wrapper">
            <h2 class="current-date-title">${this.formatDateLabel(this.currentDate)}</h2>
            <div class="date-controls">
              <input type="date" class="date-picker-inline" value="${this.currentDate}" onchange="Planner.setCurrentDate(this.value)" />
              ${!isToday ? `<button class="btn-today-pill" onclick="Planner.goToToday()">Jump to Today</button>` : `<span class="badge-live">Live Schedule</span>`}
            </div>
          </div>
          <button class="nav-arrow-btn" onclick="Planner.goToNextDay()" title="Next Day" aria-label="Next Day">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>

        <!-- Day Blocks Quick Bar -->
        <div class="planner-routine-bar">
          <div class="routine-bar-meta">
            <span class="routine-meta-badge"><i data-lucide="layout-list"></i> ${tasks.length} block${tasks.length === 1 ? '' : 's'} &bull; ${totalMinutesPlanned}m</span>
            <span class="routine-meta-subs">
              ${daySubjectIds.length > 0
                ? daySubjectIds.map(id => `<span class="subj-tag-mini sub-${id}">${Storage.getSubject(id)?.code || Storage.getSubjectName(id)}</span>`).join('')
                : `<span class="routine-meta-hint">No blocks planned yet</span>`}
            </span>
          </div>
          <div class="routine-bar-actions">
            <button class="btn-auto-assign-today" onclick="Planner.fillDayTopics()" title="Give every empty block the next uncompleted topic from its subject">
              <i data-lucide="sparkles"></i> <span>Auto-Fill Topics</span>
            </button>
            <button class="btn-add-topic" onclick="Planner.openChangeTopicModal('new_block')">
              <i data-lucide="plus"></i> Add Block
            </button>
          </div>
        </div>

        <div class="planner-metrics-bar">
          <div class="metric-chip">
            <span class="metric-label">Completed</span>
            <span class="metric-value"><strong>${completedTasks}</strong> / ${tasks.length} blocks</span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Focused Time</span>
            <span class="metric-value"><strong>${completedMinutes}m</strong> / ${totalMinutesPlanned}m</span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Pace Status</span>
            <span class="metric-value text-emerald"><strong>${progressPct}%</strong></span>
          </div>
        </div>

        <div class="planner-progress-track">
          <div class="planner-progress-fill" style="width: ${progressPct}%;"></div>
        </div>
      </div>
    `;

    // Today's Alerts briefing — the "what to do today" summary
    if (isToday && window.Notifier) {
      const briefing = window.Notifier.getBriefing(this.currentDate);
      const nSettings = Storage.getNotificationSettings();
      const perm = window.Notifier.getPermissionState();
      const alertsOn = nSettings.enabled !== false && (perm === 'granted' || perm === 'native');
      const nextBlock = briefing.next;
      const nextSubject = nextBlock ? Storage.getSubject(nextBlock.subjectId) : null;

      html += `
        <div class="today-alerts-card card">
          <div class="alerts-header">
            <div class="title-with-icon">
              <i data-lucide="bell-ring" class="text-primary"></i>
              <h3>Alerts for Today</h3>
            </div>
            <span class="alerts-status-pill ${alertsOn ? 'on' : 'off'}">
              <i data-lucide="${alertsOn ? 'bell' : 'bell-off'}"></i> ${alertsOn ? 'On' : 'Off'}
            </span>
          </div>

          ${briefing.blocks.length === 0 ? `
            <p class="alerts-empty">No blocks planned for today yet. Add a block below to start your alerts.</p>
          ` : `
            ${nextBlock ? `
              <div class="alert-next-row">
                <span class="alert-next-label">${nextBlock.startTime ? `Next at ${this.formatClock(nextBlock.startTime)}` : 'Next up'}</span>
                <span class="alert-next-title">
                  <span class="subj-tag-mini sub-${nextBlock.subjectId}">${nextSubject?.code || Storage.getSubjectName(nextBlock.subjectId)}</span>
                  ${this.escapeHtml(nextBlock.topic || 'Untitled block')}
                </span>
              </div>
            ` : `
              <div class="alert-next-row alert-all-done">
                <i data-lucide="check-circle-2"></i> All ${briefing.blocks.length} block${briefing.blocks.length > 1 ? 's' : ''} done today. Great work!
              </div>
            `}
            <div class="alert-chips-row">
              <span class="alert-chip"><i data-lucide="list-checks"></i> ${briefing.pending.length} pending</span>
              <span class="alert-chip"><i data-lucide="hourglass"></i> ${briefing.pendingMinutes}m left</span>
              ${briefing.overdue.length > 0 ? `<span class="alert-chip chip-overdue"><i data-lucide="alarm-clock"></i> ${briefing.overdue.length} past start time</span>` : ''}
            </div>
          `}

          <div class="alerts-actions">
            ${alertsOn ? `
              <button class="btn-secondary" onclick="Planner.testAlerts()"><i data-lucide="send"></i> Send Test Alert</button>
              <button class="btn-alert-off" onclick="Planner.disableAlerts()"><i data-lucide="bell-off"></i> Turn Off</button>
            ` : `
              <button class="btn-primary" onclick="Planner.enableAlerts()"><i data-lucide="bell"></i> Turn On Alerts</button>
            `}
          </div>
        </div>
      `;
    }

    // Rollover Banner if pending items exist
    if (backlogCount > 0 && isToday) {
      html += `
        <div class="rollover-alert-banner">
          <div class="banner-icon-col">
            <i data-lucide="alert-triangle"></i>
          </div>
          <div class="banner-text-col">
            <h4>Backlog Vault Alert</h4>
            <p><strong>${backlogCount} missed session${backlogCount > 1 ? 's' : ''}</strong> rolled over from past dates. Clear or reschedule them anytime.</p>
          </div>
          <button class="btn-vault-link" onclick="App.navigateToTab('backlog')">
            Open Vault <i data-lucide="arrow-right"></i>
          </button>
        </div>
      `;
    }

    // Active Focus Timer Widget if a task timer is selected or running
    if (this.timer.activeTaskId) {
      const activeTask = tasks.find(t => t.id === this.timer.activeTaskId);
      const mins = Math.floor(this.timer.secondsRemaining / 60);
      const secs = this.timer.secondsRemaining % 60;
      const pct = this.timer.totalSeconds > 0 ? ((this.timer.totalSeconds - this.timer.secondsRemaining) / this.timer.totalSeconds) * 100 : 0;

      html += `
        <div class="focus-timer-card card">
          <div class="timer-top-row">
            <span class="timer-badge">
              <i data-lucide="clock"></i> Active Focus Session
            </span>
            <span class="timer-task-title">${this.timer.activeTitle || (activeTask ? activeTask.topic : 'Focus')}</span>
          </div>
          <div class="timer-display-row">
            <div id="timer-countdown-display" class="timer-digits">${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</div>
            <div class="timer-controls">
              <button class="btn-timer-action ${this.timer.isRunning ? 'btn-pause' : 'btn-play'}" onclick="Planner.startFocusTimer('${this.timer.activeTaskId}', ${this.timer.totalSeconds / 60}, '${this.timer.activeTitle || ''}')">
                <i data-lucide="${this.timer.isRunning ? 'pause' : 'play'}"></i> ${this.timer.isRunning ? 'Pause' : 'Resume'}
              </button>
              <button class="btn-timer-reset" onclick="Planner.resetTimer()" title="Reset">
                <i data-lucide="rotate-ccw"></i>
              </button>
            </div>
          </div>
          <div class="timer-progress-track">
            <div id="timer-progress-fill" class="timer-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }

    // Free-form blocks for the selected date
    html += `<div class="blocks-stack">`;

    if (tasks.length === 0) {
      html += `
        <div class="empty-block-card card">
          <p>No study blocks planned for this day yet.</p>
          <button class="btn-add-topic" onclick="Planner.openChangeTopicModal('new_block')">
            <i data-lucide="plus"></i> Add Your First Block
          </button>
        </div>
      `;
    }

    tasks.forEach(task => {
      const isDone = task.status === 'done';
      const isRescheduled = task.status === 'rescheduled';
      const isRolledOver = task.status === 'rolled_over';
      const isTimerActiveForThis = this.timer.activeTaskId === task.id;
      const duration = task.duration || 45;
      const subjectMeta = Storage.getSubject(task.subjectId);
      const timeLabel = task.startTime
        ? `${this.formatClock(task.startTime)}${task.endTime ? ` – ${this.formatClock(task.endTime)}` : ''}`
        : 'Unscheduled';

      let statusTag = '';
      if (isDone) {
        statusTag = `<span class="task-status-badge done"><i data-lucide="check-circle-2"></i> Completed</span>`;
      } else if (isRescheduled) {
        statusTag = `<span class="task-status-badge rescheduled"><i data-lucide="calendar"></i> Rescheduled</span>`;
      } else if (isRolledOver) {
        statusTag = `<span class="task-status-badge rollover"><i data-lucide="archive"></i> In Backlog</span>`;
      }

      html += `
        <div class="block-section">
          <div class="block-section-header">
            <div class="block-title-group">
              <span class="block-type-badge">
                <i data-lucide="${subjectMeta?.icon || 'book'}"></i> ${task.subject || 'Subject'} &bull; ${duration}m
              </span>
              <span class="block-type-desc">${timeLabel}</span>
            </div>
            <button class="btn-task-icon-opt" onclick="Planner.deleteTask('${task.id}')" title="Remove block">
              <i data-lucide="trash-2"></i>
            </button>
          </div>

          <div class="task-block-card card ${isDone ? 'is-done' : ''} ${isTimerActiveForThis ? 'timer-active-card' : ''}">
            <div class="task-card-main">
              <div class="task-card-header">
                <span class="subject-tag ${task.subjectId}">
                  ${task.subject}
                </span>
                ${task.unitTitle ? `<span class="unit-subtitle">${task.unitTitle}</span>` : ''}
                ${task.autoAssigned ? `<span class="badge-auto-assigned"><i data-lucide="sparkles"></i> Auto-Assigned</span>` : ''}
                ${statusTag}
              </div>

              <h3 class="task-topic-title">${task.topic || 'No topic set yet'}</h3>

              ${task.notes ? `<p class="task-note-text"><i data-lucide="info"></i> ${task.notes}</p>` : ''}

              <div class="task-card-actions">
                ${!isDone && !isRescheduled && !isRolledOver ? `
                  <button class="btn-task-action btn-done" onclick="Planner.markTaskDone('${task.id}')">
                    <i data-lucide="check"></i> Done
                  </button>
                  <button class="btn-task-action btn-reschedule" onclick="Planner.rescheduleTask('${task.id}')">
                    <i data-lucide="clock"></i> Reschedule
                  </button>
                  ${!task.subtopicId ? `
                    <button class="btn-task-action btn-auto-pull" onclick="Planner.autoAssignSlot('${task.id}', '${task.subjectId}')" title="Pull the next uncompleted topic from ${task.subject}'s syllabus">
                      <i data-lucide="sparkles"></i> Pull Topic
                    </button>
                  ` : ''}
                  <button class="btn-task-action btn-timer-start" onclick="Planner.startFocusTimer('${task.id}', ${duration}, '${(task.topic || '').replace(/'/g, "\\'")}')">
                    <i data-lucide="play"></i> Focus (${duration}m)
                  </button>
                  <button class="btn-task-icon-opt" onclick="Planner.openChangeTopicModal('${task.id}')" title="Change topic">
                    <i data-lucide="edit-3"></i>
                  </button>
                ` : ''}

                ${isDone ? `
                  <div class="task-completed-info">
                    <i data-lucide="check-check"></i> Finished at ${new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ` : ''}

                ${isRescheduled ? `
                  <div class="task-rescheduled-info">
                    Moved to tomorrow's queue
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`; // Close blocks-stack

    container.innerHTML = html;

    // Refresh icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  fillDayTopics() {
    const filled = Storage.fillDayTopics(this.currentDate, false);
    if (filled > 0 && window.confetti) {
      window.confetti({ particleCount: 40, spread: 55, colors: ['#4F8A68', '#4F9D69', '#35634A'] });
    }
    if (window.App) {
      window.App.showToast(
        filled > 0 ? `Pulled ${filled} topic${filled > 1 ? 's' : ''} from your syllabus queues!` : 'Every block already has a topic.',
        filled > 0 ? 'success' : 'info'
      );
    }
    this.render();
  }

  deleteTask(taskId) {
    const task = (Storage.getDaySchedule(this.currentDate) || []).find(t => t.id === taskId);
    if (!task) return;
    if (!confirm(`Remove "${task.topic || 'this block'}" from ${this.currentDate}?`)) return;

    Storage.removeScheduleBlock(this.currentDate, taskId);
    if (this.timer.activeTaskId === taskId) {
      this.resetTimer();
    }
    if (window.App) {
      window.App.showToast('Block removed from the schedule.', 'info');
    }
  }

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async enableAlerts() {
    const result = await window.Notifier.enable();
    if (window.App) {
      const messages = {
        granted: ['Alerts are on — you will be reminded about today\'s blocks.', 'success'],
        unsupported: ['This device has no system notifications. In-app alerts still work.', 'info'],
        denied: ['Notifications were blocked. Allow them in your device settings.', 'info'],
        error: ['Could not enable notifications on this device.', 'error']
      };
      const [message, type] = messages[result] || ['Alerts are on.', 'success'];
      window.App.showToast(message, type);
    }
    this.render();
  }

  async disableAlerts() {
    await window.Notifier.disable();
    if (window.App) {
      window.App.showToast('System alerts turned off. In-app alerts still work.', 'info');
    }
    this.render();
  }

  async testAlerts() {
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
  }

  formatClock(timeStr) {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    if (Number.isNaN(h)) return timeStr;
    const m = parseInt(parts[1], 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  autoAssignSlot(taskId, subjectId) {
    const state = Storage.getState();
    const tasks = state.planner[this.currentDate] || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const assignedIds = new Set();
    tasks.forEach(t => { if (t.subtopicId) assignedIds.add(t.subtopicId); });

    const targetSub = subjectId || task.subjectId || Storage.getDefaultSubjectId();
    const topicObj = Storage.getNextUncompletedTopic(targetSub, assignedIds);

    if (topicObj) {
      task.topic = topicObj.title;
      task.unitTitle = topicObj.unitTitle;
      task.subtopicId = topicObj.id;
      task.duration = topicObj.duration || task.duration;
      task.subjectId = targetSub;
      task.subject = Storage.getSubjectName(targetSub) || targetSub;
      task.autoAssigned = true;
      Storage.updateState(state);
      if (window.App) {
        window.App.showToast(`Auto-assigned: "${topicObj.title}"`, 'success');
      }
      this.render();
    } else {
      if (window.App) {
        window.App.showToast(`All syllabus topics completed for ${Storage.getSubjectName(targetSub) || targetSub}!`, 'info');
      }
    }
  }
}

window.Planner = new PlannerController();
