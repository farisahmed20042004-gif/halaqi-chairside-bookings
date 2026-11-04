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
- Services are never hard-deleted: "delete" sets `services.deleted_at` (forces `is_active=false`); barber lists filter `deleted_at is null`. Why: past appointments keep their `service_id` link while their name/price snapshot stays unchanged.
- A customer's saved barbers live in `customer_barbers` (one row per customer+barber, added only via the `save_my_barber` RPC, removed one at a time); the phone keeps an append-only array under localStorage `halaqi_barbers_list`, each entry tagged with its account, only to restore missing rows. Why: each code is entered once and survives new devices, a shared phone never mixes accounts, and a direct insert could link arbitrary shops.
- Customer screens (`/customer`, `/my-bookings`, `/settings`) share the bottom `CustomerNav`; a booking the barber cancelled shows as "rejected" via `get_my_bookings().cancelled_by_barber`. Why: no separate rejected status exists in the database.
- Money history lives only in `debts` + `payments` (insert-only for barbers, never updated in amount or deleted); `customer_debts` is a read-only `security_invoker` view over them (one row per debt or payment) and remaining = debts − payments. Why: one source of truth, so the ledger can never drift from the overpayment checks and row rules on the real tables.
- Debt/payment notifications are written by database triggers into `notifications` (with amount and remaining balance); customer screens listen live through `CustomerNav`'s realtime subscription on their own notifications. Why: the barber's app can't be trusted to notify, and one subscription per screen keeps realtime cheap.
