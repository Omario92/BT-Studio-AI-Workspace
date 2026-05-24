# Google Drive vs. Object Storage for AI Output Hosting

This document details why **S3-compatible Object Storage** is implemented as primary hot storage for BT Studio AI Workspace, while **Google Drive** is configured strictly for optional archiving/backups.

---

## Comparative Matrix

| Feature | S3-Compatible Storage (Cloudflare R2 / AWS S3) | Google Drive (Service Account / Shared Drives) |
| :--- | :--- | :--- |
| **Primary Purpose** | High-performance application asset serving. | Document storage, human-facing collaboration. |
| **Throughput/Latency** | Extremely low latency (<50ms), infinite scale. | Moderately high latency (>500ms API roundtrip). |
| **Access Control** | Fine-grained ACLs, programmatic Signed URLs. | Complex OAuth2, sharing permissions, email invites. |
| **API Quotas/Limits** | Virtually unlimited (billed strictly by request volume). | Severe rate-limiting, daily upload quotas (e.g. 750GB/day). |
| **Web Previews** | Works natively with HTML5 `<img>`, `<video>`, `<audio>`. | Requires custom webview wrapper; direct hotlinks are unreliable. |

---

## Why Google Drive is Archive-Only

High-frequency AI generator pipelines (like ComfyUI or RunPod workloads) output thousands of assets, upscales, and video TVC clips. Hosting these as direct application previews using Google Drive presents severe operational risks:

1. **API Rate Limiting & Copy Quotas**: Frequent, simultaneous uploads and retrievals from multi-user sessions will quickly trigger Google's service quota restrictions, causing AI job completions to fail.
2. **Missing Hotlinks**: HTML `<img src="...">` tags cannot natively render Google Drive sharing links without traversing Google's auth page or utilizing fragile third-party proxy solutions.
3. **Billing Transparency**: Standard Object Storage (especially egress-free options like Cloudflare R2) is orders of magnitude cheaper for programmatic app access than commercial Google Workspace storage upgrades.

---

## Recommended Deployment setup
- **Development**: Set `STORAGE_DRIVER=local` for zero-configuration, lightning-fast filesystem storage.
- **Production**: Set `STORAGE_DRIVER=s3` pointing to Cloudflare R2 or AWS S3.
- **Backup**: Enable `GOOGLE_DRIVE_ENABLED=true` to automatically archive client approved key visuals or final storyboard renders into a clean Shared Drive folder structure for long-term storage and human collaboration!
