import { projectService } from './ProjectService';
import {
  WorkspaceAccessPolicy,
  createWorkspaceAccessPolicy,
} from './WorkspaceFileSystem';

class ToolAccessPolicyService {
  async buildPolicy(homePath: string): Promise<WorkspaceAccessPolicy> {
    const appRoot = projectService.getLinecodeRoot();
    return createWorkspaceAccessPolicy({
      homePath,
      extraReadRoots: [
        `${appRoot}/skills`,
        `${appRoot}/evolution`,
        `${homePath}/.linecode/skills`,
      ],
      extraWriteRoots: [],
    });
  }
}

export const toolAccessPolicyService = new ToolAccessPolicyService();
