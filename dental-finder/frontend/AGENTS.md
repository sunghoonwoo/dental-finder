<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:protected-ui-specs -->
# Protected UI Specs — DO NOT REVERT

These specs apply to `app/clinics/page.tsx` and must survive all future structural/logic changes.

## Galaxy Fold Optimization
- Main container horizontal padding: `px-2` (8px)
- Search input placeholder: `"검색"` (never `"치과명 검색"` or `"치과명으로 검색하세요..."`)
- Search input classes: `flex-1` and `min-w-0`
- "경험 공유" button classes: `flex-shrink-0` and `whitespace-nowrap` (must stay in same row as input)
- Search row container: `flex flex-row items-center` (no `flex-col`)

## Pre-Restructure Protocol
Before any major directory/file movement or `git add -A`:
1. Check for uncommitted UI changes (`git status`)
2. Run `git stash` or notify user to commit/stash active UI tweaks
3. Ask user: "Are there any uncommitted UI changes I should preserve?"
<!-- END:protected-ui-specs -->
