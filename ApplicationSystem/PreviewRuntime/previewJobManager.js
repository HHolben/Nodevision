import crypto from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

export class PreviewJobManager {
  constructor({ runner, workspaceManager, sanitizer, config } = {}) {
    this.runner = runner;
    this.workspaceManager = workspaceManager;
    this.sanitizer = sanitizer;
    this.config = config;
    this.jobs = new Map(); // id -> jobRecord
  }

  createJob({ language, timeoutMs, source }) {
    const id = crypto.randomUUID();
    const job = {
      id,
      status: 'queued',
      createdAt: nowIso(),
      startedAt: null,
      completedAt: null,
      language,
      timeoutMs,
      source,
      result: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  async runJob(job) {
    job.status = 'running';
    job.startedAt = nowIso();
    const start = Date.now();

    let workspace = null;
    try {
      workspace = await this.workspaceManager.stageWorkspaceForJob(job, this.config);
      const raw = await this.runner.run(
        { language: job.language, sourcePath: workspace.sourcePath, timeoutMs: job.timeoutMs },
        { signal: null },
      );
      const safe = this.sanitizer.sanitizeResult(
        {
          ok: Boolean(raw.ok),
          language: job.language,
          stdout: raw.stdout,
          stderr: raw.stderr,
          exitCode: raw.exitCode,
          timedOut: raw.timedOut,
          runner: this.runner.runner,
        },
        this.config,
      );
      job.result = safe;
      job.status = 'completed';
      return safe;
    } finally {
      job.completedAt = nowIso();
      job.durationMs = Date.now() - start;
      await workspace?.cleanup?.();
    }
  }
}
