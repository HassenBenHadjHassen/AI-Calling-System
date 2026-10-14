# 📡 Guide des Webhooks — Production

**URL de base de production** :  
👉 `https://ai-calling-system.hassenbenhadjhassen.com`

Ce document répertorie l'intégralité des endpoints Webhooks, Tool Calls (fonctions d'appel en direct), formulaires natifs et flux de calendrier du système d'appels IA, avec leurs charges utiles (payloads) et comportements associés.

---

## 📋 Tableau Récapitulatif Rapide

| Service / Fournisseur | Événement / Type | Méthode | URL de Production |
| :--- | :--- | :---: | :--- |
| **Vapi (Dani Bâtiment)** | Tool Call (Vérif. VIP / Statut) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/tools/client-vip` |
| **Vapi (Dani Bâtiment)** | Fin d'appel (Server URL) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/dani-batiment` |
| **Vapi (Routage Pré-IA)** | Routage entrant (`assistant-request`) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/inbound-routing` |
| **Vapi (Cabinet Michelle)** | Tool Call (Disponibilité Planning) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/tools/calendar-availability` |
| **Vapi (Cabinet Michelle)** | **Format A** : Tool Call direct (`submit_patient_request`)<br>**Format B** : Fin d'appel (`Server URL`) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/patient-intake` |
| **Twilio SMS** | Réception SMS patient | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/twilio/inbound-sms` |
| **Portail Devis Natif** | Soumission devis client | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/forms/devis` |
| **Portail Devis Natif** | Données pré-remplies devis | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/forms/devis?callId={callId}` |
| **Abonnement Calendrier** | Flux iCal iPhone / Google / Outlook | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/calendar/michelle.ics` |
| **Planning Interne** | Blocage manuel de créneau | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/calendar/block` |
| **Better Auth** | Portail Connexion Dashboard | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/login` |
| **Better Auth API** | Gestion Sessions & Auth | `*` | `https://ai-calling-system.hassenbenhadjhassen.com/api/auth/*` |
| **Observabilité & Logs** | API Journal & Audit Logs | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/admin/logs` |
| **Observabilité & Logs** | Téléchargement Fichiers (.log) | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/admin/logs/download?type=combined` |
| **Mission Control** | Onglet Journal & Logs Système | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/dashboard?tab=logs` |

---

## 1. Vapi — Tool Calls (En direct pendant l'appel téléphonique)

Ces fonctions sont appelées par le modèle vocal Vapi pendant que le client est en ligne pour obtenir des données de décision en temps réel.

#### 🔐 Authentification Vapi requise
Tous les endpoints Vapi (`/api/webhooks/vapi/*`) sont protégés par le secret d'authentification partagé `VAPI_WEBHOOK_SECRET` :
* Soit via l'en-tête standard : `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`
* Soit via l'en-tête Vapi : `x-vapi-secret: <VAPI_WEBHOOK_SECRET>`
* En cas de jeton manquant ou incorrect : `HTTP 401 Unauthorized`.
* En production, si le secret n'est pas configuré, le serveur refuse immédiatement les requêtes (fail-closed).
* Les secrets sont vérifiés en temps constant avec `timingSafeEqual` pour empêcher les attaques temporelles.

### 🔹 `POST /api/webhooks/vapi/tools/client-vip`
* **Objectif** : Identifier si l'appelant est un client existant, sur liste blanche VIP, ou s'il a un devis déjà en cours chez Dani Bâtiment.
* **Quand l'assistant l'appelle** : Dès les premières secondes de l'appel après avoir obtenu le numéro de téléphone.
* **Payload reçu de Vapi (Exemple)** :
```json
{
  "message": {
    "type": "tool-calls",
    "assistant": {
      "id": "38a56410-a3b6-49d5-96f1-8cd572b3f81c"
    },
    "toolCalls": [
      {
        "id": "call_tool_01",
        "function": {
          "name": "check_client_vip",
          "arguments": {
            "caller": "+33612857915"
          }
        }
      }
    ]
  }
}
```
* **Réponse retournée à l'IA** :
```json
{
  "results": [
    {
      "toolCallId": "call_tool_01",
      "result": {
        "status": "whitelisted",
        "name": "Jean Dupont",
        "isVip": true,
        "activeRequestsCount": 1,
        "instruction": "Client VIP avec devis en cours. Saluez-le chaleureusement par son nom."
      }
    }
  ]
}
```

---

### 🔹 `POST /api/webhooks/vapi/tools/calendar-availability`
* **Objectif** : Vérifier la disponibilité des créneaux dans le calendrier du Cabinet Michelle (fuseau `Europe/Paris`, du lundi au vendredi de 09h00 à 13h00 et de 14h00 à 18h00 ; fermé le week-end et pendant la pause déjeuner de 13h00 à 14h00).
* **Quand l'assistant l'appelle** : Lorsque le patient propose une date ou une heure pour son soin.
* **Payload reçu de Vapi (Exemple)** :
```json
{
  "message": {
    "type": "tool-calls",
    "assistant": {
      "id": "97808c43-384a-4f40-a8dd-9149ba4988f5"
    },
    "toolCalls": [
      {
        "id": "call_tool_02",
        "function": {
          "name": "check_calendar_availability",
          "arguments": {
            "requestedDate": "2026-10-15",
            "requestedTime": "14:00"
          }
        }
      }
    ]
  }
}
```
* **Réponse retournée à l'IA** :
```json
{
  "results": [
    {
      "toolCallId": "call_tool_02",
      "result": {
        "isAvailable": true,
        "date": "2026-10-15",
        "time": "14:00",
        "message": "Le créneau du jeudi 15 octobre 2026 à 14h00 est disponible."
      }
    }
  ]
}
```

---

## 2. Vapi — Webhooks de Fin d'Appel (End of Call / Server URL)

Ces webhooks reçoivent le compte-rendu complet dès que la communication est terminée.

### 🔹 `POST /api/webhooks/vapi/patient-intake` (Endpoint Unifié Cabinet Michelle)
Cet endpoint unifié traite de manière sécurisée deux formats distincts de requêtes :
1. **Format A (Tool Call Direct)** : Appelé par l'outil Vapi `submit_patient_request` en cours d'appel (avant de raccrocher avec `end_call_tool`) pour persister immédiatement la demande dans PostgreSQL (`PatientRequest`).
2. **Format B (Server Webhook)** : Appelé automatiquement par Vapi en fin d'appel (`Server URL` / `end-of-call-report`) pour réconcilier, enrichir et auditer les résultats sans doublons.

#### 🔐 Sécurité & Authentification
Chaque requête protégée doit fournir le secret webhook Vapi (`VAPI_WEBHOOK_SECRET`) configuré dans l'environnement :
* Via l'en-tête standard : `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`
* OU via l'en-tête Vapi : `x-vapi-secret: <VAPI_WEBHOOK_SECRET>`
* En cas de jeton manquant ou invalide : HTTP `401 Unauthorized`.
* En production, si le secret n'est pas configuré, le serveur refuse immédiatement les requêtes (fail-closed).

---

#### 🅰️ Format A : Tool Call Direct (`submit_patient_request`)
L'assistant vocal déclenche cet appel API dès qu'il a recueilli les informations du patient.

* **URL** : `POST https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/patient-intake`
* **En-têtes requis** :
  ```http
  Content-Type: application/json
  Authorization: Bearer your_vapi_webhook_secret_here
  ```
* **Types de demandes supportés (`requestType`)** :
  * `appointment` : Demande de rendez-vous de soins.
  * `cancellation` : Demande d'annulation d'un rendez-vous existant.
  * `message` : Message ou renseignement laissé à l'attention de Mme MICHEL (aucun rendez-vous créé).

* **Charge utile JSON envoyée par Vapi** :
  ```json
  {
    "requestType": "appointment",
    "patientName": "Jean Dupont",
    "postalCode": "75008",
    "serviceType": "Pansement",
    "requestedDate": "2026-10-15",
    "requestedTime": "10:00",
    "summary": "Patient requests a dressing appointment.",
    "urgency": false,
    "caller": "+33612345678",
    "callId": "vapi-call-id-example"
  }
  ```

* **Validation conditionnelle** :
  * `caller` et `callId` sont **obligatoires** pour tous les types. Le numéro de téléphone est normalisé au format E.164.
  * Si `requestType === "appointment"` : `patientName`, `postalCode` (5 chiffres français), `serviceType`, `requestedDate` (futur valide), et `requestedTime` sont **obligatoires**.
  * Si `requestType === "cancellation"` ou `"message"` : Les dates et types de soins ne sont pas obligatoires (les chaînes vides transmises par Vapi sont gérées en toute sécurité). Pour un message, `summary` est requis.
  * **Heures d'ouverture du cabinet** : Lundi au Vendredi, **09h00–13h00** et **14h00–18h00** (Europe/Paris). Fermé les week-ends (samedi et dimanche) et pendant la pause déjeuner (**13h00–14h00**).

* **Réponse de succès (HTTP 200)** :
  ```json
  {
    "success": true,
    "requestId": "229dd1ec-78a9-4674-ba5f-b44c68be1234",
    "requestType": "appointment",
    "status": "PENDING",
    "message": "The patient's request has been saved and is awaiting review."
  }
  ```
  *(Pour une soumission dupliquée avec le même `callId`, l'API renvoie le même enregistrement existant avec `"isDuplicate": true` sans renvoyer de SMS).*

* **Réponse de conflit / créneau indisponible ou hors horaires (HTTP 409)** :
  ```json
  {
    "error": "OUTSIDE_BUSINESS_HOURS",
    "message": "The requested time is outside clinic opening hours. The clinic is open Monday to Friday from 09:00 to 13:00 and 14:00 to 18:00."
  }
  ```
  *(Ou `"error": "SLOT_CONFLICT"` si le créneau est déjà réservé).*

* **Réponse d'erreur de validation (HTTP 400)** :
  ```json
  {
    "error": "Validation error",
    "message": "Invalid request data",
    "details": [
      { "field": "postalCode", "message": "A valid 5-digit postal code is required for appointment requests" }
    ]
  }
  ```

---

#### 🅱️ Format B : Webhook Serveur Post-Appel (`Server URL`)
Lorsque l'appel prend fin, Vapi envoie l'objet serveur `end-of-call-report` contenant le résumé (`artifact.summary`), la transcription et les sorties structurées.

* **URL** : `POST https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/patient-intake`
* **Comportement de réconciliation & anti-doublon** :
  1. Vérifie si une demande `PatientRequest` a déjà été enregistrée pour ce `vapiCallId`.
  2. Si la demande préalable était un `MESSAGE` : Met à jour la transcription et le `CallRecord`, et ne crée **jamais** de faux rendez-vous.
  3. Si la demande préalable était une `CANCELLATION` : Ne marque **pas** le rendez-vous comme `CANCELLED` directement (conservé en attente de validation manuelle par Mme MICHEL avec alerte SMS).
  4. Si la demande préalable était un `APPOINTMENT` : Enrichit le rendez-vous existant avec les notes et le score de suspicion sans créer de second rendez-vous ni envoyer de SMS doublon (fenêtre de déduplication de 5 minutes).
  5. Si aucun enregistrement préalable n'existait (appel sans outil) : Traite le flux classique complet et crée l'enregistrement.

---

### 🔹 `POST /api/webhooks/vapi/dani-batiment`
* **Assistant** : Dani Bâtiment
* **Configuration dans Vapi** : Assistant > *Server URL*
* **Ce qui est exécuté** :
  1. Analyse la catégorie de la demande (`DEVIS` ou `SUIVI_CHANTIER`).
  2. **Si Demande de Devis** :
     - Crée un enregistrement `ServiceRequest` dans PostgreSQL (statut `NOT_COMPLETED`).
     - Envoie instantanément un SMS au client avec son lien direct vers le formulaire web natif :  
       `https://ai-calling-system.hassenbenhadjhassen.com/devis/{callId}`
  3. **Si Suivi de Chantier / Réclamation** :
     - Notifie l'artisan/secrétariat interne par SMS avec le résumé et les coordonnées de l'appelant.

---

## 3. Twilio — Webhook SMS Entrant (Cabinet Michelle)

### 🔹 `POST /api/webhooks/twilio/inbound-sms`
* **Configuration dans la console Twilio** :  
  *Phone Numbers* > Sélectionner le numéro du cabinet > *Messaging Configuration* > *A Message Comes In* > Méthode `HTTP POST`.
* **Payload reçu de Twilio** : `From`, `To`, `Body`, `MessageSid` (format `x-www-form-urlencoded`).
* **Ce qui est exécuté** :
  1. Identifie le patient par son numéro de téléphone (`From`).
  2. Analyse l'intention du message (`OUI`, `NON`, `ANNULER`, `AUTRE`) via classifieur d'intention NLP.
  3. **Si OUI** :
     - Confirme le rendez-vous en base (`CONFIRMED`).
     - L'inscrit de manière définitive dans le calendrier.
     - Envoie un SMS de validation au patient.
  4. **Si NON / ANNULER** :
     - Libère le créneau et alerte l'infirmière par SMS de l'annulation.
  5. Répond avec un document XML TwiML conforme.

---

## 4. Portail Natif de Devis (Remplacement JotForm)

### 🔹 `GET /api/forms/devis?callId={callId}`
* **Rôle** : Utilisé par la page `/devis/[callId]` pour pré-remplir automatiquement le formulaire avec le nom, le numéro de téléphone et la description déjà mentionnés à l'oral lors de l'appel.

### 🔹 `POST /api/forms/devis`
* **Rôle** : Réception de la validation finale du devis par le client.
* **Payload (JSON)** :
```json
{
  "callId": "call_demo_devis_001",
  "name": "Alexandre Martin",
  "phone": "+33612850303",
  "email": "alexandre.martin@example.com",
  "address": "14 Rue des Artisans, 75011 Paris",
  "description": "Rénovation peinture séjour et pose parquet flottant",
  "preferredDate": "2026-11-02",
  "estimatedBudget": "3500€"
}
```
* **Ce qui est exécuté** :
  1. Met à jour la `ServiceRequest` dans PostgreSQL avec l'adresse, l'email et les dates choisies.
  2. Passe le statut de `NOT_COMPLETED` à `COMPLETED`.
  3. Déclenche immédiatement une notification SMS au gérant avec tous les détails du chantier.

---

## 5. Flux iCalendar & Planning Interne (Remplacement Google Calendar)

### 🔹 `GET /api/calendar/michelle.ics`
* **Format** : RFC 5545 iCalendar (`text/calendar; charset=utf-8`).
* **En-tête de téléchargement** : `Content-Disposition: attachment; filename="michelle-calendar.ics"`.
* **Usage** :
  - **Sur iPhone / iPad** : Ouvrir l'URL pour ajouter le calendrier ou s'abonner avec synchronisation en arrière-plan.
  - **Sur Google Agenda / Outlook** : Ajouter par URL de flux.
  - **Sur le Dashboard Mission Control** : Téléchargement direct d'un clic via le bouton d'export.

### 🔹 `POST /api/calendar/block`
* **Rôle** : Permet aux infirmières ou administrateurs de bloquer un créneau directement depuis le tableau de bord (ex: tournée extérieure, pause déjeuner, formation).
* **🔐 Sécurité & Autorisation requise** :
  - Requiert une session utilisateur Better Auth active (cookie de session ou en-tête d'authentification).
  - Contrôle d'accès basé sur les rôles (RBAC) : seuls les utilisateurs avec rôle `ADMIN`, `STAFF`, ou ayant accès explicite à la section calendrier (`allowedSections: "ALL"` ou incluant `"calendar"`) sont autorisés.
  - En cas de requête non authentifiée : `HTTP 401 Unauthorized`.
  - En cas d'utilisateur sans permission suffisante : `HTTP 403 Forbidden`.
* **Payload (JSON)** :
```json
{
  "title": "Pause Déjeuner & Pharmacie",
  "start": "2026-10-15T12:00:00.000Z",
  "end": "2026-10-15T13:30:00.000Z",
  "notes": "Indisponible pour consultation"
}
```
* **Effet** : L'assistante vocale Vapi traitera immédiatement ce créneau comme occupé lors des vérifications en direct.

---

## 6. Authentification & Sécurité Dashboard (Better Auth)

Le tableau de bord Mission Control est protégé par **Better Auth** adossé à la base PostgreSQL (schéma Prisma `User`, `Session`, `Account`, `Verification`).

### 🔹 Accès Dashboard & Redirection
* **URL Protégée** : `https://ai-calling-system.hassenbenhadjhassen.com/dashboard`
* **Comportement** : Vérification de session côté serveur (`auth.api.getSession`). Si l'utilisateur n'est pas connecté, il est automatiquement redirigé vers `/login?callbackUrl=/dashboard`.
* **Portail de Connexion** : `https://ai-calling-system.hassenbenhadjhassen.com/login` (Supporte la connexion email/mot de passe et l'inscription sécurisée).

### 🔹 Identifiants de Démonstration Administrateur
* **Email** : `admin@moncabinet.fr`
* **Mot de passe** : `AdminPassword2026!`
* *(Un bouton de pré-remplissage rapide 1-clic est disponible directement sur l'écran `/login`)*.

### 🔹 Endpoints API Better Auth (`/api/auth/*`)
* `POST /api/auth/sign-in/email` — Authentification par email et mot de passe.
* `POST /api/auth/sign-up/email` — Création d'un nouvel utilisateur.
* `POST /api/auth/sign-out` — Révocation de la session et déconnexion.
* `GET /api/auth/get-session` — Récupération de l'état de session actif.

> [!IMPORTANT]
> **Modèle de sécurité à double niveau** :
> 1. **Webhooks Vapi** (`/api/webhooks/vapi/*`) : Authentifiés via secret partagé cryptographique (`Authorization: Bearer <secret>` ou `x-vapi-secret: <secret>`) avec comparaison `timingSafeEqual`.
> 2. **Endpoints Staff & Administration** (`/dashboard`, `/api/calendar/block`, `/api/admin/*`) : Protégés par session Better Auth et permissions RBAC.
> 3. **Flux Publics** (`/devis/*`, `/api/forms/devis`, `/api/calendar/michelle.ics`) : Ouverts pour la soumission client et la synchronisation d'agenda.

---

## 🛡️ Idempotence, Sécurité & Déduplication

- **Idempotence des SMS** : Tout message envoyé utilise un verrou d'idempotence (`5 minutes`) pour garantir qu'aucune relance en doublon n'est envoyée en cas de réémission du webhook par Vapi ou Twilio.
- **Worker d'arrière-plan** : Les notifications et retries sont pris en charge par `ai-calling-worker` via PM2, assurant une résilience totale même si un service tiers subit une latence réseau.

---

## 7. 🔍 Système de Logging Extensif, Traçabilité & Observabilité

Le système dispose d'une infrastructure de journalisation complète et de niveau entreprise pour suivre chaque requête de webhook, appel d'outil en direct, événement Twilio et exécution du worker d'arrière-plan.

### 🔹 1. Niveaux de Log & Format Structuré
Le système utilise 4 niveaux de sévérité standardisés :
- `DEBUG` (0) : Traces verbeuses pour le développement local.
- `INFO` (1) : Événements métier majeurs (réception de webhook, complétion de devis, dédoublonnage, confirmation SMS).
- `WARN` (2) : Problèmes non-bloquants (tentative en doublon évitée, avertissement de validation, retries).
- `ERROR` (3) : Exceptions capturées, échecs d'API externes avec pile d'appels (`stack trace`).

### 🔹 2. Identifiants de Corrélation (`Correlation IDs`)
Chaque webhook entrant génère ou extrait un identifiant unique de traçabilité (`Correlation ID`) :
- **Appels Vapi** : `vapi_{callId}` (ex: `vapi_call_demo_devis_001`)
- **SMS Twilio** : `twilio_{MessageSid}` (ex: `twilio_SM89182390123`)
- **Outils Vapi en direct** : `tool_vip_{timestamp}` ou `tool_cal_{timestamp}`
- **Formulaires Devis** : `form_devis_{timestamp}`
- **En-tête de réponse** : L'en-tête HTTP `X-Correlation-Id` est systématiquement retourné par l'API pour faciliter le débogage de bout en bout.

### 🔹 3. Double Destination de Stockage (Fichiers & Base PostgreSQL)
1. **Fichiers Locaux sur le Serveur (`./logs/`)** :
   - `logs/combined.log` : Enregistrement chronologique de tous les événements système.
   - `logs/webhooks.log` : Journal filtré dédié exclusivement aux requêtes webhooks externes.
   - `logs/error.log` : Journal d'anomalies (WARN et ERROR) contenant les stack traces complètes.
   - `logs/pm2-web-out.log` & `logs/pm2-worker-out.log` : Sortie brute des processus PM2.
2. **Base de Données PostgreSQL (`SystemLog`)** :
   - Table `system_logs` indexée sur `level`, `module`, `correlationId`, `createdAt`.
   - Permet l'interrogation instantanée, le filtrage et la conservation configurable.

### 🔹 4. Onglet de Supervision en Temps Réel (`/dashboard?tab=logs`)
Accessible aux administrateurs depuis le tableau de bord :
- **Flux en direct (Live Polling)** : Rafraîchissement automatique toutes les 5 secondes ou à la demande.
- **Indicateurs KPI (24h)** : Nombre total d'événements, traces de webhooks, volume d'avertissements et taux d'erreur (%).
- **Filtres interactifs** : Par niveau (`ERROR`, `WARN`, `INFO`), par module (`WEBHOOK_VAPI`, `WEBHOOK_TWILIO`, `CALENDAR`, `WORKER`), ou recherche textuelle libre.
- **Traçabilité en 1-clic** : Cliquer sur un `Trace ID` filtre instantanément l'intégralité du cycle de vie de la requête associée.
- **Inspecteur JSON & Export** : Visualisation complète du payload reçu et bouton de copie rapide.

### 🔹 5. Commandes Utiles PM2 & Serveur
```bash
# Consulter les flux de logs en temps réel via PM2
npm run pm2:logs

# Inspecter spécifiquement les webhooks
tail -f logs/webhooks.log

# Inspecter les erreurs récentes
tail -n 50 logs/error.log

# Télécharger le fichier de log complet depuis un navigateur
curl -H "Cookie: ..." https://ai-calling-system.hassenbenhadjhassen.com/api/admin/logs/download?type=combined
```

---

## 8. 🚀 Guide de Déploiement Production, Sécurité & Rotation des Secrets

### 🔹 1. Variables d'Environnement Requises (Backend)
Pour assurer le fonctionnement complet et sécurisé en production, configurez les variables suivantes dans votre fichier `.env` ou gestionnaire de secrets :

| Variable | Description & Rôle | Obligatoire en Prod |
| :--- | :--- | :---: |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL (avec pool de connexions et SSL require) | **Oui** |
| `VAPI_WEBHOOK_SECRET` | Secret partagé vérifié par timing-safe compare pour authentifier les requêtes Vapi | **Oui** |
| `TWILIO_ACCOUNT_SID` | Identifiant du compte Twilio pour l'envoi de SMS et la vérification des lignes | **Oui** |
| `TWILIO_AUTH_TOKEN` | Jeton d'authentification Twilio | **Oui** |
| `TWILIO_PHONE_NUMBER` | Numéro d'expédition Twilio SMS par défaut | **Oui** |
| `CABINET_INBOUND_PHONE` | Numéro d'accueil téléphonique du Cabinet Michelle | **Oui** |
| `NURSE_ALERT_PHONE_NUMBER` | Numéro de mobile de Mme MICHEL pour recevoir les alertes SMS prioritaires | **Oui** |
| `CABINET_ASSISTANT_ID` | Identifiant d'assistant Vapi pour Cabinet Michelle | **Oui** |
| `BATIMENT_ASSISTANT_ID` | Identifiant d'assistant Vapi pour Dani Bâtiment | **Oui** |
| `BATIMENT_ALERT_PHONE_NUMBER`| Numéro d'alerte pour les équipes Dani Bâtiment | **Oui** |
| `BETTER_AUTH_SECRET` | Clé secrète de chiffrement des sessions utilisateur Better Auth | **Oui** |
| `NODE_ENV` | `production` (active le fail-closed strict de l'authentification webhook) | **Oui** |

### 🔹 2. Endpoints Protégés & Configuration Vapi
Tous les endpoints suivants appliquent la politique de vérification stricte en temps constant (`verifyVapiSecret`) :
1. `POST /api/webhooks/vapi/tools/client-vip` (Vérification client VIP)
2. `POST /api/webhooks/vapi/tools/calendar-availability` (Vérification disponibilité créneaux)
3. `POST /api/webhooks/vapi/patient-intake` (Format A direct tool call & Format B post-call)
4. `POST /api/webhooks/vapi/dani-batiment` (Fin d'appel bâtiment)

**Dans l'interface Vapi Dashboard :**
- **Pour les Assistant Server URLs** (ex: Dani Bâtiment, Post-Call Report) :  
  Définir l'en-tête personnalisé :
  ```http
  Authorization: Bearer <VAPI_WEBHOOK_SECRET>
  ```
  *ou*
  ```http
  x-vapi-secret: <VAPI_WEBHOOK_SECRET>
  ```
- **Pour les API Request Tools** (ex: `submit_patient_request`, `calendar_availability`, `client_vip`) :  
  Dans la configuration de chaque Tool Vapi, ajoutez l'en-tête HTTP dans `Headers` :
  ```json
  {
    "Authorization": "Bearer <VAPI_WEBHOOK_SECRET>"
  }
  ```

### 🔹 3. Politique Fail-Closed en Production
En environnement de production (`NODE_ENV=production`) :
- Si `VAPI_WEBHOOK_SECRET` est absent, vide ou égal au secret de test par défaut (`vapi_test_secret`), toutes les requêtes webhook entrantes sont immédiatement rejetées avec un code HTTP `401 Unauthorized`.
- Toute tentative d'accès avec un secret erroné ou d'une longueur différente est rejetée en temps constant via `crypto.timingSafeEqual` sans exception ni fuite temporelle.

### 🔹 4. Procédure de Rotation Sécurisée des Secrets
Pour renouveler le secret webhook sans interruption de service :
1. Générez une clé cryptographique aléatoire :  
   `openssl rand -hex 32`
2. Mettez à jour le secret dans le gestionnaire d'environnement du backend (ou `.env`).
3. Rechargez le backend sans coupure :  
   `npm run pm2:reload`
4. Mettez à jour les en-têtes correspondants dans le tableau de bord Vapi (Tools et Server URLs).
5. Vérifiez la bonne réception en consultant les logs :  
   `tail -f logs/webhooks.log`

### 🔹 5. Migrations de Base de Données & Worker d'Arrière-Plan
1. **Validation & Génération Prisma** :  
   Avant tout démarrage en production, validez le schéma et générez le client :
   ```bash
   npx prisma validate
   npx prisma generate
   ```
2. **Exécution du Worker Transactionnel Outbox** :  
   Les notifications (SMS, alertes infirmière) sont durcies via une table Transactional Outbox (`notification_jobs`). Le worker doit tourner en continu en arrière-plan :
   ```bash
   # Démarrer le worker via PM2
   npm run pm2:start
   
   # Ou exécuter directement
   npm run worker
   ```
   Le worker interroge PostgreSQL toutes les 5 secondes pour traiter les jobs en attente et applique un backoff exponentiel borné (10s, 20s, 40s, 80s... max 300s) avec un maximum de 5 tentatives avant alerte terminale observable.

