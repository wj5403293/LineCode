import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { openDocumentTree } from 'react-native-saf-x';
import { workspaceFs } from './WorkspaceFileSystem';

const STORAGE_KEY = '@linecode_projects';
const SELECTED_KEY = '@linecode_selected_project';
const DEFAULT_PROJECT_ID = 'default';
const LINECODE_ROOT = `${RNFS.DocumentDirectoryPath}/.linecode`;
const DEFAULT_HOME_PATH = `${LINECODE_ROOT}/home`;
const PROJECT_ROOT = `${LINECODE_ROOT}/project`;

export type ProjectSource = 'default' | 'managed' | 'saf';

export interface ProjectOption {
  id: string;
  label: string;
  desc?: string;
  path: string;
  source: ProjectSource;
}

type Listener = (project: ProjectOption, projects: ProjectOption[]) => void;

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

function uniqueProjects(projects: ProjectOption[]): ProjectOption[] {
  const seen = new Set<string>();
  const next: ProjectOption[] = [];
  for (const project of [defaultProject(), ...projects]) {
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    next.push(project);
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
    const stored = json ? JSON.parse(json) as ProjectOption[] : [];
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

  async openSafProject(): Promise<ProjectOption | null> {
    if (Platform.OS !== 'android') {
      throw new Error('SAF 目录选择仅支持 Android');
    }

    const doc = await openDocumentTree(true);
    if (!doc) return null;

    const project: ProjectOption = {
      id: `saf:${doc.uri}`,
      label: doc.name || '外部项目',
      desc: 'SAF 外部目录',
      path: doc.uri,
      source: 'saf',
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
    if (project.source === 'saf') {
      const exists = await workspaceFs.exists(project.path);
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
