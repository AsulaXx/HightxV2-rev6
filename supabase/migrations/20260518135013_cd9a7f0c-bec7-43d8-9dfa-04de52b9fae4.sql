UPDATE public.topup_provider_config
SET config = jsonb_set(
  jsonb_set(config, '{plernpay,clientId}', '"pi_3bf7a55aa66b6ae030b68fa74957b7f1"'),
  '{plernpay,clientSecret}', '"ps_5c0803d5a6101d41beb30b9d09e81819a5feb7f2a0b596c6dc4f643e36c449ac"'
), updated_at = now()
WHERE id = 'topup';