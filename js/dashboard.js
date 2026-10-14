/**
 * Progress & Dynamic ETA Dashboard
 * Live 93%+ Board target progress indicator, dynamic completion ETA,
 * pace simulator slider, and subject completion breakdown.
 */
class DashboardController {
  constructor() {
    this.boardTarget = 93; // 93%+ board target
    this.simulatedPace = 2.2; // daily topics
    this.init();
  }

  init() {
    Storage.on('change', () => this.render());
  }

  setBoardTarget(targetVal) {
    this.boardTarget = parseInt(targetVal, 10) || 93;
    const state = Storage.getState();
    state.targetPercentage = this.boardTarget;
    Storage.updateState(state);
  }

  setPace(paceVal) {
    this.simulatedPace = parseFloat(paceVal) || 2.0;
    this.render();
  }

  calculateStatistics() {
    const state = Storage.getState();
    const progressMap = state.syllabusProgress || {};

    // Count all subtopics across all subjects
    let totalSubtopics = 0;
    let completedSubtopics = 0;
    const subjectStats = {};

    Object.keys(DEFAULT_SYLLABUS).forEach(subKey => {
      const sub = DEFAULT_SYLLABUS[subKey];
      let subTotal = 0;
      let subCompleted = 0;

      sub.units.forEach(u => {
        u.subtopics.forEach(st => {
          subTotal++;
          if (progressMap[st.id]?.completed) {
            subCompleted++;
          }
        });
      });

      totalSubtopics += subTotal;
      completedSubtopics += subCompleted;

      subjectStats[subKey] = {
        name: sub.title,
        total: subTotal,
        completed: subCompleted,
        percentage: subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0
      };
    });

    const overallPct = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;
    const remainingSubtopics = Math.max(0, totalSubtopics - completedSubtopics);

    // Dynamic ETA calculation
    const pace = this.simulatedPace || 2.2;
    const daysNeeded = Math.ceil(remainingSubtopics / pace);
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + daysNeeded);

    // Exam countdowns
    const today = new Date();
    const boardDate = new Date('2027-02-15T00:00:00');
    const cuetDate = new Date('2027-05-15T00:00:00');

    const daysToBoard = Math.max(0, Math.ceil((boardDate - today) / (1000 * 60 * 60 * 24)));
    const daysToCuet = Math.max(0, Math.ceil((cuetDate - today) / (1000 * 60 * 60 * 24)));

    // Total hours logged from completed planner tasks
    let totalMinutesLogged = 0;
    Object.values(state.planner || {}).forEach(dayTasks => {
      if (Array.isArray(dayTasks)) {
        dayTasks.forEach(t => {
          if (t.status === 'done') {
            totalMinutesLogged += (t.duration || 45);
          }
        });
      }
    });

    // Add time from mocks
    (state.mocks || []).forEach(m => {
      totalMinutesLogged += (m.timeTaken || 45);
    });

    const totalHours = (totalMinutesLogged / 60).toFixed(1);

    // Calculate average mock test score %
    const mocks = state.mocks || [];
    let avgMockPct = 0;
    if (mocks.length > 0) {
      const sumPct = mocks.reduce((acc, m) => acc + (m.score / m.maxScore) * 100, 0);
      avgMockPct = Math.round(sumPct / mocks.length);
    }

    return {
      totalSubtopics,
      completedSubtopics,
      remainingSubtopics,
      overallPct,
      daysNeeded,
      etaDate,
      daysToBoard,
      daysToCuet,
      totalHours,
      avgMockPct,
      subjectStats
    };
  }

  render() {
    const container = document.getElementById('dashboard-view-container');
    if (!container) return;

    const stats = this.calculateStatistics();
    const state = Storage.getState();
    const target = this.boardTarget;

    const etaFormatted = stats.etaDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Check if on pace for Board exam
    const isOnTrackForBoard = stats.daysNeeded <= stats.daysToBoard;

    let html = `
      <!-- Main Target & ETA Hero Banner -->
      <div class="dashboard-hero-card card">
        <div class="hero-top-bar">
          <div class="hero-title-group">
            <span class="hero-badge"><i data-lucide="crosshair"></i> Board & CUET Mission</span>
            <h2>Target: ${target}%+ Benchmark</h2>
          </div>
          <div class="target-selector-pills">
            ${[90, 93, 95, 98].map(val => `
              <button class="pill-target ${val === target ? 'active' : ''}" onclick="Dashboard.setBoardTarget(${val})">
                ${val}%
              </button>
            `).join('')}
          </div>
        </div>

        <div class="hero-content-grid">
          <div class="hero-left-metrics">
            <div class="big-progress-circle-wrap">
              <div class="stat-progress-val">${stats.overallPct}%</div>
              <div class="stat-progress-sub">Syllabus Mastered</div>
            </div>
            <div class="pace-status-pill ${isOnTrackForBoard ? 'pace-healthy' : 'pace-warning'}">
              <i data-lucide="${isOnTrackForBoard ? 'check-circle' : 'alert-circle'}"></i>
              ${isOnTrackForBoard ? `On track for ${target}%+ board & top CUET percentile` : `Pace boost recommended`}
            </div>
          </div>

          <div class="hero-right-eta">
            <div class="eta-box">
              <span class="eta-label"><i data-lucide="calendar"></i> Projected Syllabus Completion</span>
              <div class="eta-date-highlight">${etaFormatted}</div>
              <p class="eta-description">At current pace of <strong>${this.simulatedPace}</strong> topics/day (${stats.daysNeeded} days remaining to finish ${stats.remainingSubtopics} topics).</p>
            </div>

            <!-- Dynamic Pace Simulator Slider -->
            <div class="pace-simulator-widget">
              <div class="pace-slider-header">
                <span><i data-lucide="sliders"></i> Dynamic Pace Simulator:</span>
                <strong>${this.simulatedPace} topics/day</strong>
              </div>
              <input type="range" min="1.0" max="5.0" step="0.2" value="${this.simulatedPace}" class="pace-range-slider" oninput="Dashboard.setPace(this.value)">
              <div class="pace-slider-scale">
                <span>1.0/day</span>
                <span>2.2 (Default)</span>
                <span>3.5/day</span>
                <span>5.0/day</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Exam Countdowns & Hours Logged Grid -->
      <div class="dashboard-stats-grid">
        <div class="dash-stat-card card">
          <div class="card-icon-tag"><i data-lucide="clock"></i></div>
          <div class="dash-stat-body">
            <span class="stat-meta">Total Focused Study</span>
            <div class="stat-number">${stats.totalHours} <span class="stat-unit">hrs</span></div>
            <p class="stat-hint">Across daily blocks & mock test sessions</p>
          </div>
        </div>

        <div class="dash-stat-card card">
          <div class="card-icon-tag"><i data-lucide="book-open"></i></div>
          <div class="dash-stat-body">
            <span class="stat-meta">Class 12 Boards</span>
            <div class="stat-number">${stats.daysToBoard} <span class="stat-unit">days</span></div>
            <p class="stat-hint">Target score: 93%+ aggregate</p>
          </div>
        </div>

        <div class="dash-stat-card card">
          <div class="card-icon-tag"><i data-lucide="compass"></i></div>
          <div class="dash-stat-body">
            <span class="stat-meta">CUET UG 2027</span>
            <div class="stat-number">${stats.daysToCuet} <span class="stat-unit">days</span></div>
            <p class="stat-hint">SRCC / Hindu / Top Commerce Cutoff</p>
          </div>
        </div>

        <div class="dash-stat-card card">
          <div class="card-icon-tag"><i data-lucide="award"></i></div>
          <div class="dash-stat-body">
            <span class="stat-meta">Average Mock Score</span>
            <div class="stat-number text-emerald">${stats.avgMockPct}%</div>
            <p class="stat-hint">${state.mocks ? state.mocks.length : 0} mocks attempted so far</p>
          </div>
        </div>
      </div>

      <!-- Subject-Wise Mastery Breakdown -->
      <div class="section-title-row">
        <h3><i data-lucide="bar-chart-2"></i> Subject Mastery & Progress</h3>
        <span class="queue-count-badge">5 Core CUET Subjects</span>
      </div>

      <div class="subject-breakdown-stack">
    `;

    Object.keys(CONFIG.subjects).forEach(subKey => {
      const sub = CONFIG.subjects[subKey];
      const data = stats.subjectStats[subKey] || { total: 0, completed: 0, percentage: 0 };

      html += `
        <div class="subject-progress-card card">
          <div class="subject-prog-top">
            <div class="subject-prog-title">
              <span class="prog-dot" style="background-color: ${sub.color};"></span>
              <h4>${sub.name}</h4>
              <span class="prog-grade-tag">${sub.grade}</span>
            </div>
            <div class="subject-prog-stats">
              <strong>${data.completed}</strong> of ${data.total} topics (${data.percentage}%)
            </div>
          </div>

          <div class="subject-prog-track">
            <div class="subject-prog-fill" style="width: ${data.percentage}%; background-color: ${sub.color};"></div>
          </div>

          <div class="subject-prog-footer">
            <button class="btn-prog-action" onclick="App.navigateToSyllabusSubject('${subKey}')">
              View Syllabus & Queue <i data-lucide="arrow-right"></i>
            </button>
            <button class="btn-prog-mock" onclick="Mocks.openLogMockModal('${subKey}')">
              + Log ${sub.code} Mock
            </button>
          </div>
        </div>
      `;
    });

    html += `
      </div>

      <!-- Data Management & Cloud Actions -->
      <div class="data-mgmt-card card">
        <div class="data-mgmt-info">
          <h4><i data-lucide="database"></i> Data Sovereignty & Cloud Status</h4>
          <p>Your study plan is continuously saved locally and synced with Supabase. You can also export full JSON backups.</p>
        </div>
        <div class="data-mgmt-actions">
          <button class="btn-backup-export" onclick="Storage.exportBackupJson()">
            <i data-lucide="download"></i> Export JSON Backup
          </button>
          <label class="btn-backup-import">
            <i data-lucide="upload"></i> Restore from JSON
            <input type="file" accept=".json" style="display:none" onchange="App.handleBackupUpload(this)">
          </label>
          <button class="btn-sync-trigger" onclick="Storage.pushToCloud()">
            <i data-lucide="refresh-cw"></i> Force Cloud Sync
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

window.Dashboard = new DashboardController();
