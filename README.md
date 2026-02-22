# 🧀 CheeseBot

Un bot Discord complet. Tout se fait depuis ton téléphone — pas de PC, pas de terminal.

---

## Ce qu'il te faut

4 comptes gratuits (pas de carte bancaire) :

| Compte | Pour quoi faire |
|---|---|
| [Discord Developer](https://discord.com/developers) | Créer le bot |
| [GitHub](https://github.com) | Stocker le code |
| [MongoDB Atlas](https://www.mongodb.com/atlas) | La base de données |
| [Render](https://render.com) | Faire tourner le bot 24/7 |

---

## Étape 1 — Créer le bot Discord

1. Va sur **discord.com/developers/applications**
2. Clique **"New Application"** → donne un nom → **Create**
3. Clique **"Bot"** dans le menu à gauche
4. Clique **"Reset Token"** → copie le token → **garde-le précieusement** ⚠️
5. Toujours sur cette page, active ces 2 options :
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
6. Clique **"OAuth2"** → **"URL Generator"**
7. Coche `bot` + `applications.commands`, puis coche `Administrator`
8. Copie le lien généré en bas → ouvre-le → invite le bot sur ton serveur

> 💡 Note aussi l'**Application ID** (sur la page "General Information") — c'est ton `CLIENT_ID`

---

## Étape 2 — Mettre le code sur GitHub

1. Va sur **github.com** → crée un compte si pas encore fait
2. Clique **"New"** pour créer un nouveau repository
3. Nomme-le `cheesebot`, mets-le en **Private**, clique **Create repository**
4. Clique **"uploading an existing file"**
5. Extrais le zip CheeseBot sur ton téléphone, puis glisse-dépose tous les fichiers
6. Clique **"Commit changes"**

---

## Étape 3 — Créer la base de données

La base de données retient tous les réglages du bot (AutoMod, Reaction Roles, Giveaways…). Sans elle, tout se réinitialise à chaque redémarrage.

1. Va sur **mongodb.com/atlas** → crée un compte
2. Clique **"Build a Database"** → choisis **Free (M0)**
3. Choisis **AWS** + région **eu-west-1 (Ireland)** → **Create**
4. Crée un utilisateur :
   - Username : `cheesebot`
   - Clique **"Autogenerate Secure Password"** → **copie ce mot de passe !**
   - Clique **Create User**
5. Pour l'accès réseau, ajoute `0.0.0.0/0` (permet à Render de se connecter)
6. Clique **"Connect"** sur ton cluster → **"Drivers"**
7. Copie la chaîne de connexion, elle ressemble à :
   ```
   mongodb+srv://cheesebot:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
8. Remplace `<password>` par le mot de passe copié à l'étape 4

> C'est ton `MONGODB_URI` — garde-le de côté

---

## Étape 4 — Lancer le bot sur Render

1. Va sur **render.com** → connecte-toi avec ton compte **GitHub**
2. Clique **"New +"** → **"Background Worker"**

   > ⚠️ Choisis bien **Background Worker** et pas "Web Service" — le Web Service s'endort après 15 min, le Background Worker reste allumé 24/7 gratuitement.

3. Sélectionne ton repo `cheesebot`
4. Remplis les paramètres :

   | Champ | Valeur |
   |---|---|
   | Name | `cheesebot` |
   | Region | `Ohio (US East)` |
   | Branch | `main` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `node src/deploy-commands.js && node src/index.js` |
   | Instance Type | `Free` |

5. Descends jusqu'à **"Environment Variables"** et ajoute :

   | Clé | Valeur |
   |---|---|
   | `DISCORD_TOKEN` | Ton token (étape 1) |
   | `CLIENT_ID` | Ton Application ID (étape 1) |
   | `MONGODB_URI` | Ta chaîne MongoDB (étape 3) |
   | `NODE_ENV` | `production` |
   | `DEFAULT_PREFIX` | `!` |

6. Clique **"Create Background Worker"**

Render installe et démarre le bot automatiquement. Ça prend 2-3 minutes. Quand tu vois dans les logs :
```
🧀 CheeseBot is online!
```
**C'est bon, le bot tourne !** 🎉

---

## Mettre à jour le bot plus tard

Tu modifies un fichier sur GitHub (directement depuis le navigateur) → Render redéploie automatiquement. C'est tout.

---

## Commandes disponibles

| Commande | Ce que ça fait |
|---|---|
| `/clear` | Supprime des messages |
| `/automod` | Configure la modération automatique |
| `/antiraid` | Protection anti-raid |
| `/welcome` | Messages de bienvenue / au revoir |
| `/rr` | Reaction roles (boutons ou menu) |
| `/poll` | Créer un sondage |
| `/suggest` | Boîte à suggestions |
| `/giveaway` | Gérer des giveaways |
| `/embed` | Créer des embeds personnalisés |
| `/config` | Réglages du bot |
| `/help` | Aide complète |

---

## Problèmes fréquents

**Les slash commands n'apparaissent pas**
→ Attends 5-10 minutes après le premier démarrage. Discord met un peu de temps à les enregistrer.

**"MongoDB connection failed"**
→ Vérifie que tu as bien remplacé `<password>` dans l'URI, et que `0.0.0.0/0` est bien dans la whitelist MongoDB.

**"401 Unauthorized"**
→ Ton token Discord est incorrect ou a été réinitialisé. Génères-en un nouveau dans le Developer Portal et mets-le à jour dans Render.

**Le bot ne répond pas**
→ Vérifie que les deux intents sont bien activés (étape 1, point 5).
