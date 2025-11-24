// src/components/WebSocketProvider.tsx
import React, { useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const { isConnected } = useWebSocket();
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      {children}

      {/* Connection Status Indicator */}
      {isAuthenticated && (
        <div className="fixed bottom-4 right-4 z-50">
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className="flex items-center gap-1 px-2 py-1 text-xs"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Offline
              </>
            )}
          </Badge>
        </div>
      )}
    </>
  );
};
