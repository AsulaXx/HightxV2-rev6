# Storage Migration Guide — Firebase→Supabase Auth bridge + per-user paths

## What changed

Storage RLS policies now require every file's path to start with the uploader's
**Supabase user id** (`<supabase-uid>/...`). Old files uploaded under
`main/...`, `<firebase-uid>/...`, or `<product-id>/...` no longer match any
INSERT/UPDATE/DELETE policy — reads via the public URL still work, but you
cannot overwrite or delete them from the app.

A new edge function `firebase-supabase-sync` verifies the Firebase ID token and
mints a matching Supabase Auth session on login. All uploads use
`getSupabaseUploadPrefix()` (see `src/lib/supabaseSync.ts`) to prefix the path
with the current Supabase user id.

## Migrating existing files

**Manual re-upload is recommended** — there's no automated mapping because:

- Old `main/...` music paths have no owner recorded
- Old `<product-id>/...` image paths don't tell us which admin uploaded them
- Even where the folder was `<firebase-uid>/...`, the Firebase uid ≠ Supabase uid

### For product images (per product)

1. Open Admin → Products
2. For each product with an existing image, click the upload button and
   re-upload the same file. The new path will be
   `<your-supabase-uid>/<product-id>/<timestamp>.<ext>` and the product's
   `imageUrl`/`thumbnailUrl` fields update automatically.
3. Once verified, an owner can delete the orphaned files from the backend
   Storage UI (Cloud → Storage → product-images → old `<product-id>/...`
   folders that no longer match a current product image URL).

### For background music

1. Admin → Music (site) — re-upload the current music file. New path becomes
   `<your-supabase-uid>/<timestamp>.mp3` and the site's `bgMusic.url` updates.
2. LinkTree pages — open each `/l/<slug>` admin editor, re-upload its music
   file. The page's `bgMusic.url` updates.
3. Old files under `main/...` and legacy `<firebase-uid>/...` are safe to
   delete from the backend Storage UI once all references are re-uploaded.

## Verifying with two accounts

1. Log in as **user A** and note the Supabase user id (browser devtools →
   Application → Local storage → `sb-*-auth-token` → decode JSON → `user.id`).
   Upload a product image — path should be `<A-id>/<product-id>/...`.
2. Log out, log in as **user B** (also admin). Confirm B can upload their own
   images (path becomes `<B-id>/...`) but **cannot** overwrite or delete a
   file inside `<A-id>/...`:
   - Try `supabase.storage.from('product-images').remove(['<A-id>/foo.jpg'])` from the
     browser console — should return an RLS error.
   - Try uploading a file with path `<A-id>/attack.jpg` — should return an RLS error.
3. Confirm neither account can `list()` the bucket — `.list('')` returns
   an empty array (no SELECT policy exists).
4. Confirm reads via public URL still work for both music and product images.

## Rollback

If uploads break unexpectedly, revert by dropping the new policies and
recreating the old broad ones. Public reads via `getPublicUrl` will continue
to work either way.
