import { useState, useEffect, useCallback, useRef } from "react";
import logger from "@/utils/logger";
import { WebSocketMessage } from "@/types/chat";

interface UseWebSocketOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  autoReconnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onOpen,
    onClose,
    onError,
    onMessage,
    autoReconnect = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reconnectCount = useRef(0);
  const messageQueue = useRef<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      // Use provided URL or default to current host with secure WebSocket
      const wsUrl = url || `wss://${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = (event) => {
        logger.info("WebSocket connected");
        setConnected(true);
        setReconnecting(false);
        reconnectCount.current = 0;
        setError(null);

        // Process any queued messages
        if (messageQueue.current.length > 0) {
          logger.info(
            `Processing ${messageQueue.current.length} queued messages`,
          );
          messageQueue.current.forEach((msg) => {
            ws.send(JSON.stringify(msg));
          });
          messageQueue.current = [];
        }

        if (onOpen) onOpen(event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(data);
          if (onMessage) onMessage(data);
        } catch (error) {
          logger.error("Error parsing WebSocket message:", error);
          setError(new Error("Failed to parse WebSocket message"));
        }
      };

      ws.onclose = (event) => {
        logger.info(`WebSocket disconnected: ${event.code} ${event.reason}`);
        setConnected(false);

        if (onClose) onClose(event);

        // Attempt to reconnect if not closed cleanly and auto reconnect is enabled
        if (autoReconnect && event.code !== 1000 && event.code !== 1001) {
          handleReconnect();
        }
      };

      ws.onerror = (event) => {
        logger.error("WebSocket error:", event);
        setConnected(false);
        setError(new Error("WebSocket connection error"));

        if (onError) onError(event);
      };

      setSocket(ws);
      return ws;
    } catch (error) {
      logger.error("Error creating WebSocket:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, [url, onOpen, onClose, onError, onMessage, autoReconnect]);

  const handleReconnect = useCallback(() => {
    if (reconnectCount.current >= reconnectAttempts) {
      logger.error(
        `Maximum reconnection attempts (${reconnectAttempts}) reached`,
      );
      setReconnecting(false);
      setError(
        new Error(`Failed to reconnect after ${reconnectAttempts} attempts`),
      );
      return;
    }

    setReconnecting(true);
    reconnectCount.current += 1;

    logger.info(
      `Attempting to reconnect (${reconnectCount.current}/${reconnectAttempts})...`,
    );

    setTimeout(() => {
      connectWebSocket();
    }, reconnectInterval);
  }, [connectWebSocket, reconnectAttempts, reconnectInterval]);

  // Initialize connection on mount
  useEffect(() => {
    const ws = connectWebSocket();

    // Clean up on unmount
    return () => {
      if (ws) {
        ws.close(1000, "Component unmounted");
      }
    };
  }, [connectWebSocket]);

  // Send message function with queue support
  const sendMessage = useCallback(
    (message: WebSocketMessage): boolean => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(message));
          return true;
        } catch (error) {
          logger.error("Error sending WebSocket message:", error);
          setError(new Error("Failed to send message"));
          return false;
        }
      } else {
        // Queue message if socket is not ready
        logger.info("Socket not ready, queueing message");
        messageQueue.current.push(message);

        // If socket is closed and not reconnecting, attempt to reconnect
        if (
          socket?.readyState === WebSocket.CLOSED &&
          !reconnecting &&
          autoReconnect
        ) {
          handleReconnect();
        }
        return false;
      }
    },
    [socket, reconnecting, autoReconnect, handleReconnect],
  );

  return {
    connected,
    reconnecting,
    lastMessage,
    sendMessage,
    error,
    connect: connectWebSocket,
    disconnect: useCallback(() => {
      if (socket) {
        socket.close(1000, "User initiated disconnect");
      }
    }, [socket]),
  };
}
