# Simulateur de championnat (8 équipes)

Application web statique qui permet de simuler un mini-championnat de 8 équipes entièrement côté client (sans serveur, sans compilation).

Fichiers :
- `index.html` : page principale
- `styles.css` : styles et icônes-maillots CSS
- `app.js` : logique JS (génération du calendrier, simulation, classement, persistance)

Usage :
- Ouvrir `index.html` dans un navigateur moderne.
- Sur la gauche, la liste des journées (Journée 1 à Journée 7). Pour chaque match : saisir les buts manuellement ou cliquer sur "Simuler" pour générer un score aléatoire.
- Bouton "Simuler journée" disponible en haut de chaque journée pour simuler tous les matches non joués de la journée.
- Le classement à droite se met à jour en temps réel.
- Les données sont stockées dans `localStorage` du navigateur. Utiliser "Réinitialiser" pour repartir d'un calendrier vierge.

Notes techniques :
- Le calendrier est généré par un algorithme round-robin (chaque équipe rencontre chaque autre une fois). On essaie d'alterner domicile/extérieur via une heuristique simple.
- Le classement utilise l'ordre : pts, différence de buts, buts pour, nom.
- L'icône de chaque équipe est une petite pastille CSS stylisée.

Licence : code fourni pour usage et modification locale.

