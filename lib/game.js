var util = require('util')
var http = require('http')
var path = require('path')
var ecstatic = require('ecstatic')
var io = require('socket.io')

var Player = require('./Player')
var Match = require('./Match')
var mysql = require('mysql'); //

var port = process.env.PORT || 8080

/* ************************************************
** GAME VARIABLES
************************************************ */
var socket	
var players	
var playerQueue=[]
var matches = []
var bestScores = []
var currentTick = 0
var babyInAirTime = 2000 // tick 50ms --> 50ms*20 = 1s
var maxAcceptablePlayerRange = 182 // pixels
var minAcceptablePlayerRange = 92
var serverTickrate = 1000/20 // 50ms
var babyCatchThreshold = 10 // the min acceptable range between baby X and player X
var matchStartPausetime = 3000 // ms
var databaseSaving = true //whether to enable databases

var databaseHost = 'localhost';
var dbUser = '';
var dbPassword = '';
var dbName = '';
/********************************************
** DATABASE
********************************************/
var connection =mysql.createConnection({
    host: databaseHost,
    user: dbUser,
    password: dbPassword,
    database: dbName
});
if (databaseSaving) connection.connect()
/* ************************************************
** GAME INITIALISATION
************************************************ */

// Create and start the http server
var server = http.createServer(
  ecstatic({ root: path.resolve(__dirname, '../public') })
).listen(port, function (err) {
  if (err) {
    throw err
  }

  init()
})

function init () {
  players = []
  socket = io.listen(server)

  socket.configure(function () {
    socket.set('transports', ['websocket'])
    socket.set('log level', 2)
  })
  setEventHandlers()
}

/* ************************************************
** GAME EVENT HANDLERS
************************************************ */
var setEventHandlers = function () {
  // Socket.IO
  socket.sockets.on('connection', onSocketConnection)
}

// New socket connection
function onSocketConnection (client) {

  // Listen for client disconnected
  client.on('disconnect', onClientDisconnect)

  // Listen for move player message
  client.on('move player', onMovePlayer)
  
  client.on('new name', onNewName)
  
  client.on('restart', onRestart);
}
function onRestart() {
    var tmpPlayer=playerById(this.id);
    
    if (playerQueue.length==0) {
        tmpPlayer.position=0;
        playerQueue.push(tmpPlayer);
        this.emit('no players', {})
    }
    else {
        var Time = (new Date).getTime();
        tmpPlayer.position=1;
        var newMatch = new Match(playerQueue[playerQueue.length-1].id,tmpPlayer.id,playerQueue[playerQueue.length-1].name,tmpPlayer.name, Time)
        matches.push(newMatch)
        var babyDropX = Math.floor(Math.random() * (720 - 50 + 1)) + 50;
        matches[matches.length-1].nextDroppedBaby = [matchStartPausetime,babyDropX];
        this.emit('match started', {otherPlayerName:playerQueue[playerQueue.length-1].name, playerPos: tmpPlayer.position,nextDroppedBaby:matches[matches.length-1].nextDroppedBaby});
        socket.sockets.socket(playerQueue[playerQueue.length-1].id).emit('match started', {otherPlayerName: tmpPlayer.name, playerPos: playerQueue[playerQueue.length-1].position, nextDroppedBaby:matches[matches.length-1].nextDroppedBaby})
        playerQueue.splice(playerQueue.length-1,1)
    }
}
function onNewName(data) {
    util.log(data.name + ' has joined! Checking the queue...' + playerQueue.length);
    var newPlayer = new Player(data.name);
    players.push(newPlayer)
    newPlayer.id = this.id;
    if (playerQueue.length==0) {
        util.log('Placing ' + data.name + ' in queue waiting for the other player.');
        newPlayer.position = 0;
        this.emit('no players', {})
        
        playerQueue.push(newPlayer);
    }
    else {
        var Time = (new Date).getTime();
        util.log('Match found for ' + data.name + ' and ' + playerQueue[playerQueue.length-1].name + '!')
        newPlayer.position=1;
        var newMatch = new Match(playerQueue[playerQueue.length-1].id,newPlayer.id,playerQueue[playerQueue.length-1].name,newPlayer.name, Time)
        matches.push(newMatch)
        var babyDropX = Math.floor(Math.random() * (720 - 50 + 1)) + 50;
        matches[matches.length-1].nextDroppedBaby = [matchStartPausetime,babyDropX];
        this.emit('match started', {otherPlayerName:playerQueue[playerQueue.length-1].name, playerPos: newPlayer.position,nextDroppedBaby:matches[matches.length-1].nextDroppedBaby});
        socket.sockets.socket(playerQueue[playerQueue.length-1].id).emit('match started', {otherPlayerName: data.name, playerPos: playerQueue[playerQueue.length-1].position, nextDroppedBaby:matches[matches.length-1].nextDroppedBaby})
        playerQueue.splice(playerQueue.length-1,1);
    }
}
// Socket client has disconnected
function onClientDisconnect () {
  util.log('Player has disconnected: ' + this.id)

  var removePlayer = playerById(this.id)
  
  // Player not found
  if (!removePlayer) {
    util.log('Player not found: ' + this.id)
    return
  }
  if (playerQueue.length>0) {
      if(playerQueue[0].id==this.id) playerQueue.shift();
  }
  destroyMatch(removePlayer.id,0)
  players.splice(players.indexOf(removePlayer),1)
}


// Player has moved
function onMovePlayer (data) {
   var match=matchById(this.id)
   if (!match) return
   var myPos = playerById(this.id).position
   if (myPos==0) {
       match.playerX1 = data.x;
       socket.sockets.socket(match.playerID2).emit('move player', {x: data.x})
   }
   else {
       match.playerX2 = data.x;
       socket.sockets.socket(match.playerID1).emit('move player', {x: data.x})
   }
}

/* ************************************************
** GAME HELPER FUNCTIONS
************************************************ */
function saveToDb(name1, name2, highscore) {
    if (databaseSaving) {
        var post= {
            player1: name1,
            player2: name2,
            score: highscore
        }
        connection.query('INSERT INTO scoreList SET ?', post, function(err,result) {
            //Working as intended!
        })
    }
}
function readFromDb(id1,id2) {
    if (databaseSaving) {
        connection.query('SELECT * FROM scoreList ORDER BY score DESC LIMIT 5',function(err,rows) {
            socket.sockets.socket(id1).emit('highscores', {list: rows})
            socket.sockets.socket(id2).emit('highscores', {list: rows})
        });
        
    }
}
function destroyMatch(id, tmpReason) {
    var tmpMatch = matchById(id);
    if (!tmpMatch) return;
    socket.sockets.socket(tmpMatch.playerID1).emit('gameover', {reason: tmpReason})
    socket.sockets.socket(tmpMatch.playerID2).emit('gameover', {reason: tmpReason})
    if (tmpMatch.score>0) {
        saveToDb(tmpMatch.playerName1, tmpMatch.playerName2, tmpMatch.score);
    }
    readFromDb(tmpMatch.playerID1,tmpMatch.playerID2);
    matches.splice(matches.indexOf(tmpMatch),1);
    
}
function matchById(id) {
    for (var i=0;i<matches.length;i++) {
        if (matches[i].playerID1 == id || matches[i].playerID2 == id) return matches[i]
    }
    return false
}
function playerById (id) {
  var i
  for (i = 0; i < players.length; i++) {
    if (players[i].id === id) {
      return players[i]
    }
  }

  return false
}
(function serverTick() {
    for (var i=0;i<matches.length;i++) {
        if (matches[i].nextDroppedBaby[0] <= (new Date).getTime()-matches[i].gameStartTime) {
            matches[i].babyCount++;
            matches[i].babiesInAir.push(matches[i].nextDroppedBaby);
            var babyDropX = Math.floor(Math.random() * (750 - 50 + 1)) + 50;
            if (matches[i].babyCount < 80) matches[i].nextDroppedBaby = [(new Date).getTime()-matches[i].gameStartTime+5000-matches[i].babyCount*50,babyDropX]
            else matches[i].nextDroppedBaby = [(new Date).getTime()-matches[i].gameStartTime+1000,babyDropX]
            socket.sockets.socket(matches[i].playerID1).emit('next baby', {nextDroppedBaby:matches[i].nextDroppedBaby})
            socket.sockets.socket(matches[i].playerID2).emit('next baby', {nextDroppedBaby:matches[i].nextDroppedBaby})
        }
        if (matches[i].babiesInAir.length>0) {
            if ((new Date).getTime()-matches[i].gameStartTime - matches[i].babiesInAir[0][0] >= babyInAirTime) {
                if (matches[i].babiesInAir[0][1] + babyCatchThreshold > matches[i].playerX2) {
                    //Baby fell to the ground
                    destroyMatch(matches[i].playerID1,3)
                }
                else if(matches[i].babiesInAir[0][1] - babyCatchThreshold < matches[i].playerX1) {
                    //Baby fell to the ground
                    destroyMatch(matches[i].playerID1,3)
                    
                }
                else if (matches[i].playerX2 - matches[i].playerX1 < minAcceptablePlayerRange) {
                    //Players were too close to each other
                    destroyMatch(matches[i].playerID1,1)
                    
                }
                else if (matches[i].playerX2 - matches[i].playerX1 > maxAcceptablePlayerRange) {
                    //Players were too far away from each other
                    destroyMatch(matches[i].playerID1,2)
                    
                }
                else {
                    //Score!
                    matches[i].score++;
                    socket.sockets.socket(matches[i].playerID1).emit('babycaught', {})
                    socket.sockets.socket(matches[i].playerID2).emit('babycaught', {})
                    matches[i].babiesInAir.shift();
                }
            }
        }
    }
    currentTick++;
    setTimeout(serverTick, serverTickrate);
})();
