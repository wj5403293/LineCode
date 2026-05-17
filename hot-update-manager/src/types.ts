export interface LanzouSettings {
  folderId: number;
  hasCookie: boolean;
  maskedCookie: string;
  lastVerifiedAt: string | null;
  lastError: string;
}

export interface SummaryData {
  schemaVersion: number;
  settings: {
    lanzou: LanzouSettings;
    artifactDir: string;
  };
  releases: ReleaseRecord[];
  defaults: {
    artifactDir: string;
  };
  updateHost: {
    zipPath: string;
    indexPath: string;
  };
}

export interface ArtifactInspection {
  artifactDir: string;
  artifactDirLabel: string;
  versionCode: number;
  versionName: string;
  changelog: string;
  requiresApk: boolean;
  apkUrl: string;
  manifest: {
    versionCode: number;
    versionName: string;
    bundlePath: string;
    fileCount: number;
    files: ManifestFile[];
  };
  localFiles: {
    zipPath: string;
    indexPath: string;
    detailPath: string;
    detailFile: string;
    zipSha256: string;
    zipSize: number;
    indexSize: number;
    detailSize: number;
  };
}

export interface ManifestFile {
  path: string;
  sha256: string;
  size: number;
}

export interface ReleaseRecord {
  id: string;
  versionCode: number;
  versionName: string;
  changelog: string;
  requiresApk: boolean;
  apkUrl: string;
  zipSha256?: string;
  zipSize?: number;
  status: 'local' | 'published' | 'archived' | 'deleted';
  active: boolean;
  createdAt: string;
  archivedAt?: string;
  deletedAt?: string;
  artifactDir: string;
  manifest: ArtifactInspection['manifest'];
  local: {
    zipPath: string;
    indexPath: string;
    detailPath: string;
  };
  updateIndex?: {
    releases: ReleaseChainItem[];
  };
  cloud: null | {
    provider: 'lanzou';
    folderId: number;
    uploadedAt: string;
    files: {
      zip: CloudFile | null;
      index: CloudFile | null;
      detail: CloudFile;
    };
  };
  deleteErrors?: string[];
}

export interface ReleaseChainItem {
  versionCode: number;
  versionName: string;
  changelog: string;
  requiresApk: boolean;
  apkUrl?: string;
  createdAt?: string;
  detailFile?: string;
  zipFile?: string;
}

export interface CloudFile {
  fileId: string;
  shareId: string;
  name: string;
  sizeLabel: string;
  shareUrl: string;
  password: string;
}
