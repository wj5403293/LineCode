import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { getPersistedUriPermissions, openDocumentTree } from 'react-native-saf-x';
import { androidExternalStorage, safTreeUriToFileSystemPath } from './AndroidExternalStorage';
import { workspaceFs } from './WorkspaceFileSystem';
import { getSafDocumentDisplayName } from '../utils/safDocument';

const STORAGE_KEY = '@linecode_projects';
const SELECTED_KEY = '@linecode_selected_project';
const DEFAULT_PROJECT_ID = 'default';
const LINECODE_ROOT = `${RNFS.DocumentDirectoryPath}/.linecode`;
const DEFAULT_HOME_PATH = `${LINECODE_ROOT}/home`;
const PROJECT_ROOT = `${LINECODE_ROOT}/project`;

export type ProjectSource = 'default' | 'managed' | 'external';

export interface ProjectOption {
  id: string;
  label: string;
  desc?: string;
  path: string;
  source: ProjectSource;
}

type Listener = (project: ProjectOption, projects: ProjectOption[]) => void;
type StoredProjectOption = Omit<ProjectOption, 'source'> & { source?: ProjectSource | 'saf' };

function defaultProject(): ProjectOption {
  return {
    id: DEFAULT_PROJECT_ID,
    label: 'LineCode',
    desc: '默认 home 工作区',
    path: DEFAULT_HOME_PATH,
    source: 'default',
  };
}

function sanitizeProjectName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 60);
}

function isContentUri(path: string): boolean {
  return path.startsWith('content://');
}

async function listPersistedUris(): Promise<Set<string>> {
  try {
    const list = await getPersistedUriPermissions();
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function extractContentUri(message: string): string | null {
  const match = message.match(/content:\/\/[^\s,)'"]+/i);
  return match ? match[0] : null;
}

async function pickExternalTreeUri(): Promise<{ uri: string | null; name?: string }> {
  // saf-x 内部 openDocumentTree 在 takePersistableUriPermission 之后再做 stat，
  // 部分设备上 stat 会抛 "Unsupported uri" 等错误，但此时 URI 已经持久化。
  // 这里记录调用前后的持久化列表做差集，作为 reject 时的兜底恢复路径。
  const before = await listPersistedUris();

  try {
    const doc = await openDocumentTree(true);
    if (!doc) return { uri: null };
    return { uri: doc.uri, name: getSafDocumentDisplayName(doc) };
  } catch (err: any) {
    const message = String(err?.message || err || '');
    const after = await listPersistedUris();
    const newUri = [...after].find(item => !before.has(item));
    const fallback = newUri || extractContentUri(message);
    if (!fallback) throw err;
    return { uri: fallback, name: getSafDocumentDisplayName({ uri: fallback }) };
  }
}

function normalizeProject(project: StoredProjectOption): ProjectOption | null {
  if (!project || typeof project.path !== 'string') return null;
  if (project.id === DEFAULT_PROJECT_ID || project.source === 'default') return defaultProject();

  if (project.source === 'saf' || isContentUri(project.path)) {
    const path = safTreeUriToFileSystemPath(project.path);
    if (!path) return null;
    return {
      id: `external:${path}`,
      label: project.label || workspaceFs.basename(path) || '外部项目',
      desc: path,
      path,
      source: 'external',
    };
  }

  const source: ProjectSource = project.source === 'external' ? 'external' : 'managed';
  return {
    id: project.id || `${source}:${project.path}`,
    label: project.label || workspaceFs.basename(project.path) || '项目',
    desc: project.desc || (source === 'external' ? project.path : undefined),
    path: project.path,
    source,
  };
}

function uniqueProjects(projects: StoredProjectOption[]): ProjectOption[] {
  const seen = new Set<string>();
  const next: ProjectOption[] = [];
  for (const project of [defaultProject(), ...projects]) {
    const normalized = normalizeProject(project);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    next.push(normalized);
  }
  return next;
}

class ProjectService {
  private projects: ProjectOption[] | null = null;
  private selectedId: string | null = null;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getProjects(): Promise<ProjectOption[]> {
    if (this.projects) return this.projects;

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = json ? JSON.parse(json) : [];
    const stored = Array.isArray(parsed) ? parsed as StoredProjectOption[] : [];
    this.projects = uniqueProjects(stored);
    await this.saveProjects();
    return this.projects;
  }

  async getSelectedProject(): Promise<ProjectOption> {
    const projects = await this.getProjects();
    if (this.selectedId === null) {
      this.selectedId = await AsyncStorage.getItem(SELECTED_KEY);
    }
    return projects.find(project => project.id === this.selectedId) || projects[0];
  }

  async setSelectedProject(id: string): Promise<ProjectOption> {
    const projects = await this.getProjects();
    const project = projects.find(item => item.id === id) || projects[0];
    this.selectedId = project.id;
    await AsyncStorage.setItem(SELECTED_KEY, project.id);
    await this.ensureProjectPath(project);
    this.notify(project, projects);
    return project;
  }

  async getCurrentHomePath(): Promise<string> {
    const project = await this.getSelectedProject();
    await this.ensureProjectPath(project);
    return project.path;
  }

  async createProject(name: string): Promise<ProjectOption> {
    const cleanName = sanitizeProjectName(name);
    if (!cleanName) {
      throw new Error('项目名不能为空');
    }

    const path = `${PROJECT_ROOT}/${cleanName}`;
    await RNFS.mkdir(path, { NSURLIsExcludedFromBackupKey: true });

    const project: ProjectOption = {
      id: `managed:${cleanName.toLowerCase()}`,
      label: cleanName,
      desc: '.linecode/project',
      path,
      source: 'managed',
    };

    const projects = await this.getProjects();
    const existingIndex = projects.findIndex(item => item.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    await this.saveProjects();
    return this.setSelectedProject(project.id);
  }

  async openExternalProject(): Promise<ProjectOption | null> {
    if (Platform.OS !== 'android') {
      throw new Error('外部目录选择仅支持 Android');
    }

    await androidExternalStorage.ensureManageExternalStorageGranted();

    const { uri, name } = await pickExternalTreeUri();
    if (!uri) return null;

    const path = safTreeUriToFileSystemPath(uri);
    if (!path) {
      throw new Error('无法将系统目录 URI 转换为文件路径。请选择“内部存储/Download/具体目录”等可解析为 /storage/... 的目录。');
    }

    const exists = await RNFS.exists(path);
    if (!exists) {
      throw new Error(`外部目录不可访问: ${path}`);
    }
    const stat = await RNFS.stat(path);
    if (!stat.isDirectory()) {
      throw new Error(`选择的路径不是目录: ${path}`);
    }

    const project: ProjectOption = {
      id: `external:${path}`,
      label: name || workspaceFs.basename(path) || '外部项目',
      desc: path,
      path,
      source: 'external',
    };

    const projects = await this.getProjects();
    const existingIndex = projects.findIndex(item => item.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    await this.saveProjects();
    return this.setSelectedProject(project.id);
  }

  async ensureProjectPath(project: ProjectOption): Promise<void> {
    if (project.source === 'external') {
      const hasPermission = await androidExternalStorage.isManageExternalStorageGranted();
      if (!hasPermission) {
        throw new Error(`${androidExternalStorage.getPermissionDeniedMessage()}: ${project.label}`);
      }

      const exists = await RNFS.exists(project.path);
      if (!exists) {
        throw new Error(`外部项目目录不可访问: ${project.label}`);
      }
      return;
    }
    const exists = await RNFS.exists(project.path);
    if (!exists) {
      await RNFS.mkdir(project.path, { NSURLIsExcludedFromBackupKey: true });
    }
  }

  getDefaultHomePath(): string {
    return DEFAULT_HOME_PATH;
  }

  getProjectDisplayPath(project: ProjectOption): string {
    return workspaceFs.toDisplayPath(project.path);
  }

  getProjectShellPath(project: ProjectOption): string | null {
    if (project.source !== 'external') return null;
    return workspaceFs.toShellPath(project.path);
  }

  async getCurrentDisplayPath(): Promise<string> {
    const project = await this.getSelectedProject();
    return this.getProjectDisplayPath(project);
  }

  async getCurrentShellPath(): Promise<string | null> {
    const project = await this.getSelectedProject();
    return this.getProjectShellPath(project);
  }

  getLinecodeRoot(): string {
    return LINECODE_ROOT;
  }

  getProjectRoot(): string {
    return PROJECT_ROOT;
  }

  private async saveProjects(): Promise<void> {
    const projects = uniqueProjects(this.projects || []);
    this.projects = projects;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects.filter(project => project.id !== DEFAULT_PROJECT_ID)));
  }

  private notify(project: ProjectOption, projects: ProjectOption[]): void {
    this.listeners.forEach(listener => listener(project, projects));
  }
}

export const projectService = new ProjectService();
