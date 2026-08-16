import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "react-query";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import * as apiClient from "../api-client";
import { useToast } from "../hooks/use-toast";

type GuestFormState = {
  givenName: string;
  familyName: string;
  documentType: "id_card" | "passport";
  documentNumber: string;
  breakfastChoice: "Savoury" | "Sweet";
  file: File | null;
};

const emptyGuest = (): GuestFormState => ({
  givenName: "",
  familyName: "",
  documentType: "id_card",
  documentNumber: "",
  breakfastChoice: "Savoury",
  file: null,
});

const SelfCheckin = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";
  const lockerParamRaw = searchParams.get("l") || "";
  const lockerNumber = /^\d{1,2}$/.test(lockerParamRaw.trim()) ? lockerParamRaw.trim() : "";
  const breakfastIncluded = searchParams.get("b")?.toLowerCase() !== "false";

  const [fullName, setFullName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [numberOfNights, setNumberOfNights] = useState(1);
  const [breakfastTime, setBreakfastTime] = useState("08:30");
  const [guests, setGuests] = useState<GuestFormState[]>([emptyGuest()]);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [result, setResult] = useState<{ code?: string; instructionVideoUrl?: string } | null>(null);

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const devCaptchaBypass = import.meta.env.VITE_ENABLE_DEV_CAPTCHA === "true";
  const shouldLoadTurnstile = Boolean(turnstileSiteKey) && !devCaptchaBypass;

  useEffect(() => {
    if (!shouldLoadTurnstile || !turnstileSiteKey) {
      setTurnstileToken(null);
      return;
    }

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) {
        return;
      }

      const widgetId = turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(null),
        "expired-callback": () => setTurnstileToken(null),
      });

      turnstileWidgetIdRef.current = String(widgetId);
    };

    const existingScript = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).turnstile) {
        renderWidget();
      } else {
        existingScript.addEventListener("load", renderWidget, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      try {
        const turnstile = (window as any).turnstile;
        if (turnstile && turnstileWidgetIdRef.current) {
          turnstile.remove(turnstileWidgetIdRef.current);
        }
      } catch {
        // no-op cleanup guard
      }

      turnstileWidgetIdRef.current = null;
      if (turnstileContainerRef.current) {
        turnstileContainerRef.current.innerHTML = "";
      }
    };
  }, [shouldLoadTurnstile, turnstileSiteKey]);

  useEffect(() => {
    setGuests((prev) => {
      if (prev.length === guestCount) {
        return prev;
      }

      if (prev.length < guestCount) {
        return [...prev, ...Array.from({ length: guestCount - prev.length }, () => emptyGuest())];
      }

      return prev.slice(0, guestCount);
    });
  }, [guestCount]);

  const canSubmit = useMemo(() => {
    const hasTopLevel =
      fullName.trim() &&
      qParam.trim() &&
      guestCount >= 1 &&
      guestCount <= 4 &&
      numberOfNights > 0 &&
      (!breakfastIncluded || /^\d{2}:\d{2}$/.test(breakfastTime));

    const hasGuests =
      guests.length === guestCount &&
      guests.every(
        (g) =>
          g.givenName.trim() &&
          g.familyName.trim() &&
          g.documentNumber.trim() &&
          g.file &&
          ["id_card", "passport"].includes(g.documentType) &&
          (!breakfastIncluded || ["Savoury", "Sweet"].includes(g.breakfastChoice))
      );

    const hasCaptcha = !shouldLoadTurnstile || !!turnstileToken || devCaptchaBypass;
    return Boolean(hasTopLevel && hasGuests && hasCaptcha);
  }, [
    breakfastTime,
    breakfastIncluded,
    devCaptchaBypass,
    fullName,
    guestCount,
    guests,
    numberOfNights,
    shouldLoadTurnstile,
    turnstileToken,
  ]);

  const mutation = useMutation(apiClient.submitSelfCheckin, {
    onSuccess: (data) => {
      setResult({
        // Business rule: access code must always match URL query param q.
        code: qParam.trim() || data.code,
        instructionVideoUrl:
          data.instructionVideoUrl || import.meta.env.VITE_SELF_CHECKIN_INSTRUCTION_VIDEO_URL,
      });

      if (data.notificationsSent === false) {
        toast({
          title: "Submitted with warning",
          description:
            data.warning || "Self check-in saved, but admin notification email could not be sent.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submitted",
          description: "Self check-in completed successfully.",
        });
      }
    },
    onError: (error) => {
      const apiMessage =
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Please verify the fields and try again.";

      toast({
        title: "Submission failed",
        description: apiMessage,
        variant: "destructive",
      });
    },
  });

  const updateGuest = (index: number, patch: Partial<GuestFormState>) => {
    setGuests((prev) => prev.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)));
  };

  const submit = () => {
    if (!canSubmit || mutation.isLoading) {
      if (!qParam.trim()) {
        toast({
          title: "Missing access code",
          description: "This page requires a valid q parameter in the URL.",
          variant: "destructive",
        });
      }
      return;
    }

    const guestFilesByIndex: Record<number, File | null> = {};
    guests.forEach((guest, index) => {
      guestFilesByIndex[index] = guest.file;
    });

    mutation.mutate({
      queryCode: qParam || undefined,
      breakfastIncluded,
      fullName,
      numberOfNights,
      breakfastTime: breakfastIncluded ? breakfastTime : undefined,
      guests: guests.map((guest) => ({
        givenName: guest.givenName.trim(),
        familyName: guest.familyName.trim(),
        documentType: guest.documentType,
        documentNumber: guest.documentNumber.trim(),
        breakfastChoice: breakfastIncluded ? guest.breakfastChoice : undefined,
      })),
      guestFilesByIndex,
      turnstileToken: turnstileToken || (devCaptchaBypass ? "DEV_BYPASS" : undefined),
    });
  };

  const isBreakfastTimeValid = /^\d{2}:\d{2}$/.test(breakfastTime);
  const isNameValid = Boolean(fullName.trim());
  const isGuestCountValid = guestCount >= 1 && guestCount <= 4;
  const isNightsValid = numberOfNights > 0;

  if (result) {
    return (
      <section className="min-h-screen bg-[#f6f1ea] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#eadccd] bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-serif text-[#2b4463]">Palazzo Pinto B&B</h1>
          <p className="mt-2 text-sm text-slate-600">Self Check-In completed</p>

          {lockerNumber ? (
            <div className="mt-6 rounded-2xl border border-[#2b4463]/15 bg-white px-5 py-4 text-center">
              <p className="text-sm uppercase tracking-[0.12em] text-[#2b4463]/70">Locker number</p>
              <p className="mt-1 text-3xl font-extrabold tracking-[0.08em] text-[#1d3047]">{lockerNumber}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-[#2b4463]/20 bg-[#f8fbff] px-5 py-4 text-center">
            <p className="text-sm uppercase tracking-[0.12em] text-[#2b4463]/70">Your access code</p>
            <p className="mt-2 text-5xl font-extrabold tracking-[0.18em] text-[#1d3047]">
              {result.code || "----"}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-slate-800">Instructions video</p>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <iframe
                title="Self Check-In Instructions"
                src={(result.instructionVideoUrl || "").replace("watch?v=", "embed/")}
                className="h-64 w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="rounded-2xl border border-[#2b4463]/15 bg-[#fffdf9] px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-[#2b4463]">Need help?</p>
              <p className="mt-1">
                Call or WhatsApp: <a className="font-semibold text-[#2b4463] underline" href="tel:+3908311785476">+39 0831 1785476</a>
              </p>
              <p className="mt-1">
                Email: <a className="font-semibold text-[#2b4463] underline" href="mailto:info@palazzopintobnb.com">info@palazzopintobnb.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#f6f1ea] px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#eadccd] bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ea836c]">Palazzo Pinto B&B</p>
        <h1 className="mt-2 text-3xl font-serif text-[#2b4463]">Self Check-In</h1>
        <p className="mt-2 text-sm text-slate-600">
          Please complete all mandatory fields.
          {breakfastIncluded ? " Breakfast is served from 08:30 to 10:00." : " Breakfast not requested for this reservation."}
        </p>
        <p className="mt-1 text-xs font-medium text-[#2b4463]">Fields marked with * are mandatory.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Name on reservation <span className="text-red-600">*</span>
            </label>
            <input
              className={`mt-1 w-full rounded-xl border px-3 py-2.5 ${attemptedSubmit && !isNameValid ? "border-red-500 bg-red-50" : "border-slate-300"}`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {attemptedSubmit && !isNameValid && (
              <p className="mt-1 text-xs text-red-600">Please enter the name on the reservation.</p>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-3 ${breakfastIncluded ? "sm:grid-cols-3" : "sm:grid-cols-2"} sm:items-start`}>
            <div>
              <label className="block min-h-[2.5rem] text-sm font-medium text-slate-700 sm:min-h-[2.75rem]">
                Number of guests <span className="text-red-600">*</span>
              </label>
              <select
                className={`mt-1 w-full rounded-xl border px-3 py-2.5 ${attemptedSubmit && !isGuestCountValid ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
              {attemptedSubmit && !isGuestCountValid && (
                <p className="mt-1 text-xs text-red-600">Number of guests must be between 1 and 4.</p>
              )}
            </div>
            <div>
              <label className="block min-h-[2.5rem] text-sm font-medium text-slate-700 sm:min-h-[2.75rem]">
                Number of nights <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={1}
                className={`mt-1 w-full rounded-xl border px-3 py-2.5 ${attemptedSubmit && !isNightsValid ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                value={numberOfNights}
                onChange={(e) => setNumberOfNights(Number(e.target.value) || 1)}
              />
              {attemptedSubmit && !isNightsValid && (
                <p className="mt-1 text-xs text-red-600">Number of nights must be at least 1.</p>
              )}
            </div>
            {breakfastIncluded && (
              <div>
                <label className="block min-h-[2.5rem] text-sm font-medium text-slate-700 sm:min-h-[2.75rem]">
                  Breakfast time <span className="text-red-600">*</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">08:30 - 10:00</span>
                </label>
                <input
                  type="time"
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 ${attemptedSubmit && !isBreakfastTimeValid ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                  value={breakfastTime}
                  onChange={(e) => setBreakfastTime(e.target.value)}
                />
                {attemptedSubmit && !isBreakfastTimeValid && (
                  <p className="mt-1 text-xs text-red-600">Please select a valid breakfast time.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Guests details</h2>
              <p className="text-xs font-medium text-slate-600">Required guests: {guestCount}</p>
            </div>

            {guests.map((guest, index) => (
              <div key={`guest-${index}`} className="rounded-2xl border border-[#d8e3f5] bg-[#f7fbff] p-3">
                <div className="mb-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d3047]">Guest {index + 1}</p>
                    <p className="text-xs text-slate-600">
                      {breakfastIncluded
                        ? "Identity document, document file and breakfast preference are required."
                        : "Identity document and document file are required."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Given name <span className="text-red-600">*</span>
                    </label>
                    <input
                      placeholder="Given name"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 ${attemptedSubmit && !guest.givenName.trim() ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                      value={guest.givenName}
                      onChange={(e) => updateGuest(index, { givenName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Family name <span className="text-red-600">*</span>
                    </label>
                    <input
                      placeholder="Family name"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 ${attemptedSubmit && !guest.familyName.trim() ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                      value={guest.familyName}
                      onChange={(e) => updateGuest(index, { familyName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Document type <span className="text-red-600">*</span>
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                      value={guest.documentType}
                      onChange={(e) => updateGuest(index, { documentType: e.target.value as "id_card" | "passport" })}
                    >
                      <option value="id_card">ID card</option>
                      <option value="passport">Passport</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Document number <span className="text-red-600">*</span>
                    </label>
                    <input
                      placeholder="Document number"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 ${attemptedSubmit && !guest.documentNumber.trim() ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                      value={guest.documentNumber}
                      onChange={(e) => updateGuest(index, { documentNumber: e.target.value })}
                    />
                  </div>
                  {breakfastIncluded && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Breakfast preference <span className="text-red-600">*</span>
                      </label>
                      <select
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                        value={guest.breakfastChoice}
                        onChange={(e) => updateGuest(index, { breakfastChoice: e.target.value as "Savoury" | "Sweet" })}
                      >
                        <option value="Savoury">Savoury</option>
                        <option value="Sweet">Sweet</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Document photo/PDF <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 ${attemptedSubmit && !guest.file ? "border-red-500 bg-red-50" : "border-slate-300"}`}
                      onChange={(e) => updateGuest(index, { file: e.target.files?.[0] || null })}
                    />
                  </div>
                </div>
                {attemptedSubmit &&
                  (!guest.givenName.trim() ||
                    !guest.familyName.trim() ||
                    !guest.documentNumber.trim() ||
                    !guest.file ||
                    (breakfastIncluded && !guest.breakfastChoice)) && (
                    <p className="mt-3 text-xs text-red-600">
                      Please complete all mandatory guest fields marked with *.
                    </p>
                  )}
              </div>
            ))}
          </div>

          {shouldLoadTurnstile && (
            <div className="rounded-xl border border-slate-200 p-3">
              <div ref={turnstileContainerRef} />
            </div>
          )}

          <button
            type="button"
            className="w-full rounded-2xl bg-[#2b4463] px-4 py-3 text-white disabled:opacity-50"
            disabled={!canSubmit || mutation.isLoading}
            onClick={() => {
              setAttemptedSubmit(true);
              submit();
            }}
          >
            {mutation.isLoading ? "Submitting..." : "Submit self check-in"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default SelfCheckin;
