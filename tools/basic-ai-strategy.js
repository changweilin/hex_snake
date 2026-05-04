const BASIC_STRATEGY_ID = "baseline-basic";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function basicStrategyWeights() {
  return {
    movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
    food: {
      fastestArrival: 3,
      ownDeficit: 0,
      opponentDeficit: 0,
      ownPreferred: 0,
      opponentPreferred: 0
    },
    skillAllocation: { preferSmall: 1, preferBig: 1 },
    castTiming: {
      lethal: 3,
      nearFullEnergy: 3,
      opponentDebuffed: 3,
      opponentAlmostReady: 0,
      nearOpponent: 0,
      farOpponent: 0
    },
    castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
    castDirection: {
      selfHeadToOpponentHead: 0,
      opponentBodyLongestAxis: 0,
      opponentHeadToNearestFood: 3
    }
  };
}

function makeBasicStrategy(id = BASIC_STRATEGY_ID) {
  return {
    id,
    strategyWeights: basicStrategyWeights()
  };
}

function makeBasicPolicy(characterId, id = BASIC_STRATEGY_ID) {
  return {
    aiDifficulty: "high",
    pathPrecision: 1,
    aimPrecision: 1,
    skillStrategy: "balanced",
    foodStrategy: "balanced",
    strategyId: id,
    characterStrategyId: `${characterId}:${id}`,
    strategyWeights: clone(basicStrategyWeights())
  };
}

module.exports = {
  BASIC_STRATEGY_ID,
  basicStrategyWeights,
  makeBasicPolicy,
  makeBasicStrategy
};
