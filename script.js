"use strict";

const DIFFICULTIES = {
  beginner: { label: "초급", rows: 9, columns: 9, mines: 10 },
  intermediate: { label: "중급", rows: 16, columns: 16, mines: 40 },
  expert: { label: "고급", rows: 16, columns: 30, mines: 99 },
};
const MARKS = ["", "flag", "question"];
const MARK_SYMBOLS = {
  "": "",
  flag: "🚩",
  question: "?",
};

const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const statusElement = document.querySelector("#game-status");
const restartButton = document.querySelector("#restart");
const faceElement = document.querySelector("#face");
const difficultyElement = document.querySelector("#difficulty");
const soundToggleButton = document.querySelector("#sound-toggle");

let cells = [];
let difficulty = DIFFICULTIES[difficultyElement.value];
let flags = 0;
let revealed = 0;
let started = false;
let finished = false;
let seconds = 0;
let timerId = null;
let audioContext = null;
let soundEnabled = true;

function formatCounter(value) {
  if (value < 0) return `-${String(Math.abs(value)).padStart(2, "0")}`;
  return String(value).padStart(3, "0");
}

function updateCounters() {
  mineCountElement.textContent = formatCounter(difficulty.mines - flags);
  timerElement.textContent = formatCounter(Math.min(seconds, 999));
}

function playSound(kind) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!soundEnabled || !AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  const sounds = {
    click: [{ frequency: 520, duration: 0.045, delay: 0 }],
    explosion: [
      { frequency: 180, duration: 0.16, delay: 0 },
      { frequency: 90, duration: 0.24, delay: 0.09 },
    ],
    victory: [
      { frequency: 523, duration: 0.12, delay: 0 },
      { frequency: 659, duration: 0.12, delay: 0.12 },
      { frequency: 784, duration: 0.22, delay: 0.24 },
    ],
  };

  sounds[kind].forEach(({ frequency, duration, delay }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startTime = audioContext.currentTime + delay;
    oscillator.type = kind === "explosion" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
}

function getNeighbors(row, column) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;

      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 &&
        neighborRow < difficulty.rows &&
        neighborColumn >= 0 &&
        neighborColumn < difficulty.columns
      ) {
        neighbors.push(cells[neighborRow][neighborColumn]);
      }
    }
  }
  return neighbors;
}

function placeMines(safeCell) {
  const safeCells = [safeCell, ...getNeighbors(safeCell.row, safeCell.column)];
  const safeCellSet = new Set(safeCells);
  const candidates = cells.flat().filter((cell) => !safeCellSet.has(cell));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[index],
    ];
  }

  candidates.slice(0, difficulty.mines).forEach((cell) => {
    cell.mine = true;
  });

  cells.flat().forEach((cell) => {
    if (!cell.mine) {
      cell.adjacentMines = getNeighbors(cell.row, cell.column).filter(
        (neighbor) => neighbor.mine,
      ).length;
    }
  });
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    seconds += 1;
    updateCounters();
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function updateCellLabel(cell) {
  let description = `행 ${cell.row + 1}, 열 ${cell.column + 1}`;
  if (cell.mark === "flag") {
    description += ", 깃발 표시";
  } else if (cell.mark === "question") {
    description += ", 물음표 표시";
  } else if (cell.revealed && cell.mine) {
    description += ", 지뢰";
  } else if (cell.revealed && cell.adjacentMines > 0) {
    description += `, 주변 지뢰 ${cell.adjacentMines}개`;
  } else if (cell.revealed) {
    description += ", 빈 칸";
  } else {
    description += ", 닫힌 칸";
  }
  cell.element.setAttribute("aria-label", description);
}

function revealCell(cell) {
  if (finished || cell.mark === "flag") return;

  if (cell.revealed) {
    chordCell(cell);
    return;
  }

  if (cell.mark === "question") {
    cell.mark = "";
    cell.element.textContent = "";
    cell.element.classList.remove("cell--questioned");
    updateCellLabel(cell);
  }

  if (!started) {
    placeMines(cell);
    started = true;
    statusElement.textContent = "게임이 시작되었습니다. 조심히 살펴보세요!";
    startTimer();
  }

  cell.revealed = true;
  revealed += 1;
  cell.element.classList.add("cell--revealed");

  if (cell.mine) {
    cell.element.textContent = "💣";
    cell.element.classList.add("cell--mine", "cell--exploded");
    updateCellLabel(cell);
    endGame(false);
    return;
  }

  if (cell.adjacentMines > 0) {
    cell.element.textContent = String(cell.adjacentMines);
    cell.element.classList.add(`number-${cell.adjacentMines}`);
    updateCellLabel(cell);
  } else {
    updateCellLabel(cell);
    getNeighbors(cell.row, cell.column).forEach((neighbor) => {
      revealCell(neighbor);
    });
  }

  if (revealed === difficulty.rows * difficulty.columns - difficulty.mines) {
    endGame(true);
  }
}

function chordCell(cell) {
  if (cell.adjacentMines === 0) return;

  const neighbors = getNeighbors(cell.row, cell.column);
  const flaggedNeighbors = neighbors.filter(
    (neighbor) => neighbor.mark === "flag",
  ).length;
  if (flaggedNeighbors !== cell.adjacentMines) return;

  neighbors
    .filter((neighbor) => !neighbor.revealed && neighbor.mark !== "flag")
    .forEach((neighbor) => revealCell(neighbor));
}

function toggleMark(cell) {
  if (finished || cell.revealed) return;

  const previousMark = cell.mark;
  cell.mark = MARKS[(MARKS.indexOf(cell.mark) + 1) % MARKS.length];
  if (previousMark === "flag") flags -= 1;
  if (cell.mark === "flag") flags += 1;

  cell.element.textContent = MARK_SYMBOLS[cell.mark];
  cell.element.classList.toggle("cell--flagged", cell.mark === "flag");
  cell.element.classList.toggle("cell--questioned", cell.mark === "question");
  updateCellLabel(cell);
  updateCounters();
  playSound("click");
}

function endGame(won) {
  finished = true;
  stopTimer();
  boardElement.classList.toggle("board--won", won);
  playSound(won ? "victory" : "explosion");
  faceElement.textContent = won ? "😎" : "😵";
  statusElement.textContent = won
    ? "축하합니다! 모든 안전한 칸을 열었습니다."
    : "지뢰를 밟았습니다. 새 게임으로 다시 도전해보세요!";

  if (!won) {
    cells.flat().forEach((cell) => {
      if (cell.mine && cell.mark !== "flag") {
        cell.element.textContent = "💣";
        cell.element.classList.add("cell--revealed", "cell--mine");
        updateCellLabel({ ...cell, mark: "", revealed: true });
      } else if (cell.mark === "flag" && !cell.mine) {
        cell.element.textContent = "❌";
        cell.element.classList.add("cell--wrong");
      }
    });
  }
}

function createBoard() {
  boardElement.replaceChildren();
  boardElement.classList.remove("board--won");
  boardElement.style.setProperty("--columns", difficulty.columns);
  boardElement.setAttribute(
    "aria-label",
    `${difficulty.columns}열 ${difficulty.rows}행 지뢰찾기 게임판`,
  );
  cells = Array.from({ length: difficulty.rows }, (_, row) =>
    Array.from({ length: difficulty.columns }, (_, column) => {
      const cell = {
        row,
        column,
        mine: false,
        mark: "",
        revealed: false,
        adjacentMines: 0,
        element: document.createElement("button"),
      };

      cell.element.type = "button";
      cell.element.className = "cell";
      updateCellLabel(cell);
      let suppressClick = false;
      cell.element.addEventListener("click", () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (!finished && cell.mark !== "flag") playSound("click");
        revealCell(cell);
      });
      cell.element.addEventListener("dblclick", (event) => {
        event.preventDefault();
        chordCell(cell);
      });
      cell.element.addEventListener("mousedown", (event) => {
        if (event.buttons === 3) {
          event.preventDefault();
          suppressClick = true;
          chordCell(cell);
          playSound("click");
          window.setTimeout(() => {
            suppressClick = false;
          }, 0);
        }
      });
      cell.element.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleMark(cell);
      });
      boardElement.append(cell.element);
      return cell;
    }),
  );
}

function resetGame() {
  stopTimer();
  flags = 0;
  revealed = 0;
  started = false;
  finished = false;
  seconds = 0;
  faceElement.textContent = "🙂";
  statusElement.textContent = "칸을 열어 게임을 시작하세요.";
  updateCounters();
  createBoard();
}

function changeDifficulty() {
  difficulty = DIFFICULTIES[difficultyElement.value];
  resetGame();
  statusElement.textContent = `${difficulty.label} 난이도로 새 게임을 시작합니다.`;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggleButton.textContent = soundEnabled ? "🔊" : "🔇";
  soundToggleButton.setAttribute("aria-pressed", String(soundEnabled));
  soundToggleButton.setAttribute(
    "aria-label",
    soundEnabled ? "효과음 끄기" : "효과음 켜기",
  );
}

restartButton.addEventListener("click", resetGame);
difficultyElement.addEventListener("change", changeDifficulty);
soundToggleButton.addEventListener("click", toggleSound);
resetGame();
