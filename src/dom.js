    const canvas = document.querySelector("#game");
    const ctx = canvas.getContext("2d");
    const playArea = document.querySelector("#playArea");
    const perfOverlay = document.querySelector("#perfOverlay");
    const perfFps = document.querySelector("#perfFps");
    const perfFrameMs = document.querySelector("#perfFrameMs");
    const targetModeSmallIndicator = document.querySelector("#targetModeSmallIndicator");
    const targetModeBigIndicator = document.querySelector("#targetModeBigIndicator");
    const targetModeSmallIcon = document.querySelector("#targetModeSmallIcon");
    const targetModeBigIcon = document.querySelector("#targetModeBigIcon");
    const cooldownSmallIndicator = document.querySelector("#cooldownSmallIndicator");
    const cooldownBigIndicator = document.querySelector("#cooldownBigIndicator");
    const cooldownSmallValue = document.querySelector("#cooldownSmallValue");
    const cooldownBigValue = document.querySelector("#cooldownBigValue");
    const overlay = document.querySelector("#overlay");
    const overlayTitle = document.querySelector("#overlayTitle");
    const overlayText = document.querySelector("#overlayText");
    const resultHighlights = document.querySelector("#resultHighlights");
    const startButton = document.querySelector("#startButton");
    const computerBattleButton = document.querySelector("#computerBattleButton");
    const skillTrainingButton = document.querySelector("#skillTrainingButton");
    const replayArchiveButton = document.querySelector("#replayArchiveButton");
    const resultSharePanel = document.querySelector("#resultSharePanel");
    const shareResultStatus = document.querySelector("#shareResultStatus");
    const settingsReplayButton = document.querySelector("#settingsReplayButton");
    const statsButton = document.querySelector("#statsButton");
    const replayControls = document.querySelector("#replayControls");
    const replayReverseButton = document.querySelector("#replayReverseButton");
    const replayPlayButton = document.querySelector("#replayPlayButton");
    const replayPrevButton = document.querySelector("#replayPrevButton");
    const replayNextButton = document.querySelector("#replayNextButton");
    const replayTimeline = document.querySelector("#replayTimeline");
    const replaySpeedSelect = document.querySelector("#replaySpeedSelect");
    const replaySpeedMenu = document.querySelector("#replaySpeedMenu");
    const replayExitButton = document.querySelector("#replayExitButton");
    const replayTime = document.querySelector("#replayTime");
    const replayModal = document.querySelector("#replayModal");
    const replayModalClose = document.querySelector("#replayModalClose");
    const replayMessage = document.querySelector("#replayMessage");
    const matchHistoryTabButtons = [...document.querySelectorAll("[data-match-history-tab]")];
    const matchHistoryPanels = [...document.querySelectorAll("[data-match-history-panel]")];
    const matchHistoryShareEmpty = document.querySelector("#matchHistoryShareEmpty");
    const matchHistoryShareContent = document.querySelector("#matchHistoryShareContent");
    const matchHistorySharePreview = document.querySelector("#matchHistorySharePreview");
    const matchHistoryShareCopyButton = document.querySelector("#matchHistoryShareCopyButton");
    const matchHistorySystemShareButton = document.querySelector("#matchHistorySystemShareButton");
    const matchHistoryEntryButtons = [...document.querySelectorAll("[data-match-history-entry]")];
    const recentReplayList = document.querySelector("#recentReplayList");
    const favoriteReplayList = document.querySelector("#favoriteReplayList");
    const recentReplayCount = document.querySelector("#recentReplayCount");
    const favoriteReplayCount = document.querySelector("#favoriteReplayCount");
    const statsModal = replayModal;
    const statsModalClose = replayModalClose;
    const statsSummary = document.querySelector("#statsSummary");
    const statsRecentCount = document.querySelector("#statsRecentCount");
    const statsRecentList = document.querySelector("#statsRecentList");
    const statsCharacterCount = document.querySelector("#statsCharacterCount");
    const statsCharacterList = document.querySelector("#statsCharacterList");
    const statsClearButton = document.querySelector("#statsClearButton");
    const autoBattlePanel = document.querySelector("#autoBattlePanel");
    const autoBattleSpeedSelect = document.querySelector("#autoBattleSpeedSelect");
    const autoSpeedMenu = document.querySelector("#autoSpeedMenu");
    const autoPauseButton = document.querySelector("[data-auto-pause]");
    const relayPanel = document.querySelector("#relayPanel");
    const relayModeInput = document.querySelector("#relayModeInput");
    const relayScore = document.querySelector("#relayScore");
    const introCloseButton = document.querySelector("#introCloseButton");
    const winnerPortrait = document.querySelector("#winnerPortrait");
    const portraitLightbox = document.querySelector("#portraitLightbox");
    const portraitLightboxImage = document.querySelector("#portraitLightboxImage");
    const portraitLightboxCaption = document.querySelector("#portraitLightboxCaption");
    const portraitLightboxClose = document.querySelector("#portraitLightboxClose");
    const portraitLightboxShiftButtons = document.querySelectorAll("[data-portrait-lightbox-shift]");
    const portraitLightboxVariantButtons = document.querySelectorAll("[data-portrait-lightbox-direction]");
    const statusEl = document.querySelector("#status");
    const scoreEl = document.querySelector("#score");
    const computerScoreEl = document.querySelector("#computerScore");
    const playerHealthBar = document.querySelector("#playerHealthBar");
    const computerHealthBar = document.querySelector("#computerHealthBar");
    const bestEl = document.querySelector("#best");
    const playerSpeedEl = document.querySelector("#playerSpeed");
    const computerSpeedEl = document.querySelector("#computerSpeed");
    const totalTimeEl = document.querySelector("#totalTime");
    const lastFeedTimeEl = document.querySelector("#lastFeedTime");
    const bestTimeEl = document.querySelector("#bestTime");
    const stick = document.querySelector("#stick");
    const controlRow = document.querySelector("#controlRow");
    const smallAttackButton = document.querySelector("#smallAttackButton");
    const bigAttackButton = document.querySelector("#bigAttackButton");
    const keyboardSmallAimButton = document.querySelector("#keyboardSmallAimButton");
    const keyboardBigAimButton = document.querySelector("#keyboardBigAimButton");
    const leftHandModeInput = document.querySelector("#leftHandMode");
    const sfxMuteToggle = document.querySelector("#sfxMuteToggle");
    const lowPowerModeInput = document.querySelector("#lowPowerMode");
    const perfStatsToggle = document.querySelector("#perfStatsToggle");
    const surrenderButton = document.querySelector("#surrenderButton");
    const joyZone = document.querySelector("#joyZone");
    const rulesButton = document.querySelector("#rulesButton");
    const rulesModal = document.querySelector("#rulesModal");
    const rulesContent = document.querySelector("#rulesContent");
    const rulesCloseButton = document.querySelector("#rulesCloseButton");
    const hexDirButtons = [...document.querySelectorAll("[data-dir-button]")];
    const settingsDirButtons = [...document.querySelectorAll("[data-settings-dir-button]")];
    const settingsDirHint = document.querySelector("#settingsDirHint");
    const gridSizeInput = document.querySelector("#gridSize");
    const foodCountInput = document.querySelector("#foodCount");
    const computerDifficultyInput = document.querySelector("#computerDifficulty");
    const initialSpeedInput = document.querySelector("#initialSpeed");
    const gmSettings = document.querySelector("#gmSettings");
    const initialLengthInput = document.querySelector("#initialLength");
    const initialEnergyInput = document.querySelector("#initialEnergy");
    const initialBombsInput = document.querySelector("#initialBombs");
    const initialStockInputs = [...document.querySelectorAll("[data-initial-stock]")];
    const playerCharacterInput = document.querySelector("#playerCharacter");
    const computerCharacterInput = document.querySelector("#computerCharacter");
    const keybindInputs = [...document.querySelectorAll("[id$='AttackKey'], #pauseKey, #surrenderKey, [data-keybind-dir]")];
    const controlProfileNameInput = document.querySelector("#controlProfileName");
    const controlProfileSelect = document.querySelector("#controlProfileSelect");
    const controlProfileSaveButton = document.querySelector("#controlProfileSaveButton");
    const controlProfileApplyButton = document.querySelector("#controlProfileApplyButton");
    const controlProfileDeleteButton = document.querySelector("#controlProfileDeleteButton");
    const controlProfileStatus = document.querySelector("#controlProfileStatus");
    const resetBestTimeButton = document.querySelector("#resetBestTimeButton");
    const resetSettingsButton = document.querySelector("#resetSettingsButton");
    const versionInfoButton = document.querySelector("#versionInfoButton");
    const versionModal = document.querySelector("#versionModal");
    const versionModalClose = document.querySelector("#versionModalClose");
    const versionInfoList = document.querySelector("#versionInfoList");
    const realModeButton = document.querySelector("#realModeButton");
    const midGameModeButton = document.querySelector("#midGameModeButton");
    const ultimateModeButton = document.querySelector("#ultimateModeButton");
    const lateGameModeButton = document.querySelector("#lateGameModeButton");
    const gmPresetButtons = {
      real: realModeButton,
      battle: ultimateModeButton,
      mid: midGameModeButton,
      late: lateGameModeButton
    };
    const networkToggle = document.querySelector("#networkToggle");
    const gmLetter = networkToggle.querySelector(".gm-letter");
    const gmContent = document.querySelector("#gmContent");
    const gmCloseButton = document.querySelector("#gmCloseButton");
    const settingsPageButtons = [...document.querySelectorAll("[data-settings-page-button]")];
    const networkContent = document.querySelector("#networkContent");
    const networkCloseButton = document.querySelector("#networkCloseButton");
    const networkRevealRolesInput = document.querySelector("#networkRevealRolesInput");
    const settingsToggle = document.querySelector("#settingsToggle");
    const settingsContent = document.querySelector("#settingsContent");
    const settingsCloseButton = document.querySelector("#settingsCloseButton");
    const characterStage = document.querySelector("#characterStage");
    const resourceBoard = document.querySelector("#resourceBoard");
    const mobileSheetTabs = document.querySelector("#mobileSheetTabs");
    const mobileSheetTabButtons = [...document.querySelectorAll("[data-mobile-sheet-tab]")];
    const keyEls = [...document.querySelectorAll(".key")];
    const mobileInputQuery = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 900px)");

    document.body.append(settingsContent, gmContent, networkContent);

    const HexSnakeDOM = Object.freeze({
      canvas,
      ctx,
      playArea,
      perfOverlay,
      perfFps,
      perfFrameMs,
      targetModeSmallIndicator,
      targetModeBigIndicator,
      targetModeSmallIcon,
      targetModeBigIcon,
      cooldownSmallIndicator,
      cooldownBigIndicator,
      cooldownSmallValue,
      cooldownBigValue,
      overlay,
      overlayTitle,
      overlayText,
      resultHighlights,
      startButton,
      computerBattleButton,
      skillTrainingButton,
      replayArchiveButton,
      resultSharePanel,
      shareResultStatus,
      settingsReplayButton,
      statsButton,
      replayControls,
      replayReverseButton,
      replayPlayButton,
      replayPrevButton,
      replayNextButton,
      replayTimeline,
      replaySpeedSelect,
      replaySpeedMenu,
      replayExitButton,
      replayTime,
      replayModal,
      replayModalClose,
      replayMessage,
      matchHistoryTabButtons,
      matchHistoryPanels,
      matchHistoryShareEmpty,
      matchHistoryShareContent,
      matchHistorySharePreview,
      matchHistoryShareCopyButton,
      matchHistorySystemShareButton,
      matchHistoryEntryButtons,
      recentReplayList,
      favoriteReplayList,
      recentReplayCount,
      favoriteReplayCount,
      statsModal,
      statsModalClose,
      statsSummary,
      statsRecentCount,
      statsRecentList,
      statsCharacterCount,
      statsCharacterList,
      statsClearButton,
      autoBattlePanel,
      autoBattleSpeedSelect,
      autoSpeedMenu,
      autoPauseButton,
      relayPanel,
      relayModeInput,
      relayScore,
      introCloseButton,
      winnerPortrait,
      portraitLightbox,
      portraitLightboxImage,
      portraitLightboxCaption,
      portraitLightboxClose,
      portraitLightboxShiftButtons,
      portraitLightboxVariantButtons,
      statusEl,
      scoreEl,
      computerScoreEl,
      playerHealthBar,
      computerHealthBar,
      bestEl,
      playerSpeedEl,
      computerSpeedEl,
      totalTimeEl,
      lastFeedTimeEl,
      bestTimeEl,
      stick,
      controlRow,
      smallAttackButton,
      bigAttackButton,
      keyboardSmallAimButton,
      keyboardBigAimButton,
      leftHandModeInput,
      sfxMuteToggle,
      lowPowerModeInput,
      perfStatsToggle,
      surrenderButton,
      joyZone,
      rulesButton,
      rulesModal,
      rulesContent,
      rulesCloseButton,
      hexDirButtons,
      settingsDirButtons,
      settingsDirHint,
      gridSizeInput,
      foodCountInput,
      computerDifficultyInput,
      initialSpeedInput,
      gmSettings,
      initialLengthInput,
      initialEnergyInput,
      initialBombsInput,
      initialStockInputs,
      playerCharacterInput,
      computerCharacterInput,
      keybindInputs,
      controlProfileNameInput,
      controlProfileSelect,
      controlProfileSaveButton,
      controlProfileApplyButton,
      controlProfileDeleteButton,
      controlProfileStatus,
      resetBestTimeButton,
      resetSettingsButton,
      versionInfoButton,
      versionModal,
      versionModalClose,
      versionInfoList,
      realModeButton,
      midGameModeButton,
      ultimateModeButton,
      lateGameModeButton,
      gmPresetButtons,
      networkToggle,
      gmLetter,
      gmContent,
      gmCloseButton,
      settingsPageButtons,
      networkContent,
      networkCloseButton,
      networkRevealRolesInput,
      settingsToggle,
      settingsContent,
      settingsCloseButton,
      characterStage,
      resourceBoard,
      mobileSheetTabs,
      mobileSheetTabButtons,
      keyEls,
      mobileInputQuery
    });

    window.HexSnakeDOM = HexSnakeDOM;

    export {
      HexSnakeDOM,
      HexSnakeDOM as dom
    };
