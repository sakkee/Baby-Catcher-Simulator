##Indian Baby Catch Simulator 2000

Note: This was an entry for Global Game Jam 2016 where the game theme's was to be "ritual". The ritual behind the game is real: http://www.odditycentral.com/news/indias-controversial-baby-dropping-ritual-is-back.html

A real-time multiplayer game made with Phaser, Node.js and Socket.IO. Try to catch the babies safely.

##Install
```
npm install

Go to /lib/game.js and change databaseHost, dbUser, dbPassword and dbName

Create table 'scoreList' with id, player1 (text), player2 (text), score (int)

Change the domain in index.php OR delete it

npm run dev
```

The game is now open in the port 8080 (default).
