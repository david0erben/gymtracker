/* Interaktive Canvas-Liniendiagramme mit Maus-/Touch-Tooltips. */

import { formatDate, formatNumber, formatShortDate } from "./utils.js";

const chartStates = {};

export function drawLineChart(canvasId, points, unit, valueLabel) {
  const canvas = document.getElementById(canvasId);
  const previous = chartStates[canvasId] || {
    activeIndex: null,
    touchPinned: false
  };
  const dataKey = points.map(point => `${point.label}:${point.value}`).join("|");
  chartStates[canvasId] = {
    ...previous,
    canvas,
    points,
    unit,
    valueLabel,
    dataKey,
    activeIndex: previous.dataKey === dataKey ? previous.activeIndex : null,
    touchPinned: previous.dataKey === dataKey ? previous.touchPinned : false
  };
  setupChartInteractions(canvas);
  paintLineChart(canvasId);
}

function paintLineChart(canvasId) {
  const state = chartStates[canvasId];
  if (!state) return;
  const { canvas, points, unit } = state;
  const parent = canvas.parentElement;
  const width = Math.max(parent.clientWidth, 280);
  const height = Math.max(parent.clientHeight, 200);
  const dpr = window.devicePixelRatio || 1;
  const bitmapWidth = Math.round(width * dpr);
  const bitmapHeight = Math.round(height * dpr);
  if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
  if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  state.width = width;
  state.height = height;
  state.hitPoints = [];

  if (!points.length) {
    state.activeIndex = null;
    ctx.fillStyle = "#667269";
    ctx.font = "14px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Noch keine Daten vorhanden.", width / 2, height / 2);
    updateChartTooltip(state);
    return;
  }

  const margin = { top: 18, right: 16, bottom: 38, left: 52 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const values = points.map(point => Number(point.value) || 0);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const spread = max - min || Math.max(max * 0.1, 1);
  min = Math.max(0, min - spread * 0.18);
  max += spread * 0.18;

  const xFor = index => points.length === 1
    ? margin.left + chartWidth / 2
    : margin.left + (index / (points.length - 1)) * chartWidth;
  const yFor = value =>
    margin.top + (1 - (value - min) / (max - min)) * chartHeight;

  state.hitPoints = points.map((point, index) => ({
    x: xFor(index),
    y: yFor(point.value),
    data: point
  }));

  ctx.strokeStyle = "#dce4dd";
  ctx.fillStyle = "#667269";
  ctx.lineWidth = 1;
  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index <= 4; index += 1) {
    const y = margin.top + (index / 4) * chartHeight;
    const value = max - (index / 4) * (max - min);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillText(`${formatNumber(value)} ${unit}`, margin.left - 8, y);
  }

  const gradient = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom);
  gradient.addColorStop(0, "rgba(33, 110, 72, 0.22)");
  gradient.addColorStop(1, "rgba(33, 110, 72, 0.01)");
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xFor(points.length - 1), height - margin.bottom);
  ctx.lineTo(xFor(0), height - margin.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#216e48";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  state.hitPoints.forEach((point, index) => {
    const active = index === state.activeIndex;
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#e1f1e7" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#216e48";
    ctx.lineWidth = active ? 3 : 2;
    ctx.stroke();
  });

  const labelIndexes = [...new Set([
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1
  ])];
  ctx.fillStyle = "#667269";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  labelIndexes.forEach(index => {
    ctx.fillText(formatShortDate(points[index].label), xFor(index), height - margin.bottom + 11);
  });
  updateChartTooltip(state);
}

function setupChartInteractions(canvas) {
  if (canvas.dataset.interactiveChart === "true") return;
  canvas.dataset.interactiveChart = "true";
  canvas.addEventListener("pointermove", event => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    activateNearestChartPoint(canvas.id, event, false);
  });
  canvas.addEventListener("pointerdown", event => {
    activateNearestChartPoint(canvas.id, event, event.pointerType !== "mouse");
  });
  canvas.addEventListener("pointerleave", event => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const state = chartStates[canvas.id];
    if (!state) return;
    state.activeIndex = null;
    state.touchPinned = false;
    paintLineChart(canvas.id);
  });
}

function activateNearestChartPoint(canvasId, event, pinForTouch) {
  const state = chartStates[canvasId];
  if (!state || !state.hitPoints.length) return;
  const rect = state.canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (state.width / rect.width);
  const y = (event.clientY - rect.top) * (state.height / rect.height);
  const threshold = pinForTouch ? 58 : 42;
  let nearestIndex = null;
  let nearestDistance = Infinity;
  state.hitPoints.forEach((point, index) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  if (nearestDistance > threshold) nearestIndex = null;
  if (state.activeIndex === nearestIndex && state.touchPinned === pinForTouch) return;
  state.activeIndex = nearestIndex;
  state.touchPinned = pinForTouch && nearestIndex !== null;
  paintLineChart(canvasId);
}

function updateChartTooltip(state) {
  let tooltip = state.canvas.parentElement.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    state.canvas.parentElement.append(tooltip);
  }
  const point = state.hitPoints && state.hitPoints[state.activeIndex];
  if (!point) {
    tooltip.hidden = true;
    return;
  }

  const date = document.createElement("span");
  date.textContent = formatDate(point.data.label);
  const value = document.createElement("strong");
  value.textContent = `${state.valueLabel}: ${formatNumber(point.data.value)} ${state.unit}`;
  tooltip.replaceChildren(date, value);
  tooltip.hidden = false;

  const maxLeft = state.width - tooltip.offsetWidth - 6;
  const left = Math.max(6, Math.min(point.x + 11, maxLeft));
  let top = point.y - tooltip.offsetHeight - 11;
  if (top < 5) top = point.y + 11;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function clearTouchChartTooltips(event) {
  if (event.pointerType === "mouse" || event.target.closest(".chart-wrap")) return;
  Object.entries(chartStates).forEach(([canvasId, state]) => {
    if (!state.touchPinned) return;
    state.activeIndex = null;
    state.touchPinned = false;
    paintLineChart(canvasId);
  });
}
