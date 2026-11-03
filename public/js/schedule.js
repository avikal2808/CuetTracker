/**
 * Weekly Schedule & Routine Controller
 * Manages the dedicated "Schedule" tab:
 * - 7-Day Weekly Timetable (Monday through Sunday)
 * - Fixed slot configuration: Primary (60m), Secondary (45m), Revision (30m)
 * - Rotational Auto-Assigner linking timetable days directly to uncompleted syllabus subtopics
 * - Live queue preview for each block
 * - 1-Click "Auto-Assign to Today" & "Reset to Recommended Weekly Routine"
 * - Full offline-first LocalStorage & Supabase Cloud Sync
 */
class ScheduleController {
  constructor() {
    this.selectedDayKey = Storage.getDayOfWeek(Storage.getTodayString());
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

  selectDay(dayKey) {
    this.selectedDayKey = dayKey;
    this.render();
  }

  render() {
    const container = document.getElementById('schedule-view-container');
    if (!container) return;

    const weeklySchedule = Storage.getWeeklySchedule();
    const todayDayKey = Storage.getDayOfWeek(Storage.getTodayString());
    const currentDayKey = this.selectedDayKey || todayDayKey;
    const currentDay = weeklySchedule[currentDayKey] || Storage.getDefaultWeeklySchedule()[currentDayKey];

    // Compute weekly statistics
    const daysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let totalWeeklyMinutes = 0;
    daysList.forEach(dk => {
      const d = weeklySchedule[dk];
      if (d) {
        totalWeeklyMinutes += (parseInt(d.primary?.durationMinutes, 10) || 60);
        totalWeeklyMinutes += (parseInt(d.secondary?.durationMinutes, 10) || 45);
        totalWeeklyMinutes += (parseInt(d.revision?.durationMinutes, 10) || 30);
      }
    });
    const totalWeeklyHours = (totalWeeklyMinutes / 60).toFixed(1);
    const avgDailyMinutes = Math.round(totalWeeklyMinutes / 7);

    // Current day minutes
    const dayMinutes = (parseInt(currentDay.primary?.durationMinutes, 10) || 60) +
                       (parseInt(currentDay.secondary?.durationMinutes, 10) || 45) +
                       (parseInt(currentDay.revision?.durationMinutes, 10) || 30);
    const dayHours = (dayMinutes / 60).toFixed(1);

    const routine = Storage.getRoutineSettings();

    let html = `
      <!-- 1. Hero Header & Weekly Timetable Controls -->
      <div class="schedule-hero-card card">
        <div class="schedule-hero-top">
          <div class="schedule-hero-title-group">
            <div class="schedule-icon-badge">
              <i data-lucide="calendar-range"></i>
            </div>
            <div>
              <div class="schedule-headline-row">
                <h2>Weekly Timetable & Schedule Manager</h2>
                <span class="badge-rotational-rhythm"><i data-lucide="sparkles"></i> Rotational Auto-Assigner Active</span>
              </div>
              <p class="schedule-hero-subtitle">
                Set your repeating 7-day study timetable (Monday to Sunday). The rotational engine reads today's day of the week and automatically pulls the next uncompleted syllabus topics into your Today planner.
              </p>
            </div>
          </div>
          <div class="schedule-hero-actions">
            <button class="btn-schedule-action btn-apply-today" onclick="Schedule.applyWeeklyScheduleToToday()" title="Auto-Assign Today's blocks using current timetable">
              <i data-lucide="sparkles"></i> <span>Auto-Assign to Today</span>
            </button>
            <button class="btn-schedule-action btn-save-routine" onclick="Schedule.saveWeeklySchedule()" title="Save timetable to Supabase Cloud">
              <i data-lucide="save"></i> <span>Save Timetable</span>
            </button>
            <button class="btn-schedule-action btn-reset-defaults" onclick="Schedule.resetWeeklySchedule()" title="Reset to standard Commerce/CUET routine">
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
              <span class="stat-num">${totalWeeklyHours}h <span class="stat-unit">/ week</span></span>
              <span class="stat-lbl">Weekly Target Focus (${totalWeeklyMinutes}m)</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-blue">
              <i data-lucide="calendar"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">${dayMinutes}m <span class="stat-unit">(${dayHours}h)</span></span>
              <span class="stat-lbl">${currentDay.name}'s Focus Target</span>
            </div>
          </div>

          <div class="schedule-stat-chip">
            <div class="stat-icon-wrap bg-amber">
              <i data-lucide="layers"></i>
            </div>
            <div class="stat-meta">
              <span class="stat-num">21 Blocks</span>
              <span class="stat-lbl">3 Fixed Blocks &bull; 7 Days</span>
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

      <!-- 2. 7-Day Day Selector Bar -->
      <div class="weekly-selector-card card">
        <div class="weekly-selector-header">
          <div class="title-with-icon">
            <i data-lucide="calendar" class="text-primary"></i>
            <h3>Select Day to Configure</h3>
          </div>
          <span class="weekly-sync-indicator"><i data-lucide="check-circle-2"></i> Auto-repeats every week</span>
        </div>

        <div class="weekly-days-tabs" role="tablist">
          ${daysList.map(dk => {
            const d = weeklySchedule[dk] || Storage.getDefaultWeeklySchedule()[dk];
            const isSelected = dk === currentDayKey;
            const isToday = dk === todayDayKey;
            const pCode = CONFIG.subjects[d.primary?.subject]?.code || 'ACC';
            const sCode = CONFIG.subjects[d.secondary?.subject]?.code || 'BST';
            const rCode = CONFIG.subjects[d.revision?.subject]?.code || 'ECO';
            const shortName = d.name.slice(0, 3).toUpperCase();

            return `
              <button 
                class="weekly-day-pill ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''}" 
                onclick="Schedule.selectDay('${dk}')"
                role="tab"
                aria-selected="${isSelected}"
              >
                <div class="pill-day-row">
                  <span class="pill-day-name">${shortName}</span>
                  ${isToday ? `<span class="pill-today-badge">TODAY</span>` : ''}
                </div>
                <div class="pill-subjects-preview">
                  <span class="subj-tag-mini sub-${d.primary?.subject}">${pCode}</span>
                  <span class="subj-tag-mini sub-${d.secondary?.subject}">${sCode}</span>
                  <span class="subj-tag-mini sub-${d.revision?.subject}">${rCode}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Current Day Configuration & Live Rotational Previews -->
      <div class="section-title-wrap">
        <div class="title-with-icon">
          <i data-lucide="sliders" class="text-primary"></i>
          <h3>${currentDay.name}'s Daily Study Blocks</h3>
        </div>
        <p class="section-subtitle">
          Configure the primary, secondary, and revision slots for <strong>${currentDay.name}</strong>. The rotational auto-assigner will pull the next active topics from the syllabus queue.
        </p>
      </div>

      <div class="schedule-blocks-grid">
        ${this.renderDaySlotCard(currentDayKey, 'primary', currentDay.primary, 'Core Numerical / Heavy Theory', '#4F8A68')}
        ${this.renderDaySlotCard(currentDayKey, 'secondary', currentDay.secondary, 'Applied Concepts & Practice', '#2F6375')}
        ${this.renderDaySlotCard(currentDayKey, 'revision', currentDay.revision, 'Recall, Drills & Formulas', '#6C3483')}
      </div>

      <!-- 4. Weekly Timetable Matrix Overview Table -->
      <div class="weekly-matrix-card card">
        <div class="card-section-header">
          <div class="title-with-icon">
            <i data-lucide="table" class="text-primary"></i>
            <h3>Weekly Timetable Master Matrix</h3>
          </div>
          <span class="card-subtitle-tag">7-Day Study Rotation At A Glance</span>
        </div>

        <div class="table-responsive">
          <table class="weekly-matrix-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Primary Block</th>
                <th>Secondary Block</th>
                <th>Revision Block</th>
                <th>Total Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${daysList.map(dk => {
                const d = weeklySchedule[dk] || Storage.getDefaultWeeklySchedule()[dk];
                const isSelected = dk === currentDayKey;
                const isToday = dk === todayDayKey;
                const pSub = CONFIG.subjects[d.primary?.subject]?.name || d.primary?.subject || 'Accountancy';
                const sSub = CONFIG.subjects[d.secondary?.subject]?.name || d.secondary?.subject || 'Business Studies';
                const rSub = CONFIG.subjects[d.revision?.subject]?.name || d.revision?.subject || 'Economics';
                const totalM = (parseInt(d.primary?.durationMinutes, 10) || 60) +
                               (parseInt(d.secondary?.durationMinutes, 10) || 45) +
                               (parseInt(d.revision?.durationMinutes, 10) || 30);

                return `
                  <tr class="matrix-row ${isSelected ? 'row-selected' : ''} ${isToday ? 'row-today' : ''}" onclick="Schedule.selectDay('${dk}')">
                    <td class="col-day">
                      <strong>${d.name}</strong>
                      ${isToday ? `<span class="matrix-today-badge">Today</span>` : ''}
                    </td>
                    <td>
                      <span class="matrix-sub-chip sub-${d.primary?.subject}">
                        ${pSub} (${d.primary?.durationMinutes || 60}m)
                      </span>
                    </td>
                    <td>
                      <span class="matrix-sub-chip sub-${d.secondary?.subject}">
                        ${sSub} (${d.secondary?.durationMinutes || 45}m)
                      </span>
                    </td>
                    <td>
                      <span class="matrix-sub-chip sub-${d.revision?.subject}">
                        ${rSub} (${d.revision?.durationMinutes || 30}m)
                      </span>
                    </td>
                    <td class="col-duration"><strong>${totalM}m</strong></td>
                    <td class="col-action">
                      <button class="btn-matrix-edit" onclick="event.stopPropagation(); Schedule.selectDay('${dk}')">
                        ${isSelected ? 'Editing' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 5. Routine & Habit Settings -->
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

      <!-- 6. Bottom Cloud Sync Bar -->
      <div class="schedule-cloud-bar card">
        <div class="cloud-bar-left">
          <i data-lucide="shield-check" class="text-emerald"></i>
          <div>
            <strong>Weekly timetable & rotational queues are auto-synced</strong>
            <p>Every subject assignment and duration change persists to LocalStorage and syncs with Supabase Cloud.</p>
          </div>
        </div>
        <div class="cloud-bar-right">
          <button class="btn-primary" onclick="Storage.pushToCloud(); App.showToast('Weekly routine synced with Supabase Cloud!', 'success');">
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

  renderDaySlotCard(dayKey, slotId, slot, defaultBadgeText, accentColor) {
    const subjectsList = [
      { id: 'accountancy', name: 'Accountancy (ACC)' },
      { id: 'business_studies', name: 'Business Studies (BST)' },
      { id: 'economics', name: 'Economics (ECO)' },
      { id: 'english', name: 'English (ENG)' },
      { id: 'general_test', name: 'General Test (GT)' }
    ];

    const currentSubjectId = slot?.subject || (slotId === 'primary' ? 'accountancy' : slotId === 'secondary' ? 'business_studies' : 'economics');
    const durationMins = parseInt(slot?.durationMinutes, 10) || (slotId === 'primary' ? 60 : slotId === 'secondary' ? 45 : 30);
    const presets = [30, 45, 60, 75, 90];

    // Live preview of what the Rotational Auto-Assigner will pull for this block
    const nextTopic = Storage.getNextUncompletedTopic(currentSubjectId);

    return `
      <div class="schedule-block-card card block-border-${slotId}">
        <!-- Header -->
        <div class="schedule-block-card-header">
          <div class="block-header-left">
            <span class="block-type-badge ${slotId}">
              <i data-lucide="${slotId === 'primary' ? 'zap' : slotId === 'secondary' ? 'book-open' : 'repeat'}"></i>
              ${slot?.title || (slotId === 'primary' ? 'Primary Block' : slotId === 'secondary' ? 'Secondary Block' : 'Revision Block')}
            </span>
            <span class="block-duration-pill">${durationMins} mins</span>
          </div>
          <span class="block-header-purpose-tag">${defaultBadgeText}</span>
        </div>

        <div class="schedule-block-card-body">
          <!-- Subject Select Dropdown -->
          <div class="form-group">
            <label for="select-sub-${dayKey}-${slotId}"><i data-lucide="book"></i> Scheduled Subject</label>
            <select id="select-sub-${dayKey}-${slotId}" class="form-control" onchange="Schedule.updateDaySlotSubject('${dayKey}', '${slotId}', this.value)">
              ${subjectsList.map(s => `
                <option value="${s.id}" ${currentSubjectId === s.id ? 'selected' : ''}>
                  ${s.name}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Live Rotational Auto-Assign Preview Box -->
          <div class="next-up-preview">
            <div class="next-up-header">
              <i data-lucide="sparkles" class="text-emerald"></i>
              <span>Next in Syllabus Queue (Auto-Assign):</span>
            </div>
            <div class="next-up-title">${nextTopic?.title || 'No pending subtopic found'}</div>
            <div class="next-up-unit">${nextTopic?.unitTitle || ''}</div>
          </div>

          <!-- Duration Stepper & Presets -->
          <div class="form-group duration-form-group">
            <label><i data-lucide="timer"></i> Slot Duration (Minutes)</label>
            <div class="duration-controls-row">
              <div class="duration-stepper">
                <button type="button" class="btn-stepper" onclick="Schedule.adjustDaySlotDuration('${dayKey}', '${slotId}', -5)" title="Decrease 5 minutes">
                  <i data-lucide="minus"></i>
                </button>
                <input 
                  type="number" 
                  id="input-dur-${dayKey}-${slotId}" 
                  class="form-control stepper-input" 
                  value="${durationMins}" 
                  min="15" 
                  max="180" 
                  step="5" 
                  onchange="Schedule.updateDaySlotDuration('${dayKey}', '${slotId}', this.value)"
                >
                <button type="button" class="btn-stepper" onclick="Schedule.adjustDaySlotDuration('${dayKey}', '${slotId}', 5)" title="Increase 5 minutes">
                  <i data-lucide="plus"></i>
                </button>
              </div>

              <!-- Presets -->
              <div class="duration-presets-group">
                ${presets.map(mins => `
                  <button 
                    type="button" 
                    class="btn-preset ${durationMins === mins ? 'active' : ''}" 
                    onclick="Schedule.updateDaySlotDuration('${dayKey}', '${slotId}', ${mins})"
                  >
                    ${mins}m
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Time Window -->
          <div class="form-row-2">
            <div class="form-group">
              <label for="time-start-${dayKey}-${slotId}"><i data-lucide="clock"></i> Start Time</label>
              <input 
                type="time" 
                id="time-start-${dayKey}-${slotId}" 
                class="form-control" 
                value="${slot?.startTime || '07:00'}" 
                onchange="Schedule.updateDaySlotTime('${dayKey}', '${slotId}', 'startTime', this.value)"
              >
            </div>
            <div class="form-group">
              <label for="time-end-${dayKey}-${slotId}"><i data-lucide="check-circle"></i> End Time</label>
              <div class="end-time-wrapper">
                <input 
                  type="time" 
                  id="time-end-${dayKey}-${slotId}" 
                  class="form-control" 
                  value="${slot?.endTime || '08:00'}" 
                  onchange="Schedule.updateDaySlotTime('${dayKey}', '${slotId}', 'endTime', this.value)"
                >
                <button type="button" class="btn-auto-calc" onclick="Schedule.autoCalcDaySlotEndTime('${dayKey}', '${slotId}')" title="Auto-calculate end time from duration">
                  <i data-lucide="wand-2"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Study Strategy Note -->
          <div class="form-group">
            <label for="desc-${dayKey}-${slotId}"><i data-lucide="align-left"></i> Study Objective</label>
            <input 
              type="text" 
              id="desc-${dayKey}-${slotId}" 
              class="form-control" 
              value="${this.escapeHtml(slot?.description || '')}" 
              placeholder="Session intent..." 
              onchange="Schedule.updateDaySlotDescription('${dayKey}', '${slotId}', this.value)"
            >
          </div>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

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

  calcEndTime(startTimeStr, durationMinutes) {
    const parts = (startTimeStr || '07:00').split(':');
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;
    let totalM = h * 60 + m + (parseInt(durationMinutes, 10) || 0);
    let endH = Math.floor(totalM / 60) % 24;
    let endM = totalM % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  updateDaySlotSubject(dayKey, slotId, subjectId) {
    Storage.updateWeeklyDaySlot(dayKey, slotId, { subject: subjectId });
    this.render();
    if (window.App) {
      const subName = CONFIG.subjects[subjectId]?.name || subjectId;
      window.App.showToast(`Updated ${dayKey} ${slotId} block to ${subName}`, 'success');
    }
  }

  updateDaySlotDuration(dayKey, slotId, duration) {
    const mins = Math.max(15, Math.min(180, parseInt(duration, 10) || 45));
    const weeklySchedule = Storage.getWeeklySchedule();
    const currentSlot = weeklySchedule[dayKey]?.[slotId] || {};
    const startTime = currentSlot.startTime || '07:00';
    const endTime = this.calcEndTime(startTime, mins);

    Storage.updateWeeklyDaySlot(dayKey, slotId, {
      durationMinutes: mins,
      endTime: endTime
    });
    this.render();
    if (window.App) {
      window.App.showToast(`Updated ${slotId} block to ${mins} mins`, 'success');
    }
  }

  adjustDaySlotDuration(dayKey, slotId, delta) {
    const weeklySchedule = Storage.getWeeklySchedule();
    const currentSlot = weeklySchedule[dayKey]?.[slotId] || {};
    const cur = parseInt(currentSlot.durationMinutes, 10) || 45;
    this.updateDaySlotDuration(dayKey, slotId, cur + delta);
  }

  updateDaySlotTime(dayKey, slotId, field, value) {
    const weeklySchedule = Storage.getWeeklySchedule();
    const currentSlot = weeklySchedule[dayKey]?.[slotId] || {};
    const updates = { [field]: value };
    if (field === 'startTime' && currentSlot.durationMinutes) {
      updates.endTime = this.calcEndTime(value, currentSlot.durationMinutes);
    }
    Storage.updateWeeklyDaySlot(dayKey, slotId, updates);
    this.render();
  }

  autoCalcDaySlotEndTime(dayKey, slotId) {
    const weeklySchedule = Storage.getWeeklySchedule();
    const currentSlot = weeklySchedule[dayKey]?.[slotId] || {};
    const calcEnd = this.calcEndTime(currentSlot.startTime || '07:00', currentSlot.durationMinutes || 45);
    this.updateDaySlotTime(dayKey, slotId, 'endTime', calcEnd);
    if (window.App) {
      window.App.showToast(`End time auto-calculated: ${this.formatTimeDisplay(calcEnd)}`, 'info');
    }
  }

  updateDaySlotDescription(dayKey, slotId, desc) {
    Storage.updateWeeklyDaySlot(dayKey, slotId, { description: desc });
  }

  updateRoutineSetting(key, value) {
    Storage.updateRoutineSettings({ [key]: value });
    if (window.App) {
      window.App.showToast('Routine setting updated', 'info');
    }
  }

  saveWeeklySchedule() {
    Storage.pushToCloud();
    if (window.App) {
      window.App.showToast('Weekly timetable saved & synced with cloud!', 'success');
    }
  }

  applyWeeklyScheduleToToday() {
    const today = Storage.getTodayString();
    Storage.autoAssignDate(today, true);
    if (window.App) {
      const dayName = Storage.getDayOfWeek(today).toUpperCase();
      window.App.showToast(`Auto-assigned Today's blocks from ${dayName} timetable!`, 'success');
      window.App.navigateToTab('planner');
    }
  }

  resetWeeklySchedule() {
    if (confirm('Reset your 7-day timetable to standard recommended Commerce + CUET study rhythm?')) {
      Storage.resetWeeklyScheduleDefaults();
      this.render();
      if (window.App) {
        window.App.showToast('Weekly timetable reset to recommended defaults!', 'info');
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
