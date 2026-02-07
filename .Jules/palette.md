# Palette's Journal

## 2024-05-22 - Journal Initiated
**Learning:** Initial setup.
**Action:** Start observing UX opportunities.

## 2024-05-22 - Admin Sidebar Accessibility
**Learning:** Navigation links often lack `aria-current="page"`, making it hard for screen reader users to know their current location. Also, loading skeletons can be silent for SR users.
**Action:** Always add `aria-current` to active navigation links and use `sr-only` text with `aria-hidden` skeletons for loading states.
