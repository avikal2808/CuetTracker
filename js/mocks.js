/**
 * Smart Mock Test Tracker
 * Fixed 5 CUET Subjects: Accountancy, Business Studies, Economics, English, General Test
 * Auto-incrementing mock numbers, timestamps, score inputs, and performance analytics.
 */
class MocksController {
  constructor() {
    this.selectedSubjectFilter = 'all';
    this.chartInstance = null;

    this.init();
  }

  init() {
    Storage.on('change', () => this.render());
  }

  setSubjectFilter(filter) {
    this.selectedSubjectFilter = filter;
    this.render();
  }

  getNextMockNumber(subjectId) {
    const state = Storage.getState();
    const subjectMocks = (state.mocks || []).filter(m => m.subjectId === subjectId);
    if (subjectMocks.length === 0) return 1;
    const maxNum = Math.max(...subjectMocks.map(m => Number(m.mockNumber) || 0));
    return maxNum + 1;
  }

  openLogMockModal(preSelectedSubject) {
    const state = Storage.getState();
    const modal = document.getElementById('log-mock-modal');
    if (!modal) return;

    const subjectSelect = document.getElementById('mock-subject-select');
    const mockNumberInput = document.getElementById('mock-number-input');
    const maxScoreInput = document.getElementById('mock-max-score-input');
    const dateInput = document.getElementById('mock-date-input');

    const subjectKey = preSelectedSubject || (this.selectedSubjectFilter !== 'all' ? this.selectedSubjectFilter : 'accountancy');

    if (subjectSelect) subjectSelect.value = subjectKey;
    if (mockNumberInput) mockNumberInput.value = this.getNextMockNumber(subjectKey);
    if (maxScoreInput) maxScoreInput.value = CONFIG.subjects[subjectKey]?.cuetMaxScore || 200;
    if (dateInput) dateInput.value = Storage.getTodayString();

    // Reset other fields
    const scoreInput = document.getElementById('mock-score-input');
    const timeInput = document.getElementById('mock-time-input');
    const accuracyInput = document.getElementById('mock-accuracy-input');
    const mistakesInput = document.getElementById('mock-mistakes-input');
    const notesInput = document.getElementById('mock-notes-input');

    if (scoreInput) scoreInput.value = '';
    if (timeInput) timeInput.value = '45';
    if (accuracyInput) accuracyInput.value = '90';
    if (mistakesInput) mistakesInput.value = '';
    if (notesInput) notesInput.value = '';

    modal.classList.add('active');
  }

  closeLogMockModal() {
    const modal = document.getElementById('log-mock-modal');
    if (modal) modal.classList.remove('active');
  }

  handleSubjectChangeInModal(subjectKey) {
    const mockNumberInput = document.getElementById('mock-number-input');
    const maxScoreInput = document.getElementById('mock-max-score-input');

    if (mockNumberInput) {
      mockNumberInput.value = this.getNextMockNumber(subjectKey);
    }
    if (maxScoreInput) {
      maxScoreInput.value = CONFIG.subjects[subjectKey]?.cuetMaxScore || 200;
    }
  }

  saveMockEntry() {
    const subjectSelect = document.getElementById('mock-subject-select');
    const mockNumberInput = document.getElementById('mock-number-input');
    const dateInput = document.getElementById('mock-date-input');
    const scoreInput = document.getElementById('mock-score-input');
    const maxScoreInput = document.getElementById('mock-max-score-input');
    const timeInput = document.getElementById('mock-time-input');
    const accuracyInput = document.getElementById('mock-accuracy-input');
    const mistakesInput = document.getElementById('mock-mistakes-input');
    const notesInput = document.getElementById('mock-notes-input');

    const subjectId = subjectSelect.value;
    const score = parseFloat(scoreInput.value);
    const maxScore = parseFloat(maxScoreInput.value) || 200;

    if (isNaN(score) || score < 0 || score > maxScore) {
      if (window.App) window.App.showToast(`Please enter a valid score between 0 and ${maxScore}`, 'error');
      return;
    }

    const state = Storage.getState();
    const newMock = {
      id: `mock_${Date.now()}`,
      subjectId: subjectId,
      subjectName: CONFIG.subjects[subjectId]?.name || subjectId,
      mockNumber: parseInt(mockNumberInput.value, 10) || this.getNextMockNumber(subjectId),
      date: dateInput.value || Storage.getTodayString(),
      score: score,
      maxScore: maxScore,
      timeTaken: parseInt(timeInput.value, 10) || 45,
      accuracy: parseInt(accuracyInput.value, 10) || Math.round((score / maxScore) * 100),
      mistakes: (mistakesInput.value || '').trim(),
      notes: (notesInput.value || '').trim(),
      loggedAt: new Date().toISOString()
    };

    if (!state.mocks) state.mocks = [];
    state.mocks.unshift(newMock);

    Storage.updateState(state);
    this.closeLogMockModal();

    if (window.confetti) {
      window.confetti({ particleCount: 40, spread: 50, colors: ['#4F8A68', '#4F9D69', '#35634A'] });
    }

    if (window.App) {
      window.App.showToast(`Mock #${newMock.mockNumber} for ${newMock.subjectName} logged (${score}/${maxScore})!`, 'success');
    }
  }

  deleteMock(mockId) {
    if (!confirm('Are you sure you want to delete this mock log?')) return;
    const state = Storage.getState();
    state.mocks = (state.mocks || []).filter(m => m.id !== mockId);
    Storage.updateState(state);
    if (window.App) {
      window.App.showToast('Mock test record removed.', 'info');
    }
  }

  renderChart(filteredMocks) {
    const canvas = document.getElementById('mock-trend-canvas');
    if (!canvas || !window.Chart) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Sort chronologically
    const sorted = [...filteredMocks].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sorted.map(m => `${m.subjectName.split(' ')[0]} #${m.mockNumber}`);
    const percentages = sorted.map(m => Math.round((m.score / m.maxScore) * 100));

    const ctx = canvas.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Score Percentage (%)',
            data: percentages,
            borderColor: '#4F8A68',
            backgroundColor: 'rgba(79, 138, 104, 0.12)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#35634A',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: '93% Board/CUET Benchmark',
            data: labels.map(() => 93),
            borderColor: '#D69A3A',
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const item = sorted[context.dataIndex];
                if (context.datasetIndex === 0 && item) {
                  return `Score: ${item.score}/${item.maxScore} (${context.parsed.y}%)`;
                }
                return `${context.dataset.label}: ${context.parsed.y}%`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 50,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            },
            grid: { color: '#E1E5DF' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  render() {
    const container = document.getElementById('mocks-view-container');
    if (!container) return;

    const state = Storage.getState();
    const mocks = state.mocks || [];

    // Filter mocks
    const filtered = this.selectedSubjectFilter === 'all'
      ? mocks
      : mocks.filter(m => m.subjectId === this.selectedSubjectFilter);

    // Compute key statistics
    const totalAttempted = filtered.length;
    let avgPercentage = 0;
    let highestScoreItem = null;

    if (totalAttempted > 0) {
      const sumPct = filtered.reduce((acc, m) => acc + (m.score / m.maxScore) * 100, 0);
      avgPercentage = Math.round(sumPct / totalAttempted);
      highestScoreItem = filtered.reduce((max, m) => {
        const pct = (m.score / m.maxScore);
        const maxPct = (max.score / max.maxScore);
        return pct > maxPct ? m : max;
      }, filtered[0]);
    }

    let html = `
      <div class="mocks-header-card card">
        <div class="mocks-header-top">
          <div>
            <h2>CUET Mock Test Tracker</h2>
            <p class="section-subtitle">Track scores across 5 core CUET subjects & analyze performance trends.</p>
          </div>
          <button class="btn-log-mock-primary" onclick="Mocks.openLogMockModal()">
            <i data-lucide="plus-circle"></i> Log Mock Test
          </button>
        </div>

        <div class="mock-stats-row">
          <div class="metric-chip">
            <span class="metric-label">Mocks Completed</span>
            <span class="metric-value"><strong>${totalAttempted}</strong> Tests</span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Average Score</span>
            <span class="metric-value ${avgPercentage >= 90 ? 'text-emerald' : 'text-amber'}"><strong>${avgPercentage}%</strong></span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Personal Best</span>
            <span class="metric-value text-emerald">
              <strong>${highestScoreItem ? `${highestScoreItem.score}/${highestScoreItem.maxScore}` : 'N/A'}</strong>
            </span>
          </div>
          <div class="metric-chip">
            <span class="metric-label">Target Benchmark</span>
            <span class="metric-value"><strong>93%+</strong></span>
          </div>
        </div>
      </div>

      <!-- Subject Filter Tabs -->
      <div class="mock-subject-filter-bar">
        <button class="filter-tab ${this.selectedSubjectFilter === 'all' ? 'active' : ''}" onclick="Mocks.setSubjectFilter('all')">
          All Subjects (${mocks.length})
        </button>
    `;

    Object.keys(CONFIG.subjects).forEach(subKey => {
      const sub = CONFIG.subjects[subKey];
      const count = mocks.filter(m => m.subjectId === subKey).length;
      html += `
        <button class="filter-tab ${this.selectedSubjectFilter === subKey ? 'active' : ''}" onclick="Mocks.setSubjectFilter('${subKey}')">
          ${sub.code} (${count})
        </button>
      `;
    });

    html += `
      </div>

      <!-- Trend Chart Section -->
      <div class="mock-chart-card card">
        <div class="chart-header-row">
          <h3><i data-lucide="trending-up"></i> Score Trajectory & 93% Target Line</h3>
          <span class="chart-tag">Real-time Progression</span>
        </div>
        <div class="chart-container-box">
          <canvas id="mock-trend-canvas"></canvas>
        </div>
      </div>

      <!-- Mock Logs History Cards -->
      <div class="section-title-row">
        <h3><i data-lucide="clipboard-list"></i> Mock Log History</h3>
        <span class="queue-count-badge">${filtered.length} Recorded</span>
      </div>

      <div class="mock-cards-stack">
    `;

    if (filtered.length === 0) {
      html += `
        <div class="empty-state-card card">
          <i data-lucide="award" class="empty-icon text-emerald"></i>
          <h4>No mock tests recorded yet</h4>
          <p>Complete a timed mock test and click "Log Mock Test" to view your analytics trajectory.</p>
        </div>
      `;
    } else {
      filtered.forEach(mock => {
        const pct = Math.round((mock.score / mock.maxScore) * 100);
        const isTargetMet = pct >= 93;

        html += `
          <div class="mock-record-card card">
            <div class="mock-card-left">
              <div class="mock-subject-badge ${mock.subjectId}">
                ${mock.subjectName}
              </div>
              <div class="mock-title-row">
                <h4>Mock #${mock.mockNumber}</h4>
                <span class="mock-date-tag"><i data-lucide="calendar"></i> ${mock.date}</span>
                <span class="mock-time-tag"><i data-lucide="clock"></i> ${mock.timeTaken}m</span>
              </div>

              ${mock.mistakes ? `
                <div class="mock-mistake-box">
                  <span class="mistake-label"><i data-lucide="alert-circle"></i> Weak Areas / Mistakes:</span>
                  <p class="mistake-text">${mock.mistakes}</p>
                </div>
              ` : ''}

              ${mock.notes ? `
                <p class="mock-notes-text"><i data-lucide="message-square"></i> ${mock.notes}</p>
              ` : ''}
            </div>

            <div class="mock-card-right">
              <div class="score-display-box ${isTargetMet ? 'target-met' : ''}">
                <div class="score-main">${mock.score}<span class="score-max">/${mock.maxScore}</span></div>
                <div class="score-pct-badge ${isTargetMet ? 'badge-success' : 'badge-warning'}">
                  ${pct}% Accuracy
                </div>
              </div>
              <button class="btn-delete-mock" onclick="Mocks.deleteMock('${mock.id}')" title="Delete entry">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`; // Close mock-cards-stack

    container.innerHTML = html;

    // Render chart
    setTimeout(() => {
      this.renderChart(filtered);
    }, 50);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

window.Mocks = new MocksController();
