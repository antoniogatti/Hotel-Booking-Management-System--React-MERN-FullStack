import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "react-query";
import * as apiClient from "../api-client";
import useAppContext from "../hooks/useAppContext";
import { Loader2 } from "lucide-react";

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const normalizeCallbackToken = (rawToken: string | null) => {
  if (!rawToken) {
    return null;
  }

  let token = rawToken.trim();

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  // Some callback URLs may carry a percent-encoded token; decode a couple of times
  // to handle accidental double-encoding during redirects.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!/%[0-9a-f]{2}/i.test(token)) {
      break;
    }

    try {
      token = decodeURIComponent(token);
    } catch {
      break;
    }
  }

  return token || null;
};

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useAppContext();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;

    const error = searchParams.get("error");
    const provider = searchParams.get("provider");
    const token = normalizeCallbackToken(searchParams.get("token"));

    void (async () => {
      if (error) {
        apiClient.persistSessionToken(null);
        showToast({
          title: "Sign-in failed",
          description:
            error === "oauth_config"
              ? "Social sign-in is not configured."
              : error === "token_exchange"
              ? "Could not complete social sign-in."
              : error === "oauth_state"
              ? "The sign-in session could not be verified. Please try again."
              : "Something went wrong. Please try again.",
          type: "ERROR",
        });
        navigate("/sign-in");
        return;
      }

      try {
        apiClient.persistSessionToken(token);

        let result: Awaited<ReturnType<typeof apiClient.validateToken>> = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          result = await apiClient.validateToken();
          if (result) {
            break;
          }

          await wait(250);
        }

        if (!result) {
          throw new Error("session_missing");
        }

        await queryClient.invalidateQueries("validateToken");

        showToast({
          title: "Signed in successfully",
          description: `Welcome! You have been signed in with ${provider === "microsoft" ? "Microsoft" : "your provider"}.`,
          type: "SUCCESS",
        });
        navigate("/");
      } catch {
        apiClient.persistSessionToken(null);
        showToast({
          title: "Sign-in failed",
          description: "Your session could not be established. Please try again.",
          type: "ERROR",
        });
        navigate("/sign-in");
      }
    })();
  }, [searchParams, navigate, queryClient, showToast]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        <p className="text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
