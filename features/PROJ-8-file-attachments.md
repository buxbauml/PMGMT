# PROJ-8: File Attachments

## Status: Planned
**Created:** 2026-02-14
**Last Updated:** 2026-02-14

## Dependencies
- Requires: PROJ-4 (Task Management) - files are attached to tasks

## User Stories
- As a workspace member, I want to attach files to tasks so that I can share relevant documents
- As a workspace member, I want to download attached files so that I can view them locally
- As a file uploader, I want to delete attachments I uploaded so that I can remove outdated files
- As a workspace member, I want to see file previews for images so that I can quickly identify them
- As a workspace member, I want to see who uploaded a file and when so that I know the source

## Acceptance Criteria
- [ ] User can upload files to any task in their workspace
- [ ] Supported file types: images (jpg, png, gif, webp), documents (pdf, docx, txt), archives (zip)
- [ ] Maximum file size: 10MB per file
- [ ] User can upload multiple files at once
- [ ] Task detail shows list of all attached files
- [ ] File list shows filename, size, uploader name, and upload date
- [ ] User can download any attached file
- [ ] Image files show thumbnail preview
- [ ] User can delete files they uploaded
- [ ] Workspace admin can delete any file
- [ ] File storage uses Supabase Storage with public URLs

## Edge Cases
- What happens if user uploads file larger than 10MB? → Show error "File too large, max 10MB"
- What happens if user uploads unsupported file type? → Show error with list of allowed types
- What happens if task is deleted? → All attached files are deleted from storage
- What happens if file uploader is removed from workspace? → Files remain, show "[Former member]" as uploader
- What happens if upload fails due to network error? → Show retry option, don't create attachment record
- What happens if storage quota is exceeded? → Show error "Storage limit reached, upgrade plan"

## Technical Requirements
- **Storage:** Use Supabase Storage buckets with RLS policies
- **Permissions:** All workspace members can upload, admins can delete any file
- **Performance:** Upload progress indicator, file list load < 300ms
- **Validation:** File size max 10MB, file type whitelist
- **File Types:** image/jpeg, image/png, image/gif, image/webp, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, application/zip
- **Bucket Name:** task-attachments (one bucket per workspace)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
