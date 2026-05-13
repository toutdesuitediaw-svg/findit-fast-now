# Système de modération IA — TOUT SUITE ANNONCES

## Vue d'ensemble
Mise en place d'un pipeline complet : signalements utilisateurs → analyse IA automatique → score de confiance → action (quarantaine / suppression / alerte) → contestation possible → dashboard admin temps réel.

---

## 1. Base de données (migration)

Nouvelles tables :

- **`moderation_cases`** — un dossier par annonce mise sous analyse
  - `listing_id`, `user_id` (vendeur), `status` (`pending`, `quarantined`, `removed`, `cleared`, `appealed`)
  - `trust_score` (0–100), `risk_level` (`low`/`medium`/`high`/`critical`)
  - `ai_verdict` (jsonb : catégories détectées, raisons, citations)
  - `reports_count`, `auto_action`, `created_at`, `resolved_at`, `resolved_by`

- **`moderation_appeals`** — contestations vendeur
  - `case_id`, `user_id`, `message`, `status` (`open`/`accepted`/`rejected`), timestamps, `admin_note`

- **`moderation_notifications`** — notifications in-app vendeur + admin
  - `user_id`, `case_id`, `type`, `title`, `body`, `read_at`

- **`report_rate_limits`** — anti-abus signalements
  - `user_id`, `day` (date), `count` — limite N signalements/jour

Modifications :
- `listings` : ajouter `quarantined_at`, `trust_score`, `auto_removed`
- `reports` : ajouter `is_valid` (bool, calculé via heuristique anti-spam)

Trigger Postgres :
- Sur `INSERT` dans `reports` → compte les signalements valides distincts (utilisateurs différents) sur la même annonce. Si ≥ 2 → crée/upsert un `moderation_case` `pending` et appelle l'edge function via `pg_net` pour analyse IA.

RLS :
- Vendeur voit ses propres `moderation_cases` + `moderation_appeals` + `moderation_notifications`
- Admin voit/gère tout
- Vendeur peut créer un `moderation_appeals` pour ses cases

---

## 2. Edge Function `moderate-listing` (IA)

Déclenchée par le trigger DB ou manuellement par un admin.

Fait :
1. Charge l'annonce (titre, description, images, vendeur, historique)
2. Récupère contexte vendeur : nb annonces, nb signalements passés, ancienneté, bannissements
3. Appelle Lovable AI Gateway (`google/gemini-3-flash-preview`) avec **tool calling structuré** :
   - input : texte + image URLs (multimodal)
   - tool `moderation_verdict` retournant : `categories[]` (scam, adult, weapons, fake, spam, stolen_image, violence…), `severity`, `confidence`, `trust_score` 0-100, `recommended_action` (`keep`/`quarantine`/`remove`), `reasons[]`, `vendor_risk`
4. Combine score IA + signaux comportementaux (poids fixes) → `final_trust_score`
5. Applique la règle :
   - `score < 25` ou `severity = critical` → `auto_removed`, `is_active=false`, `auto_removed=true`
   - `score 25–55` → `quarantined`, `is_active=false`
   - `score > 55` → `cleared` (laisse en ligne, garde le case pour audit)
6. Insère notifications admin + vendeur
7. Log dans `activity_logs`

Sécurité : `verify_jwt = false` (appelé par trigger), valide via secret partagé (header `x-moderation-secret`).

Gère 429/402 du gateway proprement.

---

## 3. Edge Function `submit-report` (anti-abus)

Wrap autour de l'insertion de signalement :
- Vérifie utilisateur actif (`profiles.status = 'active'`)
- Vérifie `report_rate_limits` (max 5/jour)
- Détecte attaques groupées : si même cible reçoit > 10 reports en < 1h depuis nouveaux comptes → marque `is_valid=false`
- Insère le report → trigger DB prend le relais

`verify_jwt = true`.

---

## 4. UI Admin — `/admin` nouvel onglet "Modération IA"

`src/components/admin/ModerationTab.tsx` :
- **KPIs en haut** : cases ouverts, auto-supprimés (24h), taux fraude, signalements/jour
- **Tableau filtre** : statut, niveau de risque, catégorie
- **Carte case** : aperçu annonce, score (gauge or/noir), verdict IA (badges catégories), raisons, signalements liés, vendeur + risk score
- **Actions admin** : confirmer suppression, restaurer (`cleared`), bannir vendeur, voir historique
- **Onglet "Contestations"** : liste des appeals, accepter/refuser avec note

Realtime via Supabase channel sur `moderation_cases`.

Design : noir/or, glass-morphism, badges colorés par sévérité, animations Framer Motion légères.

---

## 5. UI Vendeur — page "Mes annonces" / nouveau `/moderation/:caseId`

- Si annonce en quarantaine/supprimée : badge visible + bouton "Voir le motif"
- Page détail : verdict IA résumé en français, raisons, formulaire **"Contester la décision"** (textarea + envoi)
- Notifications cloche dans header (compteur `moderation_notifications` non lues)

---

## 6. Configuration

`supabase/config.toml` :
```
[functions.moderate-listing]
verify_jwt = false
[functions.submit-report]
verify_jwt = true
```

Secret à ajouter : `MODERATION_HOOK_SECRET` (généré, partagé entre trigger et edge).

---

## 7. Détails techniques (pour devs)

```text
report INSERT
   ↓ trigger
   count distinct valid reports per listing
   ↓ if ≥ 2
   upsert moderation_case (pending)
   ↓ pg_net.http_post
   edge: moderate-listing
   ↓ Lovable AI (multimodal + tool calling)
   compute trust_score + action
   ↓
   update listing + case + notifications
   ↓
   admin dashboard (realtime)
```

Score final : `0.7 * AI_score + 0.3 * behavior_score` où behavior_score pénalise (anciens reports validés, compte récent, fréquence publication anormale).

Anti-abus signalements : table `report_rate_limits` + heuristique nouveaux comptes.

---

## Hors-scope (proposé pour plus tard)
- Détection IP suspectes (nécessite logging IP côté edge auth — RGPD à clarifier)
- Vérification d'identité KYC
- Détection d'images dupliquées par hash perceptuel (pHash) — peut être ajouté V2

Confirme et je l'implémente.
