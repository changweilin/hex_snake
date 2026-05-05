# Hex Snake Balance Snapshot

format_version: 1
job_id: sim-20260501-020243-64880
generated_at: 2026-05-01T02:04:40.196Z
status: completed
cycles: 1000
seed: current-balance-1000
matches: 45000/45000
source_balance: data/balance.json

## Core Balance Values

| key | value |
| --- | --- |
| limits.gridSize.min | 6 |
| limits.gridSize.max | 12 |
| limits.foodCount.min | 1 |
| limits.foodCount.max | 4 |
| limits.initialSpeed.min | 0.5 |
| limits.initialSpeed.max | 3 |
| limits.initialLength.min | 1 |
| limits.initialLength.max | 12 |
| defaults.gridSize | 10 |
| defaults.foodCount | 4 |
| defaults.computerDifficulty | medium |
| defaults.initialSpeed | 1 |
| defaults.gmMode | false |
| defaults.initialLength | 3 |
| defaults.initialEnergy | 0 |
| defaults.initialBombs | 0 |
| defaults.playerCharacterId | dragon |
| defaults.computerCharacterId | moray |
| resources.attackNeedTotal | 6 |
| resources.maxAmmo | 3 |
| resources.maxFoodStock | 20 |
| resources.foodEnergy | 2 |
| resources.blackFoodEnergy | 3 |
| resources.singleColorStockGain | 2 |
| resources.dualColorStockGain | 1 |
| movement.baseStepMs | 460 |
| movement.moveBonusPerPoint | 0.04 |
| movement.maxMoveBonus | 0.8 |
| movement.targetMaxHex | 6 |
| attack.bigAttackBombCost | 2 |
| attack.baseAttackDelayMs | 2000 |
| attack.baseAttackCooldownMs | 2400 |
| attack.baseBlastHexRadius | 2 |
| attack.proteinRangeBonusPerPoint | 0.05 |
| attack.blastDurationMs | 520 |
| attack.attackSpeedBonusPerPoint | 0.05 |
| attack.maxAttackSpeedBonus | 1 |
| attack.damageBonusPerPoint | 0.07 |
| attack.maxDamageBonus | 1.4 |
| attack.baseAttackStunChance | 0.3 |
| attack.attackStunChanceBonusPerPoint | 0.01 |
| attack.maxAttackStunChanceBonus | 0.2 |
| attack.attackStunMs | 500 |
| attack.attackSlowMs | 500 |
| attack.rangeDamageFalloffEnabled | false |
| collision.collisionStunMs | 2000 |
| collision.collisionSlowMs | 1000 |
| collision.maxCollisionParalysisMs | 8000 |
| foodWeights.preferred | 0.4 |
| foodWeights.other | 0.2 |
| foodWeights.balancedDualChance | 0.5 |
| foodWeights.blackSpecialChance | 0.333333 |
| simulation.defaultRuns | 10000 |
| simulation.smokeRuns | 100 |
| simulation.maxMatchMs | 120000 |
| simulation.tickMs | 100 |
| simulation.balanceWinRateMin | 0.45 |
| simulation.balanceWinRateMax | 0.55 |
| simulation.characterAverageTolerance | 0.05 |
| playerModel.pathPrecision | 0.82 |
| playerModel.aimPrecision | 0.78 |
| playerModel.skillStrategy | balanced |
| playerModel.foodStrategy | balanced |

## Initial Stock Defaults

| foodType | value |
| --- | --- |
| protein | 0 |
| fat | 0 |
| fiber | 0 |
| carb | 0 |

## AI Difficulty Presets

| difficulty | pathPrecision | aimPrecision | skillStrategy | foodStrategy |
| --- | --- | --- | --- | --- |
| low | 0.48 | 0.45 | spamSmall | preferredFood |
| medium | 0.7 | 0.7 | balanced | balanced |
| high | 1 | 1 | preferBig | denyOpponent |

## Character Values

| id | name | foodPreference | specialFood | smallMove | bigMove |
| --- | --- | --- | --- | --- | --- |
| dragon | 白龍 | balanced |  | 銀鱗旋擊 | 冰霜極光龍息彈 |
| sandworm | 沙蟲 | fat |  | 潛沙絞殺 | 沙海地葬 |
| quetzal | 羽蛇 | fiber |  | 翠羽裂風 | 萬藤沼界 |
| moray | 電鰻 | carb |  | 雷牙狂咬 | 逆潮雷脈砲 |
| lobster | 智蝦 | protein |  | 赤螯重擊 | 混沌爆螯 |
| gu_king | 蠱王 | black | black | 百足毒斬 | 萬蠱蝕界令 |

## Character Result Summary

| difficulty | characterId | runs | wins | losses | draws | winRate | drawRate | averageDurationMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| high | dragon | 5000 | 668 | 3415 | 917 | 13.36% | 18.34% | 28843 |
| high | gu_king | 5000 | 2380 | 2474 | 146 | 47.60% | 2.92% | 45740 |
| high | lobster | 5000 | 2768 | 1804 | 428 | 55.36% | 8.56% | 36557 |
| high | moray | 5000 | 3120 | 1734 | 146 | 62.40% | 2.92% | 40785 |
| high | quetzal | 5000 | 2050 | 2793 | 157 | 41.00% | 3.14% | 44481 |
| high | sandworm | 5000 | 3046 | 1812 | 142 | 60.92% | 2.84% | 40466 |
| low | dragon | 5000 | 2436 | 2557 | 7 | 48.72% | 0.14% | 29123 |
| low | gu_king | 5000 | 2443 | 2555 | 2 | 48.86% | 0.04% | 29034 |
| low | lobster | 5000 | 2537 | 2452 | 11 | 50.74% | 0.22% | 29084 |
| low | moray | 5000 | 2552 | 2439 | 9 | 51.04% | 0.18% | 29233 |
| low | quetzal | 5000 | 2491 | 2500 | 9 | 49.82% | 0.18% | 29045 |
| low | sandworm | 5000 | 2519 | 2475 | 6 | 50.38% | 0.12% | 29074 |
| medium | dragon | 5000 | 2372 | 2580 | 48 | 47.44% | 0.96% | 35021 |
| medium | gu_king | 5000 | 2362 | 2593 | 45 | 47.24% | 0.90% | 35224 |
| medium | lobster | 5000 | 2583 | 2371 | 46 | 51.66% | 0.92% | 33682 |
| medium | moray | 5000 | 2545 | 2398 | 57 | 50.90% | 1.14% | 34092 |
| medium | quetzal | 5000 | 2468 | 2489 | 43 | 49.36% | 0.86% | 34239 |
| medium | sandworm | 5000 | 2524 | 2423 | 53 | 50.48% | 1.06% | 33959 |
