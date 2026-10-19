"use strict";

const ROWS = 9;
const COLUMNS = 9;
const MINE_TOTAL = 10;
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

let cells = [];
let flags = 0;
let revealed = 0;
let started = false;
let finished = false;
let seconds = 0;
let timerId = null;

function formatCounter(value) {
  if (value < 0) return `-${String(Math.abs(value)).padStart(2, "0")}`;
  return String(value).padStart(3, "0");
}

function updateCounters() {
  mineCountElement.textContent = formatCounter(MINE_TOTAL - flags);
  timerElement.textContent = formatCounter(Math.min(seconds, 999));
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
        neighborRow < ROWS &&
        neighborColumn >= 0 &&
        neighborColumn < COLUMNS
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

  candidates.slice(0, MINE_TOTAL).forEach((cell) => {
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
  if (finished || cell.revealed || cell.mark !== "") return;

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

  if (revealed === ROWS * COLUMNS - MINE_TOTAL) {
    endGame(true);
  }
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
}

function endGame(won) {
  finished = true;
  stopTimer();
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
  cells = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, column) => {
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
      cell.element.addEventListener("click", () => revealCell(cell));
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

restartButton.addEventListener("click", resetGame);
resetGame();
