/* global Phaser RemotePlayer io */

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update})

var background

var socket // Socket connection

var nametext1;
var nametext2;
var style = { font: "16px Helvetica", fill: "#11BB11", align: "center",stroke: 'black',strokeThickness:2};
//Timers
var gameStartTime;

var player1;
var player2;
var droppingBaby;
var evilman;

var sheet;
var music;
var splash;

var babies = [];
var score=0
var pageLoaded=false;
var currentTime=0
var inGame = false;
var maxAcceptablePlayerRange = 200 //can't move away from the other player if X2-X1 is larger than this
var minAcceptablePlayerRange = 25 // players are too close to each other
var myName;
var myPlayerX;
var partnerName;
var partnerX;
var myPosition;
var partnerPosition;
var lastMoveTime=0
var nextDroppedBaby
var lastOtherPlayerMoveTime=0;

var npcSpeed=0;

var lastMovement=0;
var controlKeys;
var lastBabyMoveTime=0;
var lastNpcMoveTime=0;

function preload () {
    //Load assets and sounds
    game.load.image('background', 'assets/background.jpg');
    game.load.spritesheet('baby', 'assets/vauvasprite.png', 30, 20);
    game.load.spritesheet("sheet","assets/sheet2.png",200,32)
    game.load.spritesheet('player1', 'assets/nappaaja1_sprite.png', 38, 94);
    game.load.spritesheet('player2', 'assets/nappaaja2_sprite.png', 38, 94);
    game.load.image('evilman', 'assets/heittaja.png');
    game.load.audio('music', 'sounds/music.ogg');
    game.load.audio('splash', 'sounds/splash.ogg');
    game.stage.disableVisibilityChange = true;
}


function create () {
    //Page is loaded, creating connection to the server
  socket = io.connect()

  
    //game.physics.startSystem(Phaser.Physics.ARCADE);
    game.add.tileSprite(0,0, 800, 600, "background");
    
    sheet = game.add.sprite(200+20,490+40,'sheet');
    sheet.animations.add('shape',[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], 6, true)
    
    player1 = game.add.sprite(200,490,'player1');
    player1.animations.add("walk",[0,1,2],6,true);
    
    player2 = game.add.sprite(400,490,"player2");
    player2.animations.add("walk",[0,1,2],6,true);
    
    
    
    evilman=game.add.sprite(100,10,"evilman");
    evilman.scale.setTo(0.6,0.6);
    
    music = game.add.audio('music');
    music.loop=true;
    splash = game.add.audio('splash');
    music.play();
    // Start listening for events
    setEventHandlers()
}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // Player move message received
  socket.on('move player', onMovePlayer)
  
  socket.on('no players', noPlayersYet)
  
  socket.on('match started', onMatchStarted)
  
  socket.on('next baby', onBabyDrop)
  
  socket.on('gameover', onGameover)
  
  socket.on('babycaught', onBabyCatch)
  
  socket.on('highscores', onHighscores)
  
}

function newBaby(posX,dropTime) {
    npcSpeed = (posX-evilman.position.x)/((dropTime-currentTime)/50)
    droppingBaby = game.add.sprite(posX+5,-200,"baby")
    droppingBaby.visible=false;
    babies.push([droppingBaby,dropTime]);
}

function onHighscores(data) {
    $('.highscorelist').css("visibility","visible");
    var htmlt="<table class='highscoretable'>";
    htmlt+='<tr><td></td><td>Players</td><td>Score</td></tr>';
    for (var i=0;i<data.list.length;i++) {
        var position=i+1;
        htmlt+='<tr><td>'+position+'.</td><td>'+data.list[i].player1 + ' & ' + data.list[i].player2+'</td><td>'+data.list[i].score+'</td></tr>';
        }
    htmlt+='</table>';
    $('.scoretablehere').append(htmlt);
}
function onBabyCatch() {
    score++;
    $('.score').text("Score: " + score);
    babies[0][0].destroy();
    babies.shift();
}
function onGameover(data) {
    splash.play();
    inGame=false;
    babies[0][0].frame=1;
    player1.animations.stop();
    player2.animations.stop();
    switch(data.reason) {
        case 0:
            $('.info').text('WTF?! ' + partnerName + ' has left the game! Your score: ' + score);
            break;
        case 1:
            $('.info').text('WTF?! You let the baby die! The sheet was too loose (the baby hit the ground)! Your score: ' + score);
            break;
        case 2:
            $('.info').text('WTF?! You let the baby die! The sheet was too tight (the baby broke his/her/its neck)! Your score: ' + score);
            break;
        case 3:
            $('.info').text("WTF?! You let the baby die! The baby didn't hit the sheet! Your score: " + score);
            break;
        
    }
    $('.playAgain').css('visibility','visible');
    
}
function onBabyDrop(data) {
    nextDroppedBaby = data.nextDroppedBaby
    nextDroppedBaby[0] = nextDroppedBaby[0]
    newBaby(nextDroppedBaby[1],nextDroppedBaby[0])
}

function onMatchStarted(data) {
    $('.info').text('');
    lastOtherPlayerMoveTime=0;
    npcSpeed=0;
    lastMovement=0;
    controlKeys;
    lastBabyMoveTime=0;
    lastNpcMoveTime=0;
    lastMoveTime=0
    currentTime=0
    score=0
    babies=[]
    
    
    inGame = true;
    gameStartTime = (new Date).getTime();
    $('.scoretablehere').html('');
    
    $('.playAgain').css('visibility','hidden');
    controlKeys = { 
		left: game.input.keyboard.addKey(Phaser.Keyboard.A),
		right: game.input.keyboard.addKey(Phaser.Keyboard.D),
    };
    $('.highscores').css('visibility','hidden');
    $('.score').css('visibility','visible');
    $('.score').text("Score: " + score);
    
    partnerName = data.otherPlayerName
    if (data.playerPos==0) {
        myPlayerX = 200
        partnerX = 400
        myPosition=0
        partnerPosition=1
        nametext1=game.add.text(myPlayerX+19,475,myName,style);
        nametext2=game.add.text(partnerX+19,475,partnerName,style);
    }
    else {
        myPlayerX=400
        partnerX=200
        myPosition=1
        partnerPosition=0
        nametext2=game.add.text(myPlayerX+19,475,myName,style);
        nametext1=game.add.text(partnerX+19,475,partnerName,style);
    }
    nametext1.anchor.set(0.5)
    nametext2.anchor.set(0.5)
    nextDroppedBaby = data.nextDroppedBaby
    newBaby(nextDroppedBaby[1],nextDroppedBaby[0])
}

function noPlayersYet() {
    $('.info').text("Waiting for another player to join...");
}
// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')
}

// Socket disconnected
function onSocketDisconnect () {
    $('.info').text("Connection has been lost! Try to press F5 for bacon.");
}

// Move player
function onMovePlayer (data) {
  partnerX = data.x
  if (partnerPosition==0) player1.animations.play("walk");
  else player2.animations.play("walk")
  lastOtherPlayerMoveTime=currentTime;
}
function playAgain() {
    nametext1.destroy();
    nametext2.destroy();
    $('.scores').text()
    $('.playAgain').css('visibility','hidden');
    $('.scoretablehere').html('');
    $('.highscores').css('visibility','hidden');
    
    for (var i=0;i<babies.length;i++) {
        babies[i][0].destroy();
        babies.splice(i,1);
    }
    socket.emit('restart', {});
}
function sendName(name) {
    myName = name;
    $('.nameField').remove();
    $('.sendName').remove();
    socket.emit('new name', {name: name});
}
function update () {
    if (inGame) {
        currentTime = (new Date).getTime()-gameStartTime;
        if (currentTime-lastNpcMoveTime>=50) {
            evilman.position.x+=npcSpeed;
            lastNpcMoveTime = currentTime;
        }
        for (var i=0;i<babies.length;i++) {
            if (currentTime-babies[i][1]>=0 && currentTime-lastBabyMoveTime>=50) {
                lastBabyMoveTime = currentTime;
                babies[i][0].position.y = evilman.position.y+40+(currentTime-babies[i][1])/4;
                if (babies[i][0].visible==false) babies[i][0].visible=true;
            }
        }
        lastMovement=myPlayerX;
        if (controlKeys.left.isDown && currentTime - lastMoveTime >= 50 && myPlayerX >= 0) {
            if (myPosition==1 && Math.abs(myPlayerX-partnerX)>=minAcceptablePlayerRange) {
                myPlayerX-=8;
                lastMoveTime = currentTime
                player2.animations.play("walk");
            }
            else if (myPosition == 0 && Math.abs(myPlayerX-partnerX)<=maxAcceptablePlayerRange){
                myPlayerX-=8;
                lastMoveTime = currentTime
                player1.animations.play("walk");
            }
            else if (myPosition==0) {
                player1.animations.stop();
            }
            else if(myPosition==1) {
                player2.animations.stop();
            }
        }
        else if (controlKeys.right.isDown && currentTime - lastMoveTime >= 50 && myPlayerX <=800-38) {
            if (myPosition==1 && Math.abs(myPlayerX-partnerX)<=maxAcceptablePlayerRange) {
                myPlayerX+=8;
                lastMoveTime = currentTime
                player2.animations.play("walk");
            }
            else if (myPosition == 0 && Math.abs(myPlayerX-partnerX)>=minAcceptablePlayerRange){
                myPlayerX+=8;
                lastMoveTime = currentTime
                player1.animations.play("walk");
            }
            else if (myPosition==0) {
                player1.animations.stop();
            }
            else if(myPosition==1) {
                player2.animations.stop();
            }
            
        }
        else if (!controlKeys.right.isDown && !controlKeys.left.isDown) {
            if (myPosition==0) {
                player1.animations.stop();
            }
            else if(myPosition==1) {
                player2.animations.stop();
            }
        }
        if (myPosition==0) {
            player1.position.x = myPlayerX;
            player2.position.x = partnerX;
        }
        else {
            player2.position.x = myPlayerX;
            player1.position.x = partnerX;
        }
        nametext1.x=player1.position.x+19;
        nametext2.x=player2.position.x+19;
        if (currentTime-lastOtherPlayerMoveTime>=100) {
            if (partnerPosition==0) player1.animations.stop();
            else player2.animations.stop()
        }
        sheet.position.x = player1.position.x + 20;
        sheet.position.y = player2.position.y + 40;
        var playerDist = player2.position.x- player1.position.x;
        if (playerDist < 210) { sheet.frame = 0; }
            
        if (playerDist < 192) { sheet.frame = 1; }
   
        if (playerDist < 182) { sheet.frame = 2; }
        
        if (playerDist < 172) { sheet.frame = 3; }
        
        if (playerDist < 162) { sheet.frame = 4; }
        
        if (playerDist < 152) { sheet.frame = 5; }
        
        if (playerDist < 142) { sheet.frame = 6; }
        
        if (playerDist < 132) { sheet.frame = 7; }
        
        if (playerDist < 122) { sheet.frame = 8; }
        
        if (playerDist < 112) { sheet.frame = 9; }
        
        if (playerDist < 102) { sheet.frame = 10; }
        
        if (playerDist < 92) { sheet.frame = 11; }
        
        if (playerDist < 82) { sheet.frame = 12; }
        
        if (playerDist < 72) { sheet.frame = 13; }
        
        if (playerDist < 62) { sheet.frame = 14; }
        
        if (playerDist < 52) { sheet.frame = 15; }
        
        if (playerDist < 42) { sheet.frame = 16; }
        if (myPlayerX!=lastMovement) socket.emit('move player', { x: myPlayerX})
    }
   
}

$(document).ready(function() {
    pageLoaded = true;
$(".sendName").click(function(){
    sendName($('.nameField').val());
})
$('.playAgain').click(function() {
    playAgain();
})
});