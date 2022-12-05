var board,
    game = new Chess();

/*The "Monte_Carlo_Search_Tree" part starts here */
// function sumArr(arr){
//         var sum = 0;
//         arr.forEach(function(val,index,arr){
//               sum += val;
//         })
//     return sum;
// };
// function SoftMax(arr){
//         var sum = 0;
//         arr.forEach(function(val,index,arr){
//               sum += val;
//         })
//     return sum;
// };

class TreeNode {
	constructor(parent, prior, sigma) {
		this.par = parent;
		this.prior = prior;
		this.Q = 9999; // 价值函数
		this.N = 0; // 访问次数
		this.sigma = sigma; // 贪婪动作选择概率
		this.children = [];
	}
	
	calc_prob() {
		for (var i=0; i< this.children.length; i++) {
			this.children[i].prior = 1 / (this.children[i].N + 1)
		}
	}
	
	expand(num) {
		if (this.children.length == 0) {
			for(var i = 0; i < num; i++) {
				this.children[i] = new TreeNode(this, 1 / num);
			}
		}
	}
	
	is_root() {
		return (this.par == null);
	}
	
	is_leaf() {
		return (this.children.length == 0);
	}
	
	update(qval) {
		this.Q = this.Q * this.N + qval;
		this.N += 1;
		this.Q = this.Q /this.N;
		this.calc_prob()
	}
	
	score(c_puct) {
		var sum = 0;
		for (var i=0; i< this.children.length; i++) {
			sum += this.children[i].N;
		}
		// this.children.forEach(function(val, index) {
		// 	sum += val.N;
		// });
		var sqrt_sum = Math.sqrt(sum);
		return this.Q + c_puct * this.prior * sqrt_sum / (this.N + 1);
	}
	
	backup(qval) {
		this.update(qval);
		if (!this.is_root()) {
			this.par.backup(-qval);
		}
	}
	
	final_select(c_puct) {
		var max_score_index = 0;
		var max_score_value = this.children[max_score_index].score(c_puct);
		
		for (var i=0; i< this.children.length; i++) {
			var this_score = this.children[i].Q;
			if (this_score > max_score_value) {
				max_score_index = i;
				max_score_value = this_score;
			}
		}
		
		return new Array(max_score_index, this.children[max_score_index]);
	}
	
	choice(c_puct, maxORmin = true) {
		var max_score_index = 0;
		var max_score_value = this.children[max_score_index].score(c_puct);
		
		if (Math.random() < this.sigma) {
			for (var i=0; i< this.children.length; i++) {
				var this_score = this.children[i].score(c_puct);
				if (maxORmin) {
					if (this_score > max_score_value) {
						max_score_index = i;
						max_score_value = this_score;
					}
				}
				else {
					if (this_score < max_score_value) {
						max_score_index = i;
						max_score_value = this_score;
					}
				}
			}
		}
		else {
			max_score_index = Math.floor(Math.random() * this.children.length);
		}
		
		// this.children.forEach(function(val, index) {
		// 	this_score = val.score(c_puct);
		// 	if (this_score > max_score_value) {
		// 		max_score_index = index;
		// 		max_score_value = this_score;
		// 	}
		// });
		return new Array(max_score_index, this.children[max_score_index]);
	}
};


//var fs = require('fs');

function MCTS(game, board){
  this.real_game = game;
  this.board = board;

  //Dictionary of move stats. Each entry in the dictionary holds:
  // 0. number of games white won
  // 1. number of games drawn
  // 2. number of games black won
  this.move_stats = {};
  //dictionary that maps the game result to the appropriate entry in move_stats
  this.stat_idx = {"w":0, "d":1, "b":2};
  this.max_calculation_time = 10*1000;  //in milliseconds
  
  this.max_simulated_epoches = parseInt($('#MCST-epoches').find(':selected').text());
  this.max_moves = 1000
  this.exploration = 1.4

  //Updates the AI's game
  //the AI can't see what the other player plays if you don't update it
  this.update_game = function(game){
    this.real_game = game;
  };

  this.is_fen_in_stats = function(fen){
    return (fen in this.move_stats);
  }

  //calculates the best move
  this.get_best_move = function(){
	var newGameMoves = JSON.parse(JSON.stringify(game.ugly_moves()));
    var possible_moves = this.real_game.moves();
    var player = this.real_game.turn();
    var simulated_game = new Chess(this.real_game.fen());

    //If there's no legal moves, or only one, return early
    if (possible_moves.length == 0){
      return 0;
    }
    if (possible_moves.length == 1){
      return possible_moves[0];
    }

    //get FENs for all possible moves
    var possible_fens = possible_moves.map(function(m) {
      simulated_game.move(m);
      var fen = simulated_game.fen();
      simulated_game.undo();
      return fen;
    });
	
	//get evaluate_values for all possible moves
	var possible_ev = possible_moves.map(function(m) {
	  simulated_game.move(m);
	  var ev = -evaluateBoard(simulated_game.board());
	  simulated_game.undo();
	  return ev;
	});

    var num_simulations = 0;
    //run simulation for this.max_calculation_time
	for (;num_simulations < this.max_simulated_epoches;num_simulations++)
	{
		this.simulate_game();
	}
    // start_calc_time = Date.now();
    // while (Date.now() - start_calc_time < this.max_calculation_time){
    //   this.simulate_game();
    //   num_simulations++;
    // }

    //get winrates for moves
    var win_rates = new Array(possible_fens.length);
    for (var fen_idx = 0; fen_idx < possible_fens.length; fen_idx++){
        if (!(possible_fens[fen_idx] in this.move_stats)){
            this.move_stats[possible_fens[fen_idx]] = [0,0,0];
        }
        var wins = this.move_stats[possible_fens[fen_idx]][this.stat_idx[player]];
        var num_games = this.move_stats[possible_fens[fen_idx]][0];
        num_games += this.move_stats[possible_fens[fen_idx]][1];
        num_games += this.move_stats[possible_fens[fen_idx]][2];

        if(num_games){
          win_rates[fen_idx] = wins/num_games;
        }
        else {
          win_rates[fen_idx] = 0;
        }
    }

    //find move with best winrates
    var max_win_rate_idx = Math.floor(Math.random() * possible_moves.length);
    for (var j = 0; j < win_rates.length; j++){
        if (win_rates[j] > win_rates[max_win_rate_idx]){
            max_win_rate_idx = j;
        }
    }

    return newGameMoves[max_win_rate_idx];
  };

  //runs sumulations on the possible moves from current board state
  this.simulate_game = function(){
    var visited = new Set();
    var simulated_game = new Chess(this.real_game.fen());
    var current_player = simulated_game.turn();

    for (var i = 0; i < this.max_moves; i++){
      var possible_moves = simulated_game.moves();

      //gen FENs for all possible_moves
      var possible_fens = possible_moves.map(function(m) {
        simulated_game.move(m);
        var fen = simulated_game.fen();
        simulated_game.undo();
        return fen;
      });
	  
	  //get evaluate_values for all possible moves
	  // var possible_ev = possible_moves.map(function(m) {
	  //   simulated_game.move(m);
	  //   var ev = -evaluateBoard(simulated_game.board());
	  //   simulated_game.undo();
	  //   return ev;
	  // });

      //check if all of the moves are in this.move_stats
      var all_fens_have_stats = possible_fens.every(this.is_fen_in_stats.bind(this));

      //if all moves/fens have stats
      if (all_fens_have_stats){
        //choose by UCT
        //sum of all simulated games of the possible FENs
        var sum_all_games = possible_fens.reduce(function(sum, fen){
          sum += this.move_stats[fen][0];
          sum += this.move_stats[fen][1];
          sum += this.move_stats[fen][2];
          return sum;
        }.bind(this));
	
        //calculate UCT values
	var ucts = possible_fens.map(function(fen){
	  var num_wins = this.move_stats[fen][this.stat_idx[current_player]];
	  var num_games = this.move_stats[fen][0];
	  num_games += this.move_stats[fen][1];
	  num_games += this.move_stats[fen][2];
	  var uct = num_wins/num_games;
	  uct += this.exploration*(Math.sqrt(Math.log(sum_all_games)/num_games));
	  return uct;
	}, this);

        //find best move (highest UCT value)
        var max_uct_idx = 0;
        for (var j = 0; j < ucts.length; j++){
            if (ucts[j] > ucts[max_uct_idx]){
                max_uct_idx = j;
            }
        }

        var move_to_play = possible_moves[max_uct_idx];

      } else {
        //play random move
		// var random_move_idx = 0
		// for (var k=1; k< possible_ev.length; k++) {
		// 	if (possible_ev[k] > possible_ev[random_move_idx]) {
		// 		random_move_idx = k;
		// 	}
		// }
        var random_move_idx = Math.floor(Math.random() * possible_moves.length);
        var move_to_play = possible_moves[random_move_idx];
      }
      simulated_game.move(move_to_play);
      visited.add(simulated_game.fen());


      //If game is over, get winner (white, black or draw)
      //TODO: what if game is not over in this.max_moves ???
      if (simulated_game.game_over()){
        if (simulated_game.in_checkmate()){
          if (simulated_game.turn() == 'w'){
            var winner = 'b';
          } else {
            var winner = 'w';
          }
        } else {
          var winner = 'd';
        }
        break;
      }

    }
    //update move_states with all of the visited moves
    for (let fen of visited){
      if (!(fen in this.move_stats)){
        this.move_stats[fen] = [0,0,0];
      }
      this.move_stats[fen][this.stat_idx[winner]]++;
    }
  }
	return this.get_best_move()
}

var mctsRoot = function(depth, game, isMaximisingPlayer) {

    var newGameMoves = JSON.parse(JSON.stringify(game.ugly_moves()));
	
	var sigma = 0.95;
	var c_puct = 20.0;
	var search_times = 20;
	
	var root = new TreeNode(null, 1.0);
	root.expand(newGameMoves.length);
	
	var nextGameMoves = game.ugly_moves();
	for(var i = 0; i < search_times; i++) {
		var pnow = root;
		var j = 0;
		for (; j < depth; j++){
			var t = pnow.choice(c_puct);
			var action = t[0];
			var node = t[1];
			
			game.ugly_move(nextGameMoves[action]);
			nextGameMoves = game.ugly_moves();
			
			node.expand(nextGameMoves.length);
			
			var val = -evaluateBoard(game.board());
			node.backup(val);
			
			pnow = node;
			
			
			if (nextGameMoves.length == 0) {
				j += 1;
				break;
			}
		}
		
		for (; j > 0; j--){
			game.undo();
			nextGameMoves = game.ugly_moves();
		}
	}
	
	var t = root.final_select(c_puct);
	var action = t[0];
	var node = t[1];
	return newGameMoves[action];
	// par = root;
	// for(var i = 0; i < newGameMoves.length; i++) {
	//     var newGameMove = newGameMoves[i]
	//     game.ugly_move(newGameMove);
	// 	pnow = TreeNode(par, 1 / newGameMoves.length)
	//     var value = minimax(depth - 1, game, -10000, 10000, !isMaximisingPlayer);
	//     game.undo();
	// }
    // var bestMove = -9999;
    // var bestMoveFound;

    // for(var i = 0; i < newGameMoves.length; i++) {
    //     var newGameMove = newGameMoves[i]
    //     game.ugly_move(newGameMove);
    //     var value = minimax(depth - 1, game, -10000, 10000, !isMaximisingPlayer);
    //     game.undo();
    //     if(value >= bestMove) {
    //         bestMove = value;
    //         bestMoveFound = newGameMove;
    //     }
    // }
    // return bestMoveFound;
};
/*The "Monte_Carlo_Search_Tree" part starts here */

/*The "Minnimax_Game_Tree" part starts here */
var minimaxRoot =function(depth, game, isMaximisingPlayer) {

    var newGameMoves = game.ugly_moves();
    var bestMove = -9999;
    var bestMoveFound;

    for(var i = 0; i < newGameMoves.length; i++) {
        var newGameMove = newGameMoves[i]
        game.ugly_move(newGameMove);
        var value = minimax(depth - 1, game, -10000, 10000, !isMaximisingPlayer);
        game.undo();
        if(value >= bestMove) {
            bestMove = value;
            bestMoveFound = newGameMove;
        }
    }
    return bestMoveFound;
};

var minimax = function (depth, game, alpha, beta, isMaximisingPlayer) {
    positionCount++;
    if (depth === 0) {
        return -evaluateBoard(game.board());
    }

    var newGameMoves = game.ugly_moves();

    if (isMaximisingPlayer) {
        var bestMove = -9999;
        for (var i = 0; i < newGameMoves.length; i++) {
            game.ugly_move(newGameMoves[i]);
            bestMove = Math.max(bestMove, minimax(depth - 1, game, alpha, beta, !isMaximisingPlayer));
            game.undo();
            alpha = Math.max(alpha, bestMove);
            if (beta <= alpha) {
                return bestMove;
            }
        }
        return bestMove;
    } else {
        var bestMove = 9999;
        for (var i = 0; i < newGameMoves.length; i++) {
            game.ugly_move(newGameMoves[i]);
            bestMove = Math.min(bestMove, minimax(depth - 1, game, alpha, beta, !isMaximisingPlayer));
            game.undo();
            beta = Math.min(beta, bestMove);
            if (beta <= alpha) {
                return bestMove;
            }
        }
        return bestMove;
    }
};
/*The "Minnimax_Game_Tree" part starts here */

var evaluateBoard = function (board) {
    var totalEvaluation = 0;
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            totalEvaluation = totalEvaluation + getPieceValue(board[i][j], i ,j);
        }
    }
    return totalEvaluation;
};

var reverseArray = function(array) {
    return array.slice().reverse();
};

var pawnEvalWhite =
    [
        [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
        [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
        [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
        [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
        [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
        [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
        [0.5,  1.0, 1.0,  -2.0, -2.0,  1.0,  1.0,  0.5],
        [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
    ];

var pawnEvalBlack = reverseArray(pawnEvalWhite);

var knightEval =
    [
        [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
        [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
        [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
        [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
        [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
        [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
        [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
        [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
    ];

var bishopEvalWhite = [
    [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
    [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [ -1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
    [ -1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
    [ -1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
    [ -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
    [ -1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
];

var bishopEvalBlack = reverseArray(bishopEvalWhite);

var rookEvalWhite = [
    [  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [  0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
    [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [  0.0,   0.0, 0.0,  0.5,  0.5,  0.0,  0.0,  0.0]
];

var rookEvalBlack = reverseArray(rookEvalWhite);

var evalQueen = [
    [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
    [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [ -1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [ -0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [  0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [ -1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [ -1.0,  0.0,  0.5,  0.0,  0.0,  0.0,  0.0, -1.0],
    [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
];

var kingEvalWhite = [

    [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [ -2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
    [ -1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
    [  2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0 ],
    [  2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0 ]
];

var kingEvalBlack = reverseArray(kingEvalWhite);




var getPieceValue = function (piece, x, y) {
    if (piece === null) {
        return 0;
    }
    var getAbsoluteValue = function (piece, isWhite, x ,y) {
        if (piece.type === 'p') {
            return 10 + ( isWhite ? pawnEvalWhite[y][x] : pawnEvalBlack[y][x] );
        } else if (piece.type === 'r') {
            return 50 + ( isWhite ? rookEvalWhite[y][x] : rookEvalBlack[y][x] );
        } else if (piece.type === 'n') {
            return 30 + knightEval[y][x];
        } else if (piece.type === 'b') {
            return 30 + ( isWhite ? bishopEvalWhite[y][x] : bishopEvalBlack[y][x] );
        } else if (piece.type === 'q') {
            return 90 + evalQueen[y][x];
        } else if (piece.type === 'k') {
            return 900 + ( isWhite ? kingEvalWhite[y][x] : kingEvalBlack[y][x] );
        }
        throw "Unknown piece type: " + piece.type;
    };

    var absoluteValue = getAbsoluteValue(piece, piece.color === 'w', x ,y);
    return piece.color === 'w' ? absoluteValue : -absoluteValue;
};


/* board visualization and games state handling */

var onDragStart = function (source, piece, position, orientation) {
    if (game.in_checkmate() === true || game.in_draw() === true ||
        piece.search(/^b/) !== -1) {
        return false;
    }
};

var makeBestMove = function () {
    var bestMove = getBestMove(game);
    game.ugly_move(bestMove);
    board.position(game.fen());
    renderMoveHistory(game.history());
    if (game.game_over()) {
        alert('Game over');
    }
};


var positionCount;
var getBestMove = function (game) {
    if (game.game_over()) {
        alert('Game over');
    }

    positionCount = 0;
    var depth = parseInt($('#search-depth').find(':selected').text());
    var d = new Date().getTime();
	console.log($('#search-way').find(':selected').text());
	if ($('#search-way').find(':selected').text() == "Monte Carlo Search Tree") {
		var bestMove = MCTS(game, board);
		// var bestMove = mctsRoot(depth, game, true);
		console.log("mctsRoot");
	}
	else {
		var bestMove = minimaxRoot(depth, game, true);
		console.log("minimaxRoot");
	}
    var d2 = new Date().getTime();
    var moveTime = (d2 - d);
    var positionsPerS = ( positionCount * 1000 / moveTime);

    $('#position-count').text(positionCount);
    $('#time').text(moveTime/1000 + 's');
    $('#positions-per-s').text(positionsPerS);
    return bestMove;
};

var renderMoveHistory = function (moves) {
    var historyElement = $('#move-history').empty();
    historyElement.empty();
    for (var i = 0; i < moves.length; i = i + 2) {
        historyElement.append('<span>' + moves[i] + ' ' + ( moves[i + 1] ? moves[i + 1] : ' ') + '</span><br>')
    }
    historyElement.scrollTop(historyElement[0].scrollHeight);

};

var onDrop = function (source, target) {

    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    removeGreySquares();
    if (move === null) {
        return 'snapback';
    }

    renderMoveHistory(game.history());
    window.setTimeout(makeBestMove, 250);
};

var onSnapEnd = function () {
    board.position(game.fen());
};

var onMouseoverSquare = function(square, piece) {
    var moves = game.moves({
        square: square,
        verbose: true
    });

    if (moves.length === 0) return;

    greySquare(square);

    for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to);
    }
};

var onMouseoutSquare = function(square, piece) {
    removeGreySquares();
};

var removeGreySquares = function() {
    $('#board .square-55d63').css('background', '');
};

var greySquare = function(square) {
    var squareEl = $('#board .square-' + square);

    var background = '#a9a9a9';
    if (squareEl.hasClass('black-3c85d') === true) {
        background = '#696969';
    }

    squareEl.css('background', background);
};

var cfg = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
};
board = ChessBoard('board', cfg);