// src/api/index.js
// 所有跟后端的 HTTP 请求封装在这里

import axios from "axios";

const BASE = "http://localhost:8000";

// ─── 持仓 ─────────────────────────────────────────────────────────
export const getPositions = () =>
  axios.get(`${BASE}/positions`).then(r => r.data);

// ─── 手动下单 ─────────────────────────────────────────────────────
export const placeOrder = (code, action, qty) =>
  axios.post(`${BASE}/order`, { code, action, qty }).then(r => r.data);

// ─── 条件单 ───────────────────────────────────────────────────────
export const getConditions = () =>
  axios.get(`${BASE}/conditions`).then(r => r.data);

export const addCondition = (body) =>
  axios.post(`${BASE}/conditions`, body).then(r => r.data);

export const deleteCondition = (cid) =>
  axios.delete(`${BASE}/conditions/${cid}`).then(r => r.data);
export const getKline = (code, period = "1d", count = 60) =>
  axios.get(`${BASE}/kline/${code}`, { params: { period, count } }).then(r => r.data);