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
    detailPath: string;
  };
}

export interface ArtifactInspection {
  artifactDir: string;
  artifactDirLabel: string;
  versionCode: number;
  versionName: string;
  changelog: string;
  manifest: {
    versionCode: number;
    versionName: string;
    bundlePath: string;
    fileCount: number;
    files: ManifestFile[];
  };
  localFiles: {
    zipPath: string;
    detailPath: string;
    zipSha256: string;
    zipSize: number;
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
  status: 'local' | 'published' | 'deleted';
  active: boolean;
  createdAt: string;
  deletedAt?: string;
  artifactDir: string;
  manifest: ArtifactInspection['manifest'];
  local: {
    zipPath: string;
    detailPath: string;
  };
  cloud: null | {
    provider: 'lanzou';
    folderId: number;
    uploadedAt: string;
    files: {
      zip: CloudFile;
      detail: CloudFile;
    };
  };
  deleteErrors?: string[];
}

export interface CloudFile {
  fileId: string;
  shareId: string;
  name: string;
  sizeLabel: string;
  shareUrl: string;
  password: string;
}

