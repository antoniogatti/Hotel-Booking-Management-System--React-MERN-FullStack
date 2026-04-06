import React, { useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { useQuery } from "react-query";
import * as apiClient from "../api-client";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { useToast } from "../hooks/use-toast";

const STRIPE_PUB_KEY = import.meta.env.VITE_STRIPE_PUB_KEY || "";

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
  stripePromise: Promise<Stripe | null>;
  showGlobalLoading: (message?: string) => void;
  hideGlobalLoading: () => void;
  isGlobalLoading: boolean;
  globalLoadingMessage: string;
};

export const AppContext = React.createContext<AppContext | undefined>(
  undefined
);

const stripePromise = STRIPE_PUB_KEY
  ? loadStripe(STRIPE_PUB_KEY)
  : Promise.resolve(null);

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

  const checkStoredAuth = () => {
    const localToken = localStorage.getItem("session_id");
    const userId = localStorage.getItem("user_id");

    return !!localToken && !!userId;
  };

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

  const hasStoredAuth = checkStoredAuth();
  const finalIsLoggedIn = (!isLoading && !!data) || (hasStoredAuth && isError);

  const resolvedRole =
    (data as { role?: "user" | "hotel_owner" | "admin" } | undefined)
      ?.role ||
    (localStorage.getItem("user_role") as
      | "user"
      | "hotel_owner"
      | "admin"
      | null);

  const userRole = finalIsLoggedIn ? resolvedRole || "user" : null;
  const isOwnerOrAdmin =
    userRole === "hotel_owner" || userRole === "admin";

  if (userRole) {
    localStorage.setItem("user_role", userRole);
  }

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
        isLoggedIn: finalIsLoggedIn,
        userRole,
        isOwnerOrAdmin,
        stripePromise,
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
