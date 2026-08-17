# Backend ATS avec RBAC et file d'attente

Ce dépôt contient un backend TypeScript pour un système de suivi des candidatures (ATS), avec contrôle d'accès basé sur les rôles, gestion de l'état des flux de candidature, et traitement asynchrone des notifications.

Le projet est conçu comme un exemple compact mais complet de :

- Accès API authentifié pour les candidats, recruteurs et hiring managers
- Protection RBAC sur les opérations liées aux offres d'emploi et aux candidatures
- Transitions transactionnelles du cycle de vie des candidatures, avec historique d'audit
- Livraison de notifications asynchrones via une file d'attente (Redis + BullMQ)
- Orchestration Docker Compose pour l'API, PostgreSQL, Redis et le service worker

## Structure du projet

```
src/
  index.ts              - Serveur API Express et routes
  worker.ts              - Processus BullMQ pour les jobs de notification
  queue/notifications.ts - Mise en file et traitement des notifications
  config/data-source.ts  - Configuration TypeORM
  entities/               - Définitions des entités de base de données
  middleware/             - Middlewares d'authentification et RBAC
  services/stateMachine.ts - Règles de transition des étapes de candidature
  types/                  - Extensions TypeScript pour Express
tests/                    - Tests unitaires Jest (RBAC, validation du workflow)
docker-compose.yml        - Définition de la stack de développement
mock_emails.log           - Journal de sortie du worker
ormconfig.ts              - Configuration TypeORM
package.json               - Scripts et dépendances du projet
```

## Fonctionnalités clés

- Authentification via tokens JWT
- Contrôle d'accès basé sur les rôles pour les routes protégées
- CRUD des offres d'emploi pour les recruteurs
- Soumission de candidatures réservée aux candidats
- Revue des candidatures et mise à jour des étapes réservées au personnel de l'entreprise
- Validation du workflow pour n'autoriser que des transitions de candidature valides
- Historique d'audit : chaque changement d'étape est enregistré
- Gestion asynchrone des notifications via la file Redis
- Sortie des jobs worker écrite dans `mock_emails.log`

## Prérequis

- Docker et Docker Compose installés
- Node.js 20+ pour l'exécution locale des scripts et des tests
- npm disponible pour les tests et les commandes TypeORM

## Installation

Installer les dépendances localement :
```bash
npm install
```

Copier le fichier d'exemple d'environnement :
```bash
cp .env.example .env
```

Démarrer les services Docker :
```bash
docker compose up -d
```

Exécuter les migrations TypeORM :
```bash
npm run migration:run
```

Démarrer le serveur API en mode développement :
```bash
npm run dev
```

Démarrer le processus worker séparément (si Docker Compose n'est pas utilisé) :
```bash
npm run worker
```

## Docker Compose

`docker-compose.yml` définit quatre services :

- **db** — base de données PostgreSQL
- **queue** — file Redis
- **api** — serveur API Express
- **worker** — worker BullMQ pour les jobs de notification

Le service worker monte un volume afin que la sortie des notifications reste accessible depuis l'hôte, dans `mock_emails.log`.

## Configuration de l'environnement

Valeurs importantes dans `.env` :

- `DB_HOST` — hôte de la base de données (généralement interne à Docker)
- `DB_PORT` — port de la base de données
- `DB_USER` — utilisateur PostgreSQL
- `DB_PASSWORD` — mot de passe PostgreSQL
- `DB_NAME` — nom de la base de données
- `QUEUE_URL` — URL de connexion Redis
- `JWT_SECRET` — secret utilisé pour signer les tokens JWT
- `JWT_EXPIRES_IN` — durée de vie du token
- `PORT` — port de l'API

⚠️ Ne pas committer le fichier `.env` dans le contrôle de version.

## Authentification

Les utilisateurs peuvent s'inscrire et se connecter via :

```
POST /api/auth/register
POST /api/auth/login
```

L'inscription supporte trois rôles :
- `candidate`
- `recruiter`
- `hiring_manager`

Les recruteurs et hiring managers doivent inclure un `company_id` lors de l'inscription.

## Contrôle d'accès basé sur les rôles (RBAC)

Les routes protégées exigent un JWT valide et vérifient le rôle :

- **candidate** : peut soumettre des candidatures et consulter ses propres candidatures
- **recruiter** : peut créer, modifier, supprimer des offres et consulter les candidatures de son entreprise
- **hiring_manager** : peut consulter les candidatures de son entreprise et mettre à jour leur étape

Le middleware RBAC vérifie le rôle du demandeur avant d'autoriser l'accès.

## Workflow des candidatures et machine à états

Le cycle de vie des candidatures est géré par `src/services/stateMachine.ts`.

Transitions valides :
```
Applied    -> Screening
Screening  -> Interview
Interview  -> Offer
Offer      -> Hired
(toute étape non terminale) -> Rejected
```

Les transitions invalides (sauter une étape, revenir en arrière) sont rejetées avec une réponse `400`.

## Endpoints API

**Publics**
```
POST /api/auth/register
POST /api/auth/login
```

**Authentifiés**
```
GET /api/jobs
GET /api/jobs/:id
GET /api/applications/:applicationId
```

**Recruteur uniquement**
```
POST   /api/jobs
PUT    /api/jobs/:id
DELETE /api/jobs/:id
```

**Candidat uniquement**
```
POST /api/jobs/:jobId/applications
GET  /api/applications/me
```

**Personnel de l'entreprise**
```
PUT /api/applications/:applicationId/stage
GET /api/jobs/:jobId/applications
```

## Worker de notifications

Les notifications sont mises en file par l'API et traitées par le worker. Le worker ajoute des messages JSON structurés dans `mock_emails.log` plutôt que d'envoyer de vrais emails.

Cela inclut les notifications pour :
- Réception de candidature confirmée au candidat
- Alerte de nouveau candidat pour le recruteur
- Notification de changement d'étape pour le candidat

## Logs

- Les logs de l'API sont écrits dans la console du conteneur
- Les notifications du worker sont écrites dans `mock_emails.log`
- Le format est un objet JSON par ligne

Exemple :
```json
{"timestamp":"2026-07-15T17:49:17.009Z","to":"cand@test.com","subject":"Application Received: Software Engineer","body":"Thank you for applying to Software Engineer."}
```

## Tests

Lancer les tests unitaires avec Jest :
```bash
npm test -- --runInBand
```

Le dépôt inclut des tests pour :
- Le comportement du middleware RBAC
- La validation des transitions d'étape des candidatures

## Notes de développement

- Les champs sensibles comme `password_hash` sont assainis avant d'être renvoyés par l'API
- La création de candidatures et les changements d'étape utilisent des transactions et génèrent un historique d'audit
- Le worker partage la même chaîne de connexion à la file Redis via `QUEUE_URL`

## Commandes courantes

```bash
npm install
npm run dev
npm run worker
npm run build
npm test -- --runInBand
npm run migration:run
```

## Dépannage

- Si l'API ne démarre pas : vérifier les valeurs de `.env` et la connectivité Docker Compose
- Si le worker n'écrit pas de logs : vérifier que `mock_emails.log` existe et que le conteneur a la permission d'y écrire
- Si les migrations échouent : vérifier les variables `DB_*` et que PostgreSQL est accessible

