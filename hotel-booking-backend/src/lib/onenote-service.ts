const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TRANSIENT_GRAPH_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_GRAPH_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

type GraphCollectionResponse<TItem> = {
  value?: TItem[];
  "@odata.nextLink"?: string;
};

type OneNoteParentSection = {
  id: string;
  displayName?: string;
};

export type OneNoteNotebook = {
  id: string;
  displayName?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  isDefault?: boolean;
  links?: Record<string, unknown>;
  sectionsUrl?: string;
  sectionGroupsUrl?: string;
};

export type OneNoteSection = {
  id: string;
  displayName?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  pagesUrl?: string;
};

export type OneNotePage = {
  id: string;
  title?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  contentUrl?: string;
  parentSection?: OneNoteParentSection;
};

const wait = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getRetryDelayMs = (response: Response | null, attempt: number) => {
  const retryAfterHeader = response?.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  return BASE_RETRY_DELAY_MS * Math.max(1, attempt + 1);
};

const buildGraphRequestError = (
  fallbackMessage: string,
  url: string,
  response: Response | null,
  responseBody: string | null,
  graphMessage?: string
) => {
  const status = response ? `${response.status} ${response.statusText}`.trim() : "no response";
  const details = graphMessage || responseBody || fallbackMessage;
  return new Error(`Microsoft Graph request failed (${status}) for ${url}: ${details}`);
};

const graphGetCollectionAll = async <TItem>(accessToken: string, pathOrUrl: string) => {
  const items: TItem[] = [];
  let nextUrl: string | null = pathOrUrl;

  while (nextUrl) {
    const payload = await graphGetJson<GraphCollectionResponse<TItem>>(accessToken, nextUrl);
    items.push(...(payload.value || []));
    nextUrl = payload["@odata.nextLink"] || null;
  }

  return items;
};

const graphGetJson = async <TResponse>(accessToken: string, pathOrUrl: string) => {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`;
  for (let attempt = 0; attempt <= MAX_GRAPH_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const responseBody = await response.text();
    const data = responseBody ? JSON.parse(responseBody) as GraphCollectionResponse<TResponse> & { error?: { message?: string } } : null;
    const graphMessage = data && "error" in data ? data.error?.message : undefined;

    if (response.ok && !graphMessage) {
      return data as TResponse;
    }

    if (attempt < MAX_GRAPH_RETRIES && TRANSIENT_GRAPH_STATUS_CODES.has(response.status)) {
      await wait(getRetryDelayMs(response, attempt));
      continue;
    }

    throw buildGraphRequestError(
      "Microsoft Graph OneNote request failed",
      url,
      response,
      responseBody || null,
      graphMessage
    );
  }

  throw new Error(`Microsoft Graph request exhausted retries for ${url}`);
};

const graphGetText = async (accessToken: string, pathOrUrl: string) => {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`;
  for (let attempt = 0; attempt <= MAX_GRAPH_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/html",
      },
    });

    const content = await response.text();
    if (response.ok) {
      return content;
    }

    if (attempt < MAX_GRAPH_RETRIES && TRANSIENT_GRAPH_STATUS_CODES.has(response.status)) {
      await wait(getRetryDelayMs(response, attempt));
      continue;
    }

    throw buildGraphRequestError(
      "Microsoft Graph OneNote content request failed",
      url,
      response,
      content || null
    );
  }

  throw new Error(`Microsoft Graph content request exhausted retries for ${url}`);
};

export const listOneNoteNotebooks = async (accessToken: string) => {
  return {
    value: await graphGetCollectionAll<OneNoteNotebook>(
      accessToken,
      "/me/onenote/notebooks?$select=id,displayName,createdDateTime,lastModifiedDateTime,isDefault,links,sectionsUrl,sectionGroupsUrl"
    ),
    nextLink: null,
  };
};

export const listOneNoteSections = async (accessToken: string, notebookId?: string) => {
  const path = notebookId
    ? `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName,createdDateTime,lastModifiedDateTime,pagesUrl`
    : "/me/onenote/sections?$select=id,displayName,createdDateTime,lastModifiedDateTime,pagesUrl";

  return {
    value: await graphGetCollectionAll<OneNoteSection>(accessToken, path),
    nextLink: null,
  };
};

export const listOneNotePages = async (accessToken: string, sectionId?: string) => {
  const path = sectionId
    ? `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages?$select=id,title,createdDateTime,lastModifiedDateTime,contentUrl&$expand=parentSection($select=id,displayName)`
    : "/me/onenote/pages?$select=id,title,createdDateTime,lastModifiedDateTime,contentUrl&$expand=parentSection($select=id,displayName)";

  return {
    value: await graphGetCollectionAll<OneNotePage>(accessToken, path),
    nextLink: null,
  };
};

export const getOneNotePage = async (accessToken: string, pageId: string) => {
  return graphGetJson<OneNotePage>(
    accessToken,
    `/me/onenote/pages/${encodeURIComponent(pageId)}?$select=id,title,createdDateTime,lastModifiedDateTime,contentUrl`
  );
};

export const getOneNotePageContent = async (accessToken: string, pageId: string) => {
  return graphGetText(
    accessToken,
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content`
  );
};

export const listPrenotazioniPages = async (accessToken: string) => {
  const sections = await listOneNoteSections(accessToken);
  const prenotazioniSections = sections.value.filter(
    (section) => String(section.displayName || "").trim().toLowerCase() === "prenotazioni"
  );
  const pageCollections = await Promise.all(
    prenotazioniSections.map((section) => listOneNotePages(accessToken, section.id))
  );
  const pages = pageCollections.flatMap((collection) => collection.value);

  return {
    sections: prenotazioniSections,
    pages,
  };
};