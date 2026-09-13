import { useEffect, useState } from "react";
import { api, API, buildFileUrl, formatApiError } from "../lib/api";

export function isPrivateFileUrl(url) {
  const candidate = new URL(url);
  const backend = new URL(API);
  return candidate.origin === backend.origin && candidate.pathname.startsWith(`${backend.pathname}/files/`);
}

export default function useFileUrl(value) {
  const source = buildFileUrl(value);
  const [result, setResult] = useState({ source: "", url: "", error: "" });

  useEffect(() => {
    if (!source) return undefined;
    if (!isPrivateFileUrl(source)) {
      setResult({ source, url: source, error: "" });
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl;
    api.get(source, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setResult({ source, url: objectUrl, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ source, url: "", error: formatApiError(error, "Could not load this file.") });
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return result.source === source ? result : { url: "", error: "" };
}
