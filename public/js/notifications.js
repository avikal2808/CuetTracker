/**
 * Today Alerts Engine
 *
 * Turns today's free-form blocks into a "what to do today" briefing and
 * delivers it two ways:
 *   1. In-app  — getBriefing() feeds the planner's alert card (always works).
 *   2. System  — Capacitor Local Notifications on Android, Web Notifications
 *                in a browser tab (browser timers only run while the app is open).
 */
class NotificationController {
  constructor() {
    this.native = null;
    this.nativeIds = [];
    this.webTimers = [];
    this.refreshDebounce = null;
    this.init();
  }

  init() {
    this.native = this.getNativePlugin();

    Storage.on('change', () => this.scheduleRefresh());
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refresh();
      });
    }

    // Let the rest of the app finish its first paint before planning alerts.
    setTimeout(() => this.refresh(), 900);
  }

  /* ------------------------------------------------------------------
   * Platform plumbing
   * ------------------------------------------------------------------ */

  /** The Capacitor plugin when running natively, otherwise null. */
  getNativePlugin() {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins.LocalNotifications) return cap.Plugins.LocalNotifications;
    if (typeof cap.registerPlugin === 'function') {
      try {
        return cap.registerPlugin('LocalNotifications');
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  isNativePlatform() {
    const cap = window.Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }

  supportsWeb() {
    return typeof window.Notification !== 'undefined';
  }

  /** Human-readable delivery channel for the settings card. */
  getPlatformLabel() {
    if (this.native) return 'Android local notifications';
    if (this.supportsWeb()) return 'Browser notifications (while open)';
    return 'In-app alerts only';
  }

  /** 'granted' | 'denied' | 'default' | 'unsupported' | 'native' */
  getPermissionState() {
    if (this.native) return 'native';
    if (!this.supportsWeb()) return 'unsupported';
    return window.Notification.permission;
  }

  async requestPermission() {
    if (this.native) {
      try {
        const res = await this.native.requestPermissions();
        return res.display === 'granted' ? 'granted' : 'denied';
      } catch (e) {
        return 'error';
      }
    }
    if (!this.supportsWeb()) return 'unsupported';
    try {
      return await window.Notification.requestPermission();
    } catch (e) {
      return 'denied';
    }
  }

  /** Called from a user tap — browsers only allow permission prompts on gesture. */
  async enable() {
    Storage.updateNotificationSettings({ enabled: true });
    const result = await this.requestPermission();
    await this.refresh();
    return result;
  }

  /* ------------------------------------------------------------------
   * Today's briefing — the "what to do today" payload
   * ------------------------------------------------------------------ */

  parseClock(clockStr) {
    if (!clockStr || !/^\d{1,2}:\d{2}$/.test(clockStr)) return null;
    const parts = clockStr.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  todayAt(clockStr) {
    const mins = this.parseClock(clockStr);
    if (mins === null) return null;
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  }

  minutesNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  formatClock(clockStr) {
    const mins = this.parseClock(clockStr);
    if (mins === null) return '';
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }

  /** Everything the alert UI needs about one date, in one object. */
  getBriefing(dateStr = Storage.getTodayString()) {
    const blocks = Storage.getDaySchedule(dateStr);
    const pending = blocks.filter(b => b.status === 'pending');
    const done = blocks.filter(b => b.status === 'done');
    const minutes = Storage.getScheduledMinutes(dateStr);
    const nowMins = this.minutesNow();

    const ordered = pending.slice().sort((a, b) => {
      const am = this.parseClock(a.startTime);
      const bm = this.parseClock(b.startTime);
      if (am === null && bm === null) return 0;
      if (am === null) return 1;
      if (bm === null) return -1;
      return am - bm;
    });

    const upcoming = ordered.filter(b => {
      const m = this.parseClock(b.startTime);
      return m !== null && m >= nowMins;
    });
    const overdue = ordered.filter(b => {
      const m = this.parseClock(b.startTime);
      return m !== null && m < nowMins;
    });

    return {
      dateStr,
      blocks,
      pending,
      done,
      minutes,
      ordered,
      next: upcoming[0] || ordered[0] || null,
      overdue,
      pendingMinutes: pending.reduce((sum, b) => sum + (parseInt(b.duration, 10) || 0), 0)
    };
  }

  buildDigestTitle(briefing) {
    if (briefing.next && briefing.next.startTime) {
      return `Next up ${this.formatClock(briefing.next.startTime)} • ${Storage.getSubjectName(briefing.next.subjectId)}`;
    }
    return "Today's Study Plan";
  }

  buildDigestBody(briefing) {
    if (briefing.blocks.length === 0) {
      return 'No blocks planned yet — add your first study block for today.';
    }
    if (briefing.pending.length === 0) {
      return `All ${briefing.blocks.length} block${briefing.blocks.length > 1 ? 's' : ''} done. Excellent work!`;
    }
    const names = briefing.pending.slice(0, 3).map(b => b.topic || Storage.getSubjectName(b.subjectId) || 'Study block');
    const more = briefing.pending.length > 3 ? ` +${briefing.pending.length - 3} more` : '';
    return `${briefing.pending.length} block${briefing.pending.length > 1 ? 's' : ''} • ${briefing.pendingMinutes}m — ${names.join(', ')}${more}`;
  }

  /* ------------------------------------------------------------------
   * Scheduling — native (Android) and browser fallbacks
   * ------------------------------------------------------------------ */

  hashId(str) {
    let h = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return (Math.abs(h) % 2147483000) + 1000;
  }

  async refresh() {
    this.clearWebTimers();

    // The native bridge can finish injecting after our first tick.
    if (!this.native) this.native = this.getNativePlugin();

    if (this.native) await this.cancelNative();

    const settings = Storage.getNotificationSettings();
    if (settings.enabled === false || settings.enabled === 'false') return;

    const briefing = this.getBriefing();
    if (this.native) {
      try {
        await this.scheduleNative(briefing, settings);
      } catch (e) {
        console.warn('Native notification scheduling skipped:', e);
      }
    } else {
      this.scheduleWeb(briefing, settings);
    }
  }

  scheduleRefresh() {
    if (this.refreshDebounce) clearTimeout(this.refreshDebounce);
    this.refreshDebounce = setTimeout(() => this.refresh(), 700);
  }

  buildNativePayload(briefing, settings) {
    const pending = [];
    const soon = Date.now() + 30000;

    if (settings.dailyDigest !== false) {
      const at = this.todayAt(settings.digestTime || '07:00');
      if (at && at.getTime() > soon) {
        pending.push({
          id: 424242,
          title: "Today's Study Plan",
          body: this.buildDigestBody(briefing),
          schedule: { at, allowWhileIdle: true }
        });
      }
    }

    if (settings.blockReminders !== false) {
      briefing.pending.forEach(block => {
        if (this.parseClock(block.startTime) === null) return;
        const at = this.todayAt(block.startTime);
        if (!at || at.getTime() <= soon) return;
        pending.push({
          id: this.hashId(block.id),
          title: `${Storage.getSubjectName(block.subjectId) || 'Study'} block`,
          body: block.topic || 'Your study block starts now.',
          schedule: { at, allowWhileIdle: true }
        });
      });
    }

    return pending;
  }

  async scheduleNative(briefing, settings) {
    const notifications = this.buildNativePayload(briefing, settings).slice(0, 60);
    if (notifications.length === 0) return;

    try {
      await this.native.schedule({ notifications });
    } catch (e) {
      // Some devices refuse exact alarms — fall back to inexact scheduling.
      await this.native.schedule({
        notifications: notifications.map(n => ({ ...n, schedule: { at: n.schedule.at } }))
      });
    }
    this.nativeIds = notifications.map(n => n.id);
  }

  async cancelNative() {
    if (!this.native || this.nativeIds.length === 0) {
      this.nativeIds = [];
      return;
    }
    try {
      await this.native.cancel({ notifications: this.nativeIds.map(id => ({ id })) });
    } catch (e) {
      // Ignore — stale notifications simply expire.
    }
    this.nativeIds = [];
  }

  scheduleWeb(briefing, settings) {
    if (!this.supportsWeb() || window.Notification.permission !== 'granted') return;

    const fire = (title, body) => {
      try {
        new window.Notification(title, { body });
      } catch (e) {
        // Silently ignore — the in-app card still shows the briefing.
      }
    };

    if (settings.dailyDigest !== false) {
      this.setWebTimer(this.todayAt(settings.digestTime || '07:00'), () => {
        fire("Today's Study Plan", this.buildDigestBody(briefing));
      });
    }

    if (settings.blockReminders !== false) {
      briefing.pending.forEach(block => {
        if (this.parseClock(block.startTime) === null) return;
        this.setWebTimer(this.todayAt(block.startTime), () => {
          fire(`${Storage.getSubjectName(block.subjectId) || 'Study'} block`, block.topic || 'Your study block starts now.');
        });
      });
    }
  }

  setWebTimer(at, fn) {
    if (!at) return;
    const delay = at.getTime() - Date.now();
    if (delay <= 1000 || delay > 24 * 60 * 60 * 1000) return;
    this.webTimers.push(setTimeout(fn, delay));
  }

  clearWebTimers() {
    this.webTimers.forEach(t => clearTimeout(t));
    this.webTimers = [];
  }

  /* ------------------------------------------------------------------
   * Manual actions
   * ------------------------------------------------------------------ */

  async disable() {
    Storage.updateNotificationSettings({ enabled: false });
    this.clearWebTimers();
    await this.cancelNative();
  }

  /** Fire a one-off preview so the student can confirm alerts are wired up. */
  async sendTest() {
    const briefing = this.getBriefing();
    const title = "Today's Study Plan";
    const body = this.buildDigestBody(briefing);

    if (this.native) {
      try {
        await this.native.schedule({
          notifications: [{ id: 424243, title, body, schedule: { at: new Date(Date.now() + 3000) } }]
        });
        return 'scheduled';
      } catch (e) {
        return 'error';
      }
    }

    if (!this.supportsWeb()) return 'unsupported';

    let permission = window.Notification.permission;
    if (permission !== 'granted') {
      permission = await window.Notification.requestPermission();
    }
    if (permission !== 'granted') return 'denied';

    try {
      new window.Notification(title, { body });
      return 'sent';
    } catch (e) {
      return 'error';
    }
  }
}

// Exposed as `Notifier` — `Notifications` is a legacy browser global.
window.Notifier = new NotificationController();
