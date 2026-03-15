import * as CookieConsent from "vanilla-cookieconsent";

const CONSENT_INIT_FLAG = "__palazzo_cookie_consent_initialized";

export const initCookieConsent = () => {
  if (typeof window === "undefined") return;

  const windowWithFlag = window as unknown as Window & {
    [key: string]: unknown;
  };
  if (windowWithFlag[CONSENT_INIT_FLAG]) return;

  CookieConsent.run({
    revision: 1,
    autoShow: true,
    disablePageInteraction: false,
    guiOptions: {
      consentModal: {
        layout: "box inline",
        position: "bottom center",
        equalWeightButtons: false,
        flipButtons: false,
      },
      preferencesModal: {
        layout: "box",
        position: "right",
        equalWeightButtons: false,
        flipButtons: false,
      },
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      analytics: {
        enabled: false,
      },
      marketing: {
        enabled: false,
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "We use cookies",
            description:
              "We use cookies to improve your experience, remember preferences, and understand site usage. You can accept all cookies or manage your choices.",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject optional",
            showPreferencesBtn: "Cookie settings",
            footer:
              '<a href="' +
              "/privacy-cookie-policy" +
              '">Privacy and cookie policy</a>',
          },
          preferencesModal: {
            title: "Cookie preferences",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject optional",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close",
            sections: [
              {
                title: "Your privacy choices",
                description:
                  "Manage which cookies can be used. Necessary cookies are always enabled because they are required for site functionality.",
              },
              {
                title: "Strictly necessary cookies",
                linkedCategory: "necessary",
                cookieTable: {
                  headers: {
                    name: "Name",
                    domain: "Domain",
                    description: "Description",
                    expiration: "Expiration",
                  },
                  body: [
                    {
                      name: "sessionStorage",
                      domain: window.location.hostname,
                      description:
                        "Stores temporary booking and authentication state required by the app.",
                      expiration: "Session",
                    },
                  ],
                },
              },
              {
                title: "Analytics cookies",
                linkedCategory: "analytics",
                description:
                  "Help us understand usage and improve performance. Disabled by default.",
              },
              {
                title: "Marketing cookies",
                linkedCategory: "marketing",
                description:
                  "Used for marketing and social media features. Disabled by default.",
              },
            ],
          },
        },
      },
    },
  });

  windowWithFlag[CONSENT_INIT_FLAG] = true;
};
