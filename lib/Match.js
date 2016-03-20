var Match = function(id1, id2, name1, name2,timestamp) {
    var playerID1 = id1
    var playerID2 = id2
    var playerX1 = 200
    var playerX2 = 400
    var playerName1 = name1
    var playerName2 = name2
    var gameStartTime = timestamp;
    var score = 0
    var babiesInAir = []
    var babyCount = 0
    var nextDroppedBaby
    
    return {
        playerID1: playerID1,
        playerID2: playerID2,
        playerX1: playerX1,
        playerX2: playerX2,
        playerName1: playerName1,
        playerName2: playerName2,
        score: score,
        babiesInAir: babiesInAir,
        babyCount: babyCount,
        nextDroppedBaby: nextDroppedBaby,
        gameStartTime: gameStartTime
    }
    
}
module.exports = Match