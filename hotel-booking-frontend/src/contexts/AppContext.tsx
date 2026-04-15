import React, { useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { useQuery } from "react-query";
import * as apiClient from "../api-client";
import { useToast } from "../hooks/use-toast";

type ToastMessage = {
  title: string;
  description?: string;
  type: "SUCCESS" | "ERROR" | "INFO";
};

export type AppContext = {
  showToast: (toastMessage: ToastMessage) => void;
  isLoggedIn: boolean;
  userRole: "user" | "hotel_owner" | "admin" | null;
  isOwnerOrAdmin: boolean;
  showGlobalLoading: (message?: string) => void;
  hideGlobalLoading: () => void;
  isGlobalLoading: boolean;
  globalLoadingMessage: string;
};

export const AppContext = React.createContext<AppContext | undefined>(
  undefined
);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState(
    "Hotel room is getting ready..."
  );
  const { toast } = useToast();

  const { isError, isLoading, data } = useQuery(
    "validateToken",
    apiClient.validateToken,
    {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      enabled: true,
    }
  );

  const authData = data as
    | { role?: "user" | "hotel_owner" | "admin" }
    | null
    | undefined;

  const storedSessionToken =
    typeof window !== "undefined" ? localStorage.getItem("session_id") : null;
  const storedRoleValue =
    typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  const storedRole =
    storedRoleValue === "user" ||
    storedRoleValue === "hotel_owner" ||
    storedRoleValue === "admin"
      ? storedRoleValue
      : null;

  const finalIsLoggedIn = !isLoading && !!authData && !isError;
  const resolvedRole = authData?.role ?? null;

  // Keep the last known auth state during token validation so protected routes
  // do not immediately redirect on refresh or direct entry.
  const isRestoringSession = isLoading && !!storedSessionToken;

  const isLoggedIn = finalIsLoggedIn || isRestoringSession;
  const userRole = finalIsLoggedIn
    ? resolvedRole || "user"
    : isRestoringSession
    ? storedRole
    : null;
  const isOwnerOrAdmin =
    userRole === "hotel_owner" || userRole === "admin";

  const showToast = (toastMessage: ToastMessage) => {
    const variant =
      toastMessage.type === "SUCCESS"
        ? "success"
        : toastMessage.type === "ERROR"
        ? "destructive"
        : "info";

    toast({
      variant,
      title: toastMessage.title,
      description: toastMessage.description,
    });
  };

  const showGlobalLoading = (message?: string) => {
    if (message) {
      setGlobalLoadingMessage(message);
    }
    setIsGlobalLoading(true);
  };

  const hideGlobalLoading = () => {
    setIsGlobalLoading(false);
  };

  return (
    <AppContext.Provider
      value={{
        showToast,
        isLoggedIn,
        userRole,
        isOwnerOrAdmin,
        showGlobalLoading,
        hideGlobalLoading,
        isGlobalLoading,
        globalLoadingMessage,
      }}
    >
      {isGlobalLoading && <LoadingSpinner message={globalLoadingMessage} />}
      {children}
    </AppContext.Provider>
  );
};

// ...existing code...
