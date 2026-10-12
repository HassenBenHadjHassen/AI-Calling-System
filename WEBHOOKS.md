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
| **Vapi (Cabinet Michelle)** | Tool Call (Disponibilité Planning) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/tools/calendar-availability` |
| **Vapi (Cabinet Michelle)** | Fin d'appel (Server URL) | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/vapi/patient-intake` |
| **Twilio SMS** | Réception SMS patient | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/webhooks/twilio/inbound-sms` |
| **Portail Devis Natif** | Soumission devis client | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/forms/devis` |
| **Portail Devis Natif** | Données pré-remplies devis | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/forms/devis?callId={callId}` |
| **Abonnement Calendrier** | Flux iCal iPhone / Google / Outlook | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/api/calendar/michelle.ics` |
| **Planning Interne** | Blocage manuel de créneau | `POST` | `https://ai-calling-system.hassenbenhadjhassen.com/api/calendar/block` |
| **Better Auth** | Portail Connexion Dashboard | `GET` | `https://ai-calling-system.hassenbenhadjhassen.com/login` |
| **Better Auth API** | Gestion Sessions & Auth | `*` | `https://ai-calling-system.hassenbenhadjhassen.com/api/auth/*` |

---

## 1. Vapi — Tool Calls (En direct pendant l'appel téléphonique)

Ces fonctions sont appelées par le modèle vocal Vapi pendant que le client est en ligne pour obtenir des données de décision en temps réel.

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
* **Objectif** : Vérifier la disponibilité des créneaux dans le calendrier PostgreSQL du Cabinet Michelle (fuseau `Europe/Paris`, du lundi au samedi, 08h00–19h00).
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

### 🔹 `POST /api/webhooks/vapi/patient-intake`
* **Assistant** : Cabinet Michelle
* **Configuration dans Vapi** : Assistant > *Server URL*
* **Ce qui est exécuté** :
  1. Extrait le nom, téléphone, type de prestation, adresse et degré d'urgence.
  2. **Cas URGENT** :
     - Crée le rendez-vous en statut `CONFIRMED_URGENT`.
     - Déclenche un SMS prioritaire immédiat vers le mobile de l'infirmière :  
       `🚨 URGENT: [Patient] nécessite [Soin] au [Adresse]. Téléphone: [Numéro]`.
  3. **Cas NON URGENT** :
     - Crée le rendez-vous en statut `PENDING`.
     - Envoie un SMS automatique au patient demandant confirmation :  
       `Bonjour [Nom], merci de confirmer votre RDV du [Date] à [Heure] en répondant OUI ou NON.`
  4. Déduplication par `callId` pour éviter les envois multiples.

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
* **Rôle** : Permet aux infirmières de bloquer un créneau directement depuis le tableau de bord (ex: tournée extérieure, pause déjeuner, formation).
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
> **Isolation stricte** : Tous les endpoints Webhooks (`/api/webhooks/*`), le portail client de devis (`/devis/*`, `/api/forms/devis`) et le flux de synchronisation iCal (`/api/calendar/michelle.ics`) restent ouverts et publics. L'authentification protège exclusivement le tableau de bord d'administration et les fonctions de configuration interne.

---

## 🛡️ Idempotence, Sécurité & Déduplication

- **Idempotence des SMS** : Tout message envoyé utilise un verrou d'idempotence (`5 minutes`) pour garantir qu'aucune relance en doublon n'est envoyée en cas de réémission du webhook par Vapi ou Twilio.
- **Worker d'arrière-plan** : Les notifications et retries sont pris en charge par `ai-calling-worker` via PM2, assurant une résilience totale même si un service tiers subit une latence réseau.
