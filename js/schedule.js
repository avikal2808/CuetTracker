/**
 * Schedule & Routine Controller
 * Manages the dedicated "Schedule" tab:
 * - View & tweak fixed daily time blocks (Primary 60m, Secondary 45m, Revision 30m)
 * - Routine preferences (wake-up time, study start time, inter-block breaks)
 * - Visual daily timeline & proportional study distribution
 * - One-click "Apply to Today's Tasks" & "Reset to Recommended Defaults"
 * - Full offline-first LocalStorage and Supabase Cloud Sync
 */
class ScheduleController {
  constructor() {
    this.init();
  }

  init() {
    // Listen for storage changes to keep UI up to date
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

  render() {
    const container = document.getElementById('schedule-view-container');
    if (!container) return;

    const blocks = Storage.getTimeBlocks();
    const routine = Storage.getRoutineSettings();
    const totalMinutes = blocks.reduce((acc, b) => acc + (parseInt(b.durationMinutes, 10) || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const weeklyHours = ((totalMinutes * 7) / 60).toFixed(1);

    let html = `
      <!-- 1. Hero & Routine Summary Header -->
      <div class="schedule-hero-card card">
        <div class="schedule-hero-top">
          <div class="schedule-hero-title-group">
            <div class="schedule-icon-badge">
              <i data-lucide="clock"></i>
            </div>
            <div>
              <div class="schedule-headline-row">
                <h2>Daily Schedule & Routine</h2>
                <span class="badge-rotational-rhythm"><i data-lucide="repeat"></i> Fixed 3-Block Rhythm</span>
              </div>
              <p class="schedule-hero-subtitle">
                Configure your fixed daily study blocks and routine pacing. Everything syncs directly with Supabase Cloud.
              </p>
            </div>
          </div>
          <div class="schedule-hero-actions">
            <button class="btn-schedule-action btn-apply-today" onclick="Schedule.applyToToday()" title="Apply current block durations & subjects to today's pending tasks">
              <i data-lucide="calendar-check"></i> <span>Apply to Today</span>
            </button>
            <button class="btn-schedule-action btn-reset-defaults" onclick="Schedule.resetDefaults()" title="Reset to standard 60m / 45m / 30m rhythm">
              <i data-lucide="rotate-ccw"></i> <span>Reset</span>
            </button>
          </div>
        </div>

        <!-- Metric Stat Chips -->
        <div class="schedule-stats-grid">
          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-emerald">
              <i data-lucide="hourglass"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${totalMinutes}m <span class="stat-unit">(${totalHours}h/day)</span></span>
              <span class="stat-lbl">Daily Target Focus</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-blue">
              <i data-lucide="layers"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${blocks.length} Blocks</span>
              <span class="stat-lbl">Daily Sessions</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-amber">
              <i data-lucide="calendar"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${weeklyHours}h</span>
              <span class="stat-lbl">Weekly Target</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div id="schedule-cloud-indicator" class="stat-icon-wrap bg-cloud">
              <i data-lucide="cloud"></i>
            </div>
            <div class="stat-meta">
              <span id="schedule-cloud-text" class="stat-num" style="font-size: 13px;">${Storage.syncMessage || 'Auto-Sync Active'}</span>
              <span class="stat-lbl">Supabase Cloud State</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Visual Daily Routine Timeline Flow -->
      <div class="schedule-timeline-card card">
        <div class="card-section-header">
          <div class="title-with-icon">
            <i data-lucide="git-commit" class="text-primary"></i>
            <h3>Visual Routine Flow & Time Allocation</h3>
          </div>
          <span class="card-subtitle-tag">Chronological Day Map</span>
        </div>

        <!-- Proportional Allocation Bar -->
        <div class="allocation-bar-wrapper">
          <div class="allocation-bar-track">
            ${blocks.map(b => {
              const pct = totalMinutes > 0 ? ((b.durationMinutes / totalMinutes) * 100).toFixed(1) : 33.3;
              return `
                <div class="allocation-segment seg-${b.id}" style="width: ${pct}%;" title="${b.title}: ${b.durationMinutes}m (${pct}%)">
                  <span>${b.title.split(' ')[0]} ${b.durationMinutes}m</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="allocation-legend">
            <span class="legend-item"><span class="legend-dot dot-primary"></span> Primary (${blocks[0]?.durationMinutes || 60}m)</span>
            <span class="legend-item"><span class="legend-dot dot-secondary"></span> Secondary (${blocks[1]?.durationMinutes || 45}m)</span>
            <span class="legend-item"><span class="legend-dot dot-revision"></span> Revision (${blocks[2]?.durationMinutes || 30}m)</span>
          </div>
        </div>

        <!-- Step-by-Step Timeline Node List -->
        <div class="routine-timeline-track">
          <!-- Wakeup Node -->
          <div class="timeline-step step-wake">
            <div class="timeline-step-bullet"><i data-lucide="sun"></i></div>
            <div class="timeline-step-content">
              <div class="step-time-badge">${this.formatTimeDisplay(routine.wakeUpTime || '06:30')}</div>
              <div class="step-info">
                <strong>Wake Up & Morning Prep</strong>
                <p>Hydrate, review flash formula cues & set daily intent.</p>
              </div>
            </div>
          </div>

          <!-- Time Blocks as steps -->
          ${blocks.map((block, idx) => {
            const subjectName = CONFIG.subjects[block.defaultSubject]?.name || (block.defaultSubject === 'rotational' ? 'Rotational Queue' : block.defaultSubject || 'Domain Subject');
            const stepClass = `step-${block.id}`;
            const stepOrderLabel = idx === 0 ? 'Block 1 • Deep Focus' : idx === 1 ? 'Block 2 • Application' : 'Block 3 • Recall & Speed';
            return `
              <div class="timeline-step ${stepClass}">
                <div class="timeline-step-bullet"><i data-lucide="${block.icon || 'clock'}"></i></div>
                <div class="timeline-step-content">
                  <div class="step-time-badge">${this.formatTimeDisplay(block.startTime || '07:00')} - ${this.formatTimeDisplay(block.endTime || '08:00')}</div>
                  <div class="step-info">
                    <div class="step-title-line">
                      <strong>${block.title} (${block.durationMinutes} mins)</strong>
                      <span class="step-sub-tag sub-${block.defaultSubject}">${subjectName}</span>
                    </div>
                    <p>${block.description || ''}</p>
                  </div>
                  <span class="step-order-badge">${stepOrderLabel}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Fixed Daily Time Blocks Tuning Section -->
      <div class="section-title-wrap">
        <div class="title-with-icon">
          <i data-lucide="sliders" class="text-primary"></i>
          <h3>Configure Fixed Study Blocks</h3>
        </div>
        <p class="section-subtitle">Tweak the duration, scheduled time window, and target subject for each block.</p>
      </div>

      <div class="schedule-blocks-grid">
        ${blocks.map(block => this.renderBlockTuningCard(block)).join('')}
      </div>

      <!-- 4. Routine & Habit Settings -->
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
              <span>Automatically sweeps unfinished daily tasks into the Backlog Vault at 23:59 without breaking streak.</span>
            </div>
            <input type="checkbox" class="routine-checkbox" ${routine.autoMidnightRollover !== false ? 'checked' : ''} onchange="Schedule.updateRoutineSetting('autoMidnightRollover', this.checked)">
          </label>

          <label class="routine-toggle-item">
            <div class="toggle-meta">
              <strong>Study Timer Bell & Chime</strong>
              <span>Play soft audio chime alert when focus block timer countdown completes.</span>
            </div>
            <input type="checkbox" class="routine-checkbox" ${routine.reminderAlerts !== false ? 'checked' : ''} onchange="Schedule.updateRoutineSetting('reminderAlerts', this.checked)">
          </label>
        </div>
      </div>

      <!-- 5. Bottom Cloud Sync Bar -->
      <div class="schedule-cloud-bar card">
        <div class="cloud-bar-left">
          <i data-lucide="shield-check" class="text-emerald"></i>
          <div>
            <strong>Changes are automatically saved & synced</strong>
            <p>Every duration adjustment or routine update instantly updates LocalStorage and queues a Supabase push.</p>
          </div>
        </div>
        <div class="cloud-bar-right">
          <button class="btn-primary" onclick="Storage.pushToCloud(); App.showToast('Manual sync triggered with Supabase Cloud!', 'success');">
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

  renderBlockTuningCard(block) {
    const isPrimary = block.id === 'primary';
    const isSecondary = block.id === 'secondary';
    const isRevision = block.id === 'revision';

    const defaultBadgeText = isPrimary ? 'Core Focus' : isSecondary ? 'Application' : 'Recall & Speed';
    const subjectsList = [
      { id: 'accountancy', name: 'Accountancy (ACC)' },
      { id: 'business_studies', name: 'Business Studies (BST)' },
      { id: 'economics', name: 'Economics (ECO)' },
      { id: 'english', name: 'English (ENG)' },
      { id: 'general_test', name: 'General Test (GT)' },
      { id: 'rotational', name: 'Rotational Queue (Auto)' }
    ];

    const presets = [30, 45, 60, 75, 90];

    return `
      <div class="schedule-block-card card block-border-${block.id}">
        <!-- Block Card Header -->
        <div class="schedule-block-card-header">
          <div class="block-header-left">
            <span class="block-type-badge ${block.id}">
              <i data-lucide="${block.icon || 'zap'}"></i> ${block.title}
            </span>
            <span class="block-duration-pill">${block.durationMinutes} mins</span>
          </div>
          <span class="block-header-purpose-tag">${defaultBadgeText}</span>
        </div>

        <div class="schedule-block-card-body">
          <!-- Duration Stepper & Presets -->
          <div class="form-group duration-form-group">
            <label><i data-lucide="timer"></i> Block Duration (Minutes)</label>
            <div class="duration-controls-row">
              <div class="duration-stepper">
                <button type="button" class="btn-stepper" onclick="Schedule.adjustBlockDuration('${block.id}', -5)" title="Decrease 5 minutes">
                  <i data-lucide="minus"></i>
                </button>
                <input type="number" id="input-duration-${block.id}" class="form-control stepper-input" value="${block.durationMinutes}" min="15" max="180" step="5" onchange="Schedule.updateBlockDuration('${block.id}', this.value)">
                <button type="button" class="btn-stepper" onclick="Schedule.adjustBlockDuration('${block.id}', 5)" title="Increase 5 minutes">
                  <i data-lucide="plus"></i>
                </button>
              </div>

              <!-- Quick Presets -->
              <div class="duration-presets-group">
                ${presets.map(mins => `
                  <button type="button" class="btn-preset ${block.durationMinutes === mins ? 'active' : ''}" onclick="Schedule.updateBlockDuration('${block.id}', ${mins})">
                    ${mins}m
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Time Slot Window -->
          <div class="form-row-2">
            <div class="form-group">
              <label for="time-start-${block.id}"><i data-lucide="clock"></i> Slot Start Time</label>
              <input type="time" id="time-start-${block.id}" class="form-control" value="${block.startTime || '07:00'}" onchange="Schedule.updateBlockTime('${block.id}', 'startTime', this.value)">
            </div>
            <div class="form-group">
              <label for="time-end-${block.id}"><i data-lucide="check-circle"></i> Slot End Time</label>
              <div class="end-time-wrapper">
                <input type="time" id="time-end-${block.id}" class="form-control" value="${block.endTime || '08:00'}" onchange="Schedule.updateBlockTime('${block.id}', 'endTime', this.value)">
                <button type="button" class="btn-auto-calc" onclick="Schedule.autoCalcEndTime('${block.id}')" title="Auto-calculate end time from duration">
                  <i data-lucide="wand-2"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Preferred Default Subject -->
          <div class="form-group">
            <label for="subject-select-${block.id}"><i data-lucide="book"></i> Default / Preferred Subject Focus</label>
            <select id="subject-select-${block.id}" class="form-control" onchange="Schedule.updateBlockSubject('${block.id}', this.value)">
              ${subjectsList.map(sub => `
                <option value="${sub.id}" ${block.defaultSubject === sub.id ? 'selected' : ''}>
                  ${sub.name}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Strategy Description / Note -->
          <div class="form-group">
            <label for="desc-${block.id}"><i data-lucide="align-left"></i> Study Objective & Method</label>
            <input type="text" id="desc-${block.id}" class="form-control" value="${this.escapeHtml(block.description || '')}" placeholder="Objective for this session..." onchange="Schedule.updateBlockDescription('${block.id}', this.value)">
          </div>
        </div>
      </div>
    `;
  }

  // Helper to format 24h time to readable 12h time
  formatTimeDisplay(timeStr) {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Adjust duration by delta (e.g. +5 or -5)
  adjustBlockDuration(blockId, delta) {
    const blocks = Storage.getTimeBlocks();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    let current = parseInt(block.durationMinutes, 10) || 45;
    let newDuration = Math.max(15, Math.min(180, current + delta));
    this.updateBlockDuration(blockId, newDuration);
  }

  // Update block duration
  updateBlockDuration(blockId, duration) {
    const mins = Math.max(15, Math.min(180, parseInt(duration, 10) || 45));
    const blocks = Storage.getTimeBlocks().map(b => {
      if (b.id === blockId) {
        const updated = { ...b, durationMinutes: mins };
        // Recalculate badge string
        const prefix = b.id === 'primary' ? 'Core Focus' : b.id === 'secondary' ? 'Application' : 'Recall & Speed';
        updated.badge = `${prefix} (${mins}m)`;
        // Update end time based on start time
        if (updated.startTime) {
          updated.endTime = this.calcEndTime(updated.startTime, mins);
        }
        return updated;
      }
      return b;
    });

    Storage.updateTimeBlocks(blocks);
    this.render();
    if (window.App) {
      window.App.showToast(`Updated ${blockId} block to ${mins} minutes`, 'success');
    }
  }

  // Update time window
  updateBlockTime(blockId, field, value) {
    const blocks = Storage.getTimeBlocks().map(b => {
      if (b.id === blockId) {
        const updated = { ...b, [field]: value };
        if (field === 'startTime' && updated.durationMinutes) {
          updated.endTime = this.calcEndTime(value, updated.durationMinutes);
        }
        return updated;
      }
      return b;
    });

    Storage.updateTimeBlocks(blocks);
    this.render();
  }

  autoCalcEndTime(blockId) {
    const blocks = Storage.getTimeBlocks();
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.startTime) return;

    const calcEnd = this.calcEndTime(block.startTime, block.durationMinutes || 45);
    this.updateBlockTime(blockId, 'endTime', calcEnd);
    if (window.App) {
      window.App.showToast(`Auto-calculated end time: ${this.formatTimeDisplay(calcEnd)}`, 'info');
    }
  }

  calcEndTime(startTimeStr, durationMinutes) {
    const parts = (startTimeStr || '07:00').split(':');
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;

    let totalM = h * 60 + m + (parseInt(durationMinutes, 10) || 0);
    let endH = Math.floor(totalM / 60) % 24;
    let endM = totalM % 60;

    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  // Update block preferred subject
  updateBlockSubject(blockId, subjectId) {
    const blocks = Storage.getTimeBlocks().map(b => {
      if (b.id === blockId) {
        return { ...b, defaultSubject: subjectId };
      }
      return b;
    });

    Storage.updateTimeBlocks(blocks);
    this.render();
    if (window.App) {
      const subName = CONFIG.subjects[subjectId]?.name || subjectId;
      window.App.showToast(`Updated ${blockId} block focus subject to ${subName}`, 'success');
    }
  }

  // Update block description
  updateBlockDescription(blockId, desc) {
    const blocks = Storage.getTimeBlocks().map(b => {
      if (b.id === blockId) {
        return { ...b, description: desc };
      }
      return b;
    });

    Storage.updateTimeBlocks(blocks);
  }

  // Update routine setting
  updateRoutineSetting(key, value) {
    Storage.updateRoutineSettings({ [key]: value });
    if (window.App) {
      window.App.showToast(`Routine setting updated`, 'info');
    }
  }

  // Apply current schedule to today's pending tasks
  applyToToday() {
    Storage.applyScheduleToToday();
    if (window.App) {
      window.App.showToast("Today's planner slots updated with customized schedule!", 'success');
    }
  }

  // Reset to recommended defaults
  resetDefaults() {
    if (confirm("Reset schedule to standard recommended blocks (Primary 60m, Secondary 45m, Revision 30m)?")) {
      Storage.resetScheduleDefaults();
      this.render();
      if (window.App) {
        window.App.showToast("Schedule reset to recommended defaults (60m / 45m / 30m)!", 'info');
      }
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
