-- A user can link at most one identity per provider. The existing
-- (provider, provider_account_id) unique index still prevents one external
-- identity from being linked to multiple users.
CREATE UNIQUE INDEX "accounts_user_id_provider_key" ON "accounts"("user_id", "provider");
