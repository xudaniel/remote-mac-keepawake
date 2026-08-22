"use strict";

const SESSION_KEY = "mac-pulse-private-connection-v1";
const REFRESH_INTERVAL_MS = 10_000;
const SVG_NS = "http://www.w3.org/2000/svg";

const translations = {
  en: {
    brandSubtitle: "Remote Mac Monitor",
    connect: "Connect private data",
    settings: "Connection settings",
    disconnect: "Disconnect",
    eyebrow: "Unattended Mac status",
    heroTitle: "Your Mac, at a glance.",
    heroCopy: "See awake protection, power, battery health and network quality without publishing machine identity.",
    currentState: "Current state",
    battery: "Battery",
    network: "Network",
    hardware: "Hardware",
    last24Hours: "Last 24 hours",
    batteryHistory: "Battery history",
    batteryLevel: "Battery level",
    remoteMacTest: "Remote Mac test",
    internetSpeed: "Internet speed",
    download: "download",
    upload: "upload",
    latency: "Latency",
    jitter: "Jitter",
    packetLoss: "Packet loss",
    measured: "Measured",
    faultIsolation: "Fault isolation",
    diagnostics: "Network diagnostics",
    defaultRoute: "Default route",
    gateway: "Gateway",
    dashboardIngest: "Dashboard ingest",
    exactTimestamps: "Exact timestamps",
    recentSamples: "Recent samples",
    privacyTitle: "Private by design",
    privacyCopy: "No analytics, no third-party scripts and no permanent credential storage. Connected-mode secrets stay in sessionStorage and disappear when the browser session ends.",
    securityPolicy: "Security policy ↗",
    footerBoundary: "Prevents idle sleep; it cannot overcome power, network, closed-lid or FileVault failures.",
    privateConnection: "Private connection",
    connectTitle: "Connect your Mac Pulse API",
    connectCopy: "Use a reviewed HTTPS dashboard endpoint. Values stay in this browser tab and are never added to the URL or GitHub.",
    apiOrigin: "Dashboard origin",
    viewToken: "View token",
    edgeToken: "Hosting access token (optional)",
    edgeTokenHelp: "Only needed when the hosting layer requires its own automation header.",
    neverUseIngest: "Never enter the heartbeat ingest/signing key here.",
    corsHelp: "The API must allow this GitHub Pages origin with PUBLIC_VIEWER_ORIGIN.",
    connectNow: "Connect securely",
    publicDemo: "Public demo",
    demoCopy: "All Mac readings shown here are synthetic.",
    privateLive: "Private live data",
    privateCopy: "Refreshing your authorized Mac Pulse endpoint every 10 seconds.",
    connectionProblem: "Connection problem",
    connectionProblemCopy: "Private data could not be refreshed. Check the endpoint, CORS setting and tokens.",
    demoRefreshed: "Demo refreshed",
    liveSynced: "Private API synced",
    awakeProtected: "Awake & protected",
    offline: "Offline",
    unprotected: "Awake but unprotected",
    stale: "Heartbeat is late",
    heartbeatReceived: "Heartbeat received {seconds} seconds ago",
    noHeartbeat: "No heartbeat has been received",
    chargingAc: "Charging on AC power",
    onPower: "Power source: {source}",
    active: "Active",
    inactive: "Inactive",
    assertionVerified: "launchd running · assertion verified",
    assertionMissing: "Sleep assertion is not verified",
    healthy: "Healthy",
    degraded: "Degraded",
    diagnosticsPass: "Route, DNS, HTTPS and ingest pass",
    diagnosticsFault: "Fault category: {fault}",
    healthValue: "{value}% health",
    hardwareDetail: "{cycles} cycles · thermal {thermal}",
    excellent: "Excellent",
    unavailable: "Unavailable",
    available: "Available",
    reachable: "Reachable",
    resolved: "Resolved",
    failed: "Failed",
    unknown: "Unknown",
    sampleCount: "{count} exact-timestamp samples",
    uptime: "{value}% uptime",
    protectedSample: "Protected sample",
    notProtectedSample: "Protection missing",
    batterySample: "Battery {value}%",
    invalidOrigin: "Enter a valid HTTPS dashboard origin without a path, query, username or password.",
    missingToken: "Enter the separate dashboard view token.",
    connectFailed: "The private API could not be reached or did not authorize this viewer.",
    refreshData: "Refresh data",
  },
  zh: {
    brandSubtitle: "远程 Mac 监控",
    connect: "连接私有数据",
    settings: "连接设置",
    disconnect: "断开连接",
    eyebrow: "无人值守 Mac 状态",
    heroTitle: "远程 Mac，一眼掌握。",
    heroCopy: "无需公开电脑身份，即可查看防睡眠、电源、电池健康和网络质量。",
    currentState: "当前状态",
    battery: "电池",
    network: "网络",
    hardware: "硬件",
    last24Hours: "最近 24 小时",
    batteryHistory: "电池历史",
    batteryLevel: "电池电量",
    remoteMacTest: "远程 Mac 测试",
    internetSpeed: "网络速度",
    download: "下载",
    upload: "上传",
    latency: "延迟",
    jitter: "抖动",
    packetLoss: "丢包",
    measured: "测量时间",
    faultIsolation: "故障定位",
    diagnostics: "网络诊断",
    defaultRoute: "默认路由",
    gateway: "网关",
    dashboardIngest: "面板接收端",
    exactTimestamps: "准确时间",
    recentSamples: "最近样本",
    privacyTitle: "隐私优先设计",
    privacyCopy: "无分析、无第三方脚本、无永久凭据存储。连接模式密钥仅保存在 sessionStorage，浏览器会话结束后自动消失。",
    securityPolicy: "安全策略 ↗",
    footerBoundary: "本工具防止空闲睡眠，但无法解决断电、断网、合盖或 FileVault 启动解锁。",
    privateConnection: "私有连接",
    connectTitle: "连接你的 Mac Pulse API",
    connectCopy: "请输入经过确认的 HTTPS 面板地址。信息仅保留在当前浏览器标签，不会写入 URL 或 GitHub。",
    apiOrigin: "面板地址",
    viewToken: "查看密钥",
    edgeToken: "托管访问密钥（可选）",
    edgeTokenHelp: "仅当托管层要求独立自动化请求头时使用。",
    neverUseIngest: "请勿在此输入心跳上传或签名密钥。",
    corsHelp: "API 必须通过 PUBLIC_VIEWER_ORIGIN 允许此 GitHub Pages 来源。",
    connectNow: "安全连接",
    publicDemo: "公开演示",
    demoCopy: "此页面显示的所有 Mac 读数均为合成数据。",
    privateLive: "私有实时数据",
    privateCopy: "每 10 秒刷新一次已授权的 Mac Pulse 端点。",
    connectionProblem: "连接异常",
    connectionProblemCopy: "无法刷新私有数据，请检查端点、CORS 设置及密钥。",
    demoRefreshed: "演示刷新",
    liveSynced: "私有 API 已同步",
    awakeProtected: "已唤醒并受保护",
    offline: "离线",
    unprotected: "在线但未防睡眠",
    stale: "心跳延迟",
    heartbeatReceived: "{seconds} 秒前收到心跳",
    noHeartbeat: "尚未收到心跳",
    chargingAc: "正在通过电源充电",
    onPower: "电源来源：{source}",
    active: "运行中",
    inactive: "未运行",
    assertionVerified: "launchd 运行中 · 防睡眠断言已验证",
    assertionMissing: "防睡眠断言未验证",
    healthy: "正常",
    degraded: "异常",
    diagnosticsPass: "路由、DNS、HTTPS 和接收端均正常",
    diagnosticsFault: "故障类别：{fault}",
    healthValue: "健康度 {value}%",
    hardwareDetail: "{cycles} 次循环 · 温控 {thermal}",
    excellent: "优秀",
    unavailable: "不可用",
    available: "可用",
    reachable: "可达",
    resolved: "正常解析",
    failed: "失败",
    unknown: "未知",
    sampleCount: "{count} 个带准确时间的样本",
    uptime: "在线率 {value}%",
    protectedSample: "防睡眠正常",
    notProtectedSample: "防睡眠缺失",
    batterySample: "电池 {value}%",
    invalidOrigin: "请输入没有路径、查询参数、用户名或密码的有效 HTTPS 面板地址。",
    missingToken: "请输入独立的面板查看密钥。",
    connectFailed: "无法访问私有 API，或该查看者未获授权。",
    refreshData: "刷新数据",
  },
};

let language = sessionStorage.getItem("mac-pulse-language") === "zh" ? "zh" : "en";
let connection = readConnection();
let lastPayload = null;
let timer = null;

const byId = (id) => document.getElementById(id);
const tr = (key, values = {}) => {
  let value = translations[language][key] || translations.en[key] || key;
  Object.entries(values).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, String(replacement));
  });
  return value;
};

function readConnection() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.origin !== "string" || typeof parsed.viewToken !== "string") return null;
    return { origin: parsed.origin, viewToken: parsed.viewToken, edgeToken: typeof parsed.edgeToken === "string" ? parsed.edgeToken : "" };
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function normalizeOrigin(raw) {
  const url = new URL(raw);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) throw new Error("invalid-origin");
  if (url.pathname !== "/" && url.pathname !== "") throw new Error("invalid-origin");
  return url.origin;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function exactTime(value, includeSeconds = true) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    timeZoneName: "short",
  }).format(date);
}

function number(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-CA", { maximumFractionDigits: digits }).format(numeric);
}

function setText(id, value) {
  byId(id).textContent = value;
}

function setTimedText(id, value) {
  const element = byId(id);
  const date = value instanceof Date ? value : parseDate(value);
  element.textContent = exactTime(date);
  element.dateTime = date ? date.toISOString() : "";
}

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  setText("hero-title", tr("heroTitle"));
  byId("language-button").textContent = language === "en" ? "中文" : "EN";
  byId("connect-button").textContent = tr(connection ? "settings" : "connect");
  byId("refresh-button").ariaLabel = tr("refreshData");
  byId("refresh-button").title = tr("refreshData");
  renderModeBanner();
  if (lastPayload) render(lastPayload);
}

function demoPayload() {
  const now = new Date();
  const items = Array.from({ length: 36 }, (_, index) => {
    const at = new Date(now.getTime() - (35 - index) * 40 * 60_000);
    const wave = Math.sin(index / 4.6) * 2.2 + Math.cos(index / 8.2) * 1.1;
    const battery = Math.max(76, Math.min(88, Math.round(82 + wave + index * .035)));
    return {
      id: index + 1,
      reportedAt: at.toISOString(),
      receivedAt: at.toISOString(),
      batteryPercent: battery,
      batteryHealthPercent: 91.6,
      batteryCycleCount: 143,
      thermalState: "nominal",
      charging: true,
      powerSource: "AC Power",
      installed: true,
      serviceState: "running",
      idleSleepPrevented: true,
      health: "healthy",
      networkAvailable: true,
      networkFault: "none",
      networkRouteAvailable: true,
      networkGatewayReachable: true,
      networkDnsAvailable: true,
      networkHttpsAvailable: true,
      networkIngestReachable: true,
      networkGatewayLatencyMs: 12.7,
      networkGatewayJitterMs: 2.4,
      networkGatewayPacketLossPercent: 0,
      networkDiagnosticsMeasuredAt: new Date(now.getTime() - 3 * 60_000).toISOString(),
      internetDownloadMbps: 527,
      internetUploadMbps: 63,
      internetLatencyMs: 18,
      internetResponsivenessRpm: 848,
      internetSpeedMeasuredAt: new Date(now.getTime() - 17 * 60_000).toISOString(),
    };
  });
  const latest = { ...items.at(-1), reportedAt: new Date(now.getTime() - 4_000).toISOString(), receivedAt: new Date(now.getTime() - 3_000).toISOString() };
  return {
    mode: "demo",
    syncedAt: now,
    status: { age_seconds: 4, online: true, awake: true, overall: "healthy", latest },
    history: { items, summary: { uptime_percent: 100 } },
  };
}

async function apiRequest(path) {
  const headers = { Accept: "application/json", Authorization: `Bearer ${connection.viewToken}` };
  if (connection.edgeToken) headers["OAI-Sites-Authorization"] = `Bearer ${connection.edgeToken}`;
  const response = await fetch(`${connection.origin}${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`api-${response.status}`);
  return response.json();
}

async function livePayload() {
  const [status, history] = await Promise.all([
    apiRequest("/api/status"),
    apiRequest("/api/history?range=24h&limit=120"),
  ]);
  if (!status || typeof status !== "object" || !history || !Array.isArray(history.items)) throw new Error("invalid-api-response");
  return { mode: "private", syncedAt: new Date(), status, history };
}

function renderModeBanner(problem = false) {
  const banner = byId("mode-banner");
  banner.classList.toggle("connected", Boolean(connection) && !problem);
  setText("mode-title", tr(problem ? "connectionProblem" : connection ? "privateLive" : "publicDemo"));
  setText("mode-copy", tr(problem ? "connectionProblemCopy" : connection ? "privateCopy" : "demoCopy"));
  byId("disconnect-button").hidden = !connection;
  byId("connect-button").textContent = tr(connection ? "settings" : "connect");
}

function render(payload) {
  lastPayload = payload;
  const { status, history } = payload;
  const latest = status.latest || {};
  const modeIsPrivate = payload.mode === "private";
  const overallKey = status.overall === "healthy" ? "awakeProtected" : status.overall === "unprotected" ? "unprotected" : status.overall === "stale" ? "stale" : "offline";
  const awake = Boolean(status.online && status.awake);
  setText("overall-state", tr(overallKey));
  setText("overall-detail", status.age_seconds === null || status.age_seconds === undefined ? tr("noHeartbeat") : tr("heartbeatReceived", { seconds: number(status.age_seconds) }));
  byId("pulse-summary").classList.toggle("problem", !awake || status.overall !== "healthy");
  setText("sync-label", tr(modeIsPrivate ? "liveSynced" : "demoRefreshed"));
  setTimedText("sync-time", payload.syncedAt);

  const battery = Number.isFinite(Number(latest.batteryPercent)) ? Number(latest.batteryPercent) : null;
  setText("battery-percent", battery === null ? "—" : `${number(battery)}%`);
  byId("battery-bar").style.width = `${battery === null ? 0 : Math.max(0, Math.min(100, battery))}%`;
  setText("battery-detail", latest.charging && latest.powerSource === "AC Power" ? tr("chargingAc") : tr("onPower", { source: latest.powerSource || "—" }));

  const protectedState = latest.serviceState === "running" && Boolean(latest.idleSleepPrevented);
  setText("keepawake-state", tr(protectedState ? "active" : "inactive"));
  byId("keepawake-state").classList.toggle("good", protectedState);
  setText("keepawake-detail", tr(protectedState ? "assertionVerified" : "assertionMissing"));

  const networkGood = latest.networkFault === "none" || (latest.networkAvailable === true && !latest.networkFault);
  setText("network-state", tr(networkGood ? "healthy" : "degraded"));
  byId("network-state").classList.toggle("good", networkGood);
  setText("network-detail", networkGood ? tr("diagnosticsPass") : tr("diagnosticsFault", { fault: latest.networkFault || tr("unknown") }));

  const batteryHealth = Number.isFinite(Number(latest.batteryHealthPercent)) ? Number(latest.batteryHealthPercent) : null;
  setText("hardware-state", batteryHealth === null ? tr("unavailable") : tr("healthValue", { value: number(batteryHealth, 1) }));
  setText("hardware-detail", tr("hardwareDetail", { cycles: number(latest.batteryCycleCount), thermal: latest.thermalState || tr("unknown") }));

  const speedAvailable = Number.isFinite(Number(latest.internetDownloadMbps));
  setText("download-speed", number(latest.internetDownloadMbps));
  setText("upload-speed", number(latest.internetUploadMbps));
  setText("latency", speedAvailable ? `${number(latest.internetLatencyMs, 1)} ms` : "—");
  setText("jitter", Number.isFinite(Number(latest.networkGatewayJitterMs)) ? `${number(latest.networkGatewayJitterMs, 1)} ms` : "—");
  setText("packet-loss", Number.isFinite(Number(latest.networkGatewayPacketLossPercent)) ? `${number(latest.networkGatewayPacketLossPercent, 1)}%` : "—");
  setText("speed-health", tr(speedAvailable ? "excellent" : "unavailable"));
  setTimedText("network-time", latest.internetSpeedMeasuredAt || latest.networkDiagnosticsMeasuredAt);

  setDiagnostic("diag-route", latest.networkRouteAvailable, "available");
  setDiagnostic("diag-gateway", latest.networkGatewayReachable, "reachable");
  setDiagnostic("diag-dns", latest.networkDnsAvailable, "resolved");
  setDiagnostic("diag-https", latest.networkHttpsAvailable, "available");
  setDiagnostic("diag-ingest", latest.networkIngestReachable, "reachable");

  const items = Array.isArray(history.items) ? history.items : [];
  renderChart(items);
  renderTimeline(items);
  const uptime = Number(history.summary?.uptime_percent);
  setText("uptime", tr("uptime", { value: Number.isFinite(uptime) ? number(uptime, 2) : "—" }));
  renderModeBanner();
}

function setDiagnostic(id, value, successKey) {
  setText(id, tr(value === true ? successKey : value === false ? "failed" : "unknown"));
  const item = byId(id).closest("li");
  item.classList.toggle("failed", value === false);
  item.querySelector("i").style.background = value === false ? "var(--red)" : value === null || value === undefined ? "var(--muted)" : "var(--green)";
  byId(id).style.color = value === false ? "var(--red)" : value === null || value === undefined ? "var(--muted)" : "var(--green)";
}

function renderChart(items) {
  const points = items
    .map((item) => ({ at: parseDate(item.reportedAt || item.receivedAt), value: Number(item.batteryPercent) }))
    .filter((item) => item.at && Number.isFinite(item.value))
    .slice(-60);
  const line = byId("chart-line");
  const area = byId("chart-area");
  const labels = byId("chart-labels");
  labels.replaceChildren();
  if (!points.length) {
    line.setAttribute("points", "");
    area.setAttribute("d", "");
    setText("history-range", "—");
    setText("history-samples", tr("sampleCount", { count: 0 }));
    return;
  }
  const values = points.map((point) => point.value);
  const min = Math.max(0, Math.floor(Math.min(...values) - 3));
  const max = Math.min(100, Math.ceil(Math.max(...values) + 3));
  const range = Math.max(1, max - min);
  const plotted = points.map((point, index) => {
    const x = 46 + (index / Math.max(1, points.length - 1)) * 654;
    const y = 198 - ((point.value - min) / range) * 174;
    return { ...point, x, y };
  });
  const pointString = plotted.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  line.setAttribute("points", pointString);
  area.setAttribute("d", `M ${plotted[0].x.toFixed(1)} 198 L ${pointString.replaceAll(" ", " L ")} L ${plotted.at(-1).x.toFixed(1)} 198 Z`);
  setText("history-range", `${number(Math.min(...values))}–${number(Math.max(...values))}%`);
  setText("history-samples", tr("sampleCount", { count: points.length }));
  [0, Math.floor((plotted.length - 1) / 2), plotted.length - 1].forEach((index, labelIndex) => {
    const point = plotted[index];
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", point.x.toFixed(1));
    label.setAttribute("y", "222");
    label.setAttribute("text-anchor", labelIndex === 0 ? "start" : labelIndex === 2 ? "end" : "middle");
    label.textContent = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-CA", { hour: "2-digit", minute: "2-digit" }).format(point.at);
    labels.append(label);
  });
}

function renderTimeline(items) {
  const timeline = byId("timeline");
  timeline.replaceChildren();
  items.slice(-5).reverse().forEach((item) => {
    const row = document.createElement("li");
    const time = document.createElement("time");
    const at = parseDate(item.reportedAt || item.receivedAt);
    time.dateTime = at ? at.toISOString() : "";
    time.textContent = at ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(at) : "—";
    const state = document.createElement("span");
    const dot = document.createElement("i");
    const label = document.createElement("b");
    const protectedState = item.serviceState === "running" && Boolean(item.idleSleepPrevented);
    label.textContent = tr(protectedState ? "protectedSample" : "notProtectedSample");
    if (!protectedState) dot.style.background = "var(--red)";
    state.append(dot, label);
    const battery = document.createElement("strong");
    battery.textContent = Number.isFinite(Number(item.batteryPercent)) ? tr("batterySample", { value: number(item.batteryPercent) }) : "—";
    row.append(time, state, battery);
    timeline.append(row);
  });
  if (!timeline.children.length) {
    const row = document.createElement("li");
    row.textContent = tr("noHeartbeat");
    timeline.append(row);
  }
}

function renderConnectionFailure() {
  renderModeBanner(true);
  setText("sync-label", tr("connectionProblem"));
  setTimedText("sync-time", new Date());
  setText("overall-state", tr("offline"));
  setText("overall-detail", tr("connectFailed"));
  byId("pulse-summary").classList.add("problem");
}

async function refresh() {
  byId("refresh-button").classList.add("loading");
  try {
    const payload = connection ? await livePayload() : demoPayload();
    render(payload);
  } catch {
    renderConnectionFailure();
  } finally {
    byId("refresh-button").classList.remove("loading");
  }
}

function restartTimer() {
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
}

function openConnectionDialog() {
  byId("connection-error").hidden = true;
  byId("api-origin").value = connection?.origin || "";
  byId("view-token").value = "";
  byId("edge-token").value = "";
  byId("connection-dialog").showModal();
  byId("api-origin").focus();
}

function connect(event) {
  event.preventDefault();
  const error = byId("connection-error");
  let origin;
  try {
    origin = normalizeOrigin(byId("api-origin").value.trim());
  } catch {
    error.textContent = tr("invalidOrigin");
    error.hidden = false;
    return;
  }
  const viewToken = byId("view-token").value.trim();
  if (!viewToken) {
    error.textContent = tr("missingToken");
    error.hidden = false;
    return;
  }
  connection = { origin, viewToken, edgeToken: byId("edge-token").value.trim() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(connection));
  byId("connection-form").reset();
  byId("connection-dialog").close();
  lastPayload = null;
  renderModeBanner();
  refresh();
  restartTimer();
}

function disconnect() {
  connection = null;
  lastPayload = null;
  sessionStorage.removeItem(SESSION_KEY);
  renderModeBanner();
  refresh();
  restartTimer();
}

byId("language-button").addEventListener("click", () => {
  language = language === "en" ? "zh" : "en";
  sessionStorage.setItem("mac-pulse-language", language);
  applyLanguage();
});
byId("connect-button").addEventListener("click", openConnectionDialog);
byId("disconnect-button").addEventListener("click", disconnect);
byId("refresh-button").addEventListener("click", refresh);
byId("dialog-close").addEventListener("click", () => byId("connection-dialog").close());
byId("connection-form").addEventListener("submit", connect);
byId("connection-dialog").addEventListener("click", (event) => {
  if (event.target === byId("connection-dialog")) byId("connection-dialog").close();
});

applyLanguage();
refresh();
restartTimer();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}));
}
