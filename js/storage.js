/**
 * Storage & Supabase Sync Engine with Offline-First LocalStorage Fallback
 */
class StudyStorage {
  constructor() {
    this.storageKey = CONFIG.storageKey;
    this.listeners = { change: [], syncStatus: [] };
    this.syncStatus = 'offline'; // 'synced', 'syncing', 'error', 'offline', 'local'
    this.syncMessage = 'Local Storage Active';
    this.isOnline = navigator.onLine;
    this.saveTimeout = null;

    // Initialize state
    this.state = this.loadInitialState();

    // Setup network listeners
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Initialize Supabase Client if available
    this.supabaseClient = null;
    this.initSupabase();

    // Check midnight rollover on boot
    this.checkAndPerformMidnightRollover();
  }

  // Event subscription
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error('Listener error:', e); }
      });
    }
  }

  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDefaultState() {
    const today = this.getTodayString();
    
    // Default initial queue from default syllabus
    const defaultQueues = {};
    Object.keys(DEFAULT_SYLLABUS).forEach(subKey => {
      const sub = DEFAULT_SYLLABUS[subKey];
      defaultQueues[subKey] = [];
      let count = 0;
      for (const unit of sub.units) {
        for (const topic of unit.subtopics) {
          defaultQueues[subKey].push({
            id: topic.id,
            subjectId: subKey,
            subjectName: sub.title,
            unitTitle: unit.title,
            title: topic.title,
            duration: topic.minutes,
            isCompleted: false,
            priority: count < 2 ? 'high' : 'normal'
          });
          count++;
        }
      }
    });

    // Default Today's planner slots - empty for testing
    const initialTasks = [];

    return {
      version: 1,
      studentRecordId: CONFIG.supabase.studentRecordId,
      lastRolloverDate: today,
      targetPercentage: 93, // 93%+ board target
      studyPaceDailyTopics: 2.2,
      timeBlocks: [
        {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          badge: 'Core Focus (60m)',
          icon: 'zap',
          description: 'Deep dive, heavy numericals or critical concepts (Accountancy / Macroeconomics)',
          defaultSubject: 'accountancy',
          color: '#4F8A68'
        },
        {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          badge: 'Application (45m)',
          icon: 'book-open',
          description: 'Case studies, conceptual business theory or applied economics',
          defaultSubject: 'business_studies',
          color: '#2F6375'
        },
        {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          badge: 'Recall & Speed (30m)',
          icon: 'repeat',
          description: 'MCQ drill, formulas, vocabulary, or General Test current affairs',
          defaultSubject: 'economics',
          color: '#6C3483'
        }
      ],
      routineSettings: {
        wakeUpTime: '06:30',
        studyStartTime: '07:00',
        targetDailyMinutes: 135,
        breakBetweenBlocksMinutes: 15,
        autoMidnightRollover: true,
        reminderAlerts: true
      },
      planner: {
        [today]: initialTasks
      },
      queues: defaultQueues,
      syllabusProgress: {}, // { [subtopicId]: { completed: bool, completedAt: iso, preMarked: bool } }
      mocks: [],
      backlog: [],
      userProfile: {
        name: 'Commerce Aspirant',
        stream: 'Class 12 Commerce + CUET UG',
        targetScore: '93%+',
        targetCollege: 'SRCC / Hindu / St. Stephen’s / LSR'
      }
    };
  }

  loadInitialState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.version) {
          return this.mergeWithDefault(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not parse local storage state:', e);
    }
    const def = this.getDefaultState();
    this.saveLocally(def);
    return def;
  }

  /** Legacy seed IDs shipped in early builds — strip on load so handoff starts clean. */
  stripLegacySeedData(state) {
    const seedMockIds = new Set(['mock_1', 'mock_2', 'mock_3', 'mock_4', 'mock_5']);
    const seedBacklogIds = new Set(['bl_sample_1']);
    if (Array.isArray(state.mocks)) {
      state.mocks = state.mocks.filter(m => !seedMockIds.has(m.id));
    }
    if (Array.isArray(state.backlog)) {
      state.backlog = state.backlog.filter(b => !seedBacklogIds.has(b.id));
    }
    return state;
  }

  mergeWithDefault(existing) {
    const def = this.getDefaultState();
    const merged = {
      ...def,
      ...existing,
      timeBlocks: existing.timeBlocks && Array.isArray(existing.timeBlocks) && existing.timeBlocks.length > 0
        ? existing.timeBlocks
        : def.timeBlocks,
      routineSettings: { ...def.routineSettings, ...(existing.routineSettings || {}) },
      planner: { ...def.planner, ...(existing.planner || {}) },
      queues: { ...def.queues, ...(existing.queues || {}) },
      syllabusProgress: { ...(existing.syllabusProgress || {}) },
      mocks: Array.isArray(existing.mocks) ? existing.mocks : def.mocks,
      backlog: Array.isArray(existing.backlog) ? existing.backlog : def.backlog,
      userProfile: { ...def.userProfile, ...(existing.userProfile || {}) }
    };
    return this.stripLegacySeedData(merged);
  }

  getTimeBlocks() {
    if (this.state && Array.isArray(this.state.timeBlocks) && this.state.timeBlocks.length > 0) {
      return this.state.timeBlocks;
    }
    return CONFIG.timeBlocks;
  }

  getRoutineSettings() {
    if (this.state && this.state.routineSettings) {
      return this.state.routineSettings;
    }
    return {
      wakeUpTime: '06:30',
      studyStartTime: '07:00',
      targetDailyMinutes: 135,
      breakBetweenBlocksMinutes: 15,
      autoMidnightRollover: true,
      reminderAlerts: true
    };
  }

  updateTimeBlocks(newBlocks) {
    this.updateState(state => {
      state.timeBlocks = newBlocks;
      const totalMins = newBlocks.reduce((sum, b) => sum + (parseInt(b.durationMinutes, 10) || 0), 0);
      if (!state.routineSettings) state.routineSettings = {};
      state.routineSettings.targetDailyMinutes = totalMins;
      return state;
    });
  }

  updateRoutineSettings(newSettings) {
    this.updateState(state => {
      state.routineSettings = {
        ...(state.routineSettings || {}),
        ...newSettings
      };
      return state;
    });
  }

  applyScheduleToToday() {
    const today = this.getTodayString();
    const blocks = this.getTimeBlocks();
    this.updateState(state => {
      if (!state.planner) state.planner = {};
      const todayTasks = state.planner[today] || [];

      blocks.forEach(block => {
        const existingTask = todayTasks.find(t => t.blockId === block.id);
        if (existingTask && existingTask.status === 'pending') {
          existingTask.duration = parseInt(block.durationMinutes, 10) || existingTask.duration;
          existingTask.blockTitle = `${block.title} (${block.durationMinutes}m)`;
          if (block.defaultSubject && (!existingTask.subjectId || existingTask.subjectId === '')) {
            existingTask.subjectId = block.defaultSubject;
            existingTask.subject = CONFIG.subjects[block.defaultSubject]?.name || existingTask.subject;
          }
        }
      });
      return state;
    });
  }

  resetScheduleDefaults() {
    const def = this.getDefaultState();
    this.updateState(state => {
      state.timeBlocks = JSON.parse(JSON.stringify(def.timeBlocks));
      state.routineSettings = JSON.parse(JSON.stringify(def.routineSettings));
      return state;
    });
  }

  saveLocally(stateToSave) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(stateToSave || this.state));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }

  getState() {
    return this.state;
  }

  updateState(updaterFn) {
    try {
      const newState = typeof updaterFn === 'function' ? updaterFn(this.state) : updaterFn;
      this.state = newState || this.state;
      this.saveLocally(this.state);
      this.emit('change', this.state);
      this.scheduleCloudSync();
    } catch (e) {
      console.error('Error updating state:', e);
    }
  }

  initSupabase() {
    try {
      if (window.supabase && window.supabase.createClient) {
        this.supabaseClient = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        this.setSyncStatus('local', 'Ready to sync with cloud');
        // Attempt initial background pull
        this.pullFromCloud();
      } else {
        this.setSyncStatus('local', 'Local storage active');
      }
    } catch (err) {
      console.warn('Supabase init notice:', err);
      this.setSyncStatus('local', 'Offline mode active');
    }
  }

  setSyncStatus(status, message) {
    this.syncStatus = status;
    this.syncMessage = message;
    this.emit('syncStatus', { status, message });
  }

  handleNetworkChange(isOnline) {
    this.isOnline = isOnline;
    if (isOnline) {
      this.setSyncStatus('syncing', 'Network restored. Syncing...');
      this.scheduleCloudSync(100);
    } else {
      this.setSyncStatus('offline', 'Offline (Saved Locally)');
    }
  }

  scheduleCloudSync(delayMs = 900) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.pushToCloud();
    }, delayMs);
  }

  async pullFromCloud() {
    if (!this.isOnline) return;
    try {
      const headers = {
        'apikey': CONFIG.supabase.anonKey,
        'Authorization': `Bearer ${CONFIG.supabase.anonKey}`
      };
      const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableName}?id=eq.${CONFIG.supabase.studentRecordId}&select=*`, {
        headers
      });

      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].data) {
          const cloudData = rows[0].data;
          // Merge cloud data safely if newer or existing
          if (cloudData.version) {
            this.state = this.mergeWithDefault(cloudData);
            this.saveLocally(this.state);
            this.emit('change', this.state);
            this.setSyncStatus('synced', 'Synced with Supabase Cloud');
            return;
          }
        }
      }
      this.setSyncStatus('synced', 'Local & Cloud in sync');
    } catch (e) {
      console.warn('Pull cloud status:', e.message);
      this.setSyncStatus('local', 'Saved Locally (Auto-sync ready)');
    }
  }

  async pushToCloud() {
    if (!this.isOnline) {
      this.setSyncStatus('offline', 'Offline (Saved Locally)');
      return;
    }

    this.setSyncStatus('syncing', 'Syncing to Cloud...');

    try {
      const payload = {
        id: CONFIG.supabase.studentRecordId,
        data: this.state,
        updated_at: new Date().toISOString()
      };

      const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableName}`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.supabase.anonKey,
          'Authorization': `Bearer ${CONFIG.supabase.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log('[Supabase Sync] ✅ Successfully pushed state to Supabase table:', CONFIG.supabase.tableName);
        this.setSyncStatus('synced', 'Synced with Supabase Cloud');
      } else {
        const errText = await res.text();
        console.warn('[Supabase Sync] ⚠️ Write rejected:', errText);
        if (errText.includes('row-level security') || errText.includes('42501')) {
          this.setSyncStatus('rls_warning', 'Supabase Connected (RLS Read-Only)');
        } else {
          this.setSyncStatus('local', 'Saved Locally (Auto-sync ready)');
        }
      }
    } catch (err) {
      console.warn('[Supabase Sync] Network/fetch error:', err.message);
      this.setSyncStatus('local', 'Offline fallback active');
    }
  }

  /**
   * Run live Supabase diagnostics directly from the browser
   */
  async testConnection() {
    console.group('🔍 Supabase Connection Diagnostics');
    console.log('Testing endpoint:', CONFIG.supabase.url);
    console.log('Target table:', CONFIG.supabase.tableName);

    const headers = {
      'apikey': CONFIG.supabase.anonKey,
      'Authorization': `Bearer ${CONFIG.supabase.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const results = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      ping: { ok: false, status: 0, latencyMs: 0, message: '' },
      read: { ok: false, status: 0, count: 0, latencyMs: 0, message: '' },
      write: { ok: false, status: 0, isRlsBlocked: false, latencyMs: 0, message: '', details: '' }
    };

    // 1. Ping / Endpoint check
    try {
      const t0 = performance.now();
      const pingRes = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableName}?select=id&limit=1`, { headers });
      results.ping.latencyMs = Math.round(performance.now() - t0);
      results.ping.status = pingRes.status;
      results.ping.ok = pingRes.ok;
      results.ping.message = pingRes.ok ? `Reachable (${results.ping.latencyMs}ms)` : `HTTP ${pingRes.status}`;
      console.log('Step 1 (Ping):', results.ping.ok ? '✅ PASS' : '❌ FAIL', results.ping.message);
    } catch (e) {
      results.ping.message = e.message;
      console.error('Step 1 (Ping Error):', e);
    }

    // 2. Read test
    try {
      const t1 = performance.now();
      const readRes = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableName}?select=*&limit=5`, { headers });
      results.read.latencyMs = Math.round(performance.now() - t1);
      results.read.status = readRes.status;
      if (readRes.ok) {
        const rows = await readRes.json();
        results.read.ok = true;
        results.read.count = rows.length;
        results.read.message = `Read ${rows.length} row(s) successfully (${results.read.latencyMs}ms)`;
        console.log('Step 2 (Read): ✅ PASS', results.read.message);
      } else {
        const errText = await readRes.text();
        results.read.message = `HTTP ${readRes.status}: ${errText}`;
        console.error('Step 2 (Read Fail):', results.read.message);
      }
    } catch (e) {
      results.read.message = e.message;
      console.error('Step 2 (Read Error):', e);
    }

    // 3. Write test
    try {
      const t2 = performance.now();
      const testPayload = {
        id: CONFIG.supabase.studentRecordId,
        data: {
          version: 1,
          lastSyncTest: new Date().toISOString(),
          status: 'verified'
        },
        updated_at: new Date().toISOString()
      };

      const writeRes = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableName}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(testPayload)
      });
      results.write.latencyMs = Math.round(performance.now() - t2);
      results.write.status = writeRes.status;

      if (writeRes.ok) {
        results.write.ok = true;
        results.write.message = `Upsert succeeded (${results.write.latencyMs}ms)`;
        console.log('Step 3 (Write): ✅ PASS', results.write.message);
      } else {
        const writeBody = await writeRes.text();
        results.write.details = writeBody;
        if (writeBody.includes('row-level security') || writeBody.includes('42501')) {
          results.write.isRlsBlocked = true;
          results.write.message = 'Protected by PostgreSQL Row-Level Security (RLS policy required)';
          console.warn('Step 3 (Write - RLS Blocked): ⚠️', results.write.message);
        } else {
          results.write.message = `HTTP ${writeRes.status}: ${writeBody}`;
          console.error('Step 3 (Write Fail):', results.write.message);
        }
      }
    } catch (e) {
      results.write.message = e.message;
      console.error('Step 3 (Write Error):', e);
    }

    results.allPassed = results.ping.ok && results.read.ok && results.write.ok;
    console.log('Overall Test Result:', results.allPassed ? '🎉 ALL PASSED' : (results.write.isRlsBlocked ? '⚠️ READ OK, WRITE RLS BLOCKED' : '❌ FAILED'));
    console.groupEnd();

    return results;
  }

  /**
   * Automated Midnight Rollover to Backlog Vault:
   * Examines past dates in the planner and automatically rolls any incomplete
   * ('pending') study blocks into the Backlog Vault tagged with original date.
   */
  checkAndPerformMidnightRollover() {
    const today = this.getTodayString();
    let rolledOverCount = 0;
    const planner = this.state.planner || {};
    const backlog = [...(this.state.backlog || [])];

    Object.keys(planner).forEach(dateKey => {
      // If dateKey is strictly before today
      if (dateKey < today) {
        const tasks = planner[dateKey];
        if (Array.isArray(tasks)) {
          tasks.forEach(task => {
            if (task.status === 'pending') {
              // Create backlog vault item
              const backlogItem = {
                id: 'bl_' + task.id + '_' + Date.now(),
                originalDate: dateKey,
                blockTitle: task.blockTitle || 'Missed Study Block',
                subject: task.subject,
                subjectId: task.subjectId,
                topic: task.topic,
                unitTitle: task.unitTitle || '',
                subtopicId: task.subtopicId || null,
                duration: task.duration || 45,
                status: 'pending',
                addedAt: new Date().toISOString(),
                reason: `Midnight Rollover from ${dateKey}`
              };

              backlog.push(backlogItem);
              task.status = 'rolled_over';
              rolledOverCount++;
            }
          });
        }
      }
    });

    if (rolledOverCount > 0) {
      console.log(`Automated midnight rollover: ${rolledOverCount} task(s) transferred to Backlog Vault.`);
    }

    this.state.backlog = backlog;
    this.state.lastRolloverDate = today;

    // Ensure today's date has task slots initialized if empty
    if (!this.state.planner[today] || this.state.planner[today].length === 0) {
      this.state.planner[today] = this.generateTasksForDate(today);
    }

    this.saveLocally(this.state);
  }

  generateTasksForDate(dateStr) {
    const blocks = this.getTimeBlocks();
    const subjectsList = ['accountancy', 'business_studies', 'economics', 'english', 'general_test'];

    return blocks.map((block, index) => {
      const subjectKey = (block.defaultSubject && CONFIG.subjects[block.defaultSubject])
        ? block.defaultSubject
        : subjectsList[index % subjectsList.length];

      return {
        id: `task_${Date.now()}_${index}`,
        blockId: block.id,
        blockTitle: `${block.title} (${block.durationMinutes}m)`,
        duration: parseInt(block.durationMinutes, 10) || 45,
        subject: CONFIG.subjects[subjectKey]?.name || 'Commerce',
        subjectId: subjectKey,
        topic: 'Add a topic from the queue',
        unitTitle: 'Select from syllabus',
        subtopicId: null,
        status: 'pending',
        scheduledDate: dateStr,
        completedAt: null
      };
    });
  }

  isSubtopicDone(subtopicId) {
    if (!subtopicId) return false;
    const progress = this.state.syllabusProgress || {};
    return Boolean(progress[subtopicId] && progress[subtopicId].completed);
  }

  // Backup & Restore
  exportBackupJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cuet_study_tracker_backup_${this.getTodayString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importBackupJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && (parsed.planner || parsed.syllabusProgress || parsed.mocks)) {
        this.state = this.mergeWithDefault(parsed);
        this.saveLocally(this.state);
        this.emit('change', this.state);
        this.scheduleCloudSync(100);
        return { success: true };
      }
      return { success: false, error: 'Invalid backup structure' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

// Global instance
window.Storage = new StudyStorage();
