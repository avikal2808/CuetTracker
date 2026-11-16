/**
 * Syllabus & Queue Controller
 * Rotational Queues, Pre-marking subtopics as "Already Done",
 * and Photo-Upload / Text-Import parser.
 */
class QueueController {
  constructor() {
    this.selectedSubject = Storage.getDefaultSubjectId();
    this.filterState = 'all'; // 'all', 'pending', 'completed'
    this.searchQuery = '';
    this.parsedTopicsPreview = [];

    this.init();
  }

  init() {
    Storage.on('change', () => this.render());
  }

  setSubject(subjectKey) {
    this.selectedSubject = subjectKey;
    this.render();
  }

  setFilter(filter) {
    this.filterState = filter;
    this.render();
  }

  setSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.render();
  }

  /**
   * Pre-mark or unmark future subtopic as "Already Done"
   * Without breaking the rotational schedule!
   */
  toggleSubtopicDone(subtopicId, preMarked = true) {
    const state = Storage.getState();
    if (!state.syllabusProgress) state.syllabusProgress = {};

    const currentStatus = state.syllabusProgress[subtopicId]?.completed;
    const newStatus = !currentStatus;

    state.syllabusProgress[subtopicId] = {
      completed: newStatus,
      completedAt: newStatus ? new Date().toISOString() : null,
      preMarked: preMarked
    };

    Storage.updateState(state);

    if (window.App) {
      if (newStatus) {
        window.App.showToast(`Pre-marked as "Already Done". Rotational queue updated!`, 'success');
      } else {
        window.App.showToast(`Restored to upcoming study queue.`, 'info');
      }
    }
  }

  queueTopicForToday(subtopic, subjectId, unitTitle) {
    const today = Storage.getTodayString();
    const state = Storage.getState();
    const tasks = Storage.ensureDaySchedule(today);

    // Find first unassigned pending block
    let targetTask = tasks.find(t => t.status === 'pending' && !t.subtopicId);

    // If none unassigned, find by matching subjectId
    if (!targetTask) {
      targetTask = tasks.find(t => t.status === 'pending' && t.subjectId === subjectId);
    }

    if (targetTask) {
      targetTask.topic = subtopic.title;
      targetTask.subject = Storage.getSubjectName(subjectId) || subjectId;
      targetTask.subjectId = subjectId;
      targetTask.unitTitle = unitTitle;
      targetTask.subtopicId = subtopic.id;
      targetTask.duration = subtopic.minutes || 45;
      targetTask.autoAssigned = true;
    } else {
      // Append a new free-form block
      tasks.push(Storage.buildBlock(today, {
        subjectId: subjectId,
        topic: subtopic.title,
        unitTitle: unitTitle,
        subtopicId: subtopic.id,
        duration: subtopic.minutes || 45,
        autoAssigned: true
      }));
    }

    Storage.updateState(state);
    if (window.App) {
      window.App.showToast(`Added to Today's planner!`, 'success');
      window.App.navigateToTab('planner');
    }
  }

  moveQueueItem(subjectId, index, direction) {
    const state = Storage.getState();
    const queue = state.queues[subjectId] || [];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= queue.length) return;

    const [moved] = queue.splice(index, 1);
    queue.splice(newIndex, 0, moved);

    Storage.updateState(state);
  }

  toggleQueuePriority(subjectId, itemId) {
    const state = Storage.getState();
    const queue = state.queues[subjectId] || [];
    const item = queue.find(i => i.id === itemId);
    if (item) {
      item.priority = item.priority === 'high' ? 'normal' : 'high';
      Storage.updateState(state);
    }
  }

  // --- Photo & Text Parser Logic ---
  openParserModal() {
    this.parsedTopicsPreview = [];
    const modal = document.getElementById('parser-modal');
    if (modal) {
      modal.classList.add('active');
      this.renderParserPreview();
    }
  }

  closeParserModal() {
    const modal = document.getElementById('parser-modal');
    if (modal) modal.classList.remove('active');
  }

  handleTextParserInput(rawText, subjectId) {
    if (!rawText || !rawText.trim()) {
      this.parsedTopicsPreview = [];
      this.renderParserPreview();
      return;
    }

    const targetSubject = subjectId || this.selectedSubject;
    const existingTitles = this.getExistingTopicTitles(targetSubject);

    // Split lines, clean up numbering, bullets, roman numerals
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const cleaned = [];

    lines.forEach((line, idx) => {
      // Strip leading bullets, numbering like "1.", "1.1", "a)", "(i)", "-", "•"
      let text = line.replace(/^([0-9]+(\.[0-9]+)*\s*|[a-z]\)\s*|\([ivxlcdm]+\)\s*|[-*•–]\s*)/i, '').trim();
      if (text.length > 2) {
        // Detect estimated duration or default
        let duration = 45;
        if (/numerical|problem|calculation|case study|cash flow|ratios/i.test(text)) {
          duration = 60;
        } else if (/revision|mcq|recall|overview|meaning/i.test(text)) {
          duration = 30;
        }

        const status = this.matchExistingTitle(text, existingTitles) ? 'matched' : 'new';
        cleaned.push({
          id: `custom_${Date.now()}_${idx}`,
          title: text,
          unit: 'Imported Topics',
          duration: duration,
          subjectId: targetSubject,
          selected: status === 'new',
          status: status
        });
      }
    });

    this.parsedTopicsPreview = cleaned;
    this.renderParserPreview();
  }

  /** Every topic title already in a subject's syllabus, for duplicate detection. */
  getExistingTopicTitles(subjectId) {
    const syllabusObj = Storage.getSubjectSyllabus(subjectId);
    const titles = [];
    (syllabusObj?.units || []).forEach(unit => {
      (unit.subtopics || []).forEach(st => titles.push(st.title));
    });
    return titles;
  }

  /** Normalise a title so "Ch. 4 Cash Flow" and "4. cash-flow" compare equal. */
  normalizeTopicTitle(title) {
    return String(title)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\b(?:ch|chapter|unit|part)\.?\s*\d+/g, ' ')
      .replace(/\b\d+(?:\.\d+)*\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Sørensen–Dice similarity of two strings' bigrams (0..1). */
  diceCoefficient(a, b) {
    if (!a || !b) return 0;
    const bigrams = str => {
      const out = new Map();
      for (let i = 0; i < str.length - 1; i++) {
        const gram = str.slice(i, i + 2);
        out.set(gram, (out.get(gram) || 0) + 1);
      }
      return out;
    };
    const aGrams = bigrams(a);
    const bGrams = bigrams(b);
    if (aGrams.size === 0 || bGrams.size === 0) return 0;
    let overlap = 0;
    aGrams.forEach((count, gram) => {
      if (bGrams.has(gram)) overlap += Math.min(count, bGrams.get(gram));
    });
    return (2 * overlap) / (a.length - 1 + b.length - 1);
  }

  /** True when a title already exists in the subject (exact or fuzzy match). */
  matchExistingTitle(title, existingTitles) {
    const norm = this.normalizeTopicTitle(title);
    if (!norm) return false;
    return existingTitles.some(existing => {
      const otherNorm = this.normalizeTopicTitle(existing);
      if (!otherNorm) return false;
      if (norm === otherNorm) return true;
      if (norm.length < 4 || otherNorm.length < 4) return false;
      return this.diceCoefficient(norm, otherNorm) >= 0.87;
    });
  }

  /** Turn the AI's extracted topics into review rows, flagging new vs matched. */
  applyExtractedTopics(topics, subjectId) {
    const targetSubject = subjectId || this.selectedSubject;
    const existingTitles = this.getExistingTopicTitles(targetSubject);

    this.parsedTopicsPreview = (topics || [])
      .filter(t => t && t.title && String(t.title).trim().length > 1)
      .map((t, idx) => {
        const title = String(t.title).trim();
        const unit = (t.unit && String(t.unit).trim()) || 'Imported Topics';
        const status = this.matchExistingTitle(title, existingTitles) ? 'matched' : 'new';
        return {
          id: `ai_${Date.now()}_${idx}`,
          title: title,
          unit: unit,
          duration: Number(t.minutes) > 0 ? Number(t.minutes) : 45,
          subjectId: targetSubject,
          selected: status === 'new',
          status: status
        };
      });

    this.renderParserPreview();
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async handlePhotoUpload(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const previewImg = document.getElementById('parser-photo-preview');
    const statusMsg = document.getElementById('parser-photo-status');
    if (previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = 'block';
    }

    if (statusMsg) {
      statusMsg.innerHTML = `<span class="spinner-inline"></span> Sending the photo to the AI syllabus reader...`;
    }

    const subjectId = document.getElementById('parser-subject-select')?.value || this.selectedSubject;

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const response = await fetch('/api/extract-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mimeType: file.type || 'image/jpeg' })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `The AI reader failed (${response.status}).`);
      }

      this.applyExtractedTopics(payload.topics || [], subjectId);

      if (statusMsg) {
        if (this.parsedTopicsPreview.length > 0) {
          const newCount = this.parsedTopicsPreview.filter(t => t.status === 'new').length;
          statusMsg.innerHTML = `<span class="text-emerald"><i data-lucide="check-circle-2"></i> Found ${this.parsedTopicsPreview.length} topic(s) — ${newCount} new. Review below.</span>`;
        } else {
          statusMsg.innerHTML = `<span class="text-amber"><i data-lucide="alert-circle"></i> No syllabus topics were detected in that photo. Try a clearer shot or paste the text instead.</span>`;
        }
      }
    } catch (err) {
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-error"><i data-lucide="alert-triangle"></i> ${err.message || 'Could not read that image.'}</span>`;
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  toggleParsedItem(index) {
    if (this.parsedTopicsPreview[index]) {
      this.parsedTopicsPreview[index].selected = !this.parsedTopicsPreview[index].selected;
      this.renderParserPreview();
    }
  }

  commitParsedTopicsToQueue() {
    const selected = this.parsedTopicsPreview.filter(t => t.selected);
    if (selected.length === 0) {
      if (window.App) window.App.showToast('Please select at least one topic to import.', 'warning');
      return;
    }

    const state = Storage.getState();
    const subjectId = selected[0].subjectId || this.selectedSubject;
    if (!state.queues[subjectId]) state.queues[subjectId] = [];

    // Imported topics also join the student-owned syllabus so they count toward
    // progress and show up in the master checklist — not just the queue.
    if (!state.syllabus || typeof state.syllabus !== 'object') state.syllabus = Storage.getSyllabus();
    if (!state.syllabus[subjectId]) {
      state.syllabus[subjectId] = {
        id: subjectId,
        title: Storage.getSubjectName(subjectId) || subjectId,
        units: []
      };
    }
    const syllabusSubject = state.syllabus[subjectId];
    if (!Array.isArray(syllabusSubject.units)) syllabusSubject.units = [];

    // Skip anything the subject syllabus already has (exact or fuzzy title match).
    const existingTitles = this.getExistingTopicTitles(subjectId);

    let addedCount = 0;
    selected.forEach(t => {
      if (this.matchExistingTitle(t.title, existingTitles)) return;

      const unitTitle = t.unit || 'Imported Topics';
      state.queues[subjectId].unshift({
        id: t.id,
        subjectId: subjectId,
        subjectName: Storage.getSubjectName(subjectId) || subjectId,
        unitTitle: unitTitle,
        title: t.title,
        duration: t.duration,
        priority: 'high'
      });

      let unit = syllabusSubject.units.find(u => u.title === unitTitle);
      if (!unit) {
        unit = { title: unitTitle, subtopics: [] };
        syllabusSubject.units.push(unit);
      }
      unit.subtopics.push({ id: t.id, title: t.title, minutes: t.duration });
      existingTitles.push(t.title);
      addedCount++;
    });

    Storage.updateState(state);
    this.closeParserModal();
    if (window.App) {
      if (addedCount === 0) {
        window.App.showToast('Those topics are already in the syllabus — progress preserved.', 'info');
      } else {
        window.App.showToast(`Imported ${addedCount} new topic(s) into ${Storage.getSubjectName(subjectId)}!`, 'success');
      }
    }
  }

  renderParserPreview() {
    const listEl = document.getElementById('parsed-items-list');
    const commitBtn = document.getElementById('btn-commit-parsed');
    if (!listEl) return;

    if (this.parsedTopicsPreview.length === 0) {
      listEl.innerHTML = `<p class="empty-hint">Paste text or upload an image above to parse topics automatically.</p>`;
      if (commitBtn) commitBtn.disabled = true;
      return;
    }

    const newCount = this.parsedTopicsPreview.filter(t => t.status === 'new').length;
    const matchedCount = this.parsedTopicsPreview.length - newCount;

    let html = `
      <p class="parser-summary">
        <span class="parsed-count-new">${newCount} new</span>
        <span class="parsed-count-matched">${matchedCount} already in syllabus</span>
      </p>
    `;

    this.parsedTopicsPreview.forEach((item, index) => {
      html += `
        <div class="parsed-item-row ${item.selected ? 'is-selected' : ''}">
          <label class="custom-checkbox-container">
            <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="Queue.toggleParsedItem(${index})">
            <span class="checkmark"></span>
          </label>
          <div class="parsed-item-details">
            <span class="parsed-item-title">${item.title}</span>
            <span class="parsed-item-meta">
              <span class="parsed-item-unit">${item.unit || 'Imported Topics'}</span>
              <span class="parsed-item-duration">${item.duration}m target</span>
              <span class="parsed-item-status ${item.status === 'matched' ? 'is-matched' : 'is-new'}">
                ${item.status === 'matched' ? 'Already in syllabus' : 'New'}
              </span>
            </span>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
    if (commitBtn) commitBtn.disabled = newCount === 0;
  }

  render() {
    const container = document.getElementById('queue-view-container');
    if (!container) return;

    const state = Storage.getState();
    const currentSubjectMeta = Storage.getSubject(this.selectedSubject) || Storage.getSubjects()[0] || {};
    const syllabusObj = Storage.getSubjectSyllabus(this.selectedSubject);
    const rotationalQueue = state.queues[this.selectedSubject] || [];
    const progressMap = state.syllabusProgress || {};

    // Calculate subject-specific completion
    let totalSubtopics = 0;
    let completedSubtopics = 0;
    if (syllabusObj && syllabusObj.units) {
      syllabusObj.units.forEach(u => {
        u.subtopics.forEach(st => {
          totalSubtopics++;
          if (progressMap[st.id] && progressMap[st.id].completed) {
            completedSubtopics++;
          }
        });
      });
    }

    const pct = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;

    // Upcoming queue topics (first 5 uncompleted)
    const upcomingQueue = rotationalQueue.filter(item => !progressMap[item.id]?.completed);

    let html = `
      <div class="queue-header-area card">
        <div class="queue-subject-selector">
          <div class="subject-pills-scroll">
    `;

    Storage.getSubjects().forEach(sub => {
      const subKey = sub.id;
      const isSelected = subKey === this.selectedSubject;
      html += `
        <button class="subject-pill-btn ${isSelected ? 'active' : ''}" onclick="Queue.setSubject('${subKey}')">
          <span class="pill-code">${sub.code}</span>
          <span class="pill-name">${sub.name}</span>
        </button>
      `;
    });

    html += `
          </div>
        </div>

        <div class="subject-summary-banner">
          <div class="summary-info">
            <h2>${currentSubjectMeta.name}</h2>
            <p class="subject-grade-tag">${currentSubjectMeta.grade} &bull; Max CUET Score: ${currentSubjectMeta.cuetMaxScore}</p>
          </div>
          <div class="summary-stats">
            <div class="stat-circle">
              <span class="stat-pct">${pct}%</span>
              <span class="stat-sub">Done</span>
            </div>
          </div>
        </div>

        <div class="queue-action-toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input type="text" placeholder="Search chapters, subtopics..." value="${this.searchQuery}" oninput="Queue.setSearch(this.value)">
          </div>
          <div class="toolbar-btn-group">
            <button class="btn-import-trigger" onclick="Queue.openParserModal()">
              <i data-lucide="scan-line"></i> Import / Photo Parser
            </button>
          </div>
        </div>
      </div>
    `;

    // Rotational Queue Section
    html += `
      <div class="section-title-row">
        <h3><i data-lucide="layers"></i> Rotational Study Queue</h3>
        <span class="queue-count-badge">${upcomingQueue.length} Pending</span>
      </div>

      <div class="rotational-queue-cards-wrapper">
    `;

    if (upcomingQueue.length === 0) {
      const syllabusEmpty = totalSubtopics === 0;
      html += `
        <div class="empty-state-card card">
          <i data-lucide="${syllabusEmpty ? 'scan-line' : 'sparkles'}" class="empty-icon text-emerald"></i>
          <h4>${syllabusEmpty ? 'No topics yet' : 'All queued topics completed!'}</h4>
          <p>${syllabusEmpty
            ? 'Import your chapters from a photo of your syllabus to build the rotational queue.'
            : 'Great job! Mark more subtopics below or import custom chapters.'}</p>
        </div>
      `;
    } else {
      upcomingQueue.slice(0, 4).forEach((item, idx) => {
        const isHigh = item.priority === 'high';
        html += `
          <div class="queue-item-card card ${isHigh ? 'priority-high' : ''}">
            <div class="queue-item-order">#${idx + 1}</div>
            <div class="queue-item-body">
              <div class="queue-item-meta">
                <span class="queue-unit-label">${item.unitTitle || 'Chapter'}</span>
                ${isHigh ? `<span class="badge-priority">High Priority</span>` : ''}
              </div>
              <h4 class="queue-item-title">${item.title}</h4>
              <div class="queue-item-footer">
                <span class="queue-item-time"><i data-lucide="clock"></i> ${item.duration || 45} mins</span>
                <div class="queue-item-actions">
                  <button class="btn-queue-opt" onclick="Queue.queueTopicForToday(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${this.selectedSubject}', '${(item.unitTitle || '').replace(/'/g, "\\'")}')" title="Schedule for Today">
                    <i data-lucide="calendar-plus"></i> Study Today
                  </button>
                  <button class="btn-queue-opt" onclick="Queue.toggleSubtopicDone('${item.id}', true)" title="Pre-mark as Already Done">
                    <i data-lucide="check"></i> Mark Done
                  </button>
                  <button class="btn-queue-opt btn-reorder" onclick="Queue.moveQueueItem('${this.selectedSubject}', ${idx}, 1)" title="Move Down">
                    <i data-lucide="arrow-down"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`; // Close rotational-queue-cards-wrapper

    // Comprehensive Syllabus Checklist with Pre-mark feature
    html += `
      <div class="section-title-row syllabus-section-title">
        <div>
          <h3><i data-lucide="book-check"></i> Master Syllabus & Subtopics</h3>
          <p class="section-subtitle">Check "Already Done" on any future subtopic to skip it in the rotational queue.</p>
        </div>
      </div>

      <div class="syllabus-units-stack">
    `;

    if (syllabusObj && syllabusObj.units) {
      syllabusObj.units.forEach(unit => {
        // Filter subtopics based on search
        let subtopics = unit.subtopics;
        if (this.searchQuery) {
          subtopics = subtopics.filter(st => st.title.toLowerCase().includes(this.searchQuery));
        }

        if (subtopics.length === 0) return;

        const unitCompleted = subtopics.filter(st => progressMap[st.id]?.completed).length;

        html += `
          <div class="syllabus-unit-card card">
            <div class="unit-card-header">
              <div class="unit-title-group">
                <h4 class="unit-title">${unit.title}</h4>
                <span class="unit-progress-tag">${unitCompleted}/${subtopics.length} Done</span>
              </div>
            </div>

            <div class="subtopics-list">
        `;

        subtopics.forEach(st => {
          const isDone = Boolean(progressMap[st.id]?.completed);
          const isPreMarked = Boolean(progressMap[st.id]?.preMarked);

          html += `
            <div class="subtopic-row ${isDone ? 'is-completed' : ''}">
              <div class="subtopic-left">
                <label class="custom-checkbox-container" title="Mark as Already Done">
                  <input type="checkbox" ${isDone ? 'checked' : ''} onchange="Queue.toggleSubtopicDone('${st.id}', true)">
                  <span class="checkmark"></span>
                </label>
                <div class="subtopic-info">
                  <span class="subtopic-title">${st.title}</span>
                  <div class="subtopic-badges">
                    <span class="subtopic-time-badge">${st.minutes}m</span>
                    ${isPreMarked ? `<span class="badge-premarked">Already Done (Skipped in Queue)</span>` : ''}
                    ${isDone && !isPreMarked ? `<span class="badge-done-session">Completed via Session</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="subtopic-right">
                ${!isDone ? `
                  <button class="btn-slot-today" onclick="Queue.queueTopicForToday(${JSON.stringify(st).replace(/"/g, '&quot;')}, '${this.selectedSubject}', '${unit.title.replace(/'/g, "\\'")}')" title="Schedule for Today">
                    <i data-lucide="plus"></i> Plan Today
                  </button>
                ` : `
                  <span class="done-check-icon"><i data-lucide="check-circle-2"></i></span>
                `}
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });
    }

    if (totalSubtopics === 0) {
      html += `
        <div class="empty-state-card card">
          <i data-lucide="scan-line" class="empty-icon text-emerald"></i>
          <h4>Your syllabus is empty</h4>
          <p>Scan a photo of your book's contents page with "Import / Photo Parser" and the chapters, units and subtopics land right here.</p>
          <button class="btn-import-trigger" onclick="Queue.openParserModal()">
            <i data-lucide="scan-line"></i> Import from Photo
          </button>
        </div>
      `;
    }

    html += `</div>`; // Close syllabus-units-stack

    container.innerHTML = html;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

window.Queue = new QueueController();
