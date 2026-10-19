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
      weeklySchedule: this.getDefaultWeeklySchedule(),
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

  getDefaultWeeklySchedule() {
    return {
      monday: {
        dayKey: 'monday',
        name: 'Monday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'accountancy',
          description: 'Numerical deep dive & partnership accounting'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'business_studies',
          description: 'Case studies & business management theory'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'economics',
          description: 'Formulas, definitions & MCQ recall'
        }
      },
      tuesday: {
        dayKey: 'tuesday',
        name: 'Tuesday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'economics',
          description: 'Macroeconomics models & Indian Economic Development'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'english',
          description: 'Reading comprehension passages & literary vocabulary'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'accountancy',
          description: 'Quick accounting ratios & journal drills'
        }
      },
      wednesday: {
        dayKey: 'wednesday',
        name: 'Wednesday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'accountancy',
          description: 'Share capital, pro-rata & forfeiture entries'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'business_studies',
          description: 'Management principles & business environment'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'general_test',
          description: 'Numerical ability & mental aptitude drill'
        }
      },
      thursday: {
        dayKey: 'thursday',
        name: 'Thursday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'economics',
          description: 'National Income calculation & Money/Banking'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'accountancy',
          description: 'Debentures & cash flow statement methods'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'english',
          description: 'Sentence rearrangement, idioms & grammar rules'
        }
      },
      friday: {
        dayKey: 'friday',
        name: 'Friday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'business_studies',
          description: 'Financial management & marketing management'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'economics',
          description: 'Comparative development & government budget'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'general_test',
          description: 'Current affairs, static GK & analytical reasoning'
        }
      },
      saturday: {
        dayKey: 'saturday',
        name: 'Saturday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'accountancy',
          description: 'Full-length practical problem sets & adjustments'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'english',
          description: 'CUET timed RC passages & verbal ability'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'business_studies',
          description: 'Consumer Protection Act & speedy revision'
        }
      },
      sunday: {
        dayKey: 'sunday',
        name: 'Sunday',
        primary: {
          id: 'primary',
          title: 'Primary Block',
          durationMinutes: 60,
          startTime: '07:00',
          endTime: '08:00',
          subject: 'general_test',
          description: 'Full Section III practice paper & speed drill'
        },
        secondary: {
          id: 'secondary',
          title: 'Secondary Block',
          durationMinutes: 45,
          startTime: '15:30',
          endTime: '16:15',
          subject: 'accountancy',
          description: 'Weekly error review & balance sheet master drill'
        },
        revision: {
          id: 'revision',
          title: 'Revision Block',
          durationMinutes: 30,
          startTime: '20:30',
          endTime: '21:00',
          subject: 'economics',
          description: 'Weekly key terms & formula notebook review'
        }
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

  /** Legacy seed IDs and mock samples shipped in early builds — strip on load so handoff starts clean. */
  stripLegacySeedData(state) {
    const seedMockIds = new Set(['mock_1', 'mock_2', 'mock_3', 'mock_4', 'mock_5']);
    const seedBacklogIds = new Set(['bl_sample_1']);
    if (Array.isArray(state.mocks)) {
      state.mocks = state.mocks.filter(m => !seedMockIds.has(m.id) && !String(m.id).startsWith('mock_sample') && !String(m.id).startsWith('test_'));
    }
    if (Array.isArray(state.backlog)) {
      state.backlog = state.backlog.filter(b => !seedBacklogIds.has(b.id) && !String(b.id).startsWith('bl_sample'));
    }
    if (state.planner && typeof state.planner === 'object') {
      Object.keys(state.planner).forEach(dateKey => {
        if (Array.isArray(state.planner[dateKey])) {
          state.planner[dateKey] = state.planner[dateKey].filter(t => !String(t.id).startsWith('task_sample') && !String(t.id).startsWith('sample_'));
        }
      });
    }
    return state;
  }

  resetToCleanState() {
    const def = this.getDefaultState();
    this.state = def;
    this.saveLocally(this.state);
    this.emit('change', this.state);
    this.pushToCloud();
    return this.state;
  }

  mergeWithDefault(existing) {
    const def = this.getDefaultState();
    const merged = {
      ...def,
      ...existing,
      weeklySchedule: (existing.weeklySchedule && typeof existing.weeklySchedule === 'object' && Object.keys(existing.weeklySchedule).length >= 7)
        ? existing.weeklySchedule
        : def.weeklySchedule,
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
    this.autoAssignDate(today, false);
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
        data: this.state || this.getDefaultState(),
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
    } else {
      // Auto-assign any pending unassigned task slots
      const pendingEmpty = this.state.planner[today].filter(t => t.status === 'pending' && (!t.subtopicId || t.topic === 'Add a topic from the queue'));
      if (pendingEmpty.length > 0) {
        this.autoAssignDate(today, false);
      }
    }

    this.saveLocally(this.state);
  }

  getDayOfWeek(dateStr) {
    if (!dateStr) dateStr = this.getTodayString();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return days[d.getDay()] || 'monday';
    }
    return 'monday';
  }

  getWeeklySchedule() {
    if (this.state && this.state.weeklySchedule && typeof this.state.weeklySchedule === 'object' && Object.keys(this.state.weeklySchedule).length >= 7) {
      return this.state.weeklySchedule;
    }
    return this.getDefaultWeeklySchedule();
  }

  updateWeeklySchedule(newWeeklySchedule) {
    this.updateState(state => {
      state.weeklySchedule = {
        ...(state.weeklySchedule || this.getDefaultWeeklySchedule()),
        ...newWeeklySchedule
      };
      return state;
    });
  }

  updateWeeklyDaySlot(dayKey, slotId, updates) {
    this.updateState(state => {
      if (!state.weeklySchedule) state.weeklySchedule = this.getDefaultWeeklySchedule();
      if (!state.weeklySchedule[dayKey]) state.weeklySchedule[dayKey] = {};
      if (!state.weeklySchedule[dayKey][slotId]) state.weeklySchedule[dayKey][slotId] = {};
      state.weeklySchedule[dayKey][slotId] = {
        ...state.weeklySchedule[dayKey][slotId],
        ...updates
      };
      return state;
    });
  }

  resetWeeklyScheduleDefaults() {
    const def = this.getDefaultWeeklySchedule();
    this.updateState(state => {
      state.weeklySchedule = JSON.parse(JSON.stringify(def));
      return state;
    });
  }

  /**
   * Rotational Auto-Assigner:
   * Finds the next uncompleted subtopic from the subject queue or syllabus.
   * Smartly skips subtopics that are completed or pre-marked as "Already Done".
   */
  getNextUncompletedTopic(subjectId, excludedIds = new Set()) {
    if (!subjectId) return null;

    // 1. Search in student rotational queues
    const queue = (this.state?.queues?.[subjectId] || []);
    for (const item of queue) {
      if (!item.isCompleted && !this.isSubtopicDone(item.id) && !excludedIds.has(item.id)) {
        return {
          id: item.id,
          title: item.title,
          unitTitle: item.unitTitle || (CONFIG.subjects[subjectId]?.name || 'Syllabus'),
          duration: item.duration || 45,
          subjectId: subjectId
        };
      }
    }

    // 2. Fallback to DEFAULT_SYLLABUS
    const sub = DEFAULT_SYLLABUS[subjectId];
    if (sub && Array.isArray(sub.units)) {
      for (const unit of sub.units) {
        for (const st of unit.subtopics) {
          if (!this.isSubtopicDone(st.id) && !excludedIds.has(st.id)) {
            return {
              id: st.id,
              title: st.title,
              unitTitle: unit.title,
              duration: st.minutes || 45,
              subjectId: subjectId
            };
          }
        }
      }
    }

    // 3. If all subtopics completed, provide a high-yield mastery recall topic
    const subjectName = CONFIG.subjects[subjectId]?.name || subjectId;
    return {
      id: null,
      title: `${subjectName} Master Revision & High-Yield CUET MCQs`,
      unitTitle: 'Mastery & Speed Recall (Queue Completed)',
      duration: 45,
      subjectId: subjectId
    };
  }

  generateTasksForDate(dateStr) {
    const dayOfWeek = this.getDayOfWeek(dateStr);
    const weeklySchedule = this.getWeeklySchedule();
    const dayConfig = weeklySchedule[dayOfWeek] || this.getDefaultWeeklySchedule()[dayOfWeek];

    const slotKeys = ['primary', 'secondary', 'revision'];
    const assignedIds = new Set();

    return slotKeys.map((slotKey, index) => {
      const slot = dayConfig?.[slotKey] || {
        id: slotKey,
        title: slotKey === 'primary' ? 'Primary Block' : slotKey === 'secondary' ? 'Secondary Block' : 'Revision Block',
        durationMinutes: slotKey === 'primary' ? 60 : slotKey === 'secondary' ? 45 : 30,
        startTime: slotKey === 'primary' ? '07:00' : slotKey === 'secondary' ? '15:30' : '20:30',
        endTime: slotKey === 'primary' ? '08:00' : slotKey === 'secondary' ? '16:15' : '21:00',
        subject: slotKey === 'primary' ? 'accountancy' : slotKey === 'secondary' ? 'business_studies' : 'economics'
      };

      const subjectKey = slot.subject || (slotKey === 'primary' ? 'accountancy' : slotKey === 'secondary' ? 'business_studies' : 'economics');
      const topicObj = this.getNextUncompletedTopic(subjectKey, assignedIds);
      if (topicObj?.id) {
        assignedIds.add(topicObj.id);
      }

      const duration = parseInt(slot.durationMinutes, 10) || (slotKey === 'primary' ? 60 : slotKey === 'secondary' ? 45 : 30);
      const subjectName = CONFIG.subjects[subjectKey]?.name || 'Commerce';

      return {
        id: `task_${Date.now()}_${index}`,
        blockId: slot.id || slotKey,
        blockTitle: `${slot.title || (slotKey === 'primary' ? 'Primary Block' : slotKey === 'secondary' ? 'Secondary Block' : 'Revision Block')} (${duration}m)`,
        duration: duration,
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
        subject: subjectName,
        subjectId: subjectKey,
        topic: topicObj ? topicObj.title : 'Add a topic from the queue',
        unitTitle: topicObj ? topicObj.unitTitle : 'Select from syllabus',
        subtopicId: topicObj?.id || null,
        status: 'pending',
        scheduledDate: dateStr,
        completedAt: null,
        autoAssigned: Boolean(topicObj?.id)
      };
    });
  }

  autoAssignDate(dateStr, force = false) {
    if (!dateStr) dateStr = this.getTodayString();
    const dayOfWeek = this.getDayOfWeek(dateStr);
    const weeklySchedule = this.getWeeklySchedule();
    const dayConfig = weeklySchedule[dayOfWeek] || this.getDefaultWeeklySchedule()[dayOfWeek];

    const todayTasks = this.state.planner?.[dateStr] || [];
    const hasDoneTasks = todayTasks.some(t => t.status === 'done');

    if (hasDoneTasks && !force) {
      // Preserve completed tasks, only auto-assign pending blocks
      const assignedIds = new Set();
      todayTasks.forEach(t => { if (t.subtopicId) assignedIds.add(t.subtopicId); });

      this.updateState(state => {
        if (!state.planner) state.planner = {};
        const tasks = state.planner[dateStr] || [];
        ['primary', 'secondary', 'revision'].forEach(slotKey => {
          let task = tasks.find(t => t.blockId === slotKey);
          const slot = dayConfig?.[slotKey];
          if (!slot) return;
          const subjectKey = slot.subject;

          if (task && task.status === 'pending') {
            const topicObj = this.getNextUncompletedTopic(subjectKey, assignedIds);
            if (topicObj) {
              if (topicObj.id) assignedIds.add(topicObj.id);
              task.subjectId = subjectKey;
              task.subject = CONFIG.subjects[subjectKey]?.name || subjectKey;
              task.topic = topicObj.title;
              task.unitTitle = topicObj.unitTitle;
              task.subtopicId = topicObj.id;
              task.duration = parseInt(slot.durationMinutes, 10) || task.duration;
              task.blockTitle = `${slot.title} (${task.duration}m)`;
              task.autoAssigned = true;
            }
          } else if (!task) {
            const topicObj = this.getNextUncompletedTopic(subjectKey, assignedIds);
            if (topicObj?.id) assignedIds.add(topicObj.id);
            tasks.push({
              id: `task_${Date.now()}_${slotKey}`,
              blockId: slotKey,
              blockTitle: `${slot.title} (${slot.durationMinutes}m)`,
              duration: parseInt(slot.durationMinutes, 10) || 45,
              startTime: slot.startTime || '',
              endTime: slot.endTime || '',
              subject: CONFIG.subjects[subjectKey]?.name || 'Commerce',
              subjectId: subjectKey,
              topic: topicObj ? topicObj.title : 'Add a topic from the queue',
              unitTitle: topicObj ? topicObj.unitTitle : 'Select from syllabus',
              subtopicId: topicObj?.id || null,
              status: 'pending',
              scheduledDate: dateStr,
              completedAt: null,
              autoAssigned: Boolean(topicObj?.id)
            });
          }
        });
        state.planner[dateStr] = tasks;
        return state;
      });
      return;
    }

    // Fresh generation for date
    const freshTasks = this.generateTasksForDate(dateStr);
    this.updateState(state => {
      if (!state.planner) state.planner = {};
      state.planner[dateStr] = freshTasks;
      return state;
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
