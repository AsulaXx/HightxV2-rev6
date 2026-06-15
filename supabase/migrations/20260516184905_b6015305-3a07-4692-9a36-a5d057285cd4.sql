insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);

create policy "Public read product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Anyone can upload product images" on storage.objects for insert with check (bucket_id = 'product-images');
create policy "Anyone can update product images" on storage.objects for update using (bucket_id = 'product-images');
create policy "Anyone can delete product images" on storage.objects for delete using (bucket_id = 'product-images');