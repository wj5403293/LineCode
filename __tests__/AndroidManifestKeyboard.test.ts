import fs from 'fs';
import path from 'path';

describe('AndroidManifest keyboard avoidance configuration', () => {
  it('uses adjustPan so Android pans focused input above the keyboard by default', () => {
    const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');

    expect(manifest).toContain('android:windowSoftInputMode="adjustPan"');
    expect(manifest).not.toContain('android:windowSoftInputMode="adjustResize"');
  });
});
