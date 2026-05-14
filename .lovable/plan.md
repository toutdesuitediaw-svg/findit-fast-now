# Plan — Durée des annonces, modération configurable & sécurité

## 1. Schéma BDD (migration)

**Table `listings`** — ajouter colonnes :
- `published_at timestamptz` (default `now()`) — date affichée
- `expires_at timestamptz` — par défaut `published_at + 365j`
- `archived_at timestamptz` — date d'archivage
- `renewed_count int default 0`
- `last_renewed_at timestamptz`
- `expiry_notified_30d`, `expiry_notified_7d`, `expiry_notified_0d` (bool) — anti double-envoi

**Trigger** `set_listing_lifecycle` BEFORE INSERT/UPDATE :
- Sur INSERT : si `expires_at` null → `now() + interval '365 days'`
- Empêche le client de modifier `expires_at`, `published_at`, `renewed_count` directement (forcé via fonction RPC)

**Fonction RPC** `renew_listing(listing_id uuid)` SECURITY DEFINER :
- Vérifie ownership
- Anti-spam : un seul renouvellement / 24h, max 6/an si non premium
- Étend `expires_at` de 365 jours, incrémente `renewed_count`, met `published_at = now()`, réactive si archivée

**Table `site_settings`** — ajouter clé `moderation_config` (jsonb) :
```json
{
  "min_distinct_reports": 2,
  "auto_remove_below": 25,
  "quarantine_below": 55,
  "ai_weight": 0.7,
  "behavior_weight": 0.3
}
```
Lue par le trigger `handle_new_report` et l'edge function `moderate-listing`.

**Table `moderation_decisions`** (historique) :
- `case_id`, `listing_id`, `admin_id`, `action` (`quarantine|remove|restore|reanalyze`), `note`, `created_at`
- RLS : admins lecture/écriture, propriétaire annonce lecture seule.

**Index** :
- `listings(expires_at) WHERE is_active = true`
- `listings(archived_at) WHERE archived_at IS NOT NULL`

## 2. Edge functions

**Nouvelle `listings-lifecycle-cron`** (verify_jwt = false, secret partagé) :
1. Marque expirées : `is_active=false`, `archived_at=now()` quand `expires_at < now()` et non archivée
2. Suppression définitive : delete des listings `archived_at < now() - interval '90 days'`
3. Notifications 30j / 7j / 0j → insère dans `moderation_notifications` (réutilise la table) avec `type='expiry_*'`
4. Idempotent via flags `expiry_notified_*`

**Cron pg_cron** (via `supabase--insert`) : exécution quotidienne 03:00 UTC → `net.http_post` vers la function avec secret stocké dans `site_settings.lifecycle_hook`.

**`moderate-listing`** : lit `moderation_config` plutôt que constantes hardcodées.

**`submit-report`** : lit `min_distinct_reports` et seuil de rate-limit depuis `moderation_config`.

## 3. Frontend

**Helper `src/lib/listingDate.ts`** :
- `formatPublishedAt(date)` → "aujourd'hui" / "il y a 2 jours" / "le 12 mai 2026" (date-fns fr)
- `getExpiryStatus(expiresAt)` → `{ status: 'fresh'|'expiring_soon'|'expired', daysLeft }`

**`ListingCard.tsx`** : badges "Nouveau" (<7j), "Expire bientôt" (<7j), "Expirée"; ligne "Publié il y a X".

**`ListingDetail.tsx`** :
- Bloc date publication / dernière mise à jour / expiration
- Si propriétaire & expire <30j : bouton "🔁 Renouveler" (appelle RPC)
- Bandeau statut modération : `quarantined` / `auto_removed` avec résumé `ai_verdict` (catégories, score, raison)
- Lien "Voir détails / Contester" → `/moderation/case/:id`

**`Dashboard.tsx`** : colonnes "Publiée le", "Expire dans", actions Renouveler / Archiver.

**`Admin.tsx` — Onglet Annonces** : nouveau sous-onglet "Archives" + KPI (actives, expirées, expirent <7j, taux renouvellement).

**`ModerationAITab.tsx`** :
- Boutons par cas : **Mettre en quarantaine**, **Supprimer**, **Rétablir**, **Réanalyser** (déjà présent)
- Insère dans `moderation_decisions` à chaque action
- Onglet "Historique" : liste les décisions
- Carte "Paramètres modération" : sliders pour `min_distinct_reports` (1-5), `auto_remove_below`, `quarantine_below` → upsert `site_settings.moderation_config`

## 4. Sécurité — linter Supabase

Lancer `supabase--linter`, corriger tous les WARN/ERROR (typiquement: `search_path` manquants sur fonctions, RLS manquantes, `security definer` views). Itérer jusqu'à 0 alerte.

## 5. Hors-scope (à signaler)
- Renouvellement automatique premium : préparé via `renewed_count` mais pas planifié dans ce lot
- Notifications email d'expiration : créées en in-app uniquement (les emails transactionnels nécessiteraient le scaffold; à faire en lot suivant si demandé)
