"use client";
/* eslint-disable jsx-a11y/label-has-associated-control -- localized tx() text is inside each wrapping label */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Language = "en" | "zh";
type AuthState = "checking" | "authorized" | "token-required";
type HistoryRange = "1h" | "6h" | "24h" | "7d" | "30d" | "all" | "custom";

type Sample = {
  id: number;
  receivedAt: string;
  reportedAt: string;
  version: string;
  health: string;
  mode: string;
  installed: boolean;
  serviceState: string;
  pid: number | null;
  idleSleepPrevented: boolean;
  powerSource: string;
  batteryPercent: number | null;
  charging: boolean | null;
  lidClosed: boolean | null;
  networkChecked: boolean;
  networkAvailable: boolean | null;
  chromeChecked: boolean;
  chromeRunning: boolean | null;
};

type StatusResponse = {
  server_time: string;
  viewer_auth: "siwc" | "token";
  offline_after_seconds: number;
  expected_check_in_seconds: number;
  age_seconds: number | null;
  online: boolean;
  awake: boolean;
  overall: "healthy" | "offline" | "unprotected";
  latest: Sample | null;
};

type HistorySummary = {
  total_samples: number;
  first_received_at: string | null;
  last_received_at: string | null;
  protected_samples: number;
  min_battery: number | null;
  max_battery: number | null;
  outage_seconds: number;
  uptime_percent: number | null;
  approximate_storage_bytes: number;
  storage_is_estimate: boolean;
};

type HistoryResponse = {
  items: Sample[];
  next_cursor: number | null;
  summary: HistorySummary;
};

type AlertSettings = {
  enabled: boolean;
  offline_after_seconds: number;
  battery_threshold: number;
  alert_keepawake: boolean;
  alert_power: boolean;
  alert_network: boolean;
  alert_chrome: boolean;
  updated_at: string;
};

type AlertEvent = {
  id: number;
  created_at: string;
  kind: string;
  state: "active" | "recovered" | "test";
  severity: string;
  message: string;
  delivered: number | boolean;
  delivery_error: string | null;
};

type AlertsResponse = {
  settings: AlertSettings;
  webhook_configured: boolean;
  events: AlertEvent[];
};

function parseUtcTimestamp(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
}

function toIsoTimestamp(value: string) {
  const date = parseUtcTimestamp(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function formatTime(value: string | null, language: Language, exact = true) {
  if (!value) return language === "zh" ? "暂无" : "None yet";
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-CA", {
    year: exact ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: exact ? "2-digit" : undefined,
    timeZoneName: exact ? "short" : undefined,
  }).format(date);
}

function formatAge(seconds: number | null, language: Language) {
  if (seconds === null) return language === "zh" ? "从未" : "never";
  if (seconds < 10) return language === "zh" ? "刚刚" : "just now";
  if (seconds < 60) return language === "zh" ? `${seconds} 秒前` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return language === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return language === "zh" ? `${hours} 小时前` : `${hours}h ago`;
}

function formatDuration(seconds: number, language: Language) {
  if (seconds < 60) return language === "zh" ? `${seconds} 秒` : `${seconds}s`;
  if (seconds < 3_600) return language === "zh" ? `${Math.round(seconds / 60)} 分钟` : `${Math.round(seconds / 60)}m`;
  return language === "zh" ? `${(seconds / 3_600).toFixed(1)} 小时` : `${(seconds / 3_600).toFixed(1)}h`;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function historyTickIndices(length: number) {
  if (!length) return [];
  const last = length - 1;
  return [...new Set([0, Math.round(last * .25), Math.round(last * .5), Math.round(last * .75), last])];
}

function mergeSamples(older: Sample[], newer: Sample[]) {
  const byId = new Map([...older, ...newer].map((sample) => [sample.id, sample]));
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

export default function Dashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [clock, setClock] = useState(0);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState<HistoryRange>("24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  const tx = useCallback((en: string, zh: string) => language === "zh" ? zh : en, [language]);

  const authorizedFetch = useCallback((path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(path, { ...init, headers, cache: "no-store" });
  }, [token]);

  const loadStatus = useCallback(async (candidateToken?: string, signal?: AbortSignal) => {
    const headers = new Headers();
    if (candidateToken) headers.set("Authorization", `Bearer ${candidateToken}`);
    const response = await fetch("/api/status", { headers, cache: "no-store", signal });
    if (response.status === 401) throw new Error("unauthorized");
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json() as StatusResponse;
    setStatus(data);
    setClock(Date.now());
    setMessage("");
    return data;
  }, []);

  const historyQuery = useMemo(() => {
    const params = new URLSearchParams({ range, limit: "180" });
    if (range === "custom" && appliedCustom) {
      params.set("from", new Date(appliedCustom.from).toISOString());
      params.set("to", new Date(appliedCustom.to).toISOString());
    }
    return params;
  }, [appliedCustom, range]);

  const loadHistory = useCallback(async (cursor?: number) => {
    if (range === "custom" && !appliedCustom) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams(historyQuery);
      if (cursor) params.set("cursor", String(cursor));
      const response = await authorizedFetch(`/api/history?${params}`);
      if (!response.ok) throw new Error("history");
      const data = await response.json() as HistoryResponse;
      setHistory((current) => cursor ? mergeSamples(data.items, current) : data.items);
      setHistorySummary(data.summary);
      setHistoryCursor(data.next_cursor);
      if (!cursor) setSelectedSampleId(data.items.at(-1)?.id ?? null);
    } catch {
      setMessage(tx("History could not be loaded.", "历史数据暂时无法载入。"));
    } finally {
      setHistoryLoading(false);
    }
  }, [appliedCustom, authorizedFetch, historyQuery, range, tx]);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await authorizedFetch("/api/alerts");
      if (!response.ok) throw new Error("alerts");
      setAlerts(await response.json() as AlertsResponse);
    } catch {
      setMessage(tx("Alert settings could not be loaded.", "提醒设置暂时无法载入。"));
    }
  }, [authorizedFetch, tx]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const preferred: Language = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
      setLanguage(preferred);
      const saved = sessionStorage.getItem("mac-pulse-view-token") ?? "";
      setToken(saved);
      void loadStatus(saved || undefined, controller.signal).then(() => {
        setAuthState("authorized");
      }).catch((error: Error) => {
        if (error.name === "AbortError") return;
        setAuthState(error.message === "unauthorized" ? "token-required" : "authorized");
        setMessage(error.message === "unauthorized" ? "" : preferred === "zh" ? "状态服务暂时无法连接。" : "Status service is temporarily unavailable.");
      });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (authState !== "authorized") return;
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [authState, loadHistory]);

  useEffect(() => {
    if (authState !== "authorized") return;
    const timer = window.setTimeout(() => void loadAlerts(), 0);
    return () => window.clearTimeout(timer);
  }, [authState, loadAlerts]);

  useEffect(() => {
    if (authState !== "authorized") return;
    const refresh = window.setInterval(() => void loadStatus(token || undefined).catch(() => setMessage(tx("Refresh failed.", "刷新失败。"))), 10_000);
    const tick = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [authState, loadStatus, token, tx]);

  const currentAge = useMemo(() => {
    if (!status || status.age_seconds === null) return null;
    return status.age_seconds + Math.max(0, Math.floor((clock - Date.parse(status.server_time)) / 1_000));
  }, [clock, status]);
  const latest = status?.latest ?? null;
  const online = Boolean(status && currentAge !== null && currentAge <= status.offline_after_seconds);
  const awake = Boolean(online && latest?.serviceState === "running" && latest.idleSleepPrevented);
  const overall = !online ? "offline" : awake ? "healthy" : "unprotected";
  const battery = latest?.batteryPercent;
  const selectedSample = history.find((sample) => sample.id === selectedSampleId) ?? history.at(-1) ?? null;
  const displayedHistory = history.length <= 120 ? history : history.filter((_, index) => index % Math.ceil(history.length / 120) === 0 || index === history.length - 1);
  const historyTicks = historyTickIndices(displayedHistory.length);
  const nextExpected = latest ? new Date(parseUtcTimestamp(latest.receivedAt).getTime() + (status?.expected_check_in_seconds ?? 60) * 1_000).toISOString() : null;

  const risk = useMemo(() => {
    if (!online) return tx("No fresh heartbeat. Sleep, power loss, or network loss are possible.", "没有新心跳；可能是睡眠、断电或断网。 ");
    if (!latest?.idleSleepPrevented || latest.serviceState !== "running") return tx("KeepAwake is not verified. The Mac may idle-sleep.", "KeepAwake 未验证，电脑可能进入闲置睡眠。 ");
    if (latest.networkChecked && latest.networkAvailable === false) return tx("The network check failed. Remote access is unlikely.", "网络检查失败，远程连接很可能不可用。 ");
    if (latest.chromeChecked && latest.chromeRunning === false) return tx("Chrome Remote Desktop is not running.", "Chrome Remote Desktop 没有运行。 ");
    if (/battery/i.test(latest.powerSource) && latest.charging !== true) return tx("Running on battery. Watch remaining charge.", "正在使用电池，请留意剩余电量。 ");
    return tx("No current blocker is visible in the latest heartbeat.", "最新心跳中未发现明确阻碍。 ");
  }, [latest, online, tx]);

  const connection = useMemo(() => {
    if (!online) return tx("Not currently reachable", "目前可能无法连接");
    if (latest?.networkChecked && latest.networkAvailable === false) return tx("Remote access unlikely", "远程连接可能失败");
    if (latest?.chromeChecked && latest.chromeRunning === false) return tx("Chrome remote access may fail", "Chrome 远程连接可能失败");
    if (!latest?.networkChecked || !latest.chromeChecked) return tx("Mac is awake; remote path not fully checked", "电脑清醒；远程链路未完全检查");
    return tx("Likely reachable", "大概率可以连接");
  }, [latest, online, tx]);

  const diagnosticRows = useMemo(() => [
    {
      label: "KeepAwake",
      checked: Boolean(latest),
      passed: Boolean(latest?.idleSleepPrevented && latest.serviceState === "running"),
      detail: latest?.idleSleepPrevented ? tx("Assertion and service reported active", "Assertion 与服务均报告正常") : tx("Restart the KeepAwake user service when you regain access", "恢复连接后重启 KeepAwake 用户服务"),
    },
    {
      label: tx("Power", "电源"),
      checked: Boolean(latest),
      passed: Boolean(latest && (!/battery/i.test(latest.powerSource) || latest.charging)),
      detail: latest ? `${latest.powerSource}${battery === null ? "" : ` · ${battery}%`}` : tx("No report", "没有数据"),
    },
    {
      label: tx("Network", "网络"),
      checked: Boolean(latest?.networkChecked),
      passed: latest?.networkAvailable === true,
      detail: !latest?.networkChecked ? tx("Not checked by this reporter", "此 reporter 未检查") : latest.networkAvailable ? tx("Configured check passed", "指定网络检查已通过") : tx("Check router, Wi-Fi, and internet access", "检查路由器、Wi-Fi 与互联网"),
    },
    {
      label: "Chrome Remote Desktop",
      checked: Boolean(latest?.chromeChecked),
      passed: latest?.chromeRunning === true,
      detail: !latest?.chromeChecked ? tx("Not checked by this reporter", "此 reporter 未检查") : latest.chromeRunning ? tx("Process reported running", "进程报告运行中") : tx("Restart Chrome Remote Desktop after access is restored", "恢复连接后重启 Chrome Remote Desktop"),
    },
  ], [battery, latest, tx]);

  const historyEvents = useMemo(() => {
    const events: Array<{ key: string; time: string; text: string }> = [];
    for (let index = 1; index < history.length; index += 1) {
      const before = history[index - 1];
      const after = history[index];
      const gap = (parseUtcTimestamp(after.receivedAt).getTime() - parseUtcTimestamp(before.receivedAt).getTime()) / 1_000;
      if (gap > 90) events.push({ key: `gap-${after.id}`, time: after.receivedAt, text: tx(`Heartbeat recovered after a ${formatDuration(Math.max(0, gap - 60), language)} gap`, `心跳在中断 ${formatDuration(Math.max(0, gap - 60), language)} 后恢复`) });
      if (before.powerSource !== after.powerSource) events.push({ key: `power-${after.id}`, time: after.receivedAt, text: `${tx("Power changed to", "电源切换为")} ${after.powerSource}` });
      if (before.idleSleepPrevented !== after.idleSleepPrevented) events.push({ key: `awake-${after.id}`, time: after.receivedAt, text: after.idleSleepPrevented ? tx("KeepAwake protection recovered", "KeepAwake 防护恢复") : tx("KeepAwake protection stopped", "KeepAwake 防护停止") });
      if (before.lidClosed !== after.lidClosed) events.push({ key: `lid-${after.id}`, time: after.receivedAt, text: after.lidClosed ? tx("Lid closed", "屏幕盖关闭") : tx("Lid opened", "屏幕盖打开") });
    }
    return events.slice(-12).reverse();
  }, [history, language, tx]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    setMessage("");
    try {
      await loadStatus(tokenInput.trim());
      sessionStorage.setItem("mac-pulse-view-token", tokenInput.trim());
      setToken(tokenInput.trim());
      setTokenInput("");
      setAuthState("authorized");
    } catch {
      setMessage(tx("That key was not accepted.", "查看密钥不正确。"));
    }
  }

  function signOut() {
    if (status?.viewer_auth === "siwc") {
      window.location.assign("/signout-with-chatgpt?return_to=%2F");
      return;
    }
    sessionStorage.removeItem("mac-pulse-view-token");
    setToken("");
    setStatus(null);
    setAuthState("token-required");
  }

  async function saveAlerts() {
    if (!alerts) return;
    setAlertsSaving(true);
    try {
      const response = await authorizedFetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alerts.settings),
      });
      if (!response.ok) throw new Error("save");
      const saved = await response.json() as Pick<AlertsResponse, "settings" | "webhook_configured">;
      setAlerts((current) => current ? { ...current, ...saved } : current);
      setMessage(tx("Alert settings saved.", "提醒设置已保存。"));
    } catch {
      setMessage(tx("Alert settings could not be saved.", "提醒设置保存失败。"));
    } finally {
      setAlertsSaving(false);
    }
  }

  async function testAlert() {
    const response = await authorizedFetch("/api/alerts/test", { method: "POST" });
    setMessage(response.ok ? tx("Test alert delivered.", "测试提醒已发送。") : tx("Test alert needs ALERT_WEBHOOK_URL or the destination rejected it.", "需要配置 ALERT_WEBHOOK_URL，或目标拒绝了测试提醒。"));
    await loadAlerts();
  }

  async function copyDiagnostics() {
    const lines = [
      "Mac Pulse diagnostics (no hostname, username, IP, serial number, or secret)",
      `Overall: ${overall}`,
      `Last heartbeat: ${latest ? toIsoTimestamp(latest.receivedAt) : "none"}`,
      `Heartbeat age: ${currentAge ?? "unknown"} seconds`,
      `Power: ${latest?.powerSource ?? "unknown"}; battery: ${battery ?? "unknown"}%`,
      ...diagnosticRows.map((row) => `${row.label}: ${!row.checked ? "not checked" : row.passed ? "passed" : "failed"}`),
      `Version: ${latest?.version ?? "unknown"}; mode: ${latest?.mode ?? "unknown"}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setMessage(tx("Secret-free diagnostics copied.", "不含密钥的诊断摘要已复制。"));
    } catch {
      setMessage(tx("Clipboard access was denied.", "浏览器拒绝了剪贴板权限。"));
    }
  }

  async function exportHistory() {
    const response = await authorizedFetch(`/api/history/export?${historyQuery}`);
    if (!response.ok) {
      setMessage(tx("Export failed.", "导出失败。"));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mac-pulse-history-${range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(response.headers.get("X-Export-Truncated") === "true" ? tx("Exported the first 50,000 rows; narrow the range for the remainder.", "已导出前 50,000 行；请缩小范围以导出其余数据。") : tx("History exported.", "历史数据已导出。"));
  }

  async function deleteHistory() {
    if (deletePhrase !== "DELETE HISTORY") return;
    const response = await authorizedFetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deletePhrase }),
    });
    if (!response.ok) {
      setMessage(tx("History deletion failed.", "历史删除失败。"));
      return;
    }
    setDeletePhrase("");
    setDeleteOpen(false);
    setHistory([]);
    await loadHistory();
    setMessage(tx("Heartbeat history deleted. This cannot be undone.", "心跳历史已删除，无法恢复。"));
  }

  if (authState === "checking") {
    return (
      <main className="access-shell" aria-busy="true">
        <section className="access-card"><div className="access-brand"><span className="brand-mark">M</span><strong>Mac Pulse</strong></div><p className="eyebrow">PRIVATE REMOTE MONITOR</p><h1>打开 Mac 监控面板</h1><p className="access-copy">{tx("Checking your private site session…", "正在验证私密站点登录…")}</p></section>
      </main>
    );
  }

  if (authState === "token-required") {
    return (
      <main className="access-shell">
        <section className="access-card">
          <button className="language-button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} type="button">{language === "zh" ? "English" : "中文"}</button>
          <div className="access-brand"><span className="brand-mark">M</span><strong>Mac Pulse</strong></div>
          <p className="eyebrow">LOCAL DEVELOPMENT FALLBACK</p>
          <h1>{tx("Open your Mac dashboard", "打开 Mac 监控面板")}</h1>
          <p className="access-copy">{tx("The private hosted site signs you in automatically. Enter a viewing key only for local development or API fallback.", "私密托管站点会自动登录。只有本地开发或 API 备用访问才需要查看密钥。")}</p>
          <form onSubmit={unlock}><label htmlFor="view-key">{tx("Viewing key", "查看密钥")}</label><div className="key-row"><input id="view-key" type="password" autoComplete="current-password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /><button type="submit">{tx("Open dashboard", "打开面板")}</button></div></form>
          {message && <p className="form-error" role="alert">{message}</p>}
          <p className="privacy-copy"><i className="privacy-dot" /> {tx("No hostname, username, IP address, serial number, or secret is shown.", "不会显示电脑名称、用户名、IP、序列号或密钥。")}</p>
        </section>
      </main>
    );
  }

  const title = overall === "healthy" ? tx("Mac is awake and protected", "电脑清醒且防睡眠正常") : overall === "offline" ? tx("Mac is not checking in", "电脑已停止报到") : tx("Mac is online but unprotected", "电脑在线但防睡眠未生效");
  const statusLabel = overall === "healthy" ? tx("Healthy", "正常") : overall === "offline" ? tx("Offline", "离线") : tx("Attention", "需注意");

  return (
    <main className={`dashboard-shell state-${overall}`}>
      <div className="sr-only" role="status" aria-live="polite">{message || `${statusLabel}. ${formatAge(currentAge, language)}`}</div>
      <nav className="topbar" aria-label={tx("Dashboard navigation", "监控面板导航")}>
        <div className="brand-mark" aria-hidden="true">M</div><div className="brand-copy"><strong>Mac Pulse</strong><span>{tx("Remote Mac monitor", "远程 Mac 监控")}</span></div>
        <div className="top-actions"><button className="quiet-button" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button><button className="quiet-button" type="button" onClick={signOut}>{tx("Sign out", "退出")}</button><div className="live-pill"><i aria-hidden="true" /> {statusLabel}</div></div>
      </nav>

      {message && <div className="notice" role="status">{message}</div>}

      <section className="hero" aria-labelledby="dashboard-title">
        <div><p className="eyebrow">REMOTE MACBOOK PRO</p><h1 id="dashboard-title">{title}</h1><p className="hero-copy">{connection}. {risk}</p></div>
        <button className="refresh-button" type="button" onClick={() => { void loadStatus(token || undefined); void loadHistory(); }}>{tx("Refresh now", "立即刷新")}</button>
      </section>

      <section className="summary-grid" aria-label={tx("Connection summary", "连接摘要")}>
        <article className="summary-card summary-primary"><div className="card-heading"><span>{tx("Remote connection", "远程连接")}</span><span className={`status-badge ${overall}`}><i aria-hidden="true" />{statusLabel}</span></div><strong className="summary-value">{connection}</strong><p>{risk}</p></article>
        <article className="summary-card"><span>{tx("Last heartbeat — exact local time", "最后心跳 — 本地准确时间")}</span><strong><time dateTime={latest ? toIsoTimestamp(latest.receivedAt) : undefined}>{latest ? formatTime(latest.receivedAt, language) : tx("None yet", "暂无")}</time></strong><small>{formatAge(currentAge, language)} · {currentAge !== null && currentAge <= (status?.expected_check_in_seconds ?? 60) + 15 ? tx("on schedule", "按时") : tx("overdue", "已超时")}</small></article>
        <article className="summary-card"><span>{tx("Next expected check-in", "预计下次心跳")}</span><strong><time dateTime={nextExpected ?? undefined}>{formatTime(nextExpected, language)}</time></strong><small>{tx("Expected every 60 seconds; this is not a guarantee.", "预计每 60 秒一次，并非保证。")}</small></article>
        <article className="summary-card"><span>{tx("Battery & power", "电池与电源")}</span><strong>{battery === null || battery === undefined ? "—" : `${battery}%`} · {latest?.powerSource ?? "—"}</strong><small>{latest?.charging ? tx("Charging", "充电中") : tx("Not charging", "未充电")}</small></article>
      </section>

      <section className="diagnostics-card" aria-labelledby="diagnostics-title">
        <div className="section-heading"><div><span>{tx("Evidence-based checks", "基于数据的检查")}</span><h2 id="diagnostics-title">{tx("Remote access diagnostics", "远程连接诊断")}</h2></div><button className="secondary-button" type="button" onClick={() => void copyDiagnostics()}>{tx("Copy safe diagnostics", "复制安全诊断")}</button></div>
        <div className="diagnostic-grid">{diagnosticRows.map((row) => <article key={row.label}><div><span className={`diagnostic-icon ${!row.checked ? "unknown" : row.passed ? "passed" : "failed"}`} aria-hidden="true">{!row.checked ? "?" : row.passed ? "✓" : "!"}</span><strong>{row.label}</strong></div><p>{!row.checked ? tx("Not checked", "未检查") : row.passed ? tx("Passed", "通过") : tx("Needs attention", "需处理")}</p><small>{row.detail}</small></article>)}</div>
        <p className="evidence-note">{tx("A failed or missing check narrows the possibilities; it does not prove a single root cause and cannot remotely wake a sleeping or powered-off Mac.", "失败或缺失的检查只能缩小可能范围，不能证明唯一原因，也无法远程唤醒已睡眠或关机的 Mac。")}</p>
      </section>

      <section className="history-card" aria-labelledby="history-title">
        <div className="section-heading"><div><span>{tx("Complete retained data", "完整留存数据")}</span><h2 id="history-title">{tx("Battery & heartbeat history", "电量与心跳历史")}</h2></div><div className="section-actions"><button className="secondary-button" type="button" onClick={() => void exportHistory()}>{tx("Export CSV", "导出 CSV")}</button><button className="danger-link" type="button" onClick={() => setDeleteOpen((open) => !open)}>{tx("Delete history", "删除历史")}</button></div></div>
        <div className="range-row" role="group" aria-label={tx("History range", "历史范围")}>{(["1h", "6h", "24h", "7d", "30d", "all", "custom"] as HistoryRange[]).map((value) => <button key={value} className={range === value ? "is-active" : ""} aria-pressed={range === value} type="button" onClick={() => setRange(value)}>{value === "all" ? tx("All", "全部") : value === "custom" ? tx("Custom", "自定") : value}</button>)}</div>
        {range === "custom" && <form className="custom-range" onSubmit={(event) => { event.preventDefault(); if (customFrom && customTo) setAppliedCustom({ from: customFrom, to: customTo }); }}><label>{tx("From", "开始")}<input type="datetime-local" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label><label>{tx("To", "结束")}<input type="datetime-local" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label><button type="submit">{tx("Apply", "应用")}</button></form>}
        <div className="history-stats"><article><span>{tx("Samples", "样本")}</span><strong>{historySummary?.total_samples.toLocaleString() ?? "—"}</strong></article><article><span>{tx("Estimated uptime", "估算在线率")}</span><strong>{historySummary?.uptime_percent === null || historySummary?.uptime_percent === undefined ? "—" : `${historySummary.uptime_percent.toFixed(2)}%`}</strong></article><article><span>{tx("Detected outage time", "检测到的中断时间")}</span><strong>{formatDuration(historySummary?.outage_seconds ?? 0, language)}</strong></article><article><span>{tx("Estimated storage", "估算存储")}</span><strong>≈ {formatBytes(historySummary?.approximate_storage_bytes ?? 0)}</strong></article></div>
        <p className="evidence-note">{tx("Uptime is inferred from heartbeat gaps. Storage is an estimate; all accepted samples are kept until you delete them or the hosting lifecycle removes them.", "在线率依据心跳间隔推算；存储量为估算。所有已接收样本会保留，直到你删除或托管生命周期移除。")}</p>
        <div className="history-scroll" role="region" aria-label={tx("Scrollable battery chart", "可滚动电量图表")}><div className="history-bars" style={{ gridTemplateColumns: `repeat(${Math.max(displayedHistory.length, 1)}, minmax(10px, 1fr))` }}>{displayedHistory.map((sample) => { const selected = selectedSample?.id === sample.id; const description = `${formatTime(sample.receivedAt, language)} · ${sample.batteryPercent ?? "—"}% · ${sample.idleSleepPrevented ? tx("protected", "已防护") : tx("unprotected", "未防护")}`; return <button key={sample.id} type="button" className={`history-bar${sample.idleSleepPrevented ? "" : " unprotected-bar"}${selected ? " is-selected" : ""}`} style={{ height: `${Math.max(8, sample.batteryPercent ?? 8)}%` }} title={description} aria-label={`${tx("Select sample", "选择样本")}: ${description}`} aria-pressed={selected} onClick={() => setSelectedSampleId(sample.id)} />; })}{!displayedHistory.length && <span className="empty-history">{historyLoading ? tx("Loading…", "载入中…") : tx("No samples in this range", "此范围没有样本")}</span>}</div></div>
        {displayedHistory.length > 0 && <div className="history-axis">{historyTicks.map((index) => { const sample = displayedHistory[index]; const position = displayedHistory.length === 1 ? 0 : index / (displayedHistory.length - 1) * 100; return <time key={sample.id} className={index === 0 ? "axis-first" : index === displayedHistory.length - 1 ? "axis-last" : ""} style={{ left: `${position}%` }} dateTime={toIsoTimestamp(sample.receivedAt)}>{formatTime(sample.receivedAt, language, false)}</time>; })}</div>}
        {selectedSample && <div className="history-detail" aria-live="polite"><div><span>{tx("Exact local timestamp", "本地准确时间")}</span><strong><time dateTime={toIsoTimestamp(selectedSample.receivedAt)}>{formatTime(selectedSample.receivedAt, language)}</time></strong></div><div><span>{tx("Battery", "电量")}</span><strong>{selectedSample.batteryPercent ?? "—"}%</strong></div><div><span>KeepAwake</span><strong>{selectedSample.idleSleepPrevented ? tx("Protected", "已防护") : tx("Not protected", "未防护")}</strong></div><div><span>{tx("Power", "电源")}</span><strong>{selectedSample.powerSource}</strong></div></div>}
        {historyCursor && <button className="load-more" type="button" disabled={historyLoading} onClick={() => void loadHistory(historyCursor)}>{historyLoading ? tx("Loading…", "载入中…") : tx("Load earlier samples", "载入更早样本")}</button>}
        <div className="event-list"><h3>{tx("Detected transitions", "检测到的状态变化")}</h3>{historyEvents.length ? historyEvents.map((event) => <div key={event.key}><time dateTime={toIsoTimestamp(event.time)}>{formatTime(event.time, language)}</time><span>{event.text}</span></div>) : <p>{tx("No transitions detected in loaded samples.", "已载入样本中没有检测到状态变化。")}</p>}</div>
        {deleteOpen && <div className="danger-zone" role="group" aria-labelledby="delete-title"><h3 id="delete-title">{tx("Permanently delete all heartbeat history", "永久删除全部心跳历史")}</h3><p>{tx("This cannot be undone. Type DELETE HISTORY exactly.", "此操作无法撤销。请准确输入 DELETE HISTORY。")}</p><div><input aria-label={tx("Deletion confirmation", "删除确认文字")} value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} /><button type="button" disabled={deletePhrase !== "DELETE HISTORY"} onClick={() => void deleteHistory()}>{tx("Delete permanently", "永久删除")}</button></div></div>}
      </section>

      <section className="alerts-card" aria-labelledby="alerts-title">
        <div className="section-heading"><div><span>{tx("Optional outbound notification", "可选外部通知")}</span><h2 id="alerts-title">{tx("Alert center", "提醒中心")}</h2></div><span className={`config-pill ${alerts?.webhook_configured ? "configured" : ""}`}>{alerts?.webhook_configured ? tx("Webhook configured", "Webhook 已配置") : tx("Webhook not configured", "Webhook 未配置")}</span></div>
        {alerts ? <><div className="alert-settings"><label className="switch-row"><input type="checkbox" checked={alerts.settings.enabled} onChange={(event) => setAlerts({ ...alerts, settings: { ...alerts.settings, enabled: event.target.checked } })} /><span><strong>{tx("Enable alerts", "开启提醒")}</strong><small>{tx("Events are recorded and a minimal webhook is attempted.", "记录事件，并尝试发送最小化 webhook。")}</small></span></label><label>{tx("Offline after (seconds)", "离线阈值（秒）")}<input type="number" min="90" max="3600" value={alerts.settings.offline_after_seconds} onChange={(event) => setAlerts({ ...alerts, settings: { ...alerts.settings, offline_after_seconds: Number(event.target.value) } })} /></label><label>{tx("Low battery at (%)", "低电量阈值（%）")}<input type="number" min="5" max="90" value={alerts.settings.battery_threshold} onChange={(event) => setAlerts({ ...alerts, settings: { ...alerts.settings, battery_threshold: Number(event.target.value) } })} /></label></div><div className="toggle-grid">{(["alert_keepawake", "alert_power", "alert_network", "alert_chrome"] as const).map((key) => { const label = key === "alert_keepawake" ? "KeepAwake" : key === "alert_power" ? tx("Power", "电源") : key === "alert_network" ? tx("Network", "网络") : "Chrome Remote Desktop"; return <div key={key}><input id={`toggle-${key}`} type="checkbox" checked={alerts.settings[key]} onChange={(event) => setAlerts({ ...alerts, settings: { ...alerts.settings, [key]: event.target.checked } })} /><label htmlFor={`toggle-${key}`}>{label}</label></div>; })}</div><div className="section-actions"><button className="primary-button" type="button" disabled={alertsSaving} onClick={() => void saveAlerts()}>{alertsSaving ? tx("Saving…", "保存中…") : tx("Save alert settings", "保存提醒设置")}</button><button className="secondary-button" type="button" onClick={() => void testAlert()}>{tx("Send test", "发送测试")}</button></div><p className="evidence-note">{tx("The webhook contains only product, alert kind/state/severity, and time—never device identity, battery details, PID, or secrets. Offline alerts require an external scheduler to call the protected check endpoint because an offline Mac cannot report itself.", "Webhook 只包含产品名、提醒类型/状态/级别与时间，绝不包含设备身份、电量细节、PID 或密钥。离线提醒需要外部定时器调用受保护的检查端点，因为离线 Mac 无法自行上报。")}</p><div className="alert-events"><h3>{tx("Recent alert events", "最近提醒事件")}</h3>{alerts.events.length ? alerts.events.map((event) => <div key={event.id}><span className={`event-state ${event.state}`}>{event.state}</span><strong>{event.message}</strong><time dateTime={toIsoTimestamp(event.created_at)}>{formatTime(event.created_at, language)}</time><small>{event.delivered ? tx("Delivered", "已发送") : event.delivery_error ?? tx("Not delivered", "未发送")}</small></div>) : <p>{tx("No alert transitions recorded yet.", "尚未记录提醒状态变化。")}</p>}</div></> : <p>{tx("Loading alert settings…", "正在载入提醒设置…")}</p>}
      </section>

      <footer><span><i className="privacy-dot" /> {tx("Private, owner-only monitoring", "私密、仅限所有者的监控")}</span><span>{tx("Last refresh", "最后刷新")} · {formatAge(currentAge, language)}</span></footer>
    </main>
  );
}
