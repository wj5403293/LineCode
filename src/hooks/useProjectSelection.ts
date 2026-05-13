import { useState, useCallback, useEffect } from 'react';
import { projectService, ProjectOption } from '../services/ProjectService';

export type { ProjectOption };

const DEFAULT_PROJECT: ProjectOption = {
  id: 'default',
  label: 'LineCode',
  desc: '默认 home 工作区',
  path: '',
  source: 'default',
};

export function useProjectSelection() {
  const [projects, setProjects] = useState<ProjectOption[]>([DEFAULT_PROJECT]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption>(DEFAULT_PROJECT);

  const refreshProjects = useCallback(async () => {
    const [nextProjects, selected] = await Promise.all([
      projectService.getProjects(),
      projectService.getSelectedProject(),
    ]);
    setProjects(nextProjects);
    setSelectedProject(selected);
    return { projects: nextProjects, selected };
  }, []);

  useEffect(() => {
    refreshProjects().catch(() => {});
    return projectService.subscribe((selected, nextProjects) => {
      setProjects(nextProjects);
      setSelectedProject(selected);
    });
  }, [refreshProjects]);

  const handleProjectSelect = useCallback(async (id: string) => {
    const selected = await projectService.setSelectedProject(id);
    const nextProjects = await projectService.getProjects();
    setProjects(nextProjects);
    setSelectedProject(selected);
    return selected;
  }, []);

  const handleOpenProject = useCallback(async () => {
    const selected = await projectService.openSafProject();
    if (selected) {
      const nextProjects = await projectService.getProjects();
      setProjects(nextProjects);
      setSelectedProject(selected);
    }
    return selected;
  }, []);

  const handleCreateProject = useCallback(async (name: string) => {
    const selected = await projectService.createProject(name);
    const nextProjects = await projectService.getProjects();
    setProjects(nextProjects);
    setSelectedProject(selected);
    return selected;
  }, []);

  return {
    projects,
    selectedProject,
    handleProjectSelect,
    handleOpenProject,
    handleCreateProject,
    refreshProjects,
  };
}
