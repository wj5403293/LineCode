import {
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  FileArchive,
  FolderSync,
  KeyRound,
  Loader2,
  LogOut,
  Play,
  RadioTower,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Trash2,
  UploadCloud,
  PackageOpen,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApiError, api } from './api';
import type { ArtifactInspection, CloudFile, ReleaseRecord, SummaryData } from './types';

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [inspection, setInspection] = useState<ArtifactInspection | null>(null);
  const [artifactDir, setArtifactDir] = useState('dist/hot-update');
  const [cloudCookie, setCloudCookie] = useState('');
  const [folderId, setFolderId] = useState(-1);
  const [uploadToLanzou, setUploadToLanzou] = useState(true);
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refreshSummary = useCallback(async () => {
    const data = await api.summary();
    setSummary(data);
    setArtifactDir(current => current || data.settings.artifactDir || data.defaults.artifactDir);
    setFolderId(data.settings.lanzou.folderId);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.me()
      .then(async () => {
        if (cancelled) return;
        setAuthenticated(true);
        const data = await api.summary();
        if (!cancelled) {
          setSummary(data);
          setArtifactDir(data.settings.artifactDir || data.defaults.artifactDir);
          setFolderId(data.settings.lanzou.folderId);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRelease = useMemo(() => summary?.releases.find(release => release.active) || null, [summary]);
  const publishedCount = useMemo(
    () => summary?.releases.filter(release => release.status === 'published' || release.status === 'archived').length || 0,
    [summary],
  );

  const runAction = useCallback(async (label: string, action: () => Promise<string | void>) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await action();
      if (result) setNotice(result);
    } catch (err) {
      const apiError = err as ApiError;
      setError([apiError.message, ...(apiError.errors || [])].filter(Boolean).join('\n'));
    } finally {
      setBusy('');
    }
  }, []);

  const handleLogin = useCallback(async (password: string) => {
    await runAction('login', async () => {
      await api.login(password);
      setAuthenticated(true);
      const data = await refreshSummary();
      setArtifactDir(data.settings.artifactDir || data.defaults.artifactDir);
      return '管理员会话已建立';
    });
  }, [refreshSummary, runAction]);

  const handleLogout = useCallback(async () => {
    await runAction('logout', async () => {
      await api.logout();
      setAuthenticated(false);
      setSummary(null);
      setInspection(null);
    });
  }, [runAction]);

  const handleConnectCloud = useCallback(async () => {
    await runAction('cloud', async () => {
      await api.connectLanzou(cloudCookie, folderId);
      setCloudCookie('');
      await refreshSummary();
      return '蓝奏云连接已验证';
    });
  }, [cloudCookie, folderId, refreshSummary, runAction]);

  const handleTestCloud = useCallback(async () => {
    await runAction('cloud-test', async () => {
      await api.testLanzou(folderId, cloudCookie.trim() || undefined);
      await refreshSummary();
      return '蓝奏云 Cookie 可用';
    });
  }, [cloudCookie, folderId, refreshSummary, runAction]);

  const handleScan = useCallback(async () => {
    await runAction('scan', async () => {
      const nextInspection = await api.scanRelease(artifactDir);
      setInspection(nextInspection);
      await refreshSummary();
      return `已读取 ${nextInspection.versionName}`;
    });
  }, [artifactDir, refreshSummary, runAction]);

  const handlePublish = useCallback(async () => {
    await runAction('publish', async () => {
      const release = await api.publishRelease({ artifactDir, uploadToLanzou, makeActive });
      setInspection(null);
      await refreshSummary();
      return `已发布 ${release.versionName}`;
    });
  }, [artifactDir, makeActive, refreshSummary, runAction, uploadToLanzou]);

  const handleActivate = useCallback(async (release: ReleaseRecord) => {
    await runAction(`activate-${release.id}`, async () => {
      await api.activateRelease(release.id);
      await refreshSummary();
      return `${release.versionName} 已设为当前版本`;
    });
  }, [refreshSummary, runAction]);

  const handleDelete = useCallback(async (release: ReleaseRecord) => {
    if (!window.confirm(`删除 ${release.versionName} 的云端入口并从后续更新链路移除？`)) return;
    await runAction(`delete-${release.id}`, async () => {
      await api.deleteRelease(release.id, true);
      await refreshSummary();
      return `${release.versionName} 已删除`;
    });
  }, [refreshSummary, runAction]);

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <LoginScreen busy={busy === 'login'} error={error} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-block">
          <span className="brand-mark">LC</span>
          <div>
            <p className="eyebrow">LineCode</p>
            <h1>热更新版本管理器</h1>
          </div>
        </div>

        <Metric label="当前版本" value={activeRelease?.versionName || '未激活'} sub={activeRelease ? String(activeRelease.versionCode) : 'base.zip'} />
        <Metric label="发布记录" value={String(summary?.releases.length || 0)} sub={`${publishedCount} 个链路版本`} />

        <nav className="rail-nav" aria-label="管理器导航">
          <a href="#publish"><UploadCloud size={17} />发布</a>
          <a href="#cloud"><Cloud size={17} />蓝奏云</a>
          <a href="#records"><FileArchive size={17} />记录</a>
        </nav>

        <button className="ghost-button rail-logout" type="button" onClick={handleLogout} disabled={Boolean(busy)}>
          <LogOut size={17} />
          退出
        </button>
      </aside>

      <section className="workspace">
        <TopBar summary={summary} notice={notice} error={error} busy={busy} />

        <div className="dashboard-grid">
          <section className="panel publish-panel" id="publish">
            <PanelTitle icon={<ScanSearch size={19} />} title="产物检查" action={summary?.defaults.artifactDir || 'dist/hot-update'} />
            <div className="field-stack">
              <label className="field">
                <span>产物目录</span>
                <input value={artifactDir} onChange={event => setArtifactDir(event.target.value)} placeholder="dist/hot-update" />
              </label>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={handleScan} disabled={Boolean(busy)}>
                  {busy === 'scan' ? <Loader2 className="spin" size={17} /> : <ScanSearch size={17} />}
                  扫描
                </button>
                <button className="primary-button" type="button" onClick={handlePublish} disabled={Boolean(busy)}>
                  {busy === 'publish' ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
                  发布
                </button>
              </div>
              <div className="toggle-row">
                <Toggle label="上传蓝奏云" checked={uploadToLanzou} onChange={setUploadToLanzou} />
                <Toggle label="设为当前版本" checked={makeActive} onChange={setMakeActive} />
              </div>
            </div>
            <InspectionView inspection={inspection} />
          </section>

          <section className="panel cloud-panel" id="cloud">
            <PanelTitle icon={<RadioTower size={19} />} title="蓝奏云连接" action={summary?.settings.lanzou.hasCookie ? summary.settings.lanzou.maskedCookie : '未连接'} />
            <div className="field-stack">
              <label className="field">
                <span>Cookie</span>
                <textarea value={cloudCookie} onChange={event => setCloudCookie(event.target.value)} rows={5} spellCheck={false} />
              </label>
              <label className="field compact-field">
                <span>文件夹 ID</span>
                <input type="number" value={folderId} onChange={event => setFolderId(Number(event.target.value))} />
              </label>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={handleTestCloud} disabled={Boolean(busy) || (!summary?.settings.lanzou.hasCookie && !cloudCookie.trim())}>
                  {busy === 'cloud-test' ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                  测试
                </button>
                <button className="primary-button" type="button" onClick={handleConnectCloud} disabled={Boolean(busy) || !cloudCookie.trim()}>
                  {busy === 'cloud' ? <Loader2 className="spin" size={17} /> : <KeyRound size={17} />}
                  连接
                </button>
              </div>
            </div>
            <CloudStatus settings={summary?.settings.lanzou} />
          </section>

          <section className="panel records-panel" id="records">
            <PanelTitle icon={<FileArchive size={19} />} title="版本记录" action={summary?.updateHost.indexPath || '/base.txt'} />
            <ReleaseList
              releases={summary?.releases || []}
              busy={busy}
              onActivate={handleActivate}
              onDelete={handleDelete}
            />
          </section>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <Loader2 className="spin" size={24} />
        <p>加载管理会话</p>
      </div>
    </div>
  );
}

function LoginScreen({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    void onLogin(password);
  }, [onLogin, password]);

  return (
    <div className="auth-screen">
      <form className="auth-panel login-panel" onSubmit={submit}>
        <span className="auth-kicker"><ShieldCheck size={18} /> Admin</span>
        <h1>热更新发布控制台</h1>
        <label className="field">
          <span>管理员密码</span>
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoFocus />
        </label>
        {error ? <pre className="error-box">{error}</pre> : null}
        <button className="primary-button full-width" type="submit" disabled={busy || !password.trim()}>
          {busy ? <Loader2 className="spin" size={17} /> : <KeyRound size={17} />}
          登录
        </button>
      </form>
    </div>
  );
}

function TopBar({ summary, notice, error, busy }: { summary: SummaryData | null; notice: string; error: string; busy: string }) {
  return (
    <header className="top-bar">
      <div>
        <p className="eyebrow">发布面板</p>
        <h2>base.zip / base.txt</h2>
      </div>
      <div className="status-strip">
        <StatusPill tone={summary?.settings.lanzou.hasCookie ? 'good' : 'neutral'} label={summary?.settings.lanzou.hasCookie ? '云端已配置' : '云端未配置'} />
        <StatusPill tone={busy ? 'warn' : 'good'} label={busy ? '处理中' : '空闲'} />
      </div>
      {notice ? <div className="toast success"><CheckCircle2 size={16} />{notice}</div> : null}
      {error ? <pre className="toast error">{error}</pre> : null}
    </header>
  );
}

function PanelTitle({ icon, title, action }: { icon: ReactNode; title: string; action: string }) {
  return (
    <div className="panel-title">
      <div className="panel-heading">
        {icon}
        <h3>{title}</h3>
      </div>
      <span className="panel-action">{action}</span>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}

function InspectionView({ inspection }: { inspection: ArtifactInspection | null }) {
  if (!inspection) {
    return (
      <div className="empty-state">
        <FolderSync size={20} />
        <span>等待扫描产物</span>
      </div>
    );
  }

  return (
    <div className="inspection-grid">
      <div className="release-headline">
        <span>{inspection.versionName}</span>
        <strong>{inspection.versionCode}</strong>
      </div>
      <dl className="details-list">
        <div><dt>目录</dt><dd>{inspection.artifactDirLabel}</dd></div>
        <div><dt>Bundle</dt><dd>{inspection.manifest.bundlePath}</dd></div>
        <div><dt>文件</dt><dd>{inspection.manifest.fileCount}</dd></div>
        <div><dt>ZIP</dt><dd>{formatBytes(inspection.localFiles.zipSize)}</dd></div>
        <div><dt>安装</dt><dd>{inspection.requiresApk ? '需要新版 APK' : '热更新'}</dd></div>
        <div><dt>详情</dt><dd>{inspection.localFiles.detailFile}</dd></div>
      </dl>
      <pre className="changelog">{inspection.changelog || '暂无更新日志'}</pre>
      <div className="manifest-list">
        {inspection.manifest.files.slice(0, 5).map(file => (
          <div className="manifest-row" key={file.path}>
            <span>{file.path}</span>
            <code>{file.sha256.slice(0, 12)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloudStatus({ settings }: { settings?: SummaryData['settings']['lanzou'] }) {
  if (!settings) return null;
  return (
    <dl className="details-list cloud-details">
      <div><dt>文件夹</dt><dd>{settings.folderId}</dd></div>
      <div><dt>状态</dt><dd>{settings.hasCookie ? '已保存 Cookie' : '未保存 Cookie'}</dd></div>
      <div><dt>验证</dt><dd>{settings.lastVerifiedAt ? formatDate(settings.lastVerifiedAt) : '未验证'}</dd></div>
    </dl>
  );
}

function ReleaseList({
  releases,
  busy,
  onActivate,
  onDelete,
}: {
  releases: ReleaseRecord[];
  busy: string;
  onActivate: (release: ReleaseRecord) => void;
  onDelete: (release: ReleaseRecord) => void;
}) {
  if (releases.length === 0) {
    return (
      <div className="empty-state">
        <FileArchive size={20} />
        <span>暂无发布记录</span>
      </div>
    );
  }

  return (
    <div className="release-list">
      {releases.map(release => (
        <article className={`release-card ${release.active ? 'is-active' : ''}`} key={release.id}>
          <div className="release-main">
            <div>
              <div className="release-title">
                <strong>{release.versionName}</strong>
                <StatusPill tone={statusTone(release.status)} label={statusLabel(release.status)} />
                {release.active ? <StatusPill tone="warn" label="当前" /> : null}
                {release.requiresApk ? <StatusPill tone="warn" label="需要 APK" /> : null}
              </div>
              <p>{release.changelog || '暂无更新日志'}</p>
            </div>
            <div className="release-code">{release.versionCode}</div>
          </div>

          <dl className="details-list release-details">
            <div><dt>创建</dt><dd>{formatDate(release.createdAt)}</dd></div>
            <div><dt>目录</dt><dd>{release.artifactDir}</dd></div>
            <div><dt>文件</dt><dd>{release.manifest.fileCount}</dd></div>
            <div><dt>云端</dt><dd>{release.cloud ? `folder ${release.cloud.folderId}` : '未上传'}</dd></div>
          </dl>

          <ReleaseChain release={release} />

          {release.cloud ? <CloudLinks zip={release.cloud.files.zip} index={release.cloud.files.index} detail={release.cloud.files.detail} /> : null}

          <div className="release-actions">
            <button className="secondary-button" type="button" onClick={() => onActivate(release)} disabled={Boolean(busy) || release.active || release.status === 'deleted'}>
              <Play size={16} />
              激活
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(release)} disabled={Boolean(busy) || release.status === 'deleted'}>
              {busy === `delete-${release.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
              删除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReleaseChain({ release }: { release: ReleaseRecord }) {
  const chain = release.updateIndex?.releases || [{
    versionCode: release.versionCode,
    versionName: release.versionName,
    changelog: release.changelog,
    requiresApk: release.requiresApk,
  }];
  return (
    <div className="chain-list">
      {chain.map(item => (
        <div className="chain-row" key={item.versionCode}>
          {item.requiresApk ? <PackageOpen size={15} /> : <FileArchive size={15} />}
          <strong>{item.versionName}</strong>
          <span>{item.requiresApk ? 'APK' : '热更新'}</span>
          <p>{item.changelog || '暂无更新日志'}</p>
        </div>
      ))}
    </div>
  );
}

function CloudLinks({ zip, index, detail }: { zip: CloudFile | null; index: CloudFile | null; detail: CloudFile }) {
  return (
    <div className="cloud-links">
      <CloudLink label="base.zip" file={zip} />
      <CloudLink label="base.txt" file={index} />
      <CloudLink label={detail.name || 'base-{version}.txt'} file={detail} />
    </div>
  );
}

function CloudLink({ label, file }: { label: string; file: CloudFile | null }) {
  const copy = useCallback(() => {
    if (file?.shareUrl) void navigator.clipboard?.writeText(file.shareUrl);
  }, [file?.shareUrl]);

  return (
    <div className="cloud-link">
      <span>{label}</span>
      <code>{file?.fileId || '已清理'}</code>
      <div className="cloud-link-actions">
        <button className="icon-button" type="button" onClick={copy} title="复制链接" disabled={!file?.shareUrl}>
          <Copy size={15} />
        </button>
        <a className="icon-button" href={file?.shareUrl || '#'} target="_blank" rel="noreferrer" title="打开链接" aria-disabled={!file?.shareUrl}>
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: 'good' | 'warn' | 'danger' | 'neutral'; label: string }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function statusTone(status: ReleaseRecord['status']): 'good' | 'warn' | 'danger' | 'neutral' {
  if (status === 'published') return 'good';
  if (status === 'archived') return 'warn';
  if (status === 'deleted') return 'danger';
  return 'neutral';
}

function statusLabel(status: ReleaseRecord['status']) {
  if (status === 'published') return '已发布';
  if (status === 'archived') return '链路保留';
  if (status === 'deleted') return '已删除';
  return '本地';
}

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default App;
