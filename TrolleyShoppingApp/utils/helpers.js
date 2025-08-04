import { STORE_NAMES } from "./constants";

export const cleanStoreName = (url) => {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname;

    const withoutWww = hostname.replace(/^www\./, "");

    return (
      STORE_NAMES[withoutWww] ||
      withoutWww
        .split(".")[0]
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  } catch {
    return url;
  }
};

export const formatSyncTime = (time) => {
  const now = new Date();
  const syncTime = new Date(time);
  const diffMs = now - syncTime;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return syncTime.toLocaleDateString();
};

export const renderVariants = (variants) => {
  if (!variants || Object.keys(variants).length === 0) return null;

  const variantPairs = [];
  if (variants.size) variantPairs.push(`Size: ${variants.size}`);
  if (variants.color) variantPairs.push(`Color: ${variants.color}`);
  if (variants.style) variantPairs.push(`Style: ${variants.style}`);

  if (variantPairs.length === 0) return null;

  return variantPairs.join(" | ");
};
