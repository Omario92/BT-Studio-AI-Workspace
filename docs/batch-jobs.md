# Batch Jobs Architecture

This document describes how BT Studio AI Workspace handles high-throughput batch operations without requiring structural database schema migrations, ensuring zero-friction production deployments.

---

## 1. The Design Challenge
In AI workflows (such as creating multiple storyboard frames, variation generation, or batch rendering), users require executing multiple operations concurrently and monitoring their aggregated progress.

The standard database architecture would involve creating a `BatchRun` table linked to individual `AIJob` rows. However, introducing new tables in a live production environment (like Railway) carries several risks:
* Pending migration lockouts.
* Schema synchronization desyncs between local and cloud databases.
* Complications in rollback procedures.

---

## 2. Zero-Migration Batch Orchestration
To eliminate database schema risks, BT Studio AI Workspace stores batch relationships dynamically within the `params` JSON column of the existing `AIJob` table. 

Every child job generated as part of a batch is tagged with a unique `batchId` string inside its JSON parameters object:

```json
{
  "prompt": "futuristic cityscape, neon lights",
  "steps": 25,
  "batchId": "batch_1716584293021_x9f8"
}
```

This single decision allows tracking arbitrary groups of jobs instantly, without adding any tables, foreign keys, or complex join queries.

---

## 3. Core Implementation

### Enqueueing Batches
The batch controller invokes `createBatch()` in `backend/src/modules/jobs/jobs.service.ts`. This routine:
1. Generates a unique `batchId` string prefixed with `batch_`.
2. Loops through the array of input parameters, creating a standard `IMAGE_GENERATION` job for each.
3. Injects the shared `batchId` into the `params` object of each child job.
4. Enqueues each job into the BullMQ background processing queue.
5. Saves a single audit log entry in the `ActivityLog` to record that a batch operation has commenced.

```typescript
export async function createBatch(
  projectId: string,
  toolId: string,
  inputs: { name?: string; params: Record<string, unknown> }[],
  userId: string,
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const jobs = [];

  for (const input of inputs) {
    const job = await prisma.aIJob.create({
      data: {
        name: input.name || `Batch Frame`,
        type: JobType.IMAGE_GENERATION,
        projectId,
        toolId,
        params: { ...input.params, batchId } as Prisma.InputJsonValue,
        userId,
        status: JobStatus.QUEUED,
      },
    });

    const queueJobId = await enqueueJob(job.id, JobType.IMAGE_GENERATION);
    await prisma.aIJob.update({ where: { id: job.id }, data: { queueJobId } });
    jobs.push(job);
  }

  // Audit Log
  await prisma.activityLog.create({
    data: {
      action: 'started batch',
      entityType: 'job',
      entityId: batchId,
      detail: `${inputs.length} jobs enqueued`,
      userId,
      projectId,
    },
  });

  return { batchId, totalJobs: inputs.length, jobs };
}
```

---

## 4. Querying and Status Aggregation
When the frontend wants to poll the status of a batch, it queries `GET /api/jobs/batches/:batchId`. The backend retrieves and aggregates all associated jobs in real time using Prisma's native JSON path query operators:

```typescript
export async function getBatchStatus(batchId: string) {
  const jobs = await prisma.aIJob.findMany({
    where: {
      params: {
        path: ['batchId'],
        equals: batchId,
      },
    },
    include: {
      assets: {
        select: { id: true, name: true, fileUrl: true, status: true },
      },
    },
  });

  const total = jobs.length;
  const completed = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
  const failed = jobs.filter(j => j.status === JobStatus.FAILED).length;
  const running = jobs.filter(j => j.status === JobStatus.RUNNING).length;

  return {
    batchId,
    total,
    completed,
    failed,
    running,
    jobs,
  };
}
```

### Benefits
* **No Migrations**: Safe, instantaneous deployments.
* **Elastic Grouping**: A job can be associated with different batches or operational scopes simply by adding elements to the JSON payload.
* **On-the-Fly Aggregation**: Because status fields are updated atomically by the BullMQ processor, pulling state aggregates dynamically is fast, correct, and does not require complex state syncing algorithms.
