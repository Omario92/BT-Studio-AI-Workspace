# Testing Documentation (v0.4)

## Overview
This document outlines the testing procedures for the BT Studio AI Workspace v0.4 release, which includes storage adapters, AI provider integrations, asset versions, reviews, and BullMQ job management.

## 1. Automated Tests (Smoke Tests)
We have implemented a comprehensive programmatic end-to-end smoke test in `backend/scratch/assets.smoke.ts`.

### Running the Smoke Test
```bash
cd backend
npx tsx scratch/assets.smoke.ts
```

### What it tests:
- **Authentication:** Token generation and validation.
- **Project Setup:** Creating test projects.
- **Asset Upload:** Registering an asset and acquiring upload URLs.
- **Versioning:** Transitioning an asset through multiple versions.
- **Review System:** Creating reviews for specific asset versions.
- **State Transitions:** Simulating transitions from `DRAFT` to `IN_REVIEW`, `APPROVED`, etc.
- **Validation:** Ensuring business rules like preventing updates to approved assets are enforced.

## 2. API Endpoint Testing
You can manually test the API endpoints using tools like Postman, Insomnia, or cURL.

### Key Endpoints to Verify:
- `POST /api/assets` - Create a new asset.
- `POST /api/assets/:assetId/versions` - Create a new version for an existing asset.
- `GET /api/assets/:assetId/versions` - List all versions.
- `POST /api/assets/versions/:versionId/reviews` - Submit a review.
- `POST /api/jobs` - Dispatch an AI job.

## 3. Storage Adapters
Testing the Storage providers (Local, S3/R2, Google Drive):
- Ensure `STORAGE_DRIVER` is correctly set in `.env` (e.g., `local` for dev, `s3` for production).
- Verify file uploads are correctly stored in the expected destination.
- Verify download URLs are accessible.

## 4. AI Provider Integration
Testing the AI Providers (RunPod, ComfyUI):
- Ensure `AI_PROVIDER` is set in `.env`.
- Monitor BullMQ workers for job processing.
- Verify job status updates (`PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED`).

## 5. Local Development Testing
When testing locally, you can disable Redis to avoid setup overhead if background workers are not needed for a specific test run:
```bash
DISABLE_REDIS=true npm run dev
```

## 6. Continuous Integration (CI)
These tests should be integrated into our CI/CD pipeline to ensure regression safety on future commits.
