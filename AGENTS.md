<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- The app is Arabic-only and RTL: `<html lang="ar" dir="rtl">` is set in `__root.tsx`; use logical layout (start/end, gap) rather than left/right assumptions. Why: every screen must read right-to-left.
- Screens read and write real backend data; never show invented data as if it were real. Why: the user requires that saving, login, conflict prevention and notifications are never implied before they are built and tested.
- PWA is manifest-only (`public/manifest.webmanifest`, icons in `public/icons/`, head links in `__root.tsx`); no service worker unless offline support is explicitly requested. Why: installable/APK-ready without stale-cache risk in previews.
- Layout is mobile-first inside a `max-w-md` frame (`MobileFrame`); barber pages share the bottom `BarberNav`. Why: primary target is Android phone screens.
