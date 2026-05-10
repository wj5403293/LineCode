import { useState, useCallback } from 'react';

export interface ProjectOption {
  id: string;
  label: string;
}

const PROJECTS: ProjectOption[] = [
  { id: '1', label: 'LineCode 主项目' },
  { id: '2', label: '移动端 App' },
  { id: '3', label: '后端服务' },
  { id: '4', label: '组件库' },
];

export function useProjectSelection() {
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0]);

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedProject(PROJECTS.find(p => p.id === id) || PROJECTS[0]);
  }, []);

  return { projects: PROJECTS, selectedProject, handleProjectSelect };
}
