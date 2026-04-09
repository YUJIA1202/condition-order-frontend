// src/hooks/useMarketData.js
import { useState, useEffect, useRef } from "react";

const WS_URL = "ws://localhost:8000/ws";

export function useMarketData() {
  const [indices,         setIndices]         = useState([]);
  const [triggered,       setTriggered]       = useState([]);
  const [volumeTriggered, setVolumeTriggered] = useState([]);
  const [stockTicks,      setStockTicks]      = useState({});
  const [sectors,         setSectors]         = useState([]);
  const [connected,       setConnected]       = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] 已连接");
        setConnected(true);
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
        ws._heartbeat = heartbeat;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "market") {
            setIndices(data.indices || []);
            setStockTicks(data.stock_ticks || {});
            setSectors(data.sectors || []);

            if (data.triggered?.length > 0) {
              setTriggered(prev => [...data.triggered, ...prev].slice(0, 50));
            }
            if (data.volume_triggered?.length > 0) {
              setVolumeTriggered(prev => [...data.volume_triggered, ...prev].slice(0, 50));
            }
          }
        } catch (e) {
          console.error("[WS] 解析失败", e);
        }
      };

      ws.onclose = () => {
        console.log("[WS] 断开，3秒后重连");
        setConnected(false);
        clearInterval(ws._heartbeat);
        setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.error("[WS] 错误", e);
        ws.close();
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { indices, triggered, volumeTriggered, stockTicks, sectors, connected };
}