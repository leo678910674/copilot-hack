(() => {
  "use strict";

  const STORAGE_KEY = "manmanlai-dashboard-v1";
  const today = new Date();
  const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const currentDate = dateKey(today);
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const starterRecords = {
    tasks: [
      { id: "task-1", title: "完成高数第三章习题", time: "10:30", priority: "high", done: false },
      { id: "task-2", title: "整理英语课堂笔记", time: "14:00", priority: "normal", done: true },
      { id: "task-3", title: "给妈妈打个电话", time: "晚上", priority: "low", done: false },
      { id: "task-4", title: "阅读《也许你该找个人聊聊》", time: "20:30", priority: "normal", done: false }
    ],
    schedules: [
      { id: "schedule-1", type: "course", title: "高等数学", day: 0, start: "08:00", end: "09:40", location: "教学楼 A203" },
      { id: "schedule-2", type: "course", title: "大学英语", day: 0, start: "10:00", end: "11:40", location: "外语楼 301" },
      { id: "schedule-3", type: "course", title: "程序设计基础", day: 1, start: "14:00", end: "15:40", location: "实验楼 2-104" },
      { id: "schedule-4", type: "study", title: "图书馆 · 专注学习", day: 1, start: "19:00", end: "20:00", location: "图书馆 3F" },
      { id: "schedule-5", type: "course", title: "中国近现代史", day: 2, start: "08:00", end: "09:40", location: "文科楼 405" },
      { id: "schedule-6", type: "course", title: "大学物理", day: 3, start: "10:00", end: "11:40", location: "教学楼 B102" },
      { id: "schedule-7", type: "study", title: "英语听力练习", day: 4, start: "15:00", end: "15:40", location: "宿舍 / 自习室" },
      { id: "schedule-8", type: "course", title: "体育 · 羽毛球", day: 4, start: "16:00", end: "17:40", location: "体育馆 2 号场" }
    ],
    studyLogs: [
      { id: "study-1", title: "高数习题", minutes: 35 },
      { id: "study-2", title: "英语单词", minutes: 20 }
    ],
    habits: [
      { id: "habit-1", title: "阅读 30 分钟", icon: "▤", streak: 6, checked: true },
      { id: "habit-2", title: "喝够 8 杯水", icon: "♧", streak: 3, checked: false },
      { id: "habit-3", title: "拉伸 / 运动", icon: "⌁", streak: 2, checked: false }
    ],
    goals: [
      { id: "goal-reading", type: "reading", title: "每月阅读", current: 4, target: 6, unit: "本", icon: "▤" },
      { id: "goal-weight", type: "weight", title: "体重记录", current: 54.2, target: 53, unit: "kg", icon: "♡" },
      { id: "goal-exercise", type: "exercise", title: "本周运动", current: 2, target: 4, unit: "次", icon: "⌁" }
    ],
    transactions: [
      { id: "transaction-1", title: "食堂午餐", category: "餐饮", amount: 18, type: "expense" },
      { id: "transaction-2", title: "打印课程资料", category: "学习", amount: 8, type: "expense" },
      { id: "transaction-3", title: "本月生活费", category: "生活费", amount: 2500, type: "income" }
    ]
  };
  const dateAt = (offset) => {
    const date = new Date(thisMonday);
    date.setDate(date.getDate() + offset);
    return dateKey(date);
  };
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const minutesAgo = (minutes) => {
    const date = new Date(Date.now() - minutes * 60000);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };
  const defaults = () => ({
    budget: 0,
    tasks: [],
    schedules: [],
    studyLogs: [],
    habits: [],
    goals: [],
    transactions: [],
    reviews: {},
    starterSamplesCleared: 2
  });

  let state;
  let selectedWeek = new Date(thisMonday);
  let timerDurationMinutes = 25;
  let timerSeconds = timerDurationMinutes * 60;
  let timerInterval = null;
  let timerStartedAt = null;
  let editing = null;
  let toastTimeout;
  let needsInitialSave = false;
  const dialog = document.querySelector("#entry-dialog");
  const form = document.querySelector("#entry-form");
  const fields = document.querySelector("#dialog-fields");

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      needsInitialSave = true;
      return defaults();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.schedules) || !Array.isArray(parsed.goals)) {
      throw new Error("本地保存的数据结构不完整");
    }
    return clearUnmodifiedStarterData({
      ...defaults(),
      ...parsed,
      starterSamplesCleared: parsed.starterSamplesCleared === 2
    });
  }
  function clearUnmodifiedStarterData(data) {
    if (data.starterSamplesCleared === 2) return data;

    let changes = 0;
    for (const [collection, samples] of Object.entries(starterRecords)) {
      const records = Array.isArray(data[collection]) ? data[collection] : [];
      const keep = records.filter((record) => {
        const sample = record && samples.find((item) => item.id === record.id);
        const unchanged = sample && Object.entries(sample).every(([key, value]) => record[key] === value);
        if (unchanged) {
          changes += 1;
          return false;
        }
        return true;
      });
      if (keep.length !== records.length) data[collection] = keep;
    }

    if (data.budget === 2500) {
      data.budget = 0;
      changes += 1;
    }
    data.starterSamplesCleared = 2;
    if (changes > 0) needsInitialSave = true;
    return data;
  }
  function saveState(message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) notify(message);
      return true;
    } catch (error) {
      console.error("无法保存到浏览器本地存储", error);
      notify("保存失败，请检查浏览器存储空间或权限。");
      return false;
    }
  }
  function notify(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function money(value) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
  }
  function formatDay(date) {
    return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
  }
  function displayDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  function isThisMonth(date) {
    return date.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  }
  function duration(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }
  function render() {
    renderHeader();
    renderStats();
    renderSchedule();
    renderTasks();
    renderStudy();
    renderHabits();
    renderFinance();
    renderGoals();
  }
  function renderHeader() {
    document.querySelector("#topbar-date").textContent = formatDay(today);
    document.querySelector("#welcome-date").textContent = formatDay(today);
  }
  function renderStats() {
    const todaysTasks = state.tasks.filter((task) => task.date === currentDate);
    const done = todaysTasks.filter((task) => task.done).length;
    const taskPercent = todaysTasks.length ? done / todaysTasks.length * 100 : 0;
    document.querySelector("#task-progress").textContent = `${done}/${todaysTasks.length}`;
    document.querySelector("#task-progress-caption").textContent = "今日完成";
    document.querySelector("#task-progress-bar").style.width = `${taskPercent}%`;
    document.querySelector("#task-progress-foot").textContent = todaysTasks.length ? `还有 ${todaysTasks.length - done} 件小事待完成` : "今天还没有安排待办";
    const minutes = state.studyLogs.filter((log) => log.date === currentDate).reduce((sum, log) => sum + Number(log.minutes), 0);
    document.querySelector("#study-total").innerHTML = `${minutes}<span class="stat-unit"> 分钟</span>`;
    document.querySelector("#study-progress-bar").style.width = `${Math.min(100, minutes / 120 * 100)}%`;
    document.querySelector("#study-progress-foot").textContent = minutes >= 120 ? "今日学习目标已达成" : `距离 2 小时目标还差 ${120 - minutes} 分钟`;
    const weekDates = Array.from({ length: 7 }, (_, index) => dateAt(index));
    const weeklyCourses = state.schedules.filter((item) => item.type === "course" && weekDates.includes(dateAt(item.day)));
    const classMinutes = weeklyCourses.reduce((sum, course) => sum + duration(course.start, course.end), 0);
    document.querySelector("#course-hours").innerHTML = `${(classMinutes / 60).toFixed(classMinutes % 60 ? 1 : 0)}<span class="stat-unit"> 小时</span>`;
    document.querySelector("#course-count").textContent = `本周 ${weeklyCourses.length} 节课程`;
    document.querySelector("#mini-week").innerHTML = Array.from({ length: 7 }, (_, day) => `<i class="${weeklyCourses.some((item) => item.day === day) ? "has-class" : ""}"></i>`).join("");
    const monthTransactions = state.transactions.filter((item) => isThisMonth(item.date));
    const expense = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const budget = Number(state.budget) || 0;
    const balance = budget - expense;
    document.querySelector("#budget-remaining").textContent = budget > 0 ? `¥${money(balance)}` : "未设置";
    document.querySelector("#budget-progress-bar").style.width = `${budget > 0 ? Math.min(100, expense / budget * 100) : 0}%`;
    document.querySelector("#budget-caption").textContent = budget > 0
      ? `本月已使用 ${Math.round(expense / budget * 100)}%`
      : "前往账本设置每月预算";
  }
  function renderSchedule() {
    const weekStart = new Date(selectedWeek);
    const weekDates = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + index);
      return dateKey(day);
    });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    document.querySelector("#week-label").textContent = `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    const baseMonday = new Date(thisMonday);
    const offsetDays = Math.round((weekStart - baseMonday) / 86400000);
    const weekIndex = (day) => ((day - offsetDays) % 7 + 7) % 7;
    const cardsByDay = Array.from({ length: 7 }, (_, index) => {
      const items = state.schedules.filter((item) => weekIndex(item.day) === index && (item.type === "course" || !item.date || item.date === weekDates[index])).sort((a, b) => a.start.localeCompare(b.start));
      return items;
    });
    document.querySelector("#week-grid").innerHTML = cardsByDay.map((items, day) => {
      const date = new Date(`${weekDates[day]}T00:00:00`);
      const weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][day];
      const content = items.length ? items.map((item) => `
        <div class="schedule-card ${item.type === "study" ? "study" : ""}" data-edit-schedule="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="编辑${escapeHtml(item.title)}，${escapeHtml(item.start)} 至 ${escapeHtml(item.end)}，${escapeHtml(item.location)}">
          <strong>${escapeHtml(item.title)}</strong><span class="schedule-time">${escapeHtml(item.start)}–${escapeHtml(item.end)}</span><span>${item.type === "course" ? "课程" : "学习"} · ${escapeHtml(item.location)}</span>
        </div>`).join("") : '<p class="schedule-empty">留白也很好</p>';
      return `<div class="day-column ${weekDates[day] === currentDate ? "is-today" : ""}"><div class="day-heading">${weekday}<strong>${date.getDate()}</strong></div>${content}</div>`;
    }).join("");
    const weeklyCourses = state.schedules.filter((item) => item.type === "course").reduce((sum, item) => sum + duration(item.start, item.end), 0);
    document.querySelector("#week-course-summary").textContent = `本周课时 ${(weeklyCourses / 60).toFixed(weeklyCourses % 60 ? 1 : 0)} 小时`;
  }
  function renderTasks() {
    const tasks = state.tasks.filter((task) => task.date === currentDate).sort((a, b) => a.time.localeCompare(b.time));
    document.querySelector("#today-task-count").textContent = `${tasks.filter((item) => !item.done).length} 件待完成`;
    document.querySelector("#task-list").innerHTML = tasks.length ? tasks.map((task) => `
      <div class="task-item ${task.done ? "done" : ""}">
        <button class="task-check ${task.done ? "completed" : ""}" type="button" data-toggle-task="${escapeHtml(task.id)}" aria-label="${task.done ? "标记未完成" : "完成"}：${escapeHtml(task.title)}">${task.done ? "✓" : ""}</button>
        <button class="task-copy" type="button" data-edit-task="${escapeHtml(task.id)}"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.time || "今天")}</span></button>
        <i class="priority-dot ${escapeHtml(task.priority)}" title="${task.priority === "high" ? "优先" : task.priority === "low" ? "稍后" : "普通"}"></i>
        <button class="task-more" type="button" data-delete-task="${escapeHtml(task.id)}" aria-label="删除${escapeHtml(task.title)}">×</button>
      </div>`).join("") : '<div class="empty-state">今天还没有待办，添加一件小事吧。</div>';
  }
  function renderStudy() {
    const logs = state.studyLogs.filter((log) => log.date === currentDate).sort((a, b) => b.time.localeCompare(a.time));
    const total = logs.reduce((sum, log) => sum + Number(log.minutes), 0);
    document.querySelector("#study-log-total").textContent = `${total} 分钟`;
    document.querySelector("#study-log-list").innerHTML = logs.length ? logs.slice(0, 4).map((log) => `<button class="study-log-item" type="button" data-edit-study="${escapeHtml(log.id)}"><span>${escapeHtml(log.title)}</span><span>${escapeHtml(log.time)} · ${Number(log.minutes)} 分钟</span></button>`).join("") : '<div class="empty-state">开启一次专注，或手动记下学习时间。</div>';
  }
  function renderHabits() {
    document.querySelector("#habit-list").innerHTML = state.habits.length ? state.habits.map((habit) => {
      const checked = habit.date === currentDate && habit.checked;
      return `<div class="habit-item"><span class="habit-icon ${escapeHtml(habit.tone || "")}">${escapeHtml(habit.icon || "✳")}</span><button class="habit-copy" type="button" data-edit-habit="${escapeHtml(habit.id)}" aria-label="编辑习惯 ${escapeHtml(habit.title)}"><strong>${escapeHtml(habit.title)}</strong><span>${escapeHtml(habit.detail || `已坚持 ${habit.streak || 0} 天`)}</span></button><span class="habit-streak">✦ ${Number(habit.streak) || 0} 天</span><button class="habit-check ${checked ? "checked" : ""}" type="button" data-toggle-habit="${escapeHtml(habit.id)}" aria-label="${checked ? "取消" : "完成"}${escapeHtml(habit.title)}">${checked ? "✓" : "＋"}</button></div>`;
    }).join("") : '<div class="empty-state">添加一个想坚持的小习惯吧。</div>';
    const review = state.reviews[currentDate] || "";
    document.querySelector("#review-entry").textContent = review;
    document.querySelector("#review-button").textContent = review ? "编辑复盘" : "写复盘";
  }
  function renderFinance() {
    const items = state.transactions.filter((item) => isThisMonth(item.date)).sort((a, b) => b.date.localeCompare(a.date));
    const expense = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    const income = items.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    document.querySelector("#month-expense").textContent = `¥${money(expense)}`;
    document.querySelector("#month-income").textContent = `¥${money(income)}`;
    const budget = Number(state.budget) || 0;
    document.querySelector("#month-budget-label").textContent = budget > 0 ? `¥${money(budget)}` : "未设置 · 点击设定";
    document.querySelector("#finance-progress-bar").style.width = `${budget > 0 ? Math.min(100, expense / budget * 100) : 0}%`;
    document.querySelector("#transaction-list").innerHTML = items.length ? items.slice(0, 4).map((item) => `<button class="transaction-item" type="button" data-edit-transaction="${escapeHtml(item.id)}" aria-label="编辑收支：${escapeHtml(item.title)}，点击以修改"><span class="transaction-icon ${item.type === "income" ? "income" : ""}">${item.type === "income" ? "↙" : "↗"}</span><span class="transaction-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${displayDate(item.date)}</span></span><span class="transaction-amount ${item.type === "income" ? "income" : ""}">${item.type === "income" ? "+" : "−"}¥${money(item.amount)}</span><span class="transaction-edit-hint">编辑</span></button>`).join("") : '<div class="empty-state">记下第一笔收支，更了解生活费流向。</div>';
  }
  function renderGoals() {
    const icons = { reading: "", weight: "weight", exercise: "exercise" };
    document.querySelector("#goal-list").innerHTML = state.goals.length ? state.goals.map((goal) => {
      const value = Number(goal.current) || 0;
      const target = Math.max(1, Number(goal.target) || 1);
      const percent = Math.min(100, value / target * 100);
      const goalValue = goal.type === "weight" ? `${value} / ${target} kg` : `${value} / ${target} ${escapeHtml(goal.unit || "")}`;
      return `<div class="goal-item"><span class="goal-icon ${icons[goal.type] || ""}">${escapeHtml(goal.icon || "◎")}</span><button class="goal-info" type="button" data-edit-goal="${escapeHtml(goal.id)}" aria-label="编辑目标 ${escapeHtml(goal.title)}"><strong>${escapeHtml(goal.title)}</strong><span>${goal.type === "weight" ? "每周记录一次，关心身体变化" : "一点一点，离目标更近"}</span></button><button class="goal-value-button" type="button" data-update-goal="${escapeHtml(goal.id)}" aria-label="更新${escapeHtml(goal.title)}进度">＋ 更新</button><div class="goal-progress"><div class="progress-track"><span class="progress-fill green-fill" style="width:${percent}%"></span></div><span>${goalValue}</span></div></div>`;
    }).join("") : '<div class="empty-state">设定一个温柔又实际的目标吧。</div>';
    const weight = state.goals.find((goal) => goal.type === "weight");
    document.querySelector("#weight-note").textContent = weight ? `最近一次体重记录：${Number(weight.current)} kg · 记录仅供自己参考，轻松看待每一天。` : "慢慢记录，轻松看待每一天。";
  }

  function showOverdueTaskReminder() {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dateKey(yesterday);
    const overdue = state.tasks.filter((task) => task.date === yesterdayKey && !task.done);
    if (!overdue.length || state.overdueReminderShownFor === currentDate) return;

    state.overdueReminderShownFor = currentDate;
    if (!saveState()) return;
    const amount = overdue.length;
    document.querySelector("#overdue-message").textContent = amount === 1
      ? "昨天还有 1 件待办没完成。没关系，今天挑一件继续吧，老弟。"
      : `昨天还有 ${amount} 件待办没完成。没关系，今天挑一件继续吧，老弟。`;
    document.querySelector("#overdue-dialog").showModal();
  }

  function validateBackup(data) {
    const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    const validText = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
    const validId = (value) => validText(value, 120);
    const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const validList = (value, validator) => Array.isArray(value) && value.length <= 5000 && value.every((item) => isRecord(item) && validId(item.id) && validator(item));
    if (!isRecord(data) || !Number.isFinite(data.budget) || data.budget < 0 || data.budget > 10000000) return "预算数据不正确。";
    if (!validList(data.tasks, (item) => validText(item.title) && validDate(item.date) && typeof item.done === "boolean" && ["high", "normal", "low"].includes(item.priority))) return "待办清单格式不正确。";
    if (!validList(data.schedules, (item) => validText(item.title) && ["course", "study"].includes(item.type) && Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 && validTime(item.start) && validTime(item.end) && item.end > item.start && validText(item.location) && (item.type === "course" || !item.date || validDate(item.date)))) return "课程或学习安排格式不正确。";
    if (!validList(data.studyLogs, (item) => validText(item.title) && validDate(item.date) && validTime(item.time) && Number.isInteger(item.minutes) && item.minutes >= 1 && item.minutes <= 1440)) return "学习记录格式不正确。";
    if (!validList(data.habits, (item) => validText(item.title) && Number.isInteger(item.streak) && item.streak >= 0 && typeof item.checked === "boolean" && (item.date === "" || validDate(item.date)))) return "习惯打卡数据格式不正确。";
    if (!validList(data.goals, (item) => validText(item.title) && ["reading", "weight", "exercise", "custom"].includes(item.type) && Number.isFinite(item.current) && item.current >= 0 && Number.isFinite(item.target) && item.target > 0 && validText(item.unit, 30))) return "健康目标数据格式不正确。";
    if (!validList(data.transactions, (item) => validText(item.title) && validText(item.category) && ["income", "expense"].includes(item.type) && Number.isFinite(item.amount) && item.amount > 0 && item.amount <= 10000000 && validDate(item.date))) return "收支记录格式不正确。";
    if (!isRecord(data.reviews) || Object.entries(data.reviews).length > 5000 || Object.entries(data.reviews).some(([date, review]) => !validDate(date) || typeof review !== "string" || review.length > 5000)) return "每日复盘格式不正确。";
    return "";
  }

  function exportBackup() {
    const backup = {
      app: "manmanlai-study-life",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `慢慢来-学习生活备份-${currentDate}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("备份已导出，请妥善保存 JSON 文件。");
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size <= 0 || file.size > MAX_BACKUP_BYTES) {
      notify("备份文件必须小于 2 MB。");
      return;
    }
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch (error) {
      console.error("无法读取备份文件", error);
      notify("文件不是有效的 JSON 备份。");
      return;
    }
    if (!backup || backup.app !== "manmanlai-study-life" || backup.version !== 1) {
      notify("无法识别此备份文件或备份版本。");
      return;
    }
    const migratedBackup = clearUnmodifiedStarterData({
      ...defaults(),
      ...backup.data,
      starterSamplesCleared: backup.data.starterSamplesCleared === 2
    });
    const issue = validateBackup(migratedBackup);
    if (issue) {
      notify(`备份未导入：${issue}`);
      return;
    }
    if (!window.confirm("导入备份会替换此设备上的所有待办、课表、记录与目标。建议先导出当前数据，再继续。")) return;
    const previousState = state;
    state = migratedBackup;
    if (!saveState()) {
      state = previousState;
      return;
    }
    render();
    notify("数据备份已恢复到此设备。");
  }

  const schemas = {
    task: { title: "待办事项", fields: [
      { name: "title", label: "要做什么", required: true, placeholder: "例如：完成高数习题", full: true },
      { name: "date", label: "日期", type: "date", required: true, value: currentDate },
      { name: "time", label: "提醒时间", type: "time", value: "18:00" },
      { name: "priority", label: "优先级", type: "select", options: [["high", "优先处理"], ["normal", "普通"], ["low", "稍后安排"]], value: "normal" }
    ] },
    schedule: { title: "课程 / 学习安排", fields: [
      { name: "type", label: "安排类型", type: "select", options: [["course", "课程"], ["study", "额外学习"]], value: "course" },
      { name: "title", label: "课程或计划名称", required: true, placeholder: "例如：大学物理", full: true },
      { name: "date", label: "上课 / 计划日期", type: "date", required: true, value: currentDate },
      { name: "start", label: "开始时间", type: "time", required: true, value: "09:00" },
      { name: "end", label: "结束时间", type: "time", required: true, value: "10:00" },
      { name: "location", label: "地点", required: true, placeholder: "例如：教学楼 A203", full: true }
    ] },
    study: { title: "学习时间记录", fields: [
      { name: "title", label: "学习内容", required: true, placeholder: "例如：高数复习", full: true },
      { name: "date", label: "学习日期", type: "date", required: true, value: currentDate },
      { name: "time", label: "开始时间", type: "time", value: minutesAgo(30) },
      { name: "minutes", label: "学习时长（分钟）", type: "number", min: "1", max: "1440", required: true, value: "30" }
    ] },
    habit: { title: "每日习惯", fields: [
      { name: "title", label: "习惯名称", required: true, placeholder: "例如：睡前拉伸", full: true },
      { name: "icon", label: "小图标", placeholder: "✳", value: "✳" }
    ] },
    transaction: { title: "记一笔收支", fields: [
      { name: "type", label: "收支类型", type: "select", options: [["expense", "支出"], ["income", "收入"]], value: "expense" },
      { name: "amount", label: "金额（元）", type: "number", min: "0.01", max: "10000000", step: "0.01", required: true, placeholder: "0.00" },
      { name: "title", label: "事项", required: true, placeholder: "例如：食堂午餐" },
      { name: "category", label: "类别", type: "select", options: [["餐饮", "餐饮"], ["学习", "学习"], ["交通", "交通"], ["购物", "购物"], ["居住", "居住"], ["娱乐", "娱乐"], ["生活费", "生活费"], ["其他", "其他"]], value: "餐饮" },
      { name: "date", label: "日期", type: "date", required: true, value: currentDate }
    ] },
    goal: { title: "目标", fields: [
      { name: "type", label: "目标类型", type: "select", options: [["reading", "阅读"], ["weight", "体重"], ["exercise", "运动"], ["custom", "其他"]], value: "reading" },
      { name: "title", label: "目标名称", required: true, placeholder: "例如：每周散步三次" },
      { name: "current", label: "当前进度", type: "number", min: "0", step: "0.1", value: "0" },
      { name: "target", label: "目标值", type: "number", min: "0.1", step: "0.1", required: true, value: "6" },
      { name: "unit", label: "单位", placeholder: "本 / 次 / kg", value: "次" }
    ] },
    review: { title: "今日复盘", fields: [
      { name: "review", label: "今天有什么值得记下？", type: "textarea", placeholder: "一件做得不错的事、一个小小的发现，或明天想完成的事……", full: true, value: "" }
    ] },
    budget: { title: "设置月预算", fields: [
      { name: "budget", label: "每月生活费预算（元）", type: "number", min: "1", max: "10000000", required: true, value: "", placeholder: "例如：2500", full: true }
    ] }
  };

  function fieldMarkup(field, value) {
    const id = `field-${field.name}`;
    const valueAttr = value !== undefined && value !== null ? ` value="${escapeHtml(value)}"` : "";
    const required = field.required ? " required" : "";
    let control;
    if (field.type === "select") {
      control = `<select id="${id}" name="${field.name}"${required}>${field.options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === optionValue ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
    } else if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${field.name}"${required} placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value || "")}</textarea>`;
    } else {
      control = `<input id="${id}" name="${field.name}" type="${field.type || "text"}"${valueAttr}${field.min ? ` min="${field.min}"` : ""}${field.max ? ` max="${field.max}"` : ""}${field.step ? ` step="${field.step}"` : ""}${required} placeholder="${escapeHtml(field.placeholder || "")}">`;
    }
    return `<div class="field ${field.full ? "full" : ""}"><label for="${id}">${escapeHtml(field.label)}</label>${control}</div>`;
  }
  function openForm(kind, record) {
    editing = record ? { kind, id: record.id } : { kind, id: null };
    const schema = schemas[kind];
    const values = { ...schema.fields.reduce((result, field) => ({ ...result, [field.name]: field.value }), {}), ...(record || {}) };
    if (kind === "schedule" && record) values.date = dateAt(record.day);
    if (kind === "schedule" && !record) {
      const day = Math.max(0, Math.min(6, (new Date().getDay() + 6) % 7));
      values.date = currentDate;
      values.start = day < 5 ? "09:00" : "10:00";
    }
    if (kind === "review") values.review = state.reviews[currentDate] || "";
    if (kind === "budget") values.budget = state.budget > 0 ? state.budget : "";
    const deletable = ["schedule", "study", "habit", "transaction", "goal"];
    const deleteButton = document.querySelector("#dialog-delete");
    deleteButton.hidden = !record || !deletable.includes(kind);
    deleteButton.textContent = kind === "schedule" ? "删除安排" : kind === "study" ? "删除记录" : kind === "habit" ? "删除习惯" : kind === "goal" ? "删除目标" : "删除账目";
    document.querySelector("#dialog-title").textContent = record ? `编辑${schema.title}` : schema.title;
    document.querySelector("#dialog-kicker").textContent = kind === "review" ? "LOOK BACK, GENTLY" : "A LITTLE STEP";
    document.querySelector("#form-error").textContent = "";
    fields.innerHTML = schema.fields.map((field) => fieldMarkup(field, values[field.name])).join("");
    dialog.showModal();
    fields.querySelector("input, select, textarea")?.focus();
  }
  function readValues() {
    return Object.fromEntries(new FormData(form).entries());
  }
  function handleSubmit(event) {
    event.preventDefault();
    const values = readValues();
    const error = document.querySelector("#form-error");
    error.textContent = "";
    for (const input of fields.querySelectorAll("input, select, textarea")) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      if (input.required && ["text", "textarea"].includes(input.type || input.tagName.toLowerCase()) && !input.value.trim()) {
        error.textContent = "请填写有效内容，不能只输入空格。";
        input.focus();
        return;
      }
    }
    const kind = editing.kind;
    if (kind === "task") {
      const task = { id: editing.id || uid(), title: values.title.trim(), date: values.date, time: values.time || "", priority: values.priority, done: editing.id ? state.tasks.find((item) => item.id === editing.id).done : false };
      if (editing.id) state.tasks = state.tasks.map((item) => item.id === editing.id ? task : item);
      else state.tasks.push(task);
      saveState(editing.id ? "待办已更新" : "已添加待办");
    } else if (kind === "schedule") {
      const date = new Date(`${values.date}T00:00:00`);
      const weekday = (date.getDay() + 6) % 7;
      const start = values.start;
      const end = values.end;
      if (end <= start) {
        error.textContent = "结束时间需要晚于开始时间。";
        return;
      }
      const conflict = state.schedules.some((item) => item.id !== editing.id && item.day === weekday && (item.type === "course" || values.type === "course" || !item.date || item.date === values.date) && start < item.end && end > item.start);
      if (conflict && !window.confirm("这个时间和已有课程或学习计划重叠，仍要保存吗？")) return;
      const schedule = { id: editing.id || uid(), title: values.title.trim(), type: values.type, day: weekday, ...(values.type === "study" ? { date: values.date } : {}), start, end, location: values.location.trim() };
      if (editing.id) state.schedules = state.schedules.map((item) => item.id === editing.id ? schedule : item);
      else state.schedules.push(schedule);
      saveState(editing.id ? "课程 / 计划已更新" : "已添加课程 / 学习计划");
    } else if (kind === "study") {
      const log = { id: editing.id || uid(), title: values.title.trim(), date: values.date, time: values.time || "09:00", minutes: Number(values.minutes) };
      if (editing.id) state.studyLogs = state.studyLogs.map((item) => item.id === editing.id ? log : item);
      else state.studyLogs.push(log);
      saveState(editing.id ? "学习记录已更新" : "学习时间已记录");
    } else if (kind === "habit") {
      const existing = editing.id && state.habits.find((item) => item.id === editing.id);
      const habit = { ...(existing || {}), id: editing.id || uid(), title: values.title.trim(), icon: values.icon.trim() || "✳", streak: existing?.streak || 0, checked: existing?.checked || false, date: existing?.date || "", tone: existing?.tone || "" };
      if (editing.id) state.habits = state.habits.map((item) => item.id === editing.id ? habit : item);
      else state.habits.push(habit);
      saveState(editing.id ? "习惯已更新" : "已添加新习惯");
    } else if (kind === "transaction") {
      const transaction = { id: editing.id || uid(), title: values.title.trim(), category: values.category, amount: Number(values.amount), type: values.type, date: values.date };
      if (editing.id) state.transactions = state.transactions.map((item) => item.id === editing.id ? transaction : item);
      else state.transactions.push(transaction);
      saveState(editing.id ? "收支已更新" : "收支已记录");
    } else if (kind === "goal") {
      const existing = editing.id && state.goals.find((item) => item.id === editing.id);
      const presets = { reading: ["本月阅读", "本"], weight: ["体重记录", "kg"], exercise: ["本周运动", "次"], custom: ["新目标", "次"] };
      const [defaultTitle, defaultUnit] = presets[values.type];
      const goal = { ...(existing || {}), id: editing.id || uid(), type: values.type, title: values.title.trim() || defaultTitle, current: Number(values.current) || 0, target: Number(values.target), unit: values.unit.trim() || defaultUnit, icon: values.type === "weight" ? "♡" : values.type === "exercise" ? "⌁" : "▤" };
      if (editing.id) state.goals = state.goals.map((item) => item.id === editing.id ? goal : item);
      else state.goals.push(goal);
      saveState(editing.id ? "目标已更新" : "已添加目标");
    } else if (kind === "review") {
      state.reviews[currentDate] = values.review.trim();
      saveState("今日复盘已保存");
    } else if (kind === "budget") {
      state.budget = Number(values.budget);
      saveState("月预算已更新");
    }
    dialog.close();
    render();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-open], [data-toggle-task], [data-delete-task], [data-edit-task], [data-edit-schedule], [data-edit-study], [data-edit-habit], [data-edit-transaction], [data-edit-goal], [data-toggle-habit], [data-update-goal]");
    if (!target) return;
    if (target.dataset.open) {
      openForm(target.dataset.open);
    } else if (target.dataset.toggleTask) {
      const task = state.tasks.find((item) => item.id === target.dataset.toggleTask);
      if (task) { task.done = !task.done; saveState(task.done ? "太棒了，完成一项待办" : "待办已恢复"); render(); }
    } else if (target.dataset.deleteTask) {
      const task = state.tasks.find((item) => item.id === target.dataset.deleteTask);
      if (task && window.confirm(`确定删除“${task.title}”吗？`)) { state.tasks = state.tasks.filter((item) => item.id !== task.id); saveState("待办已删除"); render(); }
    } else if (target.dataset.editTask) {
      const item = state.tasks.find((task) => task.id === target.dataset.editTask);
      if (item) openForm("task", item);
    } else if (target.dataset.editSchedule) {
      const item = state.schedules.find((schedule) => schedule.id === target.dataset.editSchedule);
      if (item) openForm("schedule", item);
    } else if (target.dataset.editStudy) {
      const item = state.studyLogs.find((log) => log.id === target.dataset.editStudy);
      if (item) openForm("study", item);
    } else if (target.dataset.editHabit) {
      const item = state.habits.find((habit) => habit.id === target.dataset.editHabit);
      if (item) openForm("habit", item);
    } else if (target.dataset.editTransaction) {
      const item = state.transactions.find((transaction) => transaction.id === target.dataset.editTransaction);
      if (item) openForm("transaction", item);
    } else if (target.dataset.editGoal) {
      const item = state.goals.find((goal) => goal.id === target.dataset.editGoal);
      if (item) openForm("goal", item);
    } else if (target.dataset.toggleHabit) {
      const habit = state.habits.find((item) => item.id === target.dataset.toggleHabit);
      if (habit) {
        const wasChecked = habit.date === currentDate && habit.checked;
        habit.checked = !wasChecked;
        habit.date = currentDate;
        if (habit.checked && !wasChecked) habit.streak = (Number(habit.streak) || 0) + 1;
        if (!habit.checked) habit.streak = Math.max(0, (Number(habit.streak) || 0) - 1);
        habit.detail = `连续打卡 ${habit.streak} 天`;
        saveState(habit.checked ? "习惯打卡成功，保持这个节奏" : "已取消今日打卡");
        render();
      }
    } else if (target.dataset.updateGoal) {
      const goal = state.goals.find((item) => item.id === target.dataset.updateGoal);
      if (goal) {
        const answer = window.prompt(`更新「${goal.title}」的进度（${goal.unit || ""}）`, String(goal.current));
        if (answer === null) return;
        const value = Number(answer);
        if (!Number.isFinite(value) || value < 0 || (goal.type !== "weight" && value > 1000000)) { notify("请输入有效的非负数字。"); return; }
        goal.current = value;
        saveState("目标进度已更新");
        render();
      }
    }
  });
  document.querySelector("#quick-add").addEventListener("click", () => openForm("task"));
  document.querySelector("#week-prev").addEventListener("click", () => { selectedWeek.setDate(selectedWeek.getDate() - 7); renderSchedule(); });
  document.querySelector("#week-next").addEventListener("click", () => { selectedWeek.setDate(selectedWeek.getDate() + 7); renderSchedule(); });
  document.querySelector("#review-button").addEventListener("click", () => openForm("review"));
  document.querySelector("#overdue-dismiss").addEventListener("click", () => document.querySelector("#overdue-dialog").close());
  document.querySelector("#export-data").addEventListener("click", exportBackup);
  document.querySelector("#import-data").addEventListener("click", () => document.querySelector("#backup-file").click());
  document.querySelector("#backup-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    try {
      await importBackup(file);
    } catch (error) {
      console.error("无法导入备份", error);
      notify("导入失败，现有数据未更改。");
    } finally {
      event.target.value = "";
    }
  });
  document.querySelector("#month-budget-label").addEventListener("click", () => openForm("budget"));
  document.querySelector("#month-budget-label").title = "点击设置月预算";
  document.querySelector("#month-budget-label").style.cursor = "pointer";
  document.querySelector("#dialog-cancel").addEventListener("click", () => dialog.close());
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  document.querySelector("#dialog-delete").addEventListener("click", () => {
    const collections = { schedule: state.schedules, study: state.studyLogs, habit: state.habits, transaction: state.transactions, goal: state.goals };
    const collection = collections[editing.kind];
    if (!editing.id || !collection) return;
    const item = collection.find((record) => record.id === editing.id);
    if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) return;
    const stateKeys = { schedule: "schedules", study: "studyLogs", habit: "habits", transaction: "transactions", goal: "goals" };
    const key = stateKeys[editing.kind];
    state[key] = state[key].filter((record) => record.id !== editing.id);
    saveState(editing.kind === "schedule" ? "课程 / 计划已删除" : editing.kind === "study" ? "学习记录已删除" : editing.kind === "habit" ? "习惯已删除" : editing.kind === "goal" ? "目标已删除" : "账目已删除");
    dialog.close();
    render();
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  form.addEventListener("submit", handleSubmit);

  function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.querySelector("#timer-display").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  document.querySelector("#timer-toggle").addEventListener("click", () => {
    const button = document.querySelector("#timer-toggle");
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      document.querySelector("#focus-duration").disabled = false;
      document.body.classList.remove("timer-running");
      const elapsed = Math.max(1, Math.round((timerDurationMinutes * 60 - timerSeconds) / 60));
      button.textContent = "继续专注";
      document.querySelector("#timer-status").textContent = "已暂停";
      if (elapsed > 0 && timerSeconds < 25 * 60) {
        const save = window.confirm(`已专注约 ${elapsed} 分钟。要把这段时间记入今日学习吗？`);
        if (save) {
          const title = window.prompt("学习内容是什么？", "专注学习");
          if (title && title.trim()) {
            const start = new Date(timerStartedAt || Date.now() - elapsed * 60000);
            state.studyLogs.push({ id: uid(), title: title.trim(), minutes: elapsed, time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`, date: currentDate });
            saveState("专注时长已记录");
            render();
          }
        }
      }
      return;
    }
    if (!timerStartedAt) timerStartedAt = Date.now();
    button.textContent = "结束并记录";
    document.querySelector("#timer-status").textContent = "专注进行中";
    document.body.classList.add("timer-running");
    timerInterval = setInterval(() => {
      timerSeconds -= 1;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        document.body.classList.remove("timer-running");
        document.querySelector("#timer-status").textContent = "专注完成";
        button.textContent = "开始下一轮";
        const start = new Date(timerStartedAt || Date.now() - timerDurationMinutes * 60000);
        document.querySelector("#focus-duration").disabled = false;
        state.studyLogs.push({ id: uid(), title: "专注学习", minutes: timerDurationMinutes, time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`, date: currentDate });
        saveState();
        render();
        notify("25 分钟专注完成，学习时间已自动记录。");
        timerSeconds = timerDurationMinutes * 60;
        updateTimerDisplay();
        timerStartedAt = null;
      }
    }, 1000);
    document.querySelector("#focus-duration").disabled = true;
  });
  document.querySelector("#timer-reset").addEventListener("click", () => {
    if (timerInterval) {
      document.querySelector("#timer-toggle").click();
    }
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerStartedAt = null;
    timerSeconds = timerDurationMinutes * 60;
    document.querySelector("#focus-duration").disabled = false;
    document.body.classList.remove("timer-running");
    document.querySelector("#timer-toggle").textContent = "开始专注";
    document.querySelector("#timer-status").textContent = "专注一会儿";
    updateTimerDisplay();
  });
  document.querySelector("#focus-duration").addEventListener("change", (event) => {
    if (timerInterval) return;
    timerDurationMinutes = Number(event.target.value);
    timerSeconds = timerDurationMinutes * 60;
    timerStartedAt = null;
    document.querySelector("#timer-toggle").textContent = "开始专注";
    document.querySelector("#timer-status").textContent = "专注一会儿";
    updateTimerDisplay();
  });
  document.querySelector("#month-budget-label").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openForm("budget");
    }
  });
  document.querySelector("#budget-caption").setAttribute("role", "button");
  document.querySelector("#budget-caption").tabIndex = 0;
  document.querySelector("#budget-caption").title = "点击设置月预算";
  document.querySelector("#budget-caption").style.cursor = "pointer";
  document.querySelector("#budget-caption").addEventListener("click", () => openForm("budget"));
  document.querySelector("#budget-caption").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openForm("budget");
    }
  });
  document.querySelector("#week-grid").addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-edit-schedule]");
    if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); }
  });
  const installButton = document.querySelector("#install-app");
  let pendingInstallPrompt = null;
  if ("serviceWorker" in navigator && window.isSecureContext) {
    installButton.hidden = false;
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("无法启用离线缓存", error);
      notify("离线缓存暂时不可用，应用仍可在线使用。");
    });
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      pendingInstallPrompt = event;
      installButton.querySelector("span").textContent = "安装应用";
    });
    window.addEventListener("appinstalled", () => {
      pendingInstallPrompt = null;
      installButton.hidden = true;
      notify("应用已安装，可以从桌面启动。");
    });
    installButton.addEventListener("click", async () => {
      if (!pendingInstallPrompt) {
        notify("请使用浏览器菜单中的“安装此应用”或“添加到主屏幕”。");
        return;
      }
      pendingInstallPrompt.prompt();
      const choice = await pendingInstallPrompt.userChoice;
      if (choice.outcome === "accepted") installButton.hidden = true;
      pendingInstallPrompt = null;
    });
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
      installButton.hidden = true;
    }
  }

  try {
    state = loadState();
  } catch (error) {
    console.error("无法读取已保存的数据", error);
    state = defaults();
    notify("之前保存的数据无法读取，已载入空白工作台；原始数据未被覆盖。");
  }
  document.querySelector("#month-budget-label").setAttribute("role", "button");
  document.querySelector("#month-budget-label").tabIndex = 0;
  updateTimerDisplay();
  render();
  showOverdueTaskReminder();
  if (needsInitialSave) saveState();
})();
