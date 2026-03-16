import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
}

async function rmrf(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function stageWorkspaceForJob(job, config) {
  const root = config.workspaceRoot;
  await ensureDir(root);

  const workspaceDir = await fs.mkdtemp(path.join(root, `job-${job.id}-`));
  const sourcePath = path.join(workspaceDir, job.source.fileName);

  await fs.writeFile(sourcePath, job.source.content, { encoding: 'utf8', mode: 0o600 });

  async function cleanup() {
    await rmrf(workspaceDir);
  }

  return {
    workspaceDir,
    sourcePath,
    cleanup,
  };
}
